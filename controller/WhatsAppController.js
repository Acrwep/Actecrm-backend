const axios = require("axios");

const WhatsAppTemplateConfigModal = require("../models/WhatsAppTemplateConfigModal");
const WhatsAppCampaignModel = require("../models/WhatsAppCampaignModel");

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
  let campaign_id = null;
  const nowIST = WhatsAppCampaignModel.formatToBackendIST();

  try {
    const {
      template_id,
      mobile,
      customer_name,
      lead_id,
      region_id,
      branch_id,
      course_id,
      values = {},
      media_url,
      media_filename,
      sent_by,
      created_at,
      campaign_name: customCampaignName,
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

    // Only allow URLs from trusted invoice/file domain.
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

    // Generate unique Campaign ID for tracking (e.g. CAMP-S-OCT132026-001)
    campaign_id = await WhatsAppCampaignModel.generateCampaignId("Single");
    const userSender = sent_by || req.user?.user_id || "CRM User";
    const campName =
      customCampaignName ||
      `${template.template_label || template.campaign_name} - Single to ${mobile}`;

    // 1. Create campaign record before sending
    await WhatsAppCampaignModel.createCampaign({
      campaign_id,
      campaign_name: campName,
      campaign_type: "Single",
      template_id: template.id,
      template_name: template.template_label || template.campaign_name,
      region_id: region_id || null,
      branch_id: branch_id || null,
      course_id: course_id || null,
      created_by: userSender,
      total_recipients: 1,
      pending_count: 1,
      success_count: 0,
      failed_count: 0,
      campaign_status: "Processing",
      started_at: nowIST,
      created_at: created_at || nowIST,
    });

    // 2. Create recipient record in pending state
    await WhatsAppCampaignModel.createCampaignMessages([
      {
        campaign_id,
        lead_id: lead_id || null,
        recipient_name: customer_name || null,
        mobile_number: mobile,
        message_status: "Pending",
        template_params: templateParams,
        media_url: media_url || null,
        created_at: created_at || nowIST,
      },
    ]);

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

    const submittedMessageId =
      response.data?.submitted_message_id ||
      response.data?.messageId ||
      response.data?.id ||
      null;

    const completedIST = WhatsAppCampaignModel.formatToBackendIST();

    // 3. Update recipient message to Sent
    await WhatsAppCampaignModel.updateMessageStatus(
      { campaign_id, mobile_number: mobile },
      {
        message_status: "Sent",
        aisensy_message_id: submittedMessageId,
        sent_at: completedIST,
      },
    );

    // 4. Update campaign summary counts to Completed
    await WhatsAppCampaignModel.recalculateCampaignCounts(campaign_id);

    return res.status(200).json({
      success: true,
      message: "WhatsApp request accepted by AiSensy",
      campaign_id,
      data: response.data,
    });
  } catch (error) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.errorMessage ||
      error.response?.data ||
      error.message;

    console.error("Generic WhatsApp send error:", errorMsg);

    const failedIST = WhatsAppCampaignModel.formatToBackendIST();

    if (campaign_id) {
      try {
        await WhatsAppCampaignModel.updateMessageStatus(
          { campaign_id, mobile_number: req.body.mobile },
          {
            message_status: "Failed",
            error_message:
              typeof errorMsg === "object"
                ? JSON.stringify(errorMsg)
                : String(errorMsg),
            failed_at: failedIST,
          },
        );
        await WhatsAppCampaignModel.recalculateCampaignCounts(campaign_id);
      } catch (campErr) {
        console.error("Campaign update error during failure:", campErr.message);
      }
    }

    return res.status(error.response ? 502 : 500).json({
      success: false,
      message: "Failed to send WhatsApp message",
      campaign_id,
      error: error.response?.data || error.message,
    });
  }
};

