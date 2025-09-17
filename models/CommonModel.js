const pool = require("../config/dbconfig");
const fetch = require("node-fetch");

const CommonModel = {
  getPaymentHistory: async (lead_id) => {
    try {
      const [getPaymentMaster] = await pool.query(
        `SELECT id, lead_id, tax_type, gst_percentage, gst_amount, total_amount, created_date FROM payment_master WHERE lead_id = ?`,
        [lead_id]
      );

      const [getPaymentTrans] = await pool.query(
        `SELECT pt.id, pt.payment_master_id, pt.invoice_number, pt.invoice_date, pt.amount, pt.convenience_fees, pt.paymode_id, pm.name AS payment_mode, pt.payment_screenshot, pt.payment_status, pt.paid_date, pt.verified_date, pt.next_due_date, pt.is_second_due, pt.created_date, pt.reason FROM payment_trans AS pt INNER JOIN payment_mode AS pm ON pt.paymode_id = pm.id WHERE pt.payment_master_id = ? ORDER BY pt.id ASC`,
        [getPaymentMaster[0].id]
      );

      let paid_amount = 0;
      const formattedResult = await Promise.all(
        getPaymentTrans.map(async (item) => {
          paid_amount += item.amount;
          return {
            ...item,
            balance_amount: getPaymentMaster[0].total_amount - paid_amount,
          };
        })
      );

      return {
        ...getPaymentMaster[0],
        payment_trans: formattedResult.reverse(),
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  generateCertificate: async (customer_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM certificates WHERE customer_id = ?`,
        [customer_id]
      );

      if (isExists.length > 0)
        throw new Error("Certificates has already been generated");

      const [getLocation] = await pool.query(
        `SELECT c.region_id, r.name AS region_name FROM customers AS c INNER JOIN region AS r ON c.region_id = r.id WHERE c.id = ?`,
        [customer_id]
      );

      const location = getLocation[0].region_name.substring(0, 3).toUpperCase();

      // Generate the unique numbers
      // const regNumber = await getNextUniqueNumber("REG", location);
      // You can generate the cert number now, or later when the certificate is awarded
      const certNumber = await getNextUniqueNumber("CERT", location);

      const sql = `INSERT INTO certificates (customer_id, certificate_number) VALUES (?, ?)`;
      const values = [customer_id, certNumber];

      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

async function getNextUniqueNumber(sequenceType, location) {
  // 1. Validate input
  if (!["CERT"].includes(sequenceType)) {
    throw new Error('SequenceType must be "CERT"');
  }

  // 2. Calculate the Year-Month code (YYMM)
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Get last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
  const yearMonth = year + month; // e.g., "2509"

  const upsertQuery = `
      INSERT INTO unique_number_sequence (sequence_type, yearmonth , last_sequence)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1;
    `;
  await pool.query(upsertQuery, [sequenceType, yearMonth]);

  // 4. Fetch the updated sequence value we just claimed
  const selectQuery = `
      SELECT last_sequence FROM unique_number_sequence
      WHERE sequence_type = ? AND yearmonth  = ?;
    `;
  const [rows] = await pool.query(selectQuery, [sequenceType, yearMonth]);

  if (rows.length === 0) {
    throw new Error("Failed to generate sequence number");
  }

  const newSequence = rows[0].last_sequence;

  // 5. Format the final number: 0005BAN2509
  const paddedSequence = newSequence.toString().padStart(5, "0");
  const uniqueNumber = `${paddedSequence}${location}${yearMonth}`;

  return uniqueNumber;
}

module.exports = CommonModel;
