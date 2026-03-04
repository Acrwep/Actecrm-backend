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
    is_customer_updated,
    place_of_supply,
    address,
    state_code,
    gst_number,
  ) => {
    try {
      let affectedRows = 0;
      const [isCusExists] = await pool.query(
        `SELECT id FROM customers WHERE id = ?`,
        [id],
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
                                is_server_required = ?,
                                place_of_supply = ?,
                                address = ?,
                                state_code = ?,
                                gst_number = ?`;
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
        is_server_required,
        place_of_supply,
        address,
        state_code,
        gst_number,
      );

      if (is_customer_updated) {
        updateQuery += ` , is_customer_updated = ?`;
        queryParams.push(is_customer_updated);
      }

      updateQuery += ` WHERE id = ?`;
      queryParams.push(id);

      const [result] = await pool.query(updateQuery, queryParams);
      affectedRows += result.affectedRows;

      if (is_server_required === true || is_server_required === 1) {
        const [isServerExists] = await pool.query(
          `SELECT id FROM server_master WHERE customer_id = ?`,
          [id],
        );
        if (isServerExists.length <= 0) {
          const [insertServer] = await pool.query(
            `INSERT INTO server_master (customer_id, status, created_date) VALUES(?, ?, CURRENT_TIMESTAMP)`,
            [id, "Requested"],
          );
          affectedRows += insertServer.affectedRows;
        }
      }
      return affectedRows;
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
    region,
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const countQueryParams = [];
      const paymentParams = [];
      const rejectedPaymentParams = [];
      const financeParams = [];

      // Get customers query
      let getQuery = `SELECT
                            c.id,
                            ROW_NUMBER() OVER (ORDER BY c.created_date DESC) AS row_num,
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
                            c.payment_date AS last_payment_date,
                            CASE WHEN r.name = 'Hub' THEN 'Online' ELSE 'Offline' END AS invoice_type,
                            IFNULL(c.place_of_supply, '') AS place_of_supply,
                            IFNULL(c.address, '') AS address,
                            IFNULL(c.state_code, '') AS state_code,
                            IFNULL(c.gst_number, '') AS gst_number,
                            r.name AS region_name,
                            r.id AS region_id,
                            cer.customer_name AS cer_customer_name,
                            cer.course_name AS cer_course_name,
                            cer.course_duration AS cer_course_duration,
                            cer.course_completion_month AS cer_course_completion_month,
                            cer.certificate_number,
                            cer.location AS cer_location,
                            payment_next.next_due_date,
							              payment_info.is_second_due AS is_second_due,
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
                        LEFT JOIN (
                          SELECT *
                          FROM (
                            SELECT
                              tm.*,
                              ROW_NUMBER() OVER (PARTITION BY tm.customer_id ORDER BY tm.id DESC) AS rn
                            FROM trainer_mapping tm
                          ) x
                          WHERE rn = 1
                        ) AS map ON map.customer_id = c.id
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
      let getCountQuery = `SELECT COUNT(c.id) AS total_count, COUNT(CASE WHEN c.status IN ('Form Pending') THEN 1 END) AS form_pending, COUNT(CASE WHEN c.status = 'Awaiting Verify' THEN 1 END) AS awaiting_verify, COUNT(CASE WHEN c.status = 'Awaiting Trainer' THEN 1 END) AS awaiting_trainer, COUNT(CASE WHEN c.status = 'Trainer Rejected' THEN 1 END) AS trainer_rejected,COUNT(CASE WHEN c.status = 'Awaiting Trainer Verify' THEN 1 END) AS awaiting_trainer_verify, COUNT(CASE WHEN c.status = 'Awaiting Class' THEN 1 END) AS awaiting_class, COUNT(CASE WHEN c.status = 'Class Going' THEN 1 END) AS class_going, COUNT(CASE WHEN c.status = 'Class Scheduled' THEN 1 END) AS class_scheduled, COUNT(CASE WHEN c.status = 'Passedout process' THEN 1 END) AS passedout_process, COUNT(CASE WHEN c.status = 'Completed' THEN 1 END) AS completed, COUNT(CASE WHEN c.status = 'Escalated' THEN 1 END) AS escalated, COUNT(CASE WHEN c.status IN ('Hold', 'Partially Closed', 'Discontinued', 'Refund', 'Demo Completed', 'Videos Given') THEN 1 END) AS Others FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN region AS r ON r.id = c.region_id LEFT JOIN payment_master AS pm ON c.lead_id = pm.lead_id WHERE 1 = 1`;

      let financeQuery = `SELECT COUNT(CASE WHEN c.status IN ('Awaiting Finance') AND COALESCE(pf.has_verify_pending, 0) = 1 THEN 1 END) AS awaiting_finance FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN region AS r ON r.id = c.region_id LEFT JOIN payment_master AS pm ON c.lead_id = pm.lead_id LEFT JOIN (SELECT pm.lead_id, MAX(pt.payment_status = 'Verify Pending') AS has_verify_pending FROM payment_master pm JOIN payment_trans pt ON pm.id = pt.payment_master_id GROUP BY pm.lead_id) AS pf ON pf.lead_id = c.lead_id WHERE 1 = 1`;

      // Get second due payments count query
      let paymentQuery = `SELECT COUNT(pt.id) AS awaiting_finance FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE pt.is_second_due = 1 AND pt.payment_status = 'Verify Pending'`;

      let rejectedPaymentQuery = `SELECT SUM(CASE WHEN pt.payment_status = 'Rejected' THEN 1 ELSE 0 END) AS payment_rejected FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE 1 = 1`;

      // Handle user_ids parameter for both queries
      if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
        const placeholders = user_ids.map(() => "?").join(", ");
        getQuery += ` AND l.assigned_to IN (${placeholders})`;
        countQuery += ` AND l.assigned_to IN (${placeholders})`;
        getCountQuery += ` AND l.assigned_to IN (${placeholders})`;
        paymentQuery += ` AND l.assigned_to IN (${placeholders})`;
        rejectedPaymentQuery += ` AND l.assigned_to IN (${placeholders})`;
        financeQuery += ` AND l.assigned_to IN (${placeholders})`;
        queryParams.push(...user_ids);
        countQueryParams.push(...user_ids);
        countParams.push(...user_ids);
        paymentParams.push(...user_ids);
        rejectedPaymentParams.push(...user_ids);
        financeParams.push(...user_ids);
      }

      // Add region filter
      if (region) {
        if (region === "Classroom") {
          getQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          countQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          getCountQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          financeQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
        } else if (region === "Online") {
          getQuery += ` AND r.name IN ('Hub')`;
          countQuery += ` AND r.name IN ('Hub')`;
          getCountQuery += ` AND r.name IN ('Hub')`;
          financeQuery += ` AND r.name IN ('Hub')`;
        }
      }

      // Add date range filter
      if (from_date && to_date) {
        getQuery += ` AND CAST(${status === "Awaiting Finance" || status === "Payment Rejected" ? "c.payment_date" : "c.created_date"} AS DATE) BETWEEN ? AND ?`;
        countQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        getCountQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        financeQuery += ` AND CAST(c.payment_date AS DATE) BETWEEN ? AND ?`;
        paymentQuery += ` AND CAST(c.payment_date AS DATE) BETWEEN ? AND ?`;
        rejectedPaymentQuery += ` AND CAST(c.payment_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
        countQueryParams.push(from_date, to_date);
        countParams.push(from_date, to_date);
        paymentParams.push(from_date, to_date);
        rejectedPaymentParams.push(from_date, to_date);
        financeParams.push(from_date, to_date);
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
        getQuery += ` AND c.status IN ('Partially Closed', 'Discontinued', 'Hold', 'Refund', 'Demo Completed', 'Videos Given')`;
        countQuery += ` AND c.status IN ('Partially Closed', 'Discontinued', 'Hold', 'Refund', 'Demo Completed', 'Videos Given')`;
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

      const leadIds = [...new Set(result.map((x) => x.lead_id))];
      const trainerIds = [
        ...new Set(result.map((x) => x.trainer_id).filter(Boolean)),
      ];

      let paidMap = new Map();
      if (leadIds.length > 0) {
        const [paidResult] = await pool.query(
          `SELECT 
          pm.lead_id,
          COALESCE(pm.total_amount,0) total_amount,
          COALESCE(SUM(pt.amount),0) paid_amount
       FROM payment_master pm
       LEFT JOIN payment_trans pt
         ON pm.id = pt.payment_master_id
         AND pt.payment_status IN ('Verified','Verify Pending')
       WHERE pm.lead_id IN (?)
       GROUP BY pm.lead_id, pm.total_amount`,
          [leadIds],
        );

        paidResult.forEach((r) => paidMap.set(r.lead_id, r));
      }

      let studentMap = new Map();
      if (trainerIds.length > 0) {
        const [studentResult] = await pool.query(
          `SELECT 
            tm.trainer_id,
            SUM(CASE WHEN c.class_percentage < 100 THEN 1 ELSE 0 END) AS on_going_student,
            SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END) AS completed_student_count
         FROM trainer_mapping tm
         INNER JOIN customers c ON tm.customer_id = c.id
         WHERE tm.trainer_id IN (?)
         AND tm.is_rejected = 0
         GROUP BY tm.trainer_id`,
          [trainerIds],
        );

        studentResult.forEach((r) => studentMap.set(r.trainer_id, r));
      }

      let paymentMap = new Map();
      if (leadIds.length > 0) {
        const [paymentStatusResult] = await pool.query(
          `SELECT 
              pm.lead_id,
              pt.is_second_due,
              pt.is_last_pay_rejected
          FROM payment_master pm
          JOIN payment_trans pt ON pm.id = pt.payment_master_id
          WHERE pm.lead_id IN (?)
          AND pt.id IN (
              SELECT MAX(id)
              FROM payment_trans
              GROUP BY payment_master_id
          )`,
          [leadIds],
        );
        paymentStatusResult.forEach((r) => paymentMap.set(r.lead_id, r));
      }

      let paymentHistoryMap = new Map();

      if (leadIds.length > 0) {
        const [paymentData] = await pool.query(
          `SELECT 
              pm.id AS master_id,
              pm.lead_id,
              pm.tax_type,
              pm.gst_percentage,
              pm.gst_amount,
              pm.total_amount,
              pm.created_date AS master_created_date,

              pt.id,
              pt.payment_master_id,
              pt.invoice_number,
              pt.invoice_date,
              pt.amount,
              pt.convenience_fees,
              (pt.amount + pt.convenience_fees) AS paid_amount,
              pt.paymode_id,
              pmod.name AS payment_mode,
              pt.payment_screenshot,
              pt.payment_status,
              pt.paid_date,
              pt.verified_date,
              pt.next_due_date,
              pt.is_second_due,
              pt.created_date,
              pt.reason,
              pt.place_of_payment

          FROM payment_master pm
          LEFT JOIN payment_trans pt 
              ON pm.id = pt.payment_master_id
          LEFT JOIN payment_mode pmod
              ON pt.paymode_id = pmod.id
          WHERE pm.lead_id IN (?)
          ORDER BY pm.lead_id, pt.id ASC`,
          [leadIds],
        );

        // Group by lead_id
        const grouped = {};

        paymentData.forEach((row) => {
          if (!grouped[row.lead_id]) {
            grouped[row.lead_id] = {
              id: row.master_id,
              lead_id: row.lead_id,
              tax_type: row.tax_type,
              gst_percentage: row.gst_percentage,
              gst_amount: row.gst_amount,
              total_amount: row.total_amount,
              created_date: row.master_created_date,
              payment_trans: [],
            };
          }

          if (row.id) {
            grouped[row.lead_id].payment_trans.push({
              id: row.id,
              payment_master_id: row.payment_master_id,
              invoice_number: row.invoice_number,
              invoice_date: row.invoice_date,
              amount: row.amount,
              convenience_fees: row.convenience_fees,
              paid_amount: row.paid_amount,
              paymode_id: row.paymode_id,
              payment_mode: row.payment_mode,
              payment_screenshot: row.payment_screenshot,
              payment_status: row.payment_status,
              paid_date: row.paid_date,
              verified_date: row.verified_date,
              next_due_date: row.next_due_date,
              is_second_due: row.is_second_due,
              created_date: row.created_date,
              reason: row.reason,
              place_of_payment: row.place_of_payment,
            });
          }
        });

        // Calculate running balance per lead
        Object.values(grouped).forEach((master) => {
          let runningBalance = master.total_amount;

          master.payment_trans.forEach((item) => {
            runningBalance -= item.amount;
            item.balance_amount = parseFloat(runningBalance).toFixed(2);
          });

          master.payment_trans.reverse(); // Latest first
        });

        paymentHistoryMap = new Map(Object.entries(grouped));
      }

      let res = result.map((item) => {
        const paid = paidMap.get(item.lead_id) || {};
        const student = studentMap.get(item.trainer_id) || {};
        const payment = paymentMap.get(item.lead_id) || {};

        const totalAmount = paid.total_amount || 0;
        const paidAmount = paid.paid_amount || 0;
        // Format customer result
        return {
          ...item,
          balance_amount: parseFloat((totalAmount - paidAmount).toFixed(2)),
          total_amount: totalAmount,
          paid_amount: paidAmount,
          commercial_percentage: item.primary_fees
            ? parseFloat(
              ((item.commercial / item.primary_fees) * 100).toFixed(2),
            )
            : 0,
          // payments: await CommonModel.getPaymentHistory(item.lead_id),
          payments: paymentHistoryMap.get(String(item.lead_id)) || null,
          ongoing_student_count: student.on_going_student ?? 0,
          completed_student_count: student.completed_student_count ?? 0,
          is_second_due: payment.is_second_due ?? 0,
          is_last_pay_rejected: payment.is_last_pay_rejected ?? 0,
        };
      });
      // Fetch customer count by status
      const [getStatus] = await pool.query(getCountQuery, countParams);

      const [financeResult] = await pool.query(financeQuery, financeParams);

      // Fetch customer payment status count
      const [paymentStatus] = await pool.query(paymentQuery, paymentParams);

      const [rejectedPaymentCount] = await pool.query(
        rejectedPaymentQuery,
        rejectedPaymentParams,
      );

      const cusStatusCount = {
        ...getStatus[0],
        awaiting_finance:
          financeResult[0].awaiting_finance + paymentStatus[0].awaiting_finance,
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
      const getQuery = `SELECT
                            c.id,
                            c.lead_id,
                            c.name,
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
                          c.payment_date AS last_payment_date,
                          CASE WHEN r.name = 'Hub' THEN 'Online' ELSE 'Offline' END AS invoice_type,
                          IFNULL(c.place_of_supply, '') AS place_of_supply,
                          IFNULL(c.address, '') AS address,
                          IFNULL(c.state_code, '') AS state_code,
                          IFNULL(c.gst_number, '') AS gst_number,
                          r.name AS region_name,
                          r.id AS region_id,
                          cer.customer_name AS cer_customer_name,
                          cer.course_name AS cer_course_name,
                          cer.course_duration AS cer_course_duration,
                          cer.course_completion_month AS cer_course_completion_month,
                          cer.certificate_number,
                          cer.location AS cer_location,
                          pt.next_due_date,
                          pt1.is_second_due AS is_second_due,
                          pt1.is_last_pay_rejected,
                          pm.total_amount AS total_course_amount,
                          COALESCE(ps.total_paid, 0) AS paid_amount
                        FROM customers AS c
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
                        LEFT JOIN class_schedule AS cs ON
                          c.class_schedule_id = cs.id
                        LEFT JOIN certificates AS cer ON
                          cer.customer_id = c.id
                        LEFT JOIN lead_master AS l ON
                            l.id = c.lead_id
                        LEFT JOIN payment_master AS pm ON
                          pm.lead_id = c.lead_id
                        LEFT JOIN technologies AS tg ON
                            l.primary_course_id = tg.id
                        LEFT JOIN users AS u ON
                            u.user_id = l.user_id
                        LEFT JOIN users AS au ON
                            au.user_id = l.assigned_to
                        LEFT JOIN(
                            SELECT
                                MAX(id) AS trainer_map_id,
                                customer_id
                            FROM trainer_mapping
                            GROUP BY customer_id
                        ) AS latest_map ON
                            latest_map.customer_id = c.id
                        LEFT JOIN trainer_mapping map ON
                            map.id = latest_map.trainer_map_id
                        LEFT JOIN trainer AS tr ON
                            tr.id = map.trainer_id
                        LEFT JOIN users AS tus ON
                            tr.created_by = tus.user_id
                        LEFT JOIN(
                            SELECT
                                payment_master_id,
                                MAX(id) AS latest_trans_id,
                                SUM(amount) AS total_paid
                            FROM payment_trans
                            WHERE
                                payment_status IN('Verified', 'Verify Pending')
                            GROUP BY payment_master_id
                        ) AS ps ON
                            ps.payment_master_id = pm.id
                        LEFT JOIN payment_trans AS pt ON
                            pt.id = ps.latest_trans_id
                        LEFT JOIN(
                            SELECT
                                payment_master_id,
                                MAX(id) AS latest_trans_id
                            FROM payment_trans
                            GROUP BY payment_master_id
                        ) AS ps1 ON
                            ps1.payment_master_id = pm.id
                        LEFT JOIN payment_trans AS pt1 ON
                            pt1.id = ps1.latest_trans_id
                        WHERE c.id = ?`;

      const [result] = await pool.query(getQuery, [customer_id]);

      if (result.length === 0) {
        return null; // Or handle as needed
      }

      const row = result[0];
      const totalAmount = parseFloat(row.total_course_amount || 0);
      const paidAmount = parseFloat(row.paid_amount || 0);

      return {
        ...row,
        total_amount: totalAmount,
        paid_amount: paidAmount,
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
    is_satisfied,
  ) => {
    try {
      const [is_verified_customer] = await pool.query(
        `SELECT id FROM customers WHERE id = ? AND is_customer_verified = 1`,
        [customer_id],
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
    created_date,
  ) => {
    try {
      const [isCusExists] = await pool.query(
        `SELECT id FROM customers WHERE id = ?`,
        [customer_id],
      );
      if (isCusExists.length <= 0) throw new Error("Invalid customer");

      const [isTrainerExists] = await pool.query(
        `SELECT id FROM trainer_mapping WHERE customer_id = ? AND is_rejected = 0`,
        [customer_id],
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
        [verified_date, id],
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
        [comments, rejected_date, id],
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateCustomerStatus: async (customer_ids) => {
    try {
      let affectedRows = 0;

      if (Array.isArray(customer_ids)) {
        for (const customer of customer_ids) {
          if (customer.status && customer.status === "Completed") {
            const [getFeesDetails] = await pool.query(
              `SELECT pm.total_amount, SUM(pt.amount) AS paid_amount, (pm.total_amount - SUM(pt.amount)) AS pending_fees FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status IN ('Verified', 'Verify Pending') WHERE c.id = ? GROUP BY pm.total_amount`,
              [customer.customer_id],
            );

            if (getFeesDetails.length > 0 && getFeesDetails[0].pending_fees > 0)
              throw new Error(
                "The candidate has pending due, Kindly collect the pending fees",
              );
          }
          const [result] = await pool.query(
            `UPDATE customers SET status = ? WHERE id = ?`,
            [customer.status, customer.customer_id],
          );

          affectedRows += result.affectedRows;
        }
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getClassSchedules: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM class_schedule WHERE is_deleted = 0`,
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  classSchedule: async (customers) => {
    try {
      let affectedRows = 0;

      if (Array.isArray(customers)) {
        for (const customer of customers) {
          const [result] = await pool.query(
            `UPDATE customers SET class_schedule_id = ?, class_start_date = ?, class_scheduled_at = ?, class_comments = ? WHERE id = ?`,
            [
              customer.schedule_id,
              customer.class_start_date,
              customer.schedule_at,
              customer.comments,
              customer.customer_id,
            ],
          );

          affectedRows += result.affectedRows;
        }
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateClassGiong: async (customers) => {
    try {
      let affectedRows = 0;

      if (Array.isArray(customers)) {
        for (const customer of customers) {
          const [result] = await pool.query(
            `UPDATE customers SET class_schedule_id = ?, class_percentage = ?, class_comments = ?, class_attachment = ? WHERE id = ?`,
            [
              customer.schedule_id,
              customer.class_percentage,
              customer.class_comments,
              customer.class_attachment,
              customer.customer_id,
            ],
          );

          affectedRows += result.affectedRows;

          const [getTrainer] = await pool.query(
            `SELECT tm.trainer_id FROM trainer_mapping AS tm WHERE tm.customer_id = ? AND tm.is_rejected = 0`,
            [customer.customer_id],
          );

          const [getStudentCount] = await pool.query(
            `SELECT SUM(CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END) AS student_count 
          FROM trainer_mapping AS tm 
          INNER JOIN customers AS c ON tm.customer_id = c.id 
          WHERE tm.trainer_id = ?`,
            [getTrainer[0].trainer_id],
          );

          if (getStudentCount[0].student_count === 1) {
            await pool.query(
              `UPDATE trainer SET is_onboarding = 1 WHERE id = ?`,
              [getTrainer[0].trainer_id],
            );
          }
        }
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateReview: async (customers) => {
    try {
      let affectedRows = 0;

      if (Array.isArray(customers)) {
        for (const customer of customers) {
          const updateQuery = `UPDATE customers SET linkedin_review = ?, google_review = ?, course_duration = ?, course_completion_date = ?, review_updated_date = ? WHERE id = ?`;
          const values = [
            customer.linkedin_review,
            customer.google_review,
            customer.course_duration,
            customer.course_completed_date,
            customer.review_updated_date,
            customer.customer_id,
          ];
          const result = await pool.query(updateQuery, values);

          affectedRows += result.affectedRows;
        }
      }
      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertCusTrack: async (customers) => {
    try {
      let affectedRows = 0;

      if (Array.isArray(customers)) {
        for (const customer of customers) {
          const insertQuery = `INSERT INTO customer_track(
                              customer_id,
                              status,
                              status_date,
                              details,
                              updated_by
                          )
                          VALUES(?, ?, ?, ?, ?)`;
          const values = [
            customer.customer_id,
            customer.status,
            customer.status_date,
            JSON.stringify(customer.details),
            customer.updated_by,
          ];
          const [res] = await pool.query(insertQuery, values);

          affectedRows += res.affectedRows;
        }
      }
      return affectedRows;
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
        [email],
      );

      return result.length > 0 ? true : false;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCustomersV1: async (
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
    region,
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const countQueryParams = [];
      const paymentParams = [];
      const rejectedPaymentParams = [];
      const financeParams = [];

      // Get customers query
      let getQuery = `SELECT
                        c.id,
                        c.lead_id,
                        c.name,
                        c.email,
                        c.phonecode,
                        c.phone,
                        c.date_of_joining,
                        c.is_certificate_generated,
                        CASE WHEN c.enrolled_course IS NOT NULL THEN c.enrolled_course ELSE l.primary_course_id END AS enrolled_course,
                      CASE WHEN c.enrolled_course IS NOT NULL THEN t.name ELSE tg.name END AS course_name,
                      l.primary_fees,
                      c.status,
                      c.is_form_sent,
                      c.is_customer_updated,
                      c.created_date,
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
                      c.linkedin_review,
                      c.google_review,
                      c.payment_date AS last_payment_date,
                      pt.next_due_date,
                      pt1.is_second_due AS is_second_due,
                      pt1.is_last_pay_rejected,
                      COALESCE(ps.total_paid, 0) AS paid_amount,
                      pm.total_amount AS total_course_amount
                    FROM
                        customers AS c
                    LEFT JOIN technologies AS t ON
                        c.enrolled_course = t.id
                    LEFT JOIN region AS r ON
                        r.id = c.region_id
                    LEFT JOIN lead_master AS l ON
                        l.id = c.lead_id
                    LEFT JOIN payment_master AS pm ON
                      pm.lead_id = c.lead_id
                    LEFT JOIN technologies AS tg ON
                        l.primary_course_id = tg.id
                    LEFT JOIN users AS au ON
                        au.user_id = l.assigned_to
                    LEFT JOIN(
                      SELECT MAX(id) AS trainer_map_id, customer_id FROM trainer_mapping
                        GROUP BY customer_id
                    ) AS latest_map ON latest_map.customer_id = c.id
                    LEFT JOIN trainer_mapping map ON
                      map.id = latest_map.trainer_map_id
                    LEFT JOIN trainer AS tr ON
                        tr.id = map.trainer_id
                    LEFT JOIN users AS tus ON
                        tr.created_by = tus.user_id
                    LEFT JOIN(
                      SELECT 
                          payment_master_id,
                          MAX(id) AS latest_trans_id,
                          SUM(amount) AS total_paid
                        FROM payment_trans
                        WHERE payment_status IN ('Verified', 'Verify Pending')
                        GROUP BY payment_master_id
                    ) AS ps ON ps.payment_master_id = pm.id
                    LEFT JOIN payment_trans AS pt ON
                      pt.id = ps.latest_trans_id
                    LEFT JOIN(
                      SELECT 
                          payment_master_id,
                          MAX(id) AS latest_trans_id
                        FROM payment_trans
                        GROUP BY payment_master_id
                    ) AS ps1 ON ps1.payment_master_id = pm.id
                    LEFT JOIN payment_trans AS pt1 ON
                      pt1.id = ps1.latest_trans_id
                    WHERE 1 = 1`;

      // Get pagination count query
      let countQuery = `SELECT
                            COUNT(DISTINCT c.id) AS total
                        FROM
                            customers AS c
                        LEFT JOIN lead_master AS l ON
                            l.id = c.lead_id
                        LEFT JOIN payment_master AS pm ON
                            pm.lead_id = c.lead_id
                        LEFT JOIN technologies AS tg ON
                            l.primary_course_id = tg.id
                        LEFT JOIN region AS r ON
                            r.id = c.region_id
                        LEFT JOIN(
                          SELECT 
                              payment_master_id,
                              MAX(id) AS latest_trans_id,
                              SUM(amount) AS total_paid
                            FROM payment_trans
                            WHERE payment_status IN ('Verified', 'Verify Pending')
                            GROUP BY payment_master_id
                        ) AS ps ON ps.payment_master_id = pm.id
                        LEFT JOIN payment_trans AS pt ON
                          pt.id = ps.latest_trans_id
                        LEFT JOIN(
                          SELECT 
                              payment_master_id,
                              MAX(id) AS latest_trans_id
                            FROM payment_trans
                            GROUP BY payment_master_id
                        ) AS ps1 ON ps1.payment_master_id = pm.id
                        LEFT JOIN payment_trans AS pt1 ON
                          pt1.id = ps1.latest_trans_id
                        WHERE 1 = 1`;

      // All your existing count queries remain unchanged
      let getCountQuery = `SELECT COUNT(c.id) AS total_count, COUNT(CASE WHEN c.status IN ('Form Pending') THEN 1 END) AS form_pending, COUNT(CASE WHEN c.status = 'Awaiting Verify' THEN 1 END) AS awaiting_verify, COUNT(CASE WHEN c.status = 'Awaiting Trainer' THEN 1 END) AS awaiting_trainer, COUNT(CASE WHEN c.status = 'Trainer Rejected' THEN 1 END) AS trainer_rejected,COUNT(CASE WHEN c.status = 'Awaiting Trainer Verify' THEN 1 END) AS awaiting_trainer_verify, COUNT(CASE WHEN c.status = 'Awaiting Class' THEN 1 END) AS awaiting_class, COUNT(CASE WHEN c.status = 'Class Going' THEN 1 END) AS class_going, COUNT(CASE WHEN c.status = 'Class Scheduled' THEN 1 END) AS class_scheduled, COUNT(CASE WHEN c.status = 'Passedout process' THEN 1 END) AS passedout_process, COUNT(CASE WHEN c.status = 'Completed' THEN 1 END) AS completed, COUNT(CASE WHEN c.status = 'Escalated' THEN 1 END) AS escalated, COUNT(CASE WHEN c.status IN ('Hold', 'Partially Closed', 'Discontinued', 'Refund', 'Demo Completed', 'Videos Given') THEN 1 END) AS Others FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN region AS r ON r.id = c.region_id LEFT JOIN payment_master AS pm ON c.lead_id = pm.lead_id WHERE 1 = 1`;

      let financeQuery = `SELECT COUNT(CASE WHEN c.status IN ('Awaiting Finance') AND COALESCE(pf.has_verify_pending, 0) = 1 THEN 1 END) AS awaiting_finance FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN region AS r ON r.id = c.region_id LEFT JOIN payment_master AS pm ON c.lead_id = pm.lead_id LEFT JOIN (SELECT pm.lead_id, MAX(pt.payment_status = 'Verify Pending') AS has_verify_pending FROM payment_master pm JOIN payment_trans pt ON pm.id = pt.payment_master_id GROUP BY pm.lead_id) AS pf ON pf.lead_id = c.lead_id WHERE 1 = 1`;

      // Get second due payments count query
      let paymentQuery = `SELECT COUNT(pt.id) AS awaiting_finance FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE pt.is_second_due = 1 AND pt.payment_status = 'Verify Pending'`;

      let rejectedPaymentQuery = `SELECT SUM(CASE WHEN pt.payment_status = 'Rejected' THEN 1 ELSE 0 END) AS payment_rejected FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE 1 = 1`;

      // Handle user_ids parameter for both queries
      if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
        const placeholders = user_ids.map(() => "?").join(", ");
        getQuery += ` AND l.assigned_to IN (${placeholders})`;
        countQuery += ` AND l.assigned_to IN (${placeholders})`;
        getCountQuery += ` AND l.assigned_to IN (${placeholders})`;
        paymentQuery += ` AND l.assigned_to IN (${placeholders})`;
        rejectedPaymentQuery += ` AND l.assigned_to IN (${placeholders})`;
        financeQuery += ` AND l.assigned_to IN (${placeholders})`;
        queryParams.push(...user_ids);
        countQueryParams.push(...user_ids);
        countParams.push(...user_ids);
        paymentParams.push(...user_ids);
        rejectedPaymentParams.push(...user_ids);
        financeParams.push(...user_ids);
      }

      // Add region filter
      if (region) {
        if (region === "Classroom") {
          getQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          countQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          getCountQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
          financeQuery += ` AND r.name IN ('Chennai', 'Bangalore')`;
        } else if (region === "Online") {
          getQuery += ` AND r.name IN ('Hub')`;
          countQuery += ` AND r.name IN ('Hub')`;
          getCountQuery += ` AND r.name IN ('Hub')`;
          financeQuery += ` AND r.name IN ('Hub')`;
        }
      }

      // Add date range filter
      if (from_date && to_date) {
        getQuery += ` AND CAST(${status === "Awaiting Finance" || status === "Payment Rejected" ? "c.payment_date" : "c.created_date"} AS DATE) BETWEEN ? AND ?`;
        countQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        getCountQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        financeQuery += ` AND CAST(c.payment_date AS DATE) BETWEEN ? AND ?`;
        paymentQuery += ` AND CAST(c.payment_date AS DATE) BETWEEN ? AND ?`;
        rejectedPaymentQuery += ` AND CAST(c.payment_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
        countQueryParams.push(from_date, to_date);
        countParams.push(from_date, to_date);
        paymentParams.push(from_date, to_date);
        rejectedPaymentParams.push(from_date, to_date);
        financeParams.push(from_date, to_date);
      }

      // Add status filter
      if (status && status.length > 0) {
        if (status === "Awaiting Finance") {
          // Special handling for Awaiting Finance status
          getQuery += ` AND (c.status = ? OR pt1.is_second_due = 1) AND pt1.is_last_pay_rejected = 0`;
          countQuery += ` AND (c.status = ? OR pt1.is_second_due = 1) AND pt1.is_last_pay_rejected = 0`;
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
        getQuery += ` AND pt1.is_last_pay_rejected = 1`;
        countQuery += ` AND pt1.is_last_pay_rejected = 1`;
      }

      // Add status filter for others
      if (status === "Others") {
        getQuery += ` AND c.status IN ('Partially Closed', 'Discontinued', 'Hold', 'Refund', 'Demo Completed', 'Videos Given')`;
        countQuery += ` AND c.status IN ('Partially Closed', 'Discontinued', 'Hold', 'Refund', 'Demo Completed', 'Videos Given')`;
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

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      // Add pagination to main query
      getQuery += ` ORDER BY c.created_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      // Fetch all required data concurrently
      const [
        [countResult],
        [result],
        [getStatus],
        [financeResult],
        [paymentStatus],
        [rejectedPaymentCount],
      ] = await Promise.all([
        pool.query(countQuery, countQueryParams),
        pool.query(getQuery, queryParams),
        pool.query(getCountQuery, countParams),
        pool.query(financeQuery, financeParams),
        pool.query(paymentQuery, paymentParams),
        pool.query(rejectedPaymentQuery, rejectedPaymentParams),
      ]);

      // Get total count
      const total = countResult[0]?.total || 0;

      let res = result.map((item) => {
        const totalAmount = parseFloat(item.total_course_amount || 0);
        const paidAmount = parseFloat(item.paid_amount || 0);
        // Format customer result
        return {
          ...item,
          balance_amount: parseFloat((totalAmount - paidAmount).toFixed(2)),
          total_amount: totalAmount,
          paid_amount: paidAmount,
          commercial_percentage: item.primary_fees
            ? parseFloat(
              ((item.commercial / item.primary_fees) * 100).toFixed(2),
            )
            : 0,
        };
      });
      // Fetch customer count by status
      const cusStatusCount = {
        ...getStatus[0],
        awaiting_finance:
          financeResult[0].awaiting_finance + paymentStatus[0].awaiting_finance,
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
};

module.exports = CustomerModel;
