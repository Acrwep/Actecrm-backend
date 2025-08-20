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

  // createPayment: async (
  //   lead_id,
  //   // invoice_no,
  //   invoice_date,
  //   tax_type,
  //   discount,
  //   discount_amount,
  //   gst_percentage,
  //   gst_amount,
  //   total_amount,
  //   balance_amount,
  //   convenience_fees,
  //   payment_id,
  //   payment_screenshot,
  //   payment_status,
  //   created_date
  // ) => {
  //   try {
  //     const insertQuery = `INSERT INTO payment_master(
  //                             lead_id,
  //                             invoice_date,
  //                             tax_type,
  //                             discount,
  //                             discount_amount,
  //                             gst_percentage,
  //                             gst_amount,
  //                             total_amount,
  //                             balance_amount,
  //                             convenience_fees,
  //                             payment_id,
  //                             payment_screenshot,
  //                             payment_status,
  //                             created_date
  //                         )
  //                         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  //     const values = [
  //       lead_id,
  //       // invoice_no,
  //       invoice_date,
  //       tax_type,
  //       discount,
  //       discount_amount,
  //       gst_percentage,
  //       gst_amount,
  //       total_amount,
  //       balance_amount,
  //       convenience_fees,
  //       payment_id,
  //       payment_screenshot,
  //       payment_status,
  //       created_date,
  //     ];

  //     const [result] = await pool.query(insertQuery, values);
  //     return result.affectedRows;
  //   } catch (error) {
  //     throw new Error(error.message);
  //   }
  // },
};

module.exports = PaymentModel;
