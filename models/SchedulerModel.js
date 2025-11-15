const cron = require("node-cron");
const pool = require("../config/dbconfig");
const moment = require("moment-timezone");

const fs = require("fs");
const path = require("path");

// let scheduleTime = "*/02 * * * *"; // Schedule: Runs every 30 minutes
let scheduleTime = "0 * * * *"; // Schedule: Runs every hour
// // let scheduleTime = "0 10 * * *"; // Schedule: Runs every day at 10:00 AM
// // let scheduleTime = "0 0 * * 0"; // Schedule: Runs every Sunday at midnight
// // let scheduleTime = "*/15 * * * *"; // Schedule: Runs every 15 minutes

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

// Log when the job is first scheduled
logToFile(`Cron job scheduled to run at pattern: ${scheduleTime}`);

console.log("✅ Scheduler initialized");

module.exports = job;
