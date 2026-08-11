const pool = require("../config/dbconfig");
const CommonModel = require("../models/CommonModel");

const PaymentModel = {
  getPaymentModes: async () => {
    try {
      const [paymodes] = await pool.query(
        `SELECT id, name FROM payment_mode WHERE is_active = 1`,
      );
      return paymodes;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  createPayment: async (
    lead_id,
    invoice_date,
    tax_type,
    gst_percentage,
    gst_amount,
    total_amount,
    convenience_fees,
    paymode_id,
    paid_amount,
    payment_screenshot,
    payment_status,
    created_date,
    next_due_date,
    paid_date,
    updated_by,
    batch_timing_id,
    placement_support,
    batch_track_id,
    enrolled_course,
    is_server_required,
    place_of_payment,
    place_of_supply,
    address,
    state_code,
    gst_number,
    ra_id,
    date_of_joining,
    place_of_service,
    place_of_branch,
  ) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const paymentMasterQuery = `INSERT INTO payment_master(
                              lead_id,
                              tax_type,
                              gst_percentage,
                              gst_amount,
                              total_amount,
                              created_date
                          )
                          VALUES(?, ?, ?, ?, ?, ?)`;
      const masterValues = [
        lead_id,
        tax_type,
        gst_percentage,
        gst_amount,
        total_amount,
        created_date,
      ];

      const [masterInsert] = await connection.query(
        paymentMasterQuery,
        masterValues,
      );
      if (masterInsert.affectedRows <= 0)
        throw new Error("Error while making payment");

      const [getUserId] = await connection.query(
        `SELECT id, user_id FROM users WHERE user_id = ?`,
        [updated_by],
      );

      const invoiceNo = generateInvoiceNumber();

      const paymentTransQuery = `INSERT INTO payment_trans(
                                      payment_master_id,
                                      invoice_number,
                                      invoice_date,
                                      amount,
                                      convenience_fees,
                                      paymode_id,
                                      payment_screenshot,
                                      payment_status,
                                      next_due_date,
                                      created_date,
                                      paid_date,
                                      collected_by,
                                      place_of_payment
                                  )
                                  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const transValues = [
        masterInsert.insertId,
        invoiceNo,
        invoice_date,
        paid_amount,
        convenience_fees,
        paymode_id,
        payment_screenshot,
        payment_status,
        next_due_date,
        created_date,
        paid_date,
        getUserId[0].id,
        place_of_payment,
      ];

      const [transInsert] = await connection.query(
        paymentTransQuery,
        transValues,
      );

      if (transInsert.affectedRows <= 0) throw new Error("Error");

      const [getCustomer] = await connection.query(
        `SELECT id, name, phone_code, phone, whatsapp_phone_code, whatsapp, email, region_id, branch_id, country, state, district FROM lead_master WHERE id = ?`,
        [lead_id],
      );

      const now = new Date();
      const year = String(now.getFullYear()).slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const prefix = `STD${year}${month}`;

      const [latestCustomer] = await connection.query(
        `SELECT student_id FROM customers WHERE student_id LIKE ? ORDER BY LENGTH(student_id) DESC, student_id DESC LIMIT 1 FOR UPDATE`,
        [`${prefix}%`],
      );

      let sequence = 1;
      if (latestCustomer.length > 0) {
        const latestStudentId = latestCustomer[0].student_id;
        const seqStr = latestStudentId.substring(prefix.length);
        const parsedSeq = parseInt(seqStr, 10);
        if (!isNaN(parsedSeq)) {
          sequence = parsedSeq + 1;
        }
      }

      const studentId = `${prefix}${String(sequence).padStart(3, "0")}`;

      const customerQuery = `INSERT INTO customers (lead_id, student_id, name, email, phonecode, phone, whatsapp_phone_code, whatsapp, status, created_date, region_id, branch_id, batch_timing_id, placement_support, enrolled_course, batch_track_id, is_server_required, country, state, current_location, place_of_supply, address, state_code, gst_number, payment_date, date_of_joining, place_of_service, place_of_branch) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const customerValues = [
        lead_id,
        studentId,
        getCustomer[0].name,
        getCustomer[0].email,
        getCustomer[0].phone_code,
        getCustomer[0].phone,
        getCustomer[0].whatsapp_phone_code,
        getCustomer[0].whatsapp,
        "Form Pending",
        created_date,
        getCustomer[0].region_id,
        getCustomer[0].branch_id,
        batch_timing_id,
        placement_support,
        enrolled_course,
        batch_track_id,
        is_server_required,
        getCustomer[0].country,
        getCustomer[0].state,
        getCustomer[0].district,
        place_of_supply,
        address,
        state_code,
        gst_number,
        created_date,
        invoice_date,
        place_of_service,
        place_of_branch,
      ];

      const [insertCustomer] = await connection.query(
        customerQuery,
        customerValues,
      );

      if (is_server_required === true) {
        const [insertServer] = await connection.query(
          `INSERT INTO server_master (customer_id, status, created_date) VALUES(?, ?, ?)`,
          [insertCustomer.insertId, "Requested", created_date],
        );

        await connection.query(
          `INSERT INTO server_track(server_id, status, status_date, updated_by) VALUES(?, ?, ?, ?)`,
          [insertServer.insertId, "Requested", created_date, updated_by],
        );
      }

      const statuses = [
        ["Customer created", created_date, updated_by],
        ["Down Payment", created_date, updated_by],
        ["Awaiting Finance", created_date, updated_by],
      ];

      const values = statuses.map((s) => [insertCustomer.insertId, ...s]);
      await connection.query(
        `INSERT INTO customer_track (
            customer_id,
            status,
            status_date,
            updated_by
        )
        VALUES ?`, // 👈 VALUES ? is the right syntax for bulk insert
        [values],
      );

      const [historyResult] = await connection.query(
        `INSERT INTO customer_status_history(customer_id, status, updated_at, updated_by) VALUES(?, ?, ?, ?)`,
        [insertCustomer.insertId, "Form Pending", created_date, updated_by],
      );

      await connection.query(
        `UPDATE customers SET latest_status_history_id = ? WHERE id = ?`,
        [historyResult.insertId, insertCustomer.insertId],
      );

      if (ra_id) {
        await connection.query(
          `UPDATE lead_master SET ra_id = ? WHERE id = ?`,
          [ra_id, lead_id],
        );
      }

      await connection.query(
        `INSERT INTO lead_track(lead_id, lead_status, status_date, updated_by) VALUES(?, ?, ?, ?)`,
        [lead_id, "Lead converted to customer", created_date, updated_by],
      );

      const [getInvoiceDetails] = await connection.query(
        `SELECT pm.tax_type, pm.gst_percentage, pm.gst_amount, pm.total_amount, pt.convenience_fees, pt.invoice_number, pt.invoice_date, pt.amount AS paid_amount, pt.paid_date, (pm.total_amount - pt.amount) AS balance_amount, p.name AS payment_mode, pt.payment_screenshot FROM payment_master AS pm INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id INNER JOIN payment_mode AS p ON pt.paymode_id = p.id WHERE pt.id = ?`,
        [transInsert.insertId],
      );

      const [getCourse] = await connection.query(
        `SELECT lm.primary_course_id AS course_id, t.name AS course_name, lm.primary_fees FROM lead_master AS lm INNER JOIN technologies AS t ON lm.primary_course_id = t.id WHERE lm.id = ?`,
        [lead_id],
      );

      await connection.commit();

      return {
        insertId: insertCustomer.insertId,
        email: getCustomer[0].email,
        name: getCustomer[0].name,
        phone_code: getCustomer[0].phone_code,
        phone: getCustomer[0].phone,
        invoice_details: getInvoiceDetails[0],
        course: getCourse[0],
      };
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  verifyPayment: async (payment_trans_id, verified_date) => {
    try {
      const [result] = await pool.query(
        `UPDATE payment_trans SET payment_status = 'Verified', verified_date = ?, is_second_due = 0 WHERE id = ?`,
        [verified_date, payment_trans_id],
      );

      const [master_id] = await pool.query(
        `SELECT payment_master_id FROM payment_trans WHERE id = ?`,
        [payment_trans_id],
      );

      const [getBalance] = await pool.query(
        `SELECT
              pm.total_amount,
              SUM(pt.amount) AS paid_amount
          FROM
              payment_master AS pm
          INNER JOIN payment_trans AS pt ON
              pm.id = pt.payment_master_id AND pt.payment_status = 'Verified'
          WHERE pm.id = ?
          GROUP BY pm.total_amount`,
        [master_id[0].payment_master_id],
      );

      const balance_amount =
        getBalance[0].total_amount - getBalance[0].paid_amount;

      const is_fully_paid = balance_amount === 0 ? true : false;
      return {
        is_fully_paid,
        balance_amount,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  pendingFeesList: async (
    from_date,
    to_date,
    name,
    mobile,
    email,
    course,
    urgent_due,
    user_ids,
    page,
    limit,
  ) => {
    try {
      const queryParams = [];
      let getQuery = `
                        SELECT
                            c.id,
                            ROW_NUMBER() OVER (ORDER BY payment_summary.next_due_date ASC) AS row_num,
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
                            c.enrolled_course,
                            t.name AS course_name,
                            c.branch_id,
                            b.name AS branch_name,
                            c.batch_track_id,
                            bt.name AS batch_tracking,
                            c.batch_timing_id,
                            bs.name AS batch_timing,
                            CASE WHEN c.country IS NOT NULL THEN c.country ELSE lm.country END AS country,
                            CASE WHEN c.state IS NOT NULL THEN c.state ELSE lm.state END AS state,
                            CASE WHEN c.current_location IS NOT NULL THEN c.current_location ELSE lm.district END AS current_location,
                            c.signature_image,
                            c.profile_image,
                            c.placement_support,
                            c.status,
                            c.is_form_sent,
                            c.is_customer_updated,
                            c.is_server_required,
                            c.class_start_date,
                            c.created_date,
                            lm.user_id AS lead_by_id,
                            u.user_name AS lead_by,
                            lm.assigned_to AS lead_assigned_to_id,
                            au.user_name AS lead_assigned_to_name,
                            tr.name AS trainer_name,
                            tr.mobile AS trainer_mobile,
                            tr.email AS trainer_email,
                            tm.id AS trainer_map_id,
                            tm.trainer_id,
                            tm.commercial,
                            tm.mode_of_class,
                            tm.trainer_type,
                            tm.proof_communication,
                            tm.comments,
                            tm.is_verified AS is_trainer_verified,
                            tm.verified_date AS trainer_verified_date,
                            tm.is_rejected AS is_trainer_rejected,
                            tm.rejected_date AS trainer_rejected_date,
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
                            pm.id AS payment_master_id,
                            pm.tax_type,
                            pm.gst_percentage,
                            pm.gst_amount,
                            lm.primary_fees AS course_fees,
                            pm.total_amount,
                            payment_summary.paid_amount,
                            payment_summary.balance_amount,
                            IFNULL(payment_summary.next_due_date, '') AS next_due_date,
                            IFNULL(payment_summary.is_second_due, 0) AS is_second_due,
                            IFNULL(payment_summary.is_last_pay_rejected, 0) AS is_last_pay_rejected
                        FROM
                            customers AS c
                        LEFT JOIN payment_master AS pm 
                            ON pm.lead_id = c.lead_id
                        LEFT JOIN branches AS b 
                            ON b.id = c.branch_id
                        LEFT JOIN batch_track AS bt 
                            ON bt.id = c.batch_track_id
                        LEFT JOIN batches AS bs 
                            ON bs.id = c.batch_timing_id
                        LEFT JOIN lead_master AS lm 
                            ON c.lead_id = lm.id
                        LEFT JOIN users AS u 
                            ON lm.user_id = u.user_id
                        LEFT JOIN users AS au ON
                          au.user_id = lm.assigned_to
                        LEFT JOIN technologies AS t 
                            ON c.enrolled_course = t.id
                        LEFT JOIN trainer_mapping AS tm 
                            ON c.id = tm.customer_id AND tm.is_rejected = 0
                        LEFT JOIN trainer AS tr 
                            ON tm.trainer_id = tr.id
                        LEFT JOIN class_schedule AS cs 
                            ON cs.id = c.class_schedule_id
                        LEFT JOIN region AS r 
                            ON r.id = c.region_id
                        INNER JOIN (
                            SELECT 
                                pt.payment_master_id,
                                SUM(pt.amount) AS paid_amount,
                                (pm.total_amount - SUM(pt.amount)) AS balance_amount,
                                (
                                    SELECT p2.next_due_date
                                    FROM payment_trans p2
                                    WHERE p2.payment_master_id = pm.id
                                      AND p2.payment_status IN ('Verified', 'Verify Pending')
                                    ORDER BY p2.id DESC
                                    LIMIT 1
                                ) AS next_due_date,
                                (
                                  SELECT p2.is_second_due
                                  FROM payment_trans p2
                                  WHERE p2.payment_master_id = pt.payment_master_id
                                  ORDER BY p2.id DESC
                                  LIMIT 1
                                ) AS is_second_due,
                                (
                                  SELECT p2.is_last_pay_rejected
                                  FROM payment_trans p2
                                  WHERE p2.payment_master_id = pt.payment_master_id
                                  ORDER BY p2.id DESC
                                  LIMIT 1
                                ) AS is_last_pay_rejected
                            FROM payment_trans AS pt
                            INNER JOIN payment_master AS pm 
                                ON pt.payment_master_id = pm.id
                            WHERE pt.payment_status IN ('Verified', 'Verify Pending')
                            GROUP BY pt.payment_master_id, pm.total_amount
                        ) AS payment_summary 
                            ON payment_summary.payment_master_id = pm.id
                        WHERE payment_summary.balance_amount > 0 AND c.status <> 'Demo Completed'
                      `;

      const countQueryParams = [];
      let countQuery = `
                        SELECT COUNT(DISTINCT c.id) as total, SUM(payment_summary.balance_amount) as overall_balance
                        FROM customers AS c
                        INNER JOIN payment_master AS pm 
                            ON pm.lead_id = c.lead_id
                        INNER JOIN lead_master AS lm 
                            ON c.lead_id = lm.id
                        LEFT JOIN technologies AS t 
                            ON c.enrolled_course = t.id
                        INNER JOIN (
                            SELECT 
                                pt.payment_master_id,
                                SUM(pt.amount) AS paid_amount,
                                (pm.total_amount - SUM(pt.amount)) AS balance_amount,
                                (
                                    SELECT p2.next_due_date
                                    FROM payment_trans p2
                                    WHERE p2.payment_master_id = pm.id
                                      AND p2.payment_status IN ('Verified', 'Verify Pending')
                                    ORDER BY p2.id DESC
                                    LIMIT 1
                                ) AS next_due_date
                            FROM payment_trans AS pt
                            INNER JOIN payment_master AS pm 
                                ON pt.payment_master_id = pm.id
                            WHERE pt.payment_status IN ('Verified', 'Verify Pending')
                            GROUP BY pt.payment_master_id, pm.total_amount
                        ) AS payment_summary 
                            ON payment_summary.payment_master_id = pm.id
                        WHERE payment_summary.balance_amount > 0 AND c.status <> 'Demo Completed'
                      `;

      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND lm.assigned_to IN (${placeholders})`;
          countQuery += ` AND lm.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
          countQueryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND lm.assigned_to = ?`;
          countQuery += ` AND lm.assigned_to = ?`;
          queryParams.push(user_ids);
          countQueryParams.push(user_ids);
        }
      }

      // Date filter for both queries
      if (from_date && to_date) {
        getQuery += ` AND CAST(payment_summary.next_due_date AS DATE) BETWEEN ? AND ?`;
        countQuery += ` AND CAST(payment_summary.next_due_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
        countQueryParams.push(from_date, to_date);
      }

      // Urgent due condition for both queries
      if (urgent_due === "Urgent Due") {
        getQuery += ` AND c.class_percentage >= 30`;
        countQuery += ` AND c.class_percentage >= 30`;
      }

      // Name filter for both queries
      if (name) {
        getQuery += ` AND c.name LIKE ?`;
        countQuery += ` AND c.name LIKE ?`;
        queryParams.push(`%${name}%`);
        countQueryParams.push(`%${name}%`);
      }

      // Email filter for both queries
      if (email) {
        getQuery += ` AND c.email LIKE ?`;
        countQuery += ` AND c.email LIKE ?`;
        queryParams.push(`%${email}%`);
        countQueryParams.push(`%${email}%`);
      }

      // Mobile filter for both queries
      if (mobile) {
        getQuery += ` AND c.phone LIKE ?`;
        countQuery += ` AND c.phone LIKE ?`;
        queryParams.push(`%${mobile}%`);
        countQueryParams.push(`%${mobile}%`);
      }

      // Course filter for both queries
      if (course) {
        getQuery += ` AND t.name LIKE ?`;
        countQuery += ` AND t.name LIKE ?`;
        queryParams.push(`%${course}%`);
        countQueryParams.push(`%${course}%`);
      }

      // Get total count
      const [countResult] = await pool.query(countQuery, countQueryParams);
      const total = countResult[0]?.total || 0;
      const overall_balance = countResult[0]?.overall_balance || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      // Add pagination to main query
      getQuery += ` ORDER BY payment_summary.next_due_date ASC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      // Run main query
      const [result] = await pool.query(getQuery, queryParams);

      const leadIds = [...new Set(result.map((x) => x.lead_id))];

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

      // Add payment history (original functionality preserved)
      const formattedResult = result.map((item) => {
        return {
          ...item,
          // payment: await CommonModel.getPaymentHistory(item.lead_id),
          payment: paymentHistoryMap.get(String(item.lead_id)) || null,
        };
      });

      return {
        data: formattedResult,
        pagination: {
          total: parseInt(total),
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
          overall_balance: parseFloat(overall_balance).toFixed(2),
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  pendingFeesListV1: async (
    from_date,
    to_date,
    search_filter,
    urgent_due,
    user_ids,
    page,
    limit,
    region_id,
    branch_id,
  ) => {
    try {
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      const baseConditions = [];
      const queryParams = [];

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          baseConditions.push(`lm.assigned_to IN (${placeholders})`);
          queryParams.push(...user_ids);
        } else {
          baseConditions.push(`lm.assigned_to = ?`);
          queryParams.push(user_ids);
        }
      }

      if (urgent_due === "Urgent Due") {
        baseConditions.push(`c.class_percentage >= 30`);
      }

      const searchConditions = [];
      if (search_filter) {
        searchConditions.push(
          `(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR t.name LIKE ?)`,
        );
        queryParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
      }

      if (region_id) {
        baseConditions.push(`r.id = ?`);
        queryParams.push(region_id);
      }

      if (branch_id) {
        baseConditions.push(`b.id = ?`);
        queryParams.push(branch_id);
      }

      const allConditions = [
        ...baseConditions,
        ...searchConditions,
        "c.status <> 'Demo Completed'",
      ];

      const summarySubquery = `
        SELECT 
          pt.payment_master_id,
          SUM(pt.amount) AS total_paid,
          MAX(pt.id) as latest_trans_id
        FROM payment_trans pt
        WHERE pt.payment_status IN ('Verified', 'Verify Pending')
        GROUP BY pt.payment_master_id
      `;

      const nextDueSubquery = `
        SELECT 
          pt2.id,
          pt2.next_due_date,
          pt2.is_second_due,
          pt2.is_last_pay_rejected
        FROM payment_trans pt2
      `;

      // Mandatory Filter for Pending Fees
      allConditions.push("(pm.total_amount - ps.total_paid) > 0");

      if (from_date && to_date) {
        allConditions.push(
          `pt_latest.next_due_date >= ? AND pt_latest.next_due_date < DATE_ADD(?, INTERVAL 1 DAY)`,
        );
        queryParams.push(`${from_date}`, `${to_date}`);
      }

      const whereClause =
        allConditions.length > 0 ? ` WHERE ${allConditions.join(" AND ")}` : "";

      const baseFromSql = ` 
        FROM customers AS c
        INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id
        INNER JOIN lead_master AS lm ON c.lead_id = lm.id
        LEFT JOIN technologies AS t ON c.enrolled_course = t.id
        LEFT JOIN (${summarySubquery}) AS ps ON ps.payment_master_id = pm.id
        LEFT JOIN (
                        SELECT payment_master_id,
                        MAX(id) AS latest_trans_id,
                        SUM(amount) AS paid_amount,
                        MIN(invoice_date) AS first_payment_date,
                        MAX(invoice_date) AS last_payment_date,
                        COUNT(id) AS installment_count
                        FROM payment_trans
                        WHERE payment_status <> 'Rejected'
                        GROUP BY payment_master_id
                      ) AS latest ON latest.payment_master_id = pm.id
        LEFT JOIN (${nextDueSubquery}) AS pt_latest ON pt_latest.id = latest.latest_trans_id
        LEFT JOIN class_mode AS cm ON cm.id = c.place_of_service
        LEFT JOIN users AS au ON au.user_id = lm.assigned_to
        LEFT JOIN trainer_mapping AS tm ON tm.customer_id = c.id AND tm.is_rejected = 0
        LEFT JOIN trainer AS tr ON tr.id = tm.trainer_id
        LEFT JOIN branches AS b ON b.id = au.branch_id
        LEFT JOIN region AS r ON r.id = b.region_id
      `;

      // Count Query
      const countQuery = `SELECT COUNT(DISTINCT c.id) as total, SUM(pm.total_amount - ps.total_paid) as overall_balance ${baseFromSql} ${whereClause}`;
      const [countResult] = await pool.query(countQuery, queryParams);
      const total = countResult[0]?.total || 0;
      const overall_balance = countResult[0]?.overall_balance || 0;

      // Bucket Query
      const bucketQuery = `
        SELECT 
          SUM(CASE WHEN lm.assigned_to LIKE '%CHN%' THEN 1 ELSE 0 END) AS chennai,
          SUM(CASE WHEN lm.assigned_to LIKE '%BNG%' THEN 1 ELSE 0 END) AS bangalore,
          SUM(CASE WHEN lm.assigned_to LIKE '%HUB%' THEN 1 ELSE 0 END) AS hub
        ${baseFromSql}
        ${whereClause}
      `;
      const [bucketData] = await pool.query(bucketQuery, queryParams);

      // Data Query
      let getQuery = `
        SELECT
          c.id, c.lead_id, c.student_id, c.name, c.email, c.phonecode, c.phone, c.date_of_joining,
          c.enrolled_course, t.name AS course_name, c.status, c.created_date,
          lm.assigned_to AS lead_assigned_to_id, c.is_customer_updated, 
          au.user_name AS lead_assigned_to_name,
          tr.name AS trainer_name, tr.mobile AS trainer_mobile, tr.email AS trainer_email,
          c.class_percentage,
          pm.id AS payment_master_id, pm.total_amount AS course_fees,
          ps.total_paid AS paid_amount,
          b.name AS branch_name,
          r.name AS region_name,
          cm.name AS place_of_service,
          (pm.total_amount - ps.total_paid) AS balance_amount,
          IFNULL(pt_latest.next_due_date, '') AS next_due_date,
          IFNULL(pt_latest.is_second_due, 0) AS is_second_due,
          IFNULL(pt_latest.is_last_pay_rejected, 0) AS is_last_pay_rejected,
          DATEDIFF(
                            CASE
                              WHEN IFNULL(latest.paid_amount, 0) >= pm.total_amount
                                THEN latest.last_payment_date
                              ELSE CURDATE()
                            END,
                            latest.first_payment_date
                          ) AS total_days_taken,
                          latest.first_payment_date,
                          CASE
                            WHEN IFNULL(latest.paid_amount, 0) >= pm.total_amount
                              THEN latest.last_payment_date
                            ELSE CURDATE()
                          END AS end_date
        ${baseFromSql}
        ${whereClause}
        ORDER BY pt_latest.next_due_date DESC`;

      if (page && limit) {
        getQuery += ` LIMIT ? OFFSET ?`;
        queryParams.push(limitNumber, offset);
      }

      const [result] = await pool.query(getQuery, queryParams);

      return {
        data: result,
        pagination: {
          total: parseInt(total),
          page: page ? pageNumber : null,
          limit: limit ? limitNumber : null,
          totalPages: page && limit ? Math.ceil(total / limitNumber) : null,
          overall_balance: parseFloat(overall_balance).toFixed(2),
        },
        bucketData: {
          chennai: parseInt(bucketData[0]?.chennai || 0),
          bangalore: parseInt(bucketData[0]?.bangalore || 0),
          hub: parseInt(bucketData[0]?.hub || 0),
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getPendingFeesCount: async (from_date, to_date, user_ids) => {
    try {
      let userCondition = "";
      const queryParams = [];

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          userCondition = ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else if (user_ids) {
          userCondition = ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
        }
      }

      let dateFilterOverall = "(1=1)";
      let dateFilterUrgent = "(1=1)";
      const dParamsOverall = [];
      const dParamsUrgent = [];

      // if (from_date && to_date) {
      //   dateFilterOverall = "CAST(ps.next_due_date AS DATE) BETWEEN ? AND ?";
      //   dateFilterUrgent = "CAST(ps.next_due_date AS DATE) BETWEEN ? AND ?";
      //   dParamsOverall.push(from_date, to_date);
      //   dParamsUrgent.push(from_date, to_date);
      // }

      const sql = `
        SELECT 
            COUNT(DISTINCT CASE 
                WHEN (pm.total_amount - ps_agg.total_paid) > 0 
                AND (${dateFilterOverall})
                THEN pm.lead_id 
            END) AS overall_count,

            COUNT(DISTINCT CASE 
                WHEN (pm.total_amount - ps_agg.total_paid) > 0 
                AND CAST(ps.next_due_date AS DATE) = CURRENT_DATE
                THEN pm.lead_id 
            END) AS today_count,

            COUNT(DISTINCT CASE 
                WHEN (pm.total_amount - ps_agg.total_paid) > 0 
                AND c.class_percentage >= 30
                AND (${dateFilterUrgent})
                THEN c.id 
            END) AS urgent_due_count
        FROM payment_master pm
        INNER JOIN lead_master l ON l.id = pm.lead_id
        LEFT JOIN customers c ON c.lead_id = pm.lead_id
        INNER JOIN (
            SELECT 
                pt.payment_master_id,
                SUM(pt.amount) AS total_paid,
                MAX(pt.id) as latest_id
            FROM payment_trans pt
            WHERE pt.payment_status IN ('Verified', 'Verify Pending')
            GROUP BY pt.payment_master_id
        ) ps_agg ON ps_agg.payment_master_id = pm.id
        INNER JOIN payment_trans ps ON ps.id = ps_agg.latest_id
        WHERE 1=1 ${userCondition}
      `;

      const finalParams = [...dParamsOverall, ...dParamsUrgent, ...queryParams];

      const [result] = await pool.query(sql, finalParams);

      return {
        today_count: result[0].today_count || 0,
        overall_count: result[0].overall_count || 0,
        urgent_due_count: result[0].urgent_due_count || 0,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  partPayment: async (
    payment_master_id,
    invoice_date,
    paid_amount,
    convenience_fees,
    paymode_id,
    payment_screenshot,
    payment_status,
    next_due_date,
    created_date,
    paid_date,
    place_of_payment,
    collected_by,
  ) => {
    try {
      // Check whether the previous payment is still pending stage
      const [isPaymentCheck] = await pool.query(
        `SELECT COUNT(id) AS pending_count FROM payment_trans WHERE payment_status IN ('Verify Pending', 'Rejected') AND payment_master_id = ?`,
        [payment_master_id],
      );
      if (isPaymentCheck[0].pending_count > 0)
        throw new Error("Kindly verify the previous payment");

      const [getPendingFees] = await pool.query(
        `SELECT pm.total_amount, SUM(pt.amount) AS paid_amount, (pm.total_amount - SUM(pt.amount)) AS balance_amount FROM payment_master AS pm INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id WHERE pt.payment_status IN ('Verified', 'Verify Pending') AND pm.id = ?`,
        [payment_master_id],
      );

      if (parseFloat(paid_amount) > getPendingFees[0].balance_amount)
        throw new Error("Amount should be equal to or less then pending fees");

      const [getUserId] = await pool.query(
        `SELECT id, user_id FROM users WHERE user_id = ?`,
        [collected_by],
      );

      const invoiceNo = generateInvoiceNumber();
      const paymentTransQuery = `INSERT INTO payment_trans(
                                      payment_master_id,
                                      invoice_number,
                                      invoice_date,
                                      amount,
                                      convenience_fees,
                                      paymode_id,
                                      payment_screenshot,
                                      payment_status,
                                      next_due_date,
                                      created_date,
                                      paid_date,
                                      is_second_due,
                                      collected_by,
                                      place_of_payment
                                  )
                                  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`;
      const transValues = [
        payment_master_id,
        invoiceNo,
        invoice_date,
        paid_amount,
        convenience_fees,
        paymode_id,
        payment_screenshot,
        payment_status,
        next_due_date,
        created_date,
        paid_date,
        getUserId[0].id,
        place_of_payment,
      ];

      const [transInsert] = await pool.query(paymentTransQuery, transValues);

      const [getCustomer] = await pool.query(
        `SELECT c.id FROM payment_master AS pm INNER JOIN customers AS c ON c.lead_id = pm.lead_id WHERE pm.id = ?`,
        [payment_master_id],
      );

      await pool.query(`UPDATE customers SET payment_date = ? WHERE id = ?`, [
        created_date,
        getCustomer[0].id,
      ]);

      const [historyResult] = await pool.query(
        `INSERT INTO customer_status_history (customer_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?)`,
        [getCustomer[0].id, "Part Payment", created_date, collected_by],
      );

      await pool.query(
        `UPDATE customers SET latest_status_history_id = ? WHERE id = ?`,
        [historyResult.insertId, getCustomer[0].id],
      );

      return transInsert.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  paymentReject: async (
    payment_trans_id,
    rejected_date,
    reason,
    updated_by,
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM payment_trans WHERE id = ?`,
        [payment_trans_id],
      );
      if (isIdExists.length <= 0) throw new Error("Invalid payment Id");
      const [result] = await pool.query(
        `UPDATE payment_trans SET payment_status = 'Rejected', rejected_date = ?, reason = ?, is_second_due = 0, is_last_pay_rejected = 1 WHERE id = ?`,
        [rejected_date, reason, payment_trans_id],
      );

      const [getCus] = await pool.query(
        `SELECT c.id FROM payment_trans AS pt INNER JOIN payment_master AS pm ON pt.payment_master_id = pm.id INNER JOIN customers AS c ON c.lead_id = pm.lead_id WHERE pt.id = ? GROUP BY c.id`,
        [payment_trans_id],
      );

      const [historyResult] = await pool.query(
        `INSERT INTO customer_status_history (customer_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?)`,
        [getCus[0].id, "Payment Rejected", rejected_date, updated_by],
      );

      await pool.query(
        `UPDATE customers SET latest_status_history_id = ? WHERE id = ?`,
        [historyResult.insertId, getCus[0].id],
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updatePayment: async (
    invoice_date,
    amount,
    convenience_fees,
    paymode_id,
    payment_screenshot,
    paid_date,
    next_due_date,
    payment_trans_id,
    place_of_payment,
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT payment_master_id FROM payment_trans WHERE id = ?`,
        [payment_trans_id],
      );
      if (isIdExists.length <= 0) throw new Error("Invalid Id");
      const [getCount] = await pool.query(
        `SELECT COUNT(id) AS payment_count FROM payment_trans WHERE payment_master_id = ?`,
        [isIdExists[0].payment_master_id],
      );
      let sql = `UPDATE
                      payment_trans
                  SET
                      invoice_date = ?,
                      amount = ?,
                      convenience_fees = ?,
                      paymode_id = ?,
                      payment_screenshot = ?,
                      payment_status = "Verify Pending",
                      paid_date = ?,
                      next_due_date = ?,
                      place_of_payment = ?,
                      is_last_pay_rejected = 0`;

      sql +=
        getCount[0].payment_count > 1
          ? `, is_second_due = 1`
          : `, is_second_due = 0`;

      sql += ` WHERE id = ?`;

      const values = [
        invoice_date,
        amount,
        convenience_fees,
        paymode_id,
        payment_screenshot,
        paid_date,
        next_due_date,
        place_of_payment,
        payment_trans_id,
      ];

      // Update payment details
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updatePaymentMaster: async (
    tax_type,
    gst_percentage,
    gst_amount,
    discount_amount,
    total_amount,
    payment_master_id,
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id, lead_id FROM payment_master WHERE id = ?`,
        [payment_master_id],
      );
      if (isIdExists.length <= 0) throw new Error("Invalid Id");

      const [paidAmount] = await pool.query(
        `SELECT SUM(amount) AS paid_amount FROM payment_trans WHERE payment_master_id = ? AND payment_status NOT IN ('Rejected')`,
        [payment_master_id],
      );

      if (parseFloat(total_amount) < parseFloat(paidAmount[0].paid_amount))
        throw new Error("Total amount cannot be less than paid amout!");
      const sql = `UPDATE
                      payment_master
                  SET
                      tax_type = ?,
                      gst_percentage = ?,
                      gst_amount = ?,
                      discount_amount = ?,
                      total_amount = ?
                  WHERE
                      id = ?`;
      const values = [
        tax_type,
        gst_percentage,
        gst_amount,
        discount_amount,
        total_amount,
        payment_master_id,
      ];

      const [result] = await pool.query(sql, values);

      if (discount_amount <= 0) {
        let course_fees = total_amount - gst_amount;

        await pool.query(
          `UPDATE lead_master SET primary_fees = ? WHERE id = ?`,
          [course_fees, isIdExists[0].lead_id],
        );
      }

      let balanceAmount = 0;
      balanceAmount = total_amount - paidAmount[0].paid_amount;
      if (balanceAmount === 0) {
        const [latestTrans] = await pool.query(
          `SELECT id FROM payment_trans WHERE payment_master_id = ? ORDER BY id DESC LIMIT 1`,
          [payment_master_id],
        );
        await pool.query(
          `UPDATE payment_trans SET next_due_date = ? WHERE id = ?`,
          [null, latestTrans[0].id],
        );
      }
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  recievedList: async (
    start_date,
    end_date,
    search_filter,
    page,
    limit,
    user_ids,
    payment_type,
    region_id,
    branch_id,
  ) => {
    try {
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      const queryParams = [];
      const countParams = [];
      const paymentParams = [];
      let baseConditions = `pt.payment_status IN ('Rejected', 'Verify Pending')`;
      let paymentCondition = ``;

      if (start_date && end_date) {
        baseConditions += ` AND pt.invoice_date >= ? AND pt.invoice_date < DATE_ADD(?, INTERVAL 1 DAY)`;
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        paymentParams.push(start_date, end_date);
      }

      if (search_filter) {
        baseConditions += ` AND (c.name LIKE ? OR c.phone LIKE ? OR t.name LIKE ? OR c.email LIKE ?)`;
        const searchStr = `%${search_filter}%`;
        queryParams.push(searchStr, searchStr, searchStr, searchStr);
        countParams.push(searchStr, searchStr, searchStr, searchStr);
        paymentParams.push(searchStr, searchStr, searchStr, searchStr);
      }

      if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
        const placeholders = user_ids.map(() => "?").join(", ");
        const userFilter = ` AND l.assigned_to IN (${placeholders})`;
        baseConditions += userFilter;

        queryParams.push(...user_ids);
        countParams.push(...user_ids);
        paymentParams.push(...user_ids);
      }

      if (region_id) {
        baseConditions += ` AND r.id = ?`;
        queryParams.push(region_id);
        countParams.push(region_id);
        paymentParams.push(region_id);
      }

      if (branch_id) {
        baseConditions += ` AND b.id = ?`;
        queryParams.push(branch_id);
        countParams.push(branch_id);
        paymentParams.push(branch_id);
      }

      const monthCondition = `(CASE WHEN DAY(c.created_date) >= 26 THEN DATE_FORMAT(c.created_date, '%Y-%m-26') ELSE DATE_FORMAT(DATE_SUB(c.created_date, INTERVAL 1 MONTH), '%Y-%m-26') END) >= (CASE WHEN DAY(pt.invoice_date) >= 26 THEN DATE_FORMAT(pt.invoice_date, '%Y-%m-26') ELSE DATE_FORMAT(DATE_SUB(pt.invoice_date, INTERVAL 1 MONTH), '%Y-%m-26') END)`;

      let isSecondDueCondition = `pt.is_second_due = 0 AND ${monthCondition}`;
      if (payment_type === "NEW") {
        paymentCondition += ` AND pt.is_second_due = 0 AND ${monthCondition}`;
      } else if (payment_type === "REPAYMENT") {
        paymentCondition += ` AND (pt.is_second_due = 1 OR (pt.is_second_due = 0 AND NOT ${monthCondition}))`;
        isSecondDueCondition = `(pt.is_second_due = 1 OR (pt.is_second_due = 0 AND NOT ${monthCondition}))`;
      }

      let baseQuery = `
          FROM payment_trans pt
          INNER JOIN payment_master pm ON pm.id = pt.payment_master_id
          INNER JOIN customers c ON c.lead_id = pm.lead_id
          INNER JOIN lead_master l ON l.id = c.lead_id
          INNER JOIN users u ON u.user_id = l.assigned_to
          LEFT JOIN (
                        SELECT payment_master_id,
                        SUM(amount) AS paid_amount,
                        MIN(invoice_date) AS first_payment_date,
                        MAX(invoice_date) AS last_payment_date
                        FROM payment_trans
                        WHERE payment_status <> 'Rejected'
                        GROUP BY payment_master_id
                      ) AS t ON t.payment_master_id = pm.id
          LEFT JOIN branches b ON b.id = u.branch_id
          LEFT JOIN region r ON r.id = b.region_id
          LEFT JOIN payment_mode p ON p.id = pt.paymode_id
          LEFT JOIN banks AS bnk ON bnk.id = pt.bank_id
          LEFT JOIN class_mode AS cm ON cm.id = c.place_of_service
          LEFT JOIN technologies t ON t.id = c.enrolled_course
          LEFT JOIN users cu ON pt.collected_by = cu.id
          WHERE c.status <> 'Form Pending' AND  ${baseConditions}
      `;

      const countQuery = `SELECT COUNT(pt.id) AS total, SUM(pt.amount) as total_paid_amount ${baseQuery}${paymentCondition}`;
      const paymentQuery = `SELECT COUNT(pt.id) AS total,
                            SUM(CASE WHEN pt.is_second_due = 0 AND ${monthCondition} THEN 1 ELSE 0 END) AS new_payment,
                            SUM(CASE WHEN pt.is_second_due = 1 OR (pt.is_second_due = 0 AND NOT ${monthCondition}) THEN 1 ELSE 0 END) AS re_payment,
                            SUM(CASE WHEN l.assigned_to LIKE '%CHN%' AND ${isSecondDueCondition} THEN 1 ELSE 0 END) AS chennai,
                            SUM(CASE WHEN l.assigned_to LIKE '%BNG%' AND ${isSecondDueCondition} THEN 1 ELSE 0 END) AS bangalore,
                            SUM(CASE WHEN l.assigned_to LIKE '%HUB%' AND ${isSecondDueCondition} THEN 1 ELSE 0 END) AS hub ${baseQuery}`;

      baseQuery += `${paymentCondition}`;
      const [countResult] = await pool.query(countQuery, countParams);
      const [paymentResult] = await pool.query(paymentQuery, paymentParams);
      const total = countResult[0].total;
      const total_paid_amount = countResult[0].total_paid_amount || 0;

      let getQuery = `SELECT
                              x.trans_id,
                              x.master_id,
                              x.entry_date,
                              x.paid_date,
                              x.region_name,
                              x.branch_name,
                              x.closed_by,
                              x.closed_by_id,
                              x.customer_id,
                              x.cus_name,
                              x.cus_phone,
                              x.course_name,
                              x.student_id,
                              x.place_of_payment,
                              x.place_of_service,
                              x.course_fees,
                              x.gst_amount,
                              x.total_course_fees,
                              x.paid_amount,
                              (x.total_course_fees - x.paid_amount) AS balance_amount,
                              x.convenience_fees,
                              x.collected_fees,
                              x.transacted_to,
                              x.bank_name,
                              x.collected_by,
                              x.collected_user_id,
                              x.payment_status,
                              x.verified_date,
                              x.is_second_due,
                              x.cus_reg_date,
                              x.total_days_taken,
                              x.end_date,
                              CASE
                                  WHEN x.cus_month >= x.current_month
                                      AND x.is_second_due = 0
                                  THEN 'New'
                                  WHEN x.cus_month >= x.current_month
                                      AND x.is_second_due = 1
                                  THEN 'CMJ'
                                  WHEN x.cus_month = DATE_SUB(x.current_month, INTERVAL 1 MONTH)
                                  THEN 'LMJ'
                                  WHEN x.cus_month <= DATE_SUB(x.current_month, INTERVAL 2 MONTH)
                                  THEN 'PMJ'
                                  ELSE 'Other'
                              END AS collection_type
                          FROM (
                              SELECT
                                  pt.id AS trans_id,
                                  pt.payment_master_id AS master_id,
                                  CAST(pt.created_date AS DATE) AS entry_date,
                                  pt.invoice_date AS paid_date,
                                  r.name AS region_name,
                                  b.name AS branch_name,
                                  u.user_name AS closed_by,
                                  u.user_id AS closed_by_id,
                                  c.id AS customer_id,
                                  c.student_id,
                                  c.name AS cus_name,
                                  c.phone AS cus_phone,
                                  t.name AS course_name,
                                  IFNULL(pt.place_of_payment, '') AS place_of_payment,
                                  cm.name AS place_of_service,
                                  l.primary_fees AS course_fees,
                                  pm.gst_amount,
                                  pm.total_amount AS total_course_fees,
                                  IFNULL(pt.amount, 0) AS paid_amount,
                                  IFNULL(pt.convenience_fees, 0) AS convenience_fees,
                                  (pt.amount + pt.convenience_fees) AS collected_fees,
                                  p.name AS transacted_to,
                                  bnk.bank_name,
                                  cu.user_name AS collected_by,
                                  cu.user_id AS collected_user_id,
                                  pt.payment_status,
                                  pt.verified_date,
                                  pt.is_second_due,
                                  CAST(c.created_date AS DATE) AS cus_reg_date,
                                  CASE 
                                      WHEN DAY(pt.invoice_date) >= 26
                                      THEN DATE_FORMAT(pt.invoice_date, '%Y-%m-26')
                                      ELSE DATE_FORMAT(DATE_SUB(pt.invoice_date, INTERVAL 1 MONTH), '%Y-%m-26')
                                  END AS paid_month,
                                  CASE 
                                      WHEN DAY(c.created_date) >= 26
                                      THEN DATE_FORMAT(c.created_date, '%Y-%m-26')
                                      ELSE DATE_FORMAT(DATE_SUB(c.created_date, INTERVAL 1 MONTH), '%Y-%m-26')
                                  END AS cus_month,
                                  CASE 
                                      WHEN DAY(pt.invoice_date) >= 26
                                      THEN DATE_FORMAT(pt.invoice_date, '%Y-%m-26')
                                      ELSE DATE_FORMAT(DATE_SUB(pt.invoice_date, INTERVAL 1 MONTH), '%Y-%m-26')
                                  END AS current_month,
                                  DATEDIFF(
                                    CASE
                                      WHEN IFNULL(t.paid_amount, 0) >= pm.total_amount
                                      THEN t.last_payment_date
                                      ELSE CURDATE()
                                    END,
                                    t.first_payment_date
                                  ) AS total_days_taken,
                                  t.first_payment_date,
                                  CASE
                                    WHEN IFNULL(t.paid_amount, 0) >= pm.total_amount
                                    THEN t.last_payment_date
                                    ELSE CURDATE()
                                  END AS end_date
                              ${baseQuery}
                              ORDER BY CAST(pt.created_date AS DATE) DESC, pt.id DESC`;

      if (page && limit) {
        getQuery += ` LIMIT ? OFFSET ?`;
        queryParams.push(limitNumber, offset);
      }

      getQuery += ` ) x ORDER BY x.entry_date DESC, x.trans_id DESC`;

      const [result] = await pool.query(getQuery, queryParams);

      const formattedResult = await Promise.all(
        result.map(async (item) => {
          let feesBalance = 0;
          let balance = 0;
          const [paidAmount] = await pool.query(
            `SELECT IFNULL(SUM(amount), 0) AS paid_amount FROM payment_trans WHERE payment_master_id = ? AND id < ? AND payment_status <> 'Rejected';`,
            [item.master_id, item.trans_id],
          );

          feesBalance =
            Number(item.total_course_fees) - paidAmount[0].paid_amount;
          balance = feesBalance - Number(item.paid_amount);

          return {
            ...item,
            fees_balance: feesBalance,
            balance_due: balance,
          };
        }),
      );

      const page_total_paid_amount = formattedResult.reduce(
        (sum, item) => sum + Number(item.paid_amount || 0),
        0,
      );

      return {
        data: formattedResult,
        status_count: {
          new_payment: paymentResult[0].new_payment || 0,
          re_payment: paymentResult[0].re_payment || 0,
          chennai: paymentResult[0].chennai || 0,
          bangalore: paymentResult[0].bangalore || 0,
          hub: paymentResult[0].hub || 0,
        },
        total_paid_amount: total_paid_amount,
        page_total_paid_amount: page_total_paid_amount,
        pagination: {
          total: parseInt(total),
          page: page ? pageNumber : null,
          limit: limit ? limitNumber : null,
          totalPages: page && limit ? Math.ceil(total / limitNumber) : null,
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  feeHistory: async (
    start_date,
    end_date,
    search_filter,
    page,
    limit,
    bucket,
    user_ids,
    region_id,
    branch_id,
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const bucketParams = [];

      const pageNumber = parseInt(page) || 1;
      const limitNumber = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      let bucketQuery = `SELECT COUNT(*) AS total,
                        SUM(CASE WHEN lm.assigned_to LIKE '%CHN%' THEN 1 ELSE 0 END) AS chennai,
                        SUM(CASE WHEN lm.assigned_to LIKE '%BNG%' THEN 1 ELSE 0 END) AS bangalore,
                        SUM(CASE WHEN lm.assigned_to LIKE '%HUB%' THEN 1 ELSE 0 END) AS hub
                        FROM
                          lead_master AS lm
                      LEFT JOIN customers AS c ON c.lead_id = lm.id
                      LEFT JOIN class_mode AS cm ON cm.id = c.place_of_service
                      LEFT JOIN technologies AS t ON t.id = c.enrolled_course
                      LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
                      LEFT JOIN (
                        SELECT SUM(pt.amount) AS paid_amount, pt.payment_master_id FROM payment_trans AS pt
                          WHERE pt.payment_status <> 'Rejected'
                          GROUP BY pt.payment_master_id
                      ) AS t ON t.payment_master_id = pm.id
                      LEFT JOIN users AS su ON su.user_id = lm.assigned_to
                      LEFT JOIN branches AS b ON b.id = su.branch_id
                      LEFT JOIN region AS r ON r.id = b.region_id
                      WHERE 1 = 1`;

      let baseCondition = `FROM
                          lead_master AS lm
                      LEFT JOIN customers AS c ON c.lead_id = lm.id
                      LEFT JOIN class_mode AS cm ON cm.id = c.place_of_service
                      LEFT JOIN technologies AS t ON t.id = c.enrolled_course
                      LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
                      LEFT JOIN (
                        SELECT payment_master_id,
                        SUM(amount) AS paid_amount,
                        MIN(invoice_date) AS first_payment_date,
                        MAX(invoice_date) AS last_payment_date,
                        COUNT(id) AS installment_count
                        FROM payment_trans
                        WHERE payment_status <> 'Rejected'
                        GROUP BY payment_master_id
                      ) AS t ON t.payment_master_id = pm.id
                      LEFT JOIN users AS su ON su.user_id = lm.assigned_to
                      LEFT JOIN branches AS b ON b.id = su.branch_id
                      LEFT JOIN region AS r ON r.id = b.region_id
                      WHERE 1 = 1`;

      if (search_filter) {
        baseCondition += ` AND (c.name LIKE '%${search_filter}%' OR c.phone LIKE '%${search_filter}%' OR c.email LIKE '%${search_filter}%' OR t.name LIKE '%${search_filter}%')`;
      }

      if (region_id) {
        baseCondition += ` AND r.id = ?`;
        bucketQuery += ` AND r.id = ?`;
        countParams.push(region_id);
        bucketParams.push(region_id);
        queryParams.push(region_id);
      }

      if (branch_id) {
        baseCondition += ` AND b.id = ?`;
        bucketQuery += ` AND b.id = ?`;
        countParams.push(branch_id);
        bucketParams.push(branch_id);
        queryParams.push(branch_id);
      }

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          baseCondition += ` AND lm.assigned_to IN (${placeholders})`;
          bucketQuery += ` AND lm.assigned_to IN (${placeholders})`;
          countParams.push(...user_ids);
          bucketParams.push(...user_ids);
          queryParams.push(...user_ids);
        } else {
          baseCondition += ` AND lm.assigned_to = ?`;
          bucketQuery += ` AND lm.assigned_to = ?`;
          countParams.push(user_ids);
          bucketParams.push(user_ids);
          queryParams.push(user_ids);
        }
      }

      if (start_date && end_date) {
        baseCondition += ` AND COALESCE(c.date_of_joining, c.created_date) >= ? AND COALESCE(c.date_of_joining, c.created_date) < DATE_ADD(?, INTERVAL 1 DAY)`;
        bucketQuery += ` AND COALESCE(c.date_of_joining, c.created_date) >= ? AND COALESCE(c.date_of_joining, c.created_date) < DATE_ADD(?, INTERVAL 1 DAY)`;
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        bucketParams.push(start_date, end_date);
      }

      if (bucket) {
        baseCondition += ` AND r.name = ?`;
        queryParams.push(bucket);
        countParams.push(bucket);
      }

      let countQuery = `SELECT COUNT(*) AS total, SUM(pm.total_amount - t.paid_amount) AS total_balance ${baseCondition}`;
      let getQuery = `SELECT
                          c.id AS customer_id,
                          c.name AS customer_name,
                          c.phone AS customer_phone,
                          c.email AS customer_email,
                          c.student_id,
                          t.name AS course_name,
                          c.date_of_joining,
                          lm.primary_fees,
                          pm.gst_amount,
                          pm.discount_amount,
                          pm.total_amount,
                          t.paid_amount,
                          (pm.total_amount - t.paid_amount) AS balance_amount,
                          b.name AS branch_name,
                          r.name AS region_name,
                          cm.name AS place_of_service,
                          pm.id AS payment_master_id,
                          lm.id AS lead_id,
                          lm.assigned_to,
                          su.user_name AS assigned_to_name,
                          DATEDIFF(
                            CASE
                              WHEN IFNULL(t.paid_amount, 0) >= pm.total_amount
                                THEN t.last_payment_date
                              ELSE CURDATE()
                            END,
                            t.first_payment_date
                          ) AS total_days_taken,
                          t.first_payment_date,
                          CASE
                            WHEN IFNULL(t.paid_amount, 0) >= pm.total_amount
                              THEN t.last_payment_date
                            ELSE CURDATE()
                          END AS end_date,
                          t.installment_count
                      ${baseCondition}`;

      getQuery += `ORDER BY c.date_of_joining DESC`;

      if (page && limit) {
        getQuery += ` LIMIT ? OFFSET ?`;
        queryParams.push(limitNumber, offset);
      }

      const [[countData], [result], [bucketData]] = await Promise.all([
        pool.query(countQuery, countParams),
        pool.query(getQuery, queryParams),
        pool.query(bucketQuery, bucketParams),
      ]);

      const total = countData[0].total || 0;
      const totalBalance = countData[0].total_balance || 0;

      const chennaiCount = bucketData[0]?.chennai || 0;
      const bangaloreCount = bucketData[0]?.bangalore || 0;
      const hubCount = bucketData[0]?.hub || 0;

      return {
        data: result,
        pagination: {
          total: parseInt(total),
          page: page ? parseInt(page) : null,
          limit: limit ? parseInt(limit) : null,
          totalPages: page && limit ? Math.ceil(total / limitNumber) : null,
          totalBalance: parseInt(totalBalance),
        },
        bucketData: {
          chennai: parseInt(chennaiCount),
          bangalore: parseInt(bangaloreCount),
          hub: parseInt(hubCount),
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBanks: async (region_id, payment_mode) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT id, bank_name, region_id FROM banks WHERE is_active = 1`;
      if (region_id) {
        getQuery += ` AND region_id = ?`;
        queryParams.push(region_id);
      }

      if (payment_mode) {
        getQuery += ` AND payment_mode = ?`;
        queryParams.push(payment_mode);
      }
      getQuery += ` ORDER BY bank_name`;

      const [rows] = await pool.query(getQuery, queryParams);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

function generateInvoiceNumber(date = new Date(), timeZone) {
  const opts = timeZone ? { timeZone } : {};

  // Day (DD)
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    ...opts,
  }).format(date);

  // Month (MON - 3 letters uppercase)
  const month = new Intl.DateTimeFormat("en-US", { month: "short", ...opts })
    .format(date)
    .toUpperCase();

  // Year (YY - last 2 digits)
  const yearFull = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    ...opts,
  }).format(date);
  const year = yearFull.slice(-2);

  // Hours, Minutes, Seconds (24-hour format)
  const hours = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    ...opts,
  })
    .format(date)
    .padStart(2, "0");
  const minutes = new Intl.DateTimeFormat("en-GB", {
    minute: "2-digit",
    ...opts,
  }).format(date);
  const seconds = new Intl.DateTimeFormat("en-GB", {
    second: "2-digit",
    ...opts,
  }).format(date);

  return `${day}${month}${year}${hours}${minutes}${seconds}`;
}

module.exports = PaymentModel;
