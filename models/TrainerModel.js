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

  getExperience: async () => {
    try {
      const [result] = await pool.query(`SELECT id, exp_range FROM experience`);
      return result;
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
    relevant_exp_year,
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
                                relavant_exp_year,
                                batch_id,
                                availability_time,
                                secondary_time,
                                skills,
                                location,
                                status
                            )
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        trainer_name,
        mobile,
        email,
        whatsapp,
        technology_id,
        overall_exp_year,
        relevant_exp_year,
        batch_id,
        availability_time,
        secondary_time,
        JSON.stringify(skills),
        location,
        "Pending",
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
    relevant_exp_year,
    batch_id,
    availability_time,
    secondary_time,
    skills,
    location,
    status,
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
                                relavant_exp_year = ?,
                                batch_id = ?,
                                availability_time = ?,
                                secondary_time = ?,
                                skills = ?,
                                location = ?,
                                status = ?
                            WHERE
                                id = ?`;
      const values = [
        trainer_name,
        mobile,
        email,
        whatsapp,
        technology_id,
        overall_exp_year,
        relevant_exp_year,
        batch_id,
        availability_time,
        secondary_time,
        JSON.stringify(skills),
        location,
        status,
        id,
      ];
      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTrainers: async (name, mobile, email) => {
    try {
      let getQuery = `SELECT
                        t.id,
                        t.name,
                        t.mobile,
                        t.email,
                        t.whatsapp,
                        t.technology_id,
                        te.name AS technology,
                        t.overall_exp_year,
                        t.relavant_exp_year,
                        t.batch_id,
                        b.name AS batch,
                        t.availability_time,
                        t.secondary_time,
                        t.skills,
                        t.location,
                        t.status,
                        CASE WHEN t.is_active = 1 THEN 1 ELSE 0
                    END AS is_active
                    FROM
                        trainer AS t
                    INNER JOIN technologies te ON
                        te.id = t.technology_id
                    INNER JOIN batches b ON
                        b.id = t.batch_id
                    WHERE
                        t.is_active = 1`;
      if (name) {
        getQuery += ` AND t.name LIKE '%${name}%'`;
      }
      if (mobile) {
        getQuery += ` AND t.mobile LIKE '%${mobile}%'`;
      }
      if (email) {
        getQuery += ` AND t.email LIKE '%${email}%'`;
      }
      getQuery += ` ORDER BY t.name`;
      const [trainers] = await pool.query(getQuery);

      const formattedResult = trainers.map((item) => ({
        ...item,
        skills: JSON.parse(item.skills),
      }));
      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateStatus: async (trainer_id, status) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM trainer WHERE id = ?`,
        [trainer_id]
      );
      if (isIdExists.length <= 0) throw new Error("Invalid trainer Id");

      const [result] = await pool.query(
        `UPDATE trainer SET status = ? WHERE id = ?`,
        [status, trainer_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = TrainerModel;
