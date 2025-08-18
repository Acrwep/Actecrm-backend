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
};

module.exports = PaymentModel;
