const axios = require("axios");
const WhatsAppModel = require("../models/WhatsAppModal");

// Existing text WhatsApp API
const sendWhatsApp = async (req, res) => {
  try {
    const { mobile, customer_name, course_name, lead_id, customer_id } =
      req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    const campaignName = "acte_crm_test";

    const templateParams = [customer_name || "Customer", course_name || ""];

    const payload = {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName,
      destination: mobile,
      userName: customer_name || "Customer",
      source: "ACTE CRM",
      templateParams,
    };

    const response = await axios.post(process.env.AISENSY_API_URL, payload);

    await WhatsAppModel.createMessage({
      lead_id,
      customer_id,
      mobile,
      customer_name,
      course_name,
      campaign_name: campaignName,
      template_params: templateParams,
      status: "sent",
      aisensy_response: response.data,
      sent_by: req.user?.user_id || null,
    });

    return res.status(200).json({
      success: true,
      message: "WhatsApp message sent successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("AiSensy Error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to send WhatsApp message",
      error: error.response?.data || error.message,
    });
  }
};

// Invoice PDF WhatsApp API
const sendInvoiceWhatsApp = async (req, res) => {
  try {
    const {
      mobile,
      customer_name,
      invoice_number,
      invoice_url,
      paid_amount,
      lead_id,
      customer_id,
    } = req.body;

    // Validate required fields
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    if (!invoice_url) {
      return res.status(400).json({
        success: false,
        message: "Invoice URL is required",
      });
    }

    if (!invoice_number) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required",
      });
    }

    if (paid_amount === undefined || paid_amount === null) {
      return res.status(400).json({
        success: false,
        message: "Paid amount is required",
      });
    }

    // Must exactly match your AiSensy API Campaign name
    const campaignName = "acte_payment_invoice";

    /*
      AiSensy Template:

      {{1}} = Customer Name
      {{2}} = Invoice Number
      {{3}} = Amount Paid
    */

    const templateParams = [
      customer_name || "Customer",
      String(invoice_number),
      String(paid_amount),
    ];

    const fileName = `Invoice_${invoice_number}.pdf`;

    const payload = {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName,
      destination: mobile,
      userName: customer_name || "Customer",
      source: "ACTE CRM",

      media: {
        url: invoice_url,
        filename: fileName,
      },

      templateParams,
    };

    console.log("AiSensy Invoice Payload:", {
      ...payload,
      apiKey: "***HIDDEN***",
    });

    // Send invoice to AiSensy
    const response = await axios.post(process.env.AISENSY_API_URL, payload);

    // Save WhatsApp history
    await WhatsAppModel.createMessage({
      lead_id,
      customer_id,
      mobile,
      customer_name,
      course_name: null,
      campaign_name: campaignName,
      template_params: templateParams,
      status: "sent",
      aisensy_response: response.data,
      sent_by: req.user?.user_id || null,
    });

    return res.status(200).json({
      success: true,
      message: "Invoice sent successfully on WhatsApp",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "AiSensy Invoice Error:",
      error.response?.data || error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to send invoice on WhatsApp",
      error: error.response?.data || error.message,
    });
  }
};

module.exports = {
  sendWhatsApp,
  sendInvoiceWhatsApp,
};
