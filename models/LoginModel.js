const pool = require("../config/dbconfig");

const LoginModel = {
  login: async (user_id, password) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id, user_id, password FROM users WHERE user_id = ? AND password = ? AND is_active = 1`,
        [user_id, password]
      );
      if (isExists.length <= 0) throw new Error("Invalid user Id or password");

      const getQuery = `SELECT
                            u.id,
                            u.user_id,
                            u.user_name
                        FROM
                            users AS u
                        WHERE
                            u.id = ? AND u.is_active = 1`;
      const [getUser] = await pool.query(getQuery, [isExists[0].id]);
      return getUser[0];
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = LoginModel;
