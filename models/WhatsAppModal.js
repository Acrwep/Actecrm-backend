// models/WhatsAppModel.js
const axios = require("axios");

const WhatsAppModel = {
  sendWhatsAppMessage: async (
    to,
    templateName,
    bodyParams,
    pdfLink,
    pdfFileName
  ) => {
    console.log(to, templateName, bodyParams, pdfLink, pdfFileName);
    try {
      const url = `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`;

      const payload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" },
          components: [
            // {
            //   type: "body",
            //   parameters: bodyParams.map((text) => ({ type: "text", text })),
            // },
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: {
                    link: pdfLink,
                    filename: pdfFileName,
                  },
                },
              ],
            },
          ],
        },
      };

      const headers = {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      };

      const response = await axios.post(url, payload, { headers });
      console.log("whatsapp response", response);
      return response.data;
    } catch (error) {
      console.log("whatsapp error", error);
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  },
};

module.exports = WhatsAppModel;
