const cron = require("node-cron");
const pool = require("../config/dbconfig");
const moment = require("moment-timezone");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin
const serviceKey = JSON.parse(
  fs.readFileSync("serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceKey),
  });
}

let scheduleTime = "0 * * * *"; // Schedule: Runs every hour
let nextFollowupTime = "*/30 * * * *"; // Schedule: Runs every 15 minutes
let nextDueDateTime = "*/30 * * * *"; // Schedule: Runs every 15 minutes

// Configure log file path
const logFilePath = path.join(__dirname, "cron_job_logs.txt");

// Helper function to log messages
const logToFile = async (message) => {
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(logFilePath, logMessage);
    // console.log(logMessage.trim()); // Also log to console for immediate feedback
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
};

const job = cron.schedule(scheduleTime, async () => {
  try {
    await logToFile("Cron job started execution");

    // Use a dedicated connection for transactional work
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) expire server_trans rows that are past NOW() and currently Active
      const [updateTransResult] = await conn.query(
        `UPDATE server_trans
         SET status = 'Expired'
         WHERE end_date < NOW()
           AND status = 'Active'`
      );
      await logToFile(
        `Expired server_trans rows: ${updateTransResult.affectedRows}`
      );

      // 2) update server_master only when ALL its server_trans rows are now 'Expired'
      const [updateMasterResult] = await conn.query(
        `UPDATE server_master sm
        JOIN (
            SELECT st.server_id
            FROM server_trans st
            GROUP BY st.server_id
            HAVING COUNT(*) > 0
            AND SUM(st.status <> 'Expired') = 0
        ) AS t ON sm.id = t.server_id
        SET sm.status = 'Expired'
        WHERE sm.status = 'Issued'`
      );

      await logToFile(
        `Updated server_master rows (all trans expired): ${updateMasterResult.affectedRows}`
      );

      await conn.commit();
      await logToFile("Transaction committed successfully");
      await conn.release();

      await logToFile("Cron job completed successfully");
      await logToFile("");
    } catch (innerErr) {
      // rollback on any failure inside the transaction
      try {
        await conn.rollback();
        await logToFile("Transaction rolled back due to error");
      } catch (rbErr) {
        await logToFile(`Rollback error: ${rbErr.message}`);
      }
      try {
        await conn.release();
      } catch (_) {}
      throw innerErr;
    }
  } catch (error) {
    await logToFile(`CRITICAL ERROR in cron job: ${error.message}`);
    await logToFile(`Stack trace: ${error.stack}`);
    // keep same behavior as before: rethrow if you want the process to crash/alert
    throw error;
  }
});

const nextFollowupNotify = cron.schedule(nextFollowupTime, async () => {
  try {
    await logToFile(
      "Cron job started execution for followup notification send"
    );
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [getFollowupCount] = await conn.query(
        `SELECT COUNT(lf.id) AS follow_up_count, l.assigned_to
         FROM lead_follow_up_history AS lf
         INNER JOIN lead_master AS l ON lf.lead_id = l.id
         LEFT JOIN customers AS c ON c.lead_id = l.id
         WHERE CAST(lf.next_follow_up_date AS DATE) = CURRENT_DATE
           AND lf.is_updated = 0
           AND c.id IS NULL
         GROUP BY l.assigned_to
         ORDER BY follow_up_count DESC`
      );

      const [getUsersToken] = await conn.query(
        `SELECT user_id, token FROM user_tokens`
      );

      if (getFollowupCount.length > 0) {
        // Use sequential loop while inside a DB transaction (safer than Promise.all)
        for (const item of getFollowupCount) {
          const tokenRow = getUsersToken.find(
            (r) => r.user_id === item.assigned_to
          );
          if (tokenRow != undefined) {
            const fcmToken = tokenRow.token; // <-- actual string token
            const title = `You have ${item.follow_up_count} Follow-ups today.`;
            const body =
              "Stay on track by completing your follow-ups before the day ends.";

            // Insert notification into DB (4 columns -> 4 values)
            await conn.query(
              `INSERT INTO notifications (user_id, title, message, token) VALUES (?, ?, ?, ?)`,
              [item.assigned_to, title, body, fcmToken]
            );

            // Send DATA-only payload to FCM
            const payload = {
              token: fcmToken,
              data: {
                title: title,
                body: body,
              },
            };

            // handle send errors per-user but don't abort entire loop; you can change behavior if needed
            try {
              await admin.messaging().send(payload);
            } catch (sendErr) {
              await logToFile(
                `FCM send error for user ${item.assigned_to}: ${sendErr.message}`
              );
              // optionally continue; we already saved the notification in DB
            }
          }
        }
      }

      await conn.commit();
      await logToFile("Transaction committed successfully for follow-up");
    } catch (innerErr) {
      try {
        await conn.rollback();
        await logToFile("Transaction rolled back due to error for follow-up");
      } catch (rbErr) {
        await logToFile(`Rollback error: ${rbErr.message}`);
      }
      throw innerErr;
    } finally {
      try {
        await conn.release();
      } catch (relErr) {
        await logToFile(`Connection release error: ${relErr.message}`);
      }
    }

    await logToFile("Cron job completed successfully for follow-up");
    await logToFile("");
  } catch (error) {
    await logToFile(`CRITICAL ERROR in cron job: ${error.message}`);
    await logToFile(`Stack trace: ${error.stack}`);
    throw error; // keep same behavior as before
  }
});

