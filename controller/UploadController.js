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
  const {
    course_id,
    course_name,
    price,
    offer_price,
    remove_brouchures,
    remove_syllabus,
  } = request.body;

  try {
    // 🔥 Check duplicate name
    const [isNameExists] = await pool.query(
      `SELECT id FROM technologies 
       WHERE name = ? AND is_active = 1 AND id != ?`,
      [course_name, course_id],
    );

    if (isNameExists.length > 0) {
      return response.status(400).json({
        error: "The course name already exists",
      });
    }

    // 🔥 Get existing record
    const [existingCourse] = await pool.query(
      `SELECT brouchures, syllabus 
       FROM technologies 
       WHERE id = ?`,
      [course_id],
    );

    if (!existingCourse.length) {
      return response.status(404).json({
        error: "Course not found",
      });
    }

    let brouchures = existingCourse[0].brouchures;
    let syllabus = existingCourse[0].syllabus;

    // =====================================================
    // 🔥 HANDLE BROUCHURE DELETE
    // =====================================================

    if (remove_brouchures === "true") {
      if (brouchures) {
        const oldPath = path.join(__dirname, "..", brouchures);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      brouchures = null;
    }

    // =====================================================
    // 🔥 HANDLE BROUCHURE REPLACE
    // =====================================================

    if (request.files?.brouchures) {
      // delete old file if exists
      if (brouchures) {
        const oldPath = path.join(__dirname, "..", brouchures);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      brouchures = `/uploads/pdfs/${request.files.brouchures[0].filename}`;
    }

    // =====================================================
    // 🔥 HANDLE SYLLABUS DELETE
    // =====================================================

    if (remove_syllabus === "true") {
      if (syllabus) {
        const oldPath = path.join(__dirname, "..", syllabus);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      syllabus = null;
    }

    // =====================================================
    // 🔥 HANDLE SYLLABUS REPLACE
    // =====================================================

    if (request.files?.syllabus) {
      if (syllabus) {
        const oldPath = path.join(__dirname, "..", syllabus);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      syllabus = `/uploads/pdfs/${request.files.syllabus[0].filename}`;
    }

    // =====================================================
    // 🔥 UPDATE DATABASE
    // =====================================================

    await pool.query(
      `UPDATE technologies
       SET name = ?, price = ?, offer_price = ?, brouchures = ?, syllabus = ?
       WHERE id = ?`,
      [course_name, price, offer_price, brouchures, syllabus, course_id],
    );

    return response.status(200).json({
      message: "Course updated successfully",
    });
  } catch (error) {
    console.error("Update Course Error:", error);

    return response.status(500).json({
      error: "Something went wrong",
    });
  }
};

module.exports = {
  insertCourse,
  updateCourse,
  deletePDF,
};
