// controllers/whatsappController.js
const WhatsAppModel = require("../models/WhatsAppModal");

const sendWhatsAppMessage = async (req, res) => {
  const { to, templateName, bodyParams, pdfLink, pdfFileName } = req.body;

  try {
    const result = await WhatsAppModel.sendWhatsAppMessage(
      to,
      templateName,
      bodyParams,
      pdfLink,
      pdfFileName
    );
    return res.status(200).send({
      message: "WhatsApp message sent successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error sending WhatsApp message",
      details: error.message,
    });
  }
};

module.exports = { sendWhatsAppMessage };
