const pool = require("../config/dbconfig");

const CommonModel = {
  getPaymentHistory: async (lead_id) => {
    try {
      const [getPaymentMaster] = await pool.query(
        `SELECT id, lead_id, tax_type, gst_percentage, gst_amount, total_amount, created_date FROM payment_master WHERE lead_id = ?`,
        [lead_id]
      );

      const [getPaymentTrans] = await pool.query(
        `SELECT id, payment_master_id, invoice_number, invoice_date, amount, convenience_fees, balance_amount, paymode_id, payment_screenshot, payment_status, paid_date, verified_date, next_due_date, created_date FROM payment_trans WHERE payment_master_id = ? ORDER BY id DESC`,
        [getPaymentMaster[0].id]
      );

      return {
        ...getPaymentMaster[0],
        payment_trans: getPaymentTrans,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = CommonModel;
