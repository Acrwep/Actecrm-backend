const AdmissionModel = require("../models/AdmissionModel");

const getAdmissions = async (request, response) => {
  const {
    from_date,
    to_date,
    search_filter,
    user_ids,
    page,
    limit,
    bucket,
    region_id,
    branch_id,
  } = request.body;
  try {
    const result = await AdmissionModel.getAdmissions(
      from_date,
      to_date,
      search_filter,
      user_ids,
      page,
      limit,
      bucket,
      region_id,
      branch_id,
    );
    return response.status(200).send({
      messages: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching data",
      details: error.message,
    });
  }
};

module.exports = {
  getAdmissions,
};
