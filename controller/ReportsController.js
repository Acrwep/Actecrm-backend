const { request, response } = require("express");
const ReportModel = require("../models/ReportsModel");

const reportScoreBoard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportScoreBoard(
      user_ids,
      start_date,
      end_date
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

const reportUserWiseScoreBoard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportUserWiseScoreBoard(
      user_ids,
      start_date,
      end_date
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

const reportUserWiseLead = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportUserWiseLead(
      user_ids,
      start_date,
      end_date
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

const reportBranchWiseScoreBoard = async (request, response) => {
  const { region_id, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportBranchWiseScoreBoard(
      region_id,
      start_date,
      end_date
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

const reportBranchWiseLeads = async (request, response) => {
  const { region_id, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportBranchWiseLeads(
      region_id,
      start_date,
      end_date
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

const reportHRDashBoard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportHRDashBoard(
      user_ids,
      start_date,
      end_date
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

module.exports = {
  reportScoreBoard,
  reportUserWiseScoreBoard,
  reportUserWiseLead,
  reportBranchWiseScoreBoard,
  reportBranchWiseLeads,
  reportHRDashBoard,
};
