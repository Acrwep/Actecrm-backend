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
    created_at,
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
                                raised_by_role,
                                created_at
                            )
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        title,
        description,
        category_id,
        sub_category_id,
        priority,
        type,
        "Open",
        raised_by_id,
        raised_by_role,
        created_at,
      ];

      const [result] = await pool.query(insertQuery, values);

      for (const attachment of attachments) {
        await pool.query(
          `INSERT INTO ticket_attachments(
                ticket_id,
                base64string,
                uploaded_at
            )
            VALUES(?, ?, ?)`,
          [result.insertId, attachment.base64string, created_at],
        );
      }

      const [insertTrack] = await pool.query(
        `INSERT INTO ticket_track(
                              ticket_id,
                              assigned_to,
                              status,
                              created_date,
                              update_by
                          )
                          VALUES(?, ?, ?, ?, ?)`,
        [result.insertId, raised_by_id, "Assigned", created_at, raised_by_id],
      );

      return {
        status: true,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTickets: async (start_date, end_date, status, page, limit) => {
    try {
      const queryParams = [];
      const countParams = [];
      const statusParams = [];
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

      let countQuery = `SELECT
                        COUNT(*) AS total
                    FROM
                        tickets AS t
                    WHERE 1 = 1`;

      let statusQuery = `SELECT
                            COUNT(*) AS total,
                            IFNULL(SUM(CASE WHEN t.status = 'Open' THEN 1 ELSE 0 END), 0) AS open,
                            IFNULL(SUM(CASE WHEN t.status = 'Hold' THEN 1 ELSE 0 END), 0) AS hold,
                            IFNULL(SUM(CASE WHEN t.status = 'Closed' THEN 1 ELSE 0 END), 0) AS closed,
                            IFNULL(SUM(CASE WHEN t.status = 'Overdue' THEN 1 ELSE 0 END), 0) AS overdue
                        FROM
                            tickets AS t
                        WHERE
                            1 = 1`;

      if (start_date && end_date) {
        getQuery += ` AND CAST(t.created_at AS DATE) BETWEEN ? AND ?`;
        countQuery += ` AND CAST(t.created_at AS DATE) BETWEEN ? AND ?`;
        statusQuery += ` AND CAST(t.created_at AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
      }

      if (status) {
        getQuery += ` AND t.status = ?`;
        countQuery += ` AND t.status = ?`;
        statusQuery += ` AND t.status = ?`;
        queryParams.push(status);
        countParams.push(status);
        statusParams.push(status);
      }

      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0]?.total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY t.ticket_id ASC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [result] = await pool.query(getQuery, queryParams);

      const [statusResult] = await pool.query(statusQuery, statusParams);

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

      return {
        tickets: res,
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

  updateTicketStatus: async (ticket_id, status, updated_at) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM tickets WHERE ticket_id = ?`,
        [ticket_id],
      );

      if (isExists.length <= 0) throw new Error("Invalid ticket Id");

      const [updateResult] = await pool.query(
        `UPDATE tickets SET status = ?, updated_at = ? WHERE ticket_id = ?`,
        [status, updated_at, ticket_id],
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

  ticketTrack: async (
    ticket_id,
    assigned_to,
    status,
    details,
    created_date,
    updated_by,
  ) => {
    try {
      const insertQuery = `INSERT INTO ticket_track(
                              ticket_id,
                              assigned_to,
                              status,
                              details,
                              created_date,
                              update_by
                          )
                          VALUES(?, ?, ?, ?, ?, ?)`;

      const values = [
        ticket_id,
        assigned_to,
        status,
        details,
        created_date,
        updated_by,
      ];

      const [result] = await pool.query(insertQuery, values);

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTicketTracks: async (ticket_id) => {
    try {
      const [getTracks] = await pool.query(
        `SELECT
            tt.track_id,
            tt.ticket_id,
            tt.assigned_to,
            au.user_name AS assigned_to_name,
            tt.status,
            tt.details,
            tt.created_date,
            tt.update_by,
            u.user_name AS update_by_name
        FROM
            ticket_track AS tt
        LEFT JOIN users AS u ON
            tt.update_by = u.user_id
        LEFT JOIN users AS au ON
          au.user_id = tt.assigned_to
        WHERE tt.ticket_id = ?
        ORDER BY tt.track_id DESC`,
        [ticket_id],
      );

      return getTracks;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = TicketModel;
