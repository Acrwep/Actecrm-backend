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
    discount,
    discount_amount,
    gst_percentage,
    gst_amount,
    total_amount,
    convenience_fees,
    paymode_id,
    paid_amount,
    payment_screenshot,
    payment_status,
    created_date
  ) => {
    try {
      const paymentMasterQuery = `INSERT INTO payment_master(
                              lead_id,
                              tax_type,
                              discount,
                              discount_amount,
                              gst_percentage,
                              gst_amount,
                              total_amount,
                              convenience_fees,
                              created_date
                          )
                          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const masterValues = [
        lead_id,
        tax_type,
        discount,
        discount_amount,
        gst_percentage,
        gst_amount,
        total_amount,
        convenience_fees,
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
                                      balance_amount,
                                      paymode_id,
                                      payment_screenshot,
                                      payment_status,
                                      created_date
                                  )
                                  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const transValues = [
        masterInsert.insertId,
        invoiceNo,
        invoice_date,
        paid_amount,
        total_amount - paid_amount,
        paymode_id,
        payment_screenshot,
        payment_status,
        created_date,
      ];

      const [transInsert] = await pool.query(paymentTransQuery, transValues);

      if (transInsert.affectedRows <= 0) throw new Error("Error");

      const [getCustomer] = await pool.query(
        `SELECT id, name, phone_code, phone, whatsapp, email FROM lead_master WHERE id = ?`,
        [lead_id]
      );

      const customerQuery = `INSERT INTO customers (lead_id, name, email, phonecode, phone, whatsapp, status, created_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`;
      const customerValues = [
        lead_id,
        getCustomer[0].name,
        getCustomer[0].email,
        getCustomer[0].phone_code,
        getCustomer[0].phone,
        getCustomer[0].whatsapp,
        "Awaiting Finance",
        created_date,
      ];

      const [insertCustomer] = await pool.query(customerQuery, customerValues);
      return {
        insertId: insertCustomer.insertId,
        email: getCustomer[0].email,
      };
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
