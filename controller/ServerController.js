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

const updateServerStatus = async (request, response) => {
  const { server_id, status, comments, rejected_by } = request.body;
  try {
    const result = await ServerModel.updateServerStatus(
      server_id,
      status,
      comments,
      rejected_by
    );
    return response.status(200).send({
      message: "Data updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating data",
      details: error.message,
    });
  }
};

const awatingVerify = async (request, response) => {
  const { server_id, vendor_id, duration, server_cost, server_trans_id } =
    request.body;
  try {
    const result = await ServerModel.awatingVerify(
      server_id,
      vendor_id,
      duration,
      server_cost,
      server_trans_id
    );
    return response.status(200).send({
      message: "Data updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating data",
      details: error.message,
    });
  }
};

const serverIssued = async (request, response) => {
  const { server_id, email_subject, email_content } = request.body;
  try {
    const result = await ServerModel.serverIssued(
      server_id,
      email_subject,
      email_content
    );
    return response.status(200).send({
      message: "Data updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating data",
      details: error.message,
    });
  }
};

const insertServerTrack = async (request, response) => {
  const { server_id, status, status_date, updated_by, details } = request.body;
  try {
    const result = await ServerModel.insertServerTrack(
      server_id,
      status,
      status_date,
      updated_by,
      details
    );
    return response.status(201).send({
      message: "Inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting",
      details: error.message,
    });
  }
};

const getServerHistory = async (request, response) => {
  const { server_id } = request.query;
  try {
    const result = await ServerModel.getServerHistory(server_id);
    return response.status(200).send({
      message: "Server history fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching server history",
      details: error.message,
    });
  }
};

module.exports = {
  getServerRequest,
  awatingVerify,
  updateServerStatus,
  serverIssued,
  insertServerTrack,
  getServerHistory,
};
