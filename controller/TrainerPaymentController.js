const trainerPaymentModal = require("../models/TrainerPaymentModal");

const insertTrainerPaymentRequest = async (request, response) => {
  const {
    bill_raisedate,
    streams,
    attendance_status,
    attendance_sheetlink = "",
    attendance_screenshot = "",
    customer_id,
    trainer_id,
    request_amount,
    commercial_percentage,
    days_taken_topay,
    deadline_date,
    status,
    created_date,
  } = request.body;

  try {
    const result = await trainerPaymentModal.insertTrainerPaymentRequest(
      bill_raisedate,
      streams,
      attendance_status,
      attendance_sheetlink,
      attendance_screenshot,
      customer_id,
      trainer_id,
      request_amount,
      commercial_percentage,
      days_taken_topay,
      deadline_date,
      status,
      created_date
    );
    response.status(201).json({
      message: "Trainer Payment Request addedd successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while insert trainer payment request",
      details: error.message,
    });
  }
};

const updateTrainerPaymentRequest = async (request, response) => {
  const {
    id,
    bill_raisedate,
    streams,
    attendance_status,
    attendance_sheetlink = "",
    attendance_screenshot = "",
    customer_id,
    trainer_id,
    request_amount,
    commercial_percentage,
    days_taken_topay,
    deadline_date,
    status,
  } = request.body;

  try {
    const result = await trainerPaymentModal.updateTrainerPaymentRequest(
      id,
      bill_raisedate,
      streams,
      attendance_status,
      attendance_sheetlink,
      attendance_screenshot,
      customer_id,
      trainer_id,
      request_amount,
      commercial_percentage,
      days_taken_topay,
      deadline_date,
      status
    );

    if (result.status) {
      response.status(200).json({
        message: result.message,
      });
    } else {
      response.status(404).json({
        message: result.message,
      });
    }
  } catch (error) {
    response.status(500).json({
      message: "Error while updating trainer payment request",
      details: error.message,
    });
  }
};

const getTrainerPayments = async (request, response) => {
  const {
    start_date,
    end_date,
    status = "all",
    page = 1,
    limit = 10,
  } = request.query;

  try {
    const result = await trainerPaymentModal.getTrainerPayments(
      start_date,
      end_date,
      status,
      parseInt(page),
      parseInt(limit)
    );

    if (result.status) {
      response.status(200).json({
        message: "Trainer payments fetched successfully",
        data: result.data,
        pagination: result.pagination,
        statusCounts: result.statusCounts,
      });
    } else {
      response.status(500).json({
        message: result.message,
        details: result.error,
      });
    }
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching trainer payments",
      details: error.message,
    });
  }
};

module.exports = {
  insertTrainerPaymentRequest,
  getTrainerPayments,
  updateTrainerPaymentRequest,
};
