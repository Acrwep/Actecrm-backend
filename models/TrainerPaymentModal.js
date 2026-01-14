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

  // Finance Junior - Update Payment Request (Only Requested)
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
    deadline_date
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[row]] = await conn.execute(
        `SELECT status FROM trainer_payment WHERE id=? FOR UPDATE`,
        [id]
      );
      if (!row || row.status !== "Requested")
        throw new Error("Only Requested payments can be edited");

      await conn.execute(
        `UPDATE trainer_payment SET
          bill_raisedate=?, streams=?, attendance_status=?, attendance_sheetlink=?,
          attendance_screenshot=?, customer_id=?, trainer_id=?, request_amount=?,
          balance_amount=?, commercial_percentage=?, days_taken_topay=?, deadline_date=?
          WHERE id=?`,
        [
          bill_raisedate,
          streams,
          attendance_status,
          attendance_sheetlink,
          attendance_screenshot,
          customer_id,
          trainer_id,
          request_amount,
          request_amount,
          commercial_percentage,
          days_taken_topay,
          deadline_date,
          id,
        ]
      );

      await conn.commit();
      return { status: true, message: "Request updated" };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
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
          tm.days_taken_topay,
          tm.deadline_date,
          tm.status,
          tm.is_rejected,
          tm.rejected_reason,
          tm.rejected_date,
          tm.is_verified,
          tm.verified_by,
          vu.user_name AS verified_user,
          tm.verified_date,
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
        SUM(CASE WHEN status IN('Requested', 'Rejected') THEN 1 ELSE 0 END) AS requested,
        SUM(CASE WHEN status = 'Awaiting Finance' THEN 1 ELSE 0 END) AS awaiting_finance,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
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

  // Finance Junior / Head - List Payments with Transactions
  getTrainerPayments: async (start_date, end_date, status, page, limit) => {
    try {
      const offset = (page - 1) * limit;

      let whereData = [];
      let whereCount = [];
      let paramsData = [];
      let paramsCount = [];

      // ---------------- DATE FILTER (for all queries)
      if (start_date && end_date) {
        whereData.push("tp.bill_raisedate BETWEEN ? AND ?");
        whereCount.push("tp.bill_raisedate BETWEEN ? AND ?");
        paramsData.push(start_date, end_date);
        paramsCount.push(start_date, end_date);
      } else if (start_date) {
        whereData.push("tp.bill_raisedate >= ?");
        whereCount.push("tp.bill_raisedate >= ?");
        paramsData.push(start_date);
        paramsCount.push(start_date);
      } else if (end_date) {
        whereData.push("tp.bill_raisedate <= ?");
        whereCount.push("tp.bill_raisedate <= ?");
        paramsData.push(end_date);
        paramsCount.push(end_date);
      }

      // ---------------- STATUS FILTER (ONLY for data list)
      if (status && status !== "all") {
        whereData.push("tp.status = ?");
        paramsData.push(status);
      }

      const whereClauseData = whereData.length
        ? "WHERE " + whereData.join(" AND ")
        : "";

      const whereClauseCount = whereCount.length
        ? "WHERE " + whereCount.join(" AND ")
        : "";

      // ---------------- FETCH DATA
      const [payments] = await pool.execute(
        `SELECT tp.*, 
              t.name AS trainer_name, t.email AS trainer_email, t.mobile AS trainer_mobile,
              c.name AS customer_name, c.email AS customer_email
       FROM trainer_payment tp
       LEFT JOIN trainer t ON tp.trainer_id = t.id
       LEFT JOIN customers c ON tp.customer_id = c.id
       ${whereClauseData}
       ORDER BY tp.created_date DESC
       LIMIT ? OFFSET ?`,
        [...paramsData, Number(limit), Number(offset)]
      );

      // ---------------- FETCH TRANSACTIONS
      const ids = payments.map((p) => p.id);
      let txnMap = {};
      if (ids.length) {
        const [txns] = await pool.query(
          `SELECT * FROM trainer_payment_transactions 
         WHERE trainer_payment_id IN (?) 
         ORDER BY created_date DESC`,
          [ids]
        );
        txns.forEach((t) => {
          if (!txnMap[t.trainer_payment_id]) txnMap[t.trainer_payment_id] = [];
          txnMap[t.trainer_payment_id].push(t);
        });
      }
      payments.forEach((p) => (p.transactions = txnMap[p.id] || []));

      // ---------------- TOTAL COUNT (ALL)
      const [countRes] = await pool.execute(
        `SELECT COUNT(*) AS total FROM trainer_payment tp ${whereClauseCount}`,
        paramsCount
      );
      const totalRecords = countRes[0].total;

      // ---------------- STATUS COUNTS (DATE FILTER ONLY)
      const [statusRows] = await pool.execute(
        `SELECT status, COUNT(*) AS count 
       FROM trainer_payment tp ${whereClauseCount}
       GROUP BY status`,
        paramsCount
      );

      const statusCounts = {
        Requested: 0,
        "Awaiting Finance": 0,
        Rejected: 0,
        Completed: 0,
        all: totalRecords,
      };

      statusRows.forEach((r) => (statusCounts[r.status] = r.count));

      // ---------------- RESPONSE
      return {
        status: true,
        data: payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRecords / limit),
          totalRecords,
          limit,
        },
        statusCounts,
      };
    } catch (err) {
      console.error(err);
      return { status: false, message: "Failed to fetch", error: err.message };
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
        `UPDATE trainer_payment_master SET paid_amount = ?, balance_amount = ?, status = ?, is_verified = 1, verified_by = ?, verified_date = ? WHERE id = ?`,
        [
          totalPaid,
          balance,
          balance === 0 ? "Completed" : "Requested",
          paid_by,
          paid_date,
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

  resendRejectedRequest: async (
    transaction_id,
    paid_amount,
    payment_type,
    remarks
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[txn]] = await conn.execute(
        `SELECT trainer_payment_id, finance_status FROM trainer_payment_transactions WHERE id=? FOR UPDATE`,
        [transaction_id]
      );

      if (!txn || txn.finance_status !== "Rejected")
        throw new Error("Only rejected transactions can be resent");

      const [[master]] = await conn.execute(
        `SELECT balance_amount FROM trainer_payment WHERE id=? FOR UPDATE`,
        [txn.trainer_payment_id]
      );

      if (Number(paid_amount) > Number(master.balance_amount))
        throw new Error("Amount exceeds balance");

      // 🔹 Reset same transaction row
      await conn.execute(
        `
      UPDATE trainer_payment_transactions
      SET paid_amount=?,
          payment_type=?,
          remarks=?,
          finance_status='Pending',
          reject_reason=NULL,
          verified_by=NULL,
          verified_date=NULL
      WHERE id=?
      `,
        [paid_amount, payment_type, remarks, transaction_id]
      );

      await conn.execute(
        `UPDATE trainer_payment SET status='Awaiting Finance' WHERE id=?`,
        [txn.trainer_payment_id]
      );

      await conn.commit();
      return { status: true, message: "Resent to finance head" };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = trainerPaymentModal;
