const { request, response } = require("express");
const ReportModel = require("../models/ReportsModel");

const reportScoreBoard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportScoreBoard(
      user_ids,
      start_date,
      end_date,
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
      end_date,
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
      end_date,
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
  const { region_id, branch_id, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportBranchWiseScoreBoard(
      region_id,
      branch_id,
      start_date,
      end_date,
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
  const { region_id, branch_id, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportBranchWiseLeads(
      region_id,
      branch_id,
      start_date,
      end_date,
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
      end_date,
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

const reportRADashBoard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportRADashBoard(
      user_ids,
      start_date,
      end_date,
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

const monthWiseCollection = async (request, response) => {
  const { user_ids, start_date, end_date, branch_id } = request.body;
  try {
    const result = await ReportModel.monthWiseCollection(
      user_ids,
      start_date,
      end_date,
      branch_id,
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

const reportUserWiseQuality = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportUserWiseQuality(
      user_ids,
      start_date,
      end_date,
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

const reportPostSale = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.reportPostSale(
      user_ids,
      start_date,
      end_date,
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

const getTopPerformingReport = async (request, response) => {
  const { user_ids, region_id, branch_id, start_date, end_date } = request.body;
  try {
    const result = await ReportModel.getTopPerformingReport(
      user_ids,
      region_id,
      branch_id,
      start_date,
      end_date,
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

const getRegionWiseFinance = async (request, response) => {
  const { start_date, end_date, type } = request.body;
  try {
    const result = await ReportModel.getRegionWiseFinance(
      start_date,
      end_date,
      type,
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

const getTransactionWiseReport = async (request, response) => {
  const { start_date, end_date } = request.body;
  try {
    const result = await ReportModel.getTransactionWiseReport(
      start_date,
      end_date,
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

const getUserwiseTransaction = async (request, response) => {
  const { start_date, end_date, user_ids } = request.body;
  try {
    const result = await ReportModel.getUserwiseTransaction(
      start_date,
      end_date,
      user_ids,
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

const getServerReport = async (request, response) => {
  const { start_date, end_date, type } = request.body;
  try {
    const result = await ReportModel.getServerReport(
      start_date,
      end_date,
      type,
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
  reportRADashBoard,
  monthWiseCollection,
  reportUserWiseQuality,
  reportPostSale,
  getTopPerformingReport,
  getRegionWiseFinance,
  getTransactionWiseReport,
  getUserwiseTransaction,
  getServerReport,
};
