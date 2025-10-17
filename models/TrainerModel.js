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
    mobile_phone_code,
    mobile,
    email,
    whatsapp_phone_code,
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
    created_by,
    created_date
  ) => {
    try {
      // ✅ Check if email or mobile already exists
      const [isEmailOrMobileExists] = await pool.query(
        `SELECT id FROM trainer WHERE email = ? OR mobile = ?`,
        [email, mobile]
      );
      if (isEmailOrMobileExists.length > 0) {
        throw new Error("Email or mobile number already exists");
      }

      // ✅ Generate next trainer ID with leading zeros (e.g., TR000001)
      const [trainer_code] = await pool.query(
        `SELECT CONCAT('TR', LPAD(IFNULL(MAX(CAST(SUBSTRING(trainer_id, 3) AS UNSIGNED)), 0) + 1, 4, '0')) AS next_trainer_id 
       FROM trainer`
      );

      let newId;
      if (!trainer_code[0].next_trainer_id) {
        newId = "TR1000";
      } else {
        newId = trainer_code[0].next_trainer_id;
      }

      // ✅ Insert into trainer table
      const insertQuery = `
      INSERT INTO trainer(
        name,
        trainer_id,
        mobile_phone_code,
        mobile,
        email,
        whatsapp_phone_code,
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
        status,
        created_by
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
      const values = [
        trainer_name,
        newId,
        mobile_phone_code,
        mobile,
        email,
        whatsapp_phone_code,
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
        created_by,
      ];

      const [result] = await pool.query(insertQuery, values);

      if (result.affectedRows <= 0) {
        throw new Error("Error while inserting trainer");
      }

      // ✅ Insert bank details
      await pool.query(
        `INSERT INTO trainer_bank_accounts 
        (trainer_id, account_holder_name, account_number, bank_name, branch_name, ifsc_code, signature_image, created_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

      return {
        insertId: result.insertId,
        trainer_id: newId,
        email: email,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateTrainer: async (
    trainer_name,
    mobile_phone_code,
    mobile,
    email,
    whatsapp_phone_code,
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
                                mobile_phone_code = ?,
                                mobile = ?,
                                email = ?,
                                whatsapp_phone_code = ?,
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
                                id = ? `;
      const values = [
        trainer_name,
        mobile_phone_code,
        mobile,
        email,
        whatsapp_phone_code,
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

  getTrainers: async (
    name,
    mobile,
    trainer_code,
    email,
    status,
    is_form_sent,
    is_onboarding,
    ongoing,
    created_by,
    page,
    limit
  ) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                          t.id,
                          t.name,
                          t.trainer_id AS trainer_code,
                          t.mobile_phone_code,
                          t.mobile,
                          t.email,
                          t.whatsapp_phone_code,
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
                          t.is_bank_updated,
                          t.is_form_sent,
                          t.is_onboarding,
                          CASE WHEN t.is_active = 1 THEN 1 ELSE 0
                      END AS is_active,
                          tb.id AS trainer_bank_id,
                          tb.account_holder_name,
                          tb.account_number,
                          tb.bank_name,
                          tb.branch_name,
                          tb.ifsc_code,
                          tb.signature_image,
                          t.created_by,
                          u.user_name AS hr_head
                      FROM
                          trainer AS t
                      LEFT JOIN technologies te ON
                          te.id = t.technology_id
                      LEFT JOIN batches b ON
                          b.id = t.batch_id
                      LEFT JOIN trainer_bank_accounts AS tb ON
                        tb.trainer_id = t.id
                      LEFT JOIN users AS u ON
                        u.user_id = t.created_by
                      WHERE
                          t.is_active = 1`;

      const countQueryParams = [];
      let countQuery = `SELECT COUNT(DISTINCT t.id) as total
                      FROM trainer AS t
                      WHERE t.is_active = 1`;

      if (name) {
        getQuery += ` AND t.name LIKE '%${name}%'`;
        countQuery += ` AND t.name LIKE '%${name}%'`;
      }
      if (trainer_code) {
        getQuery += ` AND t.trainer_code LIKE '%${trainer_code}%'`;
        countQuery += ` AND t.trainer_code LIKE '%${trainer_code}%'`;
      }
      if (mobile) {
        getQuery += ` AND t.mobile LIKE '%${mobile}%'`;
        countQuery += ` AND t.mobile LIKE '%${mobile}%'`;
      }
      if (email) {
        getQuery += ` AND t.email LIKE '%${email}%'`;
        countQuery += ` AND t.email LIKE '%${email}%'`;
      }
      if (status) {
        getQuery += ` AND t.status IN (?)`;
        countQuery += ` AND t.status IN (?)`;
        queryParams.push(status);
        countQueryParams.push(status);
      }
      if (is_form_sent != null || is_form_sent != undefined) {
        getQuery += ` AND t.is_form_sent = ? AND t.is_bank_updated = 0`;
        countQuery += ` AND t.is_form_sent = ? AND t.is_bank_updated = 0`;
        queryParams.push(is_form_sent);
        countQueryParams.push(is_form_sent);
      }

      if (is_onboarding != null || is_onboarding != undefined) {
        getQuery += " AND t.is_onboarding = ?";
        countQuery += " AND t.is_onboarding = ?";
        queryParams.push(is_onboarding);
        countQueryParams.push(is_onboarding);
      }

      if (created_by) {
        getQuery += ` AND t.created_by LIKE '%${created_by}%'`;
        countQuery += ` AND t.created_by LIKE '%${created_by}%'`;
      }

      // Get total count before applying pagination and ongoing filter
      const [countResult] = await pool.query(countQuery, countQueryParams);
      const totalBeforeFilter = countResult[0]?.total || 0;

      getQuery += ` ORDER BY t.id DESC`;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      let [trainers] = await pool.query(getQuery, queryParams);

      // Get counts of trainers based on status
      const [getStatus] = await pool.query(
        `SELECT COUNT(id) AS total_count, COUNT(CASE WHEN t.is_form_sent = 1 AND t.is_bank_updated = 0 THEN 1 END) AS form_pending, COUNT(CASE WHEN t.status IN ('Verify Pending') THEN 1 END) AS verify_pending, COUNT(CASE WHEN t.status = 'Verified' THEN 1 END) AS verified, COUNT(CASE WHEN t.status = 'Rejected' THEN 1 END) AS rejected FROM trainer AS t`
      );

      const [getOnBoarding] = await pool.query(
        `SELECT
          COUNT(DISTINCT CASE WHEN c.class_percentage = 100 THEN t.id END) AS on_boarding_count,
          COUNT(DISTINCT CASE WHEN c.class_percentage < 100 THEN t.id END) AS on_going_count
        FROM trainer AS t
        INNER JOIN trainer_mapping AS tm ON t.id = tm.trainer_id AND tm.is_rejected = 0
        INNER JOIN customers AS c ON tm.customer_id = c.id;`
      );

      const [getOngoing] = await pool.query(
        `SELECT tm.trainer_id FROM trainer_mapping AS tm INNER JOIN customers AS c ON tm.customer_id = c.id WHERE c.class_percentage > 0 AND c.class_percentage < 100 AND tm.is_rejected = 0 GROUP BY tm.trainer_id`
      );

      // Calculate total after ongoing filter if applicable
      let total = totalBeforeFilter;

      // filter from trainers only ongoing trainers
      if (ongoing === "Ongoing") {
        const ongoingTrainerIds = getOngoing.map((row) => row.trainer_id);
        trainers = trainers.filter((item) =>
          ongoingTrainerIds.includes(item.id)
        );
        // Update total count for ongoing trainers only
        total = ongoingTrainerIds.length;
      }

      const [getSkills] = await pool.query(
        `SELECT id, name FROM skills WHERE is_active = 1`
      );

      const formattedResult = await Promise.all(
        trainers.map(async (item) => {
          const [student_count] = await pool.query(
            `SELECT 
              SUM(CASE WHEN c.class_percentage IS NULL THEN 1 ELSE 0 END) AS not_started_student,
              SUM(CASE WHEN c.class_percentage IS NOT NULL AND c.class_percentage < 100 THEN 1 ELSE 0 END) AS on_going_student,
              COALESCE(SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END), 0) AS completed_student_count
            FROM trainer_mapping AS tm
            LEFT JOIN customers AS c ON tm.customer_id = c.id
            WHERE tm.trainer_id = ? AND tm.is_rejected = 0`,
            [item.id]
          );

          const not_started =
            parseInt(student_count[0]?.not_started_student) || 0;
          const on_going = parseInt(student_count[0]?.on_going_student) || 0;
          const completed =
            parseInt(student_count[0]?.completed_student_count) || 0;

          let trainer_type;
          if (not_started > 0 && on_going === 0 && completed === 0) {
            trainer_type = "New"; // Only not started
          } else if (completed > 0 && on_going === 0) {
            trainer_type = "Existing"; // Only completed
          } else if (on_going > 0) {
            trainer_type = "On-Going"; // At least one ongoing
          } else {
            trainer_type = "New";
          }

          const formattedSkills = await getSkillsWithDetails(item.skills);

          return {
            ...item,
            // skills: JSON.parse(item.skills),
            skills: formattedSkills,
            trainer_type,
            on_going_count: on_going,
            on_boarding_count: completed,
          };
        })
      );

      return {
        trainers: formattedResult,
        trainer_status_count: getStatus,
        on_boarding: getOnBoarding[0].on_boarding_count,
        on_going: getOnBoarding[0].on_going_count,
        pagination: {
          total: parseInt(total),
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
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
                          t.trainer_id AS trainer_code,
                          t.mobile_phone_code,
                          t.mobile,
                          t.email,
                          t.whatsapp_phone_code,
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
                          t.is_bank_updated,
                          t.is_form_sent,
                          t.is_onboarding,
                          CASE WHEN t.is_active = 1 THEN 1 ELSE 0
                      END AS is_active,
                          tb.id AS trainer_bank_id,
                          tb.account_holder_name,
                          tb.account_number,
                          tb.bank_name,
                          tb.branch_name,
                          tb.ifsc_code,
                          tb.signature_image,
                          t.created_by,
                          u.user_name AS hr_head
                      FROM
                          trainer AS t
                      INNER JOIN technologies te ON
                          te.id = t.technology_id
                      INNER JOIN batches b ON
                          b.id = t.batch_id
                      LEFT JOIN trainer_bank_accounts AS tb ON
                        tb.trainer_id = t.id
                      LEFT JOIN users AS u ON
                        u.user_id = t.created_by
                      WHERE
                          t.is_active = 1 AND t.id = ?`;

      const [trainers] = await pool.query(getQuery, [trainer_id]);

      const formattedSkills = await getSkillsWithDetails(trainers[0].skills);

      return {
        ...trainers[0],
        skills: formattedSkills,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTrainerHistory: async (customer_id) => {
    try {
      const getQuery = `SELECT tm.id, tm.trainer_id, t.trainer_id AS trainer_code, t.name AS trainer_name, tm.commercial, tm.mode_of_class, tm.trainer_type, tm.proof_communication, tm.comments, tm.is_verified, tm.verified_date, tm.is_rejected, tm.rejected_date, tm.created_date FROM trainer_mapping AS tm INNER JOIN trainer AS t ON tm.trainer_id = t.id WHERE tm.customer_id = ? ORDER BY tm.id ASC`;

      const [history] = await pool.query(getQuery, [customer_id]);

      const [primary_fees] = await pool.query(
        `SELECT lm.primary_fees FROM customers AS c INNER JOIN lead_master AS lm ON c.lead_id = lm.id WHERE c.id = ?`,
        [customer_id]
      );

      const result = await Promise.all(
        history.map(async (item) => {
          const [student_count] = await pool.query(
            `SELECT SUM(CASE WHEN c.class_percentage < 100 THEN 1 ELSE 0 END) AS on_going_student, SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END) AS completed_student_count FROM trainer_mapping AS tm INNER JOIN customers AS c ON tm.customer_id = c.id WHERE tm.trainer_id = ? AND tm.is_rejected = 0`,
            [item.trainer_id]
          );
          return {
            ...item,
            commercial_percentage: parseFloat(
              ((item.commercial / primary_fees[0].primary_fees) * 100).toFixed(
                2
              )
            ),
            ongoing_student_count: student_count[0].on_going_student,
            completed_student_count: student_count[0].completed_student_count,
          };
        })
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCusByTrainer: async (trainer_id, is_class_taken) => {
    try {
      // Get on-going and on-boarding student list by trainer
      let getQuery = `SELECT
                          tm.trainer_id,
                          tm.customer_id,
                          c.name AS cus_name,
                          c.phonecode AS cus_phonecode,
                          c.phone AS cus_phone,
                          c.email AS cus_email,
                          tm.commercial,
                          r.id AS region_id,
                          r.name AS region_name,
                          b.id AS branch_id,
                          b.name AS branch_name,
                          t.id AS course_id,
                          t.name AS course_name,
                          c.class_percentage,
                          lm.primary_fees
                      FROM
                          trainer_mapping AS tm
                      LEFT JOIN customers AS c ON
                          c.id = tm.customer_id
                      LEFT JOIN lead_master AS lm ON
                        c.lead_id = lm.id
                      LEFT JOIN region AS r ON
                        r.id = lm.region_id
                      LEFT JOIN branches AS b ON
                        b.id = lm.branch_id
                      LEFT JOIN technologies AS t ON
                        t.id = c.enrolled_course
                      WHERE
                          tm.is_verified = 1
                          AND tm.trainer_id = ?`;

      if (is_class_taken >= 1) {
        getQuery += ` AND c.class_percentage = 100`;
      } else if (is_class_taken == 0) {
        getQuery += ` AND c.class_percentage < 100`;
      }

      const [result] = await pool.query(getQuery, [trainer_id]);

      // Get on-going and on-boarding students count by trainer
      const [student_count] = await pool.query(
        `SELECT SUM(CASE WHEN c.class_percentage < 100 THEN 1 ELSE 0 END) AS on_going_student, SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END) AS completed_student_count FROM trainer_mapping AS tm INNER JOIN customers AS c ON tm.customer_id = c.id WHERE tm.is_rejected = 0 AND tm.trainer_id = ?`,
        [trainer_id]
      );
      return {
        students: result,
        on_going_count: student_count[0].on_going_student,
        on_boarding_count: student_count[0].completed_student_count,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
  addTechnologies: async (course_name) => {
    try {
      const [isNameExists] = await pool.query(
        `SELECT id FROM technologies WHERE name = ? AND is_active = 1`,
        [course_name]
      );
      if (isNameExists.length > 0)
        throw new Error("The course name already exists");

      const [result] = await pool.query(
        `INSERT INTO technologies(name) VALUES(?)`,
        [course_name]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  addSkills: async (skill_name) => {
    try {
      const [isNameExists] = await pool.query(
        `SELECT id FROM skills WHERE name = ? AND is_active = 1`,
        [skill_name]
      );
      if (isNameExists.length > 0)
        throw new Error("The skill name already exists");

      const [result] = await pool.query(`INSERT INTO skills(name) VALUES(?)`, [
        skill_name,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSkills: async () => {
    try {
      const [getSkills] = await pool.query(
        `SELECT id, name FROM skills WHERE is_active = 1 ORDER BY name`
      );
      return getSkills;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

const getSkillsWithDetails = async (skillIds) => {
  try {
    // Convert string to array if needed
    const skillsArray =
      typeof skillIds === "string" ? JSON.parse(skillIds) : skillIds;

    if (skillsArray.length === 0) return [];

    // Create placeholders for the IN clause
    const placeholders = skillsArray.map(() => "?").join(",");

    const [skills] = await pool.query(
      `SELECT id, name FROM skills WHERE id IN (${placeholders}) AND is_active = 1`,
      skillsArray
    );

    return skills; // This returns [{id: 1, name: "HTML"}, {id: 2, name: "CSS"}]
  } catch (error) {
    throw new Error(`Error fetching skills: ${error.message}`);
  }
};

module.exports = TrainerModel;
