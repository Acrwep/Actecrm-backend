const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const crypto = require("crypto");
const pool = require("../config/dbconfig");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Sheet1";
// const POLL_INTERVAL_MS =
//   parseInt(process.env.POLL_INTERVAL_SECONDS || "10", 10) * 1000;
// const POLL_INTERVAL_MS =
//   parseInt(process.env.POLL_INTERVAL_MINUTES || "30", 10) * 60 * 1000;

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
// const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds

const KEYFILE = path.join(
  __dirname,
  process.env.KEYFILE || "serviceaccount.json"
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

function loadCheckpoint() {
  try {
    const raw = fs.readFileSync(CHECKPOINT_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return { lastRowCount: 0 };
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
    name: get("Name") || get("name") || "",
    phone: get("Phone") || get("phone") || "",
    email: get("Email") || get("email") || "",
    course: get("Course") || get("course") || "",
    branch_id: get("BranchId") || get("branch_id") || get("branch") || null,
    comments: get("Comments") || get("comments") || "",
    status: get("Status") || get("status") || "",
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

  // If your table expects integers for region_id/branch_id, try parseInt
  const branchId = mapped.branch_id ? parseInt(mapped.branch_id, 10) : null;

  try {
    const [getRegionID] = await pool.query(
      `SELECT region_id FROM branches WHERE id = ?`,
      [mapped.branch_id]
    );
    // Use INSERT IGNORE or ON DUPLICATE KEY to avoid duplicate sheet_row inserts.
    // This SQL assumes you've added sheet_row column with a UNIQUE index (ux_website_leads_sheet_row).
    const sql = `
    INSERT INTO website_leads
      (name, phone, email, course, region_id, branch_id, comments, status, sheet_row, source_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id; -- no-op update if duplicate
  `;
    const params = [
      mapped.name,
      mapped.phone,
      mapped.email,
      mapped.course,
      getRegionID[0].region_id,
      branchId,
      mapped.comments,
      "Pending",
      sheetRowNumber,
      sourceHash,
    ];
    const [res] = await pool.execute(sql, params);
    // If insert happened, res.insertId will be set. For duplicate, affectedRows may be 0 or 2 (depending)
    if (res.insertId && res.insertId > 0) {
      // read back to verify
      const [rows] = await pool.execute(
        "SELECT * FROM website_leads WHERE id = ?",
        [res.insertId]
      );
      if (rows && rows.length === 1) {
        return { ok: true, insertedId: res.insertId, row: rows[0] };
      } else {
        return { ok: false, error: "Inserted but read-back failed" };
      }
    } else {
      // likely duplicate - try to fetch by sheet_row to confirm
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
    // if duplicate key error occurs and you didn't have ON DUPLICATE KEY, handle it
    if (err && err.code === "ER_DUP_ENTRY") {
      return { ok: true, duplicate: true, error: err.message };
    }
    return { ok: false, error: err.message || String(err) };
  }
}

async function pollSheet(sheets) {
  const range = `${SHEET_NAME}!A:Z`; // adjust if you need more/less
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  const rows = res.data.values || [];
  const checkpoint = loadCheckpoint();
  const lastRowCount = checkpoint.lastRowCount || 0;

  if (rows.length <= 1) {
    // only header or empty
    console.log(new Date().toISOString(), "No data found.");
    return;
  }

  const totalDataRows = rows.length - 1; // minus header row
  if (totalDataRows > lastRowCount) {
    const allObjects = rowsToObjects(rows); // array: all data rows in order
    const newRows = allObjects.slice(lastRowCount); // only new rows
    console.log(
      new Date().toISOString(),
      `Found ${newRows.length} new row(s).`
    );

    // startIndex is the index in allObjects of the first new row
    const startIndex = lastRowCount; // 0-based in allObjects
    for (let i = 0; i < newRows.length; i++) {
      const leadObject = newRows[i];
      // compute the real Google Sheets row number for this item:
      // header is row 1, allObjects[0] => sheet row 2, so:
      const sheetRowNumber = startIndex + i + 2;

      try {
        const result = await insertLead(leadObject, sheetRowNumber);
        if (result.ok) {
          if (result.duplicate) {
            console.log(`Row ${sheetRowNumber} already inserted (duplicate).`);
          } else {
            console.log(
              `Inserted row ${sheetRowNumber} => id=${result.insertedId}`
            );
          }
          // optionally mark the sheet cell as processed here (requires write scope)
        } else {
          console.error(
            `Failed to insert row ${sheetRowNumber}:`,
            result.error
          );
          // Important: do NOT advance checkpoint for failed row — allow retry next run
          // we exit loop to avoid updating checkpoint incorrectly
          return;
        }
      } catch (err) {
        console.error(`Unexpected error inserting row ${sheetRowNumber}:`, err);
        return; // do not advance checkpoint
      }
    }

    // all new rows processed successfully (or were duplicates) -> update checkpoint
    saveCheckpoint({ lastRowCount: totalDataRows });
    console.log("Checkpoint updated:", totalDataRows);
  } else {
    console.log(new Date().toISOString(), "No new rows.");
  }
}

async function main() {
  const sheets = await createSheetsClient();
  console.log(
    "Starting sheet poller for",
    SPREADSHEET_ID,
    "sheet:",
    SHEET_NAME
  );
  // initial poll immediately
  await pollSheet(sheets, pool);

  // schedule subsequent polls
  setInterval(async () => {
    try {
      await pollSheet(sheets, pool);
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
