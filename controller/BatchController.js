const { request, response } = require("express");
const BatchModel = require("../models/BatchModel");

const createBatch = async (request, response) => {
  const {
    batch_name,
    trainer_id,
    region_id,
    branch_id,
    customers,
    created_by,
    created_date,
    status,
    start_date,
    end_date,
    start_time,
    end_time,
    course_id,
    type,
  } = request.body;
  try {
    const result = await BatchModel.createBatch(
      batch_name,
      trainer_id,
      region_id,
      branch_id,
      customers,
      created_by,
      created_date,
      status,
      start_date,
      end_date,
      start_time,
      end_time,
      course_id,
      type,
    );
    response.status(201).send({
      message: "Batch created successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while creating batch",
      details: error.message,
    });
  }
};

const getBatches = async (request, response) => {
  const {
    trainer_id,
    batch_id,
    start_date,
    end_date,
    region_id,
    branch_id,
    customer_search_filter,
    type,
  } = request.body;
  try {
    const result = await BatchModel.getBatches(
      trainer_id,
      batch_id,
      start_date,
      end_date,
      region_id,
      branch_id,
      customer_search_filter,
      type,
    );
    response.status(200).send({
      message: "Batches fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching batches",
      details: error.message,
    });
  }
};

const updateBatch = async (request, response) => {
  const {
    batch_id,
    batch_name,
    trainer_id,
    region_id,
    branch_id,
    customers,
    status,
    start_date,
    end_date,
    start_time,
    end_time,
    course_id,
  } = request.body;
  try {
    const result = await BatchModel.updateBatch(
      batch_id,
      batch_name,
      trainer_id,
      region_id,
      branch_id,
      customers,
      status,
      start_date,
      end_date,
      start_time,
      end_time,
      course_id,
    );
    response.status(201).send({
      message: "Batch created successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while creating batch",
      details: error.message,
    });
  }
};

const deleteBatch = async (request, response) => {
  const { batch_id } = request.query;
  try {
    const result = await BatchModel.deleteBatch(batch_id);
    response.status(201).send({
      message: "Batch deleted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while deleting batch",
      details: error.message,
    });
  }
};

const batchStudents = async (request, response) => {
  const { name, mobile, email, page, limit, trainer_id } = request.body;
  try {
    const result = await BatchModel.batchStudents(
      name,
      mobile,
      email,
      page,
      limit,
      trainer_id,
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
  createBatch,
  getBatches,
  updateBatch,
  deleteBatch,
  batchStudents,
};
