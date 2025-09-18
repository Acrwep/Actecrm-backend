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
    palcement_support,
  } = request.body;
  try {
    const result = await PaymentModel.createPayment(
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
      palcement_support
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
  const { from_date, to_date, name, mobile, email, course, urgent_due } =
    request.body;
  try {
    const result = await PaymentModel.pendingFeesList(
      from_date,
      to_date,
      name,
      mobile,
      email,
      course,
      urgent_due
    );
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

const getPendingFeesCount = async (request, response) => {
  const { from_date, to_date } = request.query;
  try {
    const result = await PaymentModel.getPendingFeesCount(from_date, to_date);
    return response.status(200).send({
      messages: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching data",
      details: error.message,
    });
  }
};

const partPayment = async (request, response) => {
  const {
    payment_master_id,
    invoice_date,
    paid_amount,
    convenience_fees,
    paymode_id,
    payment_screenshot,
    payment_status,
    next_due_date,
    created_date,
    paid_date,
  } = request.body;
  try {
    const result = await PaymentModel.partPayment(
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

const paymentReject = async (request, response) => {
  const { payment_trans_id, rejected_date, reason } = request.body;
  try {
    const result = await PaymentModel.paymentReject(
      payment_trans_id,
      rejected_date,
      reason
    );
    return response.status(201).send({
      messages: "Payment has been rejected",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while rejecting payment",
      details: error.message,
    });
  }
};

const updatePayment = async (request, response) => {
  const {
    invoice_date,
    amount,
    convenience_fees,
    paymode_id,
    payment_screenshot,
    paid_date,
    next_due_date,
    payment_trans_id,
  } = request.body;
  try {
    const result = await PaymentModel.updatePayment(
      invoice_date,
      amount,
      convenience_fees,
      paymode_id,
      payment_screenshot,
      paid_date,
      next_due_date,
      payment_trans_id
    );
    return response.status(200).send({
      messages: "Payment updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while updating payment",
      details: error.message,
    });
  }
};

const updatePaymentMaster = async (request, response) => {
  const {
    tax_type,
    gst_percentage,
    gst_amount,
    total_amount,
    payment_master_id,
  } = request.body;
  try {
    const result = await PaymentModel.updatePaymentMaster(
      tax_type,
      gst_percentage,
      gst_amount,
      total_amount,
      payment_master_id
    );
    return response.status(200).send({
      messages: "Payment updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while updating payment",
      details: error.message,
    });
  }
};

module.exports = {
  getPaymentModes,
  createPayment,
  verifyPayment,
  pendingFeesList,
  getPendingFeesCount,
  partPayment,
  paymentReject,
  updatePayment,
  updatePaymentMaster,
};
