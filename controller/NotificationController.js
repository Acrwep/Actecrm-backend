const admin = require("firebase-admin");
const fs = require("fs");
const notificationModel = require("../models/NotificationModel");
const { formatMessageBody } = require("../validation/Validation");

// Initialize Firebase Admin
const serviceKey = JSON.parse(
  fs.readFileSync("serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceKey),
  });
}

// Save user token
const registerToken = async (req, res) => {
  try {
    const { user_id, token } = req.body;

    if (!user_id || !token) {
      return res.status(400).json({ message: "Missing user_id or token" });
    }

    await notificationModel.saveToken(user_id, token);

    return res.status(200).json({ message: "Token saved successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Send notification to specific user
const sendNotificationToUser = async (req, res) => {
  try {
    const { user_id, title, message, created_at } = req.body;

    const token = await notificationModel.getUserToken(user_id);
    if (!token) {
      return res.status(400).json({ message: "User FCM token not found" });
    }

    // Convert message object to readable string
    let body;
    if (typeof message === "object") {
      body = Object.entries(message)
        .map(([key, val]) => `${key.replace(/_/g, " ")}: ${val}`)
        .join("\n");
    } else {
      body = message;
    }

    // Save in DB
    const insertedId = await notificationModel.sendNotificationToUser(
      user_id,
      title,
      JSON.stringify(message),
      token,
      created_at
    );

    // 🚀 Send DATA-ONLY FCM PAYLOAD
    const payload = {
      data: {
        title: title,
        body: body,
      },
      token,
    };

    await admin.messaging().send(payload);

    return res.json({
      message: "Notification sent successfully",
      notification_id: insertedId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Fetch user notifications
const getNotifications = async (req, res) => {
  try {
    const { user_id } = req.query;
    const notifications = await notificationModel.getUserNotifications(user_id);
    return res.json(notifications);
  } catch (err) {
    return res.status(500).json(err);
  }
};

// Mark notification as read
const readNotification = async (req, res) => {
  try {
    const { id } = req.body;
    await notificationModel.markAsRead(id);
    return res.json({ message: "Marked as read" });
  } catch (err) {
    return res.status(500).json(err);
  }
};

module.exports = {
  registerToken,
  sendNotificationToUser,
  getNotifications,
  readNotification,
};
