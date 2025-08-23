const { request, response } = require("express");
const CustomerModel = require("../models/CustomerModel");

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
  const { from_date, to_date, status, is_form_sent, name } = request.body;
  try {
    const result = await CustomerModel.getCustomers(
      from_date,
      to_date,
      status,
      is_form_sent,
      name
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

module.exports = {
  updateCustomer,
  getCustomers,
  getCustomerById,
  verifyStudent,
};
