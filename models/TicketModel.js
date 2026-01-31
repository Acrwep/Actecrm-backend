const pool = require("../config/dbconfig");

const TicketModel = {
  validateEmail: async (email, raised_by_role) => {
    if (!email) {
      throw new Error("Please enter Email ID.");
    }

    let query = "";
    let tableName = "";

    if (raised_by_role === "Trainer") {
      tableName = "trainer";
    } else if (raised_by_role === "Customer") {
      tableName = "customers";
    } else {
      throw new Error("Invalid raised by role.");
    }

    query = `SELECT id FROM ${tableName} WHERE email = ? LIMIT 1`;

    const [rows] = await pool.query(query, [email]);

    if (rows.length === 0) {
      throw new Error("Invalid Email ID.");
    }

    return {
      status: true,
      user_id: rows[0].id,
      role: raised_by_role,
    }; // ✅ email is valid
  },

  createTicket: async (
    title,
    description,
    category_id,
    sub_category_id,
    priority,
    type,
    attachments,
    raised_by_id,
    raised_by_role,
  ) => {
    try {
      const insertQuery = `INSERT INTO tickets(
                                title,
                                description,
                                category_id,
                                sub_category_id,
                                priority,
                                type,
                                status,
                                raised_by_id,
                                raised_by_role
                            )
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        title,
        description,
        category_id,
        sub_category_id,
        priority,
        type,
        "Raised",
        raised_by_id,
        raised_by_role,
      ];

      const [result] = await pool.query(insertQuery, values);

      for (const attachment of attachments) {
        await pool.query(
          `INSERT INTO ticket_attachments(
                ticket_id,
                base64string
            )
            VALUES(?, ?)`,
          [result.insertId, attachment.base64string],
        );
      }
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTickets: async () => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                        t.ticket_id,
                        t.title,
                        t.description,
                        t.category_id,
                        t.sub_category_id,
                        t.priority,
                        t.type,
                        t.status,
                        t.raised_by_id,
                        t.raised_by_role,
                        t.assigned_to,
                        t.created_at,
                        t.updated_at
                    FROM
                        tickets AS t
                    INNER JOIN ticket_categories AS c ON
                        c.category_id = t.category_id
                    INNER JOIN ticket_sub_categories AS sc ON
                        t.sub_category_id = sc.sub_category_id
                    WHERE 1 = 1;`;

      const [result] = await pool.query(getQuery, queryParams);

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = TicketModel;
