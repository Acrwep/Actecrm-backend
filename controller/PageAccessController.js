const { request, response } = require("express");
const PageAccessModel = require("../models/PageAccessModel");

const getFeatures = async (request, response) => {
  try {
    const result = await PageAccessModel.getFeatures();
    return response.status(200).send({
      massage: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const insertFeature = async (request, response) => {
  const { feature_name } = request.body;
  try {
    const result = await PageAccessModel.insertFeature(feature_name);
    return response.status(201).send({
      massage: "Feature inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting feature",
      details: error.message,
    });
  }
};

module.exports = {
  getFeatures,
  insertFeature,
};
