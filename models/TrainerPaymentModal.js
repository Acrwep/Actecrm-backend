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
            ROUND(((tm.commercial / l.primary_fees) * 100), 2) AS commercial_percentage,
            c.linkedin_review,
            c.google_review,
            c.class_percentage,
            c.lead_id
        FROM trainer_mapping AS tm
        INNER JOIN customers AS c 
            ON tm.customer_id = c.id
        INNER JOIN lead_master AS l ON
        	l.id = c.lead_id
        WHERE
            tm.is_verified = 1
            AND tm.trainer_id = ?
            AND NOT EXISTS (
                SELECT 1
                FROM trainer_payment_trans tpt
                WHERE tpt.trainer_mapping_id = tm.id
            );`,
        [trainer_id],
      );

      let res = await Promise.all(
        result.map(async (item) => {
          // Get total paid amount for specific customer
          const [getPaidAmount] = await pool.query(
            `SELECT 
                COALESCE(pm.total_amount, 0) AS total_amount,
                COALESCE(SUM(pt.amount), 0) AS paid_amount 
            FROM payment_master AS pm 
            LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status IN ('Verified', 'Verify Pending')
            WHERE pm.lead_id = ?
            GROUP BY pm.total_amount`,
            [item.lead_id],
          );

          // Now you can safely access the values
          const totalAmount = getPaidAmount[0]?.total_amount || 0;
          const paidAmount = getPaidAmount[0]?.paid_amount || 0;

          // Format customer result
          return {
            ...item,
            balance_amount: parseFloat((totalAmount - paidAmount).toFixed(2)),
            total_amount: totalAmount,
            paid_amount: paidAmount,
          };
        }),
      );

      return res;
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
    students,
  ) => {
    try {
      let affectedRows = 0;

      if (!students && students.length <= 0)
        throw new Error("Students cannot be empty");

      const masterQuery = `INSERT INTO trainer_payment_master(
          bill_raisedate,
          trainer_id,
          request_amount,
          balance_amount,
          days_taken_topay,
          deadline_date,
          status,
          created_by,
          created_date
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const masterValues = [
        bill_raisedate,
        trainer_id,
        request_amount,
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

  getPayments: async (
    start_date,
    end_date,
    status,
    trainer_id,
    page,
    limit,
  ) => {
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
        IFNULL(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed,
        IFNULL(SUM(CASE WHEN status = 'Payment Rejected' THEN 1 ELSE 0 END), 0) AS payment_rejected
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

      if (status) {
        getQuery += ` AND tm.status = ?`;
        countQuery += ` AND tm.status = ?`;
        queryParams.push(status);
        countParams.push(status);
      }

      if (trainer_id) {
        getQuery += ` AND tm.trainer_id = ?`;
        countQuery += ` AND tm.trainer_id = ?`;
        statusCountQuery += ` AND trainer_id = ?`;
        queryParams.push(trainer_id);
        countParams.push(trainer_id);
        statusParams.push(trainer_id);
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
              c.lead_id,
              c.linkedin_review,
              c.google_review,
              c.class_percentage,
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
            [item.id],
          );

          let stds = await Promise.all(
            students.map(async (item) => {
              const [getPaidAmount] = await pool.query(
                `SELECT 
                    COALESCE(pm.total_amount, 0) AS total_amount,
                    COALESCE(SUM(pt.amount), 0) AS paid_amount 
                FROM payment_master AS pm 
                LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status IN ('Verified', 'Verify Pending')
                WHERE pm.lead_id = ?
                GROUP BY pm.total_amount`,
                [item.lead_id],
              );

              // Now you can safely access the values
              const totalAmount = getPaidAmount[0]?.total_amount || 0;
              const paidAmount = getPaidAmount[0]?.paid_amount || 0;

              return {
                ...item,
                balance_amount: parseFloat(
                  (totalAmount - paidAmount).toFixed(2),
                ),
                total_amount: totalAmount,
                paid_amount: paidAmount,
              };
            }),
          );

          const [payments] = await pool.query(
            `SELECT
              tp.id,
              tp.paid_amount,
              tp.status,
              tp.reason,
              tp.rejected_date,
              tp.payment_screenshot,
              tp.paid_date,
              tp.paid_by,
              tp.payment_type,
              u.user_name AS paid_user
          FROM
              trainer_payment AS tp
          LEFT JOIN users AS u ON
              tp.paid_by = u.user_id
          WHERE tp.payment_master_id = ?
          ORDER BY tp.id DESC`,
            [item.id],
          );

          const [scoreCard] = await pool.query(
            `SELECT
                COUNT(tt.id) AS total_students,
                IFNULL(SUM(CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_linkedin,
                IFNULL(SUM(CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_google
            FROM
                trainer_payment_master AS tpm
            INNER JOIN trainer_payment_trans AS tt ON
                tpm.id = tt.payment_master_id
            INNER JOIN trainer_mapping AS tm ON
                tm.id = tt.trainer_mapping_id
            INNER JOIN customers AS c ON
                c.id = tm.customer_id
            WHERE tpm.trainer_id = ?`,
            [item.trainer_id],
          );

          return {
            ...item,
            students: stds,
            payments: payments,
            scoreCard: scoreCard[0],
          };
        }),
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
  financeJuniorApprove: async (
    trainer_payment_id,
    paid_amount,
    payment_type,
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [checkStatus] = await conn.query(
        `SELECT status FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      if (checkStatus[0].status !== "Requested")
        throw new Error("Only Requested payments can be processed");

      await conn.query(
        `INSERT INTO trainer_payment(
          payment_master_id,
          paid_amount,
          status,
          payment_type
        )
        VALUES(?, ?, ?, ?)`,
        [trainer_payment_id, paid_amount, "Pending", payment_type],
      );

      const [master] = await conn.execute(
        `SELECT request_amount, paid_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      const totalPaid = Number(master[0].paid_amount) + Number(paid_amount);
      const balance = Number(master[0].request_amount) - totalPaid;

      await conn.execute(
        `UPDATE trainer_payment_master SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?`,
        [totalPaid, balance, "Awaiting Finance", trainer_payment_id],
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
    payment_trans_id,
    payment_screenshot,
    paid_date,
    paid_by,
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE
          trainer_payment
        SET
            status = ?,
            payment_screenshot = ?,
            paid_date = ?,
            paid_by = ?
        WHERE id = ?`,
        ["Completed", payment_screenshot, paid_date, paid_by, payment_trans_id],
      );

      const [master] = await conn.execute(
        `SELECT request_amount, paid_amount, balance_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      const balance = Number(master[0].balance_amount);

      await conn.execute(
        `UPDATE trainer_payment_master SET status = ?, is_verified = 1, verified_by = ?, verified_date = ?, fully_paid_date = ? WHERE id = ?`,
        [
          balance === 0 ? "Completed" : "Requested",
          paid_by,
          paid_date,
          balance === 0 ? paid_date : null,
          trainer_payment_id,
        ],
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
    payment_trans_id,
    rejected_reason,
    rejected_date,
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [master] = await conn.query(
        `SELECT status, request_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      if (!master || master[0].status !== "Awaiting Finance")
        throw new Error("Only Awaiting Finance requests can be rejected");

      await pool.query(
        `UPDATE trainer_payment SET status = 'Rejected', reason = ?, rejected_date = ? WHERE id = ?`,
        [rejected_reason, rejected_date, payment_trans_id],
      );

      const [paid] = await pool.query(
        `SELECT SUM(paid_amount) AS total_paid FROM trainer_payment WHERE payment_master_id = ? AND status IN ('Pending', 'Completed')`,
        [trainer_payment_id],
      );

      const total_paid = Number(paid[0].total_paid);
      const request_amount = Number(master[0].request_amount);
      const balance_amount = request_amount - total_paid;

      await pool.query(
        `UPDATE trainer_payment_master SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?`,
        [total_paid, balance_amount, "Payment Rejected", trainer_payment_id],
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
        [trainer_payment_id],
      );
      affectedRows += deleteMaster.affectedRows;

      const [deleteTrans] = await pool.query(
        `DELETE FROM trainer_payment_trans WHERE payment_master_id = ?`,
        [trainer_payment_id],
      );
      affectedRows += deleteTrans.affectedRows;

      const [deletePayment] = await pool.query(
        `DELETE FROM trainer_payment WHERE payment_master_id = ?`,
        [trainer_payment_id],
      );
      affectedRows += deletePayment.affectedRows;

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateTrainerPayment: async (
    trainer_payment_id,
    payment_trans_id,
    paid_amount,
    payment_type,
  ) => {
    try {
      const [checkStatus] = await pool.query(
        `SELECT status, request_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      if (checkStatus[0].status !== "Payment Rejected")
        throw new Error("Only rejected payments can be processed");

      await pool.query(
        `UPDATE trainer_payment SET status = 'Pending', payment_type = ?, paid_amount = ?, reason = null, rejected_date = null WHERE id = ?`,
        [payment_type, paid_amount, payment_trans_id],
      );

      const [paid] = await pool.query(
        `SELECT SUM(paid_amount) AS total_paid FROM trainer_payment WHERE payment_master_id = ? AND status IN ('Pending', 'Completed')`,
        [trainer_payment_id],
      );

      const total_paid = Number(paid[0].total_paid);
      const request_amount = Number(checkStatus[0].request_amount);
      const balance_amount = request_amount - total_paid;

      await pool.query(
        `UPDATE trainer_payment_master SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?`,
        [total_paid, balance_amount, "Awaiting Finance", trainer_payment_id],
      );

      return { status: true };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateStudentStatus: async (trainer_payment_id, bill_raisedate, students) => {
    try {
      let affectedRows = 0;
      const [isExists] = await pool.query(
        `SELECT id FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      if (isExists.length <= 0) throw new Error("Invalid Id");

      for (const student of students) {
        const [updateStudent] = await pool.query(
          `UPDATE trainer_payment_trans SET trainer_mapping_id = ?, streams = ?, commercial = ?, commercial_percentage = ?, attendance_status = ?, attendance_sheetlink = ?, attendance_screenshot = ? WHERE id = ?`,
          [
            student.trainer_mapping_id,
            student.streams,
            student.commercial,
            student.commercial_percentage,
            student.attendance_status,
            student.attendance_sheetlink,
            student.attendance_screenshot,
            student.payment_trans_id,
          ],
        );

        affectedRows += updateStudent.affectedRows;
      }

      const [updateTrainer] = await pool.query(
        `UPDATE trainer_payment_master SET bill_raisedate = ? WHERE id = ?`,
        [bill_raisedate, trainer_payment_id],
      );

      affectedRows += updateTrainer.affectedRows;

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = trainerPaymentModal;
