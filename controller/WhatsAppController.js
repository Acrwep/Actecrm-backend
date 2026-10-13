const axios = require("axios");

const WhatsAppTemplateConfigModal = require("../models/WhatsAppTemplateConfigModal");

const WhatsAppModel = require("../models/WhatsAppModal");

const createTemplateConfig = async (req, res) => {
  try {
    const {
      template_key,
      template_label,
      campaign_name,
      parameters,
      media_required,
      media_type,
      description,
      category,
      language,
      created_by,
      created_at,
    } = req.body;

    if (
      !template_key ||
      !template_label ||
      !campaign_name ||
      !Array.isArray(parameters)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Template key, label, campaign name and parameters are required",
      });
    }

    if (
      parameters.some(
        (p) => !p.key || !p.label || typeof p.required !== "boolean",
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Each parameter requires key, label and boolean required",
      });
    }

    if (new Set(parameters.map((p) => p.key)).size !== parameters.length) {
      return res.status(400).json({
        success: false,
        message: "Parameter keys must be unique",
      });
    }

    const result = await WhatsAppTemplateConfigModal.create({
      template_key,
      template_label,
      campaign_name,
      parameters,
      media_required,
      media_type,
      description,
      category,
      language,
      created_by,
      created_at,
    });

    return res.status(201).json({
      success: true,
      message: "Template configuration created",
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error("Create template config:", error.message);

    return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message:
        error.code === "ER_DUP_ENTRY"
          ? "Template key already exists"
          : "Failed to create template configuration",
    });
  }
};

const getTemplateConfigs = async (req, res) => {
  try {
    const templates = await WhatsAppTemplateConfigModal.getAll({
      activeOnly: req.query.activeOnly === "true",
    });

    return res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Get template configs:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch template configurations",
    });
  }
};

const updateTemplateConfig = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid template ID",
      });
    }

    const existing = await WhatsAppTemplateConfigModal.getById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Template configuration not found",
      });
    }

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
    } = req.body;

    if (!template_label || !campaign_name || !Array.isArray(parameters)) {
      return res.status(400).json({
        success: false,
        message: "Template label, campaign name and parameters are required",
      });
    }

    if (
      parameters.some(
        (p) => !p.key || !p.label || typeof p.required !== "boolean",
      ) ||
      new Set(parameters.map((p) => p.key)).size !== parameters.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or duplicate template parameters",
      });
    }

    await WhatsAppTemplateConfigModal.update(id, {
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
    });

    return res.status(200).json({
      success: true,
      message: "Template configuration updated",
    });
  } catch (error) {
    console.error("Update template config:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update template configuration",
    });
  }
};

const deleteTemplateConfig = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid template ID",
      });
    }

    const existing = await WhatsAppTemplateConfigModal.getById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Template configuration not found",
      });
    }

    if (!existing.is_active) {
      return res.status(200).json({
        success: true,
        message: "Template configuration is already inactive",
        data: { id },
      });
    }

    await WhatsAppTemplateConfigModal.delete(id, req.body?.updated_at);

    return res.status(200).json({
      success: true,
      message: "Template configuration marked as inactive successfully",
      data: { id },
    });
  } catch (error) {
    console.error("Delete template config:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete template configuration",
    });
  }
};

const sendTemplateWhatsApp = async (req, res) => {
  let template;

  try {
    const {
      template_id,
      mobile,
      customer_name,
      lead_id,
      customer_id,
      values = {},
      media_url,
      media_filename,
      sent_by,
      created_at,
    } = req.body;

    if (!template_id || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Template ID and mobile number are required",
      });
    }

    template = await WhatsAppTemplateConfigModal.getById(template_id);

    if (!template || !template.is_active) {
      return res.status(404).json({
        success: false,
        message: "Active template configuration not found",
      });
    }

    if (!Array.isArray(template.parameters)) {
      return res.status(500).json({
        success: false,
        message: "Invalid template parameter configuration",
      });
    }

    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return res.status(400).json({
        success: false,
        message: "Template values must be an object",
      });
    }

    const templateParams = [];

    for (const parameter of template.parameters) {
      const value = values[parameter.key];

      if (
        parameter.required &&
        (value === undefined || value === null || String(value).trim() === "")
      ) {
        return res.status(400).json({
          success: false,
          message: `${parameter.label} is required`,
        });
      }

      templateParams.push(
        value === undefined || value === null ? "" : String(value),
      );
    }

    if (template.media_required && !media_url) {
      return res.status(400).json({
        success: false,
        message: "Media URL is required for this template",
      });
    }

    // Only allow URLs from your trusted invoice/file domain.
    if (media_url) {
      let parsedUrl;

      try {
        parsedUrl = new URL(media_url);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid media URL",
        });
      }

      const allowedHosts = (
        process.env.WHATSAPP_MEDIA_ALLOWED_HOSTS || "actecrm.com"
      )
        .split(",")
        .map((host) => host.trim().toLowerCase());

      if (
        parsedUrl.protocol !== "https:" ||
        !allowedHosts.includes(parsedUrl.hostname.toLowerCase()) ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        return res.status(400).json({
          success: false,
          message: "Media URL host is not allowed",
        });
      }
    }

    const payload = {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: template.campaign_name,
      destination: mobile,
      userName: customer_name || "Customer",
      source: "ACTE CRM",
      templateParams,
    };

    if (media_url) {
      payload.media = {
        url: media_url,
        filename: media_filename || "attachment.pdf",
      };
    }

    const response = await axios.post(process.env.AISENSY_API_URL, payload, {
      timeout: 20000,
    });

    // Keep existing WhatsApp history integration.
    await WhatsAppModel.createMessage({
      lead_id,
      customer_id,
      mobile,
      customer_name,
      course_name: values.course_name || null,
      campaign_name: template.campaign_name,
      template_params: templateParams,
      status: "sent",
      aisensy_response: response.data,
      sent_by: sent_by,
      created_at: created_at,
    });

    return res.status(200).json({
      success: true,
      message: "WhatsApp request accepted by AiSensy",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Generic WhatsApp send error:",
      error.response?.data || error.message,
    );

    // Record a failed attempt when the template was resolved.
    // A network error may still mean AiSensy received the request.
    if (template) {
      try {
        await WhatsAppModel.createMessage({
          lead_id: req.body.lead_id,
          customer_id: req.body.customer_id,
          mobile: req.body.mobile,
          customer_name: req.body.customer_name,
          course_name: req.body.values?.course_name || null,
          campaign_name: template.campaign_name,
          template_params: [],
          status: "failed",
          aisensy_response: {
            message: error.response?.data || error.message,
          },
          sent_by: req.body.sent_by,
          created_at: req.body.created_at,
        });
      } catch (historyError) {
        console.error("WhatsApp history error:", historyError.message);
      }
    }

    return res.status(error.response ? 502 : 500).json({
      success: false,
      message: "Failed to send WhatsApp message",
      error: error.response?.data || error.message,
    });
  }
};

