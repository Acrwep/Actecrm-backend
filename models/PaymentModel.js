const pool = require("../config/dbconfig");
const CommonModel = require("../models/CommonModel");

const PaymentModel = {
  getPaymentModes: async () => {
    try {
      const [paymodes] = await pool.query(
        `SELECT id, name FROM payment_mode WHERE is_active = 1`
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
    is_server_required
  ) => {
    try {
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

      const [masterInsert] = await pool.query(paymentMasterQuery, masterValues);
      if (masterInsert.affectedRows <= 0)
        throw new Error("Error while making payment");

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
                                      paid_date
                                  )
                                  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
      ];

      const [transInsert] = await pool.query(paymentTransQuery, transValues);

      if (transInsert.affectedRows <= 0) throw new Error("Error");

      const [getCustomer] = await pool.query(
        `SELECT id, name, phone_code, phone, whatsapp, email, region_id, branch_id, country, state, district FROM lead_master WHERE id = ?`,
        [lead_id]
      );

      const customerQuery = `INSERT INTO customers (lead_id, name, email, phonecode, phone, whatsapp, status, created_date, region_id, branch_id, batch_timing_id, placement_support, enrolled_course, batch_track_id, is_server_required, country, state, current_location) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const customerValues = [
        lead_id,
        getCustomer[0].name,
        getCustomer[0].email,
        getCustomer[0].phone_code,
        getCustomer[0].phone,
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
      ];

      const [insertCustomer] = await pool.query(customerQuery, customerValues);

      const statuses = [
        ["Customer created", created_date, updated_by],
        ["Down Payment", created_date, updated_by],
        ["Awaiting Finance", created_date, updated_by],
      ];

      const values = statuses.map((s) => [insertCustomer.insertId, ...s]);
      const [cusTrack] = await pool.query(
        `INSERT INTO customer_track(
            customer_id,
            status,
            status_date,
            updated_by
        )
        VALUES(?, ?, ?, ?)`,
        values
      );

      const [getInvoiceDetails] = await pool.query(
        `SELECT pm.tax_type, pm.gst_percentage, pm.gst_amount, pm.total_amount, pt.convenience_fees, pt.invoice_number, pt.invoice_date, pt.amount AS paid_amount, pt.paid_date, (pm.total_amount - pt.amount) AS balance_amount, p.name AS payment_mode, pt.payment_screenshot FROM payment_master AS pm INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id INNER JOIN payment_mode AS p ON pt.paymode_id = p.id WHERE pt.id = ?`,
        [transInsert.insertId]
      );

      const [getCourse] = await pool.query(
        `SELECT lm.primary_course_id AS course_id, t.name AS course_name, lm.primary_fees FROM lead_master AS lm INNER JOIN technologies AS t ON lm.primary_course_id = t.id WHERE lm.id = ?`,
        [lead_id]
      );
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
      throw new Error(error.message);
    }
  },

  verifyPayment: async (payment_trans_id, verified_date) => {
    try {
      const [result] = await pool.query(
        `UPDATE payment_trans SET payment_status = 'Verified', verified_date = ?, is_second_due = 0 WHERE id = ?`,
        [verified_date, payment_trans_id]
      );
      return result.affectedRows;
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
    urgent_due
  ) => {
    try {
      const queryParams = [];
      let getQuery = `
                        SELECT
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
                        INNER JOIN payment_master AS pm 
                            ON pm.lead_id = c.lead_id
                        LEFT JOIN branches AS b 
                            ON b.id = c.branch_id
                        LEFT JOIN batch_track AS bt 
                            ON bt.id = c.batch_track_id
                        LEFT JOIN batches AS bs 
                            ON bs.id = c.batch_timing_id
                        INNER JOIN lead_master AS lm 
                            ON c.lead_id = lm.id
                        INNER JOIN users AS u 
                            ON lm.user_id = u.user_id
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
                                    WHERE p2.payment_master_id = pt.payment_master_id
                                      AND p2.payment_status = 'Verified'
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
                            WHERE pt.payment_status = 'Verified'
                            GROUP BY pt.payment_master_id, pm.total_amount
                        ) AS payment_summary 
                            ON payment_summary.payment_master_id = pm.id
                        WHERE payment_summary.balance_amount > 0
                      `;

      // Date filter
      if (from_date && to_date) {
        getQuery += ` AND CAST(payment_summary.next_due_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
      }

      // Urgent due condition
      if (urgent_due === "Urgent Due") {
        getQuery += ` AND c.class_percentage >= 30`;
      }

      // Name filter
      if (name) {
        getQuery += ` AND c.name LIKE ?`;
        queryParams.push(`%${name}%`);
      }

      // Email filter
      if (email) {
        getQuery += ` AND c.email LIKE ?`;
        queryParams.push(`%${email}%`);
      }

      // Mobile filter
      if (mobile) {
        getQuery += ` AND c.phone LIKE ?`;
        queryParams.push(`%${mobile}%`);
      }

      // Course filter
      if (course) {
        getQuery += ` AND t.name LIKE ?`;
        queryParams.push(`%${course}%`);
      }

      // Run query
      const [result] = await pool.query(getQuery, queryParams);

      // Add payment history
      const formattedResult = await Promise.all(
        result.map(async (item) => {
          return {
            ...item,
            payment: await CommonModel.getPaymentHistory(item.lead_id),
          };
        })
      );

      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },
  getPendingFeesCount: async (from_date, to_date) => {
    try {
      const [getOverall] = await pool.query(
        `SELECT COUNT(DISTINCT pm.lead_id) AS overall_pending_count
          FROM payment_master AS pm
          WHERE (
              pm.total_amount - (
                  SELECT COALESCE(SUM(pt_amount.amount), 0)
                  FROM payment_trans pt_amount
                  WHERE pt_amount.payment_master_id = pm.id 
                    AND pt_amount.payment_status = 'Verified'
              )
          ) > 0
          AND EXISTS (
              SELECT 1
              FROM payment_trans pt_date
              WHERE pt_date.id = (
                  SELECT MAX(p2.id)
                  FROM payment_trans p2
                  WHERE p2.payment_master_id = pm.id
                    AND p2.payment_status = 'Verified'
              )
              AND CAST(pt_date.next_due_date AS DATE) BETWEEN ? AND ?
          );
          `,
        [from_date, to_date]
      );

      const [getToday] =
        await pool.query(`SELECT COUNT(DISTINCT pm.lead_id) AS todays_pending_count
                          FROM payment_master AS pm
                          WHERE (
                              pm.total_amount - (
                                  SELECT COALESCE(SUM(pt_amount.amount), 0)
                                  FROM payment_trans pt_amount
                                  WHERE pt_amount.payment_master_id = pm.id 
                                    AND pt_amount.payment_status = 'Verified'
                              )
                          ) > 0
                          AND EXISTS (
                              SELECT 1
                              FROM payment_trans pt_date
                              WHERE pt_date.id = (
                                  SELECT MAX(p2.id)
                                  FROM payment_trans p2
                                  WHERE p2.payment_master_id = pm.id
                                    AND p2.payment_status = 'Verified'
                              )
                              AND CAST(pt_date.next_due_date AS DATE) = CURRENT_DATE
                          );
                          `);

      const [getUrgentDue] = await pool.query(
        `SELECT COUNT(DISTINCT c.id) AS customer_count
          FROM customers c
          INNER JOIN payment_master pm 
              ON c.lead_id = pm.lead_id
          WHERE c.class_percentage >= 30
            AND (
                pm.total_amount - (
                    SELECT COALESCE(SUM(pt.amount), 0)
                    FROM payment_trans pt
                    WHERE pt.payment_master_id = pm.id 
                      AND pt.payment_status = 'Verified'
                )
            ) > 0
            AND EXISTS (
                SELECT 1
                FROM payment_trans pt_date
                WHERE pt_date.id = (
                    SELECT MAX(p2.id)
                    FROM payment_trans p2
                    WHERE p2.payment_master_id = pm.id
                      AND p2.payment_status = 'Verified'
                )
                AND CAST(pt_date.next_due_date AS DATE) BETWEEN ? AND ?
            );
          `,
        [from_date, to_date]
      );
      return {
        today_count: getToday[0].todays_pending_count,
        overall_count: getOverall[0].overall_pending_count,
        urgent_due_count: getUrgentDue[0].customer_count,
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
    paid_date
  ) => {
    try {
      // Check whether the previous payment is still pending stage
      const [isPaymentCheck] = await pool.query(
        `SELECT COUNT(id) AS pending_count FROM payment_trans WHERE payment_status IN ('Verify Pending', 'Rejected') AND payment_master_id = ?`,
        [payment_master_id]
      );
      if (isPaymentCheck[0].pending_count > 0)
        throw new Error("Kindly verify the previous payment");

      const [getPendingFees] = await pool.query(
        `SELECT pm.lead_id, pm.total_amount, SUM(pt.amount) AS paid_amount, (pm.total_amount - SUM(pt.amount)) AS balance_amount FROM payment_master AS pm INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id WHERE pt.payment_status = 'Verified' AND pm.id = ? GROUP BY pm.lead_id`,
        [payment_master_id]
      );

      if (paid_amount > getPendingFees[0].balance_amount)
        throw new Error("Amount should be equal to or less then pending fees");

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
                                      is_second_due
                                  )
                                  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
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
      ];

      const [transInsert] = await pool.query(paymentTransQuery, transValues);

      return transInsert.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  paymentReject: async (payment_trans_id, rejected_date, reason) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM payment_trans WHERE id = ?`,
        [payment_trans_id]
      );
      if (isIdExists.length <= 0) throw new Error("Invalid payment Id");
      const [result] = await pool.query(
        `UPDATE payment_trans SET payment_status = 'Rejected', rejected_date = ?, reason = ?, is_second_due = 0, is_last_pay_rejected = 1 WHERE id = ?`,
        [rejected_date, reason, payment_trans_id]
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
    payment_trans_id
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT payment_master_id FROM payment_trans WHERE id = ?`,
        [payment_trans_id]
      );
      if (isIdExists.length <= 0) throw new Error("Invalid Id");
      const [getCount] = await pool.query(
        `SELECT COUNT(id) AS payment_count FROM payment_trans WHERE payment_master_id = ?`,
        [isIdExists[0].payment_master_id]
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
    total_amount,
    payment_master_id
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM payment_master WHERE id = ?`,
        [payment_master_id]
      );
      if (isIdExists.length <= 0) throw new Error("Invalid Id");
      const sql = `UPDATE
                      payment_master
                  SET
                      tax_type = ?,
                      gst_percentage = ?,
                      gst_amount = ?,
                      total_amount = ?
                  WHERE
                      id = ?`;
      const values = [
        tax_type,
        gst_percentage,
        gst_amount,
        total_amount,
        payment_master_id,
      ];

      const [result] = await pool.query(sql, values);
      return result.affectedRows;
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
