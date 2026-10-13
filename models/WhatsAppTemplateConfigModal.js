const pool = require("../config/dbconfig");

const WhatsAppTemplateConfigModel = {
  create: async (data) => {
    const {
      template_key,
      template_label,
      campaign_name,
      description,
      category,
      language,
      parameters,
      media_required,
      media_type,
      created_by,
      created_at,
    } = data;

    const query = `
      INSERT INTO whatsapp_template_configs (
        template_key,
        template_label,
        campaign_name,
        description,
        category,
        language,
        parameters,
        media_required,
        media_type,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      template_key,
      template_label,
      campaign_name,
      description || null,
      category || "UTILITY",
      language || "en",
      JSON.stringify(parameters),
      media_required ? 1 : 0,
      media_type || null,
      created_by || null,
      created_at || null,
    ]);

    return result;
  },

  getAll: async ({ activeOnly = false } = {}) => {
    const query = `
      SELECT *
      FROM whatsapp_template_configs
      ${activeOnly ? "WHERE is_active = 1" : ""}
      ORDER BY created_at DESC
    `;

    const [rows] = await pool.query(query);

    return rows.map((row) => ({
      ...row,
      parameters:
        typeof row.parameters === "string"
          ? JSON.parse(row.parameters)
          : row.parameters,
      media_required: Boolean(row.media_required),
      is_active: Boolean(row.is_active),
    }));
  },

  getById: async (id) => {
    const [rows] = await pool.query(
      `SELECT * FROM whatsapp_template_configs WHERE id = ? LIMIT 1`,
      [id],
    );

    if (!rows.length) return null;

    const row = rows[0];

    return {
      ...row,
      parameters:
        typeof row.parameters === "string"
          ? JSON.parse(row.parameters)
          : row.parameters,
      media_required: Boolean(row.media_required),
      is_active: Boolean(row.is_active),
    };
  },

  update: async (id, data) => {
    const {
      template_label,
      campaign_name,
      description,
      category,
      language,
      parameters,
      media_required,
      media_type,
      updated_at,
      is_active,
    } = data;

    const query = `
      UPDATE whatsapp_template_configs
      SET
        template_label = ?,
        campaign_name = ?,
        description = ?,
        category = ?,
        language = ?,
        parameters = ?,
        media_required = ?,
        media_type = ?,
        updated_at = ?,
        is_active = ?
      WHERE id = ?
    `;

    const [result] = await pool.query(query, [
      template_label,
      campaign_name,
      description || null,
      category || "UTILITY",
      language || "en",
      JSON.stringify(parameters),
      media_required ? 1 : 0,
      media_type || null,
      updated_at,
      is_active ? 1 : 0,
      id,
    ]);

    return result;
  },

  delete: async (id, updated_at = null) => {
    let query;
    let params;

    if (updated_at) {
      query = `UPDATE whatsapp_template_configs SET is_active = 0, updated_at = ? WHERE id = ?`;
      params = [updated_at, id];
    } else {
      query = `UPDATE whatsapp_template_configs SET is_active = 0 WHERE id = ?`;
      params = [id];
    }

    const [result] = await pool.query(query, params);
    return result;
  },
};

module.exports = WhatsAppTemplateConfigModel;
