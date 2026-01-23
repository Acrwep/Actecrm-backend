const pool = require("../config/dbconfig");

const BatchModel = {
  createBatch: async (
    batch_name,
    trainer_id,
    region_id,
    branch_id,
    customers,
    created_by,
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
        customers !== undefined &&
        !Array.isArray(customers) &&
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
            created_by
        )
        VALUES(?, ?, ?, ?, ?, ?)`,
        [batch_name, batchNumber, trainer_id, region_id, branch_id, created_by],
      );

      affectedRows += insertBatch.affectedRows;

      if (
        customers !== undefined &&
        !Array.isArray(customers) &&
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

  getBatches: async (batch_id) => {
    try {
      const batchQuery = `SELECT
                            bm.id AS batch_id,
                            bm.batch_name,
                            r.name AS region_name,
                            b.name AS branch_name
                        FROM
                            batch_master AS bm
                        INNER JOIN region AS r ON
                            r.id = bm.region_id
                        INNER JOIN branches AS b ON
                            b.id = bm.branch_id
                        WHERE bm.id = ?
                        ORDER BY bm.id DESC`;

      const [batches] = await pool.query(batchQuery, [batch_id]);
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = BatchModel;
