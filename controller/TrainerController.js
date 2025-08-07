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
    mobile,
    email,
    whatsapp,
    technology_id,
    overall_exp_year,
    relevant_exp_year,
    batch_id,
    availability_time,
    secondary_time,
    skills,
    location,
  } = request.body;
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  try {
    const result = await TrainerModel.addTrainer(
      trainer_name,
      mobile,
      email,
      whatsapp,
      technology_id,
      overall_exp_year,
      relevant_exp_year,
      batch_id,
      availability_time,
      secondary_time,
      formattedSkills,
      location
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
    mobile,
    email,
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
    id,
  } = request.body;
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  try {
    const result = await TrainerModel.updateTrainer(
      trainer_name,
      mobile,
      email,
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
      id
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
  const { name, mobile, email } = request.body;
  try {
    const trainers = await TrainerModel.getTrainers(name, mobile, email);
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

module.exports = {
  getTechnologies,
  getBatches,
  addTrainer,
  updateTrainer,
  getTrainers,
  getExperience,
};
