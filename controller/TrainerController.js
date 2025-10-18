const { request, response } = require("express");
const TrainerModel = require("../models/TrainerModel");

const getTechnologies = async (request, response) => {
  try {
    const tech = await TrainerModel.getTechnologies();
    return response.status(200).send({
      message: "Technologies fetched successfully",
      data: tech,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching technologies",
      details: error.message,
    });
  }
};

const getBatches = async (request, response) => {
  try {
    const batches = await TrainerModel.getBatches();
    return response.status(200).send({
      message: "Batches fetched successfully",
      data: batches,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching batches",
      details: error.message,
    });
  }
};

const getExperience = async (request, response) => {
  try {
    const result = await TrainerModel.getExperience();
    return response.status(200).send({
      message: "Experience fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching experience",
      details: error.message,
    });
  }
};

const addTrainer = async (request, response) => {
  const {
    trainer_name,
    mobile_phone_code,
    mobile,
    email,
    whatsapp_phone_code,
    whatsapp,
    technology_id,
    overall_exp_year,
    relevant_exp_year,
    batch_id,
    availability_time,
    secondary_time,
    skills,
    location,
    profile_image,
    account_holder_name,
    account_number,
    bank_name,
    branch_name,
    ifsc_code,
    signature_image,
    created_by,
    created_date,
  } = request.body;
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  try {
    const result = await TrainerModel.addTrainer(
      trainer_name,
      mobile_phone_code,
      mobile,
      email,
      whatsapp_phone_code,
      whatsapp,
      technology_id,
      overall_exp_year,
      relevant_exp_year,
      batch_id,
      availability_time,
      secondary_time,
      formattedSkills,
      location,
      profile_image,
      account_holder_name,
      account_number,
      bank_name,
      branch_name,
      ifsc_code,
      signature_image,
      created_by,
      created_date
    );
    return response.status(200).send({
      message: "Trainer addedd successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while adding trainer",
      details: error.message,
    });
  }
};

const updateTrainer = async (request, response) => {
  const {
    trainer_name,
    mobile_phone_code,
    mobile,
    email,
    whatsapp_phone_code,
    whatsapp,
    technology_id,
    overall_exp_year,
    relevant_exp_year,
    batch_id,
    availability_time,
    secondary_time,
    skills,
    location,
    status,
    profile_image,
    id,
    trainer_bank_id,
    account_holder_name,
    account_number,
    bank_name,
    branch_name,
    ifsc_code,
    signature_image,
    is_bank_updated,
  } = request.body;
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  try {
    const result = await TrainerModel.updateTrainer(
      trainer_name,
      mobile_phone_code,
      mobile,
      email,
      whatsapp_phone_code,
      whatsapp,
      technology_id,
      overall_exp_year,
      relevant_exp_year,
      batch_id,
      availability_time,
      secondary_time,
      formattedSkills,
      location,
      status,
      profile_image,
      id,
      trainer_bank_id,
      account_holder_name,
      account_number,
      bank_name,
      branch_name,
      ifsc_code,
      signature_image,
      is_bank_updated
    );
    return response.status(200).send({
      message: "Trainer updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating trainer",
      details: error.message,
    });
  }
};

const getTrainers = async (request, response) => {
  const {
    name,
    mobile,
    trainer_code,
    email,
    status,
    is_form_sent,
    is_onboarding,
    ongoing,
    created_by,
    page,
    limit,
  } = request.body;
  try {
    const trainers = await TrainerModel.getTrainers(
      name,
      mobile,
      trainer_code,
      email,
      status,
      is_form_sent,
      is_onboarding,
      ongoing,
      created_by,
      page,
      limit
    );
    return response.status(200).send({
      message: "Trainer fetched successfully",
      data: trainers,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching trainers",
      details: error.message,
    });
  }
};

const updateStatus = async (request, response) => {
  const { trainer_id, status } = request.body;
  try {
    const result = await TrainerModel.updateStatus(trainer_id, status);
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

const getTrainerById = async (request, response) => {
  const { trainer_id } = request.query;
  try {
    const trainer = await TrainerModel.getTrainerById(trainer_id);
    return response.status(200).send({
      message: "Trainer fetched successfully",
      data: trainer,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching trainer",
      details: error.message,
    });
  }
};

const getTrainerHistory = async (request, response) => {
  const { customer_id } = request.query;
  try {
    const history = await TrainerModel.getTrainerHistory(customer_id);
    return response.status(200).send({
      message: "Trainer history successfully",
      data: history,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching trainer history",
      details: error.message,
    });
  }
};

const getCusByTrainer = async (request, response) => {
  const { trainer_id, is_class_taken } = request.query;
  try {
    const result = await TrainerModel.getCusByTrainer(
      trainer_id,
      is_class_taken
    );
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

const addTechnologies = async (request, response) => {
  const { course_name } = request.body;
  try {
    const result = await TrainerModel.addTechnologies(course_name);
    return response.status(201).send({
      message: "Course added successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while adding course",
      details: error.message,
    });
  }
};

const addSkills = async (request, response) => {
  const { skill_name } = request.body;
  try {
    const result = await TrainerModel.addSkills(skill_name);
    return response.status(201).send({
      message: "Skill added successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while adding skill",
      details: error.message,
    });
  }
};

const getSkills = async (request, response) => {
  try {
    const skills = await TrainerModel.getSkills();
    return response.status(200).send({
      message: "Skills fetched successfully",
      data: skills,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching skills",
      details: error.message,
    });
  }
};

module.exports = {
  getTechnologies,
  getBatches,
  addTrainer,
  updateTrainer,
  getTrainers,
  getExperience,
  updateStatus,
  getTrainerById,
  getTrainerHistory,
  getCusByTrainer,
  addTechnologies,
  addSkills,
  getSkills,
};
