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
          // append user filters into SQL by string concatenation (we'll recompose queries accordingly)
          // Rebuild queries by appending to original string: safer to append here since earlier constants
          // were standalone; but to keep code short we'll append filter text and push params.

          const userFilterTextSale = ` AND l.assigned_to IN (${ph})`;
          const userFilterTextLead = ` AND assigned_to IN (${ph})`;
          const userFilterTextJoin = ` AND l.assigned_to IN (${ph})`;
          const userFilterTextFollowup = ` AND l.assigned_to IN (${ph})`;

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
        total_collection += collection;
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

        const monthsArr = [];
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

          monthsArr.push({
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

        result.push({
          user_id: uid,
          user_name,
          months: monthsArr,
        });
      }

      return result;
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error));
    }
  },
};

module.exports = ReportModel;
