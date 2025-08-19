const nodemailer = require("nodemailer");
const pool = require("../config/dbconfig");

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_HOST,
  auth: {
    user: process.env.SMTP_FROM, // Replace with your email
    pass: process.env.SMTP_PASS, // Replace with your email password or app password for Gmail
  },
});

const sendMail = async (email, link, trainer_id) => {
  try {
    // Check the trainer already exists
    const [isTrainerExists] = await pool.query(
      `SELECT id FROM trainer WHERE id = ?`,
      [trainer_id]
    );
    if (isTrainerExists.length <= 0) throw new Error("Trainer not exists");

    // Check link already send to trainer
    const [isLinkSent] = await pool.query(
      `SELECT id FROM trainer WHERE id = ? AND is_form_sent = 1`,
      [trainer_id]
    );
    if (isLinkSent.length > 0) throw new Error("Link has already been sent");
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Registration From",
      text: `Click the below link to complete the registration.`,
      html: `<a href="${link}/${trainer_id}">Link</a>`,
    };

    // Update trainer table
    const [updateTrainer] = await pool.query(
      `UPDATE trainer SET is_form_sent = 1 WHERE id = ?`,
      [trainer_id]
    );

    // Send mail
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Mail sent successfully" };
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = {
  sendMail,
};
