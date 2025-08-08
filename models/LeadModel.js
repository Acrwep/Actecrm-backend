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
};

module.exports = LeadModel;
