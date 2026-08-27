const { request, response } = require("express");
const PaymentModel = require("../models/PaymentModel");
const CommonModel = require("../models/CommonModel");

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
    bank_id,
    paid_amount,
    payment_screenshot,
    payment_status,
    created_date,
    next_due_date,
    paid_date,
    updated_by,
    batch_timing_id,
    placement_support,
    batch_track_id,
    enrolled_course,
    is_server_required,
    place_of_payment,
    place_of_supply,
    address,
    state_code,
    gst_number,
    ra_id,
    date_of_joining,
    mode_of_class,
    place_of_service,
    contact_person,
    company_name,
    contact_number,
    gst_address,
    location,
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
      bank_id,
      paid_amount,
      payment_screenshot,
      payment_status,
      created_date,
      next_due_date,
      paid_date,
      updated_by,
      batch_timing_id,
      placement_support,
      batch_track_id,
      enrolled_course,
      is_server_required,
      place_of_payment,
      place_of_supply,
      address,
      state_code,
      gst_number,
      ra_id,
      date_of_joining,
      mode_of_class,
      place_of_service,
      contact_person,
      company_name,
      contact_number,
      gst_address,
      location,
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
      verified_date,
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
  const {
    from_date,
    to_date,
    name,
    mobile,
    email,
    course,
    urgent_due,
    user_ids,
    page,
    limit,
  } = request.body;
  try {
    const result = await PaymentModel.pendingFeesList(
      from_date,
      to_date,
      name,
      mobile,
      email,
      course,
      urgent_due,
      user_ids,
      page,
      limit,
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
  const { from_date, to_date, user_ids } = request.body;
  try {
    const result = await PaymentModel.getPendingFeesCount(
      from_date,
      to_date,
      user_ids,
    );
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
    bank_id,
    payment_screenshot,
    payment_status,
    next_due_date,
    created_date,
    paid_date,
    place_of_payment,
    collected_by,
  } = request.body;
  try {
    const result = await PaymentModel.partPayment(
      payment_master_id,
      invoice_date,
      paid_amount,
      convenience_fees,
      paymode_id,
      bank_id,
      payment_screenshot,
      payment_status,
      next_due_date,
      created_date,
      paid_date,
      place_of_payment,
      collected_by,
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
  const { payment_trans_id, rejected_date, reason, updated_by } = request.body;
  try {
    const result = await PaymentModel.paymentReject(
      payment_trans_id,
      rejected_date,
      reason,
      updated_by,
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
    bank_id,
    payment_screenshot,
    paid_date,
    next_due_date,
    payment_trans_id,
    place_of_payment,
  } = request.body;
  try {
    const result = await PaymentModel.updatePayment(
      invoice_date,
      amount,
      convenience_fees,
      paymode_id,
      bank_id,
      payment_screenshot,
      paid_date,
      next_due_date,
      payment_trans_id,
      place_of_payment,
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
    discount_amount,
    total_amount,
    payment_master_id,
    contact_person,
    company_name,
    contact_number,
    location,
    gst_number,
    address,
  } = request.body;
  try {
    const result = await PaymentModel.updatePaymentMaster(
      tax_type,
      gst_percentage,
      gst_amount,
      discount_amount,
      total_amount,
      payment_master_id,
      contact_person,
      company_name,
      contact_number,
      location,
      gst_number,
      address,
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

const getPaymentHistory = async (request, response) => {
  const { lead_id } = request.params;
  try {
    const result = await CommonModel.getPaymentHistory(lead_id);
    return response.status(200).send({
      messages: "Payment history fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching payment history",
      details: error.message,
    });
  }
};

const pendingFeesListV1 = async (request, response) => {
  const {
    from_date,
    to_date,
    search_filter,
    urgent_due,
    user_ids,
    page,
    limit,
    region_id,
    branch_id,
  } = request.body;
  try {
    const result = await PaymentModel.pendingFeesListV1(
      from_date,
      to_date,
      search_filter,
      urgent_due,
      user_ids,
      page,
      limit,
      region_id,
      branch_id,
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

const recievedList = async (request, response) => {
  const {
    start_date,
    end_date,
    search_filter,
    page,
    limit,
    user_ids,
    payment_type,
    region_id,
    branch_id,
  } = request.body;
  try {
    const result = await PaymentModel.recievedList(
      start_date,
      end_date,
      search_filter,
      page,
      limit,
      user_ids,
      payment_type,
      region_id,
      branch_id,
    );
    return response.status(200).send({
      messages: "Data fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching data",
      details: error.message,
    });
  }
};

const feeHistory = async (request, response) => {
  const {
    start_date,
    end_date,
    search_filter,
    page,
    limit,
    bucket,
    user_ids,
    region_id,
    branch_id,
    date_type,
  } = request.body;
  try {
    const result = await PaymentModel.feeHistory(
      start_date,
      end_date,
      search_filter,
      page,
      limit,
      bucket,
      user_ids,
      region_id,
      branch_id,
      date_type,
    );
    return response.status(200).send({
      messages: "Data fetched successfully",
      ...result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching data",
      details: error.message,
    });
  }
};

const getBanks = async (request, response) => {
  const { region_id, payment_mode } = request.query;
  try {
    const result = await PaymentModel.getBanks(region_id, payment_mode);
    return response.status(200).send({
      messages: "Banks fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching banks",
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
  getPaymentHistory,
  pendingFeesListV1,
  recievedList,
  feeHistory,
  getBanks,
};
