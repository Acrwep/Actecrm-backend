const pool = require("../config/dbconfig");
const CommonModel = require("../models/CommonModel");

const CustomerModel = {
  updateCustomer: async (
    name,
    email,
    phonecode,
    phone,
    whatsapp_phone_code,
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
    placement_support,
    id,
    country,
    state,
    area,
    is_server_required,
    is_customer_updated
  ) => {
    try {
      const [isCusExists] = await pool.query(
        `SELECT id FROM customers WHERE id = ?`,
        [id]
      );
      if (isCusExists.length <= 0) throw new Error("Invalid customer");

      const queryParams = [];
      let updateQuery = `UPDATE
                                customers
                            SET
                                name = ?,
                                email = ?,
                                phonecode = ?,
                                phone = ?,
                                whatsapp_phone_code = ?,
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
                                region_id = ?,
                                country = ?,
                                state = ?,
                                current_location = ?,
                                is_server_required = ?`;
      queryParams.push(
        name,
        email,
        phonecode,
        phone,
        whatsapp_phone_code,
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
        placement_support,
        region_id,
        country,
        state,
        area,
        is_server_required
      );

      if (is_customer_updated) {
        updateQuery += ` , is_customer_updated = ?`;
        queryParams.push(is_customer_updated);
      }

      updateQuery += ` WHERE id = ?`;
      queryParams.push(id);

      const [result] = await pool.query(updateQuery, queryParams);
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
    course,
    user_ids,
    page,
    limit,
    region
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const countQueryParams = [];
      const paymentParams = [];
      const rejectedPaymentParams = [];

      // Get customers query
      let getQuery = `SELECT
                            c.id,
                            c.lead_id,
                            c.name,
                            c.student_id,
                            c.email,
                            c.phonecode,
                            c.phone,
                            c.whatsapp_phone_code,
                            c.whatsapp,
                            c.date_of_birth,
                            c.gender,
                            c.date_of_joining,
                            c.is_certificate_generated,
                            c.is_server_required,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN c.enrolled_course ELSE l.primary_course_id END AS enrolled_course,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN t.name ELSE tg.name END AS course_name,
                            l.primary_fees,
                            c.branch_id,
                            b.name AS branch_name,
                            c.batch_track_id,
                            bt.name AS batch_tracking,
                            c.batch_timing_id,
                            bs.name AS batch_timing,
                            CASE WHEN c.country IS NOT NULL THEN c.country ELSE l.country END AS country,
                            CASE WHEN c.state IS NOT NULL THEN c.state ELSE l.state END AS state,
                            CASE WHEN c.current_location IS NOT NULL THEN c.current_location ELSE l.district END AS current_location,
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
                            l.assigned_to AS lead_assigned_to_id,
                            au.user_name AS lead_assigned_to_name,
                            tr.name AS trainer_name,
                            tr.trainer_id AS trainer_code,
                            tr.mobile_phone_code AS trainer_mobile_code,
                            tr.mobile AS trainer_mobile,
                            tr.email AS trainer_email,
                            tr.overall_exp_year,
                            tus.user_id AS trainer_hr_id,
                            tus.user_name AS trainer_hr_name,
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
                            r.id AS region_id,
                            cer.customer_name AS cer_customer_name,
                            cer.course_name AS cer_course_name,
                            cer.course_duration AS cer_course_duration,
                            cer.course_completion_month AS cer_course_completion_month,
                            cer.certificate_number,
                            cer.location AS cer_location,
                            payment_next.next_due_date,
							              payment_info.is_second_due AS has_second_due,
                            payment_rejected.is_last_pay_rejected
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
                        LEFT JOIN users AS au ON
                          au.user_id = l.assigned_to
                        LEFT JOIN trainer_mapping AS map ON
                        	map.customer_id = c.id
                          AND map.is_rejected = 0
                       	LEFT JOIN trainer AS tr ON
                        	tr.id = map.trainer_id
                        LEFT JOIN users AS tus ON
                          tr.created_by = tus.user_id
                        LEFT JOIN class_schedule AS cs ON
                          c.class_schedule_id = cs.id
                        LEFT JOIN certificates AS cer ON
                          cer.customer_id = c.id
                        LEFT JOIN (
                          SELECT lead_id, next_due_date
                          FROM (
                            SELECT pm.lead_id,
                                   p2.next_due_date,
                                   ROW_NUMBER() OVER (PARTITION BY pm.lead_id ORDER BY p2.id DESC) AS rn
                            FROM payment_trans p2
                            JOIN payment_master pm ON p2.payment_master_id = pm.id
                            WHERE p2.payment_status IN ('Verified', 'Verify Pending')
                          ) q
                          WHERE rn = 1
                        ) AS payment_next ON payment_next.lead_id = c.lead_id
                        LEFT JOIN (
                          SELECT lead_id, is_second_due
                          FROM (
                            SELECT pm.lead_id,
                                   p2.is_second_due,
                                   ROW_NUMBER() OVER (PARTITION BY pm.lead_id ORDER BY p2.id DESC) AS rn
                            FROM payment_trans p2
                            JOIN payment_master pm ON p2.payment_master_id = pm.id
                          ) q
                          WHERE rn = 1
                        ) AS payment_info ON payment_info.lead_id = c.lead_id
                        LEFT JOIN (
                          SELECT lead_id, is_last_pay_rejected
                          FROM (
                            SELECT pm.lead_id,
                                   p2.is_last_pay_rejected,
                                   ROW_NUMBER() OVER (PARTITION BY pm.lead_id ORDER BY p2.id DESC) AS rn
                            FROM payment_trans p2
                            JOIN payment_master pm ON p2.payment_master_id = pm.id
                          ) q
                          WHERE rn = 1
                        ) AS payment_rejected ON payment_rejected.lead_id = c.lead_id
                        WHERE 1 = 1`;

      // Get pagination count query
      let countQuery = `SELECT COUNT(DISTINCT c.id) as total
                        FROM customers AS c
                        LEFT JOIN lead_master AS l ON l.id = c.lead_id
                        LEFT JOIN technologies AS tg ON l.primary_course_id = tg.id
                        LEFT JOIN region AS r ON r.id = c.region_id
                        LEFT JOIN (
                          SELECT lead_id, next_due_date
                          FROM (
                            SELECT pm.lead_id,
                                   p2.next_due_date,
                                   ROW_NUMBER() OVER (PARTITION BY pm.lead_id ORDER BY p2.id DESC) AS rn
                            FROM payment_trans p2
                            JOIN payment_master pm ON p2.payment_master_id = pm.id
                            WHERE p2.payment_status IN ('Verified', 'Verify Pending')
                          ) q
                          WHERE rn = 1
                        ) AS payment_next ON payment_next.lead_id = c.lead_id
                        LEFT JOIN (
                          SELECT lead_id, is_second_due
                          FROM (
                            SELECT pm.lead_id,
                                   p2.is_second_due,
                                   ROW_NUMBER() OVER (PARTITION BY pm.lead_id ORDER BY p2.id DESC) AS rn
                            FROM payment_trans p2
                            JOIN payment_master pm ON p2.payment_master_id = pm.id
                          ) q
                          WHERE rn = 1
                        ) AS payment_info ON payment_info.lead_id = c.lead_id
                        LEFT JOIN (
                          SELECT lead_id, is_last_pay_rejected
                          FROM (
                            SELECT pm.lead_id,
                                   p2.is_last_pay_rejected,
                                   ROW_NUMBER() OVER (PARTITION BY pm.lead_id ORDER BY p2.id DESC) AS rn
                            FROM payment_trans p2
                            JOIN payment_master pm ON p2.payment_master_id = pm.id
                          ) q
                          WHERE rn = 1
                        ) AS payment_rejected ON payment_rejected.lead_id = c.lead_id
                        WHERE 1 = 1`;

      // All your existing count queries remain unchanged
      let getCountQuery = `SELECT COUNT(c.id) AS total_count, COUNT(CASE WHEN c.status IN ('Form Pending') THEN 1 END) AS form_pending, COUNT(CASE WHEN c.status IN ('Awaiting Finance') AND pt.payment_status = 'Verify Pending' THEN 1 END) AS awaiting_finance, COUNT(CASE WHEN c.status = 'Awaiting Verify' THEN 1 END) AS awaiting_verify, COUNT(CASE WHEN c.status IN ('Awaiting Trainer', 'Trainer Rejected') THEN 1 END) AS awaiting_trainer, COUNT(CASE WHEN c.status = 'Awaiting Trainer Verify' THEN 1 END) AS awaiting_trainer_verify, COUNT(CASE WHEN c.status = 'Awaiting Class' THEN 1 END) AS awaiting_class, COUNT(CASE WHEN c.status = 'Class Going' THEN 1 END) AS class_going, COUNT(CASE WHEN c.status = 'Class Scheduled' THEN 1 END) AS class_scheduled, COUNT(CASE WHEN c.status = 'Passedout process' THEN 1 END) AS passedout_process, COUNT(CASE WHEN c.status = 'Completed' THEN 1 END) AS completed, COUNT(CASE WHEN c.status = 'Escalated' THEN 1 END) AS escalated, COUNT(CASE WHEN c.status IN ('Hold', 'Partially Closed', 'Discontinued', 'Refund', 'Demo Completed') THEN 1 END) AS Others FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN region AS r ON r.id = c.region_id LEFT JOIN payment_master AS pm ON c.lead_id = pm.lead_id LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id WHERE 1 = 1`;

      // Get second due payments count query
      let paymentQuery = `SELECT COUNT(pt.id) AS awaiting_finance FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE pt.is_second_due = 1 AND pt.payment_status = 'Verify Pending'`;

      let rejectedPaymentQuery = `SELECT SUM(CASE WHEN pt.payment_status = 'Rejected' THEN 1 ELSE 0 END) AS payment_rejected FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE 1 = 1`;

      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          countQuery += ` AND l.assigned_to IN (${placeholders})`;
          getCountQuery += ` AND l.assigned_to IN (${placeholders})`;
          paymentQuery += ` AND l.assigned_to IN (${placeholders})`;
          rejectedPaymentQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
          countQueryParams.push(...user_ids);
          countParams.push(...user_ids);
          paymentParams.push(...user_ids);
          rejectedPaymentParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND l.assigned_to = ?`;
          countQuery += ` AND l.assigned_to = ?`;
          getCountQuery += ` AND l.assigned_to = ?`;
          paymentQuery += ` AND l.assigned_to = ?`;
          rejectedPaymentQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
          countQueryParams.push(user_ids);
          countParams.push(user_ids);
          paymentParams.push(user_ids);
          rejectedPaymentParams.push(user_ids);
        }
      }

      // Add region filter
      if (region) {
        if (region === "Classroom") {
          getQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          countQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          getCountQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
        } else if (region === "Online") {
          getQuery += ` AND r.name IN ('Hub')`;
          countQuery += ` AND r.name IN ('Hub')`;
          getCountQuery += ` AND r.name IN ('Hub')`;
        }
      }

      // Add date range filter
      if (from_date && to_date) {
        getQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        countQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        getCountQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        paymentQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        rejectedPaymentQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
        countQueryParams.push(from_date, to_date);
        countParams.push(from_date, to_date);
        paymentParams.push(from_date, to_date);
        rejectedPaymentParams.push(from_date, to_date);
      }

      // Add status filter
      if (status && status.length > 0) {
        if (status === "Awaiting Finance") {
          // Special handling for Awaiting Finance status
          getQuery += ` AND (c.status = ? OR payment_info.is_second_due = 1) AND payment_rejected.is_last_pay_rejected = 0`;
          countQuery += ` AND (c.status = ? OR payment_info.is_second_due = 1) AND payment_rejected.is_last_pay_rejected = 0`;
          queryParams.push(status);
          countQueryParams.push(status);
        } else if (Array.isArray(status)) {
          const placeholders = status.map(() => "?").join(", ");
          getQuery += ` AND c.status IN (${placeholders})`;
          countQuery += ` AND c.status IN (${placeholders})`;
          queryParams.push(...status);
          countQueryParams.push(...status);
        } else if (status !== "Others" && status !== "Payment Rejected") {
          getQuery += ` AND c.status = ?`;
          countQuery += ` AND c.status = ?`;
          queryParams.push(status);
          countQueryParams.push(status);
        }
      }

      if (status === "Payment Rejected") {
        getQuery += ` AND payment_rejected.is_last_pay_rejected = 1`;
        countQuery += ` AND payment_rejected.is_last_pay_rejected = 1`;
      }

      // Add status filter for others
      if (status === "Others") {
        getQuery += ` AND c.status IN ('Partially Closed', 'Discontinued', 'Hold', 'Refund', 'Demo Completed')`;
        countQuery += ` AND c.status IN ('Partially Closed', 'Discontinued', 'Hold', 'Refund', 'Demo Completed')`;
      }

      // Add name filter
      if (name) {
        getQuery += ` AND c.name LIKE '%${name}%'`;
        countQuery += ` AND c.name LIKE '%${name}%'`;
      }

      // Add email filter
      if (email) {
        getQuery += ` AND c.email LIKE '%${email}%'`;
        countQuery += ` AND c.email LIKE '%${email}%'`;
      }

      // Add mobile number filter
      if (mobile) {
        getQuery += ` AND c.phone LIKE '%${mobile}%'`;
        countQuery += ` AND c.phone LIKE '%${mobile}%'`;
      }

      // Add course filter
      if (course) {
        getQuery += ` AND tg.name LIKE '%${course}%'`;
        countQuery += ` AND tg.name LIKE '%${course}%'`;
      }

      // Get total count
      const [countResult] = await pool.query(countQuery, countQueryParams);
      const total = countResult[0]?.total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      // Add pagination to main query
      getQuery += ` ORDER BY c.created_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      // Fetch customers
      const [result] = await pool.query(getQuery, queryParams);

      let res = await Promise.all(
        result.map(async (item) => {
          // Get total paid amount for specific customer
          const [getPaidAmount] = await pool.query(
            `SELECT 
                COALESCE(pm.total_amount, 0) AS total_amount,
                COALESCE(SUM(pt.amount), 0) AS paid_amount 
            FROM payment_master AS pm 
            LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status IN ('Verified', 'Verify Pending')
            WHERE pm.lead_id = ?
            GROUP BY pm.total_amount`,
            [item.lead_id]
          );

          // Now you can safely access the values
          const totalAmount = getPaidAmount[0]?.total_amount || 0;
          const paidAmount = getPaidAmount[0]?.paid_amount || 0;

          // Get on-going and completed student count by trainer
          const [student_count] = await pool.query(
            `SELECT SUM(CASE WHEN c.class_percentage < 100 THEN 1 ELSE 0 END) AS on_going_student, SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END) AS completed_student_count FROM trainer_mapping AS tm INNER JOIN customers AS c ON tm.customer_id = c.id WHERE tm.trainer_id = ? AND tm.is_rejected = 0`,
            [item.trainer_id]
          );

          const [getIsSecond] = await pool.query(
            `SELECT pt.is_second_due, pt.is_last_pay_rejected FROM payment_master AS pm INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id WHERE pm.lead_id = ? ORDER BY pt.id DESC LIMIT 1`,
            item.lead_id
          );

          // Format customer result
          return {
            ...item,
            balance_amount: parseFloat((totalAmount - paidAmount).toFixed(2)),
            total_amount: totalAmount,
            paid_amount: paidAmount,
            commercial_percentage: parseFloat(
              ((item.commercial / item.primary_fees) * 100).toFixed(2)
            ),
            payments: await CommonModel.getPaymentHistory(item.lead_id),
            ongoing_student_count: student_count[0]?.on_going_student ?? 0,
            completed_student_count:
              student_count[0]?.completed_student_count ?? 0,
            is_second_due: getIsSecond[0].is_second_due,
            is_last_pay_rejected: getIsSecond[0].is_last_pay_rejected,
          };
        })
      );

      // Fetch customer count by status
      const [getStatus] = await pool.query(getCountQuery, countParams);

      // Fetch customer payment status count
      const [paymentStatus] = await pool.query(paymentQuery, paymentParams);

      const [rejectedPaymentCount] = await pool.query(
        rejectedPaymentQuery,
        rejectedPaymentParams
      );

      const cusStatusCount = {
        ...getStatus[0],
        awaiting_finance:
          getStatus[0].awaiting_finance + paymentStatus[0].awaiting_finance,
        rejected_payment: rejectedPaymentCount[0]?.payment_rejected ?? 0,
      };

      // Return customer result
      return {
        customers: res,
        customer_status_count: cusStatusCount,
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
                            c.whatsapp_phone_code,
                            c.whatsapp,
                            c.date_of_birth,
                            c.gender,
                            c.date_of_joining,
                            c.is_certificate_generated,
                            c.is_server_required,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN c.enrolled_course ELSE l.primary_course_id END AS enrolled_course,
                            CASE WHEN c.enrolled_course IS NOT NULL THEN t.name ELSE tg.name END AS course_name,
                            l.primary_fees,
                            c.branch_id,
                            b.name AS branch_name,
                            c.batch_track_id,
                            bt.name AS batch_tracking,
                            c.batch_timing_id,
                            bs.name AS batch_timing,
                            CASE WHEN c.country IS NOT NULL THEN c.country ELSE l.country END AS country,
                            CASE WHEN c.state IS NOT NULL THEN c.state ELSE l.state END AS state,
                            CASE WHEN c.current_location IS NOT NULL THEN c.current_location ELSE l.district END AS current_location,
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
                            l.assigned_to AS lead_assigned_to_id,
                            au.user_name AS lead_assigned_to_name,
                            tr.name AS trainer_name,
                            tr.trainer_id AS trainer_code,
                            tr.mobile_phone_code AS trainer_mobile_code,
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
                            r.id AS region_id,
                            cer.customer_name AS cer_customer_name,
                            cer.course_name AS cer_course_name,
                            cer.course_duration AS cer_course_duration,
                            cer.course_completion_month AS cer_course_completion_month,
                            cer.certificate_number,
                            cer.location AS cer_location
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
                        LEFT JOIN users AS au ON
                          au.user_id = l.assigned_to
                        LEFT JOIN trainer_mapping AS map ON
                        	map.customer_id = c.id
                          AND map.is_rejected = 0
                       	LEFT JOIN trainer AS tr ON
                        	tr.id = map.trainer_id
                        LEFT JOIN class_schedule AS cs ON
                          c.class_schedule_id = cs.id
                        LEFT JOIN certificates AS cer ON
                          cer.customer_id = c.id
                        WHERE c.id = ?`;

      const [result] = await pool.query(getQuery, [customer_id]);

      const [getPaidAmount] = await pool.query(
        `SELECT 
                COALESCE(pm.total_amount, 0) AS total_amount,
                COALESCE(SUM(pt.amount), 0) AS paid_amount 
            FROM payment_master AS pm 
            LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status IN ('Verified', 'Verify Pending')
            WHERE pm.lead_id = ?
            GROUP BY pm.total_amount`,
        [result[0].lead_id]
      );

      // Now you can safely access the values
      const totalAmount = getPaidAmount[0]?.total_amount || 0;
      const paidAmount = getPaidAmount[0]?.paid_amount || 0;

      return {
        ...result[0],
        balance_amount: parseFloat((totalAmount - paidAmount).toFixed(2)),
      };
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
      let affectedRows = 0;
      if (status && status === "Completed") {
        const [getFeesDetails] = await pool.query(
          `SELECT pm.total_amount, SUM(pt.amount) AS paid_amount, (pm.total_amount - SUM(pt.amount)) AS pending_fees FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status IN ('Verified', 'Verify Pending') WHERE c.id = ?`,
          [customer_id]
        );

        if (getFeesDetails.length > 0 && getFeesDetails[0].pending_fees > 0)
          throw new Error(
            "The candidate has pending due, Kindly collect the pending fees"
          );
      }
      const [result] = await pool.query(
        `UPDATE customers SET status = ? WHERE id = ?`,
        [status, customer_id]
      );

      affectedRows += result.affectedRows;

      return affectedRows;
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

  insertCusTrack: async (
    customer_id,
    status,
    status_date,
    updated_by,
    details
  ) => {
    try {
      const insertQuery = `INSERT INTO customer_track(
                              customer_id,
                              status,
                              status_date,
                              details,
                              updated_by
                          )
                          VALUES(?, ?, ?, ?, ?)`;
      const values = [
        customer_id,
        status,
        status_date,
        JSON.stringify(details),
        updated_by,
      ];
      const [res] = await pool.query(insertQuery, values);
      return res.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCustomerHistory: async (customer_id) => {
    try {
      const sql = `SELECT
                      ct.id,
                      ct.customer_id,
                      c.name AS customer_name,
                      ct.status,
                      ct.status_date,
                      ct.details,
                      ct.updated_by AS updated_by_id,
                      u.user_name AS updated_by
                  FROM
                      customer_track AS ct
                  INNER JOIN customers AS c ON
                    c.id = ct.customer_id
                  INNER JOIN users AS u ON
                    ct.updated_by = u.user_id
                  WHERE
                      ct.customer_id = ?
                  ORDER BY ct.id ASC`;
      const [result] = await pool.query(sql, [customer_id]);

      const formattedResult = result.map((item) => {
        return {
          ...item,
          details: JSON.parse(item.details),
        };
      });
      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  checkIsCustomerReg: async (email) => {
    try {
      const [result] = await pool.query(
        `SELECT id FROM customers WHERE email = ?`,
        [email]
      );

      return result.length > 0 ? true : false;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = CustomerModel;
