const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const crypto = require("crypto");
const pool = require("../config/dbconfig");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAMES = (
  process.env.SHEET_NAMES ||
  process.env.SHEET_NAME ||
  "Sheet1"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const POLL_INTERVAL_MS =
  parseInt(process.env.POLL_INTERVAL_MINUTES || "1", 10) * 60 * 1000;

const KEYFILE = path.join(
  __dirname,
  process.env.KEYFILE || "acte-480005-9b15a4920cca.json"
);

const CHECKPOINT_FILE = path.join(__dirname, "checkpoint.json");

if (!SPREADSHEET_ID) {
  console.error("Please set SPREADSHEET_ID in .env");
  process.exit(1);
}

async function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

// checkpoint is now an object keyed by sheetName: { Sheet1: { lastRowCount: N }, Sheet2: { ... } }
function loadCheckpoint() {
  try {
    const raw = fs.readFileSync(CHECKPOINT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    // normalize shape
    if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch (err) {
    return {};
  }
}

function saveCheckpoint(obj) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(obj, null, 2));
}

function rowsToObjects(rows) {
  // rows is array of arrays, rows[0] is header
  if (!rows || rows.length === 0) return [];
  const headers = rows[0].map((h) => String(h).trim());
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] !== undefined ? row[j] : "";
    }
    data.push(obj);
  }
  return data;
}

function mapSheetObjectToDb(leadObj) {
  // Normalize keys in case sheet headers are different (case insensitive)
  const get = (k) => {
    // Try exact first, then case-insensitive lookup
    if (leadObj[k] !== undefined) return leadObj[k];
    const foundKey = Object.keys(leadObj).find(
      (x) => x.toLowerCase() === k.toLowerCase()
    );
    return foundKey ? leadObj[foundKey] : "";
  };

  return {
    name:
      get("Name") || get("name") || get("Your Name") || get("YourName") || "",
    phone:
      get("Phone") ||
      get("phone") ||
      get("Mobile Number") ||
      get("mobilenumber") ||
      "",
    email: get("Email") || get("email") || get("Your Email") || "",
    course: get("Course") || get("course") || get("Select Course") || "",
    // branch_id: get("BranchId") || get("branch_id") || get("branch") || null,
    location: get("Location") || "",
    comments: get("Comments") || get("comments") || get("Message") || "",
    date: get("Date") || "",
    time: get("Time") || "",
    training: get("Training") || "",
  };
}

// --- compute hash for dedupe/versioning --------------------------------
function computeHash(obj) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex")
    .slice(0, 32);
}

async function insertLead(leadObj, sheetRowNumber) {
  const mapped = mapSheetObjectToDb(leadObj);
  const sourceHash = computeHash(mapped);
  const branchId = mapped.branch_id ? parseInt(mapped.branch_id, 10) : null;

  try {
    const sql = `
      INSERT INTO website_leads
        (name, phone, email, course, comments, location, date, time, training, status, sheet_row, source_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id;
    `;
    const params = [
      mapped.name,
      mapped.phone,
      mapped.email,
      mapped.course,
      mapped.comments,
      mapped.location,
      mapped.date,
      mapped.time,
      mapped.training === "" ? "Classroom Training" : mapped.training,
      "Pending",
      sheetRowNumber, // NOTE: row number is per-tab
      sourceHash,
    ];

    const [isExists] = await pool.query(
      `SELECT COUNT(id) AS lead_count FROM website_leads WHERE (email COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%') OR phone COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%'))`,
      [mapped.email, mapped.phone]
    );

    let insertResult;

    if (isExists[0].lead_count <= 0) {
      const [result] = await pool.query(sql, params);
      insertResult = result; // result is the ResultSetHeader
    }

    if (insertResult && insertResult.insertId && insertResult.insertId > 0) {
      const [rows] = await pool.query(
        "SELECT * FROM website_leads WHERE id = ?",
        [insertResult.insertId]
      );
      if (rows && rows.length === 1) {
        return { ok: true, insertedId: insertResult.insertId, row: rows[0] };
      } else {
        return { ok: false, error: "Inserted but read-back failed" };
      }
    } else {
      // duplicate or no insertId
      const [rows] = await pool.execute(
        "SELECT * FROM website_leads WHERE sheet_row = ?",
        [sheetRowNumber]
      );
      if (rows && rows.length === 1) {
        return { ok: true, duplicate: true, row: rows[0] };
      } else {
        return { ok: false, error: "No insert id and no sheet_row match" };
      }
    }
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return { ok: true, duplicate: true, error: err.message };
    }
    return { ok: false, error: err.message || String(err) };
  }
}

