const pool = require("../config/dbconfig");

const TicketModel = {
  validateEmail: async (email) => {
    if (!email) {
      throw new Error("Please enter Email ID.");
    }

    const [result] = await pool.query(
      `
    SELECT id, 'Customer' AS role FROM customers WHERE email = ?
    UNION ALL
    SELECT id, 'Trainer'  AS role FROM trainer  WHERE email = ?
    LIMIT 1
    `,
      [email, email],
    );

    if (result.length === 0) {
      return {
        status: false,
        user_id: null,
        role: null,
      };
    }

    return {
      status: true,
      user_id: result[0].id,
      role: result[0].role,
    };
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

      return {
        status: true,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTickets: async (start_date, end_date) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                        t.ticket_id,
                        t.title,
                        t.description,
                        t.category_id,
                        c.category_name,
                        t.sub_category_id,
                        sc.sub_category_name,
                        t.priority,
                        t.type,
                        t.status,
                        t.raised_by_id,
                        t.raised_by_role,
                        CASE 
                        	WHEN t.raised_by_role = 'Customer' THEN cu.name
                            WHEN t.raised_by_role = 'Trainer' THEN tr.name
                            ELSE ''
                        END AS raised_by_name,
                        t.assigned_to,
                        au.user_name AS assigned_name,
                        t.created_at,
                        t.updated_at
                    FROM
                        tickets AS t
                    INNER JOIN ticket_categories AS c ON
                        c.category_id = t.category_id
                    INNER JOIN ticket_sub_categories AS sc ON
                        t.sub_category_id = sc.sub_category_id
                    LEFT JOIN users AS au ON
                    	t.assigned_to = au.user_id
                    LEFT JOIN customers AS cu ON
                    	t.raised_by_id = cu.id
                        AND t.raised_by_role = 'Customer'
                    LEFT JOIN trainer AS tr ON
                    	t.raised_by_id = tr.id
                        AND t.raised_by_role = 'Trainer'
                    WHERE 1 = 1`;

      if (start_date && end_date) {
        getQuery += ` AND CAST(t.created_at AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }

      getQuery += ` ORDER BY t.ticket_id ASC`;

      const [result] = await pool.query(getQuery, queryParams);

      let res = await Promise.all(
        result.map(async (item) => {
          const [attachments] = await pool.query(
            `SELECT attachment_id, ticket_id, base64string, uploaded_at FROM ticket_attachments WHERE ticket_id = ?`,
            [item.ticket_id],
          );

          return {
            ...item,
            attachments: attachments,
          };
        }),
      );

      return res;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateTicketStatus: async (ticket_id, status) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM tickets WHERE ticket_id = ?`,
        [ticket_id],
      );

      if (isExists.length <= 0) throw new Error("Invalid ticket Id");

      const [updateResult] = await pool.query(
        `UPDATE tickets SET status = ? WHERE ticket_id = ?`,
        [status, ticket_id],
      );

      return updateResult.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCategories: async () => {
    try {
      const [categories] = await pool.query(
        `SELECT category_id AS id, category_name AS name FROM ticket_categories WHERE is_active = 1 ORDER BY category_name`,
      );

      return categories;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSubCategories: async (category_id) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
            ts.sub_category_id AS id,
            ts.category_id,
            tc.category_name,
            ts.sub_category_name AS name
        FROM
            ticket_sub_categories AS ts
        INNER JOIN ticket_categories AS tc ON
            ts.category_id = tc.category_id
        WHERE ts.is_active = 1`;

      if (category_id) {
        getQuery += ` AND ts.category_id = ?`;
        queryParams.push(category_id);
      }

      getQuery += ` ORDER BY ts.sub_category_name`;

      const [subCategories] = await pool.query(getQuery, queryParams);

      return subCategories;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = TicketModel;
