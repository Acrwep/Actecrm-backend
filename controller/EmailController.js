const { request, response } = require("express");
const EmailModel = require("../models/EmailModel");

const sendMail = async (request, response) => {
  const { email } = request.body;
  try {
    const result = await EmailModel.sendMail(email);
    return response.status(201).send({
      message: "Mail sent successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while sending mail",
      details: error.message,
    });
  }
};

module.exports = {
  sendMail,
};
