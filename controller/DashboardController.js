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

module.exports = {
  getScoreBoard,
};
