const pool = require("../config/dbconfig");
const bcrypt = require("bcrypt");

const UserModel = {
  getPositions: async () => {
    try {
      const [positions] = await pool.query(
        `SELECT id, position FROM position_master WHERE is_active = 1`
      );
      return positions;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getDepartments: async () => {
    try {
      const [departments] = await pool.query(
        `SELECT id, department FROM department_master WHERE is_active = 1`
      );
      return departments;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRoles: async () => {
    try {
      const [roles] = await pool.query(
        `SELECT id, role FROM role_master WHERE is_active = 1`
      );
      return roles;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  addUser: async (
    user_id,
    user_name,
    position_id,
    role_id,
    department_id,
    pre_quality,
    ra,
    hrs,
    post_quality,
    sales_supervisor,
    manager,
    password
  ) => {
    try {
      const [isUserIdExists] = await pool.query(
        `SELECT id FROM users WHERE user_id = ? AND is_active = 1`,
        [user_id]
      );
      if (isUserIdExists.length > 0) {
        throw new Error("User Id already exists");
      }
      const hashedPassword = await hashPassword(password);
      const insertQuery = `INSERT INTO users(
                              user_id,
                              user_name,
                              position_id,
                              role_id,
                              department_id,
                              pre_quality,
                              ra,
                              hrs,
                              post_quality,
                              sales_supervisor,
                              manager,
                              password
                          )
                          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        user_id,
        user_name,
        position_id,
        role_id,
        department_id,
        pre_quality,
        ra,
        hrs,
        post_quality,
        sales_supervisor,
        manager,
        hashedPassword,
      ];

      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

// 🔐 Encrypt (Hash) Password
const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
};

module.exports = UserModel;
