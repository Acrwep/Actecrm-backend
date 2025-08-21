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
                            c.enrolled_course,
                            t.name AS course_name,
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
                            c.created_date
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
                        WHERE 1 = 1`;

      if (from_date && to_date) {
        getQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
      }

      const [result] = await pool.query(getQuery, queryParams);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = CustomerModel;
