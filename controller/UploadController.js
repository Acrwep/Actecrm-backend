const pool = require("../config/dbconfig"); // mysql connection
const fs = require("fs");
const path = require("path");

const insertCourse = async (request, response) => {
  const { course_name, price, offer_price } = request.body;

  try {
    // 🔹 Check duplicate name
    const [isNameExists] = await pool.query(
      `SELECT id FROM technologies WHERE name = ? AND is_active = 1`,
      [course_name],
    );

    if (isNameExists.length > 0) {
      throw new Error("The course name already exists.");
    }

    let brouchures = null;
    let syllabus = null;
    // 🔹 If pdf1 uploaded
    if (request.files?.brouchures) {
      brouchures = `/uploads/pdfs/${request.files.brouchures[0].filename}`;
    }

    // 🔹 If pdf2 uploaded
    if (request.files?.syllabus) {
      syllabus = `/uploads/pdfs/${request.files.syllabus[0].filename}`;
    }

    // 🔹 Insert into DB
    await pool.query(
      `INSERT INTO technologies(
        name,
        price,
        offer_price,
        brouchures,
        syllabus
      )
      VALUES (?, ?, ?, ?, ?)`,
      [course_name, price, offer_price, brouchures, syllabus],
    );

    response.status(200).json({
      message: "Course inserted successfully",
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
};

const deletePDF = async (request, response) => {
  const { course_id } = request.params;
  try {
    const [rows] = await pool.query(
      `SELECT file_path FROM technologies WHERE id = ?`,
      [course_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const filePathFromDB = rows[0].file_path;

    const absolutePath = path.join(process.cwd(), filePathFromDB);

    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
    }

    // 4️⃣ Delete DB record (IMPORTANT 🔥)
    await pool.query(
      `UPDATE technologies SET file_name = NULL, file_path = NULL WHERE id = ?`,
      [course_id],
    );

    response.status(200).json({
      message: "PDF deleted successfully",
    });
  } catch (error) {
    response.status(500).json({
      message: "Document has been deleted",
      details: error.message,
    });
  }
};

const updateCourse = async (request, response) => {
  const { course_id, course_name, price, offer_price } = request.body;

  try {
    const [isNameExists] = await pool.query(
      `SELECT id FROM technologies WHERE name = ? AND is_active = 1 AND id != ?`,
      [course_name, id],
    );

    if (isNameExists.length > 0)
      throw new Error("The course name already exists");

    let brouchures = null;
    let syllabus = null;
    // 🔹 If pdf1 uploaded
    if (request.files?.brouchures) {
      brouchures = `/uploads/pdfs/${request.files.brouchures[0].filename}`;
    }

    // 🔹 If pdf2 uploaded
    if (request.files?.syllabus) {
      syllabus = `/uploads/pdfs/${request.files.syllabus[0].filename}`;
    }

    // 🔹 Insert into DB
    await pool.query(
      `UPDATE
          technologies
      SET
          name = ?,
          price = ?,
          offer_price = ?,
          brouchures = ?,
          syllabus = ?
      WHERE
          id = ?`,
      [course_name, price, offer_price, brouchures, syllabus, course_id],
    );

    response.status(200).json({
      message: "Course updated successfully",
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  insertCourse,
  updateCourse,
  deletePDF,
};
