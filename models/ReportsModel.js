const pool = require("../config/dbconfig");

const ReportModel = {
  reportScoreBoard: async (
    user_ids,
    start_date,
    end_date,
    boundaryDay = 26
  ) => {
    try {
      // --- Helpers ---------------------------------------------------------
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      // ensure boundaryDay is a safe integer between 1 and 28-31 (we only use it as a number)
      boundaryDay = Number(boundaryDay) || 26;
      if (boundaryDay < 1) boundaryDay = 1;
      if (boundaryDay > 31) boundaryDay = 31;

      // Parse incoming date (accepts Date or 'YYYY-MM-DD' string)
      const parseToDateOnly = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d)) {
          const dt = new Date(d.getTime());
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
        // assume 'YYYY-MM-DD' (no timezone shift)
        const iso =
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
            ? `${d}T00:00:00`
            : d;
        const dt = new Date(iso);
        if (isNaN(dt)) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      };

      const formatDateTimeSQL = (dt) => {
        // returns 'YYYY-MM-DD HH:MM:SS' (local time)
        const z = (n) => n.toString().padStart(2, "0");
        return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(
          dt.getDate()
        )} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
      };

      // Build half-open range: start_inclusive = start_date 00:00:00, end_exclusive = (end_date + 1 day) 00:00:00
      const startDateOnly = parseToDateOnly(start_date);
      const endDateOnly = parseToDateOnly(end_date);
      if (!startDateOnly || !endDateOnly) {
        throw new Error(
          "Invalid start_date or end_date. Expect 'YYYY-MM-DD' or Date."
        );
      }
      const startDateTimeSQL = formatDateTimeSQL(startDateOnly);
      const endExclusiveDate = new Date(endDateOnly.getTime());
      endExclusiveDate.setDate(endExclusiveDate.getDate() + 1); // +1 day for half-open end
      const endExclusiveDateTimeSQL = formatDateTimeSQL(endExclusiveDate);

      // --- SQL (we inject boundaryDay as a safe number after validation) ----
      // Note: boundaryDay is inserted into SQL string (safe because validated as integer).
      const b = boundaryDay;

      const saleVolumeQuery = `
      SELECT IFNULL(SUM(pm.total_amount), 0) AS sale_volume,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pm.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pm.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pm.created_date AS DATE)
          END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pm.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pm.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pm.created_date AS DATE)
          END, '%Y-%m'
        ) AS ym
      FROM customers AS c
      INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id
      INNER JOIN lead_master AS l ON l.id = c.lead_id
      WHERE 1 = 1
        AND CAST(pm.created_date AS DATE) BETWEEN ? AND ?
    `;

      const collectionQuery = `
      SELECT IFNULL(SUM(pt.amount), 0) AS collection,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE)
          END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE)
          END, '%Y-%m'
        ) AS ym
      FROM customers AS c
      INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id
      INNER JOIN lead_master AS l ON l.id = c.lead_id
      INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id
      WHERE pt.payment_status <> 'Rejected'
        AND CAST(c.created_date AS DATE) BETWEEN ? AND ?
    `;

      const totalCollectionQuery = `
      SELECT IFNULL(SUM(pt.amount), 0) AS total_collection,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pt.invoice_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pt.invoice_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pt.invoice_date AS DATE)
          END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pt.invoice_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pt.invoice_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pt.invoice_date AS DATE)
          END, '%Y-%m'
        ) AS ym
      FROM lead_master AS l
      INNER JOIN customers AS c ON c.lead_id = l.id
      INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id
      WHERE pt.payment_status <> 'Rejected'
        AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?
    `;

      const leadQuery = `
      SELECT COUNT(id) AS total_leads,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(created_date AS DATE)
          END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(created_date AS DATE)
          END, '%Y-%m'
        ) AS ym
      FROM lead_master
      WHERE 1 = 1
        AND CAST(created_date AS DATE) BETWEEN ? AND ?
    `;

      const joinQuery = `
      SELECT COUNT(c.id) AS join_count,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE)
          END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE)
          END, '%Y-%m'
        ) AS ym
      FROM customers AS c
      INNER JOIN lead_master AS l ON c.lead_id = l.id
      WHERE 1 = 1
        AND CAST(c.created_date AS DATE) BETWEEN ? AND ?
    `;

      const followupQuery = `
      SELECT 
        COUNT(lf.id) AS total_followups,
        SUM(CASE WHEN lf.is_updated = 1 THEN 1 ELSE 0 END) AS follow_up_handled,
        SUM(CASE WHEN lf.is_updated = 0 THEN 1 ELSE 0 END) AS follow_up_unhandled,
        ROUND(
          CASE WHEN COUNT(lf.id) = 0 THEN 0
            ELSE (SUM(CASE WHEN lf.is_updated = 1 THEN 1 ELSE 0 END) / COUNT(lf.id)) * 100
          END, 2
        ) AS percentage,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(lf.next_follow_up_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(lf.next_follow_up_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(lf.next_follow_up_date AS DATE)
          END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(lf.next_follow_up_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(lf.next_follow_up_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(lf.next_follow_up_date AS DATE)
          END, '%Y-%m'
        ) AS ym
      FROM lead_follow_up_history AS lf
      INNER JOIN lead_master AS l ON l.id = lf.lead_id
      LEFT JOIN customers AS c ON c.lead_id = l.id
      WHERE c.id IS NULL
        AND CAST(lf.next_follow_up_date AS DATE) BETWEEN ? AND ?
    `;

      // --- Params and optional user filter --------------------------------
      const saleParams = [startDateTimeSQL, endExclusiveDateTimeSQL];
      const collectionParams = [startDateTimeSQL, endExclusiveDateTimeSQL];
      const totalParams = [startDateTimeSQL, endExclusiveDateTimeSQL];
      const leadParams = [startDateTimeSQL, endExclusiveDateTimeSQL];
      const joinParams = [startDateTimeSQL, endExclusiveDateTimeSQL];
      const followupParams = [startDateTimeSQL, endExclusiveDateTimeSQL];

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const ph = user_ids.map(() => "?").join(", ");
          // Append by replacing 'WHERE 1 = 1' occurrences — simpler approach: we'll append filter strings to base queries:
          // (Note: in this function we declared queries as constants above — to avoid re-building each string, we will run queries with appended filters.)
          // So push user_ids into each param array, and later we'll run `pool.query(query + userFilterText + " GROUP BY ...", params)`.
          saleParams.push(...user_ids);
          collectionParams.push(...user_ids);
          totalParams.push(...user_ids);
          leadParams.push(...user_ids);
          joinParams.push(...user_ids);
          followupParams.push(...user_ids);

          // We'll set suffixes to include user filter before GROUP BY when executing.
          var userFilterSuffixSale = ` AND l.assigned_to IN (${ph})`;
          var userFilterSuffixCollection = ` AND l.assigned_to IN (${ph})`;
          var userFilterSuffixTotal = ` AND l.assigned_to IN (${ph})`;
          var userFilterSuffixLead = ` AND assigned_to IN (${ph})`;
          var userFilterSuffixJoin = ` AND l.assigned_to IN (${ph})`;
          var userFilterSuffixFollowup = ` AND l.assigned_to IN (${ph})`;
        } else {
          // single id
          saleParams.push(user_ids);
          collectionParams.push(user_ids);
          totalParams.push(user_ids);
          leadParams.push(user_ids);
          joinParams.push(user_ids);
          followupParams.push(user_ids);

          var userFilterSuffixSale = ` AND l.assigned_to = ?`;
          var userFilterSuffixCollection = ` AND l.assigned_to = ?`;
          var userFilterSuffixTotal = ` AND l.assigned_to = ?`;
          var userFilterSuffixLead = ` AND assigned_to = ?`;
          var userFilterSuffixJoin = ` AND l.assigned_to = ?`;
          var userFilterSuffixFollowup = ` AND l.assigned_to = ?`;
        }
      } else {
        // no user filter
        var userFilterSuffixSale = "";
        var userFilterSuffixCollection = "";
        var userFilterSuffixTotal = "";
        var userFilterSuffixLead = "";
        var userFilterSuffixJoin = "";
        var userFilterSuffixFollowup = "";
      }

      // Add group/order to final SQLs
      const finalSaleQuery =
        saleVolumeQuery +
        userFilterSuffixSale +
        " GROUP BY ym, sale_month ORDER BY ym ASC";
      const finalCollectionQuery =
        collectionQuery +
        userFilterSuffixCollection +
        " GROUP BY ym, sale_month ORDER BY ym ASC";
      const finalTotalQuery =
        totalCollectionQuery +
        userFilterSuffixTotal +
        " GROUP BY ym, sale_month ORDER BY ym ASC";
      const finalLeadQuery =
        leadQuery +
        userFilterSuffixLead +
        " GROUP BY ym, sale_month ORDER BY ym ASC";
      const finalJoinQuery =
        joinQuery +
        userFilterSuffixJoin +
        " GROUP BY ym, sale_month ORDER BY ym ASC";
      const finalFollowupQuery =
        followupQuery +
        userFilterSuffixFollowup +
        " GROUP BY ym, sale_month ORDER BY ym ASC";

      // --- Execute queries -------------------------------------------------
      const [saleRows] = await pool.query(finalSaleQuery, saleParams);
      const [collectionRows] = await pool.query(
        finalCollectionQuery,
        collectionParams
      );
      const [totalRows] = await pool.query(finalTotalQuery, totalParams);
      const [leadRows] = await pool.query(finalLeadQuery, leadParams);
      const [joinRows] = await pool.query(finalJoinQuery, joinParams);
      const [followupRows] = await pool.query(
        finalFollowupQuery,
        followupParams
      );

      // --- Build maps -----------------------------------------------------
      const saleMap = (saleRows || []).reduce((acc, r) => {
        acc[r.sale_month] = toNum(r.sale_volume);
        return acc;
      }, {});
      const collectionMap = (collectionRows || []).reduce((acc, r) => {
        acc[r.sale_month] = toNum(r.collection);
        return acc;
      }, {});
      const totalMap = (totalRows || []).reduce((acc, r) => {
        acc[r.sale_month] = toNum(r.total_collection);
        return acc;
      }, {});
      const leadMap = (leadRows || []).reduce((acc, r) => {
        acc[r.sale_month] = toNum(r.total_leads);
        return acc;
      }, {});
      const joinMap = (joinRows || []).reduce((acc, r) => {
        acc[r.sale_month] = toNum(r.join_count);
        return acc;
      }, {});
      const followupMap = (followupRows || []).reduce((acc, r) => {
        acc[r.sale_month] = {
          total_followups: toNum(r.total_followups),
          follow_up_handled: toNum(r.follow_up_handled),
          follow_up_unhandled: toNum(r.follow_up_unhandled),
          followup_percentage: toNum(r.percentage),
        };
        return acc;
      }, {});

      // --- getMonths using same boundaryDay logic --------------------------------
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const getMappedMonthStart = (dateInput) => {
        // dateInput is Date object (00:00:00)
        const d = new Date(dateInput.getTime());
        const day = d.getDate();
        if (day >= boundaryDay) {
          d.setMonth(d.getMonth() + 1);
        }
        // normalize to 1st of mapped month
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const formatLabel = (d) =>
        `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

      const getMonths = (startDateStr, endDateStr) => {
        const sDate = parseToDateOnly(startDateStr);
        const eDate = parseToDateOnly(endDateStr);
        if (!sDate || !eDate) return [];

        const startMapped = getMappedMonthStart(sDate);
        const endMapped = getMappedMonthStart(eDate);

        // iterate from startMapped to endMapped inclusive
        const months = [];
        const cur = new Date(startMapped.getTime());
        while (cur <= endMapped) {
          months.push(formatLabel(cur));
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      };

      const months = getMonths(start_date, end_date); // e.g. ["January 2025"]

      // --- Prepare month-wise array & totals ------------------------------
      const month_wise = [];
      let total_sale = 0;
      let total_collection = 0;
      let total_pending = 0;
      let total_leads = 0;
      let total_joins = 0;
      let total_followups = 0;
      let total_followup_handled = 0;
      let total_followup_unhandled = 0;

      for (const m of months) {
        const sale_volume = saleMap[m] ?? 0;
        const collection = collectionMap[m] ?? 0;
        const pending = Math.max(0, sale_volume - collection);
        const total_collection_month = totalMap[m] ?? 0;
        const total_lead = leadMap[m] ?? 0;
        const joins = joinMap[m] ?? 0;
        const follow = followupMap[m] || {
          total_followups: 0,
          follow_up_handled: 0,
          follow_up_unhandled: 0,
          followup_percentage: 0,
        };

        total_sale += sale_volume;
        total_collection += total_collection_month;
        total_pending += pending;
        total_leads += total_lead;
        total_joins += joins;
        total_followups += follow.total_followups;
        total_followup_handled += follow.follow_up_handled;
        total_followup_unhandled += follow.follow_up_unhandled;

        month_wise.push({
          sale_month: m,
          sale_volume: Number(sale_volume.toFixed(2)),
          collection: Number(collection.toFixed(2)),
          total_collection: Number(total_collection_month.toFixed(2)),
          pending: Number(pending.toFixed(2)),
          leads: Number(total_lead),
          joins: Number(joins),
          total_followups: Number(follow.total_followups),
          follow_up_handled: Number(follow.follow_up_handled),
          follow_up_unhandled: Number(follow.follow_up_unhandled),
          followup_percentage: Number(follow.followup_percentage),
        });
      }

      const overall_followup_percentage =
        total_followups > 0
          ? Number(
              ((total_followup_handled / total_followups) * 100).toFixed(2)
            )
          : 0;

      const totals = {
        sale_volume: Number(total_sale.toFixed(2)),
        total_collection: Number(total_collection.toFixed(2)),
        pending_payment: Number(total_pending.toFixed(2)),
        total_leads: Number(total_leads),
        total_joins: Number(total_joins),
        total_followups: Number(total_followups),
        total_followup_handled: Number(total_followup_handled),
        total_followup_unhandled: Number(total_followup_unhandled),
        overall_followup_percentage: overall_followup_percentage,
      };

      return { month_wise, totals };
    } catch (error) {
      // bubble error message up (preserve original message)
      throw new Error(error && error.message ? error.message : String(error));
    }
  },

  reportUserWiseScoreBoard: async (
    user_ids,
    start_date,
    end_date,
    boundaryDay = 26
  ) => {
    try {
      // --- Helpers ---------------------------------------------------------
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      boundaryDay = Number(boundaryDay) || 26;
      if (boundaryDay < 1) boundaryDay = 1;
      if (boundaryDay > 31) boundaryDay = 31;

      const parseToDateOnly = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d)) {
          const dt = new Date(d.getTime());
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
        const iso =
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
            ? `${d}T00:00:00`
            : d;
        const dt = new Date(iso);
        if (isNaN(dt)) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      };

      const formatDateTimeSQL = (dt) => {
        const z = (n) => n.toString().padStart(2, "0");
        return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(
          dt.getDate()
        )} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
      };

      const startDateOnly = parseToDateOnly(start_date);
      const endDateOnly = parseToDateOnly(end_date);
      if (!startDateOnly || !endDateOnly) {
        throw new Error(
          "Invalid start_date or end_date. Expect 'YYYY-MM-DD' or Date."
        );
      }
      const startDateTimeSQL = formatDateTimeSQL(startDateOnly);
      const endExclusiveDate = new Date(endDateOnly.getTime());
      endExclusiveDate.setDate(endExclusiveDate.getDate() + 1);
      const endExclusiveDateTimeSQL = formatDateTimeSQL(endExclusiveDate);

      // --- SQL queries (per-user, per-mapped-month) ------------------------
      // sale -> grouped by pm.created_date (payment_master)
      // collection/total_collection -> grouped by pt.invoice_date (payment_trans.invoice_date)
      const b = boundaryDay;

      const saleVolumeQuery = `
      SELECT 
        u.user_id,
        u.user_name,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%Y-%m'
        ) AS ym,
        IFNULL(SUM(pm.total_amount), 0) AS sale_volume
      FROM users AS u
      LEFT JOIN lead_master AS l ON l.assigned_to = u.user_id
      LEFT JOIN customers AS c ON c.lead_id = l.id
      LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      WHERE u.roles LIKE '%Sale%'
        AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;

      const collectionQuery = `
      SELECT 
        u.user_id,
        u.user_name,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%Y-%m'
        ) AS ym,
        IFNULL(SUM(pt.amount), 0) AS collection
      FROM users AS u
      LEFT JOIN lead_master AS l ON l.assigned_to = u.user_id
      LEFT JOIN customers AS c ON c.lead_id = l.id
      LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans AS pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected'
      WHERE u.roles LIKE '%Sale%'
        AND CAST(c.created_date AS DATE) BETWEEN ? AND ?
    `;

      const totalCollectionQuery = `
      SELECT 
        u.user_id,
        u.user_name,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pt.invoice_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pt.invoice_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pt.invoice_date AS DATE) END,
          '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pt.invoice_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pt.invoice_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pt.invoice_date AS DATE) END,
          '%Y-%m'
        ) AS ym,
        IFNULL(SUM(pt.amount), 0) AS total_collection
      FROM users AS u
      LEFT JOIN lead_master AS l ON l.assigned_to = u.user_id
      LEFT JOIN customers AS c ON c.lead_id = l.id
      LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans AS pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected'
      WHERE u.roles LIKE '%Sale%'
        AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?
    `;

      // --- apply user filter suffixes & prepare params --------------------
      const baseParamsSale = [startDateTimeSQL, endExclusiveDateTimeSQL];
      const baseParamsCollection = [startDateTimeSQL, endExclusiveDateTimeSQL];
      const baseParamsTotal = [startDateTimeSQL, endExclusiveDateTimeSQL];

      let userFilterSuffix = "";
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const ph = user_ids.map(() => "?").join(", ");
          userFilterSuffix = ` AND u.user_id IN (${ph})`;
          baseParamsSale.push(...user_ids);
          baseParamsCollection.push(...user_ids);
          baseParamsTotal.push(...user_ids);
        } else {
          userFilterSuffix = ` AND u.user_id = ?`;
          baseParamsSale.push(user_ids);
          baseParamsCollection.push(user_ids);
          baseParamsTotal.push(user_ids);
        }
      }

      const finalSaleQuery =
        saleVolumeQuery +
        userFilterSuffix +
        " GROUP BY ym, sale_month, u.user_id, u.user_name ORDER BY ym ASC, sale_volume DESC";
      const finalCollectionQuery =
        collectionQuery +
        userFilterSuffix +
        " GROUP BY ym, sale_month, u.user_id, u.user_name ORDER BY ym ASC, collection DESC";
      const finalTotalQuery =
        totalCollectionQuery +
        userFilterSuffix +
        " GROUP BY ym, sale_month, u.user_id, u.user_name ORDER BY ym ASC, total_collection DESC";

      // --- execute queries -------------------------------------------------
      const [saleRows] = await pool.query(finalSaleQuery, baseParamsSale);
      const [collectionRows] = await pool.query(
        finalCollectionQuery,
        baseParamsCollection
      );

      const [totalRows] = await pool.query(finalTotalQuery, baseParamsTotal);

      // --- build maps keyed by month + user_id ------------------------------
      const saleMap = (saleRows || []).reduce((acc, r) => {
        const key = `${r.sale_month}||${r.user_id}`;
        acc[key] = toNum(r.sale_volume);
        return acc;
      }, {});
      const collectionMap = (collectionRows || []).reduce((acc, r) => {
        const key = `${r.sale_month}||${r.user_id}`;
        acc[key] = toNum(r.collection);
        return acc;
      }, {});
      const totalMap = (totalRows || []).reduce((acc, r) => {
        const key = `${r.sale_month}||${r.user_id}`;
        acc[key] = toNum(r.total_collection);
        return acc;
      }, {});

      // --- compute month list using same boundary logic --------------------
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthAbbrev = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const getMappedMonthStart = (dateInput) => {
        const d = new Date(dateInput.getTime());
        const day = d.getDate();
        if (day >= boundaryDay) d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const formatLabel = (d) =>
        `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const formatAbbrev = (d) =>
        `${monthAbbrev[d.getMonth()]} ${d.getFullYear()}`; // "Jan 2025"

      const getMonths = (startDateStr, endDateStr) => {
        const sDate = parseToDateOnly(startDateStr);
        const eDate = parseToDateOnly(endDateStr);
        if (!sDate || !eDate) return [];
        const startMapped = getMappedMonthStart(sDate);
        const endMapped = getMappedMonthStart(eDate);
        const months = [];
        const cur = new Date(startMapped.getTime());
        while (cur <= endMapped) {
          months.push({
            label: formatLabel(cur),
            abbrev: formatAbbrev(cur),
            d: new Date(cur.getTime()),
          });
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      };

      const months = getMonths(start_date, end_date);

      // --- assemble user list (either from user_ids or from query rows) ----
      const userSet = new Set();
      if (user_ids) {
        if (Array.isArray(user_ids)) user_ids.forEach((u) => userSet.add(u));
        else userSet.add(user_ids);
      } else {
        (saleRows || []).forEach((r) => userSet.add(r.user_id));
        (collectionRows || []).forEach((r) => userSet.add(r.user_id));
        (totalRows || []).forEach((r) => userSet.add(r.user_id));
      }

      const userIds = Array.from(userSet);
      if (userIds.length === 0) return [];

      // --- fetch user names in batch --------------------------------------
      const [userRows] = await pool.query(
        `SELECT user_id, user_name FROM users WHERE user_id IN (${userIds
          .map(() => "?")
          .join(", ")})`,
        userIds
      );
      const userNameMap = (userRows || []).reduce((acc, r) => {
        acc[r.user_id] = r.user_name;
        return acc;
      }, {});

      // --- Batch load targets for all users × months ----------------------
      // patterns like '%Jan 2025%'
      const monthPatterns = months.map((m) => `%${m.abbrev}%`);
      const targetParams = [...userIds, ...monthPatterns];
      const targetWhere =
        (userIds.length > 0
          ? `user_id IN (${userIds.map(() => "?").join(", ")})`
          : "1=0") +
        " AND (" +
        (monthPatterns.length > 0
          ? monthPatterns.map(() => "target_month LIKE ?").join(" OR ")
          : "1=0") +
        ")";

      const [targetRows] = await pool.query(
        `SELECT id, user_id, target_month, target_value FROM user_target_master WHERE ${targetWhere} ORDER BY id DESC`,
        targetParams
      );

      // Build targetMap keyed by `${user_id}||${m.abbrev}` (latest id wins)
      const targetMap = {};
      (targetRows || []).forEach((tr) => {
        if (!tr.target_month || typeof tr.target_month !== "string") return;
        for (const m of months) {
          if (tr.target_month.includes(m.abbrev)) {
            const key = `${tr.user_id}||${m.abbrev}`; // e.g. "U001||Jan 2025"
            if (!targetMap[key] || tr.id > targetMap[key].id) {
              targetMap[key] = {
                id: tr.id,
                target_month: tr.target_month,
                target_value: toNum(tr.target_value),
              };
            }
          }
        }
      });

      // --- Build final per-user array -------------------------------------
      const result = [];

      for (const uid of userIds) {
        const user_name = userNameMap[uid] || "";

        for (const mObj of months) {
          const mLabel = mObj.label; // "January 2025"
          const mAbbrev = mObj.abbrev; // "Jan 2025"

          const sale_volume = saleMap[`${mLabel}||${uid}`] ?? 0;
          const collection = collectionMap[`${mLabel}||${uid}`] ?? 0;
          const total_collection = totalMap[`${mLabel}||${uid}`] ?? 0;

          // pending = sale - total_collection (unpaid amount)
          const pending = Math.max(0, sale_volume - collection);

          // Targets: key is `${uid}||${mAbbrev}` ("U001||Jan 2025")
          const tKey = `${uid}||${mAbbrev}`;
          const matchedTarget = targetMap[tKey] || null;
          const target_value = matchedTarget
            ? toNum(matchedTarget.target_value)
            : 0;
          const target_month = matchedTarget ? matchedTarget.target_month : "";
          const percentage =
            target_value > 0
              ? Number(((total_collection / target_value) * 100).toFixed(2))
              : 0;

          result.push({
            user_id: uid,
            user_name: user_name,
            month: mAbbrev, // "Jan 2025"
            label: mLabel, // "January 2025"
            sale_volume: Number(sale_volume.toFixed(2)),
            collection: Number(collection.toFixed(2)),
            total_collection: Number(total_collection.toFixed(2)),
            pending: Number(pending.toFixed(2)),
            target_month,
            target_value: Number(target_value.toFixed(2)),
            percentage,
          });
        }
      }

      return result;
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error));
    }
  },

  reportUserWiseLead: async (
    user_ids,
    start_date,
    end_date,
    boundaryDay = 26
  ) => {
    try {
      // --- validate/normalize boundaryDay -------------------------------
      boundaryDay = Number(boundaryDay) || 26;
      if (boundaryDay < 1) boundaryDay = 1;
      if (boundaryDay > 31) boundaryDay = 31;

      // --- helpers -------------------------------------------------------
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      const parseToDateOnly = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d)) {
          const dt = new Date(d.getTime());
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
        const iso =
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
            ? `${d}T00:00:00`
            : d;
        const dt = new Date(iso);
        if (isNaN(dt)) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      };

      const formatDateTimeSQL = (dt) => {
        const z = (n) => n.toString().padStart(2, "0");
        return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(
          dt.getDate()
        )} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
      };

      // --- build half-open datetimes ------------------------------------
      const startDateOnly = parseToDateOnly(start_date);
      const endDateOnly = parseToDateOnly(end_date);
      if (!startDateOnly || !endDateOnly) {
        throw new Error(
          "Invalid start_date or end_date. Expect 'YYYY-MM-DD' or Date."
        );
      }
      const startDateTimeSQL = formatDateTimeSQL(startDateOnly);
      const endExclusive = new Date(endDateOnly.getTime());
      endExclusive.setDate(endExclusive.getDate() + 1);
      const endExclusiveDateTimeSQL = formatDateTimeSQL(endExclusive);

      // --- month mapping helpers ----------------------------------------
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthAbbrev = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const getMappedMonthStart = (dateInput) => {
        const d = new Date(dateInput.getTime());
        const day = d.getDate();
        if (day >= boundaryDay) d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const formatLabel = (d) =>
        `${monthNames[d.getMonth()]} ${d.getFullYear()}`; // "January 2025"
      const formatAbbrev = (d) =>
        `${monthAbbrev[d.getMonth()]} ${d.getFullYear()}`; // "Jan 2025"
      const monthKeyFromDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`; // "2025-01"
      };

      const getMonths = (startDateStr, endDateStr) => {
        const sDate = parseToDateOnly(startDateStr);
        const eDate = parseToDateOnly(endDateStr);
        if (!sDate || !eDate) return [];
        const startMapped = getMappedMonthStart(sDate);
        const endMapped = getMappedMonthStart(eDate);
        const months = [];
        const cur = new Date(startMapped.getTime());
        while (cur <= endMapped) {
          months.push({
            label: formatLabel(cur),
            abbrev: formatAbbrev(cur),
            key: monthKeyFromDate(cur),
            d: new Date(cur.getTime()),
          });
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      };

      const months = getMonths(start_date, end_date); // array of mapped months

      // --- build user list: either provided or all Sale users -----------
      let userList = [];
      if (user_ids) {
        if (Array.isArray(user_ids)) userList = Array.from(new Set(user_ids));
        else userList = [user_ids];
      } else {
        // fetch all sale users
        const [urows] = await pool.query(
          `SELECT user_id FROM users WHERE roles LIKE '%Sale%'`
        );
        userList = (urows || []).map((r) => r.user_id);
      }

      if (userList.length === 0) return []; // nothing to do

      // --- prepare user placeholder and params for queries --------------
      const userPlaceholders = userList.map(() => "?").join(", ");
      const userParams = [...userList];

      // --- Aggregates: leads, followups, joins (use half-open datetime filters) ---
      // Leads aggregate (mapped by l.created_date)
      const leadsAgg = `
      SELECT
        u.user_id,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(l.created_date AS DATE)) >= ${boundaryDay}
            THEN DATE_ADD(CAST(l.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(l.created_date AS DATE) END, '%Y-%m'
        ) AS month,
        COUNT(l.id) AS total_leads,
        SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS customer_count
      FROM users u
      LEFT JOIN lead_master l ON l.assigned_to = u.user_id AND l.created_date >= ? AND l.created_date < ?
      LEFT JOIN customers c ON c.lead_id = l.id
      WHERE u.roles LIKE '%Sale%' AND u.user_id IN (${userPlaceholders})
      GROUP BY u.user_id, month
    `;

      // Followups aggregate (mapped by lfh.next_follow_up_date) for leads where customer IS NULL
      const followupsAgg = `
      SELECT
        u.user_id,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(lfh.next_follow_up_date AS DATE)) >= ${boundaryDay}
            THEN DATE_ADD(CAST(lfh.next_follow_up_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(lfh.next_follow_up_date AS DATE) END, '%Y-%m'
        ) AS month,
        COUNT(lfh.id) AS lead_followup_count,
        SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) AS followup_handled,
        SUM(CASE WHEN lfh.is_updated = 0 THEN 1 ELSE 0 END) AS followup_unhandled
      FROM users u
      LEFT JOIN lead_master l ON l.assigned_to = u.user_id
      LEFT JOIN customers c ON c.lead_id = l.id
      LEFT JOIN lead_follow_up_history lfh ON lfh.lead_id = l.id AND lfh.next_follow_up_date >= ? AND lfh.next_follow_up_date < ?
      WHERE u.roles LIKE '%Sale%' AND c.id IS NULL AND u.user_id IN (${userPlaceholders})
      GROUP BY u.user_id, month
    `;

      // Joining aggregate (mapped by c.created_date)
      const joiningAgg = `
      SELECT
        u.user_id,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${boundaryDay}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END, '%Y-%m'
        ) AS month,
        COUNT(DISTINCT c.id) AS joined_customers
      FROM users u
      LEFT JOIN lead_master l ON l.assigned_to = u.user_id
      LEFT JOIN customers c ON c.lead_id = l.id AND c.created_date >= ? AND c.created_date < ?
      WHERE u.roles LIKE '%Sale%' AND u.user_id IN (${userPlaceholders})
      GROUP BY u.user_id, month
    `;

      // --- execute aggregates (params: date range then user list for each) ---
      const leadsParams = [
        startDateTimeSQL,
        endExclusiveDateTimeSQL,
        ...userParams,
      ];
      const followupParams = [
        startDateTimeSQL,
        endExclusiveDateTimeSQL,
        ...userParams,
      ];
      const joiningParams = [
        startDateTimeSQL,
        endExclusiveDateTimeSQL,
        ...userParams,
      ];

      const [leadRows] = await pool.query(leadsAgg, leadsParams);
      const [followRows] = await pool.query(followupsAgg, followupParams);
      const [joinRows] = await pool.query(joiningAgg, joiningParams);

      // --- build maps keyed by 'userId||YYYY-MM' ---------------------------
      const leadMap = (leadRows || []).reduce((acc, r) => {
        const key = `${r.user_id}||${r.month}`;
        acc[key] = {
          total_leads: toNum(r.total_leads),
          customer_count: toNum(r.customer_count),
        };
        return acc;
      }, {});

      const followMap = (followRows || []).reduce((acc, r) => {
        const key = `${r.user_id}||${r.month}`;
        acc[key] = {
          lead_followup_count: toNum(r.lead_followup_count),
          followup_handled: toNum(r.followup_handled),
          followup_unhandled: toNum(r.followup_unhandled),
        };
        return acc;
      }, {});

      const joinMap = (joinRows || []).reduce((acc, r) => {
        const key = `${r.user_id}||${r.month}`;
        acc[key] = {
          joined_customers: toNum(r.joined_customers),
        };
        return acc;
      }, {});

      // --- fetch user names (batch) -------------------------------------
      const [userRows] = await pool.query(
        `SELECT user_id, user_name FROM users WHERE user_id IN (${userPlaceholders})`,
        userParams
      );
      const userNameMap = (userRows || []).reduce((acc, r) => {
        acc[r.user_id] = r.user_name;
        return acc;
      }, {});

      // --- construct final per-user result: every user × every mapped month ---
      const final = [];
      for (const uid of userList) {
        const uname = userNameMap[uid] || "";
        const monthsArr = months.map((m) => {
          const monthKey = m.key; // "YYYY-MM"
          const leadData = leadMap[`${uid}||${monthKey}`] || {
            total_leads: 0,
            customer_count: 0,
          };
          const followData = followMap[`${uid}||${monthKey}`] || {
            lead_followup_count: 0,
            followup_handled: 0,
            followup_unhandled: 0,
          };
          const joinData = joinMap[`${uid}||${monthKey}`] || {
            joined_customers: 0,
          };

          const total_leads = leadData.total_leads;
          const customer_count = leadData.customer_count;
          const lead_to_customer_percentage =
            total_leads > 0
              ? Number(((customer_count / total_leads) * 100).toFixed(2))
              : 0;

          const lead_followup_count = followData.lead_followup_count;
          const followup_handled = followData.followup_handled;
          const followup_unhandled = followData.followup_unhandled;
          const followup_handled_percentage =
            lead_followup_count > 0
              ? Number(
                  ((followup_handled / lead_followup_count) * 100).toFixed(2)
                )
              : 0;

          const joined_customers = joinData.joined_customers;

          final.push({
            user_id: uid,
            user_name: uname,
            month: m.abbrev, // "Jan 2025"
            label: m.label, // "January 2025"
            total_leads,
            customer_count,
            lead_to_customer_percentage,
            lead_followup_count,
            followup_handled,
            followup_unhandled,
            followup_handled_percentage,
            joined_customers,
          });
        });
      }

      return final;
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error));
    }
  },

  reportBranchWiseScoreBoard: async (
    region_id,
    start_date,
    end_date,
    boundaryDay = 26
  ) => {
    try {
      // --- helpers & validate boundaryDay --------------------------------
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      boundaryDay = Number(boundaryDay) || 26;
      if (boundaryDay < 1) boundaryDay = 1;
      if (boundaryDay > 31) boundaryDay = 31;

      const parseToDateOnly = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d)) {
          const dt = new Date(d.getTime());
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
        const iso =
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
            ? `${d}T00:00:00`
            : d;
        const dt = new Date(iso);
        if (isNaN(dt)) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      };

      const formatDateTimeSQL = (dt) => {
        const z = (n) => n.toString().padStart(2, "0");
        return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(
          dt.getDate()
        )} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
      };

      // --- build half-open date range ------------------------------------
      const startDateOnly = parseToDateOnly(start_date);
      const endDateOnly = parseToDateOnly(end_date);
      if (!startDateOnly || !endDateOnly)
        throw new Error(
          "Invalid start_date or end_date. Expect 'YYYY-MM-DD' or Date."
        );
      const startDateTimeSQL = formatDateTimeSQL(startDateOnly);
      const endExclusive = new Date(endDateOnly.getTime());
      endExclusive.setDate(endExclusive.getDate() + 1);
      const endExclusiveDateTimeSQL = formatDateTimeSQL(endExclusive);

      // --- region filter logic: build region suffix and params -------------
      let regionSuffix = "";
      let branchFetchRegionWhere = "";
      const regionParams = [];
      if (region_id) {
        const [getRegion] = await pool.query(
          `SELECT id, name FROM region WHERE is_active = 1 AND id = ?`,
          [region_id]
        );
        if (getRegion && getRegion[0]) {
          const rname = getRegion[0].name;
          if (rname === "Chennai" || rname === "Bangalore") {
            regionSuffix = ` AND b.region_id = ? AND b.name <> 'Online'`;
            branchFetchRegionWhere = ` WHERE region_id = ? AND is_active = 1 AND name <> 'Online'`;
          } else if (rname === "Hub") {
            regionSuffix = ` AND b.region_id = ?`;
            branchFetchRegionWhere = ` WHERE region_id = ? AND is_active = 1`;
          } else {
            regionSuffix = ` AND b.region_id = ?`;
            branchFetchRegionWhere = ` WHERE region_id = ? AND is_active = 1`;
          }
          regionParams.push(region_id);
        }
      } else {
        branchFetchRegionWhere = ` WHERE is_active = 1`;
      }

      const b = boundaryDay;

      // --- Queries: move date filters into JOINs (so LEFT JOIN remains LEFT JOIN) ---
      // sale uses c.created_date mapping/filter inside the customer join
      const saleQueryBase = `
      SELECT
        b.id AS branch_id,
        b.name AS branch_name,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END, '%Y-%m'
        ) AS ym,
        IFNULL(SUM(pm.total_amount), 0) AS sale_volume
      FROM branches b
      LEFT JOIN customers c ON b.id = c.branch_id
        ${
          start_date && end_date
            ? ` AND c.created_date >= ? AND c.created_date < ?`
            : ""
        }
      LEFT JOIN lead_master l ON c.lead_id = l.id
      LEFT JOIN payment_master pm ON pm.lead_id = c.lead_id
      WHERE 1 = 1
        ${regionSuffix}
      GROUP BY b.id, b.name, ym, sale_month
    `;

      // collection uses c.created_date mapping/filter inside the customer join but aggregates pt.amount
      const collectionQueryBase = `
      SELECT
        b.id AS branch_id,
        b.name AS branch_name,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END, '%Y-%m'
        ) AS ym,
        IFNULL(SUM(pt.amount), 0) AS collection
      FROM branches b
      LEFT JOIN customers c ON b.id = c.branch_id
        ${
          start_date && end_date
            ? ` AND c.created_date >= ? AND c.created_date < ?`
            : ""
        }
      LEFT JOIN lead_master l ON c.lead_id = l.id
      LEFT JOIN payment_master pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected'
      WHERE 1 = 1
        ${regionSuffix}
      GROUP BY b.id, b.name, ym, sale_month
    `;

      // total_collection uses pt.invoice_date mapping/filter inside the payment_trans join
      const totalQueryBase = `
      SELECT
        b.id AS branch_id,
        b.name AS branch_name,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pt.invoice_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pt.invoice_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pt.invoice_date AS DATE) END, '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(pt.invoice_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(pt.invoice_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(pt.invoice_date AS DATE) END, '%Y-%m'
        ) AS ym,
        IFNULL(SUM(pt.amount), 0) AS total_collection
      FROM branches b
      LEFT JOIN customers c ON b.id = c.branch_id
      LEFT JOIN lead_master l ON c.lead_id = l.id
      LEFT JOIN payment_master pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected'
        ${
          start_date && end_date
            ? ` AND pt.invoice_date >= ? AND pt.invoice_date < ?`
            : ""
        }
      WHERE 1 = 1
        ${regionSuffix}
      GROUP BY b.id, b.name, ym, sale_month
    `;

      // --- Execute queries (pass date params in same order as they appear in each query, then region params) -----------
      const saleParams = [];
      const collectionParams = [];
      const totalParams = [];

      if (start_date && end_date) {
        // customer-created filters for sale & collection
        saleParams.push(startDateTimeSQL, endExclusiveDateTimeSQL);
        collectionParams.push(startDateTimeSQL, endExclusiveDateTimeSQL);
        // payment_trans invoice_date for total
        totalParams.push(startDateTimeSQL, endExclusiveDateTimeSQL);
      }
      // append region params at the end of each param array
      saleParams.push(...regionParams);
      collectionParams.push(...regionParams);
      totalParams.push(...regionParams);

      const [saleRows] = await pool.query(saleQueryBase, saleParams);
      const [collectionRows] = await pool.query(
        collectionQueryBase,
        collectionParams
      );
      const [totalRows] = await pool.query(totalQueryBase, totalParams);

      // --- build lookup maps keyed by 'sale_month||branch_id' ----------------
      const saleMap = (saleRows || []).reduce((acc, r) => {
        acc[`${r.sale_month}||${r.branch_id}`] = toNum(r.sale_volume);
        return acc;
      }, {});
      const collectionMap = (collectionRows || []).reduce((acc, r) => {
        acc[`${r.sale_month}||${r.branch_id}`] = toNum(r.collection);
        return acc;
      }, {});
      const totalMap = (totalRows || []).reduce((acc, r) => {
        acc[`${r.sale_month}||${r.branch_id}`] = toNum(r.total_collection);
        return acc;
      }, {});

      // --- build months list using boundaryDay mapping ----------------------
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthAbbrev = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const getMappedMonthStart = (dateInput) => {
        const d = new Date(dateInput.getTime());
        const day = d.getDate();
        if (day >= boundaryDay) d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const formatLabel = (d) =>
        `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const formatAbbrev = (d) =>
        `${monthAbbrev[d.getMonth()]} ${d.getFullYear()}`;

      const getMonths = (startDateStr, endDateStr) => {
        const sDate = parseToDateOnly(startDateStr);
        const eDate = parseToDateOnly(endDateStr);
        if (!sDate || !eDate) return [];
        const startMapped = getMappedMonthStart(sDate);
        const endMapped = getMappedMonthStart(eDate);
        const months = [];
        const cur = new Date(startMapped.getTime());
        while (cur <= endMapped) {
          months.push({
            label: formatLabel(cur),
            abbrev: formatAbbrev(cur),
            d: new Date(cur.getTime()),
          });
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      };

      const months = getMonths(start_date, end_date);

      // --- assemble branch list: fetch all branches matching region (so every branch is included) ------
      const branchFetchQuery = `SELECT id AS branch_id, name AS branch_name FROM branches ${branchFetchRegionWhere}`;
      const branchFetchParams = region_id ? [region_id] : [];
      const [branchRows] = await pool.query(
        branchFetchQuery,
        branchFetchParams
      );
      const branchIds = (branchRows || []).map((r) => r.branch_id);
      if (branchIds.length === 0) return []; // no branches to report

      const branchNameMap = (branchRows || []).reduce((acc, r) => {
        acc[r.branch_id] = r.branch_name;
        return acc;
      }, {});

      // --- build final flattened result: every branch × every month ----------
      const result = [];
      for (const bid of branchIds) {
        const bname = branchNameMap[bid] || "";
        for (const mObj of months) {
          const mLabel = mObj.label; // "January 2025"
          const mAbbrev = mObj.abbrev; // "Jan 2025"

          const sale_volume = saleMap[`${mLabel}||${bid}`] ?? 0;
          const collection = collectionMap[`${mLabel}||${bid}`] ?? 0;
          const total_collection = totalMap[`${mLabel}||${bid}`] ?? 0;
          const pending = Math.max(0, sale_volume - collection);

          result.push({
            branch_id: bid,
            branch_name: bname,
            month: mAbbrev,
            label: mLabel,
            sale_volume: Number(sale_volume.toFixed(2)),
            collection: Number(collection.toFixed(2)),
            total_collection: Number(total_collection.toFixed(2)),
            pending: Number(pending.toFixed(2)),
          });
        }
      }

      return result;
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error));
    }
  },

  reportBranchWiseLeads: async (
    region_id,
    start_date,
    end_date,
    boundaryDay = 26
  ) => {
    try {
      // --- helpers & validate boundaryDay --------------------------------
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      boundaryDay = Number(boundaryDay) || 26;
      if (boundaryDay < 1) boundaryDay = 1;
      if (boundaryDay > 31) boundaryDay = 31;

      const parseToDateOnly = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d)) {
          const dt = new Date(d.getTime());
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
        const iso =
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
            ? `${d}T00:00:00`
            : d;
        const dt = new Date(iso);
        if (isNaN(dt)) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      };

      const formatDateTimeSQL = (dt) => {
        const z = (n) => n.toString().padStart(2, "0");
        return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(
          dt.getDate()
        )} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
      };

      // --- half-open date range ------------------------------------------
      const startDateOnly = parseToDateOnly(start_date);
      const endDateOnly = parseToDateOnly(end_date);
      if (!startDateOnly || !endDateOnly)
        throw new Error(
          "Invalid start_date or end_date. Expect 'YYYY-MM-DD' or Date."
        );
      const startDateTimeSQL = formatDateTimeSQL(startDateOnly);
      const endExclusive = new Date(endDateOnly.getTime());
      endExclusive.setDate(endExclusive.getDate() + 1);
      const endExclusiveDateTimeSQL = formatDateTimeSQL(endExclusive);

      // --- region logic (same rules as yours) -----------------------------
      let regionSuffix = "";
      let branchFetchRegionWhere = "";
      const regionParams = [];
      if (region_id) {
        const [getRegion] = await pool.query(
          `SELECT id, name FROM region WHERE is_active = 1 AND id = ?`,
          [region_id]
        );
        if (getRegion && getRegion[0]) {
          const rname = getRegion[0].name;
          if (rname === "Chennai" || rname === "Bangalore") {
            regionSuffix = ` AND b.region_id = ? AND b.name <> 'Online'`;
            branchFetchRegionWhere = ` WHERE region_id = ? AND is_active = 1 AND name <> 'Online'`;
          } else if (rname === "Hub") {
            regionSuffix = ` AND b.region_id = ?`;
            branchFetchRegionWhere = ` WHERE region_id = ? AND is_active = 1`;
          } else {
            regionSuffix = ` AND b.region_id = ?`;
            branchFetchRegionWhere = ` WHERE region_id = ? AND is_active = 1`;
          }
          regionParams.push(region_id);
        }
      } else {
        branchFetchRegionWhere = ` WHERE is_active = 1`;
      }

      const b = boundaryDay;

      // --- Aggregates (date filters moved into JOINs to preserve LEFT JOIN) ---
      // Leads aggregate (mapped by l.created_date)
      const leadsAgg = `
      SELECT
        b.id AS branch_id,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(l.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(l.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(l.created_date AS DATE) END, '%Y-%m'
        ) AS month,
        COUNT(l.id) AS total_leads,
        SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS customer_count
      FROM branches b
      LEFT JOIN lead_master l ON l.branch_id = b.id ${
        start_date && end_date
          ? ` AND l.created_date >= ? AND l.created_date < ?`
          : ""
      }
      LEFT JOIN customers c ON c.lead_id = l.id
      WHERE 1 = 1 ${regionSuffix}
      GROUP BY b.id, month
    `;

      // Followups aggregate (mapped by lfh.next_follow_up_date) only for leads where c.id IS NULL
      const followupsAgg = `
      SELECT
        b.id AS branch_id,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(lfh.next_follow_up_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(lfh.next_follow_up_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(lfh.next_follow_up_date AS DATE) END, '%Y-%m'
        ) AS month,
        COUNT(lfh.id) AS lead_followup_count,
        SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) AS followup_handled,
        SUM(CASE WHEN lfh.is_updated = 0 THEN 1 ELSE 0 END) AS followup_unhandled
      FROM branches b
      LEFT JOIN lead_master l ON l.branch_id = b.id
      LEFT JOIN customers c ON c.lead_id = l.id
      LEFT JOIN lead_follow_up_history lfh ON lfh.lead_id = l.id ${
        start_date && end_date
          ? ` AND lfh.next_follow_up_date >= ? AND lfh.next_follow_up_date < ?`
          : ""
      }
      WHERE c.id IS NULL ${regionSuffix}
      GROUP BY b.id, month
    `;

      // Joining aggregate (mapped by c.created_date)
      const joiningAgg = `
      SELECT
        b.id AS branch_id,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END, '%Y-%m'
        ) AS month,
        COUNT(DISTINCT c.id) AS joined_customers
      FROM branches b
      LEFT JOIN lead_master l ON l.branch_id = b.id
      LEFT JOIN customers c ON c.lead_id = l.id ${
        start_date && end_date
          ? ` AND c.created_date >= ? AND c.created_date < ?`
          : ""
      }
      WHERE 1 = 1 ${regionSuffix}
      GROUP BY b.id, month
    `;

      // --- Build CTE combining aggregates into user_months-like structure ----
      const finalQuery = `
      WITH leads AS (${leadsAgg}),
           followups AS (${followupsAgg}),
           joins AS (${joiningAgg}),
      branch_months AS (
        SELECT branch_id, month FROM leads
        UNION
        SELECT branch_id, month FROM followups
        UNION
        SELECT branch_id, month FROM joins
      )
      SELECT
        bm.branch_id,
        br.name AS branch_name,
        bm.month,
        DATE_FORMAT(STR_TO_DATE(CONCAT(bm.month, '-01'), '%Y-%m-%d'), '%b %Y') AS label,
        IFNULL(l.total_leads, 0) AS total_leads,
        IFNULL(l.customer_count, 0) AS customer_count,
        ROUND((IFNULL(l.customer_count,0) / NULLIF(IFNULL(l.total_leads,0),0)) * 100, 2) AS lead_to_customer_percentage,
        IFNULL(f.lead_followup_count, 0) AS lead_followup_count,
        IFNULL(f.followup_handled, 0) AS followup_handled,
        IFNULL(f.followup_unhandled, 0) AS followup_unhandled,
        ROUND((IFNULL(f.followup_handled,0) / NULLIF(IFNULL(f.lead_followup_count,0),0)) * 100, 2) AS followup_handled_percentage,
        IFNULL(j.joined_customers, 0) AS joined_customers
      FROM branch_months bm
      LEFT JOIN leads l ON l.branch_id = bm.branch_id AND l.month = bm.month
      LEFT JOIN followups f ON f.branch_id = bm.branch_id AND f.month = bm.month
      LEFT JOIN joins j ON j.branch_id = bm.branch_id AND j.month = bm.month
      LEFT JOIN branches br ON br.id = bm.branch_id
      ORDER BY br.name ASC, bm.month DESC;
    `;

      // --- final params order: leads params, followups params, joining params ---
      const leadsParams = [];
      const followupParams = [];
      const joiningParams = [];

      if (start_date && end_date) {
        leadsParams.push(startDateTimeSQL, endExclusiveDateTimeSQL);
        followupParams.push(startDateTimeSQL, endExclusiveDateTimeSQL);
        joiningParams.push(startDateTimeSQL, endExclusiveDateTimeSQL);
      }
      // append region params for each (regionSuffix appears in each aggregate)
      leadsParams.push(...regionParams);
      followupParams.push(...regionParams);
      joiningParams.push(...regionParams);

      const finalParams = [...leadsParams, ...followupParams, ...joiningParams];

      // --- run query to get raw rows per branch+month -----------------------
      const [rows] = await pool.query(finalQuery, finalParams);

      // --- compute months list (mapped) for the full range so every branch gets same months ---
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthAbbrev = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const getMappedMonthStart = (dateInput) => {
        const d = new Date(dateInput.getTime());
        const day = d.getDate();
        if (day >= boundaryDay) d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const formatLabel = (d) =>
        `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const formatAbbrev = (d) =>
        `${monthAbbrev[d.getMonth()]} ${d.getFullYear()}`;
      const getMonths = (startDateStr, endDateStr) => {
        const sDate = parseToDateOnly(startDateStr);
        const eDate = parseToDateOnly(endDateStr);
        if (!sDate || !eDate) return [];
        const startMapped = getMappedMonthStart(sDate);
        const endMapped = getMappedMonthStart(eDate);
        const months = [];
        const cur = new Date(startMapped.getTime());
        while (cur <= endMapped) {
          months.push({
            label: formatLabel(cur),
            abbrev: formatAbbrev(cur),
            d: new Date(cur.getTime()),
          });
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      };
      const months = getMonths(start_date, end_date);

      // --- assemble branch list (all branches for region or all active branches) ---
      const branchFetchQuery = `SELECT id AS branch_id, name AS branch_name FROM branches ${branchFetchRegionWhere}`;
      const branchFetchParams = region_id ? [region_id] : [];
      const [branchRows] = await pool.query(
        branchFetchQuery,
        branchFetchParams
      );
      const branchIds = (branchRows || []).map((r) => r.branch_id);
      if (branchIds.length === 0) return [];

      const branchNameMap = (branchRows || []).reduce((acc, r) => {
        acc[r.branch_id] = r.branch_name;
        return acc;
      }, {});

      // --- convert raw rows to lookup maps keyed by 'branchId||month' ----------
      const rowMap = {};
      (rows || []).forEach((r) => {
        const key = `${r.branch_id}||${r.month}`;
        rowMap[key] = {
          total_leads: toNum(r.total_leads),
          customer_count: toNum(r.customer_count),
          lead_to_customer_percentage: toNum(r.lead_to_customer_percentage),
          lead_followup_count: toNum(r.lead_followup_count),
          followup_handled: toNum(r.followup_handled),
          followup_unhandled: toNum(r.followup_unhandled),
          followup_handled_percentage: toNum(r.followup_handled_percentage),
          joined_customers: toNum(r.joined_customers),
          label: r.label,
        };
      });

      // --- build final per-branch array with months array ---------------------
      const result = [];
      for (const bid of branchIds) {
        months.map((mObj) => {
          const monthKey = mObj.label.includes(" ")
            ? (() => {
                // convert "January 2025" -> "2025-01"
                const [mn, yy] = mObj.label.split(" ");
                // find numeric month index from monthNames
                const mi = monthNames.indexOf(mn) + 1;
                const mm = mi.toString().padStart(2, "0");
                return `${yy}-${mm}`;
              })()
            : mObj.label;

          const data = rowMap[`${bid}||${monthKey}`] || null;
          result.push({
            branch_id: bid,
            branch_name: branchNameMap[bid] || "",
            month: mObj.abbrev, // "Jan 2025"
            label: mObj.label, // "January 2025"
            total_leads: data ? data.total_leads : 0,
            customer_count: data ? data.customer_count : 0,
            lead_to_customer_percentage: data
              ? data.lead_to_customer_percentage
              : 0,
            lead_followup_count: data ? data.lead_followup_count : 0,
            followup_handled: data ? data.followup_handled : 0,
            followup_unhandled: data ? data.followup_unhandled : 0,
            followup_handled_percentage: data
              ? data.followup_handled_percentage
              : 0,
            joined_customers: data ? data.joined_customers : 0,
          });
        });
      }

      return result;
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error));
    }
  },

  reportHRDashBoard: async (
    user_ids,
    start_date,
    end_date,
    boundaryDay = 26
  ) => {
    try {
      // --- helpers & normalize boundaryDay --------------------------------
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      boundaryDay = Number(boundaryDay) || 26;
      if (boundaryDay < 1) boundaryDay = 1;
      if (boundaryDay > 31) boundaryDay = 31;

      const parseToDateOnly = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d)) {
          const dt = new Date(d.getTime());
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
        const iso =
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
            ? `${d}T00:00:00`
            : d;
        const dt = new Date(iso);
        if (isNaN(dt)) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      };

      const formatDateTimeSQL = (dt) => {
        const z = (n) => n.toString().padStart(2, "0");
        return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(
          dt.getDate()
        )} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
      };

      // --- build half-open datetimes --------------------------------------
      const startDateOnly = parseToDateOnly(start_date);
      const endDateOnly = parseToDateOnly(end_date);
      if (!startDateOnly || !endDateOnly) {
        throw new Error(
          "Invalid start_date or end_date. Expect 'YYYY-MM-DD' or Date."
        );
      }
      const startDateTimeSQL = formatDateTimeSQL(startDateOnly);
      const endExclusive = new Date(endDateOnly.getTime());
      endExclusive.setDate(endExclusive.getDate() + 1);
      const endExclusiveDateTimeSQL = formatDateTimeSQL(endExclusive);

      // --- SQL: counts grouped by mapped month (mapping uses c.created_date) ---
      const b = boundaryDay;
      let sql = `
      SELECT
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%Y-%m'
        ) AS ym,
        SUM(CASE WHEN c.status = 'Awaiting Trainer' THEN 1 ELSE 0 END) AS awaiting_trainer,
        SUM(CASE WHEN c.status = 'Awaiting Trainer Verify' THEN 1 ELSE 0 END) AS awaiting_trainer_verify,
        SUM(CASE WHEN c.status = 'Trainer Rejected' THEN 1 ELSE 0 END) AS rejected_trainer,
        SUM(CASE WHEN c.status = 'Awaiting Class' THEN 1 ELSE 0 END) AS verified_trainer
      FROM customers c
      INNER JOIN lead_master l ON c.lead_id = l.id
      WHERE 1 = 1
        AND c.created_date >= ? AND c.created_date < ?
    `;

      const params = [startDateTimeSQL, endExclusiveDateTimeSQL];

      // optional user filter (preserve single or array)
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const ph = user_ids.map(() => "?").join(", ");
          sql += ` AND l.assigned_to IN (${ph})`;
          params.push(...user_ids);
        } else {
          sql += ` AND l.assigned_to = ?`;
          params.push(user_ids);
        }
      }

      sql += ` GROUP BY ym, sale_month ORDER BY ym ASC`;

      const [rows] = await pool.query(sql, params);

      // --- compute mapped months list for full range so months with zero appear --
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthAbbrev = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const getMappedMonthStart = (dateInput) => {
        const d = new Date(dateInput.getTime());
        const day = d.getDate();
        if (day >= boundaryDay) d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const formatLabel = (d) =>
        `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const formatAbbrev = (d) =>
        `${monthAbbrev[d.getMonth()]} ${d.getFullYear()}`;
      const getMonths = (startDateStr, endDateStr) => {
        const sDate = parseToDateOnly(startDateStr);
        const eDate = parseToDateOnly(endDateStr);
        if (!sDate || !eDate) return [];
        const startMapped = getMappedMonthStart(sDate);
        const endMapped = getMappedMonthStart(eDate);
        const months = [];
        const cur = new Date(startMapped.getTime());
        while (cur <= endMapped) {
          months.push({
            label: formatLabel(cur),
            abbrev: formatAbbrev(cur),
            d: new Date(cur.getTime()),
          });
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      };
      const months = getMonths(start_date, end_date);

      // build lookup map from query rows
      const rowMap = {};
      (rows || []).forEach((r) => {
        rowMap[r.ym] = {
          sale_month: r.sale_month,
          awaiting_trainer: toNum(r.awaiting_trainer),
          awaiting_trainer_verify: toNum(r.awaiting_trainer_verify),
          rejected_trainer: toNum(r.rejected_trainer),
          verified_trainer: toNum(r.verified_trainer),
        };
      });

      // build final month_wise array (ensure every mapped month present)
      const month_wise = months.map((mObj) => {
        // convert "Jan 2025" abbrev to 'YYYY-MM' key used by SQL rows (e.g. '2025-01')
        const [mName, yStr] = mObj.label.split(" ");
        const mi = monthNames.indexOf(mName) + 1;
        const mm = mi.toString().padStart(2, "0");
        const ymKey = `${yStr}-${mm}`;

        const data = rowMap[ymKey] || null;
        return {
          month: mObj.abbrev, // "Jan 2025"
          label: mObj.label, // "January 2025"
          awaiting_trainer: data ? data.awaiting_trainer : 0,
          awaiting_trainer_verify: data ? data.awaiting_trainer_verify : 0,
          rejected_trainer: data ? data.rejected_trainer : 0,
          verified_trainer: data ? data.verified_trainer : 0,
        };
      });

      return { month_wise };
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error));
    }
  },

  reportRADashBoard: async (
    user_ids,
    start_date,
    end_date,
    boundaryDay = 26
  ) => {
    try {
      // --- helpers & normalize boundaryDay --------------------------------
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      boundaryDay = Number(boundaryDay) || 26;
      if (boundaryDay < 1) boundaryDay = 1;
      if (boundaryDay > 31) boundaryDay = 31;

      const parseToDateOnly = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d)) {
          const dt = new Date(d.getTime());
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
        const iso =
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
            ? `${d}T00:00:00`
            : d;
        const dt = new Date(iso);
        if (isNaN(dt)) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      };

      const formatDateTimeSQL = (dt) => {
        const z = (n) => n.toString().padStart(2, "0");
        return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(
          dt.getDate()
        )} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
      };

      // --- build half-open datetimes --------------------------------------
      const startDateOnly = parseToDateOnly(start_date);
      const endDateOnly = parseToDateOnly(end_date);
      if (!startDateOnly || !endDateOnly) {
        throw new Error(
          "Invalid start_date or end_date. Expect 'YYYY-MM-DD' or Date."
        );
      }
      const startDateTimeSQL = formatDateTimeSQL(startDateOnly);
      const endExclusive = new Date(endDateOnly.getTime());
      endExclusive.setDate(endExclusive.getDate() + 1);
      const endExclusiveDateTimeSQL = formatDateTimeSQL(endExclusive);

      // --- SQL: aggregate by mapped month (use c.created_date for mapping/filter) ---
      const b = boundaryDay;
      let sql = `
      SELECT
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%M %Y'
        ) AS sale_month,
        DATE_FORMAT(
          CASE WHEN DAY(CAST(c.created_date AS DATE)) >= ${b}
            THEN DATE_ADD(CAST(c.created_date AS DATE), INTERVAL 1 MONTH)
            ELSE CAST(c.created_date AS DATE) END,
          '%Y-%m'
        ) AS ym,
        SUM(CASE WHEN c.status = 'Awaiting Verify' THEN 1 ELSE 0 END) AS awaiting_verify,
        SUM(CASE WHEN c.status = 'Awaiting Class' THEN 1 ELSE 0 END) AS awaiting_class,
        SUM(CASE WHEN c.status = 'Class Scheduled' THEN 1 ELSE 0 END) AS class_scheduled,
        SUM(CASE WHEN c.status = 'Escalated' THEN 1 ELSE 0 END) AS escalated,
        SUM(CASE WHEN c.status = 'Class Going' THEN 1 ELSE 0 END) AS class_going,
        SUM(CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END) AS google_review_count,
        SUM(CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END) AS linkedin_review_count,
        SUM(CASE WHEN c.status = 'Completed' THEN 1 ELSE 0 END) AS class_completed
      FROM customers c
      INNER JOIN lead_master l ON c.lead_id = l.id
      WHERE c.created_date >= ? AND c.created_date < ?
    `;

      const params = [startDateTimeSQL, endExclusiveDateTimeSQL];

      // optional user filter
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const ph = user_ids.map(() => "?").join(", ");
          sql += ` AND l.assigned_to IN (${ph})`;
          params.push(...user_ids);
        } else {
          sql += ` AND l.assigned_to = ?`;
          params.push(user_ids);
        }
      }

      sql += ` GROUP BY ym, sale_month ORDER BY ym ASC`;

      const [rows] = await pool.query(sql, params);

      // --- compute mapped months list for full range so months with zero appear --
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthAbbrev = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const getMappedMonthStart = (dateInput) => {
        const d = new Date(dateInput.getTime());
        const day = d.getDate();
        if (day >= boundaryDay) d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const formatLabel = (d) =>
        `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const formatAbbrev = (d) =>
        `${monthAbbrev[d.getMonth()]} ${d.getFullYear()}`;
      const getMonths = (startDateStr, endDateStr) => {
        const sDate = parseToDateOnly(startDateStr);
        const eDate = parseToDateOnly(endDateStr);
        if (!sDate || !eDate) return [];
        const startMapped = getMappedMonthStart(sDate);
        const endMapped = getMappedMonthStart(eDate);
        const months = [];
        const cur = new Date(startMapped.getTime());
        while (cur <= endMapped) {
          months.push({
            label: formatLabel(cur),
            abbrev: formatAbbrev(cur),
            d: new Date(cur.getTime()),
          });
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      };
      const months = getMonths(start_date, end_date);

      // build lookup map from query rows keyed by 'YYYY-MM' (ym)
      const rowMap = {};
      (rows || []).forEach((r) => {
        rowMap[r.ym] = {
          sale_month: r.sale_month,
          awaiting_verify: toNum(r.awaiting_verify),
          awaiting_class: toNum(r.awaiting_class),
          class_scheduled: toNum(r.class_scheduled),
          escalated: toNum(r.escalated),
          class_going: toNum(r.class_going),
          google_review_count: toNum(r.google_review_count),
          linkedin_review_count: toNum(r.linkedin_review_count),
          class_completed: toNum(r.class_completed),
        };
      });

      // build final month_wise array (ensure every mapped month present)
      const month_wise = months.map((mObj) => {
        // convert "January 2025" -> "2025-01"
        const [mn, yy] = mObj.label.split(" ");
        const mi = monthNames.indexOf(mn) + 1;
        const mm = mi.toString().padStart(2, "0");
        const ymKey = `${yy}-${mm}`;

        const data = rowMap[ymKey] || null;
        return {
          month: mObj.abbrev, // "Jan 2025"
          label: mObj.label, // "January 2025"
          awaiting_verify: data ? data.awaiting_verify : 0,
          awaiting_class: data ? data.awaiting_class : 0,
          class_scheduled: data ? data.class_scheduled : 0,
          escalated: data ? data.escalated : 0,
          class_going: data ? data.class_going : 0,
          google_review_count: data ? data.google_review_count : 0,
          linkedin_review_count: data ? data.linkedin_review_count : 0,
          class_completed: data ? data.class_completed : 0,
        };
      });

      return { month_wise };
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error));
    }
  },

  monthWiseCollection: async (user_ids, start_date, end_date, branch_id) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT IFNULL(SUM(pt.amount), 0) AS collection, DATE_FORMAT(c.created_date, '%M %Y') month_name, DATE_FORMAT(c.created_date, '%m-%Y') ym FROM payment_trans AS pt INNER JOIN payment_master AS pm ON pt.payment_master_id = pm.id INNER JOIN customers AS c ON c.lead_id = pm.lead_id INNER JOIN lead_master AS l ON l.id = c.lead_id WHERE pt.payment_status <> 'Rejected'`;

      if (start_date && end_date) {
        getQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else {
          getQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
        }
      }

      if (branch_id) {
        getQuery += ` AND c.branch_id = ?`;
        queryParams.push(branch_id);
      }

      getQuery += ` GROUP BY month_name, ym ORDER BY ym ASC`;

      const [result] = await pool.query(getQuery, queryParams);
      const formattedResult = result.map((item) => {
        return {
          month_name: item.month_name,
          collection: item.collection,
        };
      });

      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = ReportModel;
