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
  const { trainer_id, batch_id, start_date, end_date } = request.body;
  try {
    const result = await BatchModel.getBatches(
      trainer_id,
      batch_id,
      start_date,
      end_date,
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
  const { batch_id, batch_name, trainer_id, region_id, branch_id, customers } =
    request.body;
  try {
    const result = await BatchModel.updateBatch(
      batch_id,
      batch_name,
      trainer_id,
      region_id,
      branch_id,
      customers,
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

const batchStudents = async (request, response) => {
  const { page, limit } = request.body;
  try {
    const result = await BatchModel.batchStudents(page, limit);
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
  batchStudents,
};
