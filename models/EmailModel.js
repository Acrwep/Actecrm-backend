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

const sendInvoiceMail = async (
  email,
  name,
  mobile,
  convenience_fees,
  discount,
  discount_amount,
  gst_amount,
  gst_percentage,
  invoice_date,
  invoice_number,
  paid_amount,
  balance_amount,
  payment_mode,
  tax_type,
  total_amount,
  course_name,
  sub_total
) => {
  const pdfPath = path.join(__dirname, "../invoices/invoice.pdf");
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  // --- Generate Invoice PDF ---
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // ---------- HEADER ----------
    const logoPath = path.join(
      "C:\\Users\\ADMIN PRAKASH\\Documents\\GitHub\\Actecrm-backend",
      "acte-logo.png" // <-- replace with your actual logo file name
    );
    doc.image(logoPath, 50, 40, { width: 95 }); // X, Y, size

    // Move cursor down a bit so text doesn’t overlap the logo
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(20).text("Invoice", 50, 90);

    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Acte Technologies Private Limited", 350, 50, {
        align: "right",
        lineGap: 3, // spacing between lines
      })
      .text("No 1A Sai Adhithya Building, Taramani Link Rd,", {
        align: "right",
        lineGap: 3,
      })
      .text("Velachery, Chennai, Tamil Nadu 600042", {
        align: "right",
        lineGap: 3,
      })
      .text("Phone: +91 89259 09207", { align: "right", lineGap: 3 })
      .text("GST No: 33AAQCA617L1Z9", { align: "right", lineGap: 3 })
      .moveDown();

    doc.moveDown();

    // ---------- INVOICE INFO ----------
    doc
      .fontSize(10)
      .text(`Invoice Number: ${invoice_number}`, 50, 120, {
        lineGap: 3,
      })
      .text(`Invoice Date: ${invoice_date}`, 50, 135, {
        lineGap: 3,
      });

    // ---------- BILL TO ----------
    doc
      .fontSize(12)
      .text("Bill To:", 50, 170)
      .fontSize(10)
      .text(`Name: ${name}`, 50, 190, { lineGap: 3 })
      .text(`Email: ${email}`, 50, 205, { lineGap: 3 })
      .text(`Mobile: ${mobile}`, 50, 220, { lineGap: 3 });

    // ---------- DETAILS & AMOUNTS TABLE ----------
    const tableTop = 270;
    const col1X = 50; // Product
    const col2X = 200; // Paid
    const col3X = 280; // Discount
    const col4X = 360; // GST
    const col5X = 440; // Convenience Fee

    // Table Header
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Product", col1X, tableTop);
    doc.text("Paid", col2X, tableTop);
    doc.text("Discount", col3X, tableTop);
    doc.text("GST", col4X, tableTop);
    doc.text("Convenience Fee", col5X, tableTop);

    // Draw a line below header
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Table Row (example with one product)
    doc.font("Helvetica").fontSize(10);
    const rowY = tableTop + 25;
    doc.text(course_name || "-", col1X, rowY);
    doc.text(paid_amount || "-", col2X, rowY);
    doc.text(discount + "%" || "-", col3X, rowY);
    doc.text(gst_percentage + "%" || "-", col4X, rowY);
    doc.text(convenience_fees || "-", col5X, rowY);

    // Draw a line below row
    doc
      .moveTo(50, rowY + 15)
      .lineTo(550, rowY + 15)
      .stroke();

    // ---------- TOTALS ----------
    let currentY = rowY + 20; // start position after table
    const rowGap = 18; // adjust this to increase/decrease spacing

    doc.font("Helvetica-Bold").fontSize(10);

    // define label + value X positions
    const labelX = 380;
    const valueX = 480;

    function addTotalRow(label, value) {
      if (label === "Paid:") {
        doc.font("Helvetica-Bold");
      } else {
        doc.font("Helvetica");
      }
      doc.text(label, labelX, currentY, { width: 120, align: "left" });
      doc.text(value, valueX, currentY, { width: 60, align: "right" });
      currentY += rowGap; // add extra gap before next row
    }

    // Add totals with consistent spacing
    addTotalRow("Sub Total:", sub_total);
    addTotalRow("Discount:", discount_amount);
    addTotalRow("GST:", gst_amount);
    addTotalRow("Convenience Charges:", convenience_fees);
    addTotalRow("Total Fee:", total_amount);
    addTotalRow("Paid:", paid_amount);
    addTotalRow("Balance:", balance_amount);

    // ---------- NOTES ----------
    const totalsY = rowY + 20;
    doc.font("Helvetica-Bold").fontSize(10);

    let notesY = totalsY + 120; // push a bit further
    doc
      .moveDown()
      .fontSize(9)
      .text("Note:", 50, notesY)
      .text(
        "1) All Cheques / Drafts / Online Transfers to be made in favour of Acte Technologies Pvt Ltd",
        { width: 500 }
      )
      .text("2) The refund requisition will not be accepted", { width: 500 })
      .text(
        "3) Acte Technologies has rights to postpone/cancel courses due to instructor illness or natural calamities. No refund in this case.",
        { width: 500 }
      )
      .moveDown();

    doc
      .fontSize(8)
      .text("Happy Learning...!Thanks for choosing us...!!", 50, 700, {
        align: "center",
      });

    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  // --- Send Mail with Attachment ---
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Gmail app password
    },
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your Invoice",
    text: "Please find your invoice attached.",
    attachments: [{ filename: "invoice.pdf", path: pdfPath }],
  });
};

