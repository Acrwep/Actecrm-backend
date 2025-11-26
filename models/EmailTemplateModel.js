const pool = require("../config/dbconfig");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_HOST,
  auth: {
    user: process.env.SMTP_FROM, // Replace with your email
    pass: process.env.SMTP_PASS, // Replace with your email password or app password for Gmail
  },
});

const EmailTemplateModel = {
  addTemplate: async (name, content, user_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM email_templates WHERE user_id = ? AND name = ?`,
        [user_id, name]
      );

      if (isExists.length > 0) throw new Error("Name already exists");

      const [result] = await pool.query(
        `INSERT INTO email_templates(name, content, user_id) VALUES(?, ?, ?)`,
        [name, content, user_id]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTemplates: async (user_id) => {
    try {
      const [result] = await pool.query(
        `SELECT id, name, content, created_date, user_id FROM email_templates WHERE user_id = ? ORDER BY name ASC`,
        [user_id]
      );

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateTemplate: async (template_id, name, content, user_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT * FROM email_templates WHERE id = ?`,
        [template_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid Id");

      const [nameExists] = await pool.query(
        `SELECT * FROM email_templates WHERE id <> ? AND name = ? AND user_id = ?`,
        [template_id, name, user_id]
      );

      if (nameExists.length > 0) throw new Error("Name already exists");

      const [result] = await pool.query(
        `UPDATE email_templates SET name = ?, content = ? WHERE id = ?`,
        [name, content, template_id]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteTemplate: async (template_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT * FROM email_templates WHERE id = ?`,
        [template_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid Id");

      const [result] = await pool.query(
        `DELETE FROM email_templates WHERE id = ?`,
        [template_id]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  emailSend: async (email, subject, content) => {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: email,
        subject: subject,
        html: content,
      };

      await transporter.sendMail(mailOptions);
      return { success: true, message: "Mail sent successfully" };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = EmailTemplateModel;
