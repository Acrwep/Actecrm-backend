const pool = require("../config/dbconfig");
const nodemailer = require("nodemailer");
const { CONSTANT_STATUS } = require("../constants/constant");
const EmailModel = require("./EmailModel");

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_HOST,
  auth: {
    user: process.env.SMTP_FROM, // Replace with your email
    pass: process.env.SMTP_PASS, // Replace with your email password or app password for Gmail
  },
});

const ServerModel = {
  getServerRequest: async (
    start_date,
    end_date,
    raised_at,
    raised_end,
    search_filter,
    status,
    type,
    page,
    limit,
    user_ids,
    region_id,
    branch_id,
  ) => {
    try {
      const queryParams = [];
      const paginationParams = [];
      const statusParams = [];
      const statusParamsMini = [];
      const regionParams = [];
      let getQuery = `SELECT
                          s.id,
                          s.customer_id,
                          c.name,
                          c.phonecode,
                          c.phone,
                          c.whatsapp,
                          c.whatsapp_phone_code,
                          c.email,
                          c.date_of_joining,
                          c.student_id,
                          t.name AS server_name,
                          CASE WHEN c.enrolled_course IS NOT NULL THEN t.name ELSE tg.name END AS course_name,
                          CASE WHEN c.enrolled_course IS NOT NULL THEN c.enrolled_course ELSE tg.id END AS course_id,
                           pm.total_amount AS total_course_amount,
                      pm.discount_amount,
                      COALESCE(ps.total_paid, 0) AS paid_amount,
                      hr_user.user_name AS hr_name,
                      hr_user.view_user_id as hr_view_user_id,
                       ra_user.user_name AS ra_name,
                      ra_user.view_user_id as ra_view_user_id,
                       l.ra_id,
                      l.hr_id,
                      cshy.status_date as last_updated_at,
                      c.status as customer_status,
                      c.class_percentage,
                          
                          s.created_date,
                          tmp.commercial as trainer_commercial,
                          l.assigned_to AS created_by_id,
                          l.primary_fees,
                          u.user_name AS created_by,
                          u.view_user_id  as created_by_view_user_id,
                          s.status,
                          s.requested_duration,
                          
                          s.server_raise_date,
                          
                          r.name as region_name,
                          b.name as branch_name,
                          r.id as region_id,
                          b.id as branch_id
                      FROM
                          server_master AS s
                      INNER JOIN customers AS c ON
                          c.id = s.customer_id
                      INNER JOIN technologies AS t ON
                          t.id = c.enrolled_course
                   
                    LEFT JOIN payment_master AS pm ON 
                      pm.lead_id = c.lead_id
                      INNER JOIN lead_master AS l ON
                          l.id = c.lead_id
                       LEFT JOIN technologies AS tg ON
                        l.primary_course_id = tg.id
                      INNER JOIN users AS u ON
                          u.user_id = l.assigned_to
                      LEFT JOIN users AS hr_user ON
                        hr_user.user_id = l.hr_id
                      LEFT JOIN users AS ra_user ON
                        ra_user.user_id = l.ra_id
                        LEFT JOIN branches AS b ON
                      u.branch_id = b.id
                    LEFT JOIN region AS r ON
                        b.region_id = r.id
                    left join(
                    select  customer_id, max(id) as lates_map_id from trainer_mapping group by customer_id
                    ) as latest_mapping ON
                    latest_mapping.customer_id = c.id
                    left join trainer_mapping as tmp ON
                    tmp.id = latest_mapping.lates_map_id

      
                      LEFT JOIN(
                      SELECT
                          payment_master_id,
                          MAX(id) AS latest_trans_id,
                          SUM(amount) AS total_paid
                        FROM payment_trans
                        WHERE payment_status IN ('Verified', 'Verify Pending')
                        GROUP BY payment_master_id
                    ) AS ps ON ps.payment_master_id = pm.id
                    LEFT JOIN payment_trans AS pt ON
                      pt.id = ps.latest_trans_id
                    left join(
                    select  customer_id, max(id) as latest_status_history_id  from customer_track
                    group by customer_id) as latest_status on latest_status.customer_id = c.id
                    LEFT JOIN customer_track AS cshy ON cshy.id = latest_status.latest_status_history_id 
                      WHERE 1 = 1`;

      let regionquery = `SELECT
                           SUM(CASE WHEN l.assigned_to LIKE '%${CONSTANT_STATUS.CHENNAI}%' THEN 1 ELSE 0 END) AS chennai_region,
                            SUM(CASE WHEN l.assigned_to LIKE '%${CONSTANT_STATUS.BANGALORE}%'  THEN 1 ELSE 0 END) AS bangalore_region,
SUM(
  CASE
    WHEN l.assigned_to LIKE '%${CONSTANT_STATUS.ONLINE}%'
      OR l.assigned_to LIKE '%${CONSTANT_STATUS.DEV}%'
    THEN 1
    ELSE 0
  END
) AS hub_region                      FROM
                          server_master AS s
                      INNER JOIN customers AS c ON
                          c.id = s.customer_id
                      INNER JOIN technologies AS t ON
                          t.id = c.enrolled_course
                      INNER JOIN lead_master AS l ON
                          l.id = c.lead_id
                      INNER JOIN users AS u ON
                          u.user_id = l.assigned_to
                        LEFT JOIN branches AS b ON
                      u.branch_id = b.id
                    LEFT JOIN region AS r ON
                        b.region_id = r.id

                      LEFT JOIN (
                      	SELECT server_id, MAX(id) AS trans_id FROM server_trans
                        GROUP BY server_id
                      ) AS latest ON
                      	latest.server_id = s.id
                      LEFT JOIN server_trans AS st ON
                      	st.id = latest.trans_id
                      WHERE 1 = 1`;

      let paginationQuery = `SELECT IFNULL(COUNT(s.id), 0) AS total FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to 
                         LEFT JOIN branches AS b ON
                      u.branch_id = b.id
                    LEFT JOIN region AS r ON
                        b.region_id = r.id
                         WHERE 1 = 1`;

      let statusQuery = `SELECT IFNULL(SUM(CASE WHEN s.status IN ('Server Raised', 'Verification Rejected') THEN 1 ELSE 0 END), 0) AS server_raised, IFNULL(SUM(CASE WHEN s.status IN ('Approval Rejected') THEN 1 ELSE 0 END), 0) AS approval_rejected,  IFNULL(SUM(CASE WHEN s.status = 'Awaiting Verify' THEN 1 ELSE 0 END), 0) AS awaiting_verify, IFNULL(SUM(CASE WHEN s.status = 'Awaiting Approval' THEN 1 ELSE 0 END), 0) AS awaiting_approval, IFNULL(SUM(CASE WHEN s.status = 'Issued' THEN 1 ELSE 0 END), 0) AS issued, IFNULL(SUM(CASE WHEN s.status = 'purchased' THEN 1 ELSE 0 END), 0) AS Purchased, IFNULL(SUM(CASE WHEN s.status = 'Approved' THEN 1 ELSE 0 END), 0) AS server_approved, IFNULL(SUM(CASE WHEN s.status = 'Expired' THEN 1 ELSE 0 END), 0) AS expired, IFNULL(SUM(CASE WHEN s.status = 'Hold' THEN 1 ELSE 0 END), 0) AS hold, IFNULL(SUM(CASE WHEN s.status = 'Support' THEN 1 ELSE 0 END), 0) AS support FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to
                         LEFT JOIN branches AS b ON
                      u.branch_id = b.id
                    LEFT JOIN region AS r ON
                        b.region_id = r.id
                         WHERE 1 = 1`;

      let statusQueryMini = `SELECT IFNULL(COUNT(s.id), 0) AS total, IFNULL(SUM(CASE WHEN s.status = 'Requested' THEN 1 ELSE 0 END), 0) AS requested  FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to
                         LEFT JOIN branches AS b ON
                      u.branch_id = b.id
                    LEFT JOIN region AS r ON
                        b.region_id = r.id
                         WHERE 1 = 1`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND (l.assigned_to IN (${placeholders}) OR l.ra_id IN (${placeholders}))`;
          paginationQuery += ` AND (l.assigned_to IN (${placeholders}) OR l.ra_id IN (${placeholders}))`;
          statusQuery += ` AND (l.assigned_to IN (${placeholders}) OR l.ra_id IN (${placeholders}))`;
          regionquery += ` AND (l.assigned_to IN (${placeholders}) OR l.ra_id IN (${placeholders}))`;
          statusQueryMini += ` AND (l.assigned_to IN (${placeholders}) OR l.ra_id IN (${placeholders}))`;
          queryParams.push(...user_ids, ...user_ids);
          paginationParams.push(...user_ids, ...user_ids);
          statusParams.push(...user_ids, ...user_ids);
          regionParams.push(...user_ids, ...user_ids);
          statusParamsMini.push(...user_ids, ...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND (l.assigned_to = ? OR l.ra_id = ?)`;
          paginationQuery += ` AND (l.assigned_to = ? OR l.ra_id = ?)`;
          statusQuery += ` AND (l.assigned_to = ? OR l.ra_id = ?)`;
          regionquery += ` AND (l.assigned_to = ? OR l.ra_id = ?)`;
          statusQueryMini += ` AND (l.assigned_to = ? OR l.ra_id = ?)`;
          queryParams.push(user_ids, user_ids);
          paginationParams.push(user_ids, user_ids);
          statusParams.push(user_ids, user_ids);
          regionParams.push(user_ids, user_ids);
          statusParamsMini.push(user_ids, user_ids);
        }
      }

      if (start_date && end_date) {
        getQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        paginationQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        statusQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        regionquery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        statusQueryMini += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        paginationParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
        regionParams.push(start_date, end_date);
        statusParamsMini.push(start_date, end_date);
      }

      if (raised_at && raised_end) {
        if (type === "Raise Date") {
          getQuery += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          paginationQuery += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          statusQuery += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          regionquery += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          //statusQueryMini += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          queryParams.push(raised_at, raised_end);
          paginationParams.push(raised_at, raised_end);
          statusParams.push(raised_at, raised_end);
          regionParams.push(raised_at, raised_end);
          //statusParamsMini.push(raised_at, raised_end);
        } else {
          const expiredDateCondition = `
    AND s.status = 'Expired'
    AND EXISTS (
      SELECT 1
      FROM server_trans st_exp
      WHERE st_exp.server_id = s.id
        AND CAST(st_exp.end_date AS DATE) BETWEEN ? AND ?
    )
  `;

          getQuery += expiredDateCondition;
          paginationQuery += expiredDateCondition;
          statusQuery += expiredDateCondition;
          regionquery += expiredDateCondition;
          // statusQueryMini += expiredDateCondition;

          queryParams.push(raised_at, raised_end);
          paginationParams.push(raised_at, raised_end);
          statusParams.push(raised_at, raised_end);
          regionParams.push(raised_at, raised_end);
          // statusParamsMini.push(raised_at, raised_end);
        }
      }

      // if (name) {
      //   getQuery += ` AND c.name LIKE '%${name}%'`;
      //   paginationQuery += ` AND c.name LIKE '%${name}%'`;
      //   regionquery += ` AND c.name LIKE '%${name}%'`;
      // }

      // if (mobile) {
      //   getQuery += ` AND c.phone LIKE '%${mobile}%'`;
      //   paginationQuery += ` AND c.phone LIKE '%${mobile}%'`;
      //   regionquery += ` AND c.phone LIKE '%${mobile}%'`;
      // }

      // if (email) {
      //   getQuery += ` AND c.email LIKE '%${email}%'`;
      //   paginationQuery += ` AND c.email LIKE '%${email}%'`;
      //   regionquery += ` AND c.email LIKE '%${email}%'`;
      // }

      // if (server) {
      //   getQuery += ` AND t.name LIKE '%${server}%'`;
      //   paginationQuery += ` AND t.name LIKE '%${server}%'`;
      //   regionquery += ` AND t.name LIKE '%${server}%'`;
      // }

      if (search_filter) {
        const filterQuery = ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR t.name LIKE ? )`;
        getQuery += filterQuery;
        paginationQuery += filterQuery;
        regionquery += filterQuery;
        statusQuery += filterQuery;
        statusQueryMini += filterQuery;
        queryParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
        paginationParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
        regionParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
        statusParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
        statusParamsMini.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
      }

      if (status && status.length > 0) {
        if (Array.isArray(status)) {
          const placeholders = status.map(() => "?").join(", ");
          getQuery += ` AND s.status IN (${placeholders})`;
          paginationQuery += ` AND s.status IN (${placeholders})`;
          regionquery += ` AND s.status IN (${placeholders})`;

          queryParams.push(...status);
          paginationParams.push(...status);
          regionParams.push(...status);
        } else {
          getQuery += ` AND s.status = ?`;
          paginationQuery += ` AND s.status = ?`;
          regionquery += ` AND s.status = ?`;

          queryParams.push(status);
          paginationParams.push(status);
          regionParams.push(status);
        }
      }

      if (region_id) {
        getQuery += `
        AND r.id = ?
      `;
        paginationQuery += `  AND r.id = ?
      `;
        statusQuery += `  AND r.id = ?
      `;
        regionquery += `  AND r.id = ?
      `;

        statusQueryMini += `  AND r.id = ?
      `;
        queryParams.push(region_id);
        paginationParams.push(region_id);
        statusParams.push(region_id);
        regionParams.push(region_id);
        statusParamsMini.push(region_id);
      }

      if (branch_id) {
        getQuery += `
        AND b.id = ?
      `;
        paginationQuery += `  AND b.id = ?
      `;
        statusQuery += `  AND b.id = ?
      `;
        regionquery += `  AND b.id = ?
      `;
        statusQueryMini += `  AND b.id = ?
      `;
        queryParams.push(branch_id);
        paginationParams.push(branch_id);
        statusParams.push(branch_id);
        regionParams.push(branch_id);
        statusParamsMini.push(branch_id);
      }

      const [pageResult] = await pool.query(paginationQuery, paginationParams);

      const total = pageResult[0]?.total || 0;

      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      if (type === "Raise Date") {
        getQuery += ` ORDER BY s.server_raise_date DESC LIMIT ? OFFSET ?`;
        queryParams.push(limitNumber, offset);
      } else {
        getQuery += ` ORDER BY s.created_date DESC LIMIT ? OFFSET ?`;
        queryParams.push(limitNumber, offset);
      }

      const [result] = await pool.query(getQuery, queryParams);

      const serverIds = result.map((item) => item.id);

      let transMap = new Map();

      if (serverIds.length > 0) {
        const [transResult] = await pool.query(
          `SELECT
        id,
        server_id,
        vendor_id,
        server_cost,
        duration,
        start_date,
        end_date,
        status,
        is_acknowledged,
        acknowledged_date,
        acknowledge_sent,
        screenshot,
        verified_by,
        verified_date,
        rejected_by,
        rejected_date,
        comments
     FROM server_trans
     WHERE server_id IN (?) order by id desc `,
          [serverIds],
        );

        for (const trans of transResult) {
          if (!transMap.has(trans.server_id)) {
            transMap.set(trans.server_id, []);
          }

          transMap.get(trans.server_id).push({
            server_trans_id: trans.id,
            vendor_id: trans.vendor_id,
            server_cost: trans.server_cost,
            server_trans_duration: trans.duration,
            start_date: trans.start_date,
            end_date: trans.end_date,
            server_trans_status: trans.status,
            screenshot: trans.screenshot,
            is_acknowledged: trans.is_acknowledged,
            acknowledged_date: trans.acknowledged_date,
            acknowledge_sent: trans.acknowledge_sent,
            verified_by: trans.verified_by,
            verified_date: trans.verified_date,
            rejected_by: trans.rejected_by,
            rejected_date: trans.rejected_date,
            comments: trans.comments,
          });
        }
      }
      const [regionResult] = await pool.query(regionquery, regionParams);

      const chennai = regionResult[0]?.chennai_region || 0;
      const bangalore = regionResult[0]?.bangalore_region || 0;
      const hub = regionResult[0]?.hub_region || 0;

      // Optimize history query - only fetch relevant records
      if (result.length > 0) {
        const serverIds = result.map((item) => item.id);

        const [getHistory] = await pool.query(
          `
        SELECT 
          srh.id, srh.server_id, srh.status, srh.comments, 
          srh.rejected_by AS rejected_by_id, u.user_name AS rejected_by, 
          srh.rejected_date 
        FROM server_rejected_history AS srh 
        INNER JOIN users AS u ON srh.rejected_by = u.user_id 
        WHERE srh.server_id IN (?)`,
          [serverIds],
        );

        // Create lookup map for better performance
        const historyMap = getHistory.reduce((map, historyItem) => {
          if (!map[historyItem.server_id]) {
            map[historyItem.server_id] = [];
          }
          map[historyItem.server_id].push(historyItem);
          return map;
        }, {});

        // Format result with history
        const finalresult = result.map((item) => {
          const totalAmount = parseFloat(item.total_course_amount || 0);
          const paidAmount = parseFloat(item.paid_amount || 0);
          const serverHistories = historyMap[item.id] || [];

          const history = serverHistories.sort((a, b) => b.id - a.id);

          return {
            ...item,
            balance_amount: parseFloat((totalAmount - paidAmount).toFixed(2)),
            total_amount: totalAmount,
            paid_amount: paidAmount,
            server_history: history,
            trans_details: transMap.get(item.id) || [],
            trainer_commercial_percentage: item.primary_fees
              ? parseFloat(
                  (
                    (parseFloat(item.trainer_commercial || 0) /
                      parseFloat(item.primary_fees)) *
                    100
                  ).toFixed(2),
                )
              : 0,
          };
        });

        // Execute status count query
        const [statusResult] = await pool.query(statusQuery, statusParams);
        const [statusResultMini] = await pool.query(
          statusQueryMini,
          statusParamsMini,
        );

        return {
          data: finalresult,
          statusCount: {
            ...statusResultMini[0],
            ...statusResult[0],
          },
          pagination: {
            total: parseInt(total),
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber),
          },
          region_count: {
            chennai_region: chennai,
            bangalore_region: bangalore,
            hub_region: hub,
          },
        };
      } else {
        // No results case
        const [statusResult] = await pool.query(statusQuery, statusParams);
        const [statusResultMini] = await pool.query(
          statusQueryMini,
          statusParamsMini,
        );

        return {
          data: [],
          statusCount: {
            ...statusResultMini[0],
            ...statusResult[0],
          },
          pagination: {
            total: 0,
            page: pageNumber,
            limit: limitNumber,
            totalPages: 0,
          },
          region_count: {
            chennai_region: chennai,
            bangalore_region: bangalore,
            hub_region: hub,
          },
        };
      }
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateServerStatus: async (
    server_id,
    status,
    comments,
    rejected_by,
    rejected_date,
    server_raise_date,
    requested_duration,
    server_trans_id,
    screenshot,
    verified_by,
    verified_date,
  ) => {
    try {
      let affectedRows = 0;
      const [isServerExists] = await pool.query(
        `SELECT id, customer_id FROM server_master WHERE id = ?`,
        server_id,
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      if (status === "Server Raised") {
        const [getLeadID] = await pool.query(
          `SELECT lead_id FROM customers WHERE id = ?`,
          [isServerExists[0].customer_id],
        );
        const [getPaidAmount] = await pool.query(
          `SELECT 
                COALESCE(pm.total_amount, 0) AS total_amount,
                COALESCE(SUM(pt.amount), 0) AS paid_amount 
            FROM payment_master AS pm 
            LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status IN ('Verified', 'Verify Pending')
            WHERE pm.lead_id = ?
            GROUP BY pm.total_amount`,
          [getLeadID[0].lead_id],
        );

        // Now you can safely access the values
        const totalAmount = getPaidAmount[0]?.total_amount || 0;
        const paidAmount = getPaidAmount[0]?.paid_amount || 0;
        const balance_amount = parseFloat(
          (totalAmount - paidAmount).toFixed(2),
        );

        if (balance_amount > 0)
          throw new Error(
            "Server cannot be raised as the customer has outstanding fees.",
          );

        await pool.query(
          `UPDATE server_master SET requested_duration = ? WHERE id = ?`,
          [requested_duration, server_id],
        );
      }

      if (server_trans_id && screenshot) {
        await pool.query(
          `UPDATE server_trans SET screenshot = ? WHERE id = ?`,
          [screenshot, server_trans_id],
        );
      }

      const updateQuery = `UPDATE server_master SET status = ?, server_raise_date = ? WHERE id = ?`;

      const [result] = await pool.query(updateQuery, [
        status,
        server_raise_date,
        server_id,
      ]);

      affectedRows += result.affectedRows;

      if (status === "Approved") {
        await pool.query(
          `UPDATE server_trans SET status = ?, verified_by = ?, verified_date = ? WHERE id = ?`,
          ["Approved", verified_by, verified_date, server_trans_id],
        );
      }

      if (
        status === "Verification Rejected" ||
        status === "Approval Rejected"
      ) {
        // const [history] = await pool.query(
        //   `INSERT INTO server_rejected_history(server_id, status, comments, rejected_by, rejected_date) VALUES (?, ?, ?, ?, CURRENT_DATE)`,
        //   [server_id, status, comments, rejected_by],
        // );
        const [updateTrans] = await pool.query(
          `UPDATE server_trans SET status = ?, comments = ?, rejected_by = ?, rejected_date = ?  WHERE id = ?`,
          [
            status === "Approval Rejected" ? "Rejected" : status,
            comments,
            rejected_by,
            rejected_date,
            server_trans_id,
          ],
        );

        affectedRows += updateTrans.affectedRows;
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  awatingVerify: async (
    server_id,
    vendor_id,
    duration,
    server_cost,
    server_trans_id,
    email,
    email_link,
    status_date,
    created_by,
  ) => {
    try {
      let affectedRows = 0;
      const [isServerExists] = await pool.query(
        `SELECT id FROM server_master WHERE id = ?`,
        server_id,
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      if (server_trans_id) {
        const [updateTrans] = await pool.query(
          `UPDATE server_trans SET vendor_id = ?, server_cost = ?, duration = ?, status = 'Pending' WHERE id = ?`,
          [vendor_id, server_cost, duration, server_trans_id],
        );

        if (updateTrans.affectedRows <= 0)
          throw new Error("Something went wrong");

        affectedRows += updateTrans.affectedRows;
      } else {
        const [insertTrans] = await pool.query(
          `INSERT INTO server_trans(server_id, vendor_id, server_cost, duration, status) VALUES(?, ?, ?, ?, ?)`,
          [server_id, vendor_id, server_cost, duration, "Pending"],
        );

        await EmailModel.sendServerRequestAcknowledgementMail(
          email,
          email_link,
          insertTrans.insertId,
          status_date,
          created_by,
        );

        if (insertTrans.affectedRows <= 0)
          throw new Error("Something went wrong");

        affectedRows += insertTrans.affectedRows;
      }

      const server_status_update = server_trans_id
        ? "Awaiting Approval"
        : "Awaiting Verify";

      const [updateMaster] = await pool.query(
        `UPDATE server_master SET status = ? WHERE id = ?`,
        [server_status_update, server_id],
      );

      affectedRows += updateMaster.affectedRows;
      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  reServerPurchased: async (
    server_id,
    vendor_id,
    duration,
    server_cost,
    email,
    email_link,
    status_date,
    created_by,
  ) => {
    try {
      let affectedRows = 0;
      const [isServerExists] = await pool.query(
        `SELECT id FROM server_master WHERE id = ?`,
        server_id,
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      const [insertTrans] = await pool.query(
        `INSERT INTO server_trans(server_id, vendor_id, server_cost, duration, status) VALUES(?, ?, ?, ?, ?)`,
        [server_id, vendor_id, server_cost, duration, "Pending"],
      );

      await EmailModel.sendServerRequestAcknowledgementMail(
        email,
        email_link,
        insertTrans.insertId,
        status_date,
        created_by,
      );

      if (insertTrans.affectedRows <= 0)
        throw new Error("Something went wrong");

      affectedRows += insertTrans.affectedRows;

      const [updateMaster] = await pool.query(
        `UPDATE server_master SET status = 'Awaiting Verify' WHERE id = ?`,
        [server_id],
      );

      affectedRows += updateMaster.affectedRows;
      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
  addAcknowledgeServer: async (
    server_trans_id,
    customer_id,
    acknowledged_date,
    is_acknowledged,
  ) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [isAcknowledged] = await connection.query(
        `SELECT is_acknowledged, server_id FROM server_trans WHERE id = ?`,
        [server_trans_id],
      );

      if (isAcknowledged.length > 0 && isAcknowledged[0].is_acknowledged == 1) {
        throw new Error("Server request has already been acknowledged.");
      }

      await connection.query(
        `UPDATE server_trans SET is_acknowledged = ?, acknowledged_date = ? WHERE id = ?`,
        [is_acknowledged, acknowledged_date, server_trans_id],
      );

      if (is_acknowledged == 1) {
        await connection.query(
          `UPDATE server_master SET status = 'Awaiting Approval' WHERE id = ?`,
          [isAcknowledged[0].server_id],
        );

        await connection.query(
          `INSERT INTO customer_track(customer_id, status, status_date) VALUES(?, ?, ?)`,
          [customer_id, "Server Request Acknowledged", acknowledged_date],
        );
      }
      await connection.commit();
      return { status: true };
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  serverPurchased: async (
    server_id,
    payment_mode,
    transaction_id,
    paid_date,
  ) => {
    try {
      let affectedRows = 0;
      const [isServerExists] = await pool.query(
        `SELECT id FROM server_master WHERE id = ?`,
        [server_id],
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      const [getDuration] = await pool.query(
        `SELECT id, duration FROM server_trans WHERE server_id = ? AND status = 'Approved' ORDER BY id DESC LIMIT 1`,
        [server_id],
      );

      if (getDuration.length <= 0) throw new Error("Invalid data");

      const [getDate] = await pool.query(
        `SELECT CONCAT(CURRENT_DATE(), ' 00:00:00') AS start_date, DATE_SUB(CONCAT(DATE_ADD(CURDATE(), INTERVAL ${getDuration[0].duration} DAY), ' 00:00:00'), INTERVAL 1 SECOND) AS end_date`,
      );

      const [result] = await pool.query(
        `UPDATE server_trans SET start_date = ?, end_date = ?, payment_mode = ?, transaction_id = ?, paid_date = ?, status = 'Active' WHERE id = ?`,
        [
          getDate[0].start_date,
          getDate[0].end_date,
          payment_mode,
          transaction_id,
          paid_date,
          getDuration[0].id,
        ],
      );

      affectedRows += result.affectedRows;

      if (affectedRows > 0) {
        const [updateMaster] = await pool.query(
          `UPDATE server_master SET status = 'Purchased' WHERE id = ?`,
          [server_id],
        );

        affectedRows += updateMaster.affectedRows;
      } else {
        throw new Error("Couldn't approve server");
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
  serverSummary: async (course_id) => {
    try {
      const [summary] = await pool.query(
        ` select st.id as server_trans_id,c.id as customer_id,c.name,c.email,c.phone,c.enrolled_course,tg.name as course_name,sm.id as server_master_id,st.server_cost,st.vendor_id,st.duration,st.start_date,st.end_date
        from server_master sm
        join customers c on c.id=sm.customer_id
        inner join(
            select server_id, max(id) as latest_transId from server_trans group by server_id) as latest_trans
            on latest_trans.server_id = sm.id
              join server_trans st on st.id = latest_trans.latest_transId
              join technologies tg on tg.id = c.enrolled_course
            where c.enrolled_course = ? order by sm.id desc `,
        [course_id],
      );

      return summary;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  serverIssued: async (
    server_id,
    email_subject,
    email_content,
    send_email,
    issued_date,
    server_trans_id,
  ) => {
    try {
      let affectedRows = 0;
      const [isServerExists] = await pool.query(
        `SELECT id FROM server_master WHERE id = ?`,
        [server_id],
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      // Send email only when send_email is true
      if (send_email) {
        const [getEmail] = await pool.query(
          `SELECT c.email FROM server_master AS s INNER JOIN customers AS c ON s.customer_id = c.id WHERE s.id = ?`,
          [server_id],
        );

        if (getEmail.length <= 0)
          throw new Error("Email Id not found for this customer");

        try {
          const mailOptions = {
            from: process.env.SMTP_FROM,
            to: getEmail[0].email,
            subject: email_subject,
            // text: "Please find your server credential below.",
            html: email_content,
          };

          await transporter.sendMail(mailOptions);
        } catch (error) {
          throw new Error("Error while send mail!");
        }
      }

      if (isServerExists.length > 0) {
        const [updateMaster] = await pool.query(
          `UPDATE server_master SET status = 'Issued' WHERE id = ?`,
          [server_id],
        );

        await pool.query(
          `UPDATE server_trans SET issued_date = ? WHERE id = ?`,
          [issued_date, server_trans_id],
        );

        affectedRows += updateMaster.affectedRows;
      } else {
        throw new Error("Couldn't approve server");
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertServerTrack: async (
    server_id,
    status,
    status_date,
    updated_by,
    details,
  ) => {
    try {
      const insertQuery = `INSERT INTO server_track(
                              server_id,
                              status,
                              status_date,
                              details,
                              updated_by
                          )
                          VALUES(?, ?, ?, ?, ?)`;
      const values = [
        server_id,
        status,
        status_date,
        JSON.stringify(details),
        updated_by,
      ];
      const [res] = await pool.query(insertQuery, values);
      return res.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getServerHistory: async (server_id) => {
    try {
      const sql = `SELECT
                      st.id,
                      st.server_id,
                      c.name AS customer_name,
                      st.status,
                      st.status_date,
                      st.details,
                      st.updated_by AS updated_by_id,
                      u.user_name AS updated_by
                  FROM
                      server_track AS st
                  INNER JOIN server_master AS s ON
                    s.id = st.server_id
                  INNER JOIN customers AS c ON
                    c.id = s.customer_id
                  INNER JOIN users AS u ON
                    st.updated_by = u.user_id
                  WHERE
                      st.server_id = ?
                  ORDER BY st.id ASC`;
      const [result] = await pool.query(sql, [server_id]);

      const formattedResult = result.map((item) => {
        return {
          ...item,
          details: JSON.parse(item.details),
        };
      });
      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = ServerModel;
