const pool = require("../config/dbconfig");

const UserModel = {
  addUser: async (user_id, user_name, password) => {
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
                              password
                          )
                          VALUES(?, ?, ?)`;
      const values = [user_id, user_name, password];

      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUsers: async (user_id, user_name) => {
    try {
      const params = [];
      let getQuery = `SELECT id, user_id, user_name, password, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM users WHERE is_active = 1`;
      if (user_id) {
        getQuery += ` AND user_id LIKE '%${user_id}%'`;
      }
      if (user_name) {
        getQuery += ` AND user_name LIKE '%${user_name}%'`;
      }
      getQuery += ` ORDER BY user_name`;

      const [users] = await pool.query(getQuery, params);
      return users;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateUser: async (id, user_id, user_name, password) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM users WHERE id = ?`,
        [id]
      );
      if (isIdExists.length <= 0) {
        throw new Error("Invalid Id");
      }
      const updateQuery = `UPDATE users SET user_id = ?, user_name = ?, password = ? WHERE id = ?`;
      const values = [user_id, user_name, password, id];
      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = UserModel;
