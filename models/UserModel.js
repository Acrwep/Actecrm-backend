const pool = require("../config/dbconfig");

const UserModel = {
  addUser: async (
    user_id,
    user_name,
    password,
    users,
    roles,
    target_value,
    target_start,
    target_end
  ) => {
    try {
      let affectedRows = 0;
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
      affectedRows += result.affectedRows;

      const [isTargetExists] = await pool.query(
        `SELECT * FROM user_target_master WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
        [target_start, target_end, user_id]
      );

      if (isTargetExists.length > 0) {
        const [updateTarget] = await pool.query(
          `UPDATE user_target_master SET target_value = ? WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
          [target_value, target_start, target_end, user_id]
        );
        affectedRows += updateTarget.affectedRows;
      } else {
        const [insertTarget] = await pool.query(
          `INSERT INTO user_target_master(user_id, target_month, target_value) VALUES(?, CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')), ?)`,
          [user_id, target_start, target_end, target_value]
        );
        affectedRows += insertTarget.affectedRows;
      }

      return affectedRows;
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

      const formattedResult = await Promise.all(
        users.map(async (item) => {
          const [getTarget] = await pool.query(
            `SELECT id AS user_target_id, target_month, target_value FROM user_target_master WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
            [item.user_id]
          );
          return {
            ...item,
            user_target_id: getTarget[0]?.user_target_id || 0,
            target_month: getTarget[0]?.target_month || "",
            target_value: getTarget[0]?.target_value || 0,
            child_users: JSON.parse(item.child_users),
            roles: JSON.parse(item.roles),
          };
        })
      );

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

  updateUser: async (
    id,
    user_id,
    user_name,
    password,
    users,
    roles,
    target_start,
    target_end,
    target_value
  ) => {
    try {
      let affectedRows = 0;
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

      affectedRows += result.affectedRows;

      const [isTargetExists] = await pool.query(
        `SELECT * FROM user_target_master WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
        [target_start, target_end, user_id]
      );

      if (isTargetExists.length > 0) {
        const [updateTarget] = await pool.query(
          `UPDATE user_target_master SET target_value = ? WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
          [target_value, target_start, target_end, user_id]
        );
        affectedRows += updateTarget.affectedRows;
      } else {
        const [insertTarget] = await pool.query(
          `INSERT INTO user_target_master(user_id, target_month, target_value) VALUES(?, CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')), ?)`,
          [user_id, target_start, target_end, target_value]
        );
        affectedRows += insertTarget.affectedRows;
      }
      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  setTarget: async (user_ids, target_start, target_end, target_value) => {
    try {
      let affectedRows = 0;
      if (user_ids.length > 0 && Array.isArray(user_ids)) {
        await Promise.all(
          user_ids.map(async (item) => {
            const [isTargetExists] = await pool.query(
              `SELECT * FROM user_target_master WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
              [target_start, target_end, item.user_id]
            );

            if (isTargetExists.length > 0) {
              const [updateTarget] = await pool.query(
                `UPDATE user_target_master SET target_value = ? WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
                [target_value, target_start, target_end, item.user_id]
              );
              affectedRows += updateTarget.affectedRows;
            } else {
              const [insertTarget] = await pool.query(
                `INSERT INTO user_target_master(user_id, target_month, target_value) VALUES(?, CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')), ?)`,
                [item.user_id, target_start, target_end, target_value]
              );
              affectedRows += insertTarget.affectedRows;
            }
          })
        );
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = UserModel;
