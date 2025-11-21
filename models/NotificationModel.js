const pool = require("../config/dbconfig");

const notificationModel = {
  // Save or Update token
  saveToken: async (user_id, token) => {
    try {
      const query = `
      INSERT INTO user_tokens (user_id, token)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE token = VALUES(token)
    `;

      const [result] = await pool.query(query, [user_id, token]);

      return result.affectedRows; // 1 = inserted, 2 = updated
    } catch (error) {
      throw new Error(error.message);
    }
  },

  sendNotificationToUser: async (
    user_id,
    title,
    message,
    token,
    created_at
  ) => {
    try {
      const query = `
      INSERT INTO notifications (user_id, title, message, token, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;

      const [result] = await pool.query(query, [
        user_id,
        title,
        message,
        token,
        created_at,
      ]);

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Get User Notifications
  getUserNotifications: async (user_id, limit, offset) => {
    try {
      const dataQuery = `
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

      const countQuery = `
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE user_id = ?
    `;

      const [rows] = await pool.query(dataQuery, [user_id, limit, offset]);
      const [countResult] = await pool.query(countQuery, [user_id]);

      return {
        data: rows,
        total: countResult[0].total,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Mark Notification as Read
  markAsRead: async (id) => {
    try {
      const query = `
      UPDATE notifications
      SET is_read = 1
      WHERE id = ?
    `;

      const [result] = await pool.query(query, [id]);

      return result.affectedRows; // 1 if updated, 0 if not found
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Get User FCM Token
  getUserToken: async (user_id) => {
    try {
      const query = `
      SELECT token FROM user_tokens
      WHERE user_id = ?
    `;

      const [rows] = await pool.query(query, [user_id]);

      return rows.length ? rows[0].token : null;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = notificationModel;