const sendBulkTemplateWhatsApp = async (req, res) => {
  try {
    const {
      template_id,
      leads,
      campaign_name: customCampaignName,
      region_id,
      branch_id,
      course_id,
    } = req.body;

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

    // Generate Campaign ID (e.g. CAMP-B-OCT132026-001)
    const campaign_id = await WhatsAppCampaignModel.generateCampaignId("Bulk");
    const nowIST = WhatsAppCampaignModel.formatToBackendIST();
    const createdBy = leads[0]?.sent_by || req.user?.user_id || "CRM User";
    const campName =
      customCampaignName ||
      `${template.template_label || template.campaign_name} - Bulk (${leads.length} recipients)`;

    // 1. Create campaign record before sending
    await WhatsAppCampaignModel.createCampaign({
      campaign_id,
      campaign_name: campName,
      campaign_type: "Bulk",
      template_id: template.id,
      template_name: template.template_label || template.campaign_name,
      region_id: region_id || null,
      branch_id: branch_id || null,
      course_id: course_id || null,
      created_by: createdBy,
      total_recipients: leads.length,
      pending_count: leads.length,
      success_count: 0,
      failed_count: 0,
      campaign_status: "Processing",
      started_at: nowIST,
      created_at: nowIST,
    });

    // 2. Batch insert recipient message records in Pending state
    const recipientRecords = leads.map((lead) => ({
      campaign_id,
      lead_id: lead.lead_id || lead.id || null,
      recipient_name: lead.customer_name || lead.name || null,
      mobile_number: String(
        lead.mobile || lead.whatsapp || lead.phone || "",
      ).trim(),
      message_status: "Pending",
      template_params: lead.values || null,
      media_url: lead.media_url || null,
      created_at: lead.created_at || nowIST,
    }));

    await WhatsAppCampaignModel.createCampaignMessages(recipientRecords);

    // 3. Send response instantly so frontend doesn't hang or timeout
    res.status(200).json({
      success: true,
      campaign_id,
      message: `Initiated bulk sending for ${leads.length} contacts under campaign ${campaign_id}. This will run in the background.`,
    });

    // 4. Run the loop in an async background function (IIFE)
    (async () => {
      let successCount = 0;
      let failedCount = 0;

      const allowedHosts = (
        process.env.WHATSAPP_MEDIA_ALLOWED_HOSTS || "actecrm.com"
      )
        .split(",")
        .map((host) => host.trim().toLowerCase());

      for (const lead of leads) {
        const destMobile = String(
          lead.mobile || lead.whatsapp || lead.phone || "",
        ).trim();

        try {
          const {
            customer_name,
            lead_id,
            values = {},
            media_url,
            media_filename,
          } = lead;

          if (!destMobile) {
            throw new Error("Mobile number is required for this lead");
          }

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
            destination: destMobile,
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

          const submittedMessageId =
            response.data?.submitted_message_id ||
            response.data?.messageId ||
            response.data?.id ||
            null;

          const sentIST = WhatsAppCampaignModel.formatToBackendIST();

          // Update recipient message
          await WhatsAppCampaignModel.updateMessageStatus(
            { campaign_id, mobile_number: destMobile },
            {
              message_status: "Sent",
              aisensy_message_id: submittedMessageId,
              sent_at: sentIST,
            },
          );

          successCount++;
          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          failedCount++;
          const errorMsg =
            err.response?.data?.message ||
            err.response?.data?.errorMessage ||
            err.response?.data ||
            err.message;

          const failedIST = WhatsAppCampaignModel.formatToBackendIST();

          try {
            await WhatsAppCampaignModel.updateMessageStatus(
              { campaign_id, mobile_number: destMobile },
              {
                message_status: "Failed",
                error_message:
                  typeof errorMsg === "object"
                    ? JSON.stringify(errorMsg)
                    : String(errorMsg),
                failed_at: failedIST,
              },
            );
          } catch (updateErr) {
            console.error(
              "Error updating message status on failure:",
              updateErr.message,
            );
          }
        }
      }

      // Recalculate campaign summary counts for absolute accuracy
      await WhatsAppCampaignModel.recalculateCampaignCounts(campaign_id);

      console.log(
        `[Bulk WhatsApp Complete] Campaign: ${campaign_id}, Sent: ${successCount}, Failed: ${failedCount}`,
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

const getCampaigns = async (req, res) => {
  try {
    const {
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
    } = req.query;

    const result = await WhatsAppCampaignModel.getCampaigns({
      page,
      limit,
      search,
      campaignType,
      status,
      fromDate,
      toDate,
      createdBy,
      region_id,
      branch_id,
      course_id,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get campaigns error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns",
      error: error.message,
    });
  }
};

const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await WhatsAppCampaignModel.getCampaignById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error("Get campaign by ID error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaign details",
      error: error.message,
    });
  }
};

const getCampaignMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, search = "", status = "" } = req.query;

    const result = await WhatsAppCampaignModel.getCampaignMessages(id, {
      page,
      limit,
      search,
      status,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get campaign messages error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaign messages",
      error: error.message,
    });
  }
};