// New: poll multiple sheets (tabs) in same spreadsheet using batchGet
async function pollMultipleSheets(sheetsClient) {
  // build ranges for each tab
  const ranges = SHEET_NAMES.map((name) => `${name}!A:Z`);
  const resp = await sheetsClient.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });

  const valueRanges = resp.data.valueRanges || [];
  const checkpoints = loadCheckpoint(); // object keyed by sheetName

  for (let i = 0; i < SHEET_NAMES.length; i++) {
    const sheetName = SHEET_NAMES[i];
    const vr = valueRanges[i] || {};
    const rows = vr.values || [];
    const checkpointForSheet = checkpoints[sheetName] || { lastRowCount: 0 };
    const lastRowCount = checkpointForSheet.lastRowCount || 0;

    if (rows.length <= 1) {
      console.log(new Date().toISOString(), `[${sheetName}] No data found.`);
      // still ensure checkpoint exists
      checkpoints[sheetName] = { lastRowCount: lastRowCount };
      continue;
    }

    const totalDataRows = rows.length - 1;
    if (totalDataRows > lastRowCount) {
      const allObjects = rowsToObjects(rows); // all data rows for this sheet
      const newRows = allObjects.slice(lastRowCount);
      console.log(
        new Date().toISOString(),
        `[${sheetName}] Found ${newRows.length} new row(s).`
      );

      const startIndex = lastRowCount; // 0-based index in allObjects for first new row
      for (let j = 0; j < newRows.length; j++) {
        const leadObject = newRows[j];
        // sheet row number: header is row 1, allObjects[0] => sheet row 2
        const sheetRowNumber = startIndex + j + 2;

        try {
          const result = await insertLead(
            leadObject,
            sheetRowNumber,
            sheetName
          );
          if (result.ok) {
            if (result.duplicate) {
              console.log(
                `[${sheetName}] Row ${sheetRowNumber} duplicate (already inserted).`
              );
            } else {
              console.log(
                `[${sheetName}] Inserted row ${sheetRowNumber} => id=${result.insertedId}`
              );
            }
          } else {
            console.error(
              `[${sheetName}] Failed to insert row ${sheetRowNumber}:`,
              result.error
            );
            // do not update checkpoint for this sheet (so it will retry next poll)
            // skip remaining new rows for this sheet to avoid advancing checkpoint incorrectly
            break;
          }
        } catch (err) {
          console.error(
            `[${sheetName}] Unexpected error inserting row ${sheetRowNumber}:`,
            err
          );
          // stop processing this sheet this run
          break;
        }
      }

      checkpoints[sheetName] = { lastRowCount: totalDataRows };
      saveCheckpoint(checkpoints);
      console.log(`[${sheetName}] Checkpoint updated: ${totalDataRows}`);
    } else {
      console.log(new Date().toISOString(), `[${sheetName}] No new rows.`);
      // ensure checkpoint exists
      checkpoints[sheetName] = { lastRowCount: lastRowCount };
      saveCheckpoint(checkpoints);
    }
  } // end for each sheet
}

async function main() {
  const sheetsClient = await createSheetsClient();
  console.log(
    "Starting multi-sheet poller for",
    SPREADSHEET_ID,
    "sheets:",
    SHEET_NAMES.join(", ")
  );
  // initial run
  await pollMultipleSheets(sheetsClient);
  // schedule subsequent runs
  setInterval(async () => {
    try {
      await pollMultipleSheets(sheetsClient);
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
