const pool = require("../config/dbconfig");
const moment = require("moment");

const LeadModel = {
  getTrainingMode: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM training_mode WHERE is_active = 1`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getPriority: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM priority WHERE is_active = 1`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

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

  getBranches: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM branches WHERE is_active = 1`
      );
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
    training_mode_id,
    priority_id,
    lead_type_id,
    lead_status_id,
    response_status_id,
    next_follow_up_date,
    expected_join_date,
    lead_quality_rating,
    branch_id,
    batch_track_id,
    comments,
    created_date
  ) => {
    try {
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
                            training_mode_id,
                            priority_id,
                            lead_type_id,
                            lead_status_id,
                            response_status_id,
                            next_follow_up_date,
                            expected_join_date,
                            lead_quality_rating,
                            branch_id,
                            batch_track_id,
                            comments,
                            created_date
                        )
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
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
        training_mode_id,
        priority_id,
        lead_type_id,
        lead_status_id,
        response_status_id,
        next_follow_up_date,
        expected_join_date,
        lead_quality_rating,
        branch_id,
        batch_track_id,
        comments,
        created_date,
      ];

      // Insert into lead master table
      const [result] = await pool.query(insertQuery, values);

      if (result.affectedRows <= 0)
        throw new Error("Error while inserting lead");

      // Insert lead follow up history
      const [history] = await pool.query(
        `INSERT INTO lead_follow_up_history(
            lead_id,
            next_follow_up_date,
            comments,
            updated_by,
            updated_date,
            is_updated
        )
        VALUES(?, ?, ?, ?, ?, ?)`,
        [result.insertId, created_date, comments, user_id, created_date, 1]
      );

      const [next_follow_up] = await pool.query(
        `INSERT INTO lead_follow_up_history(
            lead_id,
            next_follow_up_date
        )
        VALUES(?, ?)`,
        [result.insertId, next_follow_up_date]
      );
      return next_follow_up.affectedRows;
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
                      l.training_mode_id,
                      tm.name AS training_mode,
                      l.priority_id,
                      p.name AS priority,
                      l.lead_type_id,
                      lt.name AS lead_type,
                      l.lead_status_id,
                      ls.name lead_status,
                      l.response_status_id,
                      rs.name AS response_status,
                      l.next_follow_up_date,
                      l.expected_join_date,
                      l.lead_quality_rating,
                      l.branch_id,
                      b.name AS branche_name,
                      l.batch_track_id,
                      bt.name AS batch_track,
                      l.comments,
                      l.created_date
                  FROM
                      lead_master AS l
                  LEFT JOIN users AS u ON
                    u.user_id = l.user_id
                  LEFT JOIN technologies AS pt ON
                    pt.id = l.primary_course_id
                  LEFT JOIN technologies AS st ON
                    st.id = l.secondary_course_id
                  LEFT JOIN training_mode AS tm ON
                    l.training_mode_id = tm.id
                  LEFT JOIN priority AS p ON
                    p.id = l.priority_id
                  LEFT JOIN lead_type AS lt ON
                    lt.id = l.lead_type_id
                  LEFT JOIN lead_status AS ls ON
                    ls.id = l.lead_status_id
                  LEFT JOIN response_status AS rs ON
                    rs.id = l.response_status_id
                  LEFT JOIN branches AS b ON
                    b.id = l.branch_id
                  LEFT JOIN batch_track AS bt ON
                    bt.id = l.batch_track_id WHERE 1 = 1`;
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
                      l.training_mode_id,
                      tm.name AS training_mode,
                      l.priority_id,
                      p.name AS priority,
                      l.lead_type_id,
                      lt.name AS lead_type,
                      l.lead_status_id,
                      ls.name lead_status,
                      l.response_status_id,
                      rs.name AS response_status,
                      l.next_follow_up_date,
                      l.expected_join_date,
                      l.lead_quality_rating,
                      l.branch_id,
                      b.name AS branche_name,
                      l.batch_track_id,
                      bt.name AS batch_track,
                      l.comments,
                      l.created_date
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
                  LEFT JOIN training_mode AS tm ON
                      l.training_mode_id = tm.id
                  LEFT JOIN priority AS p ON
                      p.id = l.priority_id
                  LEFT JOIN lead_type AS lt ON
                      lt.id = l.lead_type_id
                  LEFT JOIN lead_status AS ls ON
                      ls.id = l.lead_status_id
                  LEFT JOIN response_status AS rs ON
                      rs.id = l.response_status_id
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
            `SELECT id, lead_id, updated_date, comments 
                 FROM lead_follow_up_history 
                 WHERE is_updated = 1 AND lead_id = ? 
                 ORDER BY id ASC`,
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
    lead_status_id,
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
        const insertQuery = `INSERT INTO lead_follow_up_history (lead_id, next_follow_up_date) VALUES (?, ?)`;
        const [insert_follow_up] = await pool.query(insertQuery, [
          lead_id,
          next_follow_up_date,
        ]);
        affectedRows += insert_follow_up.affectedRows;

        const [update_lead_master] = await pool.query(
          `UPDATE lead_master SET next_follow_up_date = ? WHERE id = ?`,
          [next_follow_up_date, lead_id]
        );

        affectedRows += update_lead_master.affectedRows;
      }

      if (lead_status_id) {
        const [get_lead_status] = await pool.query(
          `SELECT id, name FROM lead_status WHERE id = ?`,
          [lead_status_id]
        );
        if (get_lead_status[0].name === "Junk") {
          const [update_lead_master] = await pool.query(
            `UPDATE lead_master SET lead_status_id = ? WHERE id = ?`,
            [lead_status_id, lead_id]
          );

          affectedRows += update_lead_master.affectedRows;
        }
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
    training_mode_id,
    priority_id,
    lead_type_id,
    lead_status_id,
    response_status_id,
    next_follow_up_date,
    expected_join_date,
    lead_quality_rating,
    branch_id,
    batch_track_id,
    comments,
    lead_id
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
                              training_mode_id = ?,
                              priority_id = ?,
                              lead_type_id = ?,
                              lead_status_id = ?,
                              response_status_id = ?,
                              next_follow_up_date = ?,
                              expected_join_date = ?,
                              lead_quality_rating = ?,
                              branch_id = ?,
                              batch_track_id = ?,
                              comments = ?
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
        training_mode_id,
        priority_id,
        lead_type_id,
        lead_status_id,
        response_status_id,
        next_follow_up_date,
        expected_join_date,
        lead_quality_rating,
        branch_id,
        batch_track_id,
        comments,
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
        `SELECT COUNT(id) AS follow_up_count FROM lead_follow_up_history WHERE CAST(next_follow_up_date AS DATE) = ?`,
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
};

module.exports = LeadModel;
