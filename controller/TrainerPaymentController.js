const trainerPaymentModal = require("../models/TrainerPaymentModal");

const getStudents = async (req, res) => {
  const { trainer_id } = req.query;
  try {
    const result = await trainerPaymentModal.getStudents(trainer_id);
    return res.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const requestPayment = async (req, res) => {
  const {
    bill_raisedate,
    trainer_id,
    request_amount,
    days_taken_topay,
    deadline_date,
    created_by,
    created_date,
    students,
  } = req.body;
  try {
    const result = await trainerPaymentModal.requestPayment(
      bill_raisedate,
      trainer_id,
      request_amount,
      days_taken_topay,
      deadline_date,
      created_by,
      created_date,
      students
    );

    return res.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while inserting",
      details: error.message,
    });
  }
};

const getPayments = async (req, res) => {
  const { start_date, end_date, status, page, limit } = req.body;
  try {
    const result = await trainerPaymentModal.getPayments(
      start_date,
      end_date,
      status,
      page,
      limit
    );
    res.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

// Finance Junior - Create Transaction
const financeJuniorApprove = async (req, res) => {
  try {
    const { trainer_payment_id, paid_amount, payment_type } = req.body;
    const result = await trainerPaymentModal.financeJuniorApprove(
      trainer_payment_id,
      paid_amount,
      payment_type
    );
    return res.status(200).send({
      message: "Payment moved to Awaiting Finance successfully",
      data: result,
    });
  } catch (err) {
    res.status(500).send({
      message: "Error while moving to Awaiting Finance",
      details: err.message,
    });
  }
};

// Finance Head - Approve Transaction
const approveTrainerPaymentTransaction = async (req, res) => {
  try {
    const {
      trainer_payment_id,
      payment_trans_id,
      payment_screenshot,
      paid_date,
      paid_by,
    } = req.body;

    const result = await trainerPaymentModal.financeHeadApproveAndPay(
      trainer_payment_id,
      payment_trans_id,
      payment_screenshot,
      paid_date,
      paid_by
    );
    return res.status(200).send({
      message: "Payment successfull",
      data: result,
    });
  } catch (err) {
    res.status(500).send({
      message: "Error while approve payment",
      details: err.message,
    });
  }
};

// Finance Head - Reject Payment
const rejectTrainerPayment = async (req, res) => {
  try {
    const {
      trainer_payment_id,
      payment_trans_id,
      rejected_reason,
      rejected_date,
    } = req.body;
    const result = await trainerPaymentModal.rejectTrainerPayment(
      trainer_payment_id,
      payment_trans_id,
      rejected_reason,
      rejected_date
    );
    return res.status(200).send({
      message: "Payment has been rejected",
      data: result,
    });
  } catch (err) {
    res.status(500).send({
      message: "Error while rejecting payment",
      details: err.message,
    });
  }
};

const deleteRequest = async (req, res) => {
  const { trainer_payment_id } = req.query;
  try {
    const result = await trainerPaymentModal.deleteRequest(trainer_payment_id);
    res.status(200).send({
      message: "Request has been deleted",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while deleting request",
      details: error.message,
    });
  }
};

const updateTrainerPayment = async (req, res) => {
  const { trainer_payment_id, payment_trans_id, paid_amount } = req.body;
  try {
    const result = await trainerPaymentModal.updateTrainerPayment(
      trainer_payment_id,
      payment_trans_id,
      paid_amount
    );
    res.status(200).send({
      message: "Payment updated successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while updating payment",
      details: error.message,
    });
  }
};

module.exports = {
  getStudents,
  requestPayment,
  getPayments,
  financeJuniorApprove,
  approveTrainerPaymentTransaction,
  rejectTrainerPayment,
  deleteRequest,
  updateTrainerPayment,
};
