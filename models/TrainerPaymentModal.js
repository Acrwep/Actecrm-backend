const pool = require("../config/dbconfig");

const trainerPaymentModal = {
  insertTrainerPaymentRequest: async (
    bill_raisedate,
    streams,
    attendance_status,
    attendance_sheetlink,
    attendance_screenshot,
    customer_id,
    trainer_id,
    request_amount,
    commercial_percentage,
    days_taken_topay,
    deadline_date,
    status,
    created_date
  ) => {
    try {
      const query = `
  INSERT INTO trainer_payment (
    bill_raisedate,
    streams,
    attendance_status,
    attendance_sheetlink,
    attendance_screenshot,
    customer_id,
    trainer_id,
    request_amount,
    commercial_percentage,
    days_taken_topay,
    deadline_date,
    status,
    created_date
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

      const [result] = await pool.execute(query, [
        bill_raisedate,
        streams,
        attendance_status,
        attendance_sheetlink,
        attendance_screenshot,
        customer_id,
        trainer_id,
        request_amount,
        commercial_percentage,
        days_taken_topay,
        deadline_date,
        status,
        created_date,
      ]);

      return {
        status: true,
        message: "Trainer payment requested successfully",
        insertId: result.insertId,
      };
    } catch (error) {
      console.error("Insert Trainer Payment Error:", error);
      return {
        status: false,
        message: "Failed to insert trainer payment",
      };
    }
  },

  getTrainerPayments: async (start_date, end_date, status, page, limit) => {
    try {
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let queryParams = [];

      // Date filters
      if (start_date && end_date) {
        whereConditions.push("tp.bill_raisedate BETWEEN ? AND ? ");
        queryParams.push(start_date, end_date);
      } else if (start_date) {
        whereConditions.push("tp.bill_raisedate >= ?");
        queryParams.push(start_date);
      } else if (end_date) {
        whereConditions.push("tp.bill_raisedate <= ?");
        queryParams.push(end_date);
      }

      // Status filter
      if (status && status !== "all") {
        whereConditions.push("tp.status = ?");
        queryParams.push(status);
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      // Main data query
      const dataQuery = `
      SELECT 
        tp.*,
        t.name AS trainer_name,
        t.email AS trainer_email,
        t.mobile AS trainer_mobile,
        c.name AS customer_name,
        c.email AS customer_email
      FROM trainer_payment tp
      LEFT JOIN trainer t ON tp.trainer_id = t.id
      LEFT JOIN customers c ON tp.customer_id = c.id
      ${whereClause}
      ORDER BY tp.bill_raisedate DESC, tp.created_date DESC
      LIMIT ? OFFSET ?
    `;

      const [payments] = await pool.execute(dataQuery, [
        ...queryParams,
        Number(limit),
        Number(offset),
      ]);

      // Total count
      const countQuery = `
      SELECT COUNT(*) AS total
      FROM trainer_payment tp
      ${whereClause}
    `;

      const [countResult] = await pool.execute(countQuery, queryParams);
      const totalRecords = countResult[0].total;

      // Status count query (ignore status filter)
      const statusCountQuery = `
      SELECT 
        status,
        COUNT(*) AS count
      FROM trainer_payment tp
      ${whereClause.replace("tp.status = ?", "1=1")}
      GROUP BY status
    `;

      const statusCountParams =
        status && status !== "all"
          ? queryParams.filter((v) => v !== status)
          : queryParams;

      const [statusCounts] = await pool.execute(
        statusCountQuery,
        statusCountParams
      );

      const statusCountMap = {
        Requested: 0,
        "Awaiting Finance": 0,
        Completed: 0,
        all: totalRecords,
      };

      statusCounts.forEach((row) => {
        statusCountMap[row.status] = row.count;
      });

      return {
        status: true,
        data: payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRecords / limit),
          totalRecords,
          limit,
        },
        statusCounts: statusCountMap,
      };
    } catch (error) {
      console.error("Get Trainer Payments Error:", error.sqlMessage || error);
      return {
        status: false,
        message: "Failed to fetch trainer payments",
        error: error.sqlMessage || error.message,
      };
    }
  },

  updateTrainerPaymentRequest: async (
    id,
    bill_raisedate,
    streams,
    attendance_status,
    attendance_sheetlink,
    attendance_screenshot,
    customer_id,
    trainer_id,
    request_amount,
    commercial_percentage,
    days_taken_topay,
    deadline_date,
    status
  ) => {
    try {
      const query = `
        UPDATE trainer_payment SET
          bill_raisedate = ?,
          streams = ?,
          attendance_status = ?,
          attendance_sheetlink = ?,
          attendance_screenshot = ?,
          customer_id = ?,
          trainer_id = ?,
          request_amount = ?,
          commercial_percentage = ?,
          days_taken_topay = ?,
          deadline_date = ?,
          status = ?
        WHERE id = ?
      `;

      const [result] = await pool.execute(query, [
        bill_raisedate,
        streams,
        attendance_status,
        attendance_sheetlink,
        attendance_screenshot,
        customer_id,
        trainer_id,
        request_amount,
        commercial_percentage,
        days_taken_topay,
        deadline_date,
        status,
        id,
      ]);

      if (result.affectedRows === 0) {
        return {
          status: false,
          message: "Trainer payment request not found",
        };
      }

      return {
        status: true,
        message: "Trainer payment request updated successfully",
      };
    } catch (error) {
      console.error("Update Trainer Payment Error:", error);
      return {
        status: false,
        message: "Failed to update trainer payment",
        error: error.message,
      };
    }
  },
};

module.exports = trainerPaymentModal;
