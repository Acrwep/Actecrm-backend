const { request, response } = require("express");
const LeadModel = require("../models/LeadModel");

const getTrainingMode = async (request, response) => {
  try {
    const result = await LeadModel.getTrainingMode();
    return response.status(200).send({
      message: "Training modes fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching training modes",
      details: error.message,
    });
  }
};

const getPriority = async (request, response) => {
  try {
    const result = await LeadModel.getPriority();
    return response.status(200).send({
      message: "Priority fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching priority",
      details: error.message,
    });
  }
};

const getLeadType = async (request, response) => {
  try {
    const result = await LeadModel.getLeadType();
    return response.status(200).send({
      message: "Lead type fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching lead type",
      details: error.message,
    });
  }
};

const getStatus = async (request, response) => {
  try {
    const result = await LeadModel.getStatus();
    return response.status(200).send({
      message: "Status fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching status",
      details: error.message,
    });
  }
};

const getResponseStatus = async (request, response) => {
  try {
    const result = await LeadModel.getResponseStatus();
    return response.status(200).send({
      message: "Response status fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching response status",
      details: error.message,
    });
  }
};

const getBranches = async (request, response) => {
  try {
    const result = await LeadModel.getBranches();
    return response.status(200).send({
      message: "Branches fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching branches",
      details: error.message,
    });
  }
};

const getBatchTrack = async (request, response) => {
  try {
    const result = await LeadModel.getBatchTrack();
    return response.status(200).send({
      message: "Batch track fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching batch track",
      details: error.message,
    });
  }
};

module.exports = {
  getTrainingMode,
  getPriority,
  getLeadType,
  getStatus,
  getResponseStatus,
  getBranches,
  getBatchTrack,
};
