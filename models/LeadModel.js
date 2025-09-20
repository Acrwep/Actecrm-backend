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
        sql = `(SELECT id, name FROM branches WHERE name <> 'Virtual')
                UNION
                (SELECT id, name FROM branches WHERE region_id = ?)
                ORDER BY name ASC;`;
      } else {
        sql = `SELECT id, name FROM branches WHERE is_active = 1 AND region_id = ? ORDER BY name ASC`;
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
  ) => {
    try {
      let affectedRows = 0;
      const insertQuery = `INSERT INTO lead_master(
                            user_id,
                            name,
                            phone_code,
                            phone,
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
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      const values = [
        user_id,
        name,
        phone_code,
        phone,
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
          [result.insertId, created_date, comments, user_id, created_date, 1]
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

  getLeads: async (name, start_date, end_date, lead_status_id) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT
                          l.id,
                          l.user_id,
                          u.user_name,
                          l.name,
                          l.phone_code,
                          l.phone,
                          l.whatsapp,
                          l.email,
                          l.country,
                          l.state,
                          l.district,
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
                          r.name AS region_name,
                          r.id AS region_id,
                          lh.lead_history_id,
                          lh.lead_action_id,
                          lh.lead_action_name
                      FROM
                          lead_master AS l
                      LEFT JOIN users AS u ON u.user_id = l.user_id
                      LEFT JOIN technologies AS pt ON pt.id = l.primary_course_id
                      LEFT JOIN technologies AS st ON st.id = l.secondary_course_id
                      LEFT JOIN lead_type AS lt ON lt.id = l.lead_type_id
                      LEFT JOIN lead_status AS ls ON ls.id = l.lead_status_id
                      LEFT JOIN region AS r ON r.id = l.region_id
                      LEFT JOIN branches AS b ON b.id = l.branch_id
                      LEFT JOIN batch_track AS bt ON bt.id = l.batch_track_id
                      LEFT JOIN customers AS c ON c.lead_id = l.id
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
      if (name) {
        getQuery += ` AND l.name LIKE '%${name}%'`;
      }

      if (lead_status_id) {
        getQuery += ` AND l.lead_status_id = ?`;
        queryParams.push(lead_status_id);
      }

      if (start_date && end_date) {
        getQuery += ` AND CAST(l.created_date AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`;
        queryParams.push(start_date, end_date);
      }

      getQuery += ` ORDER BY l.created_date ASC`;

      const [result] = await pool.query(getQuery, queryParams);

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getLeadFollowUps: async (date_type) => {
    try {
      let getQuery = `SELECT
                      l.id,
                      lf.id AS lead_history_id,
                      l.user_id,
                      u.user_name,
                      l.name AS candidate_name,
                      l.phone_code,
                      l.phone,
                      l.whatsapp,
                      l.email,
                      l.country,
                      l.state,
                      l.district,
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
                      r.id AS region_id
                  FROM
                      lead_master AS l
                  INNER JOIN lead_follow_up_history AS lf ON
                    l.id = lf.lead_id
                  LEFT JOIN users AS u ON
                      u.user_id = l.user_id
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
                  WHERE
                      lf.is_updated = 0 `;
      if (date_type === "Today") {
        getQuery += ` AND CAST(lf.next_follow_up_date AS DATE) = CURRENT_DATE`;
      } else if (date_type === "Carry Over") {
        getQuery += ` AND CAST(lf.next_follow_up_date AS DATE) < CURRENT_DATE`;
      }

      getQuery += ` ORDER BY lf.next_follow_up_date ASC`;

      const [follow_ups] = await pool.query(getQuery);

      // Use Promise.all to wait for all async operations in the map
      const formattedResult = await Promise.all(
        follow_ups.map(async (item) => {
          const [history] = await pool.query(
            `SELECT lh.id, lh.lead_id, lh.comments, lh.updated_by, u.user_name, lh.updated_date, lh.lead_action_id, la.name AS lead_action_name FROM lead_follow_up_history AS lh LEFT JOIN users AS u ON lh.updated_by = u.user_id LEFT JOIN lead_action AS la ON lh.lead_action_id = la.id WHERE lh.is_updated = 1 AND lh.lead_id = ? ORDER BY lh.id ASC`,
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
          `UPDATE lead_master SET next_follow_up_date = ? WHERE id = ?`,
          [next_follow_up_date, lead_id]
        );

        affectedRows += update_lead_master.affectedRows;
      } else {
        const [get_lead_status] = await pool.query(
          `SELECT id, name FROM lead_status WHERE name = 'Junk'`
        );

        const [updateFollowUp] = await pool.query(
          `INSERT INTO lead_follow_up_history (lead_id, lead_action_id, comments, updated_by, updated_date) VALUES (?, ?, ?, ?, ?)`,
          [lead_id, lead_action_id, comments, updated_by, updated_date]
        );

        affectedRows += updateFollowUp.affectedRows;

        const [update_lead_master] = await pool.query(
          `UPDATE lead_master SET lead_status_id = ? WHERE id = ?`,
          [get_lead_status[0].id, lead_id]
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

  getLeadCount: async () => {
    try {
      const currentDate = new Date();
      const formattedDate = moment(currentDate).format("YYYY-MM-DD");

      const [getFollowupCount] = await pool.query(
        `SELECT COUNT(id) AS follow_up_count FROM lead_follow_up_history WHERE CAST(next_follow_up_date AS DATE) = ? AND is_updated = 0`,
        formattedDate
      );

      const [getLeadCount] = await pool.query(
        `SELECT COUNT(*) AS total_lead_count FROM lead_master WHERE created_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND created_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
      );
      return {
        follow_up_count: getFollowupCount[0].follow_up_count,
        total_lead_count: getLeadCount[0].total_lead_count,
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

      console.log("length", isExists.length);

      if (isExists.length > 0)
        throw new Error("Area already exists in the database");

      const [result] = await pool.query(`INSERT INTO areas(name) VALUES (?)`, [
        area_name,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = LeadModel;
