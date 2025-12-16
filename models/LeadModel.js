const pool = require("../config/dbconfig");
const moment = require("moment");

const LeadModel = {
  getLeadType: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM lead_type WHERE is_active = 1`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getStatus: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM lead_status WHERE is_active = 1`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getLeadAction: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM lead_action WHERE is_active = 1`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getResponseStatus: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM response_status WHERE is_active = 1`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBranches: async (region_id) => {
    try {
      let sql;
      const [getRegion] = await pool.query(
        `SELECT id, name FROM region WHERE id = ?`,
        [region_id]
      );
      if (getRegion[0].name === "Hub") {
        sql = `SELECT id, name FROM branches WHERE region_id = ? AND is_active = 1`;
      } else {
        sql = `SELECT id, name FROM branches WHERE is_active = 1 AND region_id = ? AND name <> 'Online' ORDER BY name ASC`;
      }
      const [result] = await pool.query(sql, [region_id]);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBatchTrack: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM batch_track WHERE is_active = 1`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertLead: async (
    user_id,
    name,
    phone_code,
    phone,
    whatsapp_phone_code,
    whatsapp,
    email,
    country,
    state,
    district,
    primary_course_id,
    primary_fees,
    price_category,
    secondary_course_id,
    secondary_fees,
    lead_type_id,
    lead_status_id,
    next_follow_up_date,
    expected_join_date,
    branch_id,
    batch_track_id,
    comments,
    created_date,
    region_id,
    is_manager
  ) => {
    try {
      if (is_manager === true) {
        const [isLeadExists] = await pool.query(
          `SELECT id FROM lead_master WHERE (phone = ? AND primary_course_id = ?) OR (email = ? AND primary_course_id = ?)`,
          [phone, primary_course_id, email, primary_course_id]
        );
        if (isLeadExists.length > 0)
          throw new Error(
            "The customer has already been registered with this email and mobile number."
          );
      } else {
        const [isLeadExists] = await pool.query(
          `SELECT id FROM lead_master WHERE phone = ? OR email = ?`,
          [phone, email]
        );
        if (isLeadExists.length > 0)
          throw new Error("The phone or email is already exists");
      }

      let affectedRows = 0;
      const insertQuery = `INSERT INTO lead_master(
                            user_id,
                            assigned_to,
                            name,
                            phone_code,
                            phone,
                            whatsapp_phone_code,
                            whatsapp,
                            email,
                            country,
                            state,
                            district,
                            primary_course_id,
                            primary_fees,
                            price_category,
                            secondary_course_id,
                            secondary_fees,
                            lead_type_id,
                            lead_status_id,
                            next_follow_up_date,
                            expected_join_date,
                            branch_id,
                            batch_track_id,
                            comments,
                            created_date,
                            region_id
                        )
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      const values = [
        user_id,
        user_id,
        name,
        phone_code,
        phone,
        whatsapp_phone_code,
        whatsapp,
        email,
        country,
        state,
        district,
        primary_course_id,
        primary_fees,
        price_category,
        secondary_course_id,
        secondary_fees,
        lead_type_id,
        lead_status_id,
        next_follow_up_date,
        expected_join_date,
        branch_id,
        batch_track_id,
        comments,
        created_date,
        region_id,
      ];

      // Insert into lead master table
      const [result] = await pool.query(insertQuery, values);

      affectedRows += result.affectedRows;

      if (result.affectedRows <= 0)
        throw new Error("Error while inserting lead");

      if (next_follow_up_date) {
        // Get lead action list
        const [getLeadAction] = await pool.query(
          `SELECT id, name FROM lead_action WHERE name = 'Follow Up' AND is_active = 1`
        );
        // Insert lead follow up history
        const [history] = await pool.query(
          `INSERT INTO lead_follow_up_history(
            lead_id,
            lead_action_id,
            comments,
            updated_by,
            updated_date,
            is_updated
        )
        VALUES(?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            getLeadAction[0].id,
            comments,
            user_id,
            created_date,
            1,
          ]
        );

        affectedRows += history.affectedRows;

        const [next_follow_up] = await pool.query(
          `INSERT INTO lead_follow_up_history(
            lead_id,
            next_follow_up_date,
            lead_action_id
        )
        VALUES(?, ?, ?)`,
          [result.insertId, next_follow_up_date, getLeadAction[0].id]
        );

        affectedRows += next_follow_up.affectedRows;
      }
      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getLeads: async (
    name,
    email,
    phone,
    start_date,
    end_date,
    lead_status_id,
    user_ids,
    page,
    limit,
    course
  ) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                        ROW_NUMBER() OVER (ORDER BY l.created_date DESC) AS row_num,
                        l.id,
                        l.user_id,
                        u.user_name,
                        l.assigned_to AS lead_assigned_to_id,
                        au.user_name AS lead_assigned_to_name,
                        l.name,
                        l.phone_code,
                        l.phone,
                        l.whatsapp_phone_code,
                        l.whatsapp,
                        l.email,
                        l.country,
                        l.state,
                        l.district AS area_id,
                        a.name AS district,
                        l.primary_course_id,
                        pt.name AS primary_course,
                        l.primary_fees,
                        l.price_category,
                        l.secondary_course_id,
                        st.name AS secondary_course,
                        l.secondary_fees,
                        l.lead_type_id,
                        lt.name AS lead_type,
                        l.lead_status_id,
                        ls.name AS lead_status,
                        l.next_follow_up_date,
                        l.expected_join_date,
                        l.branch_id,
                        b.name AS branch_name,
                        l.batch_track_id,
                        bt.name AS batch_track,
                        l.comments,
                        l.created_date,
                        CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS is_customer_reg,
                        c.id AS customer_id,
                        r.name AS region_name,
                        r.id AS region_id,
                        lh.lead_history_id,
                        lh.lead_action_id,
                        lh.lead_action_name,
                        qm.cna_date AS quality_followup_date,
                        latest1.comments AS quality_recent_comment
                    FROM
                        lead_master AS l
                    LEFT JOIN users AS u ON u.user_id = l.user_id
                    LEFT JOIN users AS au ON au.user_id = l.assigned_to
                    LEFT JOIN technologies AS pt ON pt.id = l.primary_course_id
                    LEFT JOIN technologies AS st ON st.id = l.secondary_course_id
                    LEFT JOIN lead_type AS lt ON lt.id = l.lead_type_id
                    LEFT JOIN lead_status AS ls ON ls.id = l.lead_status_id
                    LEFT JOIN region AS r ON r.id = l.region_id
                    LEFT JOIN branches AS b ON b.id = l.branch_id
                    LEFT JOIN batch_track AS bt ON bt.id = l.batch_track_id
                    LEFT JOIN customers AS c ON c.lead_id = l.id
                    LEFT JOIN areas AS a ON a.id = l.district
                    LEFT JOIN (
                        SELECT 
                            lh1.lead_id,
                            lh1.id AS lead_history_id, 
                            lh1.lead_action_id, 
                            la.name AS lead_action_name 
                        FROM lead_follow_up_history AS lh1 
                        INNER JOIN (
                            SELECT lead_id, MAX(id) AS max_id
                            FROM lead_follow_up_history
                            GROUP BY lead_id
                        ) AS latest ON lh1.id = latest.max_id
                        LEFT JOIN lead_action AS la ON lh1.lead_action_id = la.id
                    ) AS lh ON lh.lead_id = l.id
                    LEFT JOIN (
                        SELECT q.id, q.lead_id, q.cna_date, q.comments FROM lead_master AS lm
                        INNER JOIN quality_master AS q ON
                          q.lead_id = lm.id
                        WHERE q.is_updated = 0
                    ) AS qm ON qm.lead_id = l.id
                    LEFT JOIN (
                      SELECT qm1.lead_id, qm1.comments FROM quality_master AS qm1
                      INNER JOIN (
                        SELECT lead_id, MAX(id) AS max_id FROM quality_master WHERE is_updated = 1 GROUP BY lead_id
                      ) AS latest ON qm1.id = latest.max_id
                    ) AS latest1 ON latest1.lead_id = l.id
                    WHERE 1 = 1`;

      const countQueryParams = [];
      let countQuery = `SELECT COUNT(*) as total FROM lead_master AS l INNER JOIN technologies AS pt ON pt.id = l.primary_course_id WHERE 1 = 1`;

      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          countQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
          countQueryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND l.assigned_to = ?`;
          countQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
          countQueryParams.push(user_ids);
        }
      }

      if (name) {
        getQuery += ` AND l.name LIKE '%${name}%'`;
        countQuery += ` AND l.name LIKE '%${name}%'`;
      }

      if (email) {
        getQuery += ` AND l.email LIKE '%${email}%'`;
        countQuery += ` AND l.email LIKE '%${email}%'`;
      }

      if (phone) {
        getQuery += ` AND l.phone LIKE '%${phone}%'`;
        countQuery += ` AND l.phone LIKE '%${phone}%'`;
      }

      if (course) {
        getQuery += ` AND pt.name LIKE '%${course}%'`;
        countQuery += ` AND pt.name LIKE '%${course}%'`;
      }

      if (lead_status_id) {
        getQuery += ` AND l.lead_status_id = ?`;
        countQuery += ` AND l.lead_status_id = ?`;
        queryParams.push(lead_status_id);
        countQueryParams.push(lead_status_id);
      }

      if (start_date && end_date) {
        getQuery += ` AND CAST(l.created_date AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`;
        countQuery += ` AND CAST(l.created_date AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`;
        queryParams.push(start_date, end_date);
        countQueryParams.push(start_date, end_date);
      }

      // Get total count
      const [countResult] = await pool.query(countQuery, countQueryParams);
      const total = countResult[0]?.total || 0;

      // Apply pagination to main query
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY l.created_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [result] = await pool.query(getQuery, queryParams);

      // Use Promise.all to wait for all async operations in the map
      const formattedResult = await Promise.all(
        result.map(async (item) => {
          const [history] = await pool.query(
            `SELECT lh.id, lh.lead_id, lh.comments, lh.updated_by, u.user_name, lh.updated_date, lh.lead_action_id, la.name AS lead_action_name 
           FROM lead_follow_up_history AS lh 
           LEFT JOIN users AS u ON lh.updated_by = u.user_id 
           LEFT JOIN lead_action AS la ON lh.lead_action_id = la.id 
           WHERE lh.is_updated = 1 AND lh.lead_id = ? 
           ORDER BY lh.id ASC`,
            [item.id]
          );

          const [qualityHistory] = await pool.query(
            `SELECT q.id, q.lead_id, q.comments, q.status, q.cna_date, q.updated_by, q.updated_date, u.user_name, q.created_date FROM quality_master AS q LEFT JOIN users AS u ON q.updated_by = u.user_id WHERE q.is_updated = 1 AND q.lead_id = ? ORDER BY q.id ASC`,
            [item.id]
          );
          return {
            ...item,
            histories: history,
            quality_history: qualityHistory,
          };
        })
      );

      return {
        data: formattedResult,
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

  getLeadFollowUps: async (
    user_ids,
    from_date,
    to_date,
    name,
    email,
    phone,
    page,
    limit,
    course
  ) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                    ROW_NUMBER() OVER (ORDER BY lf.next_follow_up_date ASC) AS row_num,
                    l.id,
                    lf.id AS lead_history_id,
                    l.user_id,
                    u.user_name,
                    l.assigned_to AS lead_assigned_to_id,
                    au.user_name AS lead_assigned_to_name,
                    l.name AS candidate_name,
                    l.phone_code,
                    l.phone,
                    l.whatsapp_phone_code,
                    l.whatsapp,
                    l.email,
                    l.country,
                    l.state,
                    l.district AS area_id,
                    a.name AS district,
                    l.primary_course_id,
                    pt.name AS primary_course,
                    l.primary_fees,
                    l.price_category,
                    l.secondary_course_id,
                    st.name AS secondary_course,
                    l.secondary_fees,
                    l.lead_type_id,
                    lt.name AS lead_type,
                    l.lead_status_id,
                    ls.name lead_status,
                    l.next_follow_up_date,
                    l.expected_join_date,
                    l.branch_id,
                    b.name AS branche_name,
                    l.batch_track_id,
                    bt.name AS batch_track,
                    l.comments,
                    l.created_date,
                    r.name AS region_name,
                    r.id AS region_id,
                    c.id AS customer_id
                FROM
                    lead_master AS l
                INNER JOIN lead_follow_up_history AS lf ON
                  l.id = lf.lead_id
                LEFT JOIN users AS u ON
                    u.user_id = l.user_id
                LEFT JOIN users AS au ON
                    au.user_id = l.assigned_to
                LEFT JOIN technologies AS pt ON
                    pt.id = l.primary_course_id
                LEFT JOIN technologies AS st ON
                    st.id = l.secondary_course_id
                LEFT JOIN lead_type AS lt ON
                    lt.id = l.lead_type_id
                LEFT JOIN lead_status AS ls ON
                    ls.id = l.lead_status_id
                LEFT JOIN region AS r ON
                  r.id = l.region_id
                LEFT JOIN branches AS b ON
                    b.id = l.branch_id
                LEFT JOIN batch_track AS bt ON
                    bt.id = l.batch_track_id
                LEFT JOIN areas AS a ON
                    a.id = l.district
                LEFT JOIN customers AS c ON
                    c.lead_id = l.id
                WHERE
                    lf.is_updated = 0 AND c.id IS NULL `;

      const countQueryParams = [];
      let countQuery = `SELECT COUNT(DISTINCT l.id) as total 
                      FROM lead_master AS l
                      INNER JOIN technologies AS pt ON pt.id = l.primary_course_id
                      INNER JOIN lead_follow_up_history AS lf ON l.id = lf.lead_id
                      LEFT JOIN customers AS c ON c.lead_id = l.id
                      WHERE lf.is_updated = 0 AND c.id IS NULL `;

      if (from_date && to_date) {
        getQuery += ` AND DATE(lf.next_follow_up_date) BETWEEN ? AND ?`;
        countQuery += ` AND DATE(lf.next_follow_up_date) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
        countQueryParams.push(from_date, to_date);
      }

      // FIXED: Use parameterized queries for LIKE conditions in both queries
      if (name) {
        getQuery += ` AND l.name LIKE ?`;
        countQuery += ` AND l.name LIKE ?`;
        queryParams.push(`%${name}%`);
        countQueryParams.push(`%${name}%`);
      }

      if (course) {
        getQuery += ` AND pt.name LIKE ?`;
        countQuery += ` AND pt.name LIKE ?`;
        queryParams.push(`%${course}%`);
        countQueryParams.push(`%${course}%`);
      }

      if (email) {
        getQuery += ` AND l.email LIKE ?`;
        countQuery += ` AND l.email LIKE ?`;
        queryParams.push(`%${email}%`);
        countQueryParams.push(`%${email}%`);
      }

      if (phone) {
        getQuery += ` AND l.phone LIKE ?`;
        countQuery += ` AND l.phone LIKE ?`;
        queryParams.push(`%${phone}%`);
        countQueryParams.push(`%${phone}%`);
      }

      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          countQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
          countQueryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND l.assigned_to = ?`;
          countQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
          countQueryParams.push(user_ids);
        }
      }

      // Get total count
      const [countResult] = await pool.query(countQuery, countQueryParams);
      const total = countResult[0]?.total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY lf.next_follow_up_date ASC`;

      getQuery += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [follow_ups] = await pool.query(getQuery, queryParams);

      // Use Promise.all to wait for all async operations in the map
      const formattedResult = await Promise.all(
        follow_ups.map(async (item) => {
          const [history] = await pool.query(
            `SELECT lh.id, lh.lead_id, lh.comments, lh.updated_by, u.user_name, lh.updated_date, lh.lead_action_id, la.name AS lead_action_name 
           FROM lead_follow_up_history AS lh 
           LEFT JOIN users AS u ON lh.updated_by = u.user_id 
           LEFT JOIN lead_action AS la ON lh.lead_action_id = la.id 
           WHERE lh.is_updated = 1 AND lh.lead_id = ? 
           ORDER BY lh.id ASC`,
            [item.id]
          );

          const [qualityHistory] = await pool.query(
            `SELECT q.id, q.lead_id, q.comments, q.status, q.cna_date, q.updated_by, q.updated_date, u.user_name, q.created_date FROM quality_master AS q LEFT JOIN users AS u ON q.updated_by = u.user_id WHERE q.is_updated = 1 AND q.lead_id = ? ORDER BY q.id ASC`,
            [item.id]
          );
          return {
            ...item,
            histories: history,
            quality_history: qualityHistory,
          };
        })
      );

      return {
        data: formattedResult,
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

  updateFollowUp: async (
    lead_history_id,
    comments,
    next_follow_up_date,
    lead_action_id,
    lead_id,
    updated_by,
    updated_date
  ) => {
    try {
      let affectedRows = 0;

      const updateQuery = `UPDATE lead_follow_up_history SET comments = ?, updated_by = ?, updated_date = ?, is_updated = 1 WHERE id = ?`;
      const values = [comments, updated_by, updated_date, lead_history_id];
      const [update_lead] = await pool.query(updateQuery, values);

      affectedRows += update_lead.affectedRows;

      if (next_follow_up_date) {
        const insertQuery = `INSERT INTO lead_follow_up_history (lead_id, next_follow_up_date, lead_action_id) VALUES (?, ?, ?)`;
        const [insert_follow_up] = await pool.query(insertQuery, [
          lead_id,
          next_follow_up_date,
          lead_action_id,
        ]);
        affectedRows += insert_follow_up.affectedRows;

        const [update_lead_master] = await pool.query(
          `UPDATE lead_master SET next_follow_up_date = ?, comments = ? WHERE id = ?`,
          [next_follow_up_date, comments, lead_id]
        );

        affectedRows += update_lead_master.affectedRows;
      } else {
        const [get_lead_status] = await pool.query(
          `SELECT id, name FROM lead_status WHERE name = 'Junk'`
        );

        const [updateFollowUp] = await pool.query(
          `INSERT INTO lead_follow_up_history (lead_id, lead_action_id, comments, updated_by, updated_date, is_updated) VALUES (?, ?, ?, ?, ?, ?)`,
          [lead_id, lead_action_id, comments, updated_by, updated_date, 1]
        );

        affectedRows += updateFollowUp.affectedRows;

        const [update_lead_master] = await pool.query(
          `UPDATE lead_master SET lead_status_id = ?, comments = ? WHERE id = ?`,
          [get_lead_status[0].id, comments, lead_id]
        );

        affectedRows += update_lead_master.affectedRows;
      }
      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateLead: async (
    name,
    phone_code,
    phone,
    whatsapp_phone_code,
    whatsapp,
    email,
    country,
    state,
    district,
    primary_course_id,
    primary_fees,
    price_category,
    secondary_course_id,
    secondary_fees,
    lead_type_id,
    lead_status_id,
    next_follow_up_date,
    expected_join_date,
    branch_id,
    batch_track_id,
    comments,
    lead_id,
    region_id
  ) => {
    try {
      const [isLeadExists] = await pool.query(
        `SELECT id FROM lead_master WHERE id = ?`,
        [lead_id]
      );
      if (isLeadExists.length <= 0) throw new Error("Invalid lead Id");
      const updateQuery = `UPDATE
                              lead_master
                          SET
                              name = ?,
                              phone_code = ?,
                              phone = ?,
                              whatsapp_phone_code = ?,
                              whatsapp = ?,
                              email = ?,
                              country = ?,
                              state = ?,
                              district = ?,
                              primary_course_id = ?,
                              primary_fees = ?,
                              price_category = ?,
                              secondary_course_id = ?,
                              secondary_fees = ?,
                              lead_type_id = ?,
                              lead_status_id = ?,
                              next_follow_up_date = ?,
                              expected_join_date = ?,
                              branch_id = ?,
                              batch_track_id = ?,
                              comments = ?,
                              region_id = ?
                          WHERE
                              id = ?`;
      const values = [
        name,
        phone_code,
        phone,
        whatsapp_phone_code,
        whatsapp,
        email,
        country,
        state,
        district,
        primary_course_id,
        primary_fees,
        price_category,
        secondary_course_id,
        secondary_fees,
        lead_type_id,
        lead_status_id,
        next_follow_up_date,
        expected_join_date,
        branch_id,
        batch_track_id,
        comments,
        region_id,
        lead_id,
      ];

      // Update lead
      const [updateLead] = await pool.query(updateQuery, values);
      if (updateLead.affectedRows <= 0)
        throw new Error("Error while updating lead");

      // Get first lead history Id
      const [lead_history_id] = await pool.query(
        `SELECT id AS lead_history_id FROM lead_follow_up_history WHERE lead_id = ? ORDER BY id ASC LIMIT 1`,
        [lead_id]
      );

      // Update lead history
      const [update_lead_history] = await pool.query(
        `UPDATE lead_follow_up_history SET comments = ? WHERE id = ?`,
        [comments, lead_history_id[0].lead_history_id]
      );

      return update_lead_history.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getLeadCount: async (user_ids, start_date, end_date) => {
    try {
      const followUpParams = [];
      const leadParams = [];
      const webParams = [];
      const junkParams = [];
      let followUpQuery = `SELECT COUNT(lf.id) AS follow_up_count FROM lead_follow_up_history AS lf INNER JOIN lead_master AS l ON lf.lead_id = l.id LEFT JOIN customers AS c ON c.lead_id = l.id WHERE lf.is_updated = 0 AND c.id IS NULL`;

      let leadCountQuery = `SELECT COUNT(*) AS total_lead_count FROM lead_master AS l WHERE 1 = 1`;

      let webLeadsCount = `SELECT COUNT(*) AS web_lead_count FROM website_leads WHERE is_junk = 0 AND is_deleted = 0 AND assigned_to IS NULL`;

      let junkQuery = `SELECT COUNT(*) AS junk_lead_count FROM website_leads WHERE is_junk = 1 AND is_deleted = 0`;

      if (start_date && end_date) {
        followUpQuery += ` AND CAST(lf.next_follow_up_date AS DATE) BETWEEN ? AND ?`;
        leadCountQuery += ` AND CAST(l.created_date AS DATE) BETWEEN ? AND ?`;
        webLeadsCount += ` AND CAST(created_date AS DATE) BETWEEN ? AND ?`;
        junkQuery += ` AND CAST(created_date AS DATE) BETWEEN ? AND ?`;
        followUpParams.push(start_date, end_date);
        leadParams.push(start_date, end_date);
        webParams.push(start_date, end_date);
        junkParams.push(start_date, end_date);
      }

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          followUpQuery += ` AND l.assigned_to IN (${placeholders})`;
          leadCountQuery += ` AND l.assigned_to IN (${placeholders})`;
          followUpParams.push(...user_ids);
          leadParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          followUpQuery += ` AND l.assigned_to = ?`;
          leadCountQuery += ` AND l.assigned_to = ?`;
          followUpParams.push(user_ids);
          leadParams.push(user_ids);
        }
      }

      const [getFollowupCount] = await pool.query(
        followUpQuery,
        followUpParams
      );

      const [getLeadCount] = await pool.query(leadCountQuery, leadParams);

      const [webResult] = await pool.query(webLeadsCount, webParams);

      const [junkResult] = await pool.query(junkQuery, junkParams);
      return {
        follow_up_count: getFollowupCount[0].follow_up_count,
        total_lead_count: getLeadCount[0].total_lead_count,
        web_lead_count: webResult[0].web_lead_count,
        junk_lead_count: junkResult[0].junk_lead_count,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRegion: async () => {
    try {
      const [region] = await pool.query(
        `SELECT id, name FROM region WHERE is_active = 1`
      );
      return region;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getAreas: async () => {
    try {
      const [areas] = await pool.query(
        `SELECT id, name FROM areas WHERE is_active = 1`
      );
      return areas;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertArea: async (area_name) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM areas WHERE name = ? AND is_active = 1`,
        [area_name]
      );

      if (isExists.length > 0) throw new Error("Area already exists.");

      const [result] = await pool.query(`INSERT INTO areas(name) VALUES (?)`, [
        area_name,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  assignLead: async (leads) => {
    try {
      let affectedRows = 0;
      for (const lead of leads) {
        const [result] = await pool.query(
          "UPDATE lead_master SET assigned_to = ? WHERE id = ?",
          [lead.assigned_to, lead.id]
        );

        affectedRows += result.affectedRows;
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  checkEmailMblExists: async (email, mobile) => {
    try {
      if (email) {
        const [isEmailExists] = await pool.query(
          `SELECT id FROM lead_master WHERE email = ?`,
          [email]
        );
        return isEmailExists.length > 0 ? true : false;
      }

      if (mobile) {
        const [isPhoneExists] = await pool.query(
          `SELECT id FROM lead_master WHERE phone = ?`,
          [mobile]
        );
        return isPhoneExists.length > 0 ? true : false;
      }
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getLeadCountByUser: async (user_ids, start_date, end_date) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT u.user_id, u.user_name, COUNT(lm.id) AS lead_count FROM users AS u LEFT JOIN lead_master AS lm ON lm.assigned_to = u.user_id`;

      if (start_date && end_date) {
        getQuery += ` AND CAST(lm.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` WHERE u.user_id IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` WHERE u.user_id = ?`;
          queryParams.push(user_ids);
        }
      }

      getQuery += ` GROUP BY u.user_id, u.user_name ORDER BY u.user_name`;

      const [result] = await pool.query(getQuery, queryParams);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getFollowupCountByUser: async (user_ids, start_date, end_date) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT COUNT(lf.id) AS follow_up_count, u.user_id, u.user_name FROM users AS u LEFT JOIN lead_master AS lm ON lm.assigned_to = u.user_id LEFT JOIN lead_follow_up_history AS lf ON lf.lead_id = lm.id AND lf.is_updated = 0`;

      if (start_date && end_date) {
        getQuery += ` AND CAST(lf.next_follow_up_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }

      getQuery += ` LEFT JOIN customers AS c ON c.lead_id = lm.id WHERE c.id IS NULL`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND u.user_id IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND u.user_id = ?`;
          queryParams.push(user_ids);
        }
      }

      getQuery += ` GROUP BY u.user_id, u.user_name ORDER BY u.user_name`;

      const [result] = await pool.query(getQuery, queryParams);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  websiteLead: async (
    name,
    phone,
    email,
    course,
    comments,
    location,
    training,
    domain_origin,
    corporate_training
  ) => {
    try {
      const [isExists] = await pool.query(
        `SELECT COUNT(*) AS lead_count FROM website_leads WHERE (email COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%') OR phone COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%'))`,
        [email, phone]
      );

      let leadType = isExists[0].lead_count > 0 ? "Existing" : "New";

      const insertQuery = `INSERT INTO website_leads(
                              name,
                              phone,
                              email,
                              course,
                              comments,
                              location,
                              training,
                              corporate_training,
                              status,
                              domain_origin,
                              lead_type
                          )
                          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        name,
        phone,
        email,
        course,
        comments,
        location,
        training,
        corporate_training,
        "Pending",
        domain_origin,
        leadType,
      ];

      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getAllBranches: async () => {
    try {
      const getQuery = `SELECT id, name, region_id FROM branches WHERE name <> 'Online'
                        UNION
                        SELECT b.id, b.name, b.region_id FROM branches AS b INNER JOIN region AS r ON b.region_id = r.id WHERE r.name = 'Hub' ORDER BY region_id, name ASC;`;
      const [result] = await pool.query(getQuery);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  downloadLeads: async (
    name,
    email,
    phone,
    start_date,
    end_date,
    lead_status_id,
    user_ids,
    course
  ) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                        l.id,
                        l.user_id,
                        u.user_name,
                        l.assigned_to AS lead_assigned_to_id,
                        au.user_name AS lead_assigned_to_name,
                        l.name,
                        l.phone_code,
                        l.phone,
                        l.whatsapp_phone_code,
                        l.whatsapp,
                        l.email,
                        l.country,
                        l.state,
                        l.district AS area_id,
                        a.name AS district,
                        l.primary_course_id,
                        pt.name AS primary_course,
                        l.primary_fees,
                        l.price_category,
                        l.secondary_course_id,
                        st.name AS secondary_course,
                        l.secondary_fees,
                        l.lead_type_id,
                        lt.name AS lead_type,
                        l.lead_status_id,
                        ls.name AS lead_status,
                        l.next_follow_up_date,
                        l.expected_join_date,
                        l.branch_id,
                        b.name AS branch_name,
                        l.batch_track_id,
                        bt.name AS batch_track,
                        l.comments,
                        l.created_date,
                        CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS is_customer_reg,
                        c.id AS customer_id,
                        r.name AS region_name,
                        r.id AS region_id,
                        lh.lead_history_id,
                        lh.lead_action_id,
                        lh.lead_action_name
                    FROM
                        lead_master AS l
                    LEFT JOIN users AS u ON u.user_id = l.user_id
                    LEFT JOIN users AS au ON au.user_id = l.assigned_to
                    LEFT JOIN technologies AS pt ON pt.id = l.primary_course_id
                    LEFT JOIN technologies AS st ON st.id = l.secondary_course_id
                    LEFT JOIN lead_type AS lt ON lt.id = l.lead_type_id
                    LEFT JOIN lead_status AS ls ON ls.id = l.lead_status_id
                    LEFT JOIN region AS r ON r.id = l.region_id
                    LEFT JOIN branches AS b ON b.id = l.branch_id
                    LEFT JOIN batch_track AS bt ON bt.id = l.batch_track_id
                    LEFT JOIN customers AS c ON c.lead_id = l.id
                    LEFT JOIN areas AS a ON a.id = l.district
                    LEFT JOIN (
                        SELECT 
                            lh1.lead_id,
                            lh1.id AS lead_history_id, 
                            lh1.lead_action_id, 
                            la.name AS lead_action_name 
                        FROM lead_follow_up_history AS lh1 
                        INNER JOIN (
                            SELECT lead_id, MAX(id) AS max_id
                            FROM lead_follow_up_history
                            GROUP BY lead_id
                        ) AS latest ON lh1.id = latest.max_id
                        LEFT JOIN lead_action AS la ON lh1.lead_action_id = la.id
                    ) AS lh ON lh.lead_id = l.id
                    WHERE 1 = 1`;

      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
        }
      }

      if (name) {
        getQuery += ` AND l.name LIKE '%${name}%'`;
      }

      if (course) {
        getQuery += ` AND pt.name LIKE '%${course}%'`;
      }

      if (email) {
        getQuery += ` AND l.email LIKE '%${email}%'`;
      }

      if (phone) {
        getQuery += ` AND l.phone LIKE '%${phone}%'`;
      }

      if (lead_status_id) {
        getQuery += ` AND l.lead_status_id = ?`;
        queryParams.push(lead_status_id);
      }

      if (start_date && end_date) {
        getQuery += ` AND CAST(l.created_date AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`;
        queryParams.push(start_date, end_date);
      }

      getQuery += ` ORDER BY l.created_date DESC`;

      const [result] = await pool.query(getQuery, queryParams);

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  downloadLeadFollowUps: async (
    user_ids,
    from_date,
    to_date,
    name,
    email,
    phone,
    course
  ) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                    l.id,
                    lf.id AS lead_history_id,
                    l.user_id,
                    u.user_name,
                    l.assigned_to AS lead_assigned_to_id,
                    au.user_name AS lead_assigned_to_name,
                    l.name AS candidate_name,
                    l.phone_code,
                    l.phone,
                    l.whatsapp_phone_code,
                    l.whatsapp,
                    l.email,
                    l.country,
                    l.state,
                    l.district AS area_id,
                    a.name AS district,
                    l.primary_course_id,
                    pt.name AS primary_course,
                    l.primary_fees,
                    l.price_category,
                    l.secondary_course_id,
                    st.name AS secondary_course,
                    l.secondary_fees,
                    l.lead_type_id,
                    lt.name AS lead_type,
                    l.lead_status_id,
                    ls.name lead_status,
                    l.next_follow_up_date,
                    l.expected_join_date,
                    l.branch_id,
                    b.name AS branche_name,
                    l.batch_track_id,
                    bt.name AS batch_track,
                    l.comments,
                    l.created_date,
                    r.name AS region_name,
                    r.id AS region_id,
                    c.id AS customer_id
                FROM
                    lead_master AS l
                INNER JOIN lead_follow_up_history AS lf ON
                  l.id = lf.lead_id
                LEFT JOIN users AS u ON
                    u.user_id = l.user_id
                LEFT JOIN users AS au ON
                    au.user_id = l.assigned_to
                LEFT JOIN technologies AS pt ON
                    pt.id = l.primary_course_id
                LEFT JOIN technologies AS st ON
                    st.id = l.secondary_course_id
                LEFT JOIN lead_type AS lt ON
                    lt.id = l.lead_type_id
                LEFT JOIN lead_status AS ls ON
                    ls.id = l.lead_status_id
                LEFT JOIN region AS r ON
                  r.id = l.region_id
                LEFT JOIN branches AS b ON
                    b.id = l.branch_id
                LEFT JOIN batch_track AS bt ON
                    bt.id = l.batch_track_id
                LEFT JOIN areas AS a ON
                    a.id = l.district
                LEFT JOIN customers AS c ON
                    c.lead_id = l.id
                WHERE
                    lf.is_updated = 0 AND c.id IS NULL `;

      if (from_date && to_date) {
        getQuery += ` AND DATE(lf.next_follow_up_date) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
      }

      // FIXED: Use parameterized queries for LIKE conditions in both queries
      if (name) {
        getQuery += ` AND l.name LIKE ?`;
        queryParams.push(`%${name}%`);
      }

      if (course) {
        getQuery += ` AND pt.name LIKE ?`;
        queryParams.push(`%${course}%`);
      }

      if (email) {
        getQuery += ` AND l.email LIKE ?`;
        queryParams.push(`%${email}%`);
      }

      if (phone) {
        getQuery += ` AND l.phone LIKE ?`;
        queryParams.push(`%${phone}%`);
      }

      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
        }
      }

      getQuery += ` ORDER BY lf.next_follow_up_date ASC`;

      const [follow_ups] = await pool.query(getQuery, queryParams);

      // Use Promise.all to wait for all async operations in the map
      const formattedResult = await Promise.all(
        follow_ups.map(async (item) => {
          const [history] = await pool.query(
            `SELECT lh.id, lh.lead_id, lh.comments, lh.updated_by, u.user_name, lh.updated_date, lh.lead_action_id, la.name AS lead_action_name 
           FROM lead_follow_up_history AS lh 
           LEFT JOIN users AS u ON lh.updated_by = u.user_id 
           LEFT JOIN lead_action AS la ON lh.lead_action_id = la.id 
           WHERE lh.is_updated = 1 AND lh.lead_id = ? 
           ORDER BY lh.id ASC`,
            [item.id]
          );
          return {
            ...item,
            histories: history,
          };
        })
      );

      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  globalFilter: async (filter) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                        l.id,
                        l.user_id,
                        u.user_name,
                        l.assigned_to AS lead_assigned_to_id,
                        au.user_name AS lead_assigned_to_name,
                        l.name,
                        l.phone_code,
                        l.phone,
                        l.whatsapp_phone_code,
                        l.whatsapp,
                        l.email,
                        l.country,
                        l.state,
                        l.district AS area_id,
                        a.name AS district,
                        l.primary_course_id,
                        pt.name AS primary_course,
                        l.primary_fees,
                        l.price_category,
                        l.secondary_course_id,
                        st.name AS secondary_course,
                        l.secondary_fees,
                        l.lead_type_id,
                        lt.name AS lead_type,
                        l.lead_status_id,
                        ls.name AS lead_status,
                        l.next_follow_up_date,
                        l.expected_join_date,
                        l.branch_id,
                        b.name AS branch_name,
                        l.batch_track_id,
                        bt.name AS batch_track,
                        l.comments,
                        l.created_date,
                        CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS is_customer_reg,
                        c.id AS customer_id,
                        r.name AS region_name,
                        r.id AS region_id,
                        lh.lead_history_id,
                        lh.lead_action_id,
                        lh.lead_action_name
                    FROM
                        lead_master AS l
                    LEFT JOIN users AS u ON u.user_id = l.user_id
                    LEFT JOIN users AS au ON au.user_id = l.assigned_to
                    LEFT JOIN technologies AS pt ON pt.id = l.primary_course_id
                    LEFT JOIN technologies AS st ON st.id = l.secondary_course_id
                    LEFT JOIN lead_type AS lt ON lt.id = l.lead_type_id
                    LEFT JOIN lead_status AS ls ON ls.id = l.lead_status_id
                    LEFT JOIN region AS r ON r.id = l.region_id
                    LEFT JOIN branches AS b ON b.id = l.branch_id
                    LEFT JOIN batch_track AS bt ON bt.id = l.batch_track_id
                    LEFT JOIN customers AS c ON c.lead_id = l.id
                    LEFT JOIN areas AS a ON a.id = l.district
                    LEFT JOIN (
                        SELECT 
                            lh1.lead_id,
                            lh1.id AS lead_history_id, 
                            lh1.lead_action_id, 
                            la.name AS lead_action_name 
                        FROM lead_follow_up_history AS lh1 
                        INNER JOIN (
                            SELECT lead_id, MAX(id) AS max_id
                            FROM lead_follow_up_history
                            GROUP BY lead_id
                        ) AS latest ON lh1.id = latest.max_id
                        LEFT JOIN lead_action AS la ON lh1.lead_action_id = la.id
                    ) AS lh ON lh.lead_id = l.id
                    WHERE 1 = 1`;

      if (filter && filter.trim() !== "") {
        getQuery += `
                  AND (
                        l.name  COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%')
                    OR l.phone COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%')
                    OR l.email COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%')
                  )
                `;

        queryParams.push(filter, filter, filter);
      }

      const [result] = await pool.query(getQuery, queryParams);

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateQuality: async (
    id,
    lead_id,
    comments,
    status,
    cna_date,
    updated_by,
    updated_date
  ) => {
    try {
      let affectedRows = 0;
      if (id) {
        const [updateComment] = await pool.query(
          `UPDATE quality_master SET comments = ?, status = ?, updated_by = ?, updated_date = ?, is_updated = 1 WHERE id = ?`,
          [comments, status, updated_by, updated_date, id]
        );

        affectedRows += updateComment.affectedRows;

        if (cna_date) {
          const [insertComment] = await pool.query(
            `INSERT INTO quality_master(lead_id, cna_date, updated_by) VALUES(?, ?, ?)`,
            [lead_id, cna_date, updated_by]
          );

          affectedRows += insertComment.affectedRows;
        }
      } else {
        const [insertComment] = await pool.query(
          `INSERT INTO quality_master(lead_id, comments, status, updated_by, updated_date, is_updated) VALUES(?, ?, ?, ?, ?, 1)`,
          [lead_id, comments, status, updated_by]
        );

        affectedRows += insertComment.affectedRows;

        if (cna_date) {
          const [insertNextFollowup] = await pool.query(
            `INSERT INTO quality_master(lead_id, cna_date, updated_by) VALUES(?, ?, ?)`,
            [lead_id, cna_date, updated_by]
          );

          affectedRows += insertNextFollowup.affectedRows;
        }
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  qualityLeadFollowUps: async (
    user_ids,
    from_date,
    to_date,
    name,
    email,
    phone,
    page,
    limit,
    course
  ) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                          l.id,
                          qm.id AS quality_id,
                          l.user_id,
                          u.user_name,
                          l.assigned_to AS lead_assigned_to_id,
                          au.user_name AS lead_assigned_to_name,
                          l.name AS candidate_name,
                          l.phone_code,
                          l.phone,
                          l.whatsapp_phone_code,
                          l.whatsapp,
                          l.email,
                          l.country,
                          l.state,
                          l.district AS area_id,
                          a.name AS district,
                          l.primary_course_id,
                          pt.name AS primary_course,
                          l.primary_fees,
                          l.price_category,
                          l.secondary_course_id,
                          st.name AS secondary_course,
                          l.secondary_fees,
                          l.lead_type_id,
                          lt.name AS lead_type,
                          l.lead_status_id,
                          ls.name lead_status,
                          qm.cna_date,
                          l.next_follow_up_date,
                          l.expected_join_date,
                          l.branch_id,
                          b.name AS branche_name,
                          l.batch_track_id,
                          bt.name AS batch_track,
                          latest1.comments,
                          l.created_date,
                          r.name AS region_name,
                          r.id AS region_id,
                          c.id AS customer_id
                      FROM
                          lead_master AS l
                      INNER JOIN (
                        SELECT q.id, q.lead_id, q.cna_date, q.comments FROM lead_master AS lm
                          INNER JOIN quality_master AS q ON
                            q.lead_id = lm.id
                          WHERE q.is_updated = 0
                      ) AS qm ON qm.lead_id = l.id
                      LEFT JOIN (
                        SELECT qm1.lead_id, qm1.comments FROM quality_master AS qm1
                          INNER JOIN (
                            SELECT lead_id, MAX(id) AS max_id FROM quality_master WHERE is_updated = 1 GROUP BY lead_id
                          ) AS latest ON qm1.id = latest.max_id
                      ) AS latest1 ON latest1.lead_id = l.id
                      LEFT JOIN users AS u ON
                          u.user_id = l.user_id
                      LEFT JOIN users AS au ON
                          au.user_id = l.assigned_to
                      LEFT JOIN technologies AS pt ON
                          pt.id = l.primary_course_id
                      LEFT JOIN technologies AS st ON
                          st.id = l.secondary_course_id
                      LEFT JOIN lead_type AS lt ON
                          lt.id = l.lead_type_id
                      LEFT JOIN lead_status AS ls ON
                          ls.id = l.lead_status_id
                      LEFT JOIN region AS r ON
                        r.id = l.region_id
                      LEFT JOIN branches AS b ON
                          b.id = l.branch_id
                      LEFT JOIN batch_track AS bt ON
                          bt.id = l.batch_track_id
                      LEFT JOIN areas AS a ON
                          a.id = l.district
                      LEFT JOIN customers AS c ON
                          c.lead_id = l.id
                      WHERE c.id IS NULL`;

      const countQueryParams = [];
      let countQuery = `SELECT COUNT(DISTINCT qm.id) as total 
                      FROM quality_master AS qm
                      INNER JOIN lead_master AS l ON qm.lead_id = l.id
                      INNER JOIN technologies AS pt ON pt.id = l.primary_course_id
                      LEFT JOIN customers AS c ON c.lead_id = l.id
                      WHERE qm.is_updated = 0 AND c.id IS NULL `;

      if (from_date && to_date) {
        getQuery += ` AND DATE(qm.cna_date) BETWEEN ? AND ?`;
        countQuery += ` AND DATE(qm.cna_date) BETWEEN ? AND ?`;
        queryParams.push(from_date, to_date);
        countQueryParams.push(from_date, to_date);
      }

      // FIXED: Use parameterized queries for LIKE conditions in both queries
      if (name) {
        getQuery += ` AND l.name LIKE ?`;
        countQuery += ` AND l.name LIKE ?`;
        queryParams.push(`%${name}%`);
        countQueryParams.push(`%${name}%`);
      }

      if (course) {
        getQuery += ` AND pt.name LIKE ?`;
        countQuery += ` AND pt.name LIKE ?`;
        queryParams.push(`%${course}%`);
        countQueryParams.push(`%${course}%`);
      }

      if (email) {
        getQuery += ` AND l.email LIKE ?`;
        countQuery += ` AND l.email LIKE ?`;
        queryParams.push(`%${email}%`);
        countQueryParams.push(`%${email}%`);
      }

      if (phone) {
        getQuery += ` AND l.phone LIKE ?`;
        countQuery += ` AND l.phone LIKE ?`;
        queryParams.push(`%${phone}%`);
        countQueryParams.push(`%${phone}%`);
      }

      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          countQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
          countQueryParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          getQuery += ` AND l.assigned_to = ?`;
          countQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
          countQueryParams.push(user_ids);
        }
      }

      // Get total count
      const [countResult] = await pool.query(countQuery, countQueryParams);
      const total = countResult[0]?.total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY qm.cna_date ASC`;

      getQuery += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [follow_ups] = await pool.query(getQuery, queryParams);

      // Use Promise.all to wait for all async operations in the map
      const formattedResult = await Promise.all(
        follow_ups.map(async (item) => {
          const [history] = await pool.query(
            `SELECT lh.id, lh.lead_id, lh.comments, lh.updated_by, u.user_name, lh.updated_date, lh.lead_action_id, la.name AS lead_action_name 
           FROM lead_follow_up_history AS lh 
           LEFT JOIN users AS u ON lh.updated_by = u.user_id 
           LEFT JOIN lead_action AS la ON lh.lead_action_id = la.id 
           WHERE lh.is_updated = 1 AND lh.lead_id = ? 
           ORDER BY lh.id ASC`,
            [item.id]
          );

          const [qualityHistory] = await pool.query(
            `SELECT q.id, q.lead_id, q.comments, q.status, q.cna_date, q.updated_by, q.updated_date, u.user_name, q.created_date FROM quality_master AS q LEFT JOIN users AS u ON q.updated_by = u.user_id WHERE q.is_updated = 1 AND q.lead_id = ? ORDER BY q.id ASC`,
            [item.id]
          );
          return {
            ...item,
            histories: history,
            quality_history: qualityHistory,
          };
        })
      );

      return {
        data: formattedResult,
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

  updateQualityFollowup: async (
    lead_id,
    comments,
    status,
    cna_date,
    updated_by,
    updated_date
  ) => {
    try {
      let affectedRows = 0;
      const [checkLead] = await pool.query(
        `SELECT COUNT(id) AS total_count FROM quality_master WHERE is_updated = 0 AND lead_id = ?`,
        [lead_id]
      );

      if (checkLead[0].total_count > 0)
        throw new Error("Complete the previous pending follow-ups");

      const [getRecentID] = await pool.query(
        `SELECT id FROM quality_master WHERE lead_id = ? ORDER BY id	DESC LIMIT 1`,
        [lead_id]
      );

      if (getRecentID.length <= 0) throw new Error("Couldn't update follow-up");

      const [updateFollowUp] = await pool.query(
        `UPDATE quality_master SET comments = ?, status = ?, updated_by = ?, updated_date = ? WHERE id = ?`,
        [comments, status, updated_by, updated_date, getRecentID[0].id]
      );

      affectedRows += updateFollowUp.affectedRows;

      if (cna_date) {
        const [insertNextFollowup] = await pool.query(
          `INSERT INTO quality_master(lead_id, cna_date, updated_by) VALUES(?, ?, ?)`,
          [lead_id, cna_date, updated_by]
        );

        affectedRows += insertNextFollowup.affectedRows;
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getWebsiteLead: async (
    name,
    phone,
    email,
    course,
    start_date,
    end_date,
    region_type,
    page,
    limit
  ) => {
    try {
      const queryParams = [];
      const countParams = [];

      // MUST convert to IST for correct filtering
      const dateColumn = "CONVERT_TZ(created_date, '+00:00', '+05:30')";

      let baseCondition = `
      is_junk = 0 
      AND is_deleted = 0 
      AND (assigned_to IS NULL OR assigned_to = '')
    `;

      let getQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ${dateColumn} DESC) AS row_num,
        id, name, email, phone, course, comments, location, date, time,
        training, corporate_training, status, is_junk, is_deleted,
        ${dateColumn} AS created_date_ist,
        lead_type, assigned_to, domain_origin
      FROM website_leads
      WHERE ${baseCondition}
    `;

      let countQuery = `
      SELECT COUNT(*) AS total
      FROM website_leads
      WHERE ${baseCondition}
    `;

      const addCondition = (field, value) => {
        getQuery += ` AND ${field} LIKE ?`;
        countQuery += ` AND ${field} LIKE ?`;
        queryParams.push(`%${value}%`);
        countParams.push(`%${value}%`);
      };

      if (name) addCondition("name", name);
      if (email) addCondition("email", email);
      if (phone) addCondition("phone", phone);
      if (course) addCondition("course", course);

      if (start_date && end_date) {
        getQuery += ` AND CAST(${dateColumn} AS DATE) BETWEEN ? AND ?`;
        countQuery += ` AND CAST(${dateColumn} AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
      }

      let prefix;
      if (region_type) {
        const match = region_type.match(/^[A-Za-z]+/);
        prefix = match ? match[0] : "";
      }

      if (prefix !== "" && prefix === "HUB") {
        getQuery += ` AND training LIKE '%Online%'`;
        countQuery += ` AND training LIKE '%Online%'`;
      }

      if (prefix === "BNG" || prefix === "CHN") {
        getQuery += ` AND training LIKE '%Class%'`;
        countQuery += ` AND training LIKE '%Class%'`;
      }

      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY ${dateColumn} DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0]?.total || 0;

      const [rows] = await pool.query(getQuery, queryParams);

      // ❌ REMOVE extra conversion — already converted in MySQL
      const formattedData = rows.map((item) => ({
        ...item,
        created_date: item.created_date_ist,
      }));

      return {
        data: formattedData,
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

  updateJunkValue: async (lead_ids, is_junk, reason) => {
    try {
      // Build placeholders (?, ?, ?)
      const placeholders = lead_ids.map(() => "?").join(",");
      const [isExists] = await pool.query(
        `SELECT id FROM website_leads WHERE id IN (${placeholders})`,
        [...lead_ids]
      );

      if (isExists.length !== lead_ids.length) {
        const foundIds = isExists.map((r) => r.id);
        const missingIds = lead_ids.filter((id) => !foundIds.includes(id));
        throw new Error(`Invalid Id(s): ${missingIds.join(", ")}`);
      }

      const [result] = await pool.query(
        `UPDATE website_leads SET is_junk = ?, junk_reason = ? WHERE id IN (${placeholders})`,
        [is_junk, reason, ...lead_ids]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  moveToTrash: async (lead_ids) => {
    try {
      // Build placeholders (?, ?, ?)
      const placeholders = lead_ids.map(() => "?").join(",");
      const [isExists] = await pool.query(
        `SELECT id FROM website_leads WHERE id IN (${placeholders})`,
        [...lead_ids]
      );

      if (isExists.length !== lead_ids.length) {
        const foundIds = isExists.map((r) => r.id);
        const missingIds = lead_ids.filter((id) => !foundIds.includes(id));
        throw new Error(`Invalid Id(s): ${missingIds.join(", ")}`);
      }

      const [result] = await pool.query(
        `UPDATE website_leads SET is_deleted = 1 WHERE id IN (${placeholders})`,
        [...lead_ids]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // assignLiveLead: async (user_id, lead_id, is_assigned) => {
  //   try {
  //     let affectedRows = 0;
  //     const [isExists] = await pool.query(
  //       `SELECT id FROM website_leads WHERE id = ?`,
  //       [lead_id]
  //     );

  //     if (isExists.length <= 0) throw new Error("Invalid Id");

  //     if (is_assigned === true) {
  //       const [isAssigned] = await pool.query(
  //         `SELECT id FROM website_leads WHERE id = ? AND assigned_to IS NOT NULL`,
  //         [lead_id]
  //       );

  //       if (isAssigned.length > 0)
  //         throw new Error("The lead has already been chosen by someone.");

  //       const [result] = await pool.query(
  //         `UPDATE website_leads SET assigned_to = ? WHERE id = ?`,
  //         [user_id, lead_id]
  //       );

  //       affectedRows += result.affectedRows;
  //     } else {
  //       const [result] = await pool.query(
  //         `UPDATE website_leads SET assigned_to = NULL WHERE id = ?`,
  //         [lead_id]
  //       );

  //       affectedRows += result.affectedRows;
  //     }

  //     return affectedRows;
  //   } catch (error) {
  //     throw new Error(error.message);
  //   }
  // },

  assignLiveLead: async (user_id, lead_id, is_assigned) => {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Lock the row (only ONE user can read/modify)
      const [rows] = await conn.query(
        `SELECT assigned_to 
       FROM website_leads 
       WHERE id = ? 
       FOR UPDATE`,
        [lead_id]
      );

      if (rows.length === 0) {
        throw new Error("Invalid lead id");
      }

      const currentAssigned = rows[0].assigned_to;

      if (is_assigned === true) {
        if (currentAssigned !== null) {
          throw new Error("The lead has already been chosen by someone.");
        }

        // Assign
        const [result] = await conn.query(
          `UPDATE website_leads 
         SET assigned_to = ?
         WHERE id = ?`,
          [user_id, lead_id]
        );

        if (result.affectedRows === 0) {
          throw new Error("Failed to assign lead");
        }
      } else if (is_assigned === false) {
        // Unassign
        await conn.query(
          `UPDATE website_leads 
         SET assigned_to = NULL 
         WHERE id = ?`,
          [lead_id]
        );
      }

      await conn.commit();
      return { success: true };
    } catch (error) {
      await conn.rollback();
      throw new Error(error.message);
    } finally {
      conn.release();
    }
  },

  getJunkLeads: async (
    name,
    phone,
    email,
    course,
    start_date,
    end_date,
    page,
    limit
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      let getQuery = `SELECT ROW_NUMBER() OVER (ORDER BY created_date DESC) AS row_num, id, name, email, phone, course, comments, location, date, time, training, status, domain_origin, is_junk, junk_reason, is_deleted,  created_date, lead_type, assigned_to, domain_origin FROM website_leads WHERE is_junk = 1 AND is_deleted = 0`;

      let countQuery = `SELECT COUNT(*) AS total FROM website_leads WHERE is_junk = 1 AND is_deleted = 0`;

      if (name) {
        getQuery += ` AND name LIKE '%${name}%'`;
        countQuery += ` AND name LIKE '%${name}%'`;
      }

      if (email) {
        getQuery += ` AND email LIKE '%${email}%'`;
        countQuery += ` AND email LIKE '%${email}%'`;
      }

      if (phone) {
        getQuery += ` AND phone LIKE '%${phone}%'`;
        countQuery += ` AND phone LIKE '%${phone}%'`;
      }

      if (course) {
        getQuery += ` AND course LIKE '%${course}%'`;
        countQuery += ` AND course LIKE '%${course}%'`;
      }

      if (start_date && end_date) {
        getQuery += ` AND CAST(created_date AS DATE) BETWEEN ? AND ?`;
        countQuery += ` AND CAST(created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        countParams.push(start_date, end_date);
      }

      // Get total count
      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0]?.total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY created_date DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      const [result] = await pool.query(getQuery, queryParams);

      const formattedResult = result.map((item) => {
        const formatedDate = formatToBackendIST(item.created_date);

        return {
          ...item,
          created_date: formatedDate,
        };
      });

      return {
        data: formattedResult,
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

function formatToBackendIST(date) {
  const istDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const pad = (n) => String(n).padStart(2, "0");

  const year = istDate.getFullYear();
  const month = pad(istDate.getMonth() + 1);
  const day = pad(istDate.getDate());
  const hours = pad(istDate.getHours());
  const minutes = pad(istDate.getMinutes());
  const seconds = pad(istDate.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = LeadModel;