const getCampaignStatistics = async (req, res) => {
  try {
    const { fromDate = "", toDate = "" } = req.query;
    const stats = await WhatsAppCampaignModel.getStatistics({
      fromDate,
      toDate,
    });

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get campaign statistics error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaign statistics",
      error: error.message,
    });
  }
};

const verifyAiSensyWebhook = async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"] || req.query.challenge;

    if (challenge) {
      console.log("[AiSensy Webhook Verified Handshake]: challenge responded");
      return res.status(200).send(challenge);
    }

    return res.status(200).json({
      success: true,
      message: "AiSensy WhatsApp Webhook endpoint is active and healthy",
      timestamp: WhatsAppCampaignModel.formatToBackendIST(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const handleAiSensyWebhook = async (req, res) => {
  try {
    const body = req.body;
    console.log("[AiSensy Webhook Received]:", JSON.stringify(body));

    // Handle Meta WhatsApp Cloud format: entry[].changes[].value.statuses[]
    if (Array.isArray(body?.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          for (const st of change.value?.statuses || []) {
            await WhatsAppCampaignModel.updateMessageByAisensyId(st.id, {
              status: st.status,
              error: st.errors?.[0] || null,
              timestamp: st.timestamp,
              destination: st.recipient_id,
            });
          }
        }
      }
    }
    // Handle AiSensy standard event format: { event: "message_status", data: { id, status, recipient_id, destination, timestamp, errors } }
    else if (body?.event === "message_status" && body?.data) {
      await WhatsAppCampaignModel.updateMessageByAisensyId(
        body.data.id || body.data.message_id || body.data.submitted_message_id,
        {
          status: body.data.status,
          error: body.data.errors?.[0] || body.data.error,
          timestamp: body.data.timestamp,
          destination:
            body.data.recipient_id ||
            body.data.destination ||
            body.data.mobile ||
            body.data.recipient,
        },
      );
    }
    // Handle flat payload format: { message_id / submitted_message_id, destination, status }
    else if (
      body?.submitted_message_id ||
      body?.message_id ||
      body?.id ||
      body?.destination ||
      body?.mobile
    ) {
      const msgId =
        body.submitted_message_id || body.message_id || body.id || null;
      await WhatsAppCampaignModel.updateMessageByAisensyId(msgId, {
        status: body.status,
        error: body.error || body.errors,
        timestamp: body.timestamp,
        destination:
          body.destination ||
          body.recipient_id ||
          body.mobile ||
          body.recipient,
      });
    }

    // Always respond 200 to acknowledge webhook
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Error processing AiSensy webhook:", error);
    return res.status(200).json({
      success: false,
      message: "Webhook received with errors",
      error: error.message,
    });
  }
};

const simulateMessageStatus = async (req, res) => {
  try {
    const { message_id, aisensy_message_id, mobile, status } = req.body;

    if (!status || !["Delivered", "Read", "Failed", "Sent"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be one of: Delivered, Read, Failed, Sent",
      });
    }

    let updated = null;
    if (message_id) {
      const nowIST = WhatsAppCampaignModel.formatToBackendIST();
      const updateData = { message_status: status };
      if (status === "Delivered") updateData.delivered_at = nowIST;
      if (status === "Read") {
        updateData.read_at = nowIST;
        updateData.delivered_at = nowIST;
      }
      if (status === "Failed") updateData.failed_at = nowIST;

      await WhatsAppCampaignModel.updateMessageStatus(
        { id: message_id },
        updateData,
      );
      const [rows] = await require("../config/dbconfig").query(
        "SELECT campaign_id FROM whatsapp_campaign_messages WHERE id = ? LIMIT 1",
        [message_id],
      );
      if (rows.length) {
        await WhatsAppCampaignModel.recalculateCampaignCounts(
          rows[0].campaign_id,
        );
      }
      updated = { messageId: message_id, newStatus: status };
    } else {
      updated = await WhatsAppCampaignModel.updateMessageByAisensyId(
        aisensy_message_id,
        {
          status,
          destination: mobile,
        },
      );
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error("Simulate status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to simulate message status",
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
  getCampaigns,
  getCampaignById,
  getCampaignMessages,
  getCampaignStatistics,
  handleAiSensyWebhook,
  verifyAiSensyWebhook,
  simulateMessageStatus,
};
