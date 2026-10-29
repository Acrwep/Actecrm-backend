const pool = require("../config/dbconfig");

function formatToBackendIST(date = new Date()) {
  const istDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const pad = (n) => String(n).padStart(2, "0");

  const year = istDate.getFullYear();
  const month = pad(istDate.getMonth() + 1);
  const day = pad(istDate.getDate());
  const hours = pad(istDate.getHours());
  const minutes = pad(istDate.getMinutes());
  const seconds = pad(istDate.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getTodayISTString() {
  const istDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const pad = (n) => String(n).padStart(2, "0");
  const year = istDate.getFullYear();
  const month = pad(istDate.getMonth() + 1);
  const day = pad(istDate.getDate());
  return `${year}-${month}-${day}`;
}

let isSequenceInitialized = false;
let sequenceInitPromise = null;

let isTemplateStatusInitialized = false;
let templateStatusInitPromise = null;

async function ensureTemplateStatusTableInitialized() {
  if (isTemplateStatusInitialized) return;
  if (templateStatusInitPromise) return templateStatusInitPromise;

  templateStatusInitPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_placement_template_status (
        id INT(11) NOT NULL AUTO_INCREMENT,
        customer_id INT(11) NOT NULL,
        placement_welcome_message TINYINT(1) NOT NULL DEFAULT 0,
        placement_registration_link TINYINT(1) NOT NULL DEFAULT 0,
        add_on_course TINYINT(1) NOT NULL DEFAULT 0,
        placement_add_on_course TINYINT(1) NOT NULL DEFAULT 0,
        welcome_message_sent_at DATETIME DEFAULT NULL,
        registration_link_sent_at DATETIME DEFAULT NULL,
        add_on_course_sent_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cpts_customer_id (customer_id),
        KEY idx_cpts_welcome (placement_welcome_message),
        KEY idx_cpts_registration (placement_registration_link),
        KEY idx_cpts_add_on (add_on_course)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    isTemplateStatusInitialized = true;
  })();

  return templateStatusInitPromise;
}

async function ensureSequenceTableInitialized() {
  if (isSequenceInitialized) return;
  if (sequenceInitPromise) return sequenceInitPromise;

  sequenceInitPromise = (async () => {
    // 1. Create table once outside transaction if not present
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_placement_campaign_sequences (
        id INT NOT NULL,
        current_seq BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. Check if counter row 1 exists
    const [rows] = await pool.query(
      "SELECT current_seq FROM whatsapp_placement_campaign_sequences WHERE id = 1",
    );

    if (!rows || rows.length === 0) {
      // Find the maximum existing numeric suffix across all placement campaigns
      const [campRows] = await pool.query(
        "SELECT campaign_id FROM whatsapp_placement_campaigns",
      );
      let maxExisting = 0;
      if (campRows && campRows.length > 0) {
        for (const camp of campRows) {
          const parts = (camp.campaign_id || "").split("-");
          if (parts.length >= 2) {
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num) && num > maxExisting) {
              maxExisting = num;
            }
          }
        }
      }
      await pool.query(
        "INSERT IGNORE INTO whatsapp_placement_campaign_sequences (id, current_seq) VALUES (1, ?)",
        [maxExisting],
      );
    }
    isSequenceInitialized = true;
  })();

  return sequenceInitPromise;
}

function formatCampaignSuffix(seq) {
  const num = Number(seq);
  if (isNaN(num) || num < 1) return "01";
  if (num < 10) {
    return String(num).padStart(2, "0"); // 01, 02, ..., 09
  }
  return String(num); // 10, 11, ..., 99, 100, 101, ...
}

function getCampaignDateCode() {
  const istDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const monthStr = months[istDate.getMonth()];
  const dayStr = String(istDate.getDate()).padStart(2, "0");
  const yearStr = istDate.getFullYear();
  return `${monthStr}${dayStr}${yearStr}`;
}

