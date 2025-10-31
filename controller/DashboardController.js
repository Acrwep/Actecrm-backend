const { request, response } = require("express");
const DashboardModel = require("../models/DashboardModel");

const getScoreBoard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await DashboardModel.getScoreBoard(
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

const getHRDashboard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await DashboardModel.getHRDashboard(
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

const getRADashboard = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await DashboardModel.getRADashboard(
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

const getTopPerforming = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await DashboardModel.getTopPerforming(
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

const getUserWiseScoreBoard = async (request, response) => {
  const { user_ids, start_date, end_date, type } = request.body;
  try {
    const result = await DashboardModel.getUserWiseScoreBoard(
      user_ids,
      start_date,
      end_date,
      type
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

const getUserWiseLeadCounts = async (request, response) => {
  const { user_ids, start_date, end_date, type } = request.body;
  try {
    const result = await DashboardModel.getUserWiseLeadCounts(
      user_ids,
      start_date,
      end_date,
      type
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
  getScoreBoard,
  getHRDashboard,
  getRADashboard,
  getTopPerforming,
  getUserWiseScoreBoard,
  getUserWiseLeadCounts,
};
