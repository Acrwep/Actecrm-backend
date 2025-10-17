const { request, response } = require("express");
const LeadModel = require("../models/LeadModel");

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

const getLeadAction = async (request, response) => {
  try {
    const result = await LeadModel.getLeadAction();
    return response.status(200).send({
      message: "Lead action fetched successfully",
      result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching lead action",
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
  const { region_id } = request.query;
  try {
    const result = await LeadModel.getBranches(region_id);
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
    whatsapp_phone_code,
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
    lead_type_id,
    lead_status_id,
    next_follow_up_date,
    expected_join_date,
    branch_id,
    batch_track_id,
    comments,
    created_date,
    region_id,
  } = request.body;
  try {
    const result = await LeadModel.insertLead(
      user_id,
      name,
      phone_code,
      phone,
      whatsapp_phone_code,
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
      lead_type_id,
      lead_status_id,
      next_follow_up_date,
      expected_join_date,
      branch_id,
      batch_track_id,
      comments,
      created_date,
      region_id
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
  const {
    name,
    email,
    phone,
    start_date,
    end_date,
    lead_status_id,
    user_ids,
    page,
    limit,
  } = request.body;
  try {
    const leads = await LeadModel.getLeads(
      name,
      email,
      phone,
      start_date,
      end_date,
      lead_status_id,
      user_ids,
      page,
      limit
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
  const { user_ids, from_date, to_date, name, email, phone, page, limit } =
    request.body;
  try {
    const leads = await LeadModel.getLeadFollowUps(
      user_ids,
      from_date,
      to_date,
      name,
      email,
      phone,
      page,
      limit
    );
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
    whatsapp_phone_code,
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
    lead_type_id,
    lead_status_id,
    next_follow_up_date,
    expected_join_date,
    branch_id,
    batch_track_id,
    comments,
    lead_id,
    region_id,
  } = request.body;
  try {
    const result = await LeadModel.updateLead(
      name,
      phone_code,
      phone,
      whatsapp_phone_code,
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
      lead_type_id,
      lead_status_id,
      next_follow_up_date,
      expected_join_date,
      branch_id,
      batch_track_id,
      comments,
      lead_id,
      region_id
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

const getLeadCount = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await LeadModel.getLeadCount(user_ids, start_date, end_date);
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

const getRegion = async (request, response) => {
  try {
    const result = await LeadModel.getRegion();
    return response.status(200).send({
      message: "Region fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching region",
      details: error.message,
    });
  }
};

const getAreas = async (request, response) => {
  try {
    const result = await LeadModel.getAreas();
    return response.status(200).send({
      message: "Areas fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching areas",
      details: error.message,
    });
  }
};

const insertArea = async (request, response) => {
  const { area_name } = request.body;
  try {
    const result = await LeadModel.insertArea(area_name);
    return response.status(201).send({
      message: "Area inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting area",
      details: error.message,
    });
  }
};

const assignLead = async (request, response) => {
  const { leads } = request.body;
  try {
    const result = await LeadModel.assignLead(leads);
    return response.status(200).send({
      message: "Leads assigned successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while assigning lead",
      details: error.message,
    });
  }
};

const checkEmailMblExists = async (request, response) => {
  const { email, mobile } = request.query;
  try {
    const result = await LeadModel.checkEmailMblExists(email, mobile);
    return response.status(200).send({
      message: "Validation successfull",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while validating",
      details: error.message,
    });
  }
};

const getLeadCountByUser = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await LeadModel.getLeadCountByUser(
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

const getFollowupCountByUser = async (request, response) => {
  const { user_ids, start_date, end_date } = request.body;
  try {
    const result = await LeadModel.getFollowupCountByUser(
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
  getLeadCount,
  getRegion,
  getLeadAction,
  getAreas,
  insertArea,
  assignLead,
  checkEmailMblExists,
  getLeadCountByUser,
  getFollowupCountByUser,
};
