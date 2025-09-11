const { request, response } = require("express");
const CustomerModel = require("../models/CustomerModel");
const CommonModel = require("../models/CommonModel");

const updateCustomer = async (request, response) => {
  const {
    name,
    email,
    phonecode,
    phone,
    whatsapp,
    date_of_birth,
    gender,
    date_of_joining,
    enrolled_course,
    training_mode,
    branch_id,
    batch_track_id,
    batch_timing_id,
    current_location,
    signature_image,
    profile_image,
    palcement_support,
    id,
    region_id,
  } = request.body;
  try {
    const result = await CustomerModel.updateCustomer(
      name,
      email,
      phonecode,
      phone,
      whatsapp,
      date_of_birth,
      gender,
      date_of_joining,
      enrolled_course,
      training_mode,
      region_id,
      branch_id,
      batch_track_id,
      batch_timing_id,
      current_location,
      signature_image,
      profile_image,
      palcement_support,
      id
    );
    return response.status(200).send({
      message: "Customer updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating customer",
      details: error.message,
    });
  }
};

const getCustomers = async (request, response) => {
  const { from_date, to_date, status, name, email, mobile, course } =
    request.body;
  try {
    const result = await CustomerModel.getCustomers(
      from_date,
      to_date,
      status,
      name,
      email,
      mobile,
      course
    );
    return response.status(200).send({
      message: "Customers fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching customers",
      details: error.message,
    });
  }
};

const getCustomerById = async (request, response) => {
  const { customer_id } = request.query;
  try {
    const result = await CustomerModel.getCustomerById(customer_id);
    return response.status(200).send({
      message: "Customer fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching customer",
      details: error.message,
    });
  }
};

const verifyStudent = async (request, response) => {
  const { customer_id, proof_communication, comments, is_satisfied } =
    request.body;
  try {
    const result = await CustomerModel.verifyStudent(
      customer_id,
      proof_communication,
      comments,
      is_satisfied
    );
    return response.status(200).send({
      message: "Verified successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while verifying",
      details: error.message,
    });
  }
};

const trainerAssign = async (request, response) => {
  const {
    customer_id,
    trainer_id,
    commercial,
    mode_of_class,
    trainer_type,
    proof_communication,
    comments,
    created_date,
  } = request.body;
  try {
    const result = await CustomerModel.trainerAssign(
      customer_id,
      trainer_id,
      commercial,
      mode_of_class,
      trainer_type,
      proof_communication,
      comments,
      created_date
    );
    return response.status(200).send({
      message: "Trainer assigned successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while assigning trainer",
      details: error.message,
    });
  }
};

const verifyTrainer = async (request, response) => {
  const { id, verified_date } = request.body;
  try {
    const result = await CustomerModel.verifyTrainer(id, verified_date);
    return response.status(200).send({
      message: "Trainer verified successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while verifying trainer",
      details: error.message,
    });
  }
};

const rejectTrainer = async (request, response) => {
  const { id, rejected_date, comments } = request.body;
  try {
    const result = await CustomerModel.rejectTrainer(
      id,
      rejected_date,
      comments
    );
    return response.status(200).send({
      message: "Trainer has been rejected",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while rejecting trainer",
      details: error.message,
    });
  }
};

const updateCustomerStatus = async (request, response) => {
  const { customer_id, status } = request.body;
  try {
    const result = await CustomerModel.updateCustomerStatus(
      customer_id,
      status
    );
    return response.status(200).send({
      message: "Status updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating status",
      details: error.message,
    });
  }
};

const getClassSchedules = async (request, response) => {
  try {
    const result = await CustomerModel.getClassSchedules();
    return response.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const classSchedule = async (request, response) => {
  const { customer_id, schedule_id, class_start_date, schedule_at, comments } =
    request.body;
  try {
    const result = await CustomerModel.classSchedule(
      customer_id,
      schedule_id,
      class_start_date,
      schedule_at,
      comments
    );
    return response.status(200).send({
      message: "Class scheduled successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while scheduling class",
      details: error.message,
    });
  }
};

const updateClassGiong = async (request, response) => {
  const {
    customer_id,
    schedule_id,
    class_percentage,
    class_comments,
    class_attachment,
  } = request.body;
  try {
    const result = await CustomerModel.updateClassGiong(
      customer_id,
      schedule_id,
      class_percentage,
      class_comments,
      class_attachment
    );
    return response.status(200).send({
      message: "Percentage updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating percentage",
      details: error.message,
    });
  }
};

const updateReview = async (request, response) => {
  const {
    customer_id,
    linkedin_review,
    google_review,
    course_duration,
    course_completed_date,
    review_updated_date,
  } = request.body;
  try {
    const result = await CustomerModel.updateReview(
      customer_id,
      linkedin_review,
      google_review,
      course_duration,
      course_completed_date,
      review_updated_date
    );
    return response.status(200).send({
      message: "review updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating review",
      details: error.message,
    });
  }
};

const insertCusTrack = async (request, response) => {
  const { customer_id, status, status_date } = request.body;
  try {
    const result = await CustomerModel.insertCusTrack(
      customer_id,
      status,
      status_date
    );
    return response.status(201).send({
      message: "Inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting",
      details: error.message,
    });
  }
};

const generateCertificate = async (request, response) => {
  const { customer_id } = request.body;
  try {
    const result = await CommonModel.generateCertificate(customer_id);
    return response.status(201).send({
      message: "Inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting",
      details: error.message,
    });
  }
};

module.exports = {
  updateCustomer,
  getCustomers,
  getCustomerById,
  verifyStudent,
  trainerAssign,
  verifyTrainer,
  rejectTrainer,
  updateCustomerStatus,
  getClassSchedules,
  classSchedule,
  updateClassGiong,
  updateReview,
  insertCusTrack,
  generateCertificate,
};
