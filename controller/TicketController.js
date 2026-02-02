const { request, response } = require("express");
const TicketModel = require("../models/TicketModel");

const validateEmail = async (request, response) => {
  const { email } = request.body;
  try {
    const result = await TicketModel.validateEmail(email);
    response.status(200).send({
      message: "Email validation successfull.",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while validating email",
      details: error.message,
    });
  }
};

const createTicket = async (request, response) => {
  const {
    title,
    description,
    category_id,
    sub_category_id,
    priority,
    type,
    attachments,
    raised_by_id,
    raised_by_role,
    created_at,
  } = request.body;
  try {
    const result = await TicketModel.createTicket(
      title,
      description,
      category_id,
      sub_category_id,
      priority,
      type,
      attachments,
      raised_by_id,
      raised_by_role,
      created_at,
    );

    response.status(201).send({
      message: "Ticket raised successfully.",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while raising ticket",
      details: error.message,
    });
  }
};

const getTickets = async (request, response) => {
  const { start_date, end_date } = request.body;
  try {
    const result = await TicketModel.getTickets(start_date, end_date);
    response.status(200).send({
      message: "Data fetched successfully.",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const updateTicketStatus = async (request, response) => {
  const { ticked_id, status } = request.body;
  try {
    const result = await TicketModel.updateTicketStatus(ticked_id, status);
    response.status(200).send({
      message: "Data updated successfully.",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating data",
      details: error.message,
    });
  }
};

const getCategories = async (request, response) => {
  try {
    const result = await TicketModel.getCategories();
    response.status(200).send({
      message: "Data fetched successfully.",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const getSubCategories = async (request, response) => {
  const { category_id } = request.query;
  try {
    const result = await TicketModel.getSubCategories(category_id);
    response.status(200).send({
      message: "Data fetched successfully.",
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
  validateEmail,
  createTicket,
  getTickets,
  updateTicketStatus,
  getCategories,
  getSubCategories,
};
