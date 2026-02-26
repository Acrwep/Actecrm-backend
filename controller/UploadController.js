const pool = require("../config/dbconfig"); // mysql connection

const uplaodPDF = async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).send({ message: "No file uploaded" });
    }

    const filePath = `/uploads/pdfs/${request.file.filename}`;
    const fileName = request.file.originalname;

    await pool.query(
      "INSERT INTO documents (file_name, file_path) VALUES (?, ?)",
      [fileName, filePath],
    );

    response.status(200).send({
      message: "PDF uploaded successfully",
      filePath,
    });
  } catch (error) {
    response.status(500).send({ error: error.message });
  }
};

module.exports = {
  uplaodPDF,
};
