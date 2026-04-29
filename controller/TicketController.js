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
    priority,
    attachments,
    raised_by_id,
    raised_by_role,
    raised_by_name,
    raised_by_email,
    raised_by_mobile,
    raised_by_course,
    manager_id,
    ra_id,
    created_by,
    created_at,
    assigned_to,
  } = request.body;
  try {
    const result = await TicketModel.createTicket(
      title,
      description,
      category_id,
      priority,
      attachments,
      raised_by_id,
      raised_by_role,
      raised_by_name,
      raised_by_email,
      raised_by_mobile,
      raised_by_course,
      manager_id,
      ra_id,
      created_by,
      created_at,
      assigned_to,
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

const updateTicket = async (request, response) => {
  const {
    ticket_id,
    title,
    description,
    category_id,
    priority,
    attachments, // new attachments
    assigned_to,
    raised_by_id,
    raised_by_role,
    raised_by_name,
    raised_by_email,
    raised_by_mobile,
    raised_by_course,
    manager_id,
    ra_id,
    updated_at,
    manager_updated,
    ra_updated,
  } = request.body;
  try {
    const result = await TicketModel.updateTicket(
      ticket_id,
      title,
      description,
      category_id,
      priority,
      attachments,
      assigned_to,
      raised_by_id,
      raised_by_role,
      raised_by_name,
      raised_by_email,
      raised_by_mobile,
      raised_by_course,
      manager_id,
      ra_id,
      updated_at,
      manager_updated,
      ra_updated,
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
  const {
    start_date,
    end_date,
    status,
    page,
    limit,
    user_id,
    show_all,
    category_id,
  } = request.body;
  try {
    const result = await TicketModel.getTickets(
      start_date,
      end_date,
      status,
      page,
      limit,
      user_id,
      show_all,
      category_id,
    );
    response.status(200).send({
      message: "Data fetched successfully (V2).",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data (V2)",
      details: error.message,
    });
  }
};

const updateTicketStatus = async (request, response) => {
  const { ticket_id, status, closed_at, updated_at, ra_id } = request.body;
  try {
    const result = await TicketModel.updateTicketStatus(
      ticket_id,
      status,
      closed_at,
      updated_at,
      ra_id,
    );
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

const ticketTrack = async (request, response) => {
  const {
    ticket_id,
    assigned_to,
    status,
    details,
    comments,
    created_date,
    updated_by,
  } = request.body;
  try {
    const result = await TicketModel.ticketTrack(
      ticket_id,
      assigned_to,
      status,
      details,
      comments,
      created_date,
      updated_by,
    );
    response.status(200).send({
      message: "Track inserted successfully.",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting track",
      details: error.message,
    });
  }
};

const getTicketTracks = async (request, response) => {
  const { ticket_id } = request.query;
  try {
    const result = await TicketModel.getTicketTracks(ticket_id);
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
  updateTicket,
  getTickets,
  updateTicketStatus,
  getCategories,
  getSubCategories,
  ticketTrack,
  getTicketTracks,
};