const WhatsAppPlacementCampaignModel = {
  formatToBackendIST,
  getTodayISTString,
  formatCampaignSuffix,
  getCampaignDateCode,

  /**
   * Atomically acquires the next continuously incrementing placement campaign sequence number.
   */
  getNextCampaignSequence: async (connection = null) => {
    await ensureSequenceTableInitialized();

    const conn = connection || (await pool.getConnection());
    const isOwnConn = !connection;

    try {
      if (isOwnConn) {
        await conn.beginTransaction();
      }

      // Exclusive row lock on sequence row (id = 1)
      const [rows] = await conn.query(
        "SELECT current_seq FROM whatsapp_placement_campaign_sequences WHERE id = 1 FOR UPDATE",
      );

      let nextSeq =
        (rows && rows.length > 0 ? Number(rows[0].current_seq) : 0) + 1;

      // Extra safeguard: inspect recent campaigns to ensure nextSeq strictly exceeds any existing suffix
      const [recentCamps] = await conn.query(
        "SELECT campaign_id FROM whatsapp_placement_campaigns ORDER BY id DESC LIMIT 50",
      );
      if (recentCamps && recentCamps.length > 0) {
        for (const camp of recentCamps) {
          const parts = (camp.campaign_id || "").split("-");
          if (parts.length >= 2) {
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num) && num >= nextSeq) {
              nextSeq = num + 1;
            }
          }
        }
      }

      await conn.query(
        "UPDATE whatsapp_placement_campaign_sequences SET current_seq = ? WHERE id = 1",
        [nextSeq],
      );

      if (isOwnConn) {
        await conn.commit();
      }

      return nextSeq;
    } catch (err) {
      if (isOwnConn) {
        await conn.rollback();
      }
      throw err;
    } finally {
      if (isOwnConn) {
        conn.release();
      }
    }
  },

  /**
   * Generates a sequential Campaign ID for Placement campaigns
   * Format: PCAMP-[B|S]-[MONDDYYYY]-[SUFFIX]
   * Example: PCAMP-B-OCT292026-01, PCAMP-S-OCT292026-02
   */
  generateCampaignId: async (campaignType = "Bulk", connection = null) => {
    const typeCode = campaignType === "Bulk" ? "B" : "S";
    const dateCode = getCampaignDateCode();
    const nextSeq =
      await WhatsAppPlacementCampaignModel.getNextCampaignSequence(connection);
    const suffix = formatCampaignSuffix(nextSeq);
    return `PCAMP-${typeCode}-${dateCode}-${suffix}`;
  },

  /**
   * Create a new placement campaign record
   */
  createCampaign: async (data, connection = null) => {
    const db = connection || pool;
    const {
      campaign_id,
      campaign_name,
      campaign_type = "Single",
      template_id = null,
      template_name = null,
      region_id = null,
      branch_id = null,
      course_id = null,
      created_by = null,
      total_recipients = 0,
      success_count = 0,
      failed_count = 0,
      pending_count = 0,
      delivered_count = 0,
      read_count = 0,
      campaign_status = "Processing",
      started_at = null,
      completed_at = null,
      created_at = null,
    } = data;

    const query = `
      INSERT INTO whatsapp_placement_campaigns (
        campaign_id,
        campaign_name,
        campaign_type,
        template_id,
        template_name,
        region_id,
        branch_id,
        course_id,
        created_by,
        total_recipients,
        success_count,
        failed_count,
        pending_count,
        delivered_count,
        read_count,
        campaign_status,
        started_at,
        completed_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const nowIST = formatToBackendIST();
    const values = [
      campaign_id,
      campaign_name,
      campaign_type,
      template_id,
      template_name,
      region_id ? Number(region_id) : null,
      branch_id ? Number(branch_id) : null,
      course_id ? Number(course_id) : null,
      created_by,
      total_recipients,
      success_count,
      failed_count,
      pending_count,
      delivered_count,
      read_count,
      campaign_status,
      started_at || nowIST,
      completed_at || null,
      created_at || nowIST,
    ];

    const [result] = await db.query(query, values);
    return result;
  },

  /**
   * Batch insert placement recipient message records using customer_id
   */
  createCampaignMessages: async (messages, connection = null) => {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const db = connection || pool;

    const query = `
      INSERT INTO whatsapp_placement_campaign_messages (
        campaign_id,
        customer_id,
        recipient_name,
        mobile_number,
        aisensy_message_id,
        message_status,
        error_message,
        template_params,
        media_url,
        sent_at,
        delivered_at,
        read_at,
        failed_at,
        created_at
      )
      VALUES ?
    `;

    const nowIST = formatToBackendIST();
    const values = messages.map((m) => [
      m.campaign_id,
      m.customer_id || null,
      m.recipient_name || m.customer_name || null,
      String(m.mobile_number || m.mobile || m.phone || m.whatsapp || "").trim(),
      m.aisensy_message_id || null,
      m.message_status || "Pending",
      m.error_message || null,
      m.template_params ? JSON.stringify(m.template_params) : null,
      m.media_url || null,
      m.sent_at || null,
      m.delivered_at || null,
      m.read_at || null,
      m.failed_at || null,
      m.created_at || nowIST,
    ]);

    const [result] = await db.query(query, [values]);
    return result;
  },

  /**
   * Update individual placement message status
   */
  updateMessageStatus: async (
    { id, campaign_id, mobile_number },
    updateData,
    connection = null,
  ) => {
    const db = connection || pool;
    const fields = [];
    const values = [];

    if (updateData.message_status) {
      fields.push("message_status = ?");
      values.push(updateData.message_status);
    }
    if (updateData.aisensy_message_id !== undefined) {
      fields.push("aisensy_message_id = ?");
      values.push(updateData.aisensy_message_id);
    }
    if (updateData.error_message !== undefined) {
      fields.push("error_message = ?");
      values.push(updateData.error_message);
    }
    if (updateData.sent_at !== undefined) {
      fields.push("sent_at = ?");
      values.push(updateData.sent_at);
    }
    if (updateData.delivered_at !== undefined) {
      fields.push("delivered_at = ?");
      values.push(updateData.delivered_at);
    }
    if (updateData.read_at !== undefined) {
      fields.push("read_at = ?");
      values.push(updateData.read_at);
    }
    if (updateData.failed_at !== undefined) {
      fields.push("failed_at = ?");
      values.push(updateData.failed_at);
    }

    if (fields.length === 0) return null;

    let whereClause = "";
    if (id) {
      whereClause = "WHERE id = ?";
      values.push(id);
    } else if (campaign_id && mobile_number) {
      whereClause = "WHERE campaign_id = ? AND mobile_number = ?";
      values.push(campaign_id, mobile_number);
    } else {
      throw new Error(
        "Must provide either message id or campaign_id + mobile_number",
      );
    }

    const query = `UPDATE whatsapp_placement_campaign_messages SET ${fields.join(", ")} ${whereClause}`;
    const [result] = await db.query(query, values);
    return result;
  },

  /**
   * Recalculate placement campaign summary counts from message records
   */
  recalculateCampaignCounts: async (campaign_id, connection = null) => {
    const db = connection || pool;

    const countQuery = `
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN message_status IN ('Sent', 'Delivered', 'Read') OR sent_at IS NOT NULL THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN message_status IN ('Delivered', 'Read') OR delivered_at IS NOT NULL THEN 1 ELSE 0 END) AS delivered_count,
        SUM(CASE WHEN message_status = 'Read' OR read_at IS NOT NULL THEN 1 ELSE 0 END) AS read_count,
        SUM(CASE WHEN message_status = 'Failed' OR failed_at IS NOT NULL THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN message_status = 'Pending' AND sent_at IS NULL THEN 1 ELSE 0 END) AS pending_count
      FROM whatsapp_placement_campaign_messages
      WHERE campaign_id = ?
    `;

    const [rows] = await db.query(countQuery, [campaign_id]);
    if (!rows.length) return null;

    const counts = rows[0];
    const total = Number(counts.total_count || 0);
    const success = Number(counts.success_count || 0);
    const failed = Number(counts.failed_count || 0);
    const pending = Number(counts.pending_count || 0);
    const delivered = Number(counts.delivered_count || 0);
    const read = Number(counts.read_count || 0);

    let campaign_status = "Processing";
    let completed_at = null;

    if (pending === 0 && total > 0) {
      completed_at = formatToBackendIST();
      campaign_status = success > 0 ? "Completed" : "Failed";
    }

    const updateQuery = `
      UPDATE whatsapp_placement_campaigns
      SET
        total_recipients = ?,
        success_count = ?,
        failed_count = ?,
        pending_count = ?,
        delivered_count = ?,
        read_count = ?,
        campaign_status = CASE WHEN pending_count = 0 THEN ? ELSE campaign_status END,
        completed_at = CASE WHEN pending_count = 0 AND completed_at IS NULL THEN ? ELSE completed_at END
      WHERE campaign_id = ?
    `;

    await db.query(updateQuery, [
      total,
      success,
      failed,
      pending,
      delivered,
      read,
      campaign_status,
      completed_at,
      campaign_id,
    ]);

    return {
      total,
      success,
      failed,
      pending,
      delivered,
      read,
      campaign_status,
    };
  },

  /**
   * Update placement message status via AiSensy Webhook
   */
  updateMessageByAisensyId: async (
    aisensy_message_id,
    { status, error = null, timestamp = null, destination = null } = {},
  ) => {
    let message = null;

    // 1. Try finding by aisensy_message_id
    if (aisensy_message_id) {
      const [rows] = await pool.query(
        `SELECT id, campaign_id, customer_id, message_status, delivered_at, aisensy_message_id FROM whatsapp_placement_campaign_messages WHERE aisensy_message_id = ? LIMIT 1`,
        [aisensy_message_id],
      );
      if (rows.length) {
        message = rows[0];
      }
    }

    // 2. Fallback: If not found by ID, try finding by recipient phone number (last 10 digits)
    if (!message && destination) {
      const cleanMobile = String(destination).replace(/\D/g, "").slice(-10);
      if (cleanMobile.length >= 7) {
        const [rows] = await pool.query(
          `SELECT id, campaign_id, customer_id, message_status, delivered_at, aisensy_message_id 
           FROM whatsapp_placement_campaign_messages 
           WHERE RIGHT(mobile_number, 10) = ? 
           ORDER BY id DESC LIMIT 1`,
          [cleanMobile],
        );
        if (rows.length) {
          message = rows[0];
          console.log(
            `[AiSensy Placement Webhook] Matched message by phone number: ${cleanMobile} (ID: ${message.id})`,
          );
        }
      }
    }

    if (!message) {
      console.warn(
        `[AiSensy Placement Webhook] No matching message found for id: '${aisensy_message_id}' or destination: '${destination}'`,
      );
      return null;
    }

    const nowIST = formatToBackendIST(
      timestamp ? new Date(timestamp * 1000) : new Date(),
    );
    let newStatus = message.message_status;
    const lowerStatus = String(status || "").toLowerCase();

    const fields = [];
    const values = [];

    // Store incoming ID if the message didn't have one
    if (
      aisensy_message_id &&
      (!message.aisensy_message_id ||
        message.aisensy_message_id !== aisensy_message_id)
    ) {
      fields.push("aisensy_message_id = ?");
      values.push(aisensy_message_id);
    }

    if (lowerStatus === "delivered") {
      newStatus = "Delivered";
      fields.push("message_status = ?", "delivered_at = ?");
      values.push(newStatus, nowIST);
    } else if (lowerStatus === "read") {
      newStatus = "Read";
      fields.push("message_status = ?", "read_at = ?");
      values.push(newStatus, nowIST);
      if (!message.delivered_at) {
        fields.push("delivered_at = ?");
        values.push(nowIST);
      }
    } else if (lowerStatus === "failed") {
      newStatus = "Failed";
      fields.push("message_status = ?", "failed_at = ?", "error_message = ?");
      values.push(
        newStatus,
        nowIST,
        error
          ? typeof error === "object"
            ? JSON.stringify(error)
            : String(error)
          : "Delivery failed",
      );
    } else if (lowerStatus === "sent" && message.message_status === "Pending") {
      newStatus = "Sent";
      fields.push("message_status = ?", "sent_at = ?");
      values.push(newStatus, nowIST);
    }

    if (fields.length > 0) {
      values.push(message.id);
      await pool.query(
        `UPDATE whatsapp_placement_campaign_messages SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
      // Recalculate parent campaign counts
      await WhatsAppPlacementCampaignModel.recalculateCampaignCounts(
        message.campaign_id,
      );

      // If status is successful and recipient has customer_id, update template flag
      if (
        ["Sent", "Delivered", "Read"].includes(newStatus) &&
        message.customer_id
      ) {
        try {
          const [campRows] = await pool.query(
            "SELECT template_id, template_name FROM whatsapp_placement_campaigns WHERE campaign_id = ? LIMIT 1",
            [message.campaign_id],
          );
          if (campRows.length) {
            const camp = campRows[0];
            const flagType = WhatsAppPlacementCampaignModel.getTemplateFlagType(
              {
                template_label: camp.template_name,
                campaign_name: camp.template_name,
              },
            );
            if (flagType) {
              await WhatsAppPlacementCampaignModel.updateCustomerTemplateStatus(
                message.customer_id,
                flagType,
              );
            }
          }
        } catch (statusErr) {
          console.error(
            "Error updating template flag on webhook:",
            statusErr.message,
          );
        }
      }
    }

    return {
      updated: true,
      messageId: message.id,
      campaignId: message.campaign_id,
      customerId: message.customer_id,
      newStatus,
    };
  },

  /**
   * Get paginated placement campaign history with filters
   */
  getCampaigns: async ({
    page = 1,
    limit = 10,
    search = "",
    campaignType = "",
    status = "",
    fromDate = "",
    toDate = "",
    createdBy = "",
    region_id = "",
    branch_id = "",
    course_id = "",
  } = {}) => {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ["1=1"];
    const params = [];

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      conditions.push(
        `(c.campaign_id LIKE ? OR c.campaign_name LIKE ? OR c.template_name LIKE ? OR c.created_by LIKE ? OR u.user_name LIKE ? OR r.name LIKE ? OR b.name LIKE ? OR t.name LIKE ?)`,
      );
      params.push(term, term, term, term, term, term, term, term);
    }

    if (campaignType && ["Single", "Bulk"].includes(campaignType)) {
      conditions.push(`c.campaign_type = ?`);
      params.push(campaignType);
    }

    if (status && ["Processing", "Completed", "Failed"].includes(status)) {
      conditions.push(`c.campaign_status = ?`);
      params.push(status);
    }

    if (createdBy) {
      conditions.push(`c.created_by = ?`);
      params.push(createdBy);
    }

    if (region_id) {
      conditions.push(`c.region_id = ?`);
      params.push(Number(region_id));
    }

    if (branch_id) {
      conditions.push(`c.branch_id = ?`);
      params.push(Number(branch_id));
    }

    if (course_id) {
      conditions.push(`c.course_id = ?`);
      params.push(Number(course_id));
    }

    if (fromDate) {
      conditions.push(`c.created_at >= ?`);
      params.push(`${fromDate} 00:00:00`);
    }

    if (toDate) {
      conditions.push(`c.created_at <= ?`);
      params.push(`${toDate} 23:59:59`);
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM whatsapp_placement_campaigns c
      LEFT JOIN region r ON c.region_id = r.id
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN technologies t ON c.course_id = t.id
      LEFT JOIN users u ON c.created_by COLLATE utf8mb4_general_ci = u.user_id
      WHERE ${whereClause}
    `;

    const [countRows] = await pool.query(countQuery, params);
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limitNum);

    const dataQuery = `
      SELECT
        c.id,
        c.campaign_id,
        c.campaign_name,
        c.campaign_type,
        c.template_id,
        c.template_name,
        c.region_id,
        r.name AS region_name,
        c.branch_id,
        b.name AS branch_name,
        c.course_id,
        t.name AS course_name,
        c.created_by,
        u.view_user_id AS created_by_view_user_id,
        u.user_name AS created_by_name,
        c.total_recipients,
        c.success_count,
        c.failed_count,
        c.pending_count,
        c.delivered_count,
        c.read_count,
        c.campaign_status,
        c.started_at,
        c.completed_at,
        c.created_at,
        c.updated_at
      FROM whatsapp_placement_campaigns c
      LEFT JOIN region r ON c.region_id = r.id
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN technologies t ON c.course_id = t.id
      LEFT JOIN users u
        ON c.created_by COLLATE utf8mb4_general_ci = u.user_id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataQuery, [...params, limitNum, offset]);

    return {
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  },

  /**
   * Get single placement campaign by campaign_id or id
   */
  getCampaignById: async (campaign_id) => {
    const query = `
      SELECT
        c.id,
        c.campaign_id,
        c.campaign_name,
        c.campaign_type,
        c.template_id,
        c.template_name,
        c.region_id,
        r.name AS region_name,
        c.branch_id,
        b.name AS branch_name,
        c.course_id,
        t.name AS course_name,
        c.created_by,
        u.view_user_id AS created_by_view_user_id,
        u.user_name AS created_by_name,
        c.total_recipients,
        c.success_count,
        c.failed_count,
        c.pending_count,
        c.delivered_count,
        c.read_count,
        c.campaign_status,
        c.started_at,
        c.completed_at,
        c.created_at,
        c.updated_at
      FROM whatsapp_placement_campaigns c
      LEFT JOIN region r ON c.region_id = r.id
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN technologies t ON c.course_id = t.id
      LEFT JOIN users u ON c.created_by COLLATE utf8mb4_general_ci = u.user_id
      WHERE c.campaign_id = ? OR c.id = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(query, [campaign_id, campaign_id]);
    return rows.length ? rows[0] : null;
  },

  /**
   * Get messages for a placement campaign with optional search & pagination
   * Returns customer_id instead of lead_id
   */
  getCampaignMessages: async (
    campaign_id,
    { page = 1, limit = 20, search = "", status = "" } = {},
  ) => {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ["campaign_id = ?"];
    const params = [campaign_id];

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      conditions.push(
        `(recipient_name LIKE ? OR mobile_number LIKE ? OR aisensy_message_id LIKE ? OR error_message LIKE ? OR CAST(customer_id AS CHAR) LIKE ?)`,
      );
      params.push(term, term, term, term, term);
    }

    if (
      status &&
      ["Pending", "Sent", "Delivered", "Read", "Failed"].includes(status)
    ) {
      conditions.push(`message_status = ?`);
      params.push(status);
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM whatsapp_placement_campaign_messages
      WHERE ${whereClause}
    `;

    const [countRows] = await pool.query(countQuery, params);
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limitNum);

    const dataQuery = `
      SELECT
        id,
        campaign_id,
        customer_id,
        recipient_name,
        mobile_number,
        aisensy_message_id,
        message_status,
        error_message,
        template_params,
        media_url,
        sent_at,
        delivered_at,
        read_at,
        failed_at,
        created_at
      FROM whatsapp_placement_campaign_messages
      WHERE ${whereClause}
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataQuery, [...params, limitNum, offset]);

    return {
      data: rows.map((r) => ({
        ...r,
        template_params:
          typeof r.template_params === "string"
            ? JSON.parse(r.template_params || "[]")
            : r.template_params,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  },

  /**
   * Get recipients from an existing placement campaign for follow-up / retargeting
   * Uses customer_id consistently
   */
  getCampaignRecipientsForFollowUp: async ({
    campaign_id,
    status_filter = null,
    selected_mobiles = null,
  }) => {
    const conditions = ["campaign_id = ?"];
    const params = [campaign_id];

    if (status_filter && status_filter !== "all" && status_filter !== "All") {
      if (Array.isArray(status_filter) && status_filter.length > 0) {
        const placeholders = status_filter.map(() => "?").join(", ");
        conditions.push(`message_status IN (${placeholders})`);
        params.push(...status_filter);
      } else if (typeof status_filter === "string") {
        conditions.push(`message_status = ?`);
        params.push(status_filter);
      }
    }

    if (Array.isArray(selected_mobiles) && selected_mobiles.length > 0) {
      const placeholders = selected_mobiles.map(() => "?").join(", ");
      conditions.push(`mobile_number IN (${placeholders})`);
      params.push(...selected_mobiles);
    }

    const whereClause = conditions.join(" AND ");

    // Fetch distinct mobile numbers so each recipient gets only 1 message
    const query = `
      SELECT
        mobile_number,
        MAX(id) AS message_id,
        MAX(customer_id) AS customer_id,
        MAX(recipient_name) AS recipient_name,
        MAX(message_status) AS last_status,
        MAX(media_url) AS media_url,
        MAX(template_params) AS last_template_params
      FROM whatsapp_placement_campaign_messages
      WHERE ${whereClause}
      GROUP BY mobile_number
      ORDER BY message_id ASC
    `;

    const [rows] = await pool.query(query, params);
    return rows.map((r) => {
      let parsedParams = null;
      try {
        parsedParams =
          typeof r.last_template_params === "string"
            ? JSON.parse(r.last_template_params)
            : r.last_template_params;
      } catch {
        parsedParams = null;
      }
      return {
        ...r,
        last_template_params: parsedParams,
      };
    });
  },

  /**
   * Get placement campaign and message statistics
   */
  getStatistics: async ({ fromDate = "", toDate = "" } = {}) => {
    const todayStr = getTodayISTString();
    const todayStart = `${todayStr} 00:00:00`;
    const todayEnd = `${todayStr} 23:59:59`;

    // 1. Today's placement campaign counts
    const todayCampQuery = `
      SELECT
        COUNT(*) AS total_campaigns_today,
        SUM(CASE WHEN campaign_type = 'Single' THEN 1 ELSE 0 END) AS single_campaigns_today,
        SUM(CASE WHEN campaign_type = 'Bulk' THEN 1 ELSE 0 END) AS bulk_campaigns_today
      FROM whatsapp_placement_campaigns
      WHERE created_at BETWEEN ? AND ?
    `;
    const [todayCampRows] = await pool.query(todayCampQuery, [
      todayStart,
      todayEnd,
    ]);
    const todayCamp = todayCampRows[0] || {};

    // 2. Message counts for the selected date range (or today if none specified)
    const rangeStart = fromDate ? `${fromDate} 00:00:00` : todayStart;
    const rangeEnd = toDate ? `${toDate} 23:59:59` : todayEnd;

    const messageStatsQuery = `
      SELECT
        COUNT(*) AS total_messages,
        SUM(CASE WHEN message_status IN ('Sent', 'Delivered', 'Read') OR sent_at IS NOT NULL THEN 1 ELSE 0 END) AS sent_messages,
        SUM(CASE WHEN message_status IN ('Delivered', 'Read') OR delivered_at IS NOT NULL THEN 1 ELSE 0 END) AS delivered_messages,
        SUM(CASE WHEN message_status = 'Read' OR read_at IS NOT NULL THEN 1 ELSE 0 END) AS read_messages,
        SUM(CASE WHEN message_status = 'Failed' OR failed_at IS NOT NULL THEN 1 ELSE 0 END) AS failed_messages,
        SUM(CASE WHEN message_status = 'Pending' AND sent_at IS NULL THEN 1 ELSE 0 END) AS pending_messages
      FROM whatsapp_placement_campaign_messages
      WHERE created_at BETWEEN ? AND ?
    `;
    const [msgRows] = await pool.query(messageStatsQuery, [
      rangeStart,
      rangeEnd,
    ]);
    const msgStats = msgRows[0] || {};

    // 3. Placement campaign counts for the selected date range
    const rangeCampQuery = `
      SELECT
        COUNT(*) AS total_campaigns_range,
        SUM(CASE WHEN campaign_type = 'Single' THEN 1 ELSE 0 END) AS single_campaigns_range,
        SUM(CASE WHEN campaign_type = 'Bulk' THEN 1 ELSE 0 END) AS bulk_campaigns_range,
        SUM(CASE WHEN campaign_status = 'Completed' THEN 1 ELSE 0 END) AS completed_campaigns,
        SUM(CASE WHEN campaign_status = 'Processing' THEN 1 ELSE 0 END) AS processing_campaigns,
        SUM(CASE WHEN campaign_status = 'Failed' THEN 1 ELSE 0 END) AS failed_campaigns
      FROM whatsapp_placement_campaigns
      WHERE created_at BETWEEN ? AND ?
    `;
    const [rangeCampRows] = await pool.query(rangeCampQuery, [
      rangeStart,
      rangeEnd,
    ]);
    const rangeCamp = rangeCampRows[0] || {};

    return {
      today: {
        total_campaigns: Number(todayCamp.total_campaigns_today || 0),
        single_campaigns: Number(todayCamp.single_campaigns_today || 0),
        bulk_campaigns: Number(todayCamp.bulk_campaigns_today || 0),
      },
      range: {
        fromDate: fromDate || todayStr,
        toDate: toDate || todayStr,
        total_campaigns: Number(rangeCamp.total_campaigns_range || 0),
        single_campaigns: Number(rangeCamp.single_campaigns_range || 0),
        bulk_campaigns: Number(rangeCamp.bulk_campaigns_range || 0),
        completed_campaigns: Number(rangeCamp.completed_campaigns || 0),
        processing_campaigns: Number(rangeCamp.processing_campaigns || 0),
        failed_campaigns: Number(rangeCamp.failed_campaigns || 0),
      },
      messages: {
        total: Number(msgStats.total_messages || 0),
        sent: Number(msgStats.sent_messages || 0),
        delivered: Number(msgStats.delivered_messages || 0),
        read: Number(msgStats.read_messages || 0),
        failed: Number(msgStats.failed_messages || 0),
        pending: Number(msgStats.pending_messages || 0),
      },
    };
  },

  /**
   * Determine which placement template flag corresponds to the given template
   * - Placement Welcome Message -> placement_welcome_message
   * - Placement Registration Link -> placement_registration_link
   * - Add-On Course -> add_on_course (and placement_add_on_course)
   */
  getTemplateFlagType: (template, explicitType = null) => {
    if (explicitType) {
      const norm = String(explicitType).trim().toLowerCase();
      if (norm.includes("welcome")) return "placement_welcome_message";
      if (norm.includes("regist") || norm.includes("link"))
        return "placement_registration_link";
      if (
        norm.includes("add") ||
        norm.includes("addon") ||
        norm.includes("course")
      )
        return "add_on_course";
    }

    if (!template) return null;
    const combined =
      `${template.template_key || ""} ${template.template_label || ""} ${template.campaign_name || ""} ${template.description || ""}`.toLowerCase();

    if (combined.includes("welcome")) {
      return "placement_welcome_message";
    }
    if (
      combined.includes("registration") ||
      combined.includes("register") ||
      combined.includes("reg_link")
    ) {
      return "placement_registration_link";
    }
    if (
      combined.includes("add_on") ||
      combined.includes("addon") ||
      combined.includes("add on") ||
      combined.includes("add-on")
    ) {
      return "add_on_course";
    }

    return null;
  },

  /**
   * Update the placement template status flag for a customer after successful sending.
   * Handles repeated sends using ON DUPLICATE KEY UPDATE so only existing records are updated
   * without creating duplicate entries.
   */
  updateCustomerTemplateStatus: async (
    customer_id,
    flagType,
    connection = null,
  ) => {
    const custId = Number(customer_id);
    if (!Number.isSafeInteger(custId) || custId <= 0 || !flagType) return null;

    await ensureTemplateStatusTableInitialized();
    const db = connection || pool;
    const nowIST = formatToBackendIST();

    if (flagType === "placement_welcome_message") {
      const query = `
        INSERT INTO customer_placement_template_status (
          customer_id,
          placement_welcome_message,
          welcome_message_sent_at,
          created_at,
          updated_at
        )
        VALUES (?, 1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          placement_welcome_message = 1,
          welcome_message_sent_at = COALESCE(welcome_message_sent_at, VALUES(welcome_message_sent_at)),
          updated_at = VALUES(updated_at)
      `;
      const [result] = await db.query(query, [custId, nowIST, nowIST, nowIST]);
      return result;
    }

    if (flagType === "placement_registration_link") {
      const query = `
        INSERT INTO customer_placement_template_status (
          customer_id,
          placement_registration_link,
          registration_link_sent_at,
          created_at,
          updated_at
        )
        VALUES (?, 1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          placement_registration_link = 1,
          registration_link_sent_at = COALESCE(registration_link_sent_at, VALUES(registration_link_sent_at)),
          updated_at = VALUES(updated_at)
      `;
      const [result] = await db.query(query, [custId, nowIST, nowIST, nowIST]);
      return result;
    }

    if (
      flagType === "add_on_course" ||
      flagType === "placement_add_on_course"
    ) {
      const query = `
        INSERT INTO customer_placement_template_status (
          customer_id,
          add_on_course,
          placement_add_on_course,
          add_on_course_sent_at,
          created_at,
          updated_at
        )
        VALUES (?, 1, 1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          add_on_course = 1,
          placement_add_on_course = 1,
          add_on_course_sent_at = COALESCE(add_on_course_sent_at, VALUES(add_on_course_sent_at)),
          updated_at = VALUES(updated_at)
      `;
      const [result] = await db.query(query, [custId, nowIST, nowIST, nowIST]);
      return result;
    }

    return null;
  },

  /**
   * Get template status flags for a specific customer
   */
  getCustomerTemplateStatus: async (customer_id, connection = null) => {
    const custId = Number(customer_id);
    if (!Number.isSafeInteger(custId) || custId <= 0) return null;

    const db = connection || pool;
    const [rows] = await db.query(
      `SELECT
        customer_id,
        placement_welcome_message,
        placement_registration_link,
        add_on_course,
        placement_add_on_course,
        welcome_message_sent_at,
        registration_link_sent_at,
        add_on_course_sent_at,
        created_at,
        updated_at
      FROM customer_placement_template_status
      WHERE customer_id = ?
      LIMIT 1`,
      [custId],
    );

    if (rows.length) {
      return rows[0];
    }

    return {
      customer_id: custId,
      placement_welcome_message: 0,
      placement_registration_link: 0,
      add_on_course: 0,
      placement_add_on_course: 0,
      welcome_message_sent_at: null,
      registration_link_sent_at: null,
      add_on_course_sent_at: null,
      created_at: null,
      updated_at: null,
    };
  },
};

module.exports = WhatsAppPlacementCampaignModel;
