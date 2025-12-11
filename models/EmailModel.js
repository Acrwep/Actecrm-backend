const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const pool = require("../config/dbconfig");
const { getCurrentYear } = require("../validation/Validation");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_HOST,
  auth: {
    user: process.env.SMTP_FROM, // Replace with your email
    pass: process.env.SMTP_PASS, // Replace with your email password or app password for Gmail
  },
});

const sendWelcomeMail = async (email, name) => {
  try {
    // Check the email already exists
    const [isEmailExists] = await pool.query(
      `SELECT id, name FROM customers WHERE email = ?`,
      [email]
    );
    if (isEmailExists.length <= 0) throw new Error("Email not exists");

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Welcome to ACTE",
      text: `Click the below link to complete the registration.`,
      html: `<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Welcome to ACTE</title>
</head>

<body
    style="margin:0;padding:0;background-color:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
    <!-- Preheader -->
    <div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">
        Welcome to ACTE Technologies — your premium learning journey begins.
    </div>

    <!-- Outer wrapper -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f4f6"
        style="padding:8px 16px;">
        <tr>
            <td align="center">
                <!-- Main container -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 6px 30px rgba(0,0,0,0.1);overflow:hidden;">

                    <!-- Header -->
                      <tr>
        <td style="padding: 24px 12px 12px 12px; text-align: center; color: #ffffff; font-size: 22px; font-weight: bold; border-top-left-radius: 6px; border-top-right-radius: 6px;">
          <img src="cid:companyLogo" alt="Company Logo" width="110" style="display: block; margin: 0 auto;" />
        </td>

         <tr>
  <td style="padding: 0 10px;">
    <div style="border-bottom: 1px solid #e0e0e0; margin: 10px 0;"></div>
  </td>
</tr>

        <tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:12px 40px 48px 40px;background:#ffffff;">
                            <h1
                                style="color:#111827;margin:0 0 20px;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                                Welcome to Your Learning Journey 🚀
                            </h1>

                            <p style="color:#4b5563;font-size:16px;margin:0 0 16px;">Dear ${name},</p>

                            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">
                                We’re delighted to welcome you to our premium learning community. Prepare yourself for a
                                transformative journey filled with knowledge, skills, and growth. Our dedicated team is
                                committed to guiding you every step of the way.
                            </p>

                            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">
                                <strong style="color:#111827;">We're here to help!</strong> Whenever you need
                                clarification, guidance, or support, our experts are just a message away — because your
                                success is our mission.
                            </p>

                            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 28px;">
                                Let’s celebrate every milestone you achieve with ACTE. Stay curious. Keep learning. Keep
                                growing.
                            </p>

                            <!-- Signature -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td
                                        style="background:#f9fafb;padding:24px;border-radius:12px;border-left:5px solid #0066ff;">
                                        <p style="margin:0;font-size:16px;color:#111827;font-weight:600;">Best Regards,
                                        </p>
                                        <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">Relationship
                                            Associate<br>ACTE Technologies</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:28px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="left" style="color:#9ca3af;font-size:13px;">
                                        &copy; 2025 ACTE Technologies. All rights reserved.
                                    </td>
                                    <td align="right" style="color:#9ca3af;font-size:13px;">
                                        Need help? <a href="#"
                                            style="color:#4b5563;text-decoration:none;font-weight:500;">Contact
                                            Support</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>

</html>`,
      attachments: [
        {
          filename: "logo.png", // name of the file
          path: "./acte-logo.png", // local path of your logo file
          cid: "companyLogo", // same cid as used in <img src="cid:companyLogo">
        },
      ],
    };

    // Send mail
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Mail sent successfully" };
  } catch (error) {
    throw new Error(error.message);
  }
};

