const pool = require("../config/dbconfig");

const PageAccessModel = {
  getFeatures: async () => {
    try {
      const sql = `SELECT id, name, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM features WHERE is_active = 1 ORDER BY id ASC`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertFeature: async (feature_name) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM features WHERE name = ? AND is_active = 1`,
        [feature_name]
      );
      if (isExists.length > 0) throw new Error("The feature already exists");
      const sql = `INSERT INTO features(name) VALUES(?)`;
      const values = [feature_name];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = PageAccessModel;
