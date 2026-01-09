const pool = require("../config/dbconfig");

const trainerPaymentModal = {
  checkActiveTrainerPaymentRequest: async (customer_id) => {
    const [rows] = await pool.execute(
      `SELECT id FROM trainer_payment
     WHERE customer_id = ? 
     LIMIT 1`,
      [customer_id]
    );
    return rows.length > 0;
  },

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
    created_by
  ) => {
    try {
      const isExists =
        await trainerPaymentModal.checkActiveTrainerPaymentRequest(customer_id);

      if (isExists) {
        return {
          status: false,
          message: "Payment request already exists for this customer",
        };
      }

      const [result] = await pool.execute(
        `INSERT INTO trainer_payment 
        (bill_raisedate, streams, attendance_status, attendance_sheetlink, attendance_screenshot,
         customer_id, trainer_id, request_amount, paid_amount, balance_amount, commercial_percentage,
         days_taken_topay, deadline_date, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'Requested', ?)`,
        [
          bill_raisedate,
          streams,
          attendance_status,
          attendance_sheetlink,
          attendance_screenshot,
          customer_id,
          trainer_id,
          request_amount,
          request_amount, // balance_amount
          commercial_percentage,
          days_taken_topay,
          deadline_date,
          created_by,
        ]
      );
      return {
        status: true,
        message: "Trainer payment request created",
        insertId: result.insertId,
      };
    } catch (err) {
      console.error(err);
      return {
        status: false,
        message: "Failed to insert trainer payment",
        error: err.message,
      };
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
  financeJuniorCreateTransaction: async (
    trainer_payment_id,
    paid_amount,
    payment_type,
    remarks
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[master]] = await conn.execute(
        `SELECT balance_amount,status FROM trainer_payment WHERE id=? FOR UPDATE`,
        [trainer_payment_id]
      );
      if (!master || master.status !== "Requested")
        throw new Error("Only Requested payments can be processed");
      if (Number(paid_amount) > Number(master.balance_amount))
        throw new Error("Paid amount exceeds balance");

      await conn.execute(
        `INSERT INTO trainer_payment_transactions (trainer_payment_id, paid_amount, payment_type, remarks, finance_status)
         VALUES (?, ?, ?, ?, 'Pending')`,
        [trainer_payment_id, paid_amount, payment_type, remarks]
      );

      await conn.execute(
        `UPDATE trainer_payment SET status='Awaiting Finance' WHERE id=?`,
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
    transaction_id,
    payment_screenshot,
    finance_head_id
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[txn]] = await conn.execute(
        `SELECT * FROM trainer_payment_transactions WHERE id=? AND finance_status='Pending' FOR UPDATE`,
        [transaction_id]
      );
      if (!txn) throw new Error("Invalid or already processed transaction");

      const [[master]] = await conn.execute(
        `SELECT request_amount, paid_amount FROM trainer_payment WHERE id=? FOR UPDATE`,
        [txn.trainer_payment_id]
      );

      const totalPaid = Number(master.paid_amount) + Number(txn.paid_amount);
      const balance = Number(master.request_amount) - totalPaid;

      await conn.execute(
        `UPDATE trainer_payment_transactions SET finance_status='Approved', payment_screenshot=?, verified_by=?, verified_date=NOW() WHERE id=?`,
        [payment_screenshot, finance_head_id, transaction_id]
      );

      await conn.execute(
        `UPDATE trainer_payment SET paid_amount=?, balance_amount=?, status=?, verified_by=? WHERE id=?`,
        [
          totalPaid,
          balance,
          balance === 0 ? "Completed" : "Requested",
          finance_head_id,
          txn.trainer_payment_id,
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
    reject_reason,
    finance_head_id
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[master]] = await conn.execute(
        `SELECT status FROM trainer_payment WHERE id=? FOR UPDATE`,
        [trainer_payment_id]
      );

      if (!master || master.status !== "Awaiting Finance")
        throw new Error("Only Awaiting Finance requests can be rejected");

      // 🔹 Reject only the latest Pending transaction
      await conn.execute(
        `
      UPDATE trainer_payment_transactions
      SET finance_status='Rejected',
          reject_reason=?,
          verified_by=?,
          verified_date=NOW()
      WHERE trainer_payment_id=?
        AND finance_status='Pending'
      ORDER BY id DESC
      LIMIT 1
      `,
        [reject_reason, finance_head_id, trainer_payment_id]
      );

      // 🔹 Update only master status
      await conn.execute(
        `UPDATE trainer_payment SET status='Rejected' WHERE id=?`,
        [trainer_payment_id]
      );

      await conn.commit();
      return { status: true, message: "Payment rejected successfully" };
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
