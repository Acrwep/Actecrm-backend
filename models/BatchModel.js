const pool = require("../config/dbconfig");
const { CONSTANT_STATUS } = require("../constants/constant");

const BatchModel = {
  createBatch: async (
    batch_name,
    trainer_id,
    region_id,
    branch_id,
    customers,
    created_by,
    created_date,
    status,
    start_date,
    end_date,
    start_time,
    end_time,
    course_id,
    type,
    batch_timing_id,
  ) => {
    try {
      let affectedRows = 0;
      const [isBatchExists] = await pool.query(
        `SELECT id FROM batch_master WHERE batch_name = ?`,
        [batch_name],
      );

      if (isBatchExists.length > 0)
        throw new Error("Batch name already exists");

      if (
        customers !== undefined ||
        !Array.isArray(customers) ||
        customers.length > 0
      ) {
        // Extract customer_id values
        const customerIds = customers.map((c) => c.customer_id);

        const placeholders = customerIds.map(() => "?").join(",");

        const [isCusExists] = await pool.query(
          `SELECT customer_id 
          FROM batch_trans 
          WHERE customer_id IN (${placeholders})`,
          customerIds,
        );

        if (isCusExists.length > 0) {
          const foundIds = isCusExists.map((r) => r.customer_id);
          throw new Error(
            `Customer Id(s): ${foundIds.join(", ")} already mapped`,
          );
        }
      }

      const [batchcount] = await pool.query(
        `SELECT IFNULL(MAX(id), 0) AS id FROM batch_master`,
      );

      if (type == "batch") {
        console.log("batch");
        // let batchNumber;

        // if (batchcount[0].id === 0) {
        //   batchNumber = "B0001";
        // } else {
        //   const id = batchcount[0].id;
        //   batchNumber = "B" + String(id).padStart(4, "0");
        // }

        const [latestBatch] = await pool.query(`
  SELECT MAX(CAST(SUBSTRING(batch_number, 2) AS UNSIGNED)) AS latest_number
  FROM batch_master
  WHERE batch_number IS NOT NULL
`);

        const nextNumber = (latestBatch[0].latest_number || 0) + 1;

        const batchNumber = "B" + String(nextNumber).padStart(4, "0");

        const [insertBatch] = await pool.query(
          `INSERT INTO batch_master(
            batch_name,
            batch_number,
            type,
            trainer_id,
            region_id,
            branch_id,
            created_by,
            created_date,
            status,
            start_date,
            end_date,
            start_time,
            end_time,
            course_id,
            batch_timing_id
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            batch_name,
            batchNumber,
            type,
            trainer_id,
            region_id,
            branch_id,
            created_by,
            created_date,
            status,
            start_date,
            end_date,
            start_time,
            end_time,
            course_id,
            batch_timing_id,
          ],
        );

        affectedRows += insertBatch.affectedRows;

        if (
          customers !== undefined ||
          !Array.isArray(customers) ||
          customers.length > 0
        ) {
          for (const customer of customers) {
            const [insertCustomer] = await pool.query(
              `INSERT INTO batch_trans(
                batch_master_id,
                customer_id
            )
            VALUES(?, ?)`,
              [insertBatch.insertId, customer.customer_id],
            );

            affectedRows += insertCustomer.affectedRows;
          }
        }
      } else if (type == "group") {
        console.log("group");
        const [latestBatch] = await pool.query(`
  SELECT MAX(CAST(SUBSTRING(group_number, 2) AS UNSIGNED)) AS latest_number
  FROM batch_master
  WHERE group_number IS NOT NULL
`);

        const nextNumber = (latestBatch[0].latest_number || 0) + 1;

        const batchNumber = "G" + String(nextNumber).padStart(4, "0");

        const [insertBatch] = await pool.query(
          `INSERT INTO batch_master(
            batch_name,
            group_number,
            type,
            trainer_id,
            region_id,
            branch_id,
            created_by,
            created_date,
            status,
            start_date,
            end_date,
            start_time,
            end_time,
            course_id,
            batch_timing_id
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            batch_name,
            batchNumber,
            type,
            trainer_id,
            region_id,
            branch_id,
            created_by,
            created_date,
            status,
            start_date,
            end_date,
            start_time,
            end_time,
            course_id,
            batch_timing_id,
          ],
        );

        affectedRows += insertBatch.affectedRows;

        if (
          customers !== undefined ||
          !Array.isArray(customers) ||
          customers.length > 0
        ) {
          for (const customer of customers) {
            const [insertCustomer] = await pool.query(
              `INSERT INTO batch_trans(
                batch_master_id,
                customer_id
            )
            VALUES(?, ?)`,
              [insertBatch.insertId, customer.customer_id],
            );

            affectedRows += insertCustomer.affectedRows;
          }
        }
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBatches: async (
    trainer_id,
    batch_id,
    start_date,
    end_date,
    region_id,
    branch_id,
    customer_search_filter,
    type,
  ) => {
    try {
      const batchParams = [];
      const regionParams = [];
      const customerParams = [];
      let batchQuery = `SELECT
                            bm.id AS batch_id,
                            bm.batch_number,
                            bm.batch_name,
                            bm.trainer_id,
                            t.name AS trainer_name,
                            bm.region_id,
                            r.name AS region_name,
                            bm.branch_id,
                            b.name AS branch_name,
                            bm.created_date,
                            bm.status as batch_status,
                            bm.start_date as batch_start_date,
                            bm.end_date as batch_end_date,
                            bm.start_time as batch_start_time,
                            bm.end_time as batch_end_time,
                            tg.name as batch_course_name,
                            bm.course_id as batch_course_id,
                            bm.type,
                            bm.group_number,
                            bm.batch_timing_id,
                            bs.name as batch_timing_name

                        FROM
                            batch_master AS bm
                        INNER JOIN region AS r ON
                            r.id = bm.region_id
                        INNER JOIN branches AS b ON
                            b.id = bm.branch_id
                        LEFT JOIN trainer AS t ON
                            t.id = bm.trainer_id
                        left join technologies tg on tg.id = bm.course_id
                        left join batches bs on bs.id = bm.batch_timing_id 
                        WHERE 1 = 1 and bm.is_active = 1`;

      let regionQuery = `
  SELECT
    COUNT(*) AS total_batches,

    SUM(
      CASE
        WHEN r.name = 'Chennai' THEN 1
        ELSE 0
      END
    ) AS chennai_region,

    SUM(
      CASE
        WHEN r.name = 'Bangalore' THEN 1
        ELSE 0
      END
    ) AS bangalore_region,

    SUM(
      CASE
        WHEN r.name = 'Hub' THEN 1
        ELSE 0
      END
    ) AS hub_region

  FROM batch_master AS bm

  INNER JOIN region AS r
    ON r.id = bm.region_id

  INNER JOIN branches AS b
    ON b.id = bm.branch_id

  LEFT JOIN trainer AS t
    ON t.id = bm.trainer_id

  WHERE 1 = 1 and bm.is_active = 1
`;

      if (batch_id) {
        batchQuery += ` AND bm.id = ?`;
        regionQuery += ` AND bm.id = ?`;
        batchParams.push(batch_id);
        regionParams.push(batch_id);
      }

      if (trainer_id) {
        batchQuery += ` AND bm.trainer_id = ?`;
        regionQuery += ` AND bm.trainer_id = ?`;
        batchParams.push(trainer_id);
        regionParams.push(trainer_id);
      }

      // if (start_date && end_date) {
      //   batchQuery += ` AND CAST(bm.created_date AS DATE) BETWEEN ? AND ?`;
      //   regionQuery += ` AND CAST(bm.created_date AS DATE) BETWEEN ? AND ?`;
      //   batchParams.push(start_date, end_date);
      //   regionParams.push(start_date, end_date);
      // }

      if (start_date && end_date) {
        batchQuery += `
    AND (
      (
        bm.start_date IS NOT NULL
        AND bm.end_date IS NOT NULL
        AND CAST(bm.start_date AS DATE) <= ?
        AND CAST(bm.end_date AS DATE) >= ?
      )
      OR
      (
        bm.start_date IS NULL
        AND bm.end_date IS NULL
        AND CAST(bm.created_date AS DATE) BETWEEN ? AND ?
      )
    )
  `;

        regionQuery += `
    AND (
      (
        bm.start_date IS NOT NULL
        AND bm.end_date IS NOT NULL
        AND CAST(bm.start_date AS DATE) <= ?
        AND CAST(bm.end_date AS DATE) >= ?
      )
      OR
      (
        bm.start_date IS NULL
        AND bm.end_date IS NULL
        AND CAST(bm.created_date AS DATE) BETWEEN ? AND ?
      )
    )
  `;

        batchParams.push(end_date, start_date, start_date, end_date);
        regionParams.push(end_date, start_date, start_date, end_date);
      }

      if (region_id) {
        batchQuery += ` AND bm.region_id = ?`;
        regionQuery += ` AND bm.region_id = ?`;

        batchParams.push(region_id);
        regionParams.push(region_id);
      }

      if (branch_id) {
        batchQuery += ` AND bm.branch_id = ?`;
        regionQuery += ` AND bm.branch_id = ?`;
        batchParams.push(branch_id);
        regionParams.push(branch_id);
      }

      if (type) {
        batchQuery += ` AND bm.type = ?`;
        regionQuery += ` AND bm.type = ?`;
        batchParams.push(type);
        regionParams.push(type);
      }

      batchQuery += ` ORDER BY bm.id DESC`;

      const [batches] = await pool.query(batchQuery, batchParams);
      const [regionBatches] = await pool.query(regionQuery, regionParams);

      const batchIds = [...new Set(batches.map((b) => b.batch_id))];

      let customerMap = new Map();

      if (batchIds.length > 0) {
        let filteredBatchIds = batchIds;

        if (customer_search_filter) {
          const searchValue = `%${customer_search_filter}%`;

          const [matchedBatches] = await pool.query(
            `
      SELECT DISTINCT
        bt.batch_master_id AS batch_id
      FROM batch_trans AS bt
      INNER JOIN customers AS c
        ON c.id = bt.customer_id
      WHERE bt.batch_master_id IN (?)
        AND (
          c.name LIKE ?
          OR c.phone LIKE ?
          OR c.email LIKE ?
        )
    `,
            [batchIds, searchValue, searchValue, searchValue],
          );

          filteredBatchIds = matchedBatches.map((row) => row.batch_id);
        }

        if (filteredBatchIds.length === 0) {
          return {
            data: [],
            region_count: {
              total_region: 0,
              chennai_region: 0,
              bangalore_region: 0,
              hub_region: 0,
            },
          };
        }

        let customerQuery = `
  SELECT
      bt.id AS batch_trans_id,
      bt.batch_master_id AS batch_id,
      c.id,
      c.name,
      c.phone,
      c.email,
      c.status,
      c.linkedin_review,
      c.google_review,
      cer.course_duration AS cer_course_duration,
      cer.course_completion_month AS cer_course_completion_month,
      cer.location AS cer_location,
      c.review_updated_date,
      t.name AS course_name,
      c.class_schedule_id,
      c.class_start_date,
      c.class_scheduled_at,
      c.class_comments,
      c.class_percentage,
      c.class_attachment,
      c.is_certificate_generated
  FROM
      batch_trans AS bt
  INNER JOIN customers AS c
      ON c.id = bt.customer_id
  INNER JOIN technologies AS t
      ON t.id = c.enrolled_course
  LEFT JOIN certificates AS cer
      ON cer.customer_id = c.id
  WHERE bt.batch_master_id IN (?)
`;

        customerParams.push(filteredBatchIds);

        const [customers] = await pool.query(customerQuery, customerParams);

        customers.forEach((r) => {
          if (!customerMap.has(r.batch_id)) {
            customerMap.set(r.batch_id, []);
          }
          customerMap.get(r.batch_id).push(r);
        });
      }

      // =========================================================
      // STEP 1: CREATE THE SAME BATCH RESULT AS BEFORE
      // =========================================================

      let batchResult = batches
        .filter((item) => {
          if (customer_search_filter) {
            return customerMap.has(item.batch_id);
          }

          return true;
        })
        .map((item) => {
          const customers = customerMap.get(item.batch_id) || [];

          const completed_student = customers.filter(
            (c) => Number(c.class_percentage) === 100,
          ).length;

          const total_students = customers.length;

          const linkedin_review = customers.filter(
            (c) => c.linkedin_review !== null,
          ).length;

          const google_review = customers.filter(
            (c) => c.google_review !== null,
          ).length;

          const status =
            completed_student === total_students ? "Completed" : "In Progress";

          return {
            ...item,
            completed_student,
            total_students,
            linkedin_review,
            google_review,
            status,
            customers,
          };
        });

      // =========================================================
      // STEP 2: GROUP
      // REGION → BRANCH → BATCH → CUSTOMERS
      // =========================================================

      const regionMap = new Map();

      batchResult.forEach((batch) => {
        // -----------------------------
        // REGION
        // -----------------------------
        if (!regionMap.has(batch.region_id)) {
          regionMap.set(batch.region_id, {
            region_id: batch.region_id,
            region_name: batch.region_name,
            branches: [],
          });
        }

        const region = regionMap.get(batch.region_id);

        // -----------------------------
        // BRANCH
        // -----------------------------
        let branch = region.branches.find(
          (b) => b.branch_id === batch.branch_id,
        );

        if (!branch) {
          branch = {
            branch_id: batch.branch_id,
            branch_name: batch.branch_name,
            batches: [],
          };

          region.branches.push(branch);
        }

        // -----------------------------
        // BATCH
        // -----------------------------
        branch.batches.push(batch);
      });

      // Convert Map into array
      const res = Array.from(regionMap.values());

      // =========================================================
      // EXISTING REGION COUNT
      // =========================================================

      const regionCount = regionBatches[0] || {};

      // let res = batches
      //   .filter((item) => {
      //     if (customer_search_filter) {
      //       return customerMap.has(item.batch_id);
      //     }

      //     return true;
      //   })
      //   .map((item) => {
      //     const customers = customerMap.get(item.batch_id) || [];

      //     const completed_student = customers.filter(
      //       (c) => Number(c.class_percentage) === 100,
      //     ).length;
      //     const total_students = customers.length;
      //     const linkedin_review = customers.filter(
      //       (c) => c.linkedin_review !== null,
      //     ).length;
      //     const google_review = customers.filter(
      //       (c) => c.google_review !== null,
      //     ).length;
      //     const status =
      //       completed_student === total_students ? "Completed" : "In Progress";

      //     return {
      //       ...item,
      //       completed_student,
      //       total_students,
      //       linkedin_review,
      //       google_review,
      //       status,
      //       customers,
      //     };
      //   });

      // const regionCount = regionBatches[0] || {};

      return {
        data: res,

        region_count: {
          total_region: Number(regionCount.total_batches) || 0,

          chennai_region: Number(regionCount.chennai_region) || 0,

          bangalore_region: Number(regionCount.bangalore_region) || 0,

          hub_region: Number(regionCount.hub_region) || 0,
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateBatch: async (
    batch_id,
    batch_name,
    trainer_id,
    region_id,
    branch_id,
    customers,
    status,
    start_date,
    end_date,
    start_time,
    end_time,
    course_id,
    batch_timing_id,
  ) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let affectedRows = 0;

      // Check batch exists
      const [batch] = await connection.query(
        `SELECT id FROM batch_master WHERE id = ?`,
        [batch_id],
      );

      if (batch.length === 0) {
        throw new Error("Batch not found");
      }

      // Update batch_master
      const [updateBatch] = await connection.query(
        `UPDATE batch_master
       SET batch_name = ?,
           trainer_id = ?,
           region_id = ?,
           branch_id = ?,
           status = ?,
           start_date = ?,
           end_date = ?,
           start_time = ?,
           end_time = ?,
           course_id = ?,
           batch_timing_id = ?
       WHERE id = ?`,
        [
          batch_name,
          trainer_id,
          region_id,
          branch_id,
          status,
          start_date,
          end_date,
          start_time,
          end_time,
          course_id,
          batch_timing_id,
          batch_id,
        ],
      );

      affectedRows += updateBatch.affectedRows;

      // Handle customers
      if (Array.isArray(customers)) {
        // Existing customers in DB
        const [existing] = await connection.query(
          `SELECT customer_id FROM batch_trans WHERE batch_master_id = ?`,
          [batch_id],
        );

        const existingIds = existing.map((x) => x.customer_id);
        const newIds = customers.map((x) => x.customer_id);

        // Customers to remove
        const removedCustomers = existingIds.filter(
          (id) => !newIds.includes(id),
        );

        // Customers to add
        const addedCustomers = newIds.filter((id) => !existingIds.includes(id));

        // Delete removed customers
        if (removedCustomers.length > 0) {
          const placeholders = removedCustomers.map(() => "?").join(",");
          const [del] = await connection.query(
            `DELETE FROM batch_trans
           WHERE batch_master_id = ?
           AND customer_id IN (${placeholders})`,
            [batch_id, ...removedCustomers],
          );
          affectedRows += del.affectedRows;
        }

        // Insert added customers
        for (const customer_id of addedCustomers) {
          const [ins] = await connection.query(
            `INSERT INTO batch_trans(batch_master_id, customer_id)
           VALUES(?, ?)`,
            [batch_id, customer_id],
          );
          affectedRows += ins.affectedRows;
        }
      }

      await connection.commit();
      return affectedRows;
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  deleteBatch: async (batch_id) => {
    try {
      let affectedRows = 0;

      const [payment] = await pool.query(
        `SELECT batch_id FROM trainer_payment_master WHERE batch_id = ?`,
        [batch_id],
      );

      if (payment.length > 0) {
        throw new Error(
          "Batch cannot be deleted because payment has already been processed",
        );
      }

      const [deleteBatch] = await pool.query(
        `delete from batch_master
       WHERE id = ?`,
        [batch_id],
      );

      const [deleteBatchTrans] = await pool.query(
        `delete from batch_trans
       WHERE batch_master_id = ?`,
        [batch_id],
      );

      affectedRows += deleteBatchTrans.affectedRows;

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    } finally {
    }
  },

  swapBatchToGroup: async (batch_id) => {
    try {
      let affectedRows = 0;

      const [payment] = await pool.query(
        `SELECT batch_id FROM trainer_payment_master WHERE batch_id = ?`,
        [batch_id],
      );

      if (payment.length > 0) {
        throw new Error(
          "Batch cannot be swap because payment has already been processed",
        );
      }

      const [latestBatch] = await pool.query(`
  SELECT MAX(CAST(SUBSTRING(group_number, 2) AS UNSIGNED)) AS latest_number
  FROM batch_master
  WHERE group_number IS NOT NULL
`);

      const nextNumber = (latestBatch[0].latest_number || 0) + 1;

      const batchNumber = "G" + String(nextNumber).padStart(4, "0");
      const [updateBatch] = await pool.query(
        `UPDATE batch_master
       SET  group_number = ?,
       type = 'group'
       WHERE id = ?`,
        [batchNumber, batch_id],
      );

      affectedRows += updateBatch.affectedRows;

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    } finally {
    }
  },

  batchStudents: async (name, mobile, email, page, limit, trainer_id) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
            tm.id AS trainer_mapping_id,
            tm.trainer_id,
            c.id,
            c.name,
            c.email AS customer_email,
            c.phone,
            t.name AS course_name,
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
        INNER JOIN technologies AS t ON
          t.id = c.enrolled_course
        WHERE
            tm.is_verified = 1
            AND NOT EXISTS (
                SELECT 1
                FROM batch_trans bt
                WHERE bt.customer_id = tm.customer_id
            )`;

      let countQuery = `SELECT
            COUNT(tm.id) AS total
        FROM trainer_mapping AS tm
        INNER JOIN customers AS c 
            ON tm.customer_id = c.id
        INNER JOIN lead_master AS l ON
        	l.id = c.lead_id
        INNER JOIN technologies AS t ON
          t.id = c.enrolled_course
        WHERE
            tm.is_verified = 1
            AND NOT EXISTS (
                SELECT 1
                FROM batch_trans bt
                WHERE bt.customer_id = tm.customer_id
            )`;

      // Add name filter
      if (name) {
        getQuery += ` AND c.name LIKE '%${name}%'`;
        countQuery += ` AND c.name LIKE '%${name}%'`;
      }

      // Add email filter
      if (email) {
        getQuery += ` AND c.email LIKE '%${email}%'`;
        countQuery += ` AND c.email LIKE '%${email}%'`;
      }

      // Add mobile number filter
      if (mobile) {
        getQuery += ` AND c.phone LIKE '%${mobile}%'`;
        countQuery += ` AND c.phone LIKE '%${mobile}%'`;
      }

      if (trainer_id) {
        getQuery += ` AND tm.trainer_id = ${trainer_id}`;
        countQuery += ` AND tm.trainer_id = ${trainer_id}`;
      }

      const [countResult] = await pool.query(countQuery);
      const total = countResult[0]?.total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY c.created_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);
      const [result] = await pool.query(getQuery, queryParams);

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

      return {
        customers: res,
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
};

module.exports = BatchModel;
