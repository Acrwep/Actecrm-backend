const { request, response } = require("express");
const BulkSearchModel = require("../models/BulkSearchModel");

const bulkSearch = async (request, response) => {
  const { users_data } = request.body;
  try {
    const data = await BulkSearchModel.bulkSearch(users_data);
    return response.status(200).send({
      message: "Bulk search completed successfully",
      data: data,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error in bulk searching",
      details: error.message,
    });
  }
};

module.exports = {
  bulkSearch,
};
