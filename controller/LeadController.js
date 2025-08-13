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

const insertLead = async (request, response) => {
  const {
    user_id,
    name,
    phone_code,
    phone,
    whatsapp,
    email,
    country,
    state,
    district,
    primary_course_id,
    primary_fees,
    price_category,
    secondary_course_id,
    secondary_fees,
    training_mode_id,
    priority_id,
    lead_type_id,
    lead_status_id,
    response_status_id,
    next_follow_up_date,
    expected_join_date,
    lead_quality_rating,
    branch_id,
    batch_track_id,
    comments,
    created_date,
  } = request.body;
  try {
    const result = await LeadModel.insertLead(
      user_id,
      name,
      phone_code,
      phone,
      whatsapp,
      email,
      country,
      state,
      district,
      primary_course_id,
      primary_fees,
      price_category,
      secondary_course_id,
      secondary_fees,
      training_mode_id,
      priority_id,
      lead_type_id,
      lead_status_id,
      response_status_id,
      next_follow_up_date,
      expected_join_date,
      lead_quality_rating,
      branch_id,
      batch_track_id,
      comments,
      created_date
    );
    return response.status(200).send({
      message: "Lead added successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while adding lead",
      details: error.message,
    });
  }
};

const getLeads = async (request, response) => {
  const { name, start_date, end_date, lead_status_id } = request.body;
  try {
    const leads = await LeadModel.getLeads(
      name,
      start_date,
      end_date,
      lead_status_id
    );
    return response.status(200).send({
      message: "Leads fetched successfully",
      data: leads,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching leads",
      details: error.message,
    });
  }
};

const getLeadFollowUps = async (request, response) => {
  const { date_type } = request.query;
  try {
    const leads = await LeadModel.getLeadFollowUps(date_type);
    return response.status(200).send({
      message: "Follow up fetched successfully",
      data: leads,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching follow ups",
      details: error.message,
    });
  }
};

const updateFollowUp = async (request, response) => {
  const {
    lead_history_id,
    comments,
    next_follow_up_date,
    lead_status_id,
    lead_id,
    updated_by,
    updated_date,
  } = request.body;
  try {
    const result = await LeadModel.updateFollowUp(
      lead_history_id,
      comments,
      next_follow_up_date,
      lead_status_id,
      lead_id,
      updated_by,
      updated_date
    );
    return response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating",
      details: error.message,
    });
  }
};

const updateLead = async (request, response) => {
  const {
    name,
    phone_code,
    phone,
    whatsapp,
    email,
    country,
    state,
    district,
    primary_course_id,
    primary_fees,
    price_category,
    secondary_course_id,
    secondary_fees,
    training_mode_id,
    priority_id,
    lead_type_id,
    lead_status_id,
    response_status_id,
    next_follow_up_date,
    expected_join_date,
    lead_quality_rating,
    branch_id,
    batch_track_id,
    comments,
    lead_id,
  } = request.body;
  try {
    const result = await LeadModel.updateLead(
      name,
      phone_code,
      phone,
      whatsapp,
      email,
      country,
      state,
      district,
      primary_course_id,
      primary_fees,
      price_category,
      secondary_course_id,
      secondary_fees,
      training_mode_id,
      priority_id,
      lead_type_id,
      lead_status_id,
      response_status_id,
      next_follow_up_date,
      expected_join_date,
      lead_quality_rating,
      branch_id,
      batch_track_id,
      comments,
      lead_id
    );
    return response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating",
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
  insertLead,
  getLeads,
  getLeadFollowUps,
  updateFollowUp,
  updateLead,
};
