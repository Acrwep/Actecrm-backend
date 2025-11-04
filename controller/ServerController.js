const { request, response } = require("express");
const ServerModel = require("../models/ServerModel");

const getServerRequest = async (request, response) => {
  const {
    start_date,
    end_date,
    name,
    mobile,
    email,
    server,
    status,
    page,
    limit,
  } = request.body;
  try {
    const result = await ServerModel.getServerRequest(
      start_date,
      end_date,
      name,
      mobile,
      email,
      server,
      status,
      page,
      limit
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
  getServerRequest,
};
