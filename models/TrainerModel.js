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
    location,
    profile_image,
    account_holder_name,
    account_number,
    bank_name,
    branche_name,
    ifsc_code,
    signature_image,
    created_date
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
                                profile_image,
                                status
                            )
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
        profile_image,
        "Verify Pending",
      ];

      const [result] = await pool.query(insertQuery, values);

      if (result.affectedRows <= 0)
        throw new Error("Error while inserting trainer");

      const [insertBank] = await pool.query(
        `INSERT INTO trainer_bank_accounts (trainer_id, account_holder_name, account_number, bank_name, branch_name, ifsc_code, signature_image, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          account_holder_name,
          account_number,
          bank_name,
          branche_name,
          ifsc_code,
          signature_image,
          created_date,
        ]
      );
      return insertBank.affectedRows;
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
    profile_image,
    id,
    trainer_bank_id,
    account_holder_name,
    account_number,
    bank_name,
    branch_name,
    ifsc_code,
    signature_image
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
                                profile_image = ?,
                                status = ?,
                                is_bank_updated = ?
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
        profile_image,
        status,
        1,
        id,
      ];
      const [result] = await pool.query(updateQuery, values);
      if (result.affectedRows <= 0)
        throw new Error("Error while updating trainer");
      const [updateBank] = await pool.query(
        `UPDATE
            trainer_bank_accounts
        SET
            account_holder_name = ?,
            account_number = ?,
            bank_name = ?,
            branch_name = ?,
            ifsc_code = ?,
            signature_image = ?
        WHERE
            id = ?`,
        [
          account_holder_name,
          account_number,
          bank_name,
          branch_name,
          ifsc_code,
          signature_image,
          trainer_bank_id,
        ]
      );
      return updateBank.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTrainers: async (name, mobile, email, status, is_form_sent) => {
    try {
      const queryParams = [];
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
                          t.profile_image,
                          CASE WHEN t.is_active = 1 THEN 1 ELSE 0
                      END AS is_active,
                          tb.id AS trainer_bank_id,
                          tb.account_holder_name,
                          tb.account_number,
                          tb.bank_name,
                          tb.branch_name,
                          tb.ifsc_code,
                          tb.signature_image
                      FROM
                          trainer AS t
                      INNER JOIN technologies te ON
                          te.id = t.technology_id
                      INNER JOIN batches b ON
                          b.id = t.batch_id
                      LEFT JOIN trainer_bank_accounts AS tb ON
                        tb.trainer_id = t.id
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
      if (status) {
        getQuery += ` AND t.status IN (?)`;
        queryParams.push(status);
      }
      if (is_form_sent != null || is_form_sent != undefined) {
        getQuery += ` AND t.is_form_sent = ? AND t.is_bank_updated = 0`;
        queryParams.push(is_form_sent);
      }
      getQuery += ` ORDER BY t.name`;

      const [trainers] = await pool.query(getQuery, queryParams);

      const [getStatus] = await pool.query(
        `SELECT COUNT(CASE WHEN t.is_form_sent = 1 AND t.is_bank_updated = 0 THEN 1 END) AS form_pending, COUNT(CASE WHEN t.status IN ('Verify Pending') THEN 1 END) AS verify_pending, COUNT(CASE WHEN t.status = 'Verified' THEN 1 END) AS verified, COUNT(CASE WHEN t.status = 'Rejected' THEN 1 END) AS rejected FROM trainer AS t`
      );

      const formattedResult = trainers.map((item) => ({
        ...item,
        skills: JSON.parse(item.skills),
      }));
      return {
        trainers: formattedResult,
        trainer_status_count: getStatus,
      };
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

  getTrainerById: async (trainer_id) => {
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
                          t.profile_image,
                          CASE WHEN t.is_active = 1 THEN 1 ELSE 0
                      END AS is_active,
                          tb.id AS trainer_bank_id,
                          tb.account_holder_name,
                          tb.account_number,
                          tb.bank_name,
                          tb.branch_name,
                          tb.ifsc_code,
                          tb.signature_image
                      FROM
                          trainer AS t
                      INNER JOIN technologies te ON
                          te.id = t.technology_id
                      INNER JOIN batches b ON
                          b.id = t.batch_id
                      LEFT JOIN trainer_bank_accounts AS tb ON
                        tb.trainer_id = t.id
                      WHERE
                          t.is_active = 1 AND t.id = ?`;

      const [trainers] = await pool.query(getQuery, [trainer_id]);

      return {
        ...trainers[0],
        skills: JSON.parse(trainers[0].skills),
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = TrainerModel;
