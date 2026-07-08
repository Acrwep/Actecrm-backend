const pool = require("../config/dbconfig");
const EmailModel = require("./EmailModel");

const trainerPaymentModal = {
  getStudents: async (trainer_id, commercial_type, batch_id) => {
    try {
      let result;

      if (commercial_type === "Pay Per Head") {
        const [res] = await pool.query(
          `SELECT
            tm.id AS trainer_mapping_id,
            tm.trainer_id,
            c.id,
            c.name,
            c.email AS customer_email,
            c.phone AS customer_mobile,
            t.name AS course_name,
            tm.commercial,
            ROUND(((tm.commercial / l.primary_fees) * 100), 2) AS commercial_percentage,
            c.linkedin_review,
            c.google_review,
            c.class_percentage,
            c.is_certificate_generated,
            c.lead_id,
            COALESCE(pm.total_amount, 0) AS total_amount,
            COALESCE(ps.total_paid, 0) AS paid_amount,
            (COALESCE(pm.total_amount, 0) - COALESCE(ps.total_paid, 0)) AS balance_amount
        FROM trainer_mapping AS tm
        INNER JOIN customers AS c 
            ON tm.customer_id = c.id
        INNER JOIN lead_master AS l ON
        	l.id = c.lead_id
        INNER JOIN payment_master AS pm ON
        	pm.lead_id = c.lead_id
        INNER JOIN technologies AS t ON
          t.id = c.enrolled_course
        LEFT JOIN(
        	SELECT SUM(pt.amount) AS total_paid, pt.payment_master_id FROM payment_trans AS pt
            WHERE pt.payment_status IN ('Verified', 'Verify Pending')
            GROUP BY pt.payment_master_id
        ) AS ps ON ps.payment_master_id = pm.id
        WHERE
            tm.is_verified = 1
            AND tm.is_rejected = 0
            AND tm.trainer_id = ?
            AND NOT EXISTS (
                SELECT 1
                FROM trainer_payment_trans tpt
                WHERE tpt.trainer_mapping_id = tm.id
            );`,
          [trainer_id],
        );

        result = res;
      } else {
        const [res] = await pool.query(
          `SELECT
            tm.id AS trainer_mapping_id,
            tm.trainer_id,
            c.id,
            c.name,
            c.email AS customer_email,
            c.phone AS customer_mobile,
            t.name AS course_name,
            tm.commercial,
            ROUND(((tm.commercial / l.primary_fees) * 100), 2) AS commercial_percentage,
            c.linkedin_review,
            c.google_review,
            c.class_percentage,
            c.is_certificate_generated,
            c.lead_id,
            COALESCE(pm.total_amount, 0) AS total_amount,
            COALESCE(ps.total_paid, 0) AS paid_amount,
            (COALESCE(pm.total_amount, 0) - COALESCE(ps.total_paid, 0)) AS balance_amount
        FROM batch_master AS bm
        INNER JOIN batch_trans AS bt ON
        	bt.batch_master_id = bm.id
        INNER JOIN trainer_mapping tm ON
        	tm.customer_id = bt.customer_id
            AND tm.is_verified = 1
            AND tm.is_rejected = 0
        INNER JOIN customers AS c 
            ON tm.customer_id = c.id
        INNER JOIN lead_master AS l ON
        	l.id = c.lead_id
        INNER JOIN payment_master AS pm ON
        	pm.lead_id = c.lead_id
        INNER JOIN technologies AS t ON
          t.id = c.enrolled_course
        LEFT JOIN(
        	SELECT SUM(pt.amount) AS total_paid, pt.payment_master_id FROM payment_trans AS pt
            WHERE pt.payment_status IN ('Verified', 'Verify Pending')
            GROUP BY pt.payment_master_id
        ) AS ps ON ps.payment_master_id = pm.id
        WHERE
            bm.id = ?`,
          [batch_id],
        );
        result = res;
      }

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
          place_of_sale,
          place_of_supply,
          commercial,
          commercial_percentage,
          attendance_status,
          attendance_sheetlink,
          attendance_screenshot,
          screenshot
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      for (const student of students) {
        const transValues = [
          insertMaster.insertId,
          student.trainer_mapping_id,
          student.place_of_sale,
          student.place_of_supply,
          student.commercial,
          student.commercial_percentage,
          student.attendance_status,
          student.attendance_sheetlink,
          student.attendance_screenshot,
          student.screenshot,
        ];

        const [insertTrans] = await pool.query(transQuery, transValues);

        affectedRows += insertTrans.affectedRows;
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  requestPaymentV1: async (
    trainer_id,
    request_amount,
    bank_id,
    commercial_type,
    created_by,
    created_date,
    feedback,
    students,
    email_link,
    batch_id,
  ) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let affectedRows = 0;

      if (!students || students.length <= 0)
        throw new Error("Students cannot be empty");

      const masterQuery = `INSERT INTO trainer_payment_master(
          bill_raisedate,
          trainer_id,
          request_amount,
          balance_amount,
          commercial_type,
          batch_id,
          bank_id,
          status,
          created_by,
          created_date,
          feedback
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const masterValues = [
        created_date,
        trainer_id,
        request_amount,
        request_amount,
        commercial_type,
        batch_id,
        bank_id,
        "Link Sent",
        created_by,
        created_date,
        feedback,
      ];

      const [insertMaster] = await connection.query(masterQuery, masterValues);

      affectedRows += insertMaster.affectedRows;

      let emailTasks = [];

      const transQuery = `INSERT INTO trainer_payment_trans(
          payment_master_id,
          trainer_mapping_id,
          commercial,
          commercial_percentage,
          attendance_status,
          attendance_sheetlink,
          attendance_screenshot,
          screenshot,
          duration_in_hours,
          training_mode,
          branch_id,
          study_material,
          assessment,
          placement_guidance,
          hr_rating,
          coordinator_rating
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      for (const student of students) {
        const transValues = [
          insertMaster.insertId,
          student.trainer_mapping_id,
          student.commercial,
          student.commercial_percentage,
          student.attendance_status,
          student.attendance_sheetlink,
          student.attendance_screenshot,
          student.screenshot,
          student.duration_in_hours,
          student.training_mode,
          student.branch_id,
          student.study_material,
          student.assessment,
          student.placement_guidance,
          student.hr_rating,
          student.coordinator_rating,
        ];

        const [insertTrans] = await connection.query(transQuery, transValues);

        affectedRows += insertTrans.affectedRows;

        // Fetch customer details to send acknowledgement email
        const [customerDetails] = await connection.query(
          `SELECT c.id AS customer_id, c.email FROM trainer_mapping AS tm INNER JOIN customers AS c ON tm.customer_id = c.id WHERE tm.id = ?`,
          [student.trainer_mapping_id],
        );

        if (customerDetails.length > 0) {
          emailTasks.push({
            email: customerDetails[0].email,
            customer_id: customerDetails[0].customer_id,
          });
        }
      }

      await connection.commit();

      // Send emails after successful commit
      for (const task of emailTasks) {
        try {
          if (task.email) {
            await EmailModel.sendStudentAcknowledgementMail(
              task.email,
              email_link,
              task.customer_id,
            );
          }
        } catch (emailError) {
          console.error(
            `Error sending student acknowledgement email to customer ${task.customer_id}:`,
            emailError.message,
          );
        }
      }

      return {
        trainer_id: trainer_id,
        payment_master_id: insertMaster.insertId,
      };
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  getPayments: async (
    start_date,
    end_date,
    status,
    trainer_id,
    page,
    limit,
    type,
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
          tm.created_date,
          tm.bank_id,
          tm.commercial_type,
          tm.feedback
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
        IFNULL(SUM(CASE WHEN status IN('Link Sent', 'Rejected') THEN 1 ELSE 0 END), 0) AS link_sent,
        IFNULL(SUM(CASE WHEN status IN('Requested', 'Rejected') THEN 1 ELSE 0 END), 0) AS requested,
        IFNULL(SUM(CASE WHEN status = 'Awaiting Approval' THEN 1 ELSE 0 END), 0) AS awaiting_approval,
        IFNULL(SUM(CASE WHEN status = 'Awaiting Finance' THEN 1 ELSE 0 END), 0) AS awaiting_finance,
        IFNULL(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed,
        IFNULL(SUM(CASE WHEN status IN ('Payment Rejected', 'Approval Rejected') THEN 1 ELSE 0 END), 0) AS payment_rejected,
        IFNULL(SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END), 0) AS paid
      FROM
          trainer_payment_master
      WHERE 1 = 1`;

      if (start_date && end_date) {
        if (type === "Deadline") {
          getQuery += ` AND tm.deadline_date BETWEEN ? AND ?`;
          countQuery += ` AND tm.deadline_date BETWEEN ? AND ?`;
          statusCountQuery += ` AND deadline_date BETWEEN ? AND ?`;
        } else {
          getQuery += ` AND tm.bill_raisedate BETWEEN ? AND ?`;
          countQuery += ` AND tm.bill_raisedate BETWEEN ? AND ?`;
          statusCountQuery += ` AND bill_raisedate BETWEEN ? AND ?`;
        }
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
      }

      if (status) {
        if (status === "Payment Rejected") {
          getQuery += ` AND tm.status IN ('Payment Rejected', 'Approval Rejected')`;
          countQuery += ` AND tm.status IN ('Payment Rejected', 'Approval Rejected')`;
        } else {
          getQuery += ` AND tm.status = ?`;
          countQuery += ` AND tm.status = ?`;
          queryParams.push(status);
          countParams.push(status);
        }
      }

      if (trainer_id) {
        getQuery += ` AND tm.trainer_id = ?`;
        countQuery += ` AND tm.trainer_id = ?`;
        statusCountQuery += ` AND trainer_id = ?`;
        queryParams.push(trainer_id);
        countParams.push(trainer_id);
        statusParams.push(trainer_id);
      }

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY tm.bill_raisedate DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [[countResult], [statusResult], [result]] = await Promise.all([
        pool.query(countQuery, countParams),
        pool.query(statusCountQuery, statusParams),
        pool.query(getQuery, queryParams),
      ]);

      const total = countResult[0]?.total || 0;

      const ids = [...new Set(result.map((item) => item.id))];

      let students = new Map();

      if (ids.length > 0) {
        const [studentsData] = await pool.query(
          `SELECT
                tp.id AS payment_trans_id,
                tp.payment_master_id,
                tp.trainer_mapping_id,
                tm.customer_id,
                c.name AS customer_name,
                c.email AS customer_email,
                c.phone AS customer_phone,
                t.name AS course_name,
                c.lead_id,
                c.linkedin_review,
                CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END AS is_linkedin,
                c.google_review,
                CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END AS is_google,
                c.class_percentage,
                CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END AS is_class_percentage,
                c.is_acknowledged,
                c.acknowledged_date,
                tp.place_of_supply,
                tp.place_of_sale,
                tp.commercial,
                tp.commercial_percentage,
                tp.attendance_status,
                tp.attendance_sheetlink,
                tp.attendance_screenshot,
                tp.screenshot,
                COALESCE(pm.total_amount, 0) AS total_amount,
                COALESCE(ps.paid_amount, 0) AS paid_amount,
                (COALESCE(pm.total_amount, 0) - COALESCE(ps.paid_amount, 0)) AS balance_amount,
                CASE WHEN (COALESCE(pm.total_amount, 0) - COALESCE(ps.paid_amount, 0)) > 0 THEN 0 ELSE 1 END AS is_payment_cleared,
                tp.duration_in_hours,
                tp.training_mode,
                tp.branch_id,
                tp.study_material,
                tp.assessment,
                tp.placement_guidance,
                tp.hr_rating,
                tp.coordinator_rating,
                l.ra_id AS ra_user_id,
                ru.user_name AS ra_user_name,
                tr.created_by AS hr_user_id,
                hu.user_name AS hr_user_name,
                cm.name AS mode_of_training
            FROM
                trainer_payment_trans AS tp
            LEFT JOIN trainer_mapping AS tm ON
                tp.trainer_mapping_id = tm.id
            LEFT JOIN customers AS c ON
                c.id = tm.customer_id
            LEFT JOIN lead_master AS l ON
                l.id = c.lead_id
            LEFT JOIN class_mode AS cm ON
                cm.id = l.preferred_mode
            LEFT JOIN users AS ru ON
                ru.user_id = l.ra_id
            LEFT JOIN technologies AS t ON
                t.id = c.enrolled_course
            LEFT JOIN payment_master AS pm ON
            	  pm.lead_id = c.lead_id
            LEFT JOIN trainer AS tr ON
                tm.trainer_id = tr.id
            LEFT JOIN users AS hu ON
                hu.user_id = tr.created_by
            LEFT JOIN(
            	SELECT pt.payment_master_id, SUM(pt.amount) AS paid_amount FROM payment_trans AS pt
                WHERE pt.payment_status IN ('Verified', 'Verify Pending')
                GROUP BY pt.payment_master_id
            ) AS ps ON ps.payment_master_id = pm.id
            WHERE tp.payment_master_id IN (?)`,
          [ids],
        );

        studentsData.forEach((s) => {
          const { payment_master_id, ...rest } = s;
          if (!students.has(payment_master_id)) {
            students.set(payment_master_id, []);
          }
          students.get(payment_master_id).push(rest);
        });
      }

      // let payments = new Map();

      // if (ids.length > 0) {
      //   const [paymentsData] = await pool.query(
      //     `SELECT
      //         tp.id,
      //         tp.payment_master_id,
      //         tp.paid_amount,
      //         tp.status,
      //         tp.reason,
      //         tp.rejected_date,
      //         tp.payment_screenshot,
      //         tp.approved_screenshot,
      //         tp.paid_date,
      //         tp.paid_by,
      //         tp.payment_type,
      //         u.user_name AS paid_user
      //     FROM
      //         trainer_payment AS tp
      //     LEFT JOIN users AS u ON
      //         tp.paid_by = u.user_id
      //     WHERE tp.payment_master_id IN (?)`,
      //     [ids],
      //   );

      //   paymentsData.forEach((p) => {
      //     const { payment_master_id, ...rest } = p;
      //     if (!payments.has(payment_master_id)) {
      //       payments.set(payment_master_id, []);
      //     }
      //     payments.get(payment_master_id).push(rest);
      //   });
      // }

      // let scoreCard = new Map();

      // if (ids.length > 0) {
      //   const [scoreCardData] = await pool.query(
      //     `SELECT
      //           COUNT(tt.id) AS total_students,
      //           IFNULL(SUM(CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_linkedin,
      //           IFNULL(SUM(CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_google,
      //           tpm.id AS payment_master_id
      //       FROM
      //           trainer_payment_master AS tpm
      //       INNER JOIN trainer_payment_trans AS tt ON
      //           tpm.id = tt.payment_master_id
      //       INNER JOIN trainer_mapping AS tm ON
      //           tm.id = tt.trainer_mapping_id
      //       INNER JOIN customers AS c ON
      //           c.id = tm.customer_id
      //       WHERE tpm.id IN (?) GROUP BY tpm.id`,
      //     [ids],
      //   );

      //   scoreCardData.forEach((s) => {
      //     const { payment_master_id, ...rest } = s;
      //     scoreCard.set(payment_master_id, rest);
      //   });
      // }

      let res = result.map((item) => {
        return {
          ...item,
          students: students.get(item.id) || [],
          // payments: payments.get(item.id) || [],
          // scoreCard: scoreCard.get(item.id) || null,
        };
      });

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

  getPaymentById: async (payment_id) => {
    try {
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
          tm.created_date,
          tm.bank_id,
          tm.commercial_type,
          tm.feedback,
          tba.account_holder_name,
          tba.account_number,
          tba.bank_name,
          tba.ifsc_code,
          tba.branch_name
      FROM
          trainer_payment_master AS tm
      INNER JOIN trainer AS t ON
          t.id = tm.trainer_id
      LEFT JOIN users AS vu ON
          vu.user_id = tm.verified_by
      LEFT JOIN users AS cu ON
        cu.user_id = tm.created_by
      LEFT JOIN trainer_bank_accounts AS tba ON
        tba.id = tm.bank_id
      WHERE tm.id = ?`;

      const [result] = await pool.query(getQuery, [payment_id]);

      let students = new Map();
      let payments = new Map();
      let scoreCard = new Map();

      const [studentsData] = await pool.query(
        `SELECT
                tp.id AS payment_trans_id,
                tp.payment_master_id,
                tp.trainer_mapping_id,
                tm.customer_id,
                c.name AS customer_name,
                c.email AS customer_email,
                t.name AS course_name,
                c.phone AS customer_mobile,
                c.lead_id,
                c.linkedin_review,
                CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END AS is_linkedin,
                c.google_review,
                CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END AS is_google,
                c.class_percentage,
                CASE WHEN IFNULL(c.class_percentage, 0) = 100 THEN 1 ELSE 0 END AS is_class_percentage,
                c.is_acknowledged,
                c.acknowledged_date,
                c.is_certificate_generated,
                tp.place_of_supply,
                tp.place_of_sale,
                tp.commercial,
                tp.commercial_percentage,
                tp.attendance_status,
                tp.attendance_sheetlink,
                tp.attendance_screenshot,
                tp.screenshot,
                COALESCE(pm.total_amount, 0) AS total_amount,
                COALESCE(ps.paid_amount, 0) AS paid_amount,
                (COALESCE(pm.total_amount, 0) - COALESCE(ps.paid_amount, 0)) AS balance_amount,
                CASE WHEN (COALESCE(pm.total_amount, 0) - COALESCE(ps.paid_amount, 0)) > 0 THEN 0 ELSE 1 END AS is_payment_cleared,
                tp.duration_in_hours,
                tp.training_mode,
                tp.branch_id,
                tp.study_material,
                tp.assessment,
                tp.placement_guidance,
                tp.hr_rating,
                tp.coordinator_rating,
                l.ra_id AS ra_user_id,
                ru.user_name AS ra_user_name,
                tr.created_by AS hr_user_id,
                hu.user_name AS hr_user_name,
                cm.name AS mode_of_training
            FROM
                trainer_payment_trans AS tp
            LEFT JOIN trainer_mapping AS tm ON
                tp.trainer_mapping_id = tm.id
            LEFT JOIN customers AS c ON
                c.id = tm.customer_id
            LEFT JOIN lead_master AS l ON
                l.id = c.lead_id
            LEFT JOIN class_mode AS cm ON
                cm.id = l.preferred_mode
            LEFT JOIN users AS ru ON
                ru.user_id = l.ra_id
            LEFT JOIN technologies AS t ON
                t.id = c.enrolled_course
            LEFT JOIN payment_master AS pm ON
            	  pm.lead_id = c.lead_id
            LEFT JOIN trainer AS tr ON
                tm.trainer_id = tr.id
            LEFT JOIN users AS hu ON
                hu.user_id = tr.created_by
            LEFT JOIN(
            	SELECT pt.payment_master_id, SUM(pt.amount) AS paid_amount FROM payment_trans AS pt
                WHERE pt.payment_status IN ('Verified', 'Verify Pending')
                GROUP BY pt.payment_master_id
            ) AS ps ON ps.payment_master_id = pm.id
            WHERE tp.payment_master_id = ?`,
        [payment_id],
      );

      studentsData.forEach((s) => {
        const { payment_master_id, ...rest } = s;
        if (!students.has(payment_master_id)) {
          students.set(payment_master_id, []);
        }
        students.get(payment_master_id).push(rest);
      });

      const [paymentsData] = await pool.query(
        `SELECT
              tp.id,
              tp.payment_master_id,
              tp.paid_amount,
              tp.status,
              tp.reason,
              tp.rejected_date,
              tp.payment_screenshot,
              tp.approved_screenshot,
              tp.paid_date,
              tp.paid_by,
              tp.payment_type,
              u.user_name AS paid_user
          FROM
              trainer_payment AS tp
          LEFT JOIN users AS u ON
              tp.paid_by = u.user_id
          WHERE tp.payment_master_id = ?`,
        [payment_id],
      );

      paymentsData.forEach((p) => {
        const { payment_master_id, ...rest } = p;
        if (!payments.has(payment_master_id)) {
          payments.set(payment_master_id, []);
        }
        payments.get(payment_master_id).push(rest);
      });

      const [scoreCardData] = await pool.query(
        `SELECT
                COUNT(tt.id) AS total_students,
                IFNULL(SUM(CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_linkedin,
                IFNULL(SUM(CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_google,
                tpm.id AS payment_master_id
            FROM
                trainer_payment_master AS tpm
            INNER JOIN trainer_payment_trans AS tt ON
                tpm.id = tt.payment_master_id
            INNER JOIN trainer_mapping AS tm ON
                tm.id = tt.trainer_mapping_id
            INNER JOIN customers AS c ON
                c.id = tm.customer_id
            WHERE tpm.id = ? GROUP BY tpm.id`,
        [payment_id],
      );

      scoreCardData.forEach((s) => {
        const { payment_master_id, ...rest } = s;
        scoreCard.set(payment_master_id, rest);
      });

      if (result.length === 0) return null;

      return {
        ...result[0],
        students: students.get(result[0].id) || [],
        payments: payments.get(result[0].id) || [],
        scoreCard: scoreCard.get(result[0].id) || null,
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
        [totalPaid, balance, "Awaiting Approval", trainer_payment_id],
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

  moveToPaid: async (
    trainer_payment_id,
    paid_amount,
    payment_type,
    paid_date,
    paid_by,
    transaction_id,
    payment_mode,
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [checkStatus] = await conn.query(
        `SELECT status FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      if (checkStatus[0].status !== "Awaiting Finance")
        throw new Error("Only Awaiting Finance payments can be processed");

      await conn.query(
        `INSERT INTO trainer_payment(
          payment_master_id,
          paid_amount,
          status,
          payment_type,
          transaction_id,
          payment_mode,
          paid_date,
          paid_by
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trainer_payment_id,
          paid_amount,
          "Completed",
          payment_type,
          transaction_id,
          payment_mode,
          paid_date,
          paid_by,
        ],
      );

      const [master] = await conn.execute(
        `SELECT request_amount, paid_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      const totalPaid = Number(master[0].paid_amount) + Number(paid_amount);
      const balance = Number(master[0].request_amount) - totalPaid;

      await conn.execute(
        `UPDATE trainer_payment_master SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?`,
        [totalPaid, balance, "Paid", trainer_payment_id],
      );

      const [paymentMaster] = await conn.execute(
        `SELECT request_amount, paid_amount, trainer_id, commercial_type, batch_id, bank_id FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
      );

      const [getTrainer] = await conn.query(
        `SELECT email, trainer_id, name FROM trainer WHERE id = ?`,
        [paymentMaster[0].trainer_id],
      );

      if (getTrainer.length === 0) {
        throw new Error("Trainer not found");
      }

      const [getBanks] = await conn.query(
        `SELECT
            trainer_id,
            account_holder_name,
            account_number,
            bank_name,
            branch_name,
            ifsc_code
        FROM
            trainer_bank_accounts
        WHERE id = ?`,
        [paymentMaster[0].bank_id],
      );

      const accountNumber =
        getBanks.length > 0 ? getBanks[0].account_number : "";

      let [getPaidHeads] = await conn.query(
        `SELECT
              tpm.request_amount,
              tpm.commercial_type,
              tpm.batch_id,
              tpm.bank_id,
              tpm.status,
              tpt.commercial,
              tpt.duration_in_hours,
              tpt.training_mode,
              t.name AS course,
              c.name AS cus_name,
              c.phone AS cus_phone
          FROM
              trainer_payment_master AS tpm
          INNER JOIN trainer_payment_trans AS tpt ON
              tpm.id = tpt.payment_master_id
          INNER JOIN trainer_mapping AS tm ON
            tm.id = tpt.trainer_mapping_id
          INNER JOIN customers AS c ON
            c.id = tm.customer_id
          INNER JOIN technologies AS t ON
            c.enrolled_course = t.id
          WHERE tpm.id = ?`,
        [trainer_payment_id],
      );

      const studentDetails = getPaidHeads.map(
        (head) => `${head.cus_phone} - ${head.cus_name}`,
      );

      const dateObj = new Date(paid_date);
      const trainingPeriod = isNaN(dateObj.getTime())
        ? ""
        : dateObj.toLocaleString("en-US", { month: "long", year: "numeric" });

      if (paymentMaster[0].commercial_type === "Pay Per Head") {
        if (getPaidHeads.length > 0) {
          for (const head of getPaidHeads) {
            await EmailModel.sendPayslip(
              getTrainer[0].email,
              getTrainer[0].name,
              getTrainer[0].trainer_id,
              head.course,
              paid_date,
              "",
              head.training_mode,
              head.duration_in_hours,
              payment_mode,
              transaction_id,
              head.status,
              head.commercial,
              0,
              accountNumber,
              head.commercial_type,
              `${head.cus_phone} - ${head.cus_name}`,
              trainingPeriod,
            );
          }
        }
      } else {
        const [getBatch] = await conn.query(
          `SELECT
              id,
              batch_number,
              batch_name
          FROM
              batch_master
          WHERE id = ?`,
          [paymentMaster[0].batch_id],
        );

        const dynamicTrainingMode =
          getPaidHeads.length > 0 ? getPaidHeads[0].training_mode : "Online";

        await EmailModel.sendPayslip(
          getTrainer[0].email,
          getTrainer[0].name,
          getTrainer[0].trainer_id,
          getBatch[0].batch_name,
          paid_date,
          getBatch[0].batch_number,
          dynamicTrainingMode,
          0,
          payment_mode,
          transaction_id,
          "Paid",
          paid_amount,
          studentDetails.length,
          accountNumber,
          paymentMaster[0].commercial_type,
          studentDetails.join(", "),
          trainingPeriod,
        );
      }

      await conn.commit();
      return { status: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Finance Head - Approve & Pay Transaction
  updateTrainerPaymentStatus: async (status, trainer_payment_id) => {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [checkStatus] = await conn.query(
        `SELECT
            CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END AS is_linkedin,
            CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END AS is_google,
            CASE WHEN c.class_percentage = 100 THEN 1 ELSE 0 END AS is_class_percentage,
            CASE WHEN (COALESCE(pm.total_amount, 0) - COALESCE(ps.paid_amount, 0)) > 0 THEN 0 ELSE 1 END AS is_payment_cleared,
            c.is_acknowledged
        FROM
            trainer_payment_master AS tpm
        INNER JOIN trainer_payment_trans AS tpt ON
            tpm.id = tpt.payment_master_id
        INNER JOIN trainer_mapping AS tm ON
          tm.id = tpt.trainer_mapping_id
        INNER JOIN customers AS c ON
          c.id = tm.customer_id
        INNER JOIN payment_master AS pm ON
          pm.lead_id = c.lead_id
        LEFT JOIN (
          SELECT pt.payment_master_id, SUM(pt.amount) AS paid_amount FROM payment_trans AS pt
            WHERE pt.payment_status IN ('Verified', 'Verify Pending')
            GROUP BY pt.payment_master_id
        ) AS ps ON ps.payment_master_id = pm.id
        WHERE
          tpm.id = ?`,
        [trainer_payment_id],
      );

      if (checkStatus.length === 0) {
        throw new Error("No checks data found for this trainer payment.");
      }

      const hasUnsatisfied = checkStatus.some(
        (row) =>
          Number(row.is_linkedin) !== 1 ||
          Number(row.is_google) !== 1 ||
          Number(row.is_class_percentage) !== 1 ||
          Number(row.is_payment_cleared) !== 1 ||
          Number(row.is_acknowledged) !== 1,
      );

      if (hasUnsatisfied) {
        throw new Error(
          "Cannot update status: All check criteria (LinkedIn, Google, Class %, Cleared Payment, Acknowledged) must be satisfied (completed with status 1).",
        );
      }

      await conn.execute(
        `UPDATE trainer_payment_master SET status = ? WHERE id = ?`,
        [status, trainer_payment_id],
      );
      await conn.commit();
      return { status: true, message: "Payment approved successfully" };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  financeHeadApproveAndPay: async (trainers, screenshot) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const trainer of trainers) {
        await conn.query(
          `UPDATE
            trainer_payment
          SET
              status = ?,
              payment_screenshot = ?,
              paid_date = ?,
              paid_by = ?
          WHERE id = ?`,
          [
            "Paid",
            screenshot,
            trainer.paid_date,
            trainer.paid_by,
            trainer.payment_trans_id,
          ],
        );

        const [master] = await conn.execute(
          `SELECT request_amount, paid_amount, balance_amount FROM trainer_payment_master WHERE id = ?`,
          [trainer.trainer_payment_id],
        );

        const balance = Number(master[0].balance_amount);

        await conn.execute(
          `UPDATE trainer_payment_master SET status = ?, is_verified = 1, verified_by = ?, verified_date = ?, fully_paid_date = ? WHERE id = ?`,
          [
            "Paid",
            trainer.paid_by,
            trainer.paid_date,
            balance === 0 ? trainer.paid_date : null,
            trainer.trainer_payment_id,
          ],
        );
      }

      await conn.commit();
      return { status: true, message: "Payment approved successfully" };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  completeRequest: async (trainers) => {
    try {
      for (const trainer of trainers) {
        await pool.query(
          `UPDATE trainer_payment SET status = 'Completed', approved_screenshot = ? WHERE id = ?`,
          [trainer.screenshot, trainer.payment_trans_id],
        );

        const [master] = await pool.query(
          `SELECT request_amount, paid_amount, balance_amount FROM trainer_payment_master WHERE id = ?`,
          [trainer.trainer_payment_id],
        );

        const balance = Number(master[0].balance_amount);

        await pool.query(
          `UPDATE trainer_payment_master SET status = ? WHERE id = ?`,
          [
            balance === 0 ? "Completed" : "Requested",
            trainer.trainer_payment_id,
          ],
        );
      }

      return { status: true, message: "Payment approved successfully" };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Finance Head - Reject Request
  rejectTrainerPaymentApproval: async (
    rejected_reason,
    rejected_date,
    trainer_payment_id,
    payment_trans_id,
  ) => {
    const conn = await pool.getConnection();

    try {
      await pool.query(
        `UPDATE trainer_payment SET status = 'Rejected', reason = ?, rejected_date = ? WHERE id = ?`,
        [rejected_reason, rejected_date, payment_trans_id],
      );

      const [master] = await conn.query(
        `SELECT status, request_amount FROM trainer_payment_master WHERE id = ?`,
        [trainer_payment_id],
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
        [total_paid, balance_amount, "Approval Rejected", trainer_payment_id],
      );
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  rejectTrainerPayment: async (trainers) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const trainer of trainers) {
        const [master] = await conn.query(
          `SELECT status, request_amount FROM trainer_payment_master WHERE id = ?`,
          [trainer.trainer_payment_id],
        );

        if (!master || master[0].status !== "Awaiting Finance")
          throw new Error("Only Awaiting Finance requests can be rejected");

        await pool.query(
          `UPDATE trainer_payment SET status = 'Rejected', reason = ?, rejected_date = ? WHERE id = ?`,
          [
            trainer.rejected_reason,
            trainer.rejected_date,
            trainer.payment_trans_id,
          ],
        );

        const [paid] = await pool.query(
          `SELECT SUM(paid_amount) AS total_paid FROM trainer_payment WHERE payment_master_id = ? AND status IN ('Pending', 'Completed')`,
          [trainer.trainer_payment_id],
        );

        const total_paid = Number(paid[0].total_paid);
        const request_amount = Number(master[0].request_amount);
        const balance_amount = request_amount - total_paid;

        await pool.query(
          `UPDATE trainer_payment_master SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?`,
          [
            total_paid,
            balance_amount,
            "Payment Rejected",
            trainer.trainer_payment_id,
          ],
        );
      }

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

      const allowedStatuses = ["Payment Rejected", "Approval Rejected"];

      if (!allowedStatuses.includes(checkStatus[0].status))
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
        [total_paid, balance_amount, "Awaiting Approval", trainer_payment_id],
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
          `UPDATE trainer_payment_trans SET trainer_mapping_id = ?, place_of_sale = ?, place_of_supply = ?, commercial = ?, commercial_percentage = ?, attendance_status = ?, attendance_sheetlink = ?, attendance_screenshot = ?, screenshot = ? WHERE id = ?`,
          [
            student.trainer_mapping_id,
            student.place_of_sale,
            student.place_of_supply,
            student.commercial,
            student.commercial_percentage,
            student.attendance_status,
            student.attendance_sheetlink,
            student.attendance_screenshot,
            student.screenshot,
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

  requestForUnpaid: async (
    payment_master_id,
    trainer_id,
    account_number,
    account_holder_name,
    bank_name,
    ifsc_code,
    branch_name,
    feedback,
    students,
    updated_date,
  ) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [isUpdated] = await connection.query(
        `SELECT id FROM trainer_payment_master WHERE id = ? AND is_trainer_updated = ?`,
        [payment_master_id, 1],
      );

      if (isUpdated.length > 0) {
        await connection.rollback();
        throw new Error("Payment request has already been submitted.");
      }

      const [isBankExists] = await connection.query(
        `SELECT id FROM trainer_bank_accounts WHERE trainer_id = ? AND account_number = ?`,
        [trainer_id, account_number],
      );

      if (isBankExists.length > 0) {
        await connection.query(
          `UPDATE trainer_payment_master SET bank_id = ? WHERE id = ?`,
          [isBankExists[0].id, payment_master_id],
        );
      } else {
        await connection.query(
          `INSERT INTO trainer_bank_accounts(
              trainer_id,
              account_number,
              account_holder_name,
              bank_name,
              ifsc_code,
              branch_name,
              created_date
          )
          VALUES(?, ?, ?, ?, ?, ?, ?)`,
          [
            trainer_id,
            account_number,
            account_holder_name,
            bank_name,
            ifsc_code,
            branch_name,
            updated_date,
          ],
        );
        const [newBank] = await connection.query(
          `SELECT id FROM trainer_bank_accounts WHERE trainer_id = ? AND account_number = ?`,
          [trainer_id, account_number],
        );
        await connection.query(
          `UPDATE trainer_payment_master SET bank_id = ? WHERE id = ?`,
          [newBank[0].id, payment_master_id],
        );
      }

      for (const student of students) {
        await connection.query(
          `UPDATE
                trainer_payment_trans
            SET
                attendance_status = ?,
                attendance_sheetlink = ?,
                attendance_screenshot = ?,
                duration_in_hours = ?,
                training_mode = ?,
                branch_id = ?,
                study_material = ?,
                assessment = ?,
                placement_guidance = ?,
                hr_rating = ?,
                coordinator_rating = ?
            WHERE
                id = ?`,
          [
            student.attendance_status,
            student.attendance_sheetlink,
            student.attendance_screenshot,
            student.duration_in_hours,
            student.training_mode,
            student.branch_id,
            student.study_material,
            student.assessment,
            student.placement_guidance,
            student.hr_rating,
            student.coordinator_rating,
            student.payment_trans_id,
          ],
        );
      }

      await connection.query(
        `UPDATE
            trainer_payment_master
        SET
            status = 'Requested',
            updated_date = ?,
            is_trainer_updated = 1,
            feedback = ?
        WHERE
            id = ?`,
        [updated_date, feedback, payment_master_id],
      );

      await connection.commit();
      return { status: true };
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  getTrainerBanks: async (trainer_id) => {
    try {
      const [banks] = await pool.query(
        `SELECT 
            id,
            trainer_id,
            account_number,
            account_holder_name,
            bank_name,
            ifsc_code,
            branch_name,
            signature_image
        FROM 
            trainer_bank_accounts 
        WHERE 
            trainer_id = ? AND is_active = 1
        ORDER BY id DESC`,
        [trainer_id],
      );
      return banks;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  acknowledgeClassCompletion: async (
    customer_id,
    acknowledged_date,
    is_acknowledged,
  ) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [isAcknowledged] = await connection.query(
        `SELECT is_acknowledged FROM customers WHERE customer_id = ?`,
        [customer_id],
      );

      if (
        isAcknowledged.length > 0 &&
        isAcknowledged[0].is_acknowledged === 1
      ) {
        return {
          status: false,
          message: "Class has already been acknowledged.",
        };
      }

      await connection.query(
        `UPDATE customers SET is_acknowledged = ?, acknowledged_date = ? WHERE customer_id = ?`,
        [is_acknowledged, acknowledged_date, customer_id],
      );
      await connection.commit();
      return { status: true };
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  getNonClaimBatches: async (trainer_id) => {
    try {
      const query = `SELECT
                        bm.id,
                        bm.batch_number,
                        bm.batch_name,
                        bm.trainer_id,
                        t.trainer_id AS trainer_code,
                        t.name AS trainer_name
                    FROM
                        batch_master AS bm
                    INNER JOIN trainer AS t ON
                      t.id = bm.trainer_id
                    WHERE
                        bm.trainer_id = ?
                        AND NOT EXISTS (
                          SELECT 1 FROM trainer_payment_master
                            WHERE batch_id = bm.id
                        )`;
      const [data] = await pool.query(query, [trainer_id]);
      return data;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = trainerPaymentModal;
