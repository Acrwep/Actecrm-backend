const nodemailer = require("nodemailer");
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

const sendInvoiceMail = async (invoiceData) => {
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
      .text(`Invoice Number: ${invoiceData.invoiceNumber}`, 50, 120, {
        lineGap: 3,
      })
      .text(`Invoice Date: ${invoiceData.invoiceDate}`, 50, 135, {
        lineGap: 3,
      });

    // ---------- BILL TO ----------
    doc
      .fontSize(12)
      .text("Bill To:", 50, 170)
      .fontSize(10)
      .text(`Name: ${invoiceData.customerName}`, 50, 190, { lineGap: 3 })
      .text(`Email: ${invoiceData.customerEmail}`, 50, 205, { lineGap: 3 })
      .text(`Mobile: ${invoiceData.customerPhone}`, 50, 220, { lineGap: 3 })
      .text(`ID No: ${invoiceData.customerId}`, 50, 235, { lineGap: 3 });

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
    doc.text(invoiceData.course, col1X, rowY);
    doc.text(invoiceData.paidAmount || "10000", col2X, rowY);
    doc.text(invoiceData.discount || "4%", col3X, rowY);
    doc.text(invoiceData.gstAmount || "1000", col4X, rowY);
    doc.text(invoiceData.convenienceFee || "200", col5X, rowY);

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
      doc.text(label, labelX, currentY, { width: 120, align: "left" });
      doc.text(value, valueX, currentY, { width: 60, align: "right" });
      currentY += rowGap; // add extra gap before next row
    }

    // Add totals with consistent spacing
    addTotalRow("Sub Total:", invoiceData.subtotal);
    addTotalRow("GST:", invoiceData.totalGst);
    addTotalRow("Convenience Charges:", invoiceData.convenienceFee);
    addTotalRow("Total Fee:", invoiceData.totalFee);
    addTotalRow("Received:", invoiceData.received);
    addTotalRow("Balance:", invoiceData.balance);

    // ---------- NOTES ----------
    const totalsY = rowY + 20;
    doc.font("Helvetica-Bold").fontSize(10);

    let notesY = totalsY + 120; // push a bit further
    doc
      .moveDown()
      .fontSize(9)
      .text("Note:", 50, notesY)
      .text(
        "1) All Cheques / Drafts / Online Transfers to be made in favour of BDreamz Global Solutions Pvt Ltd",
        { width: 500 }
      )
      .text("2) The refund requisition will not be accepted", { width: 500 })
      .text(
        "3) BDreamz Technologies has rights to postpone/cancel courses due to instructor illness or natural calamities. No refund in this case.",
        { width: 500 }
      )
      .moveDown();

    doc
      .fontSize(8)
      .text(
        "BDreamz Technologies is a division of BDreamz Global Solutions Private Limited",
        50,
        700,
        { align: "center" }
      );

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
    to: invoiceData.email,
    subject: "Your Invoice",
    text: "Please find your invoice attached.",
    attachments: [{ filename: "invoice.pdf", path: pdfPath }],
  });
};

module.exports = {
  sendMail,
  sendInvoiceMail,
};
