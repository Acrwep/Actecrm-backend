const pool = require("../config/dbconfig");

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
    // invoice_no,
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
    paid_date
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
                                      balance_amount,
                                      paymode_id,
                                      payment_screenshot,
                                      payment_status,
                                      next_due_date,
                                      created_date,
                                      paid_date
                                  )
                                  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const transValues = [
        masterInsert.insertId,
        invoiceNo,
        invoice_date,
        paid_amount,
        convenience_fees,
        total_amount - paid_amount,
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
        `SELECT id, name, phone_code, phone, whatsapp, email, region_id, branch_id, training_mode_id FROM lead_master WHERE id = ?`,
        [lead_id]
      );

      const customerQuery = `INSERT INTO customers (lead_id, name, email, phonecode, phone, whatsapp, status, created_date, training_mode, region_id, branch_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const customerValues = [
        lead_id,
        getCustomer[0].name,
        getCustomer[0].email,
        getCustomer[0].phone_code,
        getCustomer[0].phone,
        getCustomer[0].whatsapp,
        "Form Pending",
        created_date,
        getCustomer[0].training_mode_id,
        getCustomer[0].region_id,
        getCustomer[0].branch_id,
      ];

      const [insertCustomer] = await pool.query(customerQuery, customerValues);

      const [cusTrack] = await pool.query(
        `INSERT INTO customer_track(
            customer_id,
            status,
            status_date
        )
        VALUES(?, ?, ?)`,
        [insertCustomer.insertId, "Customer created", created_date]
      );

      const [getInvoiceDetails] = await pool.query(
        `SELECT pm.tax_type, pm.gst_percentage, pm.gst_amount, pm.total_amount, pt.convenience_fees, pt.invoice_number, pt.invoice_date, pt.amount AS paid_amount, pt.paid_date, pt.balance_amount, p.name AS payment_mode, pt.payment_screenshot FROM payment_master AS pm INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id INNER JOIN payment_mode AS p ON pt.paymode_id = p.id WHERE pt.id = ?`,
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
        `UPDATE payment_trans SET payment_status = 'Verified', verified_date = ? WHERE id = ?`,
        [verified_date, payment_trans_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  pendingFeesList: async (from_date, to_date) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                      c.id AS customer_id,
                      c.name,
                      c.email,
                      c.phonecode,
                      c.phone,
                      t.name AS course_name,
                      c.date_of_joining,
                      pm.id AS payment_master_id,
                      pm.tax_type,
                      pm.gst_percentage,
                      pm.gst_amount,
                      lm.primary_fees AS course_fees,
                      pm.total_amount,
                      SUM(pt.amount) AS paid_amount,
                      (
                          pm.total_amount - SUM(pt.amount)
                      ) AS balance_amount,
                      u.id AS lead_by_id,
                      u.user_name AS lead_by,
                      tr.id AS trainer_id,
                      tr.name AS trainer_name,
                      tr.mobile AS trainer_mobile,
                      tr.email AS trainer_email,
                      pt.next_due_date
                  FROM
                      payment_master AS pm
                  INNER JOIN customers AS c ON
                      pm.lead_id = c.lead_id
                  INNER JOIN lead_master AS lm ON
                      c.lead_id = lm.id
                  INNER JOIN users AS u ON
                      lm.user_id = u.user_id
                  INNER JOIN payment_trans AS pt ON
                      pm.id = pt.payment_master_id
                  LEFT JOIN technologies AS t ON
                      c.enrolled_course = t.id
                  LEFT JOIN trainer_mapping AS tm ON
                      c.id = tm.customer_id
                  LEFT JOIN trainer AS tr ON
                      tm.trainer_id = tr.id
                  WHERE 1 = 1`;

      if (from_date && to_date) {
        getQuery += ` AND CAST(pt.next_due_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
      }

      getQuery += ` GROUP BY pm.id`;

      const [result] = await pool.query(getQuery, queryParams);
      return result;
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
