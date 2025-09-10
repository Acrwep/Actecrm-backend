const pool = require("../config/dbconfig");

const CommonModel = {
  getPaymentHistory: async (lead_id) => {
    try {
      const [getPaymentMaster] = await pool.query(
        `SELECT id, lead_id, tax_type, gst_percentage, gst_amount, total_amount, created_date FROM payment_master WHERE lead_id = ?`,
        [lead_id]
      );

      const [getPaymentTrans] = await pool.query(
        `SELECT pt.id, pt.payment_master_id, pt.invoice_number, pt.invoice_date, pt.amount, pt.convenience_fees, pt.balance_amount, pt.paymode_id, pm.name AS payment_mode, pt.payment_screenshot, pt.payment_status, pt.paid_date, pt.verified_date, pt.next_due_date, pt.created_date FROM payment_trans AS pt INNER JOIN payment_mode AS pm ON pt.paymode_id = pm.id WHERE pt.payment_master_id = ? ORDER BY pt.id DESC`,
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
