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
  } = request.body;
  try {
    const result = await BatchModel.createBatch(
      batch_name,
      trainer_id,
      region_id,
      branch_id,
      customers,
      created_by,
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

module.exports = {
  createBatch,
};
