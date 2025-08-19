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
    const [isTrainerExists] = await pool.query(
      `SELECT id FROM trainer WHERE id = ?`,
      [trainer_id]
    );
    if (isTrainerExists.length <= 0) throw new Error("Trainer not exists");
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Registration From",
      text: `Click the below link to complete the registration.`,
      html: `<a href="${link}/${trainer_id}">Link</a>`,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Mail sent successfully" };
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = {
  sendMail,
};
