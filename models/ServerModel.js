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
      let getQuery = `SELECT s.id, c.name, c.phonecode, c.phone, c.email, t.name AS server_name, s.vendor_id, s.server_cost, s.activated_date, s.duration, s.server_deactivated, s.created_date, l.assigned_to AS created_by_id, u.user_name AS created_by FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to WHERE 1 = 1`;

      let paginationQuery = `SELECT IFNULL(COUNT(s.id), 0) AS total FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to WHERE 1 = 1`;

      let statusQuery = `SELECT IFNULL(COUNT(s.id), 0) AS total, SUM(CASE WHEN s.status = 'Requested' THEN 1 ELSE 0 END) AS requested, SUM(CASE WHEN s.status = 'Awaiting Verify' THEN 1 ELSE 0 END) AS awaiting_verify, SUM(CASE WHEN s.status = 'Awaiting Approval' THEN 1 ELSE 0 END) AS awaiting_approval, SUM(CASE WHEN s.status = 'Issued' THEN 1 ELSE 0 END) AS issued, SUM(CASE WHEN s.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected, SUM(CASE WHEN s.status = 'Expired' THEN 1 ELSE 0 END) AS expired, SUM(CASE WHEN s.status = 'Hold' THEN 1 ELSE 0 END) AS hold FROM server_master AS s INNER JOIN customers AS c ON c.id = s.customer_id INNER JOIN technologies AS t ON t.id = c.enrolled_course INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN users AS u ON u.user_id = l.assigned_to WHERE 1 = 1`;

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
        // statusQuery += ` AND c.name LIKE '%${name}%'`;
      }

      if (mobile) {
        getQuery += ` AND c.phone LIKE '%${mobile}%'`;
        paginationQuery += ` AND c.phone LIKE '%${mobile}%'`;
        // statusQuery += ` AND c.phone LIKE '%${mobile}%'`;
      }

      if (email) {
        getQuery += ` AND c.email LIKE '%${email}%'`;
        paginationQuery += ` AND c.email LIKE '%${email}%'`;
        // statusQuery += ` AND c.email LIKE '%${email}%'`;
      }

      if (server) {
        getQuery += ` AND t.name LIKE '%${server}%'`;
        paginationQuery += ` AND t.name LIKE '%${server}%'`;
        // statusQuery += ` AND t.name LIKE '%${server}%'`;
      }

      if (status) {
        getQuery += ` AND s.status = ?`;
        paginationQuery += ` AND s.status = ?`;
        queryParams.push(status);
        paginationParams.push(status);
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

  updateServerStatus: async (server_id, status) => {
    try {
      const updateQuery = `UPDATE server_master SET status = ? WHERE id = ?`;
      const values = [server_id, status];

      const [result] = await pool.query(updateQuery, values);

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = ServerModel;
