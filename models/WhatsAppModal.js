const pool = require("../config/dbconfig");

const WhatsAppModel = {
  createMessage: async (data) => {
    try {
      const {
        lead_id,
        customer_id,
        mobile,
        customer_name,
        course_name,
        campaign_name,
        template_params,
        status,
        aisensy_response,
        sent_by,
        created_at,
      } = data;

      const query = `
        INSERT INTO whatsapp_messages
        (
          lead_id,
          customer_id,
          mobile,
          customer_name,
          course_name,
          campaign_name,
          template_params,
          status,
          aisensy_response,
          sent_by,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        lead_id || null,
        customer_id || null,
        mobile,
        customer_name || null,
        course_name || null,
        campaign_name,
        JSON.stringify(template_params || []),
        status || "pending",
        JSON.stringify(aisensy_response || {}),
        sent_by || null,
        created_at,
      ];

      const [result] = await pool.query(query, values);

      return result;
    } catch (error) {
      console.error("WhatsApp Model Error:", error);
      throw error;
    }
  },
};

module.exports = WhatsAppModel;
