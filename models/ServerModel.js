const pool = require("../config/dbconfig");

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
    limit
  ) => {
    try {
      const queryParams = [];
      const paginationParams = [];
      const statusParams = [];
      let getQuery = `SELECT s.id, s.customer_id, c.name, c.phonecode, c.phone, c.email, t.name AS server_name, s.vendor_id, s.server_cost, server_info.duration, server_info.start_date, server_info.end_date, s.created_date, l.assigned_to AS created_by_id, u.user_name AS created_by, s.status, server_info.server_trans_id, server_info.status AS server_status, s.verify_comments, s.approval_comments FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to LEFT JOIN (SELECT s.id, st.id AS server_trans_id, st.duration, st.start_date, st.end_date, st.status FROM server_master AS s INNER JOIN server_trans AS st ON s.id = st.server_id ORDER BY st.id DESC LIMIT 1) AS server_info ON server_info.id = s.id WHERE 1 = 1`;

      let paginationQuery = `SELECT IFNULL(COUNT(s.id), 0) AS total FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to WHERE 1 = 1`;

      let statusQuery = `SELECT IFNULL(COUNT(s.id), 0) AS total, SUM(CASE WHEN s.status = 'Requested' THEN 1 ELSE 0 END) AS requested, SUM(CASE WHEN s.status = 'Awaiting Verify' THEN 1 ELSE 0 END) AS awaiting_verify, SUM(CASE WHEN s.status = 'Awaiting Approval' THEN 1 ELSE 0 END) AS awaiting_approval, SUM(CASE WHEN s.status = 'Issued' THEN 1 ELSE 0 END) AS issued, SUM(CASE WHEN s.status = 'Server Rejected' THEN 1 ELSE 0 END) AS server_rejected, SUM(CASE WHEN s.status = 'Approval Rejected' THEN 1 ELSE 0 END) AS approval_rejected, SUM(CASE WHEN s.status = 'Expired' THEN 1 ELSE 0 END) AS expired, SUM(CASE WHEN s.status = 'Hold' THEN 1 ELSE 0 END) AS hold FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to WHERE 1 = 1`;

      if (start_date && end_date) {
        getQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        paginationQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        statusQuery += ` AND CAST(s.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        paginationParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
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

      const [statusResult] = await pool.query(statusQuery, statusParams);
      return {
        data: result,
        statusCount: statusResult,
        pagination: {
          total: parseInt(total),
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateServerStatus: async (
    server_id,
    status,
    verify_comments,
    approval_comments
  ) => {
    try {
      const [isServerExists] = await pool.query(
        `SELECT id FROM server_master WHERE id = ?`,
        server_id
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      const queryParams = [];
      let updateQuery = `UPDATE server_master SET status = ?`;
      queryParams.push(status);

      if (status === "Server Rejected") {
        updateQuery += `, verify_comments = ?`;
        queryParams.push(verify_comments);
      }

      if (status === "Approval Rejected") {
        updateQuery += `, approval_comments = ?`;
        queryParams.push(approval_comments);
      }

      updateQuery += ` WHERE id = ?`;
      queryParams.push(server_id);

      const [result] = await pool.query(updateQuery, queryParams);

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  serverVerify: async (server_id, server_cost, duration) => {
    try {
      let affectedRows = 0;
      const updateQuery = `UPDATE server_master SET server_cost = ?, status = 'Awaiting Verify' WHERE id = ?`;
      const values = [server_cost, server_id];

      const [result] = await pool.query(updateQuery, values);

      affectedRows += result.affectedRows;

      if (affectedRows > 0) {
        const insertQuery = `INSERT INTO server_trans(server_id, duration, status) VALUES (?, ?, ?)`;
        const queryParams = [server_id, duration, "Pending"];

        const [insertResult] = await pool.query(insertQuery, queryParams);
        affectedRows += insertResult.affectedRows;
      } else {
        throw new Error("Couldn't verify server");
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  serverApprove: async (server_id) => {
    try {
      let affectedRows = 0;
      const [isServerExists] = await pool.query(
        `SELECT id FROM server_master WHERE id = ?`,
        [server_id]
      );

      if (isServerExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      const [getDuration] = await pool.query(
        `SELECT id, duration FROM server_trans WHERE server_id = ? AND status = 'Pending' ORDER BY id DESC LIMIT 1`,
        [server_id]
      );

      if (getDuration.length <= 0) throw new Error("Invalid data");

      const [getDate] = await pool.query(
        `SELECT CONCAT(CURRENT_DATE(), ' 00:00:00') AS start_date, DATE_SUB(CONCAT(DATE_ADD(CURDATE(), INTERVAL ${getDuration[0].duration} DAY), ' 00:00:00'), INTERVAL 1 SECOND) AS end_date`
      );

      const [result] = await pool.query(
        `UPDATE server_trans SET start_date = ?, end_date = ?, status = 'Active' WHERE id = ?`,
        [getDate[0].start_date, getDate[0].end_date, getDuration[0].id]
      );

      affectedRows += result.affectedRows;

      if (affectedRows > 0) {
        const [updateMaster] = await pool.query(
          `UPDATE server_master SET status = 'Issued' WHERE id = ?`,
          [server_id]
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
};

module.exports = ServerModel;
