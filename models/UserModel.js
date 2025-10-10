const pool = require("../config/dbconfig");

const UserModel = {
  addUser: async (user_id, user_name, password, users, roles) => {
    try {
      const [isUserIdExists] = await pool.query(
        `SELECT id FROM users WHERE user_id = ? AND is_active = 1`,
        [user_id]
      );
      if (isUserIdExists.length > 0) {
        throw new Error("User Id already exists");
      }
      const insertQuery = `INSERT INTO users(
                              user_id,
                              user_name,
                              password,
                              child_users,
                              roles
                          )
                          VALUES(?, ?, ?, ?, ?)`;
      const values = [
        user_id,
        user_name,
        password,
        JSON.stringify(users),
        JSON.stringify(roles),
      ];

      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUsers: async (user_id, user_name, page, limit) => {
    try {
      const params = [];
      let getQuery = `SELECT id, user_id, user_name, password, child_users, roles, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM users WHERE is_active = 1`;

      let countQuery = `SELECT COUNT(id) AS total FROM users WHERE is_active = 1`;
      if (user_id) {
        getQuery += ` AND user_id LIKE '%${user_id}%'`;
        countQuery += ` AND user_id LIKE '%${user_id}%'`;
      }
      if (user_name) {
        getQuery += ` AND user_name LIKE '%${user_name}%'`;
        countQuery += ` AND user_name LIKE '%${user_name}%'`;
      }

      const [countResult] = await pool.query(countQuery);
      const total = countResult[0].total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY user_name`;

      getQuery += ` LIMIT ? OFFSET ?`;
      params.push(limitNumber, offset);

      const [users] = await pool.query(getQuery, params);
      const formattedResult = users.map((item) => {
        return {
          ...item,
          child_users: JSON.parse(item.child_users),
          roles: JSON.parse(item.roles),
        };
      });

      return {
        data: formattedResult,
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

  updateUser: async (id, user_id, user_name, password, users, roles) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM users WHERE id = ?`,
        [id]
      );
      if (isIdExists.length <= 0) {
        throw new Error("Invalid Id");
      }
      const updateQuery = `UPDATE users SET user_id = ?, user_name = ?, password = ?, child_users = ?, roles = ? WHERE id = ?`;
      const values = [
        user_id,
        user_name,
        password,
        JSON.stringify(users),
        JSON.stringify(roles),
        id,
      ];
      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = UserModel;
