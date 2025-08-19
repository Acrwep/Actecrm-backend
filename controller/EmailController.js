const { request, response } = require("express");
const EmailModel = require("../models/EmailModel");

const sendMail = async (request, response) => {
  const { email, link, trainer_id } = request.body;
  try {
    const result = await EmailModel.sendMail(email, link, trainer_id);
    return response.status(201).send({
      message: "Mail sent successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while sending email",
      details: error.message,
    });
  }
};

module.exports = {
  sendMail,
};
