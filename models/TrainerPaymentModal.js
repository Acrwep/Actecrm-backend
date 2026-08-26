const pool = require("../config/dbconfig");
const { CONSTANT_STATUS } = require("../constants/constant");
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
            AND c.class_percentage > 50
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
        const studentAmount =
          student.commercial || request_amount / students.length;

        const masterValues = [
          bill_raisedate,
          trainer_id,
          studentAmount,
          studentAmount,
          days_taken_topay,
          deadline_date,
          "Requested",
          created_by,
          created_date,
        ];

        const [insertMaster] = await pool.query(masterQuery, masterValues);
        affectedRows += insertMaster.affectedRows;

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
      let lastInsertId = null;
      const emailTasks = [];

      //validation
      if (!students || students.length <= 0) {
        throw new Error("Students cannot be empty");
      }

      if (!trainer_id) {
        throw new Error("Trainer ID is required");
      }

      if (!commercial_type) {
        throw new Error("Commercial type is required");
      }

      if (!request_amount || Number(request_amount) <= 0) {
        throw new Error("Request amount must be greater than 0");
      }

      // PAY PER HEAD VALIDATION
      if (commercial_type === "Pay Per Head") {
        const trainerMappingIds = students
          .map((student) => student.trainer_mapping_id)
          .filter(Boolean);

        if (trainerMappingIds.length === 0) {
          throw new Error("No students selected.");
        }

        // Get customer IDs from trainer_mapping
        const [customers] = await connection.query(
          `
          SELECT customer_id
          FROM trainer_mapping
          WHERE id IN (?)
        `,
          [trainerMappingIds],
        );

        const customerIds = customers
          .map((customer) => customer.customer_id)
          .filter(Boolean);

        if (customerIds.length === 0) {
          throw new Error("No customers found.");
        }

        // Check whether any customer is already assigned to a batch
        const [batchCustomers] = await connection.query(
          `
          SELECT DISTINCT customer_id
          FROM batch_trans
          WHERE customer_id IN (?)
        `,
          [customerIds],
        );

        if (batchCustomers.length > 0) {
          throw new Error(
            "One or more selected customers are already assigned to a batch. Kindly request batch payment.",
          );
        }
      }

      // COMMERCIAL CALCULATION
      let commercial = 0;
      /*
       * For Batch:
       *
       * request_amount = total batch payment
       *
       * Example:
       * request_amount = 30000
       * students = 3
       *
       * commercial = 30000 / 3
       *            = 10000
       *
       * Each transaction will contain 10000.
       */

      if (commercial_type !== "Pay Per Head") {
        commercial = Number(request_amount) / Number(students.length);
      }

      // MASTER QUERY
      const masterQuery = `
      INSERT INTO trainer_payment_master (
        bill_raisedate,
        trainer_id,
        request_amount,
        balance_amount,
        commercial_type,
        batch_amount,
        batch_id,
        bank_id,
        status,
        created_by,
        created_date,
        feedback
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

      // TRANSACTION QUERY
      const transQuery = `
      INSERT INTO trainer_payment_trans (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

      // INSERT PAYMENT RECORDS
      /*
       * Current behavior:
       *
       * Pay Per Head:
       *   1 master + 1 transaction per student
       *
       * Batch:
       *   1 master + 1 transaction per student
       *
       * If you want Batch to create only ONE master record,
       * the loop needs to be separated. The code below follows
       * the structure of your current implementation.
       */

      if (commercial_type === "Batch") {
        // BATCH
        // ONE MASTER RECORD FOR ENTIRE BATCH
        const masterValues = [
          created_date,
          trainer_id,
          request_amount,
          request_amount,
          commercial_type,
          request_amount,
          batch_id,
          bank_id,
          "Link Sent",
          created_by,
          created_date,
          feedback,
        ];

        const [insertMaster] = await connection.query(
          masterQuery,
          masterValues,
        );

        affectedRows += insertMaster.affectedRows;
        lastInsertId = insertMaster.insertId;

        // Insert transaction for every student
        for (const student of students) {
          const perStudentAmount =
            Number(request_amount) / Number(students.length);

          const transValues = [
            insertMaster.insertId,
            student.trainer_mapping_id,
            perStudentAmount,
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

          // Fetch customer details
          const [customerDetails] = await connection.query(
            `
            SELECT
              c.id AS customer_id,
              c.email
            FROM trainer_mapping AS tm
            INNER JOIN customers AS c
              ON tm.customer_id = c.id
            WHERE tm.id = ?
          `,
            [student.trainer_mapping_id],
          );

          // Customer tracking + email
          if (customerDetails.length > 0) {
            const customerId = customerDetails[0].customer_id;

            const customerEmail = customerDetails[0].email;

            // Trainer Payment Claim Form Sent
            await connection.query(
              `
              INSERT INTO customer_track (
                customer_id,
                status,
                status_date,
                updated_by
              )
              VALUES (?, ?, ?, ?)
            `,
              [
                customerId,
                "Trainer Payment Claim Form Sent",
                created_date,
                created_by,
              ],
            );

            // Class Completion Acknowledgement Sent
            await connection.query(
              `
              INSERT INTO customer_track (
                customer_id,
                status,
                status_date,
                updated_by
              )
              VALUES (?, ?, ?, ?)
            `,
              [
                customerId,
                "Class Completion Acknowledgement Sent",
                created_date,
                created_by,
              ],
            );

            // Store email task.
            // Email will be sent only after COMMIT.
            if (customerEmail) {
              emailTasks.push({
                email: customerEmail,
                customer_id: customerId,
              });
            }
          }
        }
      } else {
        // PAY PER HEAD
        // ONE MASTER + ONE TRANSACTION PER STUDENT

        for (const student of students) {
          const perStudentAmount = Number(student.commercial) || 0;

          if (perStudentAmount <= 0) {
            throw new Error(
              `Invalid commercial amount for trainer mapping ID: ${student.trainer_mapping_id}`,
            );
          }

          // Master
          const masterValues = [
            created_date,
            trainer_id,
            perStudentAmount,
            perStudentAmount,
            commercial_type,
            0,
            batch_id,
            bank_id,
            "Link Sent",
            created_by,
            created_date,
            feedback,
          ];

          const [insertMaster] = await connection.query(
            masterQuery,
            masterValues,
          );

          affectedRows += insertMaster.affectedRows;
          lastInsertId = insertMaster.insertId;

          // Transaction
          const transValues = [
            insertMaster.insertId,
            student.trainer_mapping_id,
            perStudentAmount,
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

          // Fetch customer details
          const [customerDetails] = await connection.query(
            `
            SELECT
              c.id AS customer_id,
              c.email
            FROM trainer_mapping AS tm
            INNER JOIN customers AS c
              ON tm.customer_id = c.id
            WHERE tm.id = ?
          `,
            [student.trainer_mapping_id],
          );

          // Customer tracking + email
          if (customerDetails.length > 0) {
            const customerId = customerDetails[0].customer_id;

            const customerEmail = customerDetails[0].email;

            // Trainer Payment Claim Form Sent
            await connection.query(
              `
              INSERT INTO customer_track (
                customer_id,
                status,
                status_date,
                updated_by
              )
              VALUES (?, ?, ?, ?)
            `,
              [
                customerId,
                "Trainer Payment Claim Form Sent",
                created_date,
                created_by,
              ],
            );

            // Class Completion Acknowledgement Sent
            await connection.query(
              `
              INSERT INTO customer_track (
                customer_id,
                status,
                status_date,
                updated_by
              )
              VALUES (?, ?, ?, ?)
            `,
              [
                customerId,
                "Class Completion Acknowledgement Sent",
                created_date,
                created_by,
              ],
            );

            // Store email task
            if (customerEmail) {
              emailTasks.push({
                email: customerEmail,
                customer_id: customerId,
              });
            }
          }
        }
      }

      await connection.commit();
      // send email
      for (const task of emailTasks) {
        try {
          if (!task.email) {
            continue;
          }

          await EmailModel.sendStudentAcknowledgementMail(
            task.email,
            email_link,
            task.customer_id,
          );

          console.log(
            `Student acknowledgement email sent successfully to customer ${task.customer_id}`,
          );
        } catch (emailError) {
          console.error(
            `Error sending student acknowledgement email to customer ${task.customer_id}:`,
            emailError.message,
          );
        }
      }

      return {
        trainer_id: trainer_id,
        payment_master_id: lastInsertId,
        affectedRows: affectedRows,
      };
    } catch (error) {
      await connection.rollback();
      console.error("requestPaymentV1 Error:", error.message);

      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  getPayments1: async (
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
          tm.feedback,
          tm.batch_id,
          bm.batch_number,
          tm.updated_date,
          tp.paid_date
      FROM
          trainer_payment_master AS tm
      INNER JOIN trainer AS t ON
          t.id = tm.trainer_id
      LEFT JOIN users AS vu ON
          vu.user_id = tm.verified_by
      LEFT JOIN users AS cu ON
        cu.user_id = tm.created_by
      LEFT JOIN batch_master AS bm ON
        bm.id = tm.batch_id
      LEFT JOIN trainer_payment AS tp ON
        tp.payment_master_id = tm.id
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

      getQuery += ` ORDER BY tm.bill_raisedate DESC, id DESC LIMIT ? OFFSET ?`;
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
                CASE WHEN (c.linkedin_review IS NOT NULL AND c.linkedin_review != '') THEN 1 ELSE 0 END AS is_linkedin,
                c.google_review,
                CASE WHEN (c.google_review IS NOT NULL AND c.google_review != '') THEN 1 ELSE 0 END AS is_google,
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
                ra.user_id AS ra_user_id,
                ra.user_name AS ra_user_name,
                hu.user_id AS hr_user_id,
                hu.user_name AS hr_user_name,
                cm.name AS mode_of_training,
                c.is_linkedin_verified,
                c.is_google_verified
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
            LEFT JOIN technologies AS t ON
                t.id = c.enrolled_course
            LEFT JOIN payment_master AS pm ON
            	  pm.lead_id = c.lead_id
            LEFT JOIN trainer AS tr ON
                tm.trainer_id = tr.id
            LEFT JOIN(
            	SELECT pt.payment_master_id, SUM(pt.amount) AS paid_amount FROM payment_trans AS pt
                WHERE pt.payment_status IN ('Verified', 'Verify Pending')
                GROUP BY pt.payment_master_id
            ) AS ps ON ps.payment_master_id = pm.id
            LEFT JOIN (
              SELECT ct.customer_id, MAX(ct.id) AS latest_id FROM customer_track AS ct WHERE ct.status = 'Trainer Assigned' GROUP BY ct.customer_id
            ) AS latest_hr ON latest_hr.customer_id = c.id
            LEFT JOIN customer_track AS ht ON
              ht.id = latest_hr.latest_id
            LEFT JOIN users AS hu ON
              hu.user_id = ht.updated_by
            LEFT JOIN (
              SELECT ct.customer_id, MAX(ct.id) AS latest_id FROM customer_track AS ct WHERE ct.status = 'Student Verified' GROUP BY ct.customer_id
            ) AS latest_ra ON latest_ra.customer_id = c.id
            LEFT JOIN customer_track AS rt ON
              rt.id = latest_ra.latest_id
            LEFT JOIN users AS ra ON
              ra.user_id = rt.updated_by
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

  getPaymentsV11: async (
    start_date,
    end_date,
    status,
    trainer_id,
    training_mode,
    commercial_type,
    region_id,
    search_filter,
    branch_id,
    page,
    limit,
    type,
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const statusParams = [];
      let getQuery = `SELECT
                        tpt.id,
                        tpm.bill_raisedate,
                        tpm.trainer_id,
                        t.name AS trainer_name,
                        t.mobile AS trainer_mobile,
                        t.email AS trainer_email,
                        tpm.request_amount,
                        tpm.batch_amount,
                        tpm.paid_amount,
                        tpm.balance_amount,
                        CASE
                          WHEN tpm.fully_paid_date IS NULL THEN DATEDIFF (CURRENT_DATE, tpm.bill_raisedate)
                          ELSE DATEDIFF (tpm.fully_paid_date, tpm.bill_raisedate)
                        END AS days_taken_topay,
                        tpm.deadline_date,
                        tpm.status,
                        tpm.is_verified,
                        tpm.verified_by,
                        vu.user_name AS verified_user,
                        tpm.verified_date,
                        tpm.approved_date,
                        tpm.fully_paid_date,
                        tpm.created_by,
                        cu.user_name AS created_user,
                        tpm.created_date,
                        tpm.bank_id,
                        tpm.commercial_type,
                        tpm.feedback,
                        tpm.batch_id,
                        bm.batch_number,
                        CASE
                        WHEN tpm.commercial_type = 'Batch' THEN (
                        SELECT COUNT(DISTINCT bt.customer_id)
                        FROM batch_trans bt
                        WHERE bt.batch_master_id = tpm.batch_id
                        )
                        ELSE 0
                        END AS batch_student_count,
                        tpm.updated_date,
                        tp.paid_date,
                        tpt.duration_in_hours,
                        tpt.training_mode,
                        tpt.branch_id,
                        tpt.study_material,
                        tpt.assessment,
                        tpt.placement_guidance,
                        tpt.hr_rating,
                        tpt.coordinator_rating,
                        tpt.place_of_supply,
                        tpt.place_of_sale,
                        tpt.commercial,
                        tpt.commercial_percentage,
                        tpt.attendance_status,
                        tpt.attendance_sheetlink,
                        tpt.attendance_screenshot,
                        tpt.screenshot,
                        tpt.id AS payment_trans_id,
                        tpt.payment_master_id,
                        tpt.trainer_mapping_id,
                        tm.customer_id,
                        c.is_linkedin_verified,
                        c.is_google_verified,
                        c.name AS customer_name,
                        c.email AS customer_email,
                        c.phone AS customer_phone,
                        c.lead_id,
                        c.linkedin_review,
                        CASE
                          WHEN (
                            c.linkedin_review IS NOT NULL
                            AND c.linkedin_review != ''
                          ) THEN 1
                          ELSE 0
                        END AS is_linkedin,
                        c.google_review,
                        CASE
                          WHEN (
                            c.google_review IS NOT NULL
                            AND c.google_review != ''
                          ) THEN 1
                          ELSE 0
                        END AS is_google,
                        c.class_percentage,
                        CASE
                          WHEN c.class_percentage = 100 THEN 1
                          ELSE 0
                        END AS is_class_percentage,
                        c.is_acknowledged,
                        c.acknowledged_date,
                        tech.name AS course_name,
                        c.place_of_service AS std_place_of_service,
                        psb.name AS std_place_of_service_name,
                        cm.name AS mode_of_training,
                        COALESCE(pm.total_amount, 0) AS std_total_amount,
                        COALESCE(ps.paid_amount, 0) AS std_paid_amount,
                        (
                          COALESCE(pm.total_amount, 0) - COALESCE(ps.paid_amount, 0)
                        ) AS std_balance_amount,
                        CASE
                          WHEN (
                            COALESCE(pm.total_amount, 0) - COALESCE(ps.paid_amount, 0)
                          ) > 0 THEN 0
                          ELSE 1
                        END AS is_payment_cleared,
                        ra.user_id AS ra_user_id,
                        ra.user_name AS ra_user_name,
                        hu.user_id AS hr_user_id,
                        hu.user_name AS hr_user_name,

                        l.assigned_to AS lead_assigned_to_id,
                        se.user_name AS lead_assigned_to_name,

                        -- Place of sale based on assigned user's branch
                        sb.name AS std_place_of_sale_name,
                        sr.name AS std_region_name

                      FROM
                        trainer_payment_trans AS tpt
                        LEFT JOIN trainer_payment_master AS tpm ON tpm.id = tpt.payment_master_id
                        LEFT JOIN trainer_mapping AS tm ON tm.id = tpt.trainer_mapping_id
                        LEFT JOIN customers AS c ON c.id = tm.customer_id
                        LEFT JOIN technologies AS tech ON tech.id = c.enrolled_course
                        LEFT JOIN lead_master AS l ON l.id = c.lead_id
                        LEFT JOIN class_mode AS cm ON cm.id = l.preferred_mode
                        LEFT JOIN users AS se ON se.user_id = l.assigned_to
                        LEFT JOIN branches AS sb ON sb.id = se.branch_id
                        LEFT JOIN region AS sr ON sr.id = sb.region_id
                        LEFT JOIN payment_master AS pm ON pm.lead_id = l.id
                        LEFT JOIN (
                          SELECT
                            pt.payment_master_id,
                            SUM(pt.amount) AS paid_amount
                          FROM payment_trans AS pt
                          WHERE pt.payment_status IN ('Verified', 'Verify Pending')
                          GROUP BY pt.payment_master_id
                        ) AS ps ON ps.payment_master_id = pm.id
                        LEFT JOIN (
                          SELECT ct.customer_id, MAX(ct.id) AS latest_id
                          FROM customer_track AS ct
                          WHERE ct.status = 'Trainer Assigned'
                          GROUP BY ct.customer_id
                        ) AS latest_hr ON latest_hr.customer_id = c.id
                        LEFT JOIN customer_track AS ht ON ht.id = latest_hr.latest_id
                        LEFT JOIN users AS hu ON hu.user_id = ht.updated_by
                        LEFT JOIN (
                          SELECT ct.customer_id, MAX(ct.id) AS latest_id
                          FROM customer_track AS ct
                          WHERE ct.status = 'Student Verified'
                          GROUP BY ct.customer_id
                        ) AS latest_ra ON latest_ra.customer_id = c.id
                        LEFT JOIN customer_track AS rt ON rt.id = latest_ra.latest_id
                        LEFT JOIN users AS ra ON ra.user_id = rt.updated_by
                        LEFT JOIN trainer AS t ON t.id = tm.trainer_id
                        LEFT JOIN users AS vu ON vu.user_id = tpm.verified_by
                        LEFT JOIN users AS cu ON cu.user_id = tpm.created_by
                        LEFT JOIN batch_master AS bm ON bm.id = tpm.batch_id
                        LEFT JOIN trainer_payment AS tp ON tp.payment_master_id = tpm.id
                        LEFT JOIN branches AS psb
                        ON psb.id = c.place_of_service
                      WHERE 1 = 1`;

      let countQuery = `SELECT
                          COUNT(tpt.id) AS total
                        FROM
                          trainer_payment_trans AS tpt
                          LEFT JOIN trainer_payment_master AS tpm ON tpm.id = tpt.payment_master_id
                          LEFT JOIN trainer_mapping AS tm ON tm.id = tpt.trainer_mapping_id
                          LEFT JOIN customers AS c ON c.id = tm.customer_id
                          LEFT JOIN technologies AS tech ON tech.id = c.enrolled_course
                          LEFT JOIN lead_master AS l ON l.id = c.lead_id
                          LEFT JOIN class_mode AS cm ON cm.id = l.preferred_mode
                          LEFT JOIN users AS se ON se.user_id = l.assigned_to
                          LEFT JOIN branches AS sb ON sb.id = se.branch_id
                          LEFT JOIN region AS sr ON sr.id = sb.region_id
                        WHERE 1 = 1`;

      let statusCountQuery = `
      SELECT
        COUNT(*) AS total,
              IFNULL(SUM(CASE WHEN tpm.status IN('Link Sent') THEN 1 ELSE 0 END), 0) AS link_sent,
              IFNULL(SUM(CASE WHEN tpm.status IN('Requested') THEN 1 ELSE 0 END), 0) AS requested,
              IFNULL(SUM(CASE WHEN tpm.status = 'Awaiting Finance' THEN 1 ELSE 0 END), 0) AS awaiting_finance,
              IFNULL(SUM(CASE WHEN tpm.status = 'Paid' THEN 1 ELSE 0 END), 0) AS paid
      FROM
        trainer_payment_trans AS tpt
        LEFT JOIN trainer_payment_master AS tpm ON tpm.id = tpt.payment_master_id
        LEFT JOIN trainer_mapping AS tm ON tm.id = tpt.trainer_mapping_id
        LEFT JOIN customers AS c ON c.id = tm.customer_id
        LEFT JOIN technologies AS tech ON tech.id = c.enrolled_course
        LEFT JOIN lead_master AS l ON l.id = c.lead_id
        LEFT JOIN class_mode AS cm ON cm.id = l.preferred_mode
        LEFT JOIN users AS se ON se.user_id = l.assigned_to
        LEFT JOIN branches AS sb ON sb.id = se.branch_id
        LEFT JOIN region AS sr ON sr.id = sb.region_id
      WHERE 1 = 1`;

      let regionCountQuery = `
      SELECT
        IFNULL(SUM(CASE WHEN sr.name = 'Hub' THEN 1 ELSE 0 END), 0) AS hub_count,
        IFNULL(SUM(CASE WHEN sr.name = 'Hub' THEN tpt.commercial ELSE 0 END), 0) AS hub_amount,
        IFNULL(SUM(CASE WHEN sr.name = 'Chennai' THEN 1 ELSE 0 END), 0) AS chn_count,
        IFNULL(SUM(CASE WHEN sr.name = 'Chennai' THEN tpt.commercial ELSE 0 END), 0) AS chn_amount,
        IFNULL(SUM(CASE WHEN sr.name = 'Bangalore' THEN 1 ELSE 0 END), 0) AS blr_count,
        IFNULL(SUM(CASE WHEN sr.name = 'Bangalore' THEN tpt.commercial ELSE 0 END), 0) AS blr_amount
      FROM
        trainer_payment_trans AS tpt
        LEFT JOIN trainer_payment_master AS tpm ON tpm.id = tpt.payment_master_id
        LEFT JOIN trainer_mapping AS tm ON tm.id = tpt.trainer_mapping_id
        LEFT JOIN customers AS c ON c.id = tm.customer_id
        LEFT JOIN technologies AS tech ON tech.id = c.enrolled_course
        LEFT JOIN lead_master AS l ON l.id = c.lead_id
        LEFT JOIN class_mode AS cm ON cm.id = l.preferred_mode
        LEFT JOIN users AS se ON se.user_id = l.assigned_to
        LEFT JOIN branches AS sb ON sb.id = se.branch_id
        LEFT JOIN region AS sr ON sr.id = sb.region_id
      WHERE 1 = 1`;

      if (start_date && end_date) {
        if (type === "Deadline") {
          getQuery += ` AND tpm.deadline_date >= ? AND tpm.deadline_date < DATE_ADD(?, INTERVAL 1 DAY)`;
          countQuery += ` AND tpm.deadline_date >= ? AND tpm.deadline_date < DATE_ADD(?, INTERVAL 1 DAY)`;
          statusCountQuery += ` AND tpm.deadline_date >= ? AND tpm.deadline_date < DATE_ADD(?, INTERVAL 1 DAY)`;
          regionCountQuery += ` AND tpm.deadline_date >= ? AND tpm.deadline_date < DATE_ADD(?, INTERVAL 1 DAY)`;
        } else {
          getQuery += ` AND tpm.bill_raisedate >= ? AND tpm.bill_raisedate < DATE_ADD(?, INTERVAL 1 DAY)`;
          countQuery += ` AND tpm.bill_raisedate >= ? AND tpm.bill_raisedate < DATE_ADD(?, INTERVAL 1 DAY)`;
          statusCountQuery += ` AND tpm.bill_raisedate >= ? AND tpm.bill_raisedate < DATE_ADD(?, INTERVAL 1 DAY)`;
          regionCountQuery += ` AND tpm.bill_raisedate >= ? AND tpm.bill_raisedate < DATE_ADD(?, INTERVAL 1 DAY)`;
        }
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
      }

      if (status) {
        if (status === "Payment Rejected") {
          getQuery += ` AND tpm.status IN ('Payment Rejected', 'Approval Rejected')`;
          countQuery += ` AND tpm.status IN ('Payment Rejected', 'Approval Rejected')`;
          regionCountQuery += ` AND tpm.status IN ('Payment Rejected', 'Approval Rejected')`;
        } else {
          getQuery += ` AND tpm.status = ?`;
          countQuery += ` AND tpm.status = ?`;
          regionCountQuery += ` AND tpm.status = ?`;
          queryParams.push(status);
          countParams.push(status);
        }
      }

      if (trainer_id) {
        getQuery += ` AND tpm.trainer_id = ?`;
        countQuery += ` AND tpm.trainer_id = ?`;
        statusCountQuery += ` AND tpm.trainer_id = ?`;
        regionCountQuery += ` AND tpm.trainer_id = ?`;
        queryParams.push(trainer_id);
        countParams.push(trainer_id);
        statusParams.push(trainer_id);
      }

      if (training_mode) {
        getQuery += ` AND tpt.training_mode = ?`;
        countQuery += ` AND tpt.training_mode = ?`;
        statusCountQuery += ` AND tpt.training_mode = ?`;
        regionCountQuery += ` AND tpt.training_mode = ?`;
        queryParams.push(training_mode);
        countParams.push(training_mode);
        statusParams.push(training_mode);
      }

      if (commercial_type) {
        getQuery += ` AND tpm.commercial_type = ?`;
        countQuery += ` AND tpm.commercial_type = ?`;
        statusCountQuery += ` AND tpm.commercial_type = ?`;
        regionCountQuery += ` AND tpm.commercial_type = ?`;
        queryParams.push(commercial_type);
        countParams.push(commercial_type);
        statusParams.push(commercial_type);
      }

      if (region_id) {
        getQuery += ` AND sr.id = ?`;
        countQuery += ` AND sr.id = ?`;
        statusCountQuery += ` AND sr.id = ?`;
        regionCountQuery += ` AND sr.id = ?`;
        queryParams.push(region_id);
        countParams.push(region_id);
        statusParams.push(region_id);
      }

      if (search_filter) {
        getQuery += ` AND (c.student_id LIKE '%${search_filter}%' OR c.name LIKE '%${search_filter}%' OR c.phone LIKE '%${search_filter}%' OR c.email LIKE '%${search_filter}%' OR tech.name LIKE '%${search_filter}%')`;
        countQuery += ` AND (c.student_id LIKE '%${search_filter}%' OR c.name LIKE '%${search_filter}%' OR c.phone LIKE '%${search_filter}%' OR c.email LIKE '%${search_filter}%' OR tech.name LIKE '%${search_filter}%')`;
        statusCountQuery += ` AND (c.student_id LIKE '%${search_filter}%' OR c.name LIKE '%${search_filter}%' OR c.phone LIKE '%${search_filter}%' OR c.email LIKE '%${search_filter}%' OR tech.name LIKE '%${search_filter}%')`;
        regionCountQuery += ` AND (c.student_id LIKE '%${search_filter}%' OR c.name LIKE '%${search_filter}%' OR c.phone LIKE '%${search_filter}%' OR c.email LIKE '%${search_filter}%' OR tech.name LIKE '%${search_filter}%')`;
      }

      if (branch_id) {
        getQuery += ` AND sb.id = ?`;
        countQuery += ` AND sb.id = ?`;
        statusCountQuery += ` AND sb.id = ?`;
        regionCountQuery += ` AND sb.id = ?`;
        queryParams.push(branch_id);
        countParams.push(branch_id);
        statusParams.push(branch_id);
      }

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY tpm.bill_raisedate DESC, id DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [[countResult], [statusResult], [regionResult], [result]] =
        await Promise.all([
          pool.query(countQuery, countParams),
          pool.query(statusCountQuery, statusParams),
          pool.query(regionCountQuery, countParams),
          pool.query(getQuery, queryParams),
        ]);

      const total = countResult[0]?.total || 0;

      return {
        data: result,
        statusCount: statusResult[0],
        regionCount: regionResult[0],
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
  getPaymentsV1: async (
    start_date,
    end_date,
    status,
    trainer_id,
    training_mode,
    commercial_type,
    region_id,
    search_filter,
    branch_id,
    page,
    limit,
    type,
  ) => {
    try {
      // =========================================================
      // PAGINATION
      // =========================================================
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      // =========================================================
      // PARAM ARRAYS
      // =========================================================
      const queryParams = [];
      const countParams = [];
      const statusParams = [];
      const regionParams = [];
      const commercialTypeParams = [];

      // =========================================================
      // MAIN QUERY
      //
      // IMPORTANT:
      // This query returns ONLY ONE ROW per trainer_payment_master.id
      //
      // Students are NOT joined here.
      // Students are fetched separately below.
      // =========================================================
      let getQuery = `
      SELECT
        tpm.id,
        tpm.bill_raisedate,
        tpm.trainer_id,

        t.name AS trainer_name,
        t.mobile AS trainer_mobile,
        t.email AS trainer_email,

        tpm.request_amount,
        tpm.batch_amount,
        tpm.paid_amount,
        tpm.balance_amount,

        CASE
          WHEN tpm.fully_paid_date IS NULL
          THEN DATEDIFF(
            CURRENT_DATE,
            tpm.bill_raisedate
          )
          ELSE DATEDIFF(
            tpm.fully_paid_date,
            tpm.bill_raisedate
          )
        END AS days_taken_topay,

        tpm.deadline_date,
        tpm.status,
        tpm.is_verified,
        tpm.verified_by,

        vu.user_name AS verified_user,

        tpm.verified_date,
        tpm.approved_date,
        tpm.fully_paid_date,

        tpm.created_by,
        cu.user_name AS created_user,

        tpm.created_date,
        tpm.bank_id,
        tpm.commercial_type,
        tpm.feedback,
        tpm.batch_id,

        bm.batch_number,

        CASE
          WHEN tpm.commercial_type = 'Batch'
          THEN (
            SELECT COUNT(DISTINCT bt.customer_id)
            FROM batch_trans bt
            WHERE bt.batch_master_id = tpm.batch_id
          )
          ELSE 0
        END AS batch_student_count,

        tpm.updated_date,
        (
          SELECT MAX(tp2.paid_date)
          FROM trainer_payment tp2
          WHERE tp2.payment_master_id = tpm.id
        ) AS paid_date

      FROM trainer_payment_master tpm

      LEFT JOIN trainer t
        ON t.id = tpm.trainer_id

      LEFT JOIN users vu
        ON vu.user_id = tpm.verified_by

      LEFT JOIN users cu
        ON cu.user_id = tpm.created_by

      LEFT JOIN batch_master bm
        ON bm.id = tpm.batch_id

      WHERE 1 = 1
    `;

      // =========================================================
      // COUNT QUERY
      //
      // ONE MASTER = ONE COUNT
      // =========================================================
      let countQuery = `
      SELECT
        COUNT(DISTINCT tpm.id) AS total

      FROM trainer_payment_master tpm

      WHERE 1 = 1
    `;

      // =========================================================
      // STATUS COUNT QUERY
      // =========================================================
      let statusCountQuery = `
      SELECT

        COUNT(
        DISTINCT CASE
          WHEN tpm.status IN (
          'Link Sent',
          'Requested',
          'Awaiting Finance',
          'Paid'
        )
       THEN tpm.id
       END
       ) AS total,

        COUNT(
          DISTINCT CASE
            WHEN tpm.status IN ('Link Sent')
            THEN tpm.id
          END
        ) AS link_sent,

        COUNT(
          DISTINCT CASE
            WHEN tpm.status IN ('Requested')
            THEN tpm.id
          END
        ) AS requested,

        COUNT(
          DISTINCT CASE
            WHEN tpm.status = 'Awaiting Finance'
            THEN tpm.id
          END
        ) AS awaiting_finance,

        COUNT(
          DISTINCT CASE
            WHEN tpm.status = 'Paid'
            THEN tpm.id
          END
        ) AS paid

      FROM trainer_payment_master tpm

      WHERE 1 = 1
    `;

      // =========================================================
      // REGION COUNT QUERY
      // =========================================================
      let regionCountQuery = `
      SELECT

        COUNT(
          DISTINCT CASE
            WHEN sr.name = 'Hub'
            THEN tpm.id
          END
        ) AS hub_count,

        COALESCE(
          SUM(
            CASE
              WHEN sr.name = 'Hub'
              THEN tpt.commercial
              ELSE 0
            END
          ),
          0
        ) AS hub_amount,

        COUNT(
          DISTINCT CASE
            WHEN sr.name = 'Chennai'
            THEN tpm.id
          END
        ) AS chn_count,

        COALESCE(
          SUM(
            CASE
              WHEN sr.name = 'Chennai'
              THEN tpt.commercial
              ELSE 0
            END
          ),
          0
        ) AS chn_amount,

        COUNT(
          DISTINCT CASE
            WHEN sr.name = 'Bangalore'
            THEN tpm.id
          END
        ) AS blr_count,

        COALESCE(
          SUM(
            CASE
              WHEN sr.name = 'Bangalore'
              THEN tpt.commercial
              ELSE 0
            END
          ),
          0
        ) AS blr_amount


      FROM trainer_payment_master tpm

      LEFT JOIN trainer_payment_trans tpt
        ON tpt.payment_master_id = tpm.id

      LEFT JOIN trainer_mapping tm
        ON tm.id = tpt.trainer_mapping_id

      LEFT JOIN customers c
        ON c.id = tm.customer_id

      LEFT JOIN lead_master l
        ON l.id = c.lead_id

      LEFT JOIN users se
        ON se.user_id = l.assigned_to

      LEFT JOIN branches sb
        ON sb.id = se.branch_id

      LEFT JOIN region sr
        ON sr.id = sb.region_id

      LEFT JOIN technologies tech
        ON tech.id = c.enrolled_course

      WHERE 1 = 1
    `;
      let commercialTypeCountQuery = `
      SELECT
        COUNT(
          DISTINCT CASE
            WHEN tpm.commercial_type = 'Pay Per Head'
            THEN tpm.id
          END
        ) AS Pay_Per_Head_Count,

         COUNT(
          DISTINCT CASE
            WHEN tpm.commercial_type = 'Batch'
            THEN tpm.id
          END
        ) AS Batch_Count

      FROM trainer_payment_master tpm

      LEFT JOIN trainer_payment_trans tpt
        ON tpt.payment_master_id = tpm.id

      LEFT JOIN trainer_mapping tm
        ON tm.id = tpt.trainer_mapping_id

      LEFT JOIN customers c
        ON c.id = tm.customer_id

      LEFT JOIN lead_master l
        ON l.id = c.lead_id

      LEFT JOIN users se
        ON se.user_id = l.assigned_to

      LEFT JOIN branches sb
        ON sb.id = se.branch_id

      LEFT JOIN region sr
        ON sr.id = sb.region_id

      LEFT JOIN technologies tech
        ON tech.id = c.enrolled_course

      WHERE 1 = 1
    `;
      // =========================================================
      // DATE FILTER
      // =========================================================
      if (start_date && end_date) {
        let condition;

        if (type === "Deadline") {
          condition = `
          AND tpm.deadline_date >= ?
          AND tpm.deadline_date < DATE_ADD(?, INTERVAL 1 DAY)
        `;
        } else {
          condition = `
          AND tpm.bill_raisedate >= ?
          AND tpm.bill_raisedate < DATE_ADD(?, INTERVAL 1 DAY)
        `;
        }

        getQuery += condition;
        countQuery += condition;
        // statusCountQuery += condition;
        regionCountQuery += condition;
        commercialTypeCountQuery += condition;

        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        // statusParams.push(start_date, end_date);
        regionParams.push(start_date, end_date);
        commercialTypeParams.push(start_date, end_date);
      }

      // =========================================================
      // STATUS FILTER
      // =========================================================
      if (status) {
        let condition;

        if (status === "Payment Rejected") {
          condition = `
          AND tpm.status IN (
            'Payment Rejected',
            'Approval Rejected'
          )
        `;

          getQuery += condition;
          countQuery += condition;
          //statusCountQuery += condition;
          regionCountQuery += condition;
          commercialTypeCountQuery += condition;
        } else {
          condition = `
          AND tpm.status = ?
        `;

          getQuery += condition;
          countQuery += condition;
          // statusCountQuery += condition;
          regionCountQuery += condition;
          commercialTypeCountQuery += condition;

          queryParams.push(status);
          countParams.push(status);
          // statusParams.push(status);
          regionParams.push(status);
          commercialTypeParams.push(status);
        }
      }

      // =========================================================
      // TRAINER FILTER
      // =========================================================
      if (trainer_id) {
        const condition = `
        AND tpm.trainer_id = ?
      `;

        getQuery += condition;
        countQuery += condition;
        // statusCountQuery += condition;
        regionCountQuery += condition;
        commercialTypeCountQuery += condition;

        queryParams.push(trainer_id);
        countParams.push(trainer_id);
        //statusParams.push(trainer_id);
        regionParams.push(trainer_id);
        commercialTypeParams.push(trainer_id);
      }

      // =========================================================
      // TRAINING MODE FILTER
      //
      // EXISTS means:
      // If ANY student under this payment_master_id has
      // the requested training_mode, that master is returned.
      //
      // But students query below still returns ALL students.
      // =========================================================
      if (training_mode) {
        const condition = `
        AND EXISTS (
          SELECT 1
          FROM trainer_payment_trans ftpt
          WHERE ftpt.payment_master_id = tpm.id
          AND ftpt.training_mode = ?
        )
      `;

        getQuery += condition;
        countQuery += condition;
        // statusCountQuery += condition;
        regionCountQuery += condition;
        commercialTypeCountQuery += condition;

        queryParams.push(training_mode);
        countParams.push(training_mode);
        //  statusParams.push(training_mode);
        regionParams.push(training_mode);
        commercialTypeParams.push(training_mode);
      }

      // =========================================================
      // COMMERCIAL TYPE
      // =========================================================
      if (commercial_type) {
        const condition = `
        AND tpm.commercial_type = ?
      `;

        getQuery += condition;
        countQuery += condition;
        //  statusCountQuery += condition;
        regionCountQuery += condition;

        queryParams.push(commercial_type);
        countParams.push(commercial_type);
        // statusParams.push(commercial_type);
        regionParams.push(commercial_type);
      }

      // =========================================================
      // REGION FILTER
      // =========================================================
      if (region_id) {
        const condition = `
        AND EXISTS (
          SELECT 1

          FROM trainer_payment_trans rtpt

          LEFT JOIN trainer_mapping rtm
            ON rtm.id = rtpt.trainer_mapping_id

          LEFT JOIN customers rc
            ON rc.id = rtm.customer_id

          LEFT JOIN lead_master rl
            ON rl.id = rc.lead_id

          LEFT JOIN users rse
            ON rse.user_id = rl.assigned_to

          LEFT JOIN branches rsb
            ON rsb.id = rse.branch_id

          LEFT JOIN region rsr
            ON rsr.id = rsb.region_id

          WHERE rtpt.payment_master_id = tpm.id
          AND rsr.id = ?
        )
      `;

        getQuery += condition;
        countQuery += condition;
        //  statusCountQuery += condition;
        regionCountQuery += condition;
        commercialTypeCountQuery += condition;

        queryParams.push(region_id);
        countParams.push(region_id);
        //  statusParams.push(region_id);
        regionParams.push(region_id);
        commercialTypeParams.push(region_id);
      }

      // =========================================================
      // SEARCH FILTER
      // =========================================================
      if (search_filter) {
        const searchValue = `%${search_filter}%`;

        const condition = `
        AND EXISTS (
          SELECT 1

          FROM trainer_payment_trans spt

          LEFT JOIN trainer_mapping stm2
            ON stm2.id = spt.trainer_mapping_id

          LEFT JOIN customers sc2
            ON sc2.id = stm2.customer_id

          LEFT JOIN technologies stech2
            ON stech2.id = sc2.enrolled_course

          WHERE spt.payment_master_id = tpm.id

          AND (
            sc2.student_id LIKE ?
            OR sc2.name LIKE ?
            OR sc2.phone LIKE ?
            OR sc2.email LIKE ?
            OR stech2.name LIKE ?
          )
        )
      `;

        getQuery += condition;
        countQuery += condition;
        //  statusCountQuery += condition;
        regionCountQuery += condition;
        commercialTypeCountQuery += condition;

        queryParams.push(
          searchValue,
          searchValue,
          searchValue,
          searchValue,
          searchValue,
        );

        countParams.push(
          searchValue,
          searchValue,
          searchValue,
          searchValue,
          searchValue,
        );

        // statusParams.push(
        //   searchValue,
        //   searchValue,
        //   searchValue,
        //   searchValue,
        //   searchValue,
        // );

        regionParams.push(
          searchValue,
          searchValue,
          searchValue,
          searchValue,
          searchValue,
        );

        commercialTypeParams.push(
          searchValue,
          searchValue,
          searchValue,
          searchValue,
          searchValue,
        );
      }

      // =========================================================
      // BRANCH FILTER
      // =========================================================
      if (branch_id) {
        const condition = `
        AND EXISTS (
          SELECT 1

          FROM trainer_payment_trans btpt

          LEFT JOIN trainer_mapping btm
            ON btm.id = btpt.trainer_mapping_id

          LEFT JOIN customers bc
            ON bc.id = btm.customer_id

          LEFT JOIN lead_master bl
            ON bl.id = bc.lead_id

          LEFT JOIN users bse
            ON bse.user_id = bl.assigned_to

          LEFT JOIN branches bbranch
            ON bbranch.id = bse.branch_id

          WHERE btpt.payment_master_id = tpm.id
          AND bbranch.id = ?
        )
      `;

        getQuery += condition;
        countQuery += condition;
        //  statusCountQuery += condition;
        regionCountQuery += condition;
        commercialTypeCountQuery += condition;

        queryParams.push(branch_id);
        countParams.push(branch_id);
        //  statusParams.push(branch_id);
        regionParams.push(branch_id);
        commercialTypeParams.push(branch_id);
      }

      // =========================================================
      // MASTER PAGINATION
      // =========================================================
      getQuery += `
      ORDER BY
        tpm.bill_raisedate DESC,
        tpm.id DESC
      LIMIT ? OFFSET ?
    `;

      queryParams.push(limitNumber, offset);

      // =========================================================
      // EXECUTE MASTER + COUNTS
      // =========================================================
      const [
        [countResult],
        [statusResult],
        [regionResult],
        [commercialTypeResult],
        [masterRows],
      ] = await Promise.all([
        pool.query(countQuery, countParams),
        pool.query(statusCountQuery, statusParams),
        pool.query(regionCountQuery, regionParams),
        pool.query(commercialTypeCountQuery, commercialTypeParams),
        pool.query(getQuery, queryParams),
      ]);

      // =========================================================
      // IF NO MASTER DATA
      // =========================================================
      if (!masterRows || masterRows.length === 0) {
        return {
          data: [],
          statusCount: statusResult[0] || {},
          regionCount: regionResult[0] || {},
          commercialTypeCount: commercialTypeResult[0] || {},
          pagination: {
            total: parseInt(countResult[0]?.total || 0, 10),
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(
              parseInt(countResult[0]?.total || 0, 10) / limitNumber,
            ),
          },
        };
      }

      // =========================================================
      // GET PAYMENT MASTER IDS
      // =========================================================
      const paymentMasterIds = masterRows.map((row) => row.id);

      // =========================================================
      // CREATE ? PLACEHOLDERS
      // =========================================================
      const placeholders = paymentMasterIds.map(() => "?").join(",");

      // =========================================================
      // STUDENT QUERY
      //
      // IMPORTANT:
      // This query gets ALL students belonging to the
      // payment_master_id values returned above.
      //
      // NO JSON_ARRAYAGG.
      // =========================================================
      const studentsQuery = `
      SELECT

        tpt.id AS payment_trans_id,

        tpt.payment_master_id,

        tpt.trainer_mapping_id,

        tpt.duration_in_hours,
        tpt.training_mode,
        tpt.branch_id,

        tpt.study_material,
        tpt.assessment,
        tpt.placement_guidance,

        tpt.hr_rating,
        tpt.coordinator_rating,

        tpt.place_of_supply,
        tpt.place_of_sale,

        tpt.commercial,
        tpt.commercial_percentage,

        tpt.attendance_status,
        tpt.attendance_sheetlink,
        tpt.attendance_screenshot,
        tpt.screenshot,

        tm.customer_id,

        c.student_id,

        c.is_linkedin_verified,
        c.is_google_verified,

        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,

        c.lead_id,

        c.linkedin_review,

        CASE
          WHEN (
            c.linkedin_review IS NOT NULL
            AND c.linkedin_review != ''
          )
          THEN 1
          ELSE 0
        END AS is_linkedin,

        c.google_review,

        CASE
          WHEN (
            c.google_review IS NOT NULL
            AND c.google_review != ''
          )
          THEN 1
          ELSE 0
        END AS is_google,

        c.class_percentage,

        CASE
          WHEN c.class_percentage = 100
          THEN 1
          ELSE 0
        END AS is_class_percentage,

        c.is_acknowledged,
        c.acknowledged_date,

        tech.name AS course_name,

        c.place_of_service AS std_place_of_service,

        psb.name AS std_place_of_service_name,

        cm.name AS mode_of_training,

        COALESCE(pm.total_amount, 0)
          AS std_total_amount,

        COALESCE(ps.paid_amount, 0)
          AS std_paid_amount,

        (
          COALESCE(pm.total_amount, 0)
          -
          COALESCE(ps.paid_amount, 0)
        ) AS std_balance_amount,

        CASE
          WHEN (
            COALESCE(pm.total_amount, 0)
            -
            COALESCE(ps.paid_amount, 0)
          ) > 0
          THEN 0
          ELSE 1
        END AS is_payment_cleared,

        ra.user_id AS ra_user_id,
        ra.user_name AS ra_user_name,

        hu.user_id AS hr_user_id,
        hu.user_name AS hr_user_name,

        l.assigned_to AS lead_assigned_to_id,

        se.user_name AS lead_assigned_to_name,

        sb.name AS std_place_of_sale_name,

        sr.name AS std_region_name

      FROM trainer_payment_trans tpt

      LEFT JOIN trainer_mapping tm
        ON tm.id = tpt.trainer_mapping_id

      LEFT JOIN customers c
        ON c.id = tm.customer_id

      LEFT JOIN technologies tech
        ON tech.id = c.enrolled_course

      LEFT JOIN lead_master l
        ON l.id = c.lead_id

      LEFT JOIN class_mode cm
        ON cm.id = l.preferred_mode

      LEFT JOIN users se
        ON se.user_id = l.assigned_to

      LEFT JOIN branches sb
        ON sb.id = se.branch_id

      LEFT JOIN region sr
        ON sr.id = sb.region_id

      LEFT JOIN payment_master pm
        ON pm.lead_id = l.id

      LEFT JOIN (
        SELECT
          pt.payment_master_id,
          SUM(pt.amount) AS paid_amount

        FROM payment_trans pt

        WHERE pt.payment_status IN (
          'Verified',
          'Verify Pending'
        )

        GROUP BY pt.payment_master_id
      ) ps
        ON ps.payment_master_id = pm.id

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id

        FROM customer_track ct

        WHERE ct.status = 'Trainer Assigned'

        GROUP BY ct.customer_id
      ) latest_hr
        ON latest_hr.customer_id = c.id

      LEFT JOIN customer_track ht
        ON ht.id = latest_hr.latest_id

      LEFT JOIN users hu
        ON hu.user_id = ht.updated_by

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id

        FROM customer_track ct

        WHERE ct.status = 'Student Verified'

        GROUP BY ct.customer_id
      ) latest_ra
        ON latest_ra.customer_id = c.id

      LEFT JOIN customer_track rt
        ON rt.id = latest_ra.latest_id

      LEFT JOIN users ra
        ON ra.user_id = rt.updated_by

      LEFT JOIN branches psb
        ON psb.id = c.place_of_service

      WHERE tpt.payment_master_id IN (${placeholders})

      ORDER BY
        tpt.payment_master_id DESC,
        tpt.id ASC
    `;

      // =========================================================
      // FETCH ALL STUDENTS
      // =========================================================
      const [studentRows] = await pool.query(studentsQuery, paymentMasterIds);

      // =========================================================
      // GROUP STUDENTS BY payment_master_id
      //
      // THIS IS THE MAIN PART
      //
      // Example:
      //
      // payment_master_id 7
      //    student A
      //    student B
      //
      // becomes:
      //
      // {
      //    id: 7,
      //    students: [
      //       student A,
      //       student B
      //    ]
      // }
      // =========================================================
      const studentsMap = {};

      for (const student of studentRows) {
        const masterId = student.payment_master_id;

        if (!studentsMap[masterId]) {
          studentsMap[masterId] = [];
        }

        studentsMap[masterId].push(student);
      }

      // =========================================================
      // ATTACH students[] TO EACH MASTER
      // =========================================================
      const finalData = masterRows.map((master) => {
        return {
          ...master,

          students: studentsMap[master.id] || [],
        };
      });

      // =========================================================
      // TOTAL
      // =========================================================
      const total = parseInt(countResult[0]?.total || 0, 10);

      // =========================================================
      // FINAL RESPONSE
      // =========================================================
      return {
        data: finalData,

        statusCount: statusResult[0] || {
          total: 0,
          link_sent: 0,
          requested: 0,
          awaiting_finance: 0,
          paid: 0,
        },

        regionCount: regionResult[0] || {
          hub_count: 0,
          hub_amount: 0,
          chn_count: 0,
          chn_amount: 0,
          blr_count: 0,
          blr_amount: 0,
        },
        commercialTypeCount: commercialTypeResult[0] || {
          Pay_Per_Head_Count: 0,
          Batch_Count: 0,
        },

        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
      };
    } catch (error) {
      console.error("getPaymentsV1 ERROR:", error);

      throw new Error(`Error while fetching data: ${error.message}`);
    }
  },
  getPayments: async (
    start_date,
    end_date,
    status,
    trainer_id,
    training_mode,
    commercial_type,
    region_id,
    search_filter,
    branch_id,
    page,
    limit,
    type,
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const statusParams = [];

      // =========================================================
      // MAIN QUERY
      // getQuery + studentsData are now ONE SINGLE QUERY
      // =========================================================

      let getQuery = `
      SELECT
                    
        /* =========================
           TRAINER PAYMENT MASTER
        ========================= */

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
        tm.batch_id,

        bm.batch_number,

        tm.updated_date,

        tp.paid_date,

        /* =========================
           STUDENT DETAILS
        ========================= */

        tpt.id AS payment_trans_id,
        tpt.payment_master_id,
        tpt.trainer_mapping_id,

        tmap.customer_id,

        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.whatsapp as customer_whatsapp,

        tech.name AS course_name,

        c.lead_id,

        c.linkedin_review,

        CASE
          WHEN c.linkedin_review IS NOT NULL
            AND c.linkedin_review != ''
          THEN 1
          ELSE 0
        END AS is_linkedin,

        c.google_review,

        CASE
          WHEN c.google_review IS NOT NULL
            AND c.google_review != ''
          THEN 1
          ELSE 0
        END AS is_google,

        c.class_percentage,

        CASE
          WHEN c.class_percentage = 100
          THEN 1
          ELSE 0
        END AS is_class_percentage,

        c.is_acknowledged,
        c.acknowledged_date,

        tpt.place_of_supply,
        tpt.place_of_sale,
        tpt.commercial,
        tpt.commercial_percentage,

        tpt.attendance_status,
        tpt.attendance_sheetlink,
        tpt.attendance_screenshot,
        tpt.screenshot,

        COALESCE(pm.total_amount, 0) AS total_amount,

        COALESCE(ps.paid_amount, 0) AS student_paid_amount,

        (
          COALESCE(pm.total_amount, 0)
          - COALESCE(ps.paid_amount, 0)
        ) AS student_balance_amount,

        CASE
          WHEN (
            COALESCE(pm.total_amount, 0)
            - COALESCE(ps.paid_amount, 0)
          ) > 0
          THEN 0
          ELSE 1
        END AS is_payment_cleared,

        tpt.duration_in_hours,
        tpt.training_mode,
        c.branch_id,
        tpt.study_material,
        tpt.assessment,
        tpt.placement_guidance,
        tpt.hr_rating,
        tpt.coordinator_rating,

        ra.user_id AS ra_user_id,
        ra.user_name AS ra_user_name,

        hu.user_id AS hr_user_id,
        hu.user_name AS hr_user_name,

        cm.name AS mode_of_training,

        c.is_linkedin_verified,
        c.is_google_verified

      FROM trainer_payment_master AS tm

      INNER JOIN trainer AS t
        ON t.id = tm.trainer_id

      LEFT JOIN users AS vu
        ON vu.user_id = tm.verified_by

      LEFT JOIN users AS cu
        ON cu.user_id = tm.created_by

      LEFT JOIN batch_master AS bm
        ON bm.id = tm.batch_id

      LEFT JOIN trainer_payment AS tp
        ON tp.payment_master_id = tm.id

      /* =================================================
         THIS IS THE IMPORTANT CHANGE

         Previously:
         getQuery
              +
         separate studentsData query

         Now:
         trainer_payment_trans is directly joined here.
         ================================================= */

      LEFT JOIN trainer_payment_trans AS tpt
        ON tpt.payment_master_id = tm.id

      LEFT JOIN trainer_mapping AS tmap
        ON tmap.id = tpt.trainer_mapping_id

      LEFT JOIN customers AS c
        ON c.id = tmap.customer_id

      LEFT JOIN lead_master AS l
        ON l.id = c.lead_id

      LEFT JOIN class_mode AS cm
        ON cm.id = l.preferred_mode

      LEFT JOIN technologies AS tech
        ON tech.id = c.enrolled_course

      LEFT JOIN payment_master AS pm
        ON pm.lead_id = c.lead_id

      /* Student payment summary */

      LEFT JOIN (
        SELECT
          pt.payment_master_id,
          SUM(pt.amount) AS paid_amount
        FROM payment_trans AS pt
        WHERE pt.payment_status IN (
          'Verified',
          'Verify Pending'
        )
        GROUP BY pt.payment_master_id
      ) AS ps
        ON ps.payment_master_id = pm.id

      /* Latest Trainer Assigned */

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id
        FROM customer_track AS ct
        WHERE ct.status = 'Trainer Assigned'
        GROUP BY ct.customer_id
      ) AS latest_hr
        ON latest_hr.customer_id = c.id

      LEFT JOIN customer_track AS ht
        ON ht.id = latest_hr.latest_id

      LEFT JOIN users AS hu
        ON hu.user_id = ht.updated_by

      /* Latest Student Verified */

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id
        FROM customer_track AS ct
        WHERE ct.status = 'Student Verified'
        GROUP BY ct.customer_id
      ) AS latest_ra
        ON latest_ra.customer_id = c.id

      LEFT JOIN customer_track AS rt
        ON rt.id = latest_ra.latest_id

      LEFT JOIN users AS ra
        ON ra.user_id = rt.updated_by

      WHERE 1 = 1
    `;

      // =========================================================
      // COUNT QUERY
      // =========================================================

      let countQuery = `
      SELECT
        COUNT(tm.id) AS total

    FROM trainer_payment_master AS tm

      INNER JOIN trainer AS t
        ON t.id = tm.trainer_id

      LEFT JOIN users AS vu
        ON vu.user_id = tm.verified_by

      LEFT JOIN users AS cu
        ON cu.user_id = tm.created_by

      LEFT JOIN batch_master AS bm
        ON bm.id = tm.batch_id

      LEFT JOIN trainer_payment AS tp
        ON tp.payment_master_id = tm.id

      /* =================================================
         THIS IS THE IMPORTANT CHANGE

         Previously:
         getQuery
              +
         separate studentsData query

         Now:
         trainer_payment_trans is directly joined here.
         ================================================= */

      LEFT JOIN trainer_payment_trans AS tpt
        ON tpt.payment_master_id = tm.id

      LEFT JOIN trainer_mapping AS tmap
        ON tmap.id = tpt.trainer_mapping_id

      LEFT JOIN customers AS c
        ON c.id = tmap.customer_id

      LEFT JOIN lead_master AS l
        ON l.id = c.lead_id

      LEFT JOIN class_mode AS cm
        ON cm.id = l.preferred_mode

      LEFT JOIN technologies AS tech
        ON tech.id = c.enrolled_course

      LEFT JOIN payment_master AS pm
        ON pm.lead_id = c.lead_id

      /* Student payment summary */

      LEFT JOIN (
        SELECT
          pt.payment_master_id,
          SUM(pt.amount) AS paid_amount
        FROM payment_trans AS pt
        WHERE pt.payment_status IN (
          'Verified',
          'Verify Pending'
        )
        GROUP BY pt.payment_master_id
      ) AS ps
        ON ps.payment_master_id = pm.id

      /* Latest Trainer Assigned */

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id
        FROM customer_track AS ct
        WHERE ct.status = 'Trainer Assigned'
        GROUP BY ct.customer_id
      ) AS latest_hr
        ON latest_hr.customer_id = c.id

      LEFT JOIN customer_track AS ht
        ON ht.id = latest_hr.latest_id

      LEFT JOIN users AS hu
        ON hu.user_id = ht.updated_by

      /* Latest Student Verified */

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id
        FROM customer_track AS ct
        WHERE ct.status = 'Student Verified'
        GROUP BY ct.customer_id
      ) AS latest_ra
        ON latest_ra.customer_id = c.id

      LEFT JOIN customer_track AS rt
        ON rt.id = latest_ra.latest_id

      LEFT JOIN users AS ra
        ON ra.user_id = rt.updated_by

      WHERE 1 = 1
    `;

      // =========================================================
      // STATUS COUNT QUERY
      // =========================================================

      let statusCountQuery = `
      SELECT

        COUNT(tm.id) AS total,

        IFNULL(
          SUM(
            CASE
              WHEN tm.status IN ('Link Sent', 'Rejected')
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS link_sent,

        IFNULL(
          SUM(
            CASE
              WHEN tm.status IN ('Requested', 'Rejected')
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS requested,

        IFNULL(
          SUM(
            CASE
              WHEN tm.status = 'Awaiting Approval'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS awaiting_approval,

        IFNULL(
          SUM(
            CASE
              WHEN tm.status = 'Awaiting Finance'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS awaiting_finance,

        IFNULL(
          SUM(
            CASE
              WHEN tm.status = 'Completed'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS completed,

        IFNULL(
          SUM(
            CASE
              WHEN tm.status IN (
                'Payment Rejected',
                'Approval Rejected'
              )
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS payment_rejected,

        IFNULL(
          SUM(
            CASE
              WHEN tm.status = 'Paid'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS paid,

        IFNULL(
  SUM(
    CASE
      WHEN re.name = '${CONSTANT_STATUS.CHENNAI}'
      THEN 1
      ELSE 0
    END
  ),
  0
) AS chennai_region,

IFNULL(
  SUM(
    CASE
      WHEN re.name = '${CONSTANT_STATUS.BANGALORE}'
      THEN 1
      ELSE 0
    END
  ),
  0
) AS bangalore_region,

IFNULL(
  SUM(
    CASE
      WHEN re.name = '${CONSTANT_STATUS.ONLINE}'
      THEN 1
      ELSE 0
    END
  ),
  0
) AS hub_region,

IFNULL(
  SUM(
    CASE
      WHEN re.name = '${CONSTANT_STATUS.CHENNAI}'
      THEN
        CASE
          WHEN tm.status = 'Paid'
          THEN COALESCE(ps.paid_amount, 0)
          ELSE COALESCE(tm.request_amount, 0)
        END
      ELSE 0
    END
  ),
  0
) AS chennai_region_amount,

IFNULL(
  SUM(
    CASE
      WHEN re.name = '${CONSTANT_STATUS.BANGALORE}'
      THEN
        CASE
          WHEN tm.status = 'Paid'
          THEN COALESCE(ps.paid_amount, 0)
          ELSE COALESCE(tm.request_amount, 0)
        END
      ELSE 0
    END
  ),
  0
) AS bangalore_region_amount,

IFNULL(
  SUM(
    CASE
      WHEN re.name = '${CONSTANT_STATUS.ONLINE}'
      THEN
        CASE
          WHEN tm.status = 'Paid'
          THEN COALESCE(ps.paid_amount, 0)
          ELSE COALESCE(tm.request_amount, 0)
        END
      ELSE 0
    END
  ),
  0
) AS hub_region_amount

      FROM trainer_payment_master tm
      INNER JOIN trainer AS t
        ON t.id = tm.trainer_id

      LEFT JOIN users AS vu
        ON vu.user_id = tm.verified_by

      LEFT JOIN users AS cu
        ON cu.user_id = tm.created_by

      LEFT JOIN batch_master AS bm
        ON bm.id = tm.batch_id

      LEFT JOIN trainer_payment AS tp
        ON tp.payment_master_id = tm.id

      /* =================================================
         THIS IS THE IMPORTANT CHANGE

         Previously:
         getQuery
              +
         separate studentsData query

         Now:
         trainer_payment_trans is directly joined here.
         ================================================= */

      LEFT JOIN trainer_payment_trans AS tpt
        ON tpt.payment_master_id = tm.id

      LEFT JOIN trainer_mapping AS tmap
        ON tmap.id = tpt.trainer_mapping_id

      LEFT JOIN customers AS c
        ON c.id = tmap.customer_id

      LEFT JOIN lead_master AS l
        ON l.id = c.lead_id
  LEFT JOIN branches AS br
  ON br.id = l.branch_id

LEFT JOIN region AS re
  ON re.id = br.region_id

      LEFT JOIN class_mode AS cm
        ON cm.id = l.preferred_mode

      LEFT JOIN technologies AS tech
        ON tech.id = c.enrolled_course

      LEFT JOIN payment_master AS pm
        ON pm.lead_id = c.lead_id

      /* Student payment summary */

      LEFT JOIN (
        SELECT
          pt.payment_master_id,
          SUM(pt.amount) AS paid_amount
        FROM payment_trans AS pt
        WHERE pt.payment_status IN (
          'Verified',
          'Verify Pending'
        )
        GROUP BY pt.payment_master_id
      ) AS ps
        ON ps.payment_master_id = pm.id

      /* Latest Trainer Assigned */

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id
        FROM customer_track AS ct
        WHERE ct.status = 'Trainer Assigned'
        GROUP BY ct.customer_id
      ) AS latest_hr
        ON latest_hr.customer_id = c.id

      LEFT JOIN customer_track AS ht
        ON ht.id = latest_hr.latest_id

      LEFT JOIN users AS hu
        ON hu.user_id = ht.updated_by

      /* Latest Student Verified */

      LEFT JOIN (
        SELECT
          ct.customer_id,
          MAX(ct.id) AS latest_id
        FROM customer_track AS ct
        WHERE ct.status = 'Student Verified'
        GROUP BY ct.customer_id
      ) AS latest_ra
        ON latest_ra.customer_id = c.id

      LEFT JOIN customer_track AS rt
        ON rt.id = latest_ra.latest_id

      LEFT JOIN users AS ra
        ON ra.user_id = rt.updated_by


      WHERE 1 = 1
    `;

      // =========================================================
      // DATE FILTER
      // =========================================================

      if (start_date && end_date) {
        if (type === "Deadline") {
          getQuery += `
          AND tm.deadline_date BETWEEN ? AND ?
        `;

          countQuery += `
          AND tm.deadline_date BETWEEN ? AND ?
        `;

          statusCountQuery += `
          AND deadline_date BETWEEN ? AND ?
        `;
        } else {
          getQuery += `
          AND tm.bill_raisedate BETWEEN ? AND ?
        `;

          countQuery += `
          AND tm.bill_raisedate BETWEEN ? AND ?
        `;

          statusCountQuery += `
          AND bill_raisedate BETWEEN ? AND ?
        `;
        }

        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
      }

      // =========================================================
      // STATUS FILTER
      // =========================================================

      if (status) {
        if (status === "Payment Rejected") {
          getQuery += `
          AND tm.status IN (
            'Payment Rejected',
            'Approval Rejected'
          )
        `;

          countQuery += `
          AND tm.status IN (
            'Payment Rejected',
            'Approval Rejected'
          )
        `;
        } else {
          getQuery += `
          AND tm.status = ?
        `;

          countQuery += `
          AND tm.status = ?
        `;

          queryParams.push(status);
          countParams.push(status);
        }
      }

      // =========================================================
      // TRAINER FILTER
      // =========================================================

      if (trainer_id) {
        getQuery += `
        AND tm.trainer_id = ?
      `;

        countQuery += `
        AND tm.trainer_id = ?
      `;

        statusCountQuery += `
        AND tm.trainer_id = ?
      `;

        queryParams.push(trainer_id);
        countParams.push(trainer_id);
        statusParams.push(trainer_id);
      }

      if (training_mode) {
        getQuery += `
    AND tpt.training_mode = ?
  `;

        countQuery += `
    AND tpt.training_mode = ?
  `;

        statusCountQuery += `
    AND tpt.training_mode = ?
  `;

        queryParams.push(training_mode);
        countParams.push(training_mode);
        statusParams.push(training_mode);
      }

      if (commercial_type) {
        getQuery += `
    AND tm.commercial_type = ?
  `;

        countQuery += `
    AND tm.commercial_type = ?
  `;

        statusCountQuery += `
    AND tm.commercial_type = ?
  `;

        queryParams.push(commercial_type);
        countParams.push(commercial_type);
        statusParams.push(commercial_type);
      }

      if (search_filter) {
        const searchStr = `%${search_filter}%`;

        // =========================================================
        // MAIN QUERY
        // =========================================================
        getQuery += `
    AND (
      c.name LIKE ?
      OR c.phone LIKE ?
      OR tech.name LIKE ?
      OR c.email LIKE ?
      or c.whatsapp LIKE ?
    )
  `;

        queryParams.push(searchStr, searchStr, searchStr, searchStr, searchStr);

        // =========================================================
        // COUNT QUERY
        // =========================================================
        countQuery += `
    AND (
      c.name LIKE ?
      OR c.phone LIKE ?
      OR tech.name LIKE ?
      OR c.email LIKE ?
      or c.whatsapp LIKE ?
    )
  `;

        countParams.push(searchStr, searchStr, searchStr, searchStr, searchStr);

        // =========================================================
        // STATUS QUERY
        // Only use this if statusQuery contains these conditions
        // =========================================================
        statusCountQuery += `
    AND (
      c.name LIKE ?
      OR c.phone LIKE ?
      OR tech.name LIKE ?
      OR c.email LIKE ?
      or c.whatsapp LIKE ?
    )
  `;

        statusParams.push(
          searchStr,
          searchStr,
          searchStr,
          searchStr,
          searchStr,
        );
      }
      if (region_id) {
        getQuery += `
    AND EXISTS (
      SELECT 1
      FROM region AS re
      INNER JOIN branches AS b
        ON b.region_id = re.id
      INNER JOIN lead_master AS l2
        ON l2.branch_id = b.id
      INNER JOIN users AS u
        ON u.user_id = l2.assigned_to
      WHERE l2.id = c.lead_id
        AND re.id = ?
        AND l2.assigned_to = u.user_id
    )
  `;

        countQuery += `
    AND EXISTS (
      SELECT 1
      FROM region AS re
      INNER JOIN branches AS b
        ON b.region_id = re.id
      INNER JOIN lead_master AS l2
        ON l2.branch_id = b.id
      INNER JOIN users AS u
        ON u.user_id = l2.assigned_to
      WHERE l2.id = c.lead_id
        AND re.id = ?
        AND l2.assigned_to = u.user_id
    )
  `;

        statusCountQuery += `
    AND EXISTS (
      SELECT 1
      FROM region AS re
      INNER JOIN branches AS b
        ON b.region_id = re.id
      INNER JOIN lead_master AS l2
        ON l2.branch_id = b.id
      INNER JOIN users AS u
        ON u.user_id = l2.assigned_to
      WHERE l2.id = c.lead_id
        AND re.id = ?
        AND l2.assigned_to = u.user_id
    )
  `;

        queryParams.push(region_id);
        countParams.push(region_id);
        statusParams.push(region_id);
      }
      if (branch_id) {
        getQuery += `
   
    AND EXISTS (
      SELECT 1
      FROM branches AS b
      INNER JOIN lead_master AS l2
        ON l2.branch_id = b.id
      WHERE l2.id = c.lead_id
        AND b.id = ?
    )
  `;

        countQuery += `
    AND EXISTS (
       SELECT 1
      FROM branches AS b
      INNER JOIN lead_master AS l2
        ON l2.branch_id = b.id
      WHERE l2.id = c.lead_id
        AND b.id = ?
    )
  `;

        statusCountQuery += `
    AND EXISTS (
       SELECT 1
      FROM branches AS b
      INNER JOIN lead_master AS l2
        ON l2.branch_id = b.id
      WHERE l2.id = c.lead_id
        AND b.id = ?
    )
  `;

        queryParams.push(branch_id);
        countParams.push(branch_id);
        statusParams.push(branch_id);
      }
      // =========================================================
      // PAGINATION
      // =========================================================

      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;

      const offset = (pageNumber - 1) * limitNumber;

      getQuery += `
      ORDER BY
        tm.bill_raisedate DESC,
        tm.id DESC

      LIMIT ? OFFSET ?
    `;

      queryParams.push(limitNumber, offset);

      // =========================================================
      // EXECUTE
      // =========================================================

      const [[countResult], [statusResult], [result]] = await Promise.all([
        pool.query(countQuery, countParams),
        pool.query(statusCountQuery, statusParams),
        pool.query(getQuery, queryParams),
      ]);

      const total = countResult[0]?.total || 0;

      // =========================================================
      // IMPORTANT
      //
      // NO:
      // ids
      // students Map
      // studentsData query
      // students array
      //
      // result itself already contains student information.
      // =========================================================

      return {
        data: result,

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
  getTrainerPaymentBankSheet: async (payment_master_id) => {
    try {
      const placeholders = payment_master_id.map(() => "?").join(",");
      const [result] = await pool.query(
        `  SELECT
    'NFT' AS payment_type,
    tra.id AS cust_ref_number,
    '409014082505' AS source_account_number,
    tra.name AS source_narration,
    tba.account_number AS destination_account_number,
    'INR' AS currency,
    COALESCE(SUM(tpt.commercial),0) AS amount,
    'From Acte' AS destination_narration,
    tba.bank_name AS destination_bank,
    tba.ifsc_code AS destination_bank_ifsc_code,
    tba.account_holder_name AS beneficiary_name,
    tba.account_type AS beneficiary_account_type
FROM trainer_payment_master tpm
LEFT JOIN trainer_payment_trans tpt
    ON tpt.payment_master_id = tpm.id
LEFT JOIN trainer_bank_accounts tba
    ON tba.id = tpm.bank_id
LEFT JOIN trainer tra
    ON tra.id = tpm.trainer_id
WHERE tpm.id IN (${placeholders})
  AND tpm.status = 'Paid'
GROUP BY
    tra.id,
    tra.name,
    tba.account_number,
    tba.bank_name,
    tba.ifsc_code,
    tba.account_holder_name,
    tba.account_type `,

        payment_master_id,
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getPaymentById: async (payment_id, payment_trans_id) => {
    try {
      let payment_master_id = payment_id;
      // If frontend passes payment_trans_id explicitly, use it to find the master
      if (payment_trans_id) {
        const [transRecord] = await pool.query(
          `SELECT payment_master_id FROM trainer_payment_trans WHERE id = ?`,
          [payment_trans_id],
        );

        if (transRecord.length > 0) {
          payment_master_id = transRecord[0].payment_master_id;
        }
      }

      let getQuery = `SELECT
          tm.id,
          tm.bill_raisedate,
          tm.trainer_id,
          t.trainer_id AS trainer_code,
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
          tba.branch_name,
          tba.account_type,
          tm.batch_id,
          bm.batch_number,
          tm.updated_date,
          tp.paid_date,
          tp.transaction_id,
          tp.status AS payment_status,
          tp.payment_mode
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
      LEFT JOIN batch_master AS bm ON
        bm.id = tm.batch_id
      LEFT JOIN trainer_payment AS tp ON
        tp.payment_master_id = tm.id
      WHERE tm.id = ?`;

      const [result] = await pool.query(getQuery, [payment_master_id]);

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
                c.student_id,
                c.lead_id,
                c.linkedin_review,
                CASE WHEN (c.linkedin_review IS NOT NULL AND c.linkedin_review != '') THEN 1 ELSE 0 END AS is_linkedin,
                c.google_review,
                CASE WHEN (c.google_review IS NOT NULL AND c.google_review != '') THEN 1 ELSE 0 END AS is_google,
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
            LEFT JOIN (
            	SELECT pt.payment_master_id, SUM(pt.amount) AS paid_amount FROM payment_trans AS pt
                WHERE pt.payment_status IN ('Verified', 'Verify Pending')
                GROUP BY pt.payment_master_id
            ) AS ps ON ps.payment_master_id = pm.id
            WHERE tp.payment_master_id = ?`,
        [payment_master_id],
      );

      studentsData.forEach((s) => {
        const { payment_master_id, ...rest } = s;
        const key = String(payment_master_id);
        if (!students.has(key)) {
          students.set(key, []);
        }
        students.get(key).push(rest);
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
        [payment_master_id],
      );

      paymentsData.forEach((p) => {
        const { payment_master_id, ...rest } = p;
        const key = String(payment_master_id);
        if (!payments.has(key)) {
          payments.set(key, []);
        }
        payments.get(key).push(rest);
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
        [payment_master_id],
      );

      scoreCardData.forEach((s) => {
        const { payment_master_id, ...rest } = s;
        scoreCard.set(String(payment_master_id), rest);
      });

      if (result.length === 0) return null;

      const masterKey = String(result[0].id);

      return {
        ...result[0],
        students: students.get(masterKey) || [],
        payments: payments.get(masterKey) || [],
        scoreCard: scoreCard.get(masterKey) || null,
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
              c.phone AS cus_phone,
              c.student_id,
              CASE
                WHEN c.student_id IS NOT NULL
                  THEN c.student_id
                ELSE CONCAT(c.name, " - ", c.phone)
              END AS student_name,
              c.id
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

      const studentDetails = getPaidHeads.map((head) => `${head.student_name}`);

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
              1,
              accountNumber,
              head.commercial_type,
              head.student_name,
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

        const totalDuration = getPaidHeads.reduce(
          (sum, head) => sum + (parseFloat(head.duration_in_hours) || 0),
          0,
        );
        const averageHours =
          getPaidHeads.length > 0 ? totalDuration / getPaidHeads.length : 0;

        await EmailModel.sendPayslip(
          getTrainer[0].email,
          getTrainer[0].name,
          getTrainer[0].trainer_id,
          getBatch[0].batch_name,
          paid_date,
          getBatch[0].batch_number,
          dynamicTrainingMode,
          averageHours,
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

      if (getPaidHeads.length > 0) {
        for (const head of getPaidHeads) {
          await conn.query(
            `INSERT INTO customer_track(customer_id, status, status_date, updated_by) VALUES(?, ?, ?, ?)`,
            [head.id, "Trainer Payment Paid", paid_date, paid_by],
          );
        }
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
  updateTrainerPaymentStatus: async (
    status,
    trainer_payment_id,
    updated_by,
    updated_date,
    Revert,
  ) => {
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

      // if (hasUnsatisfied) {
      //   throw new Error(
      //     "Cannot update status: All check criteria (LinkedIn, Google, Class %, Cleared Payment, Acknowledged) must be satisfied (completed with status 1).",
      //   );
      // }

      const [getCus] = await conn.query(
        `SELECT 
            c.id
        FROM trainer_payment_master tpm
        INNER JOIN trainer_payment_trans tpt ON tpm.id = tpt.payment_master_id
        INNER JOIN trainer_mapping tm ON tm.id = tpt.trainer_mapping_id
        INNER JOIN customers c ON c.id = tm.customer_id 
        WHERE tpm.id = ?`,
        [trainer_payment_id],
      );

      if (Revert === 1) {
        if (getCus.length > 0) {
          for (const customer of getCus) {
            await conn.query(
              `INSERT INTO customer_track(customer_id, status, status_date, updated_by) VALUES(?, ?, ?, ?)`,
              [
                customer.id,
                "Reverted Trainer Payment Approval",
                updated_date,
                updated_by,
              ],
            );
          }
        }

        await conn.query(
          `UPDATE trainer_payment_master SET status = ?,approved_date = null  WHERE id = ?`,
          [status, trainer_payment_id],
        );
      } else {
        if (getCus.length > 0) {
          for (const customer of getCus) {
            await conn.query(
              `INSERT INTO customer_track(customer_id, status, status_date, updated_by) VALUES(?, ?, ?, ?)`,
              [
                customer.id,
                "Trainer Payment Approved",
                updated_date,
                updated_by,
              ],
            );
          }
        }

        await conn.query(
          `UPDATE trainer_payment_master SET status = ? WHERE id = ?`,
          [status, trainer_payment_id],
        );

        if (status === "Awaiting Finance") {
          await conn.query(
            `UPDATE trainer_payment_master SET approved_date = ? WHERE id = ?`,
            [updated_date, trainer_payment_id],
          );
        }
      }

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
    account_type,
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
        const bankAccount = isBankExists[0];
        console.log(bankAccount, "bankAccount");
        if (!bankAccount.account_type && account_type) {
          await connection.query(
            `UPDATE trainer_bank_accounts
             SET account_type = ?
             WHERE id = ?`,
            [account_type, bankAccount.id],
          );
        }
        await connection.query(
          `UPDATE trainer_payment_master SET bank_id = ? WHERE id = ?`,
          [bankAccount.id, payment_master_id],
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
              account_type,
              created_date
          )
          VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            trainer_id,
            account_number,
            account_holder_name,
            bank_name,
            ifsc_code,
            branch_name,
            account_type,
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
        const [getCus] = await pool.query(
          `SELECT tm.customer_id FROM trainer_payment_trans tpt INNER JOIN trainer_mapping AS tm ON tpt.trainer_mapping_id = tm.id WHERE tpt.id = ?`,
          [student.payment_trans_id],
        );
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

        await connection.query(
          `INSERT INTO customer_track(customer_id, status, status_date, updated_by) VALUES(?, ?, ?, ?)`,
          [
            getCus[0].customer_id,
            "Trainer Payment Claim Submitted",
            updated_date,
            trainer_id,
          ],
        );
      }

      const date = new Date();
      date.setDate(date.getDate() + 15);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const deadlineDate = `${year}-${month}-${day}`;

      await connection.query(
        `UPDATE
            trainer_payment_master
        SET
            status = 'Requested',
            updated_date = ?,
            is_trainer_updated = 1,
            feedback = ?,
            deadline_date = ?
        WHERE
            id = ?`,
        [updated_date, feedback, deadlineDate, payment_master_id],
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

  insertTrainerPaymentDirectlyToPaid: async (
    trainer_id,
    request_amount,
    bank_id,
    commercial_type,
    created_by,
    created_date,
    feedback,
    students,
    batch_id,
    account_number,
    account_holder_name,
    bank_name,
    ifsc_code,
    branch_name,
    account_type,
    paid_amount,
    transaction_id,
    payment_mode,
    paid_date,
    paid_by,
  ) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let affectedRows = 0;
      let lastInsertId = null;

      //validation
      if (!students || students.length <= 0) {
        throw new Error("Students cannot be empty");
      }

      if (!trainer_id) {
        throw new Error("Trainer ID is required");
      }

      if (!commercial_type) {
        throw new Error("Commercial type is required");
      }

      if (!request_amount || Number(request_amount) <= 0) {
        throw new Error("Request amount must be greater than 0");
      }

      // PAY PER HEAD VALIDATION
      if (commercial_type === "Pay Per Head") {
        const trainerMappingIds = students
          .map((student) => student.trainer_mapping_id)
          .filter(Boolean);

        if (trainerMappingIds.length === 0) {
          throw new Error("No students selected.");
        }

        // Get customer IDs from trainer_mapping
        const [customers] = await connection.query(
          `
          SELECT customer_id
          FROM trainer_mapping
          WHERE id IN (?)
        `,
          [trainerMappingIds],
        );

        const customerIds = customers
          .map((customer) => customer.customer_id)
          .filter(Boolean);

        if (customerIds.length === 0) {
          throw new Error("No customers found.");
        }

        // Check whether any customer is already assigned to a batch
        const [batchCustomers] = await connection.query(
          `
          SELECT DISTINCT customer_id
          FROM batch_trans
          WHERE customer_id IN (?)
        `,
          [customerIds],
        );

        if (batchCustomers.length > 0) {
          throw new Error(
            "One or more selected customers are already assigned to a batch. Kindly request batch payment.",
          );
        }
      }

      // COMMERCIAL CALCULATION
      let commercial = 0;
      /*
       * For Batch:
       *
       * request_amount = total batch payment
       *
       * Example:
       * request_amount = 30000
       * students = 3
       *
       * commercial = 30000 / 3
       *            = 10000
       *
       * Each transaction will contain 10000.
       */

      const date = new Date();
      date.setDate(date.getDate() + 15);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const deadlineDate = `${year}-${month}-${day}`;

      if (commercial_type !== "Pay Per Head") {
        commercial = Number(request_amount) / Number(students.length);
      }

      // MASTER QUERY
      const masterQuery = `
      INSERT INTO trainer_payment_master (
        bill_raisedate,
        trainer_id,
        request_amount,
        balance_amount,
        commercial_type,
        batch_amount,
        batch_id,
        bank_id,
        status,
        created_by,
        created_date,
        feedback,
        is_trainer_updated,
        deadline_date,
        paid_amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

      // TRANSACTION QUERY
      const transQuery = `
      INSERT INTO trainer_payment_trans (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

      // INSERT PAYMENT RECORDS
      /*
       * Current behavior:
       *
       * Pay Per Head:
       *   1 master + 1 transaction per student
       *
       * Batch:
       *   1 master + 1 transaction per student
       *
       * If you want Batch to create only ONE master record,
       * the loop needs to be separated. The code below follows
       * the structure of your current implementation.
       */

      if (commercial_type === "Batch") {
        // BATCH
        // ONE MASTER RECORD FOR ENTIRE BATCH
        const masterValues = [
          created_date,
          trainer_id,
          request_amount,
          request_amount,
          commercial_type,
          request_amount,
          batch_id,
          bank_id,
          "Paid",
          created_by,
          created_date,
          feedback,
          1,
          deadlineDate,
          paid_amount,
        ];

        const [insertMaster] = await connection.query(
          masterQuery,
          masterValues,
        );

        affectedRows += insertMaster.affectedRows;
        lastInsertId = insertMaster.insertId;

        await connection.query(
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
            lastInsertId,
            paid_amount,
            "Completed",
            "Fully Paid",
            transaction_id,
            payment_mode,
            paid_date,
            paid_by,
          ],
        );

        // Insert transaction for every student
        for (const student of students) {
          const perStudentAmount =
            Number(request_amount) / Number(students.length);

          const transValues = [
            insertMaster.insertId,
            student.trainer_mapping_id,
            perStudentAmount,
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

          // Fetch customer details
        }
      } else {
        // PAY PER HEAD
        // ONE MASTER + ONE TRANSACTION PER STUDENT

        for (const student of students) {
          const perStudentAmount = Number(student.commercial) || 0;

          if (perStudentAmount <= 0) {
            throw new Error(
              `Invalid commercial amount for trainer mapping ID: ${student.trainer_mapping_id}`,
            );
          }

          // Master
          const masterValues = [
            created_date,
            trainer_id,
            perStudentAmount,
            perStudentAmount,
            commercial_type,
            0,
            batch_id,
            bank_id,
            "Paid",
            created_by,
            created_date,
            feedback,
            1,
            deadlineDate,
            paid_amount,
          ];

          const [insertMaster] = await connection.query(
            masterQuery,
            masterValues,
          );

          affectedRows += insertMaster.affectedRows;
          lastInsertId = insertMaster.insertId;

          await connection.query(
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
              lastInsertId,
              paid_amount,
              "Completed",
              "Fully Paid",
              transaction_id,
              payment_mode,
              paid_date,
              paid_by,
            ],
          );

          // Transaction
          const transValues = [
            insertMaster.insertId,
            student.trainer_mapping_id,
            perStudentAmount,
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
        }
      }

      const [isBankExists] = await connection.query(
        `SELECT id FROM trainer_bank_accounts WHERE trainer_id = ? AND account_number = ?`,
        [trainer_id, account_number],
      );

      if (isBankExists.length > 0) {
        const bankAccount = isBankExists[0];
        console.log(bankAccount, "bankAccount");
        if (!bankAccount.account_type && account_type) {
          await connection.query(
            `UPDATE trainer_bank_accounts
             SET account_type = ?
             WHERE id = ?`,
            [account_type, bankAccount.id],
          );
        }
      } else {
        await connection.query(
          `INSERT INTO trainer_bank_accounts(
              trainer_id,
              account_number,
              account_holder_name,
              bank_name,
              ifsc_code,
              branch_name,
              account_type,
              created_date
          )
          VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            trainer_id,
            account_number,
            account_holder_name,
            bank_name,
            ifsc_code,
            branch_name,
            account_type,
            created_date,
          ],
        );
      }

      await connection.commit();

      return {
        trainer_id: trainer_id,
        payment_master_id: lastInsertId,
        affectedRows: affectedRows,
      };
    } catch (error) {
      await connection.rollback();
      console.error("insertTrainerPaymentDirectlyToPaid Error:", error.message);

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
            account_type,
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
        `SELECT is_acknowledged FROM customers WHERE id = ?`,
        [customer_id],
      );

      if (
        isAcknowledged.length > 0 &&
        isAcknowledged[0].is_acknowledged === 1
      ) {
        throw new Error("Class has already been acknowledged.");
      }

      await connection.query(
        `UPDATE customers SET is_acknowledged = ?, acknowledged_date = ? WHERE id = ?`,
        [is_acknowledged, acknowledged_date, customer_id],
      );

      await connection.query(
        `INSERT INTO customer_track(customer_id, status, status_date) VALUES(?, ?, ?)`,
        [customer_id, "Class Completion Acknowledged", acknowledged_date],
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
