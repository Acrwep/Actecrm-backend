const pool = require("../config/dbconfig");

const BatchModel = {
  createBatch: async (
    batch_name,
    trainer_id,
    region_id,
    branch_id,
    customers,
    created_by,
    created_date,
  ) => {
    try {
      let affectedRows = 0;
      const [isBatchExists] = await pool.query(
        `SELECT id FROM batch_master WHERE batch_name = ?`,
        [batch_name],
      );

      if (isBatchExists.length > 1)
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

      let batchNumber;

      if (batchcount[0].id === 0) {
        batchNumber = "B0001";
      } else {
        const id = batchcount[0].id;
        batchNumber = "B" + String(id).padStart(4, "0");
      }

      const [insertBatch] = await pool.query(
        `INSERT INTO batch_master(
            batch_name,
            batch_number,
            trainer_id,
            region_id,
            branch_id,
            created_by,
            created_date
        )
        VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [
          batch_name,
          batchNumber,
          trainer_id,
          region_id,
          branch_id,
          created_by,
          created_date,
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

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBatches: async (trainer_id, batch_id, start_date, end_date) => {
    try {
      const batchParams = [];
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
                            bm.created_date
                        FROM
                            batch_master AS bm
                        INNER JOIN region AS r ON
                            r.id = bm.region_id
                        INNER JOIN branches AS b ON
                            b.id = bm.branch_id
                        LEFT JOIN trainer AS t ON
                            t.id = bm.trainer_id
                        WHERE 1 = 1`;

      if (batch_id) {
        batchQuery += ` AND bm.id = ?`;
        batchParams.push(batch_id);
      }

      if (trainer_id) {
        batchQuery += ` AND bm.trainer_id = ?`;
        batchParams.push(trainer_id);
      }

      if (start_date && end_date) {
        batchQuery += ` AND CAST(bm.created_date AS DATE) BETWEEN ? AND ?`;
        batchParams.push(start_date, end_date);
      }

      batchQuery += ` ORDER BY bm.id DESC`;

      const [batches] = await pool.query(batchQuery, batchParams);

      let res = await Promise.all(
        batches.map(async (item) => {
          const [customers] = await pool.query(
            `SELECT
                bt.id AS batch_trans_id,
                c.id,
                c.name,
                c.phone,
                c.email,
                c.status,
                c.linkedin_review,
                c.google_review,
                t.name AS course_name
            FROM
                batch_trans AS bt
            INNER JOIN customers AS c ON
                c.id = bt.customer_id
            INNER JOIN technologies AS t ON
              t.id = c.enrolled_course
            WHERE bt.batch_master_id = ?`,
            [item.batch_id],
          );

          return {
            ...item,
            customers: customers,
          };
        }),
      );

      return res;
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
           branch_id = ?
       WHERE id = ?`,
        [batch_name, trainer_id, region_id, branch_id, batch_id],
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
};

module.exports = BatchModel;
