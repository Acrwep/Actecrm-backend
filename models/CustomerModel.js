const pool = require("../config/dbconfig");

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
    training_mode,
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
                                training_mode = ?,
                                branch_id = ?,
                                batch_track_id = ?,
                                batch_timing_id = ?,
                                current_location = ?,
                                signature_image = ?,
                                profile_image = ?,
                                placement_support = ?,
                                is_customer_updated = 1
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
        training_mode,
        branch_id,
        batch_track_id,
        batch_timing_id,
        current_location,
        signature_image,
        profile_image,
        palcement_support,
        id,
      ];

      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCustomers: async (from_date, to_date) => {
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
                            c.training_mode AS training_mode_id,
                            tm.name AS training_mode,
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
                            l.user_id AS lead_by_id,
                            u.user_name AS lead_by
                        FROM
                            customers AS c
                        LEFT JOIN technologies AS t ON
                            c.enrolled_course = t.id
                        LEFT JOIN training_mode AS tm ON
                            tm.id = c.training_mode
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
                        WHERE 1 = 1`;

      if (from_date && to_date) {
        getQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
      }

      const [result] = await pool.query(getQuery, queryParams);

      const res = await Promise.all(
        result.map(async (item) => {
          const [getPaidAmount] = await pool.query(
            `SELECT SUM(pt.amount) AS paid_amount FROM payment_master AS pm INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id WHERE pm.lead_id = ?`,
            [item.lead_id]
          );
          return {
            ...item,
            balance_amount: item.primary_fees - getPaidAmount[0].paid_amount,
          };
        })
      );
      return res;
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
                            c.training_mode AS training_mode_id,
                            tm.name AS training_mode,
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
                            l.user_id AS lead_by_id,
                            u.user_name AS lead_by
                        FROM
                            customers AS c
                        LEFT JOIN technologies AS t ON
                            c.enrolled_course = t.id
                        LEFT JOIN training_mode AS tm ON
                            tm.id = c.training_mode
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
                        WHERE c.id = ?`;

      const [result] = await pool.query(getQuery, [customer_id]);
      return result[0];
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = CustomerModel;