const sendCourseCertificate = async (email) => {
  const pdfPath = path.join(process.cwd(), "certificate.pdf");

  // 1. HTML Template
  const htmlContent = `
<html>
  <head>
    <meta charset="UTF-8" />
    <title>ACTE Certificate</title>
    <style>
      @page {
        margin: 0; /* removes default white margins */
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: transparent; /* no white background */
        font-family: 'Times New Roman', serif;
      }
    </style>
  </head>
  <body>
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      bgcolor="transparent"
    >
      <tr>
        <td align="center" style="padding: 20px">
          <!-- Outer Blue Border -->
          <table
            width="800"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="
              border: 27px solid #0a4682;
              border-radius: 80px;
              background: #fff;
            "
          >
            <tr>
              <td>
                <!-- Gold Middle Border -->
                <table
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    border: 10px solid #f49f20;
                    border-radius: 50px;
                    padding: 7px;
                  "
                >
                  <tr>
                    <td>
                      <!-- Inner Thin Blue Border -->
                      <table
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        style="border: 3px solid #0a4682; border-radius: 40px"
                      >
                        <tr>
                          <td style="padding: 40px; text-align: center">
                            <!-- Header -->
                            <h1
                              style="
                                margin: 0;
                                font-size: 40px;
                                color: #0a4682;
                                font-weight: bold;
                                letter-spacing: 1px;
                              "
                            >
                              ACTE
                            </h1>
                            <h2
                              style="
                                margin: 5px 0 20px;
                                font-size: 22px;
                                color: #0a4682;
                                letter-spacing: 2px;
                              "
                            >
                              TECHNOLOGIES
                            </h2>

                            <!-- Content -->
                            <p style="margin: 10px 0; font-size: 18px">
                              The Academic Council of ACTE
                            </p>
                            <p style="margin: 10px 0; font-size: 18px">
                              Having Duly Examined
                            </p>

                            <h3
                              style="
                                margin: 20px 0 10px;
                                font-size: 24px;
                                font-weight: bold;
                              "
                            >
                              SUDARSAIN R
                            </h3>

                            <p
                              style="
                                margin: 10px 0;
                                font-size: 18px;
                                line-height: 1.6;
                              "
                            >
                              During and After 2 months of Study on the
                              Specified Curriculum<br />
                              And having found the Candidate's Performance to be
                            </p>

                            <h3
                              style="
                                margin: 20px 0 10px;
                                font-size: 26px;
                                font-weight: bold;
                                color: #0a4682;
                              "
                            >
                              EXCELLENT
                            </h3>

                            <p style="margin: 10px 0; font-size: 18px">
                              Have Pleasure in Recognizing this Attainment with
                              the Title of
                            </p>

                            <h4
                              style="
                                margin: 15px 0;
                                font-size: 28px;
                                font-weight: bold;
                                color: #0a4682;
                              "
                            >
                              SAP MM
                            </h4>

                            <p
                              style="
                                margin: 10px 0;
                                font-size: 18px;
                                line-height: 1.6;
                              "
                            >
                              Given under our hand and Seal on<br />
                              the month of August-2025<br />
                              At Chennai, India
                            </p>

                            <!-- Signatures -->
                            <table
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="margin-top: 40px"
                            >
                              <tr>
                                <td
                                  align="center"
                                  style="width: 33%; padding: 0 10px"
                                >
                                  <div
                                    style="
                                      border-top: 1px solid #000;
                                      margin-bottom: 8px;
                                    "
                                  ></div>
                                  <p style="margin: 0; font-size: 14px">
                                    Chairman
                                  </p>
                                  <p style="margin: 0; font-size: 14px">
                                    Of the Academic Council
                                  </p>
                                </td>
                                <td
                                  align="center"
                                  style="width: 33%; padding: 0 10px"
                                >
                                  <div
                                    style="
                                      border-top: 1px solid #000;
                                      margin-bottom: 8px;
                                    "
                                  ></div>
                                  <p style="margin: 0; font-size: 14px">
                                    Vice-Chairman
                                  </p>
                                  <p style="margin: 0; font-size: 14px">
                                    Of the Academic Council
                                  </p>
                                </td>
                                <td
                                  align="center"
                                  style="width: 33%; padding: 0 10px"
                                >
                                  <div
                                    style="
                                      border-top: 1px solid #000;
                                      margin-bottom: 8px;
                                    "
                                  ></div>
                                  <p style="margin: 0; font-size: 14px">
                                    Member
                                  </p>
                                  <p style="margin: 0; font-size: 14px">
                                    Of the Academic Council
                                  </p>
                                </td>
                              </tr>
                            </table>

                            <!-- Footer -->
                            <table
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="
                                margin-top: 30px;
                                border-top: 1px solid #000;
                                padding-top: 10px;
                              "
                            >
                              <tr>
                                <td align="left" style="font-size: 13px">
                                  Registration No.: R08111111706037
                                </td>
                                <td align="right" style="font-size: 13px">
                                  Certificate No.: 15CBZZZZZ8523
                                </td>
                              </tr>
                            </table>

                            <!-- Legend -->
                           <div
  style="
    margin-top: 20px;
    display: inline-block;
    border: 1px solid #000;
    padding: 10px 15px;
    font-size: 12px;
    text-align: left;
  "
>
  <strong style="display: block; margin-bottom: 5px; text-align: center;">
    LEGEND
  </strong>
  <table style="border-collapse: collapse; font-size: 12px;">
    <tr>
      <td style="padding-right: 10px;">50-59.9</td>
      <td>: Satisfactory</td>
    </tr>
    <tr>
      <td style="padding-right: 10px;">60-69.9</td>
      <td>: Fair</td>
    </tr>
    <tr>
      <td style="padding-right: 10px;">70-79.9</td>
      <td>: Good</td>
    </tr>
    <tr>
      <td style="padding-right: 10px;">80-100</td>
      <td>: Excellent</td>
    </tr>
  </table>
</div>


                            <!-- Watermark -->
                            <p
                              style="
                                margin-top: 20px;
                                font-size: 10px;
                                color: #666;
                              "
                            >
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
        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  // 2. Launch Puppeteer and create PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true, // ensures colors are kept
    margin: { top: 0, right: 0, bottom: 0, left: 0 }, // removes white border
  });
  await browser.close();

  // 3. Send mail with attachment
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your Course Certificate",
    text: "Please find your course certificate attached.",
    attachments: [{ filename: "certificate.pdf", path: pdfPath }],
  });
};

const sendWelcomeMail = async (email, name) => {
  try {
    // Check the trainer already exists
    const [isEmailExists] = await pool.query(
      `SELECT id, name FROM customers WHERE email = ?`,
      [trainer_id]
    );
    if (isEmailExists.length <= 0) throw new Error("Email not exists");

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Registration From",
      text: `Click the below link to complete the registration.`,
      html: ``,
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

const sendPaymentMail = async (email, name) => {
  try {
    // Check the trainer already exists
    const [isEmailExists] = await pool.query(
      `SELECT id, name FROM customers WHERE email = ?`,
      [trainer_id]
    );
    if (isEmailExists.length <= 0) throw new Error("Email not exists");

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Registration From",
      text: `Click the below link to complete the registration.`,
      html: ``,
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

module.exports = {
  sendMail,
  sendInvoiceMail,
  sendCustomerMail,
  sendCourseCertificate,
  sendWelcomeMail,
  sendPaymentMail,
};
