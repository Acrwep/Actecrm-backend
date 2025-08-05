const pool = require("../config/dbconfig");
const bcrypt = require("bcrypt");

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
                            u.user_name,
                            p.id AS position_id,
                            p.position,
                            d.id AS department_id,
                            d.department,
                            r.id AS role_id,
                            r.role
                        FROM
                            users AS u
                        INNER JOIN position_master AS p ON
                            u.position_id = p.id
                        LEFT JOIN department_master AS d ON
                            u.department_id = d.id
                        LEFT JOIN role_master AS r ON
                            u.role_id = r.id
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
