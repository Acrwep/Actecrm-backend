const nodemailer = require("nodemailer");
const pool = require("../config/dbconfig");
const { getCurrentYear } = require("../validation/Validation");

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
      html: ` <table align="center" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #ddd; border-radius: 6px;">
      <tr>
        <td style="padding: 18px 12px 12px 12px; text-align: center; color: #ffffff; font-size: 22px; font-weight: bold; border-top-left-radius: 6px; border-top-right-radius: 6px;">
          <img src="cid:companyLogo" alt="Company Logo" width="100" style="display: block; margin: 0 auto;" />
        </td>

        <tr>
  <td style="padding: 0 10px;">
    <div style="border-bottom: 1px solid #e0e0e0; margin: 10px 0;"></div>
  </td>
</tr>
      </tr>
      <tr>
        <td style="padding: 0px 0px 20px 20px; color: #333333; font-size: 15px; line-height: 1.6;">
          <p>Dear Trainer,</p>
          <p>
            We are excited to invite you to complete your registration as a trainer with us.  
            Please click the button below to access the registration form:
          </p>
          <p style="text-align: center; margin: 20px 0;">
            <a href=${link} target="_blank" style="background: #5b69ca; color: #ffffff; text-decoration: none; padding: 6px 12px; font-size: 14px; font-weight: bold; border-radius: 6px; display: inline-block;">
              Complete Registration
            </a>
          </p>
          <p>
            If the button above does not work, please copy and paste the following link into your browser:
          </p>
          <p style="word-break: break-all; color: #5b69ca; font-size: 14px;">
            ${link}
          </p>
          <p>
            Thank you for joining us. We look forward to working with you!
          </p>
          <p style="margin-top: 30px;">Best Regards,<br/>Acte Technologies</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 15px; text-align: center; background: #f0f0f0; font-size: 12px; color: #777777; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">
          © ${getCurrentYear()} Acte Technologies. All rights reserved.
        </td>
      </tr>
    </table>`,
      attachments: [
        {
          filename: "logo.png", // name of the file
          path: "./acte-logo.png", // local path of your logo file
          cid: "companyLogo", // same cid as used in <img src="cid:companyLogo">
        },
      ],
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