const nextDueDateNotify = cron.schedule(nextDueDateTime, async () => {
  try {
    await logToFile(
      "Cron job started execution for due date notification send"
    );
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [getNextDueCount] = await conn.query(
        `SELECT COUNT(DISTINCT pm.lead_id) AS todays_pending_count, l.assigned_to
                          FROM payment_master AS pm INNER JOIN lead_master AS l ON l.id = pm.lead_id
                          WHERE (
                              pm.total_amount - (
                                  SELECT COALESCE(SUM(pt_amount.amount), 0)
                                  FROM payment_trans pt_amount
                                  WHERE pt_amount.payment_master_id = pm.id 
                                    AND pt_amount.payment_status IN ('Verified', 'Verify Pending')
                              )
                          ) > 0
                          AND EXISTS (
                              SELECT 1
                              FROM payment_trans pt_date
                              WHERE pt_date.id = (
                                  SELECT MAX(p2.id)
                                  FROM payment_trans p2
                                  WHERE p2.payment_master_id = pm.id
                                    AND p2.payment_status IN ('Verified', 'Verify Pending')
                              )
                              AND CAST(pt_date.next_due_date AS DATE) = CURRENT_DATE
                          ) GROUP BY l.assigned_to ORDER BY todays_pending_count DESC;`
      );

      const [getUsersToken] = await conn.query(
        `SELECT user_id, token FROM user_tokens`
      );

      if (getNextDueCount.length > 0) {
        // Use sequential loop while inside a DB transaction (safer than Promise.all)
        for (const item of getNextDueCount) {
          const tokenRow = getUsersToken.find(
            (r) => r.user_id === item.assigned_to
          );

          if (tokenRow != undefined) {
            const fcmToken = tokenRow.token; // <-- actual string token
            const title = `You have ${item.todays_pending_count} pending payment today.`;
            const body =
              "Don't forget to clear your pending payments before the day ends.";

            // Insert notification into DB (4 columns -> 4 values)
            await conn.query(
              `INSERT INTO notifications (user_id, title, message, token) VALUES (?, ?, ?, ?)`,
              [item.assigned_to, title, body, fcmToken]
            );

            // Send DATA-only payload to FCM
            const payload = {
              token: fcmToken,
              data: {
                title: title,
                body: body,
              },
            };

            // handle send errors per-user but don't abort entire loop; you can change behavior if needed
            try {
              await admin.messaging().send(payload);
            } catch (sendErr) {
              await logToFile(
                `FCM send error for user ${item.assigned_to}: ${sendErr.message}`
              );
              // optionally continue; we already saved the notification in DB
            }
          }
        }
      }

      await conn.commit();
      await logToFile("Transaction committed successfully for due date");
    } catch (innerErr) {
      try {
        await conn.rollback();
        await logToFile("Transaction rolled back due to error for due date");
      } catch (rbErr) {
        await logToFile(`Rollback error: ${rbErr.message}`);
      }
      throw innerErr;
    } finally {
      try {
        await conn.release();
      } catch (relErr) {
        await logToFile(`Connection release error: ${relErr.message}`);
      }
    }

    await logToFile("Cron job completed successfully for due date");
    await logToFile("");
  } catch (error) {
    await logToFile(`CRITICAL ERROR in cron job: ${error.message}`);
    await logToFile(`Stack trace: ${error.stack}`);
    throw error; // keep same behavior as before
  }
});

// Log when the job is first scheduled
logToFile(`Cron job scheduled to run at pattern: ${scheduleTime}`);

console.log("✅ Scheduler initialized");

module.exports = {
  job,
  nextFollowupNotify,
  nextDueDateNotify,
};