const sendBulkTemplateWhatsApp = async (req, res) => {
  try {
    const { template_id, leads } = req.body;

    if (!template_id || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Template ID and a list of leads are required",
      });
    }

    const template = await WhatsAppTemplateConfigModal.getById(template_id);
    if (!template || !template.is_active) {
      return res.status(404).json({
        success: false,
        message: "Active template configuration not found",
      });
    }

    if (!Array.isArray(template.parameters)) {
      return res.status(500).json({
        success: false,
        message: "Invalid template parameter configuration",
      });
    }

    // Send response instantly so frontend doesn't hang or timeout
    res.status(200).json({
      success: true,
      message: `Initiated bulk sending for ${leads.length} contacts. This will run in the background.`,
    });

    // Run the loop in an async background function (IIFE)
    (async () => {
      let successCount = 0;
      let failedCount = 0;
      let errors = [];

      const allowedHosts = (
        process.env.WHATSAPP_MEDIA_ALLOWED_HOSTS || "actecrm.com"
      )
        .split(",")
        .map((host) => host.trim().toLowerCase());

      for (const lead of leads) {
        try {
          const {
            mobile,
            customer_name,
            lead_id,
            customer_id,
            values = {},
            media_url,
            media_filename,
          } = lead;

          if (!mobile)
            throw new Error("Mobile number is required for this lead");

          if (!values || typeof values !== "object" || Array.isArray(values)) {
            throw new Error("Template values must be an object");
          }

          const templateParams = [];

          for (const parameter of template.parameters) {
            const value = values[parameter.key];

            if (
              parameter.required &&
              (value === undefined ||
                value === null ||
                String(value).trim() === "")
            ) {
              throw new Error(`${parameter.label} is required`);
            }

            templateParams.push(
              value === undefined || value === null ? "" : String(value),
            );
          }

          if (template.media_required && !media_url) {
            throw new Error("Media URL is required for this template");
          }

          if (media_url) {
            let parsedUrl;
            try {
              parsedUrl = new URL(media_url);
            } catch {
              throw new Error("Invalid media URL");
            }

            if (
              parsedUrl.protocol !== "https:" ||
              !allowedHosts.includes(parsedUrl.hostname.toLowerCase()) ||
              parsedUrl.username ||
              parsedUrl.password
            ) {
              throw new Error("Media URL host is not allowed");
            }
          }

          const payload = {
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: template.campaign_name,
            destination: mobile,
            userName: customer_name || "Customer",
            source: "ACTE CRM",
            templateParams,
          };

          if (media_url) {
            payload.media = {
              url: media_url,
              filename: media_filename || "attachment.pdf",
            };
          }

          const response = await axios.post(
            process.env.AISENSY_API_URL,
            payload,
            {
              timeout: 20000,
            },
          );

          await WhatsAppModel.createMessage({
            lead_id,
            customer_id,
            mobile,
            customer_name,
            course_name: values.course_name || null,
            campaign_name: template.campaign_name,
            template_params: templateParams,
            status: "sent",
            aisensy_response: response.data,
            sent_by: lead.sent_by,
            created_at: lead.created_at,
          });

          successCount++;
          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          failedCount++;
          errors.push({
            mobile: lead.mobile,
            error: err.response?.data || err.message,
          });

          try {
            await WhatsAppModel.createMessage({
              lead_id: lead.lead_id,
              customer_id: lead.customer_id,
              mobile: lead.mobile,
              customer_name: lead.customer_name,
              course_name: lead.values?.course_name || null,
              campaign_name: template.campaign_name,
              template_params: [],
              status: "failed",
              aisensy_response: { message: err.response?.data || err.message },
              sent_by: lead.sent_by,
              created_at: lead.created_at,
            });
          } catch (historyError) {
            console.error(
              "WhatsApp history error during bulk failure log:",
              historyError.message,
            );
          }
        }
      }

      console.log(
        `[Bulk WhatsApp Complete] Sent: ${successCount}, Failed: ${failedCount}`,
      );
    })();
  } catch (error) {
    console.error("Bulk Send Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during bulk send",
      error: error.message,
    });
  }
};

module.exports = {
  createTemplateConfig,
  getTemplateConfigs,
  updateTemplateConfig,
  deleteTemplateConfig,
  sendTemplateWhatsApp,
  sendBulkTemplateWhatsApp,
};
