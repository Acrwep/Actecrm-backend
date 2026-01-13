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

// Finance Junior - Update Payment Request
const updateTrainerPaymentRequest = async (req, res) => {
  try {
    const result = await trainerPaymentModal.updateTrainerPaymentRequest(
      req.body.id,
      req.body.bill_raisedate,
      req.body.streams,
      req.body.attendance_status,
      req.body.attendance_sheetlink || "",
      req.body.attendance_screenshot || "",
      req.body.customer_id,
      req.body.trainer_id,
      req.body.request_amount,
      req.body.commercial_percentage,
      req.body.days_taken_topay,
      req.body.deadline_date
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// List Payments
const getTrainerPayments = async (req, res) => {
  const {
    start_date,
    end_date,
    status = "all",
    page = 1,
    limit = 10,
  } = req.query;
  const result = await trainerPaymentModal.getTrainerPayments(
    start_date,
    end_date,
    status,
    parseInt(page),
    parseInt(limit)
  );
  res.json(result);
};

// Finance Junior - Create Transaction
const financeJuniorApprove = async (req, res) => {
  try {
    const { trainer_payment_id } = req.body;
    const result = await trainerPaymentModal.financeJuniorApprove(
      trainer_payment_id
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
      paid_amount,
      payment_screenshot,
      paid_date,
      paid_by,
    } = req.body;

    const result = await trainerPaymentModal.financeHeadApproveAndPay(
      trainer_payment_id,
      paid_amount,
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
    const { trainer_payment_id, rejected_reason, rejected_date, rejected_by } =
      req.body;
    const result = await trainerPaymentModal.rejectTrainerPayment(
      trainer_payment_id,
      rejected_reason,
      rejected_date,
      rejected_by
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

// Finance Junior - Resend Rejected Request
const resendRejectedRequest = async (req, res) => {
  try {
    const {
      transaction_id,
      paid_amount,
      payment_type,
      remarks = "",
    } = req.body;

    if (!transaction_id || !paid_amount || !payment_type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await trainerPaymentModal.resendRejectedRequest(
      transaction_id,
      paid_amount,
      payment_type,
      remarks
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  getStudents,
  requestPayment,
  updateTrainerPaymentRequest,
  getTrainerPayments,
  financeJuniorApprove,
  approveTrainerPaymentTransaction,
  rejectTrainerPayment,
  resendRejectedRequest,
};
