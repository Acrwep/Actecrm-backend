const { request, response } = require("express");
const pool = require("../config/dbconfig");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

const normalizeEmail = (v) => (v ? String(v).trim().toLowerCase() : "");
const normalizeMobile = (v) => {
  if (v === null || v === undefined || v === "") {
    return "";
  } else {
    return v;
  }
};

const bulkSearch = async (request, response) => {
  let path;
  try {
    path = request.file.path;
    const workbook = XLSX.readFile(path);
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rawData || rawData.length === 0) {
      return response.status(400).send({
        message: "Excel sheet is empty",
      });
    }

    // 3) detect header keys (case-insensitive)
    const headers = Object.keys(rawData[0]);
    const emailKey = headers.find((k) => /email/i.test(k));
    const mobileKey = headers.find((k) =>
      /(phone|mobile|contact|whatsapp|phone_number|phonenumber)/i.test(k)
    );

    if (!emailKey && !mobileKey) {
      return response.status(400).send({
        message:
          "No Email or Mobile column detected. Example headers: 'Email', 'Mobile', 'Phone'.",
        headers,
      });
    }

    // Process all rows in parallel for better performance
    const searchPromises = rawData.map(async (row) => {
      const rawEmail = emailKey ? row[emailKey] ?? "" : "";
      const rawMobile = mobileKey ? row[mobileKey] ?? "" : "";

      const email = normalizeEmail(rawEmail);
      const mobile = normalizeMobile(rawMobile);

      const [results] = await pool.query(
        `SELECT l.id AS lead_id, c.id AS customer_id, l.name, l.phone, l.email, lt.name AS lead_type, 
                u.user_id, u.user_name, l.created_date 
         FROM lead_master AS l 
         LEFT JOIN customers AS c ON c.lead_id = l.id 
         LEFT JOIN users AS u ON u.user_id = l.assigned_to 
         LEFT JOIN lead_type AS lt ON l.lead_type_id = lt.id 
         WHERE l.phone = ? OR c.phone = ? OR l.email = ? OR c.email = ?`,
        [mobile, mobile, email, email]
      );

      let status = "Not Found";
      let result = null;

      if (results.length > 0) {
        result = results[0];
        // Simplified status logic
        if (result.customer_id) {
          status = "Success"; // Customer exists
        } else if (result.lead_id && result.customer_id === null) {
          status = "On Progress"; // Lead exists but not yet customer
        }
      }

      return {
        name: result?.name || "",
        email: email,
        mobile: mobile,
        status: status,
        lead_type: result?.lead_type || "",
        lead_by_id: result?.user_id || "",
        lead_by: result?.user_name || "",
        created_on: result?.created_date || "",
      };
    });

    // Wait for all searches to complete
    const data = await Promise.all(searchPromises);

    // Delete the uploaded file after use
    fs.unlink(path, (err) => {
      if (err) throw new Error("Error deleting file:", err);
    });

    return response.status(200).send({
      message: "Bulk search completed successfully",
      data: data,
    });
  } catch (error) {
    if (path) {
      fs.unlink(path, (err) => {
        if (err) console.error("Error deleting file on failure:", err);
      });
    }
    response.status(500).send({
      message: "Error in bulk searching",
      details: error.message,
    });
  }
};

module.exports = {
  bulkSearch,
  upload,
};
