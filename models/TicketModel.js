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
    priority,
    attachments,
    raised_by_id,
    raised_by_role,
    raised_by_name,
    raised_by_email,
    raised_by_mobile,
    raised_by_course,
    manager_id,
    ra_id,
    created_by,
    created_at,
    assigned_to,
  ) => {
    try {
      let status = "";
      if (!ra_id) {
        status = "Awaiting Employee";
      } else {
        status = "Assigned";
      }
      const insertQuery = `INSERT INTO tickets(
                                title,
                                description,
                                category_id,
                                priority,
                                status,
                                raised_by_id,
                                raised_by_role,
                                raised_by_name,
                                raised_by_email,
                                raised_by_mobile,
                                raised_by_course,
                                manager_id,
                                ra_id,
                                created_by,
                                created_at
                            )
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        title,
        description,
        category_id,
        priority,
        status,
        raised_by_id,
        raised_by_role,
        raised_by_name,
        raised_by_email,
        raised_by_mobile,
        raised_by_course,
        manager_id,
        ra_id,
        created_by,
        created_at,
      ];

      const [result] = await pool.query(insertQuery, values);

      console.log("cr attachments", attachments);

      // for (const attachment of attachments) {
      //   await pool.query(
      //     `INSERT INTO ticket_attachments(
      //           ticket_id,
      //           base64string,
      //           uploaded_at
      //       )
      //       VALUES(?, ?, ?)`,
      //     [result.insertId, attachment.base64string, created_at],
      //   );
      // }

      if (Array.isArray(attachments) && attachments.length > 0) {
        const filterAttachment = attachments.filter(
          (f) =>
            f.base64string &&
            typeof f.base64string === "string" &&
            f.base64string.trim() !== "",
        );

        if (filterAttachment.length > 0) {
          for (let i = 0; i < filterAttachment.length; i++) {
            console.log("Valid attachment:", filterAttachment[i]);

            await pool.query(
              `INSERT INTO ticket_attachments(
            ticket_id,
            base64string,
            uploaded_at
        ) VALUES(?, ?, ?)`,
              [result.insertId, filterAttachment[i].base64string, created_at],
            );
          }
        } else {
          console.log("No valid attachments");
        }
      }

      await pool.query(
        `INSERT INTO ticket_track(
                              ticket_id,
                              assigned_to,
                              status,
                              created_date,
                              update_by
                          )
                          VALUES(?, ?, ?, ?, ?)`,
        [result.insertId, assigned_to, "Created", created_at, assigned_to],
      );

      let details = "";

      const userQuery = `SELECT user_name FROM users WHERE user_id = ?`;

      if (manager_id) {
        const [user] = await pool.query(userQuery, [manager_id]);
        details = `Ticket assigned to Manager (${manager_id} - ${user[0].user_name})`;
        await pool.query(
          `INSERT INTO ticket_track(
                                ticket_id,
                                assigned_to,
                                status,
                                details,
                                created_date,
                                update_by
                            )
                            VALUES(?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            manager_id,
            "Assigned",
            details,
            created_at,
            assigned_to,
          ],
        );
      }

      if (ra_id) {
        const [user] = await pool.query(userQuery, [ra_id]);
        details = `Ticket assigned to RA (${ra_id} - ${user[0].user_name})`;
        await pool.query(
          `INSERT INTO ticket_track(
                                ticket_id,
                                assigned_to,
                                status,
                                details,
                                created_date,
                                update_by
                            )
                            VALUES(?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            ra_id,
            "Assigned",
            details,
            created_at,
            assigned_to,
          ],
        );
      }

      return {
        status: true,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateTicket: async (
    ticket_id,
    title,
    description,
    category_id,
    priority,
    attachments, // new attachments
    assigned_to,
    raised_by_id,
    raised_by_role,
    raised_by_name,
    raised_by_email,
    raised_by_mobile,
    raised_by_course,
    manager_id,
    ra_id,
    updated_at,
    manager_updated,
    ra_updated,
  ) => {
    try {
      let status = "";

      if (!ra_id) {
        status = "Awaiting Employee";
      } else {
        status = "Assigned";
      }

      // ✅ Update ticket
      const updateQuery = `
      UPDATE tickets SET
        title = ?,
        description = ?,
        category_id = ?,
        priority = ?,
        status = ?,
        raised_by_id = ?,
        raised_by_role = ?,
        raised_by_name = ?,
        raised_by_email = ?,
        raised_by_mobile = ?,
        raised_by_course = ?,
        manager_id = ?,
        ra_id = ?,
        updated_at = ?
      WHERE ticket_id = ?
    `;

      const values = [
        title,
        description,
        category_id,
        priority,
        status,
        raised_by_id,
        raised_by_role,
        raised_by_name,
        raised_by_email,
        raised_by_mobile,
        raised_by_course,
        manager_id,
        ra_id,
        updated_at,
        ticket_id,
      ];

      await pool.query(updateQuery, values);
      console.log("attachments", attachments);

      // ❗ Step 1: Delete old attachments
      await pool.query(`DELETE FROM ticket_attachments WHERE ticket_id = ?`, [
        ticket_id,
      ]);

      // ❗ Step 2: Insert new attachments
      if (Array.isArray(attachments) && attachments.length > 0) {
        const validAttachments = attachments.filter(
          (f) =>
            f.base64string &&
            typeof f.base64string === "string" &&
            f.base64string.trim() !== "",
        );

        for (const attachment of validAttachments) {
          await pool.query(
            `INSERT INTO ticket_attachments(
        ticket_id,
        base64string,
        uploaded_at
      ) VALUES (?, ?, ?)`,
            [ticket_id, attachment.base64string, updated_at],
          );
        }
      }

      const userQuery = `SELECT user_name FROM users WHERE user_id = ?`;

      // ✅ Track Manager Assignment
      if (manager_id && manager_updated) {
        const [user] = await pool.query(userQuery, [manager_id]);

        const details = `Ticket assigned to Manager (${manager_id} - ${user[0]?.user_name})`;

        await pool.query(
          `INSERT INTO ticket_track(
            ticket_id,
            assigned_to,
            status,
            details,
            created_date,
            update_by
        ) VALUES (?, ?, ?, ?, ?, ?)`,
          [ticket_id, manager_id, "Assigned", details, updated_at, assigned_to],
        );
      }

      // ✅ Track RA Assignment
      if (ra_id && ra_updated) {
        const [user] = await pool.query(userQuery, [ra_id]);

        const details = `Ticket assigned to RA (${ra_id} - ${user[0]?.user_name})`;

        await pool.query(
          `INSERT INTO ticket_track(
            ticket_id,
            assigned_to,
            status,
            details,
            created_date,
            update_by
        ) VALUES (?, ?, ?, ?, ?, ?)`,
          [ticket_id, ra_id, "Assigned", details, updated_at, assigned_to],
        );
      }

      return {
        status: true,
        message: "Ticket updated successfully",
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTickets: async (
    start_date,
    end_date,
    status,
    page,
    limit,
    user_id,
    show_all,
    category_id,
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const statusParams = [];
      const categoryCountParams = [];

      // Optimized getQuery: Use a more robust join for latest assigned_to and avoid inefficient subqueries
      let getQuery = `SELECT
                          t.ticket_id,
                          t.title,
                          t.description,
                          t.category_id,
                          c.category_name,
                          t.priority,
                          t.status,
                          t.raised_by_id,
                          t.raised_by_role,
                          t.raised_by_name AS raised_name,
                          t.raised_by_email AS raised_email,
                          t.raised_by_mobile AS raised_mobile,
                          t.raised_by_course AS raised_course,
                          t.manager_id AS manager_user_id,
                          mu.user_name AS manager_name,
                          t.ra_id AS ra_user_id,
                          ru.user_name AS ra_name,
                          CASE 
                            WHEN t.raised_by_role = 'Customer' THEN cu.name
                            WHEN t.raised_by_role = 'Trainer' THEN tr.name
                            ELSE ''
                          END AS raised_by_name,
                          CASE 
                            WHEN t.raised_by_role = 'Customer' THEN cu.email
                            WHEN t.raised_by_role = 'Trainer' THEN tr.email
                            ELSE ''
                          END AS raised_by_email,
                          t.created_by,
                          u.user_name AS created_by_name,
                          t.created_at,
                          t.closed_at,
                          t.updated_at,
                          latest_tt.assigned_to,
                          au.user_name AS assigned_to_name
                      FROM tickets AS t
                      INNER JOIN ticket_categories AS c ON c.category_id = t.category_id
                      LEFT JOIN customers AS cu ON t.raised_by_id = cu.id AND t.raised_by_role = 'Customer'
                      LEFT JOIN trainer AS tr ON t.raised_by_id = tr.id AND t.raised_by_role = 'Trainer'
                      LEFT JOIN (
                          SELECT tt1.ticket_id, tt1.assigned_to
                          FROM ticket_track tt1
                          WHERE tt1.track_id = (
                              SELECT MAX(track_id) 
                              FROM ticket_track 
                              WHERE ticket_id = tt1.ticket_id AND assigned_to IS NOT NULL
                          )
                      ) AS latest_tt ON latest_tt.ticket_id = t.ticket_id
                      LEFT JOIN users AS au ON au.user_id = latest_tt.assigned_to
                      LEFT JOIN users AS mu ON mu.user_id = t.manager_id
                      LEFT JOIN users AS ru ON ru.user_id = t.ra_id
                      LEFT JOIN users AS u ON u.user_id = t.created_by
                      WHERE 1 = 1`;

      let countQuery = `SELECT COUNT(*) AS total FROM tickets AS t
                        WHERE 1 = 1`;

      let statusQuery = `SELECT
                          COUNT(*) AS total,
                          SUM(CASE WHEN t.status = 'Awaiting Employee' THEN 1 ELSE 0 END) AS awaiting_employee,
                          SUM(CASE WHEN t.status = 'Hold' THEN 1 ELSE 0 END) AS hold,
                          SUM(CASE WHEN t.status = 'Closed' THEN 1 ELSE 0 END) AS closed,
                          SUM(CASE WHEN t.status = 'Overdue' THEN 1 ELSE 0 END) AS overdue,
                          SUM(CASE WHEN t.status = 'Assigned' THEN 1 ELSE 0 END) AS assigned,
                          SUM(CASE WHEN t.status = 'Close Request' THEN 1 ELSE 0 END) AS close_request
                        FROM tickets AS t
                        WHERE 1 = 1`;

      let categoryCount = `SELECT
                              tc.category_id,
                              tc.category_name,
                              COUNT(*) AS ticket_count
                          FROM
                              ticket_categories AS tc
                          LEFT JOIN tickets AS t ON
                              t.category_id = tc.category_id
                          WHERE 1 = 1
                          GROUP BY
                              tc.category_id`;

      if (show_all == false) {
        const userFilter = ` AND (t.manager_id = ? OR t.ra_id = ?)`;
        getQuery += userFilter;
        countQuery += userFilter;
        statusQuery += userFilter;
        categoryCount += userFilter;
        queryParams.push(user_id, user_id);
        countParams.push(user_id, user_id);
        statusParams.push(user_id, user_id);
        categoryCountParams.push(user_id, user_id);
      }

      if (category_id) {
        getQuery += ` AND t.category_id = ?`;
        queryParams.push(category_id);
        countQuery += ` AND t.category_id = ?`;
        countParams.push(category_id);
        statusQuery += ` AND t.category_id = ?`;
        statusParams.push(category_id);
        categoryCount += ` AND t.category_id = ?`;
        categoryCountParams.push(category_id);
      }

      if (start_date && end_date) {
        const dateFilter = ` AND CAST(t.created_at AS DATE) BETWEEN ? AND ?`;
        getQuery += dateFilter;
        countQuery += dateFilter;
        statusQuery += dateFilter;
        categoryCount += dateFilter;
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
        statusParams.push(start_date, end_date);
        categoryCountParams.push(start_date, end_date);
      }

      if (status) {
        getQuery += ` AND t.status = ?`;
        queryParams.push(status);
        countQuery += ` AND t.status = ?`;
        countParams.push(status);
        statusQuery += ` AND t.status = ?`;
        statusParams.push(status);
        categoryCount += ` AND t.status = ?`;
        categoryCountParams.push(status);
      }

      // Pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY t.ticket_id DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      categoryCount += `
                    GROUP BY
                        tc.category_id,
                        tc.category_name
                    ORDER BY
                        tc.category_name ASC`;

      // Execute all 3 primary queries in parallel using Promise.all
      const [[result], [countResult], [statusResult], [categoryCountResult]] =
        await Promise.all([
          pool.query(getQuery, queryParams),
          pool.query(countQuery, countParams),
          pool.query(statusQuery, statusParams),
          pool.query(categoryCount, categoryCountParams),
        ]);

      const total = parseInt(countResult[0]?.total) || 0;
      const statusCount = {
        total: total,
        awaiting_employee: parseInt(statusResult[0]?.awaiting_employee) || 0,
        hold: parseInt(statusResult[0]?.hold) || 0,
        closed: parseInt(statusResult[0]?.closed) || 0,
        overdue: parseInt(statusResult[0]?.overdue) || 0,
        assigned: parseInt(statusResult[0]?.assigned) || 0,
        close_request: parseInt(statusResult[0]?.close_request) || 0,
      };

      // Optimized Attachment Fetching: Avoid N+1 queries by fetching all at once for current page results
      let tickets = result;
      if (tickets.length > 0) {
        const ticketIds = tickets.map((t) => t.ticket_id);
        const [allAttachments] = await pool.query(
          `SELECT attachment_id, ticket_id, base64string, uploaded_at 
           FROM ticket_attachments 
           WHERE ticket_id IN (?)`,
          [ticketIds],
        );

        // Map attachments back to their tickets
        tickets = tickets.map((ticket) => ({
          ...ticket,
          attachments: allAttachments.filter(
            (att) => att.ticket_id === ticket.ticket_id,
          ),
        }));
      }

      return {
        tickets,
        statusCount,
        categoryCount: categoryCountResult,
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

  updateTicketStatus: async (
    ticket_id,
    status,
    closed_at,
    updated_at,
    ra_id,
  ) => {
    try {
      const [isExists] = await pool.query(
        `SELECT ticket_id FROM tickets WHERE ticket_id = ?`,
        [ticket_id],
      );

      if (isExists.length <= 0) throw new Error("Invalid ticket Id");

      let affectedRows = 0;

      if (ra_id) {
        const [updateResult] = await pool.query(
          `UPDATE tickets SET ra_id = ?, status = ?, updated_at = ? WHERE ticket_id = ?`,
          [ra_id, status, updated_at, ticket_id],
        );

        affectedRows += updateResult.affectedRows;
      } else {
        const [updateResult] = await pool.query(
          `UPDATE tickets SET status = ?, updated_at = ?, closed_at = ? WHERE ticket_id = ?`,
          [status, updated_at, closed_at, ticket_id],
        );

        affectedRows += updateResult.affectedRows;
      }

      return affectedRows;
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
    comments,
    created_date,
    updated_by,
  ) => {
    try {
      const insertQuery = `INSERT INTO ticket_track(
                              ticket_id,
                              assigned_to,
                              status,
                              details,
                              comments,
                              created_date,
                              update_by
                          )
                          VALUES(?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        ticket_id,
        assigned_to,
        status,
        details,
        comments,
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
            tt.comments,
            au.user_name AS assigned_to_name,
            au.user_id AS assigned_user_id,
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
