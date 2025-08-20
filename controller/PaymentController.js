const { request, response } = require("express");
const PaymentModel = require("../models/PaymentModel");

const getPaymentModes = async (request, response) => {
  try {
    const paymodes = await PaymentModel.getPaymentModes();
    return response.status(200).send({
      messages: "Payment modes fetched successfully",
      data: paymodes,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching payment modes",
      details: error.messages,
    });
  }
};

// const createPayment = async (request, response) => {
//   const {
//     lead_id,
//     // invoice_no,
//     invoice_date,
//     tax_type,
//     discount,
//     discount_amount,
//     gst_percentage,
//     gst_amount,
//     total_amount,
//     balance_amount,
//     convenience_fees,
//     payment_id,
//     payment_screenshot,
//     payment_status,
//     created_date,
//   } = request.body;
//   try {
//     const result = await PaymentModel.createPayment(
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
//       created_date
//     );
//     return response.status(201).send({
//       messages: "Payment successfull",
//       data: result,
//     });
//   } catch (error) {
//     response.status(500).send({
//       messages: "Error while making payment",
//       details: error.messages,
//     });
//   }
// };

module.exports = {
  getPaymentModes,
  // createPayment,
};
