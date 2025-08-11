const pool = require("../config/dbconfig");

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

      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getLeads: async (name, start_date, end_date) => {
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
                    u.id = l.user_id
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
};

module.exports = LeadModel;
