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

const sendCustomerMail = async (request, response) => {
  const { email, link, customer_id } = request.body;
  try {
    const result = await EmailModel.sendCustomerMail(email, link, customer_id);
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

const sendInvoiceMail = async (req, res) => {
  const {
    email,
    name,
    mobile,
    convenience_fees,
    discount,
    discount_amount,
    gst_amount,
    gst_percentage,
    invoice_date,
    invoice_number,
    paid_amount,
    balance_amount,
    payment_mode,
    tax_type,
    total_amount,
    course_name,
    sub_total,
  } = req.body;

  try {
    const result = await EmailModel.sendInvoiceMail(
      email,
      name,
      mobile,
      convenience_fees,
      discount,
      discount_amount,
      gst_amount,
      gst_percentage,
      invoice_date,
      invoice_number,
      paid_amount,
      balance_amount,
      payment_mode,
      tax_type,
      total_amount,
      course_name,
      sub_total
    );

    res.status(201).send({
      message: "Mail sent successfully with invoice",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while sending invoice",
      details: error.message,
    });
  }
};

const sendCourseCertificate = async (req, res) => {
  try {
    const result = await EmailModel.sendCourseCertificate(
      "hublogfrontend@gmail.com"
    );

    res.status(201).send({
      message: "Mail sent successfully with certificate",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while sending certificate",
      details: error.message,
    });
  }
};

module.exports = {
  sendMail,
  sendInvoiceMail,
  sendCustomerMail,
  sendCourseCertificate,
};
