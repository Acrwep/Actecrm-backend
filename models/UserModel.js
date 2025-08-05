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

  getUsers: async () => {
    try {
      const [users] = await pool.query(
        `SELECT id, user_id, user_name FROM users WHERE is_active = 1 ORDER BY user_name`
      );
      return users;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = UserModel;
