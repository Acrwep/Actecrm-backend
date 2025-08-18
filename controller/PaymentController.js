const { request, response } = require("express");
const PaymentModel = require("../models/PaymentModel");

const getPaymentModes = async (request, response) => {
  try {
    const paymodes = await PaymentModel.getPaymentModes();
    return response.status(200).send({
      messages: "Payment modes fetched successfully",
      data: paymodes,
    });
  } catch (error) {
    response.status(500).send({
      messages: "Error while fetching payment modes",
      details: error.messages,
    });
  }
};

module.exports = {
  getPaymentModes,
};
