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
      details: error.message,
    });
  }
};

const createPayment = async (request, response) => {
  const {
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
    paid_date,
  } = request.body;
  try {
    const result = await PaymentModel.createPayment(
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
    );
    return response.status(201).send({
      messages: "Payment successfull",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while making payment",
      details: error.message,
    });
  }
};

const verifyPayment = async (request, response) => {
  const { payment_trans_id, verified_date } = request.body;
  try {
    const result = await PaymentModel.verifyPayment(
      payment_trans_id,
      verified_date
    );
    return response.status(200).send({
      messages: "Payment verified successfull",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while verifying payment",
      details: error.message,
    });
  }
};

const pendingFeesList = async (request, response) => {
  const { from_date, to_date } = request.query;
  try {
    const result = await PaymentModel.pendingFeesList(from_date, to_date);
    return response.status(200).send({
      messages: "Fees pending data successfull",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching fees pending data",
      details: error.message,
    });
  }
};

module.exports = {
  getPaymentModes,
  createPayment,
  verifyPayment,
  pendingFeesList,
};
