const pool = require("../config/dbconfig");
const bcrypt = require("bcrypt");

const LoginModel = {
  login: async (user_id, password) => {
    try {
      console.log("uuu: ", user_id, "pppp: ", password);

      const [isExists] = await pool.query(
        `SELECT id, user_id, password FROM users WHERE user_id = ? AND is_active = 1`,
        [user_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid user Id");
      console.log("uuu", isExists);
      console.log("eee", isExists[0].password);

      const isMatch = await verifyPassword(password, isExists[0].password);
      if (!isMatch) throw new Error("Invalid password!");
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

// 🔐 Verify Password
const verifyPassword = async (password, hashedPassword) => {
  const isMatch = await bcrypt.compare(password, hashedPassword);
  return isMatch;
};

// 🔐 Encrypt (Hash) Password
const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
};

module.exports = LoginModel;
