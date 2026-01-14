const pool = require("../config/dbconfig");

const trainerPaymentModal = {
  getStudents: async (trainer_id) => {
    try {
      const [result] = await pool.query(
        `SELECT
            tm.id AS trainer_mapping_id,
            tm.trainer_id,
            c.id,
            c.name,
            c.email AS customer_email,
            tm.commercial,
            ROUND(((tm.commercial / l.primary_fees) * 100), 2) AS commercial_percentage
        FROM trainer_mapping AS tm
        INNER JOIN customers AS c 
            ON tm.customer_id = c.id
        INNER JOIN lead_master AS l ON
        	l.id = c.lead_id
        WHERE
            tm.is_verified = 1
            AND tm.trainer_id = ?
            AND c.class_percentage >= 100
            AND c.google_review IS NOT NULL
            AND c.linkedin_review IS NOT NULL
            AND NOT EXISTS (
                SELECT 1
                FROM trainer_payment_trans tpt
                WHERE tpt.trainer_mapping_id = tm.id
            );`,
        [trainer_id]
      );

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  requestPayment: async (
    bill_raisedate,
    trainer_id,
    request_amount,
    days_taken_topay,
    deadline_date,
    created_by,
    created_date,
    students
  ) => {
    try {
      let affectedRows = 0;

      if (!students && students.length <= 0)
        throw new Error("Students cannot be empty");

      const masterQuery = `INSERT INTO trainer_payment_master(
          bill_raisedate,
          trainer_id,
          request_amount,
          days_taken_topay,
          deadline_date,
          status,
          created_by,
          created_date
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)`;
      const masterValues = [
        bill_raisedate,
        trainer_id,
        request_amount,
        days_taken_topay,
        deadline_date,
        "Requested",
        created_by,
        created_date,
      ];

      const [insertMaster] = await pool.query(masterQuery, masterValues);

      affectedRows += insertMaster.affectedRows;

      const transQuery = `INSERT INTO trainer_payment_trans(
          payment_master_id,
          trainer_mapping_id,
          streams,
          commercial,
          commercial_percentage,
          attendance_status,
          attendance_sheetlink,
          attendance_screenshot
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)`;

      for (const student of students) {
        const transValues = [
          insertMaster.insertId,
          student.trainer_mapping_id,
          student.streams,
          student.commercial,
          student.commercial_percentage,
          student.attendance_status,
          student.attendance_sheetlink,
          student.attendance_screenshot,
        ];

        const [insertTrans] = await pool.query(transQuery, transValues);

        affectedRows += insertTrans.affectedRows;
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getPayments: async (start_date, end_date, status, page, limit) => {
    try {
      const queryParams = [];
      const countParams = [];
      const statusParams = [];
      let getQuery = `SELECT
          tm.id,
          tm.bill_raisedate,
          tm.trainer_id,
          t.name AS trainer_name,
          t.mobile AS trainer_mobile,
          t.email AS trainer_email,
          tm.request_amount,
          tm.paid_amount,
          tm.balance_amount,
          CASE
              WHEN tm.fully_paid_date IS NULL
                  THEN DATEDIFF(CURRENT_DATE, tm.bill_raisedate)
              ELSE DATEDIFF(tm.fully_paid_date, tm.bill_raisedate)
          END AS days_taken_topay,
          tm.deadline_date,
          tm.status,
          tm.is_rejected,
          tm.rejected_reason,
          tm.rejected_date,
          tm.is_verified,
          tm.verified_by,
          vu.user_name AS verified_user,
          tm.verified_date,
          tm.fully_paid_date,
          tm.created_by,
          cu.user_name AS created_user,
          tm.created_date
      FROM
          trainer_payment_master AS tm
      INNER JOIN trainer AS t ON
          t.id = tm.trainer_id
      LEFT JOIN users AS vu ON
          vu.user_id = tm.verified_by
      LEFT JOIN users AS cu ON
        cu.user_id = tm.created_by
      WHERE 1 = 1`;

      let countQuery = `SELECT
          COUNT(tm.id) AS total
      FROM
          trainer_payment_master AS tm
      INNER JOIN trainer AS t ON
          t.id = tm.trainer_id
      LEFT JOIN users AS vu ON
          vu.user_id = tm.verified_by
      LEFT JOIN users AS cu ON
        cu.user_id = tm.created_by
      WHERE 1 = 1`;

      let statusCountQuery = `
      SELECT
        COUNT(*) AS total,
        IFNULL(SUM(CASE WHEN status IN('Requested', 'Rejected') THEN 1 ELSE 0 END), 0) AS requested,
        IFNULL(SUM(CASE WHEN status = 'Awaiting Finance' THEN 1 ELSE 0 END), 0) AS awaiting_finance,
        IFNULL(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed
      FROM
          trainer_payment_master
      WHERE 1 = 1`;

      if (start_date && end_date) {
        getQuery += ` AND tm.bill_raisedate BETWEEN ? AND ?`;
        countQuery += ` AND tm.bill_raisedate BETWEEN ? AND ?`;
        statusCountQuery += ` AND bill_raisedate BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
      }

      if (status && status.length > 0) {
        const placeholders = status.map(() => "?").join(", ");
        getQuery += ` AND tm.status IN (${placeholders})`;
        countQuery += ` AND tm.status IN (${placeholders})`;
        queryParams.push(...status);
        countParams.push(...status);
      }

      const [countResult] = await pool.query(countQuery, countParams);

      const total = countResult[0]?.total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY tm.bill_raisedate DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [result] = await pool.query(getQuery, queryParams);

      const [statusResult] = await pool.query(statusCountQuery, statusParams);

      let res = await Promise.all(
        result.map(async (item) => {
          const [students] = await pool.query(
            `SELECT
              tp.id AS payment_trans_id,
              tp.trainer_mapping_id,
              tm.customer_id,
              c.name AS customer_name,
              c.email AS customer_email,
              tp.streams,
              tp.commercial,
              tp.commercial_percentage,
              tp.attendance_status,
              tp.attendance_sheetlink,
              tp.attendance_screenshot
          FROM
              trainer_payment_trans AS tp
          INNER JOIN trainer_mapping AS tm ON
              tp.trainer_mapping_id = tm.id
          INNER JOIN customers AS c ON
              c.id = tm.customer_id
          WHERE tp.payment_master_id = ?`,
            [item.id]
          );

          const [payments] = await pool.query(
            `SELECT
              tp.id,
              tp.paid_amount,
              tp.payment_screenshot,
              tp.paid_date,
              tp.paid_by,
              u.user_name AS paid_user
          FROM
              trainer_payment AS tp
          INNER JOIN users AS u ON
              tp.paid_by = u.user_id
          WHERE tp.payment_master_id = ?
          ORDER BY tp.id ASC`,
            [item.id]
          );

          return {
            ...item,
            students: students,
            payments: payments,
          };
        })
      );

      return {
        data: res,
        statusCount: statusResult[0],
        pagination: {
          total: parseInt(total),
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Finance Junior - Send Pending Transaction to Head
  financeJuniorApprove: async (trainer_payment_id) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [master] = await conn.query(
        `SELECT status FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id]
      );

      if (master[0].status !== "Requested")
        throw new Error("Only Requested payments can be processed");

      await conn.query(
        `UPDATE trainer_payment_master SET status = 'Awaiting Finance' WHERE id = ?`,
        [trainer_payment_id]
      );
      await conn.commit();
      return { status: true, message: "Transaction sent to finance head" };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Finance Head - Approve & Pay Transaction
  financeHeadApproveAndPay: async (
    trainer_payment_id,
    paid_amount,
    payment_screenshot,
    paid_date,
    paid_by
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO trainer_payment(
          payment_master_id,
          paid_amount,
          payment_screenshot,
          paid_date,
          paid_by
        )
        VALUES(?, ?, ?, ?, ?)`,
        [
          trainer_payment_id,
          paid_amount,
          payment_screenshot,
          paid_date,
          paid_by,
        ]
      );

      const [master] = await conn.execute(
        `SELECT request_amount, paid_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id]
      );

      const totalPaid = Number(master[0].paid_amount) + Number(paid_amount);
      const balance = Number(master[0].request_amount) - totalPaid;

      await conn.execute(
        `UPDATE trainer_payment_master SET paid_amount = ?, balance_amount = ?, status = ?, is_verified = 1, verified_by = ?, verified_date = ?, fully_paid_date = ? WHERE id = ?`,
        [
          totalPaid,
          balance,
          balance === 0 ? "Completed" : "Requested",
          paid_by,
          paid_date,
          balance === 0 ? paid_date : null,
          trainer_payment_id,
        ]
      );

      await conn.commit();
      return { status: true, message: "Payment approved successfully" };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Finance Head - Reject Request
  rejectTrainerPayment: async (
    trainer_payment_id,
    rejected_reason,
    rejected_date
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [balance] = await pool.query(
        `SELECT paid_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id]
      );

      if (balance[0].paid_amount > 0)
        throw new Error(
          "The payment request cannot be denied because the payment has already been initiated."
        );

      const [master] = await conn.query(
        `SELECT status FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id]
      );

      if (!master || master[0].status !== "Awaiting Finance")
        throw new Error("Only Awaiting Finance requests can be rejected");

      // 🔹 Reject only the latest Pending transaction
      await conn.query(
        `
      UPDATE trainer_payment_master
      SET status = 'Rejected',
          rejected_reason = ?,
          rejected_date = ?,
          is_rejected = 1
      WHERE id = ?
      `,
        [rejected_reason, rejected_date, trainer_payment_id]
      );

      await conn.commit();
      return { status: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  deleteRequest: async (trainer_payment_id) => {
    try {
      let affectedRows = 0;
      const [deleteMaster] = await pool.query(
        `DELETE FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id]
      );
      affectedRows += deleteMaster.affectedRows;

      const [deleteTrans] = await pool.query(
        `DELETE FROM trainer_payment_trans WHERE payment_master_id = ?`,
        [trainer_payment_id]
      );
      affectedRows += deleteTrans.affectedRows;

      const [deletePayment] = await pool.query(
        `DELETE FROM trainer_payment WHERE payment_master_id = ?`,
        [trainer_payment_id]
      );
      affectedRows += deletePayment.affectedRows;

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = trainerPaymentModal;