const sendMail = async (email, link, trainer_id) => {
  try {
    // Check the trainer already exists
    const [isTrainerExists] = await pool.query(
      `SELECT id, name FROM trainer WHERE id = ?`,
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
      subject: "ACTE Registration From",
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
          <p>Hi ${isTrainerExists[0].name},</p>
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

const sendCustomerMail = async (email, link, customer_id) => {
  try {
    // Check the customer already exists
    const [isCusExists] = await pool.query(
      `SELECT id, name FROM customers WHERE id = ?`,
      [customer_id]
    );
    if (isCusExists.length <= 0) throw new Error("Trainer not exists");

    // Check link already send to trainer
    const [isLinkSent] = await pool.query(
      `SELECT id FROM customers WHERE id = ? AND is_form_sent = 1`,
      [customer_id]
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
          <p>Hi ${isCusExists[0].name},</p>
          <p>
            We are excited to invite you to complete your registration as a student with us.  
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
    const [updateCustomer] = await pool.query(
      `UPDATE customers SET is_form_sent = 1 WHERE id = ?`,
      [customer_id]
    );

    // Send mail
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Mail sent successfully" };
  } catch (error) {
    throw new Error(error.message);
  }
};

const sendCourseCertificate = async (email, customer_id) => {
  const sql = `SELECT
                      id,
                      customer_id,
                      customer_name,
                      course_name,
                      course_duration,
                      course_completion_month,
                      certificate_number,
                      location,
                      created_at
                  FROM
                      certificates
                  WHERE
                      customer_id = ?`;
  const [result] = await pool.query(sql, [customer_id]);
  const pdfPath = path.join(process.cwd(), "certificate.pdf");

  // Helper to read image and convert to Base64
  const getBase64Image = (filePath) => {
    if (!fs.existsSync(filePath)) return "";
    const data = fs.readFileSync(filePath, { encoding: "base64" });
    return `data:image/png;base64,${data}`;
  };
  const acteLogoBase64 = getBase64Image(
    process.env.ACTE_TECHNOLOGIES_LOGO_PATH
  );

  const certLogoBase64 = getBase64Image(process.env.CERTIFICATE_LOGO);

  const chairmanSignBase64 = getBase64Image(
    process.env.CHAIRMAN_SIGNATURE_PATH
  );
  const viceChairmanSignBase64 = getBase64Image(
    process.env.VICE_CHAIRMAN_SIGNATURE_PATH
  );
  const memberSignBase64 = getBase64Image(process.env.MEMBER_SIGNATURE_PATH);

  // 1. HTML Template
  const htmlContent = `
<html>
<head>
  <meta charset="UTF-8" />
  <title>ACTE Certificate</title>
   <!-- Add Google Fonts link -->
  <style>
  <style>
    @page { margin: 0; }
    html, body { width:100%; height:100%; margin:0; padding:0;font-family:'Poppins', sans-serif;}
    body { display:flex; justify-content:center; align-items:center; }
    table { border-collapse:collapse; }
  </style>
</head>
<body>
  <table width="100%" height="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:35px solid #03396c; border-radius:0; background:transparent; border-collapse:collapse;">
    <tr>
      <td style="padding:0; margin:0;background-color:#03396c">
  <table width="100%" height="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:10px solid #f49f20; border-radius:60px; border-collapse: separate; overflow: hidden;background-color:white">
          <tr>
            <td style="padding:3; margin:0;">
              <table width="100%" height="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:3px solid #03396c; border-radius:50px; border-collapse: separate; overflow: hidden;background-color:white">
                <tr>
                  <td style="padding:16px 40px 40px 40px; text-align:center;">
                    <!-- Header -->
                   <img src="${certLogoBase64}" style="width:130px; height:auto; position:absolute; top:6px; left:50%; transform:translateX(-50%);" />
                    
                   <img src="${acteLogoBase64}" style="width:240px; height:auto; display:block;margin:60px auto 10px auto;" />
                    <p style="margin:10px 0; font-size:18px;line-height:1.6">The Academic Council of ACTE <br/>Having Duly Examined</p>
                    <h3 style="margin:20px 0 10px; font-size:24px; font-weight:bold;">
                      ${result[0].customer_name}
                    </h3>
                    <p style="margin:10px 0; font-size:18px; line-height:1.6;">
                      During and After ${
                        result[0].course_duration
                      } months of Study on the Specified Curriculum<br />
                      And having found the Candidate's Performance to be
                    </p>
                    <h3 style="margin:20px 0 10px; font-size:26px; font-weight:bold; color:#0a4682;">EXCELLENT</h3>
                    <p style="margin:10px 0; font-size:18px;">Have Pleasure in Recognizing this Attainment with the Title of</p>
                    <h4 style="margin:15px 0; font-size:28px; font-weight:bold; color:#0a4682;">
                      ${result[0].course_name}
                    </h4>
                    <p style="margin:10px 0; font-size:18px; line-height:1.6;">
                      Given under our hand and Seal on<br />
                      the month of ${result[0].course_completion_month}<br />
                      At ${result[0].location}, India
                    </p>

                    <!-- Signatures -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:40px;">
                      <tr>
                        ${[
                          {
                            name: "Chairman",
                            title: "Of the Academic Council",
                            img: chairmanSignBase64,
                          },
                          {
                            name: "Vice-Chairman",
                            title: "Of the Academic Council",
                            img: viceChairmanSignBase64,
                          },
                          {
                            name: "Member",
                            title: "Of the Academic Council",
                            img: memberSignBase64,
                          },
                        ]
                          .map(
                            (sig) => `
<td align="center" style="width:33%; padding:0 10px; vertical-align:bottom;">
  <div style="display:flex; flex-direction:column; align-items:center;">
    ${
      sig.img
        ? `<img src="${sig.img}" style="width:160px; height:auto; display:block;" />`
        : ""
    }
    <p style="margin:0; font-size:14px;">${sig.name}</p>
    <p style="margin:0; font-size:14px;">${sig.title}</p>
  </div>
</td>`
                          )
                          .join("")}
                      </tr>
                    </table>

                    <!-- Footer -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" 
                           style="margin-top:30px; border-top:1px solid #000; padding-top:10px;">
                      <tr>
                      <td align="right" style="font-size:13px;padding-top:8px;font-weight:500;">
                      <strong>Certificate No.:</strong> ${
                        result[0].certificate_number
                      }
                      </td>

                      </tr>
                    </table>

                    <!-- Legend -->
                    <div style="margin-top: 20px; display:inline-block; border: 1px solid #000;
                                padding: 10px 15px; font-size: 12px; text-align: left;">
                      <strong style="display:block; margin-bottom:5px; text-align:center;">LEGEND</strong>
                      <table style="border-collapse: collapse; font-size: 12px;">
                        <tr><td style="padding-right:10px;">50-59.9</td><td>: Satisfactory</td></tr>
                        <tr><td style="padding-right:10px;">60-69.9</td><td>: Fair</td></tr>
                        <tr><td style="padding-right:10px;">70-79.9</td><td>: Good</td></tr>
                        <tr><td style="padding-right:10px;">80-100</td><td>: Excellent</td></tr>
                      </table>
                    </div>

                    <!-- Watermark -->
                    <p style="margin-top:20px; font-size:10px; color:#666;">
                      RD5 -11117 | www.acte.in
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // 2. Launch Puppeteer and create PDF
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    width: "8.27in", // exact A4 width
    height: "12.05in", // exact A4 height
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();

  // 3. Send mail
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Acte Course Certificate",
    text: "Please find your course certificate attached.",
    attachments: [{ filename: "certificate.pdf", path: pdfPath }],
  });
};

const sendPaymentMail = async (email, name) => {
  try {
    // Check the email already exists
    const [isEmailExists] = await pool.query(
      `SELECT id, name FROM customers WHERE email = ?`,
      [email]
    );
    if (isEmailExists.length <= 0) throw new Error("Email not exists");

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "ACTE Payment Verification",
      text: `Click the below link to complete the registration.`,
      html: `<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>ACTE Payment Verification</title>
</head>

<body
    style="margin:0;padding:0;background-color:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
    <!-- Preheader -->
    <div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">
        Your payment verification is in process. You’ll receive your invoice shortly. Thank you for your patience.
    </div>

    <!-- Outer wrapper -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f4f6"
        style="padding:8px 16px;">
        <tr>
            <td align="center">
                <!-- Main container -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 6px 30px rgba(0,0,0,0.1);overflow:hidden;">

                    <!-- Header -->
                      <tr>
        <td style="padding: 24px 12px 12px 12px; text-align: center; color: #ffffff; font-size: 22px; font-weight: bold; border-top-left-radius: 6px; border-top-right-radius: 6px;">
          <img src="cid:companyLogo" alt="Company Logo" width="110" style="display: block; margin: 0 auto;" />
        </td>

         <tr>
  <td style="padding: 0 10px;">
    <div style="border-bottom: 1px solid #e0e0e0; margin: 10px 0;"></div>
  </td>
</tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:12px 40px 48px 40px;background:#ffffff;">
                            <h1
                                style="color:#111827;margin:0 0 20px;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                                Payment Verification in Progress 🧾
                            </h1>

                            <p style="color:#4b5563;font-size:16px;margin:0 0 18px;">👋 Dear ${name},</p>

                            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">
                                💡 Greetings from <strong>ACTE Technologies!</strong><br>
                                We are delighted to welcome you as part of our learning community. 🎓✨
                            </p>

                            <div
                                style="margin:26px 0;padding:22px;border-radius:12px;background:#f9fafb;border-left:5px solid #0066ff;">
                                <p style="margin:0;color:#111827;font-size:16px;line-height:1.7;">
                                    🧾 Your <strong>payment verification</strong> is currently in process.<br>
                                    Once it is successfully completed, you will receive your invoice shortly.
                                </p>
                            </div>

                            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">
                                ⏳ We truly appreciate your patience and understanding during this short waiting period.
                            </p>

                            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 28px;">
                                🤝 Please don’t hesitate to reach out if you require any additional information or
                                assistance — we are here to support you at every step of your journey. 🌟
                            </p>

                            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 28px;">
                                🌈 Here’s to your learning and success with ACTE! 🚀
                            </p>

                            <!-- Signature -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td
                                        style="background:#f9fafb;padding:24px;border-radius:12px;border-left:5px solid #0066ff;">
                                        <p style="margin:0;font-size:16px;color:#111827;font-weight:600;">Best Regards,
                                        </p>
                                        <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">ACTE Technologies</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:28px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="left" style="color:#9ca3af;font-size:13px;">
                                        &copy; 2025 ACTE Technologies. All rights reserved.
                                    </td>
                                    <td align="right" style="color:#9ca3af;font-size:13px;">
                                        Need help? <a href="#"
                                            style="color:#4b5563;text-decoration:none;font-weight:500;">Contact
                                            Support</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>

</html>`,
      attachments: [
        {
          filename: "logo.png", // name of the file
          path: "./acte-logo.png", // local path of your logo file
          cid: "companyLogo", // same cid as used in <img src="cid:companyLogo">
        },
      ],
    };

    // Send mail
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Mail sent successfully" };
  } catch (error) {
    throw new Error(error.message);
  }
};

const sendInvoicePdf = async (
  email,
  name,
  mobile,
  convenience_fees,
  gst_amount,
  gst_percentage,
  invoice_date,
  invoice_number,
  paid_amount,
  balance_amount,
  payment_mode,
  total_amount,
  course_name,
  sub_total
) => {
  const pdfPath = path.join(process.cwd(), "invoice.pdf");

  // Get gst amount from paid amount
  const getGST = splitGSTAmount(paid_amount, gst_percentage);
  const gstForPaid = getGST.gst_amount;
  const base_amount = getGST.base_amount;

  const getBase64Image = (filePath) => {
    if (!fs.existsSync(filePath)) return "";
    const data = fs.readFileSync(filePath, { encoding: "base64" });
    return `data:image/png;base64,${data}`;
  };
  const acteLogoBase64 = getBase64Image(process.env.LOGO_PATH);
  // 1. HTML Template
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
      <meta charset="UTF-8" />
      <title>Invoice</title>
      <style>
        /* Invoice styles scoped under .invoice-box */
        .invoice-box {
          max-width: 800px;
          margin: auto;
          padding: 20px 30px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          background-color: #fff;
          color: #000;
        }

        .invoice-box .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .invoice-box .invoice-header img {
          width: 140px;
          height: auto;
        }

        .invoice-box .invoice-header .company {
          text-align: right;
          line-height: 22px;
        }

        .invoice-box .invoice-title {
          font-size: 24px;
          font-weight: bold;
          margin: 10px 0;
        }

        .invoice-box .invoice-info,
        .invoice-box .bill-to {
          margin-bottom: 20px;
          line-height: 22px;
        }

        .invoice-box .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        .invoice-box .invoice-table th,
        .invoice-box .invoice-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }

        .invoice-box .invoice-table th {
          background: #f4f4f4;
        }

        /* Totals table */
        .invoice-box .totals-container {
          margin-top: 20px;
          text-align: right;
        }

        .invoice-box .totals {
          display: inline-block;
          width: max-content;
          border-collapse: collapse;
          padding-right: 12px;
        }

        .invoice-box .totals td {
          padding: 6px;
        }

        .invoice-box .totals tr td:first-child {
          text-align: left;
        }

        .invoice-box .totals tr td:last-child {
          text-align: right;
        }

        /* Notes section */
        .invoice-box .notes {
          margin-top: 20px;
          font-size: 12px;
          font-weight: 600;
          line-height: 22px;
          clear: both;
        }

        .invoice-box .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
        }
      </style>
  </head>
  <body>
      <div class="invoice-box">
        <!-- HEADER -->
        <div class="invoice-header">
            <div>
              <img src="${acteLogoBase64}" alt="Acte Logo" />
            </div>
            <div class="company">
              <strong>Acte Technologies Private Limited</strong><br />
              No 1A Sai Adhithya Building, Taramani Link Rd,<br />
              Velachery, Chennai, Tamil Nadu 600042<br />
              Phone: +91 89259 09207<br />
              GST No: 33AAQCA7617L1Z9
            </div>
        </div>

        <div class="invoice-title">Invoice</div>

        <!-- INVOICE INFO -->
        <div class="invoice-info">
            <strong>Invoice Number:</strong> ${invoice_number}<br />
            <strong>Invoice Date:</strong> ${invoice_date}
        </div>

        <!-- BILL TO -->
        <div class="bill-to">
            <strong>Bill To:</strong><br />
            Name: ${name}<br />
            Email: ${email}<br />
            Mobile: ${mobile}
        </div>

     <!-- PRODUCT TABLE -->
<table class="invoice-table">
    <thead>
      <tr>
          <th>Product</th>
          <th>Base Price</th>
          <th>GST</th>
          <th>GST Amount</th>
          <th>Conv. Fees</th>
          <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
          <td>${course_name}</td>
          <td>₹${parseFloat(base_amount).toFixed(2)}</td>
          <td>${gst_percentage}%</td>
          <td>${gstForPaid}</td>
          <td>${parseFloat(convenience_fees ? convenience_fees : 0).toFixed(
            2
          )}</td>
          <td>₹${
            base_amount +
            parseFloat(convenience_fees ? convenience_fees : 0) +
            gstForPaid
          }</td>
      </tr>
    </tbody>
</table>

<!-- TOTALS TABLE (right-aligned below product table) -->
<div class="totals-container" style="width: max-content; margin-left: auto; margin-top: -12px">
  <table class="totals">
      <tr>
        <td>Fees:</td>
        <td>₹${sub_total}</td>
      </tr>
      <tr>
        <td>GST:</td>
        <td>₹${gst_amount}</td>
      </tr>
      <tr>
        <td><strong>Total Fees:</strong></td>
        <td><strong>₹${total_amount}</strong></td>
      </tr>
      <tr>
        <td><strong>Total Paid:</strong></td>
        <td><strong>₹${(
          parseFloat(paid_amount) +
          parseFloat(convenience_fees ? convenience_fees : 0)
        ).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td>Balance:</td>
        <td>₹${balance_amount}</td>
      </tr>
      <tr>
        <td>Payment Mode:</td>
        <td>${payment_mode}</td>
      </tr>
  </table>
</div>

        <!-- NOTES SECTION -->
        <div class="notes">
            <strong>Note:</strong><br />
            1) All Cheques / Drafts / Online Transfers to be made in favour of Acte Technologies Pvt Ltd<br />
            2) The refund requisition will not be accepted<br />
            3) Acte Technologies has rights to postpone/cancel courses due to instructor illness or natural calamities. No refund in this case.<br />
            4) The registration fee is ₹2,000 and it is non-refundable.
        </div>

        <!-- FOOTER -->
        <div class="footer">
            Happy Learning...! Thanks for choosing us...!!
        </div>
      </div>
  </body>
</html>
`;

  // 2. Launch Puppeteer and create PDF
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    width: "8.27in", // exact A4 width
    height: "12.05in", // exact A4 height
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();

  // 3. Send mail
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Acte Payment Invoice",
    text: "Please find your invoice attached.",
    attachments: [{ filename: "invoice.pdf", path: pdfPath }],
  });
};

const viewInvoicePdf = async (
  email,
  name,
  mobile,
  area,
  convenience_fees,
  gst_amount,
  gst_percentage,
  invoice_date,
  invoice_number,
  paid_amount,
  balance_amount,
  payment_mode,
  total_amount,
  course_name,
  sub_total
) => {
  const getBase64Image = (filePath) => {
    if (!fs.existsSync(filePath)) return "";
    const data = fs.readFileSync(filePath, { encoding: "base64" });
    return `data:image/png;base64,${data}`;
  };
  const acteLogoBase64 = getBase64Image(process.env.LOGO_PATH);

  // Get gst amount from paid amount
  const getGST = splitGSTAmount(paid_amount, gst_percentage);
  const gstForPaid = getGST.gst_amount;
  const base_amount = getGST.base_amount;

  // 1. HTML Template
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
      <meta charset="UTF-8" />
      <title>Invoice</title>
      <style>
        /* Invoice styles scoped under .invoice-box */
        .invoice-box {
          max-width: 800px;
          margin: auto;
          padding: 20px 30px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          background-color: #fff;
          color: #000;
        }

        .invoice-box .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .invoice-box .invoice-header img {
          width: 140px;
          height: auto;
        }

        .invoice-box .invoice-header .company {
          text-align: right;
          line-height: 22px;
        }

        .invoice-box .invoice-title {
          font-size: 24px;
          font-weight: bold;
          margin: 10px 0;
        }

        .invoice-box .invoice-info,
        .invoice-box .bill-to {
          margin-bottom: 20px;
          line-height: 26px;
        }

        .invoice-box .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        .invoice-box .invoice-table th,
        .invoice-box .invoice-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }

        .invoice-box .invoice-table th {
          background: #f4f4f4;
        }

        /* Totals table */
        .invoice-box .totals-container {
          margin-top: 20px;
          text-align: right;
        }

        .invoice-box .totals {
          display: inline-block;
          width: max-content;
          border-collapse: collapse;
          padding-right: 12px;
        }

        .invoice-box .totals td {
          padding: 6px;
        }

        .invoice-box .totals tr td:first-child {
          text-align: left;
        }

        .invoice-box .totals tr td:last-child {
          text-align: right;
        }

        /* Notes section */
        .invoice-box .notes {
          margin-top: 20px;
          font-size: 12px;
          font-weight: 600;
          line-height: 22px;
          clear: both;
        }

        .invoice-box .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
        }
      </style>
  </head>
  <body>
      <div class="invoice-box">
        <!-- HEADER -->
        <div class="invoice-header">
            <div>
              <img src="${acteLogoBase64}" alt="Acte Logo" />
            </div>
            <div class="company">
              <strong>Acte Technologies Private Limited</strong><br />
              No 1A Sai Adhithya Building, Taramani Link Rd,<br />
              Velachery, Chennai, Tamil Nadu 600042<br />
              Phone: +91 89259 09207<br />
              GST No: 33AAQCA7617L1Z9
            </div>
        </div>

        <div class="invoice-title">Invoice</div>

        <!-- INVOICE INFO -->
        <div class="invoice-info">
            <strong>Invoice Number:</strong> ${invoice_number}<br />
            <strong>Invoice Date:</strong> ${invoice_date}
        </div>

        <!-- BILL TO -->
        <div class="bill-to">
            <strong>Bill To:</strong><br />
            Name: ${name}<br />
            Email: ${email}<br />
            Mobile: ${mobile}
        </div>

     <!-- PRODUCT TABLE -->
<table class="invoice-table">
    <thead>
      <tr>
          <th>Product</th>
          <th>Base Price</th>
          <th>GST</th>
          <th>GST Amount</th>
          <th>Conv. Fees</th>
          <th>Total Paid</th>
      </tr>
    </thead>
    <tbody>
      <tr>
          <td>${course_name}</td>
          <td>₹${parseFloat(base_amount).toFixed(2)}
          <td>${gst_percentage}%</td>
          <td>${gstForPaid}</td>
          <td>${parseFloat(convenience_fees ? convenience_fees : 0).toFixed(
            2
          )}</td>
          <td>₹${
            base_amount +
            parseFloat(convenience_fees ? convenience_fees : 0) +
            gstForPaid
          }</td>
      </tr>
    </tbody>
</table>

<!-- TOTALS TABLE (right-aligned below product table) -->
<div class="totals-container" style="width: max-content; margin-left: auto; margin-top: -12px">
  <table class="totals">
      <tr>
        <td>Fees:</td>
        <td>₹${sub_total}</td>
      </tr>
      <tr>
        <td>GST:</td>
        <td>₹${gst_amount}</td>
      </tr>
      <tr>
        <td><strong>Total Fees:</strong></td>
        <td><strong>₹${total_amount}</strong></td>
      </tr>
      <tr>
        <td><strong>Total Paid:</strong></td>
        <td><strong>₹${(
          parseFloat(paid_amount) +
          parseFloat(convenience_fees ? convenience_fees : 0)
        ).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td>Balance:</td>
        <td>₹${balance_amount}</td>
      </tr>
      <tr>
        <td>Payment Mode:</td>
        <td>${payment_mode}</td>
      </tr>
  </table>
</div>

        <!-- NOTES SECTION -->
        <div class="notes">
            <strong>Note:</strong><br />
            1) All Cheques / Drafts / Online Transfers to be made in favour of Acte Technologies Pvt Ltd<br />
            2) The refund requisition will not be accepted<br />
            3) Acte Technologies has rights to postpone/cancel courses due to instructor illness or natural calamities. No refund in this case.<br />
            4) The registration fee is ₹2,000 and it is non-refundable.
        </div>

        <!-- FOOTER -->
        <div class="footer">
            Happy Learning...! Thanks for choosing us...!!
        </div>
      </div>
  </body>
</html>
`;
  return htmlContent;
};

function splitGSTAmount(paid_amount, gst_rate) {
  const gstFraction = gst_rate / (100 + gst_rate);

  const gst_amount = paid_amount * gstFraction;
  const baseAmount = paid_amount - gst_amount;

  return {
    base_amount: Number(baseAmount.toFixed(2)),
    gst_amount: Number(gst_amount.toFixed(2)),
  };
}

module.exports = {
  sendMail,
  sendCustomerMail,
  sendCourseCertificate,
  sendWelcomeMail,
  sendPaymentMail,
  sendInvoicePdf,
  viewInvoicePdf,
};
