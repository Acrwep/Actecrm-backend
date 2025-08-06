const pool = require("../config/dbconfig");

const TrainerModel = {
  getTechnologies: async () => {
    try {
      const [tech] = await pool.query(
        `SELECT id, name FROM technologies WHERE is_active = 1`
      );
      return tech;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBatches: async () => {
    try {
      const [batches] = await pool.query(
        `SELECT id, name FROM batches WHERE is_active = 1`
      );
      return batches;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  addTrainer: async (
    trainer_name,
    mobile,
    email,
    whatsapp,
    technology_id,
    overall_exp_year,
    overall_exp_month,
    relevant_exp_year,
    relevant_exp_month,
    batch_id,
    availability_time,
    secondary_time,
    skills,
    location
  ) => {
    try {
      const [isEmailOrMobileExists] = await pool.query(
        `SELECT id FROM trainer WHERE email = ? AND mobile = ?`,
        [email, mobile]
      );
      if (isEmailOrMobileExists.length > 0) {
        throw new Error("Email or mobile number already exists");
      }
      const insertQuery = `INSERT INTO trainer(
                                name,
                                mobile,
                                email,
                                whatsapp,
                                technology_id,
                                overall_exp_year,
                                overall_exp_month,
                                relavant_exp_year,
                                relavant_exp_month,
                                batch_id,
                                availability_time,
                                secondary_time,
                                skills,
                                location
                            )
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        trainer_name,
        mobile,
        email,
        whatsapp,
        technology_id,
        overall_exp_year,
        overall_exp_month,
        relevant_exp_year,
        relevant_exp_month,
        batch_id,
        availability_time,
        secondary_time,
        JSON.stringify(skills),
        location,
      ];

      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateTrainer: async (
    trainer_name,
    mobile,
    email,
    whatsapp,
    technology_id,
    overall_exp_year,
    overall_exp_month,
    relevant_exp_year,
    relevant_exp_month,
    batch_id,
    availability_time,
    secondary_time,
    skills,
    location,
    id
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM trainer WHERE id = ?`,
        [id]
      );
      if (isIdExists.length <= 0) throw new Error("Invalid Id");
      const updateQuery = `UPDATE
                                trainer
                            SET
                                name = ?,
                                mobile = ?,
                                email = ?,
                                whatsapp = ?,
                                technology_id = ?,
                                overall_exp_year = ?,
                                overall_exp_month = ?,
                                relavant_exp_year = ?,
                                relavant_exp_month = ?,
                                batch_id = ?,
                                availability_time = ?,
                                secondary_time = ?,
                                skills = ?,
                                location = ?
                            WHERE
                                id = ?`;
      const values = [
        trainer_name,
        mobile,
        email,
        whatsapp,
        technology_id,
        overall_exp_year,
        overall_exp_month,
        relevant_exp_year,
        relevant_exp_month,
        batch_id,
        availability_time,
        secondary_time,
        JSON.stringify(skills),
        location,
        id,
      ];
      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTrainers: async () => {
    try {
      const getQuery = `SELECT
                            id,
                            name,
                            mobile,
                            email,
                            whatsapp,
                            technology_id,
                            overall_exp_year,
                            overall_exp_month,
                            relavant_exp_year,
                            relavant_exp_month,
                            batch_id,
                            availability_time,
                            secondary_time,
                            skills,
                            location,
                            CASE WHEN is_active = 1 THEN 1 ELSE 0
                        END AS is_active
                        FROM
                            trainer AND is_active = 1 ORDER BY name`;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = TrainerModel;
