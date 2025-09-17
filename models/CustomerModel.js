const pool = require("../config/dbconfig");
const CommonModel = require("../models/CommonModel");

const CustomerModel = {
  updateCustomer: async (
    name,
    email,
    phonecode,
    phone,
    whatsapp,
    date_of_birth,
    gender,
    date_of_joining,
    enrolled_course,
    region_id,
    branch_id,
    batch_track_id,
    batch_timing_id,
    current_location,
    signature_image,
    profile_image,
    palcement_support,
    id
  ) => {
    try {
      const [isCusExists] = await pool.query(
        `SELECT id FROM customers WHERE id = ?`,
        [id]
      );
      if (isCusExists.length <= 0) throw new Error("Invalid customer");
      const updateQuery = `UPDATE
                                customers
                            SET
                                name = ?,
                                email = ?,
                                phonecode = ?,
                                phone = ?,
                                whatsapp = ?,
                                date_of_birth = ?,
                                gender = ?,
                                date_of_joining = ?,
                                enrolled_course = ?,
                                branch_id = ?,
                                batch_track_id = ?,
                                batch_timing_id = ?,
                                current_location = ?,
                                signature_image = ?,
                                profile_image = ?,
                                placement_support = ?,
                                is_customer_updated = 1,
                                region_id = ?
                            WHERE
                                id = ?`;
      const values = [
        name,
        email,
        phonecode,
        phone,
        whatsapp,
        date_of_birth,
        gender,
        date_of_joining,
        enrolled_course,
        branch_id,
        batch_track_id,
        batch_timing_id,
        current_location,
        signature_image,
        profile_image,
        palcement_support,
        region_id,
        id,
      ];

      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCustomers: async (
    from_date,
    to_date,
    status,
    name,
    email,
    mobile,
    course
  ) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                            c.id,
                            c.lead_id,
                            c.name,
                            c.student_id,
                            c.email,
                            c.phonecode,
                            c.phone,
                            c.whatsapp,
                            c.date_of_birth,
                            c.gender,
                            c.date_of_joining,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN c.enrolled_course ELSE l.primary_course_id END AS enrolled_course,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN t.name ELSE tg.name END AS course_name,
                            l.primary_fees,
                            c.branch_id,
                            b.name AS branch_name,
                            c.batch_track_id,
                            bt.name AS batch_tracking,
                            c.batch_timing_id,
                            bs.name AS batch_timing,
                            c.current_location,
                            c.signature_image,
                            c.profile_image,
                            c.placement_support,
                            c.status,
                            c.is_form_sent,
                            c.is_customer_updated,
                            c.class_start_date,
                            c.created_date,
                            l.user_id AS lead_by_id,
                            u.user_name AS lead_by,
                            tr.name AS trainer_name,
                            tr.mobile AS trainer_mobile,
                            tr.email AS trainer_email,
                            map.id AS training_map_id,
                            map.trainer_id,
                            map.commercial,
                            map.mode_of_class,
                            map.trainer_type,
                            map.proof_communication,
                            map.comments,
                            map.is_verified AS is_trainer_verified,
                            map.verified_date AS trainer_verified_date,
                            map.is_rejected AS is_trainer_rejected,
                            map.rejected_date AS trainer_rejected_date,
                            c.class_schedule_id,
                            cs.name AS class_schedule_name,
                            c.class_scheduled_at,
                            c.class_percentage,
                            c.class_comments,
                            c.class_attachment,
                            c.linkedin_review,
                            c.google_review,
                            c.course_duration,
                            c.course_completion_date,
                            c.review_updated_date,
                            r.name AS region_name,
                            r.id AS region_id
                        FROM
                            customers AS c
                        LEFT JOIN technologies AS t ON
                            c.enrolled_course = t.id
                        LEFT JOIN region AS r ON
                            r.id = c.region_id
                        LEFT JOIN branches AS b ON
                            b.id = c.branch_id
                        LEFT JOIN batch_track AS bt ON
                            bt.id = c.batch_track_id
                        LEFT JOIN batches AS bs ON
                            bs.id = c.batch_timing_id
                        LEFT JOIN lead_master AS l ON
                        	l.id = c.lead_id
                        LEFT JOIN technologies AS tg ON
                        	l.primary_course_id = tg.id
                        LEFT JOIN users AS u ON
                        	u.user_id = l.user_id
                        LEFT JOIN trainer_mapping AS map ON
                        	map.customer_id = c.id
                          AND map.is_rejected = 0
                       	LEFT JOIN trainer AS tr ON
                        	tr.id = map.trainer_id
                        LEFT JOIN class_schedule AS cs ON
                          c.class_schedule_id = cs.id
                        WHERE 1 = 1`;

      if (from_date && to_date) {
        getQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
      }

      if (status && status.length > 0) {
        // If status is an array
        if (Array.isArray(status)) {
          const placeholders = status.map(() => "?").join(", "); // "?, ?, ?"
          getQuery += ` AND c.status IN (${placeholders})`;
          queryParams.push(...status); // push all statuses
        } else if (status !== "Others") {
          // If it's a single value
          getQuery += ` AND c.status = ?`;
          queryParams.push(status);
        }
      }

      if (status === "Others") {
        getQuery += ` AND c.status IN ('Partially Closed', 'Discontinued', 'Hold', 'Refund')`;
      }

      if (name) {
        getQuery += ` AND c.name LIKE '%${name}%'`;
      }

      if (email) {
        getQuery += ` AND c.email LIKE '%${email}%'`;
      }

      if (mobile) {
        getQuery += ` AND c.phone LIKE '%${mobile}%'`;
      }

      if (course) {
        getQuery += ` AND tg.name LIKE '%${course}%'`;
      }

      const [result] = await pool.query(getQuery, queryParams);

      let res = await Promise.all(
        result.map(async (item) => {
          const [getPaidAmount] = await pool.query(
            `SELECT 
                COALESCE(pm.total_amount, 0) AS total_amount,
                COALESCE(SUM(pt.amount), 0) AS paid_amount 
            FROM payment_master AS pm 
            LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status = 'Verified'
            WHERE pm.lead_id = ?
            GROUP BY pm.total_amount`,
            [item.lead_id]
          );

          // Now you can safely access the values
          const totalAmount = getPaidAmount[0]?.total_amount || 0;
          const paidAmount = getPaidAmount[0]?.paid_amount || 0;

          const [student_count] = await pool.query(
            `SELECT SUM(CASE WHEN c.class_percentage < 100 THEN 1 ELSE 0 END) AS on_going_student, SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END) AS completed_student_count FROM trainer_mapping AS tm INNER JOIN customers AS c ON tm.customer_id = c.id WHERE tm.trainer_id = ? AND tm.is_rejected = 0`,
            [item.trainer_id]
          );
          return {
            ...item,
            balance_amount: parseFloat((totalAmount - paidAmount).toFixed(2)),
            commercial_percentage: parseFloat(
              ((item.commercial / item.primary_fees) * 100).toFixed(2)
            ),
            payments: await CommonModel.getPaymentHistory(item.lead_id),
            ongoing_student_count: student_count[0]?.on_going_student ?? 0,
            completed_student_count:
              student_count[0]?.completed_student_count ?? 0,
          };
        })
      );

      const [getStatus] = await pool.query(
        `SELECT COUNT(CASE WHEN c.status IN ('Form Pending') THEN 1 END) AS form_pending, COUNT(CASE WHEN c.status IN ('Awaiting Finance') THEN 1 END) AS awaiting_finance, COUNT(CASE WHEN c.status = 'Awaiting Verify' THEN 1 END) AS awaiting_verify, COUNT(CASE WHEN c.status IN ('Awaiting Trainer', 'Trainer Rejected') THEN 1 END) AS awaiting_trainer, COUNT(CASE WHEN c.status = 'Awaiting Trainer Verify' THEN 1 END) AS awaiting_trainer_verify, COUNT(CASE WHEN c.status = 'Awaiting Class' THEN 1 END) AS awaiting_class, COUNT(CASE WHEN c.status = 'Class Going' THEN 1 END) AS class_going, COUNT(CASE WHEN c.status = 'Class Scheduled' THEN 1 END) AS class_scheduled, COUNT(CASE WHEN c.status = 'Passedout process' THEN 1 END) AS passedout_process, COUNT(CASE WHEN c.status = 'Completed' THEN 1 END) AS completed, COUNT(CASE WHEN c.status = 'Escalated' THEN 1 END) AS escalated, COUNT(CASE WHEN c.status IN ('Hold', 'Partially Closed', 'Discontinued', 'Refund') THEN 1 END) AS Others FROM customers AS c WHERE CAST(c.created_date AS DATE) BETWEEN ? AND ?`,
        [from_date, to_date]
      );

      return {
        customers: res,
        customer_status_count: getStatus[0],
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCustomerById: async (customer_id) => {
    try {
      let getQuery = `SELECT
                            c.id,
                            c.lead_id,
                            c.name,
                            c.student_id,
                            c.email,
                            c.phonecode,
                            c.phone,
                            c.whatsapp,
                            c.date_of_birth,
                            c.gender,
                            c.date_of_joining,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN c.enrolled_course ELSE l.primary_course_id END AS enrolled_course,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN t.name ELSE tg.name END AS course_name,
                            l.primary_fees,
                            c.branch_id,
                            b.name AS branch_name,
                            c.batch_track_id,
                            bt.name AS batch_tracking,
                            c.batch_timing_id,
                            bs.name AS batch_timing,
                            c.current_location,
                            c.signature_image,
                            c.profile_image,
                            c.placement_support,
                            c.status,
                            c.is_form_sent,
                            c.is_customer_updated,
                            c.created_date,
                            c.class_start_date,
                            l.user_id AS lead_by_id,
                            u.user_name AS lead_by,
                            tr.name AS trainer_name,
                            tr.mobile AS trainer_mobile,
                            tr.email AS trainer_email,
                            map.id AS training_map_id,
                            map.trainer_id,
                            map.commercial,
                            map.mode_of_class,
                            map.trainer_type,
                            map.proof_communication,
                            map.comments,
                            map.is_verified AS is_trainer_verified,
                            map.verified_date AS trainer_verified_date,
                            map.is_rejected AS is_trainer_rejected,
                            map.rejected_date AS trainer_rejected_date,
                            c.class_schedule_id,
                            cs.name AS class_schedule_name,
                            c.class_scheduled_at,
                            c.class_percentage,
                            c.class_comments,
                            c.class_attachment,
                            c.linkedin_review,
                            c.google_review,
                            c.course_duration,
                            c.course_completion_date,
                            c.review_updated_date,
                            r.name AS region_name,
                            r.id AS region_id
                        FROM
                            customers AS c
                        LEFT JOIN technologies AS t ON
                            c.enrolled_course = t.id
                        LEFT JOIN region AS r ON
                            r.id = c.region_id
                        LEFT JOIN branches AS b ON
                            b.id = c.branch_id
                        LEFT JOIN batch_track AS bt ON
                            bt.id = c.batch_track_id
                        LEFT JOIN batches AS bs ON
                            bs.id = c.batch_timing_id
                        LEFT JOIN lead_master AS l ON
                        	l.id = c.lead_id
                        LEFT JOIN technologies AS tg ON
                        	l.primary_course_id = tg.id
                        LEFT JOIN users AS u ON
                        	u.user_id = l.user_id
                        LEFT JOIN trainer_mapping AS map ON
                        	map.customer_id = c.id
                          AND map.is_rejected = 0
                       	LEFT JOIN trainer AS tr ON
                        	tr.id = map.trainer_id
                        LEFT JOIN class_schedule AS cs ON
                          c.class_schedule_id = cs.id
                        WHERE c.id = ?`;

      const [result] = await pool.query(getQuery, [customer_id]);
      return result[0];
    } catch (error) {
      throw new Error(error.message);
    }
  },

  verifyStudent: async (
    customer_id,
    proof_communication,
    comments,
    is_satisfied
  ) => {
    try {
      const [is_verified_customer] = await pool.query(
        `SELECT id FROM customers WHERE id = ? AND is_customer_verified = 1`,
        [customer_id]
      );
      if (is_verified_customer.length > 0)
        throw new Error("Student has already been verified");
      const updateQuery = `UPDATE customers SET proof_communication = ?, comments = ?, is_satisfied = ?, is_customer_verified = 1 WHERE id = ?`;
      const values = [proof_communication, comments, is_satisfied, customer_id];
      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  trainerAssign: async (
    customer_id,
    trainer_id,
    commercial,
    mode_of_class,
    trainer_type,
    proof_communication,
    comments,
    created_date
  ) => {
    try {
      const [isCusExists] = await pool.query(
        `SELECT id FROM customers WHERE id = ?`,
        [customer_id]
      );
      if (isCusExists.length <= 0) throw new Error("Invalid customer");

      const [isTrainerExists] = await pool.query(
        `SELECT id FROM trainer_mapping WHERE customer_id = ? AND is_rejected = 0`,
        [customer_id]
      );

      if (isTrainerExists.length > 0)
        throw new Error("Trainer has already been assigned this customer");
      const insertQuery = `INSERT INTO trainer_mapping(
                              customer_id,
                              trainer_id,
                              commercial,
                              mode_of_class,
                              trainer_type,
                              proof_communication,
                              comments,
                              created_date
                          )
                          VALUES(?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        customer_id,
        trainer_id,
        commercial,
        mode_of_class,
        trainer_type,
        proof_communication,
        comments,
        created_date,
      ];

      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  verifyTrainer: async (id, verified_date) => {
    try {
      const [result] = await pool.query(
        `UPDATE trainer_mapping SET is_verified = 1, verified_date = ? WHERE id = ?`,
        [verified_date, id]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  rejectTrainer: async (id, rejected_date, comments) => {
    try {
      const [result] = await pool.query(
        `UPDATE trainer_mapping SET is_rejected = 1, comments = ?, rejected_date = ? WHERE id = ?`,
        [comments, rejected_date, id]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateCustomerStatus: async (customer_id, status) => {
    try {
      const [result] = await pool.query(
        `UPDATE customers SET status = ? WHERE id = ?`,
        [status, customer_id]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getClassSchedules: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM class_schedule WHERE is_deleted = 0`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  classSchedule: async (
    customer_id,
    schedule_id,
    class_start_date,
    schedule_at,
    comments
  ) => {
    try {
      const [result] = await pool.query(
        `UPDATE customers SET class_schedule_id = ?, class_start_date = ?, class_scheduled_at = ?, class_comments = ? WHERE id = ?`,
        [schedule_id, class_start_date, schedule_at, comments, customer_id]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateClassGiong: async (
    customer_id,
    schedule_id,
    class_percentage,
    class_comments,
    class_attachment
  ) => {
    try {
      const [result] = await pool.query(
        `UPDATE customers SET class_schedule_id = ?, class_percentage = ?, class_comments = ?, class_attachment = ? WHERE id = ?`,
        [
          schedule_id,
          class_percentage,
          class_comments,
          class_attachment,
          customer_id,
        ]
      );

      const [getTrainer] = await pool.query(
        `SELECT tm.trainer_id FROM trainer_mapping AS tm WHERE tm.customer_id = ? AND tm.is_rejected = 0`,
        [customer_id]
      );

      const [getStudentCount] = await pool.query(
        `SELECT SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END) AS student_count 
          FROM trainer_mapping AS tm 
          INNER JOIN customers AS c ON tm.customer_id = c.id 
          WHERE tm.trainer_id = ?`,
        [getTrainer[0].trainer_id]
      );

      if (getStudentCount[0].student_count === 1) {
        await pool.query(`UPDATE trainer SET is_onboarding = 1 WHERE id = ?`, [
          getTrainer[0].trainer_id,
        ]);
      }

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateReview: async (
    customer_id,
    linkedin_review,
    google_review,
    course_duration,
    course_completed_date,
    review_updated_date
  ) => {
    try {
      const updateQuery = `UPDATE customers SET linkedin_review = ?, google_review = ?, course_duration = ?, course_completion_date = ?, review_updated_date = ? WHERE id = ?`;
      const values = [
        linkedin_review,
        google_review,
        course_duration,
        course_completed_date,
        review_updated_date,
        customer_id,
      ];
      const result = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertCusTrack: async (customer_id, status, status_date, updated_by) => {
    try {
      const insertQuery = `INSERT INTO customer_track(
                              customer_id,
                              status,
                              status_date,
                              updated_by
                          )
                          VALUES(?, ?, ?, ?)`;
      const values = [customer_id, status, status_date, updated_by];
      const [res] = await pool.query(insertQuery, values);
      return res.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = CustomerModel;
