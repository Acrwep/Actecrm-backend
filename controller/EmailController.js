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
  try {
    const invoiceData = {
      invoiceNumber: "INV-1001",
      invoiceDate: new Date().toLocaleDateString(),
      customerName: "John Doe",
      customerEmail: "johndoe@example.com",
      customerPhone: "9876543210",
      customerId: "CUST-001",
      paymentMode: "Online",
      preparedBy: "Admin",
      branch: "Chennai",

      // ✅ Products Table Data
      products: [
        {
          name: "React Training",
          paid: 10000,
          discount: "4%",
          gst: 1000,
          convenienceFee: 200,
        },
        {
          name: "Node.js Training",
          paid: 12000,
          discount: "5%",
          gst: 1200,
          convenienceFee: 300,
        },
        {
          name: "Angular Training",
          paid: 9000,
          discount: "3%",
          gst: 900,
          convenienceFee: 150,
        },
      ],

      // ✅ Totals
      subtotal: 31000, // sum of paid amounts
      stateGst: 1550, // example value
      centralGst: 1550, // example value
      convenienceFee: 650, // sum of convenience fees
      totalFee: 34100, // subtotal + gst + convenience
      received: 34100,
      balance: 0.0,

      email: "hublogfrontend@gmail.com", // ✅ receiver
    };

    const result = await EmailModel.sendInvoiceMail(invoiceData);

    res.status(201).send({
      message: "Mail sent successfully with invoice",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error while sending email",
      details: error.message,
    });
  }
};

module.exports = {
  sendMail,
  sendInvoiceMail,
  sendCustomerMail,
};
