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

module.exports = {
  getTechnologies,
  getBatches,
};
