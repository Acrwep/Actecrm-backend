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

module.exports = {
  reportScoreBoard,
};
