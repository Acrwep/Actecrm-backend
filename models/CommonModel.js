const pool = require("../config/dbconfig");
const fs = require("fs");

const CommonModel = {
  getPaymentHistory: async (lead_id) => {
    try {
      const [getPaymentMaster] = await pool.query(
        `SELECT id, lead_id, tax_type, gst_percentage, gst_amount, total_amount, created_date FROM payment_master WHERE lead_id = ?`,
        [lead_id]
      );

      const [getPaymentTrans] = await pool.query(
        `SELECT pt.id, pt.payment_master_id, pt.invoice_number, pt.invoice_date, pt.amount, pt.convenience_fees, (pt.amount + pt.convenience_fees) AS paid_amount, pt.paymode_id, pm.name AS payment_mode, pt.payment_screenshot, pt.payment_status, pt.paid_date, pt.verified_date, pt.next_due_date, pt.is_second_due, pt.created_date, pt.reason FROM payment_trans AS pt INNER JOIN payment_mode AS pm ON pt.paymode_id = pm.id WHERE pt.payment_master_id = ? ORDER BY pt.id ASC`,
        [getPaymentMaster[0].id]
      );

      // Calculate running balance
      let runningBalance = getPaymentMaster[0].total_amount;
      const formattedResult = getPaymentTrans.map((item) => {
        runningBalance -= item.amount;
        return {
          ...item,
          balance_amount: parseFloat(runningBalance).toFixed(2),
        };
      });

      return {
        ...getPaymentMaster[0],
        payment_trans: formattedResult.reverse(), // Reverse for latest first
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  generateCertificate: async (
    customer_id,
    customer_name,
    course_name,
    course_duration,
    course_completion_month,
    current_location
  ) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM certificates WHERE customer_id = ?`,
        [customer_id]
      );

      if (isExists.length > 0)
        throw new Error("Certificates has already been generated");

      const [getLocation] = await pool.query(
        `SELECT c.region_id, r.name AS region_name FROM customers AS c INNER JOIN region AS r ON c.region_id = r.id WHERE c.id = ?`,
        [customer_id]
      );

      const location = getLocation[0].region_name.substring(0, 3).toUpperCase();

      let affectedRows = 0;

      // Generate the unique numbers
      // const regNumber = await getNextUniqueNumber("REG", location);
      // You can generate the cert number now, or later when the certificate is awarded
      const certNumber = await getNextUniqueNumber("CERT", location);

      const sql = `INSERT INTO certificates (customer_id, customer_name, course_name, course_duration, course_completion_month, certificate_number, location) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        customer_id,
        customer_name,
        course_name,
        course_duration,
        course_completion_month,
        certNumber,
        current_location,
      ];

      const [result] = await pool.query(sql, values);

      affectedRows += result.affectedRows;

      const [updateCustomer] = await pool.query(
        `UPDATE customers SET is_certificate_generated = 1 WHERE id = ?`,
        [customer_id]
      );

      affectedRows += updateCustomer.affectedRows;
      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCertificate: async (customer_id) => {
    try {
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
      const memberSignBase64 = getBase64Image(
        process.env.MEMBER_SIGNATURE_PATH
      );

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
                    
                   <img src="${acteLogoBase64}" style="width:240px; height:auto; display:block;margin:65px auto 10px auto;" />
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

      return {
        ...result[0],
        html_template: htmlContent,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

async function getNextUniqueNumber(sequenceType, location) {
  // 1. Validate input
  if (!["CERT"].includes(sequenceType)) {
    throw new Error('SequenceType must be "CERT"');
  }

  // 2. Calculate the Year-Month code (YYMM)
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Get last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
  const yearMonth = year + month; // e.g., "2509"

  const upsertQuery = `
      INSERT INTO unique_number_sequence (sequence_type, yearmonth , last_sequence)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1;
    `;
  await pool.query(upsertQuery, [sequenceType, yearMonth]);

  // 4. Fetch the updated sequence value we just claimed
  const selectQuery = `
      SELECT last_sequence FROM unique_number_sequence
      WHERE sequence_type = ? AND yearmonth  = ?;
    `;
  const [rows] = await pool.query(selectQuery, [sequenceType, yearMonth]);

  if (rows.length === 0) {
    throw new Error("Failed to generate sequence number");
  }

  const newSequence = rows[0].last_sequence;

  // 5. Format the final number: 0005BAN2509
  const paddedSequence = newSequence.toString().padStart(5, "0");
  const uniqueNumber = `${paddedSequence}${location}${yearMonth}`;

  return uniqueNumber;
}

module.exports = CommonModel;
