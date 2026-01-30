const { text } = require("pdfkit");
const pool = require("../config/dbconfig");
const nodemailer = require("nodemailer");

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
    name,
    mobile,
    email,
    server,
    status,
    page,
    limit,
    user_ids,
    type,
  ) => {
    try {
      const queryParams = [];
      const paginationParams = [];
      const statusParams = [];
      let getQuery = `SELECT ROW_NUMBER() OVER (ORDER BY s.created_date DESC) AS row_num, s.id, s.customer_id, c.name, c.phonecode, c.phone, c.email, t.name AS server_name, server_info.vendor_id, server_info.server_cost, server_info.duration, server_info.start_date, server_info.end_date, s.created_date, l.assigned_to AS created_by_id, u.user_name AS created_by, s.status, server_info.server_trans_id, server_info.status AS server_status, s.server_raise_date FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to LEFT JOIN (SELECT s.id, st.id AS server_trans_id, st.vendor_id, st.server_cost, st.duration, st.start_date, st.end_date, st.status FROM server_master AS s INNER JOIN server_trans AS st ON s.id = st.server_id ORDER BY st.id DESC LIMIT 1) AS server_info ON server_info.id = s.id WHERE 1 = 1`;

      let paginationQuery = `SELECT IFNULL(COUNT(s.id), 0) AS total FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to WHERE 1 = 1`;

      let statusQuery = `SELECT IFNULL(COUNT(s.id), 0) AS total, IFNULL(SUM(CASE WHEN s.status = 'Requested' THEN 1 ELSE 0 END), 0) AS requested, IFNULL(SUM(CASE WHEN s.status IN ('Server Raised', 'Verification Rejected', 'Approval Rejected') THEN 1 ELSE 0 END), 0) AS server_raised, IFNULL(SUM(CASE WHEN s.status = 'Awaiting Verify' THEN 1 ELSE 0 END), 0) AS awaiting_verify, IFNULL(SUM(CASE WHEN s.status = 'Awaiting Approval' THEN 1 ELSE 0 END), 0) AS awaiting_approval, IFNULL(SUM(CASE WHEN s.status = 'Issued' THEN 1 ELSE 0 END), 0) AS issued, IFNULL(SUM(CASE WHEN s.status = 'Approved' THEN 1 ELSE 0 END), 0) AS server_approved, IFNULL(SUM(CASE WHEN s.status = 'Expired' THEN 1 ELSE 0 END), 0) AS expired, IFNULL(SUM(CASE WHEN s.status = 'Hold' THEN 1 ELSE 0 END), 0) AS hold, IFNULL(SUM(CASE WHEN s.status = 'Support' THEN 1 ELSE 0 END), 0) AS support FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to WHERE 1 = 1`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          paginationQuery += ` AND l.assigned_to IN (${placeholders})`;
          statusQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
          paginationParams.push(...user_ids);
          statusParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND l.assigned_to = ?`;
          paginationQuery += ` AND l.assigned_to = ?`;
          statusQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
          paginationParams.push(user_ids);
          statusParams.push(user_ids);
        }
      }

      if (start_date && end_date) {
        if (type === "Raise Date") {
          getQuery += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          paginationQuery += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          statusQuery += ` AND CAST(s.server_raise_date AS DATE) BETWEEN ? AND ?`;
          queryParams.push(start_date, end_date);
          paginationParams.push(start_date, end_date);
          statusParams.push(start_date, end_date);
        } else {
          getQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
          paginationQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
          statusQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
          queryParams.push(start_date, end_date);
          paginationParams.push(start_date, end_date);
          statusParams.push(start_date, end_date);
        }
      }

      if (name) {
        getQuery += ` AND c.name LIKE '%${name}%'`;
        paginationQuery += ` AND c.name LIKE '%${name}%'`;
      }

      if (mobile) {
        getQuery += ` AND c.phone LIKE '%${mobile}%'`;
        paginationQuery += ` AND c.phone LIKE '%${mobile}%'`;
      }

      if (email) {
        getQuery += ` AND c.email LIKE '%${email}%'`;
        paginationQuery += ` AND c.email LIKE '%${email}%'`;
      }

      if (server) {
        getQuery += ` AND t.name LIKE '%${server}%'`;
        paginationQuery += ` AND t.name LIKE '%${server}%'`;
      }

      if (status && status.length > 0) {
        if (Array.isArray(status)) {
          const placeholders = status.map(() => "?").join(", ");
          getQuery += ` AND s.status IN (${placeholders})`;
          paginationQuery += ` AND s.status IN (${placeholders})`;
          queryParams.push(...status);
          paginationParams.push(...status);
        } else {
          getQuery += ` AND s.status = ?`;
          paginationQuery += ` AND s.status = ?`;
          queryParams.push(status);
          paginationParams.push(status);
        }
      }

      const [pageResult] = await pool.query(paginationQuery, paginationParams);

      const total = pageResult[0]?.total || 0;

      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY s.created_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [result] = await pool.query(getQuery, queryParams);

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
        const formattedResult = result.map((item) => {
          const serverHistories = historyMap[item.id] || [];

          const history = serverHistories.sort((a, b) => b.id - a.id);

          return {
            ...item,
            server_history: history,
          };
        });

        // Execute status count query
        const [statusResult] = await pool.query(statusQuery, statusParams);

        return {
          data: formattedResult,
          statusCount: statusResult[0],
          pagination: {
            total: parseInt(total),
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber),
          },
        };
      } else {
        // No results case
        const [statusResult] = await pool.query(statusQuery, statusParams);

        return {
          data: [],
          statusCount: statusResult[0],
          pagination: {
            total: 0,
            page: pageNumber,
            limit: limitNumber,
            totalPages: 0,
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
    server_raise_date,
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
      }

      const updateQuery = `UPDATE server_master SET status = ?, server_raise_date = ? WHERE id = ?`;

      const [result] = await pool.query(updateQuery, [
        status,
        server_raise_date,
        server_id,
      ]);

      affectedRows += result.affectedRows;

      if (
        status === "Verification Rejected" ||
        status === "Approval Rejected"
      ) {
        const [history] = await pool.query(
          `INSERT INTO server_rejected_history(server_id, status, comments, rejected_by, rejected_date) VALUES (?, ?, ?, ?, CURRENT_DATE)`,
          [server_id, status, comments, rejected_by],
        );

        affectedRows += history.affectedRows;
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
          `UPDATE server_trans SET vendor_id = ?, server_cost = ?, duration = ? WHERE id = ?`,
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

        if (insertTrans.affectedRows <= 0)
          throw new Error("Something went wrong");

        affectedRows += insertTrans.affectedRows;
      }

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

  serverIssued: async (server_id, email_subject, email_content) => {
    try {
      let affectedRows = 0;
      const [isServerExists] = await pool.query(
        `SELECT id FROM server_master WHERE id = ?`,
        [server_id],
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

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

      const [getDuration] = await pool.query(
        `SELECT id, duration FROM server_trans WHERE server_id = ? AND status = 'Pending' ORDER BY id DESC LIMIT 1`,
        [server_id],
      );

      if (getDuration.length <= 0) throw new Error("Invalid data");

      const [getDate] = await pool.query(
        `SELECT CONCAT(CURRENT_DATE(), ' 00:00:00') AS start_date, DATE_SUB(CONCAT(DATE_ADD(CURDATE(), INTERVAL ${getDuration[0].duration} DAY), ' 00:00:00'), INTERVAL 1 SECOND) AS end_date`,
      );

      const [result] = await pool.query(
        `UPDATE server_trans SET start_date = ?, end_date = ?, status = 'Active' WHERE id = ?`,
        [getDate[0].start_date, getDate[0].end_date, getDuration[0].id],
      );

      affectedRows += result.affectedRows;

      if (affectedRows > 0) {
        const [updateMaster] = await pool.query(
          `UPDATE server_master SET status = 'Issued' WHERE id = ?`,
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
