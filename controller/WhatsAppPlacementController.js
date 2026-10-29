const axios = require("axios");
const pool = require("../config/dbconfig");

const WhatsAppTemplateConfigModal = require("../models/WhatsAppTemplateConfigModal");
const WhatsAppPlacementCampaignModel = require("../models/WhatsAppPlacementCampaignModel");
const CustomerModel = require("../models/CustomerModel");

/**
 * Helper to validate allowed media host
 */
function isMediaUrlAllowed(media_url) {
  if (!media_url) return true;
  const allowedHosts = (
    process.env.WHATSAPP_MEDIA_ALLOWED_HOSTS || "actecrm.com"
  )
    .split(",")
    .map((host) => host.trim().toLowerCase());

  try {
    const parsedUrl = new URL(media_url);
    if (
      parsedUrl.protocol !== "https:" ||
      !allowedHosts.includes(parsedUrl.hostname.toLowerCase()) ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch eligible placement customers using CustomerModel.getPlacementSupport
 */
const getEligiblePlacementCustomers = async (req, res) => {
  try {
    const {
      from_date,
      to_date,
      search_filter,
      user_ids,
      course_ids,
      page = 1,
      limit = 100,
      bucket,
      region_id,
      branch_id,
      status,
      class_going_sub_bucket,
    } = req.body || {};

    const rawResult = await CustomerModel.getPlacementSupport(
      from_date,
      to_date,
      search_filter,
      user_ids,
      course_ids,
      page,
      limit,
      bucket,
      region_id,
      branch_id,
      status,
      class_going_sub_bucket,
    );

    const rawCustomerList =
      rawResult?.customers || rawResult?.customerData || [];
    const customers = rawCustomerList.map((item) => {
      const rawMobile = item.whatsapp || item.phone || "";
      const cleanMobile = String(rawMobile).trim();
      return {
        customer_id: item.id,
        customer_name: item.name,
        email: item.email || null,
        mobile: cleanMobile,
        phone: item.phone || null,
        whatsapp: item.whatsapp || null,
        phonecode: item.whatsapp_phone_code || item.phonecode || "+91",
        region_id: item.region_id || null,
        region_name: item.region_name || null,
        branch_id: item.branch_id || null,
        branch_name: item.branch_name || null,
        course_id: item.enrolled_course || null,
        course_name: item.course_name || null,
        student_id: item.student_id || null,
        status: item.status || null,
        placement_support: item.placement_support || "Need",
        class_percentage: item.class_percentage || 0,
        date_of_joining: item.date_of_joining || null,
        placement_welcome_message: Number(item.placement_welcome_message || 0),
        placement_registration_link: Number(item.placement_registration_link || 0),
        add_on_course: Number(item.add_on_course || 0),
        placement_add_on_course: Number(
          item.placement_add_on_course || item.add_on_course || 0,
        ),
        welcome_message_sent_at: item.welcome_message_sent_at || null,
        registration_link_sent_at: item.registration_link_sent_at || null,
        add_on_course_sent_at: item.add_on_course_sent_at || null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Eligible placement customers fetched successfully",
      data: {
        customers,
        total: rawResult?.total || 0,
        total_count: rawResult?.total_count || 0,
        onlineMode: rawResult?.onlineMode || 0,
        classroomMode: rawResult?.classroomMode || 0,
        chennai: rawResult?.chennai || 0,
        bangalore: rawResult?.bangalore || 0,
        hub: rawResult?.hub || 0,
        cusStatusCount: rawResult?.cusStatusCount || {},
        classGoingSubBucketCount: rawResult?.classGoingSubBucketCount || {},
      },
    });
  } catch (error) {
    console.error("getEligiblePlacementCustomers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch eligible placement customers",
      error: error.message,
    });
  }
};

/**
 * Send Single WhatsApp Template Message for a Placement Customer
 */
const sendSinglePlacementTemplateWhatsApp = async (req, res) => {
  let campaign_id = null;
  const nowIST = WhatsAppPlacementCampaignModel.formatToBackendIST();

  try {
    const {
      mobile_number,
      mobile,
      whatsapp,
      phone,
      template_id,
      customer_id,
      id,
      customer_name,
      recipient_name,
      name,
      values = {},
      campaign_name: customCampaignName,
      media_url,
      media_filename,
      region_id,
      branch_id,
      course_id,
      sent_by,
    } = req.body;

    const targetMobile = String(
      mobile_number || mobile || whatsapp || phone || "",
    ).trim();
    const targetCustomerId = customer_id || id || null;
    const targetName = recipient_name || customer_name || name || "Customer";

    if (!targetMobile || !template_id) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and template ID are required",
      });
    }

    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return res.status(400).json({
        success: false,
        message: "Values must be an object of template parameters",
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

    if (template.media_required && !media_url) {
      return res.status(400).json({
        success: false,
        message: "Media URL is required for this template",
      });
    }

    if (media_url && !isMediaUrlAllowed(media_url)) {
      return res.status(400).json({
        success: false,
        message: "Media URL host is not allowed or URL is invalid",
      });
    }

    const templateParams = [];
    for (const parameter of template.parameters) {
      let value = values[parameter.key];

      // Smart fallback: recipient name
      if (
        (value === undefined || value === null || String(value).trim() === "") &&
        ["name", "customer_name", "student_name", "recipient_name"].includes(
          parameter.key.toLowerCase(),
        )
      ) {
        value = targetName;
      }

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

    // Generate Placement Campaign ID (e.g. PCAMP-S-OCT292026-01)
    campaign_id =
      await WhatsAppPlacementCampaignModel.generateCampaignId("Single");
    const userSender = sent_by || req.user?.user_id || "CRM User";
    const campName =
      customCampaignName ||
      `${template.template_label || template.campaign_name} - Placement Single to ${targetMobile}`;

    // 1. Create placement campaign record
    await WhatsAppPlacementCampaignModel.createCampaign({
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
      created_at: nowIST,
    });

    // 2. Create message record with customer_id
    await WhatsAppPlacementCampaignModel.createCampaignMessages([
      {
        campaign_id,
        customer_id: targetCustomerId,
        recipient_name: targetName,
        mobile_number: targetMobile,
        message_status: "Pending",
        template_params: values,
        media_url: media_url || null,
        created_at: nowIST,
      },
    ]);

    // 3. Send via AiSensy
    const payload = {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: template.campaign_name,
      destination: targetMobile,
      userName: targetName,
      source: "ACTE CRM Placement",
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

    const sentIST = WhatsAppPlacementCampaignModel.formatToBackendIST();

    // 4. Update message status to Sent
    await WhatsAppPlacementCampaignModel.updateMessageStatus(
      { campaign_id, mobile_number: targetMobile },
      {
        message_status: "Sent",
        aisensy_message_id: submittedMessageId,
        sent_at: sentIST,
      },
    );

    // 5. Recalculate campaign summary
    await WhatsAppPlacementCampaignModel.recalculateCampaignCounts(campaign_id);

    // 6. Update Customer Placement Template Status Flag ONLY after successful sending
    const flagType = WhatsAppPlacementCampaignModel.getTemplateFlagType(
      template,
      req.body.template_type || req.body.template_flag,
    );
    if (flagType && targetCustomerId) {
      try {
        await WhatsAppPlacementCampaignModel.updateCustomerTemplateStatus(
          targetCustomerId,
          flagType,
        );
      } catch (flagErr) {
        console.error(
          "Error updating customer template status flag:",
          flagErr.message,
        );
      }
    }

    return res.status(200).json({
      success: true,
      campaign_id,
      customer_id: targetCustomerId,
      message_id: submittedMessageId,
      message: "Placement WhatsApp template sent successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("sendSinglePlacementTemplateWhatsApp error:", error);

    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.errorMessage ||
      error.response?.data ||
      error.message;

    if (campaign_id) {
      const failedIST = WhatsAppPlacementCampaignModel.formatToBackendIST();
      try {
        await WhatsAppPlacementCampaignModel.updateMessageStatus(
          { campaign_id, mobile_number: req.body?.mobile_number || req.body?.mobile },
          {
            message_status: "Failed",
            error_message:
              typeof errorMessage === "object"
                ? JSON.stringify(errorMessage)
                : String(errorMessage),
            failed_at: failedIST,
          },
        );
        await WhatsAppPlacementCampaignModel.recalculateCampaignCounts(campaign_id);
      } catch (dbErr) {
        console.error("Error updating campaign on failure:", dbErr);
      }
    }

    return res.status(error.response?.status || 500).json({
      success: false,
      campaign_id,
      message: "Failed to send placement WhatsApp template message",
      error: errorMessage,
    });
  }
};

/**
 * Send Bulk WhatsApp Template Messages to Placement Customers
 */
const sendBulkPlacementTemplateWhatsApp = async (req, res) => {
  try {
    const {
      template_id,
      customers: rawCustomers,
      recipients,
      placement_customers,
      filters,
      campaign_name: customCampaignName,
      region_id,
      branch_id,
      course_id,
      default_values = {},
    } = req.body;

    if (!template_id) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    let customerList = rawCustomers || recipients || placement_customers || [];

    // If customer list not passed directly but filters provided, fetch eligible customers
    if (!Array.isArray(customerList) || customerList.length === 0) {
      if (filters && typeof filters === "object") {
        const supportRes = await CustomerModel.getPlacementSupport(
          filters.from_date,
          filters.to_date,
          filters.search_filter,
          filters.user_ids,
          filters.course_ids,
          1,
          filters.limit || 500,
          filters.bucket,
          filters.region_id || region_id,
          filters.branch_id || branch_id,
          filters.status,
          filters.class_going_sub_bucket,
        );

        customerList = (supportRes?.customerData || []).map((item) => ({
          customer_id: item.id,
          customer_name: item.name,
          mobile: item.whatsapp || item.phone,
          values: default_values,
        }));
      }
    }

    if (!Array.isArray(customerList) || customerList.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "A list of placement customers or valid filters returning eligible customers is required",
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

    // Generate Placement Campaign ID (e.g. PCAMP-B-OCT292026-01)
    const campaign_id =
      await WhatsAppPlacementCampaignModel.generateCampaignId("Bulk");
    const nowIST = WhatsAppPlacementCampaignModel.formatToBackendIST();
    const createdBy =
      customerList[0]?.sent_by || req.user?.user_id || "CRM User";
    const campName =
      customCampaignName ||
      `${template.template_label || template.campaign_name} - Placement Bulk (${customerList.length} recipients)`;

    // 1. Create placement campaign record before sending
    await WhatsAppPlacementCampaignModel.createCampaign({
      campaign_id,
      campaign_name: campName,
      campaign_type: "Bulk",
      template_id: template.id,
      template_name: template.template_label || template.campaign_name,
      region_id: region_id || null,
      branch_id: branch_id || null,
      course_id: course_id || null,
      created_by: createdBy,
      total_recipients: customerList.length,
      pending_count: customerList.length,
      success_count: 0,
      failed_count: 0,
      campaign_status: "Processing",
      started_at: nowIST,
      created_at: nowIST,
    });

    // 2. Batch insert recipient message records in Pending state using customer_id
    const recipientRecords = customerList.map((cust) => ({
      campaign_id,
      customer_id: cust.customer_id || cust.id || null,
      recipient_name: cust.customer_name || cust.name || null,
      mobile_number: String(
        cust.mobile || cust.whatsapp || cust.phone || cust.mobile_number || "",
      ).trim(),
      message_status: "Pending",
      template_params: cust.values || default_values || null,
      media_url: cust.media_url || null,
      created_at: cust.created_at || nowIST,
    }));

    await WhatsAppPlacementCampaignModel.createCampaignMessages(recipientRecords);

    // 3. Respond immediately so frontend doesn't hang or timeout
    res.status(200).json({
      success: true,
      campaign_id,
      total_recipients: customerList.length,
      message: `Initiated bulk placement sending for ${customerList.length} contacts under campaign ${campaign_id}. Sending in the background.`,
    });

    // 4. Background worker loop for delivery
    (async () => {
      let successCount = 0;
      let failedCount = 0;

      for (const cust of customerList) {
        const destMobile = String(
          cust.mobile || cust.whatsapp || cust.phone || cust.mobile_number || "",
        ).trim();

        try {
          const {
            customer_name,
            name,
            customer_id,
            values = default_values || {},
            media_url,
            media_filename,
          } = cust;

          const recipientName = customer_name || name || "Customer";

          if (!destMobile) {
            throw new Error("Mobile number is required for this customer");
          }

          if (!values || typeof values !== "object" || Array.isArray(values)) {
            throw new Error("Template values must be an object");
          }

          const templateParams = [];
          for (const parameter of template.parameters) {
            let value = values[parameter.key];

            // Smart fallback for customer name
            if (
              (value === undefined || value === null || String(value).trim() === "") &&
              ["name", "customer_name", "student_name", "recipient_name"].includes(
                parameter.key.toLowerCase(),
              )
            ) {
              value = recipientName;
            }

            if (
              parameter.required &&
              (value === undefined || value === null || String(value).trim() === "")
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

          if (media_url && !isMediaUrlAllowed(media_url)) {
            throw new Error("Media URL host is not allowed or URL is invalid");
          }

          const payload = {
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: template.campaign_name,
            destination: destMobile,
            userName: recipientName,
            source: "ACTE CRM Placement",
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
            { timeout: 20000 },
          );

          const submittedMessageId =
            response.data?.submitted_message_id ||
            response.data?.messageId ||
            response.data?.id ||
            null;

          const sentIST = WhatsAppPlacementCampaignModel.formatToBackendIST();

          await WhatsAppPlacementCampaignModel.updateMessageStatus(
            { campaign_id, mobile_number: destMobile },
            {
              message_status: "Sent",
              aisensy_message_id: submittedMessageId,
              sent_at: sentIST,
            },
          );

          // Update Customer Placement Template Status Flag ONLY after successful sending
          const flagType = WhatsAppPlacementCampaignModel.getTemplateFlagType(
            template,
            req.body?.template_type || req.body?.template_flag,
          );
          const custId = cust.customer_id || cust.id;
          if (flagType && custId) {
            try {
              await WhatsAppPlacementCampaignModel.updateCustomerTemplateStatus(
                custId,
                flagType,
              );
            } catch (flagErr) {
              console.error(
                `Error updating customer #${custId} template status:`,
                flagErr.message,
              );
            }
          }

          successCount++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          failedCount++;
          const errorMsg =
            err.response?.data?.message ||
            err.response?.data?.errorMessage ||
            err.response?.data ||
            err.message;

          const failedIST = WhatsAppPlacementCampaignModel.formatToBackendIST();

          try {
            await WhatsAppPlacementCampaignModel.updateMessageStatus(
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
              "Error updating placement message status on failure:",
              updateErr.message,
            );
          }
        }
      }

      // Recalculate campaign summary counts for absolute accuracy
      await WhatsAppPlacementCampaignModel.recalculateCampaignCounts(campaign_id);

      console.log(
        `[Bulk Placement WhatsApp Complete] Campaign: ${campaign_id}, Sent: ${successCount}, Failed: ${failedCount}`,
      );
    })();
  } catch (error) {
    console.error("sendBulkPlacementTemplateWhatsApp error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during bulk placement send",
      error: error.message,
    });
  }
};

/**
 * Get Paginated Placement Campaigns with Filters
 */
const getPlacementCampaigns = async (req, res) => {
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

    const result = await WhatsAppPlacementCampaignModel.getCampaigns({
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
      message: "Placement campaigns retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("getPlacementCampaigns error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve placement campaigns",
      error: error.message,
    });
  }
};

/**
 * Get Single Placement Campaign by ID
 */
const getPlacementCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Placement campaign ID is required",
      });
    }

    const campaign = await WhatsAppPlacementCampaignModel.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: `Placement campaign not found: ${id}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Placement campaign details retrieved successfully",
      data: campaign,
    });
  } catch (error) {
    console.error("getPlacementCampaignById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve placement campaign details",
      error: error.message,
    });
  }
};

/**
 * Get Messages for a Placement Campaign
 * Returns customer_id instead of lead_id
 */
const getPlacementCampaignMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, search = "", status = "" } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Placement campaign ID is required",
      });
    }

    const result = await WhatsAppPlacementCampaignModel.getCampaignMessages(
      id,
      { page, limit, search, status },
    );

    return res.status(200).json({
      success: true,
      message: "Placement campaign messages retrieved successfully",
      campaign_id: id,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("getPlacementCampaignMessages error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve placement campaign messages",
      error: error.message,
    });
  }
};

/**
 * Get Statistics for Placement Campaigns
 */
const getPlacementCampaignStatistics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const stats = await WhatsAppPlacementCampaignModel.getStatistics({
      fromDate,
      toDate,
    });

    return res.status(200).json({
      success: true,
      message: "Placement campaign statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("getPlacementCampaignStatistics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve placement campaign statistics",
      error: error.message,
    });
  }
};

/**
 * Follow-up / Retargeting Broadcast to Members of an Existing Placement Campaign
 * Consistently uses customer_id
 */
const sendTemplateToPlacementCampaignMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      campaign_id: bodyCampaignId,
      template_id,
      status_filter = ["Sent", "Delivered", "Read"],
      selected_mobile_numbers = null,
      values = {},
      custom_values = {},
      campaign_name: customCampaignName,
      media_url,
      media_filename,
      sent_by,
    } = req.body;

    const targetCampaignId = id || bodyCampaignId;
    if (!targetCampaignId) {
      return res.status(400).json({
        success: false,
        message:
          "Source placement campaign ID is required (via route param :id or campaign_id in request body)",
      });
    }

    if (!template_id) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    // 1. Fetch source placement campaign
    const sourceCampaign =
      await WhatsAppPlacementCampaignModel.getCampaignById(targetCampaignId);
    if (!sourceCampaign) {
      return res.status(404).json({
        success: false,
        message: `Source placement campaign not found: ${targetCampaignId}`,
      });
    }

    // 2. Fetch shared template configuration
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

    // 3. Fetch recipients from source placement campaign
    const members =
      await WhatsAppPlacementCampaignModel.getCampaignRecipientsForFollowUp({
        campaign_id: sourceCampaign.campaign_id,
        status_filter,
        selected_mobiles: selected_mobile_numbers,
      });

    if (!members || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No campaign members found matching status criteria in placement campaign ${sourceCampaign.campaign_id}`,
      });
    }

    // 4. Validate media
    if (template.media_required && !media_url) {
      return res.status(400).json({
        success: false,
        message: "Media URL is required for this template",
      });
    }

    if (media_url && !isMediaUrlAllowed(media_url)) {
      return res.status(400).json({
        success: false,
        message: "Media URL host is not allowed or URL is invalid",
      });
    }

    // 5. Generate new Placement Campaign ID
    const newCampaignId =
      await WhatsAppPlacementCampaignModel.generateCampaignId("Bulk");
    const nowIST = WhatsAppPlacementCampaignModel.formatToBackendIST();
    const createdBy =
      sent_by ||
      req.user?.user_id ||
      sourceCampaign.created_by ||
      "CRM User";
    const campName =
      customCampaignName ||
      `${template.template_label || template.campaign_name} - Placement Follow-up to ${sourceCampaign.campaign_name || sourceCampaign.campaign_id}`;

    // 6. Create new Campaign record
    await WhatsAppPlacementCampaignModel.createCampaign({
      campaign_id: newCampaignId,
      campaign_name: campName,
      campaign_type: "Bulk",
      template_id: template.id,
      template_name: template.template_label || template.campaign_name,
      region_id: sourceCampaign.region_id || null,
      branch_id: sourceCampaign.branch_id || null,
      course_id: sourceCampaign.course_id || null,
      created_by: createdBy,
      total_recipients: members.length,
      pending_count: members.length,
      success_count: 0,
      failed_count: 0,
      campaign_status: "Processing",
      started_at: nowIST,
      created_at: nowIST,
    });

    // 7. Batch insert recipient message records with customer_id
    const recipientRecords = members.map((member) => ({
      campaign_id: newCampaignId,
      customer_id: member.customer_id || null,
      recipient_name: member.recipient_name || null,
      mobile_number: String(member.mobile_number || "").trim(),
      message_status: "Pending",
      template_params: null,
      media_url: media_url || member.media_url || null,
      created_at: nowIST,
    }));

    await WhatsAppPlacementCampaignModel.createCampaignMessages(recipientRecords);

    // 8. Respond immediately
    res.status(200).json({
      success: true,
      campaign_id: newCampaignId,
      source_campaign_id: sourceCampaign.campaign_id,
      total_recipients: members.length,
      message: `Initiated follow-up placement campaign for ${members.length} members under campaign ${newCampaignId}. Sending in the background.`,
    });

    // 9. Background worker loop
    (async () => {
      let successCount = 0;
      let failedCount = 0;

      for (const member of members) {
        const destMobile = String(member.mobile_number || "").trim();
        if (!destMobile) continue;

        try {
          const custCustomValues = custom_values[destMobile] || {};
          const prevParams = member.last_template_params || {};

          const templateParams = [];
          for (const parameter of template.parameters) {
            let val =
              custCustomValues[parameter.key] !== undefined
                ? custCustomValues[parameter.key]
                : values[parameter.key];

            // Smart fallbacks
            if (
              val === undefined ||
              val === null ||
              String(val).trim() === ""
            ) {
              const lowerKey = parameter.key.toLowerCase();
              if (
                [
                  "name",
                  "customer_name",
                  "student_name",
                  "recipient_name",
                  "client_name",
                ].includes(lowerKey)
              ) {
                val = member.recipient_name || "";
              } else if (
                prevParams &&
                typeof prevParams === "object" &&
                prevParams[parameter.key] !== undefined
              ) {
                val = prevParams[parameter.key];
              }
            }

            if (
              parameter.required &&
              (val === undefined || val === null || String(val).trim() === "")
            ) {
              throw new Error(`${parameter.label} is required`);
            }

            templateParams.push(
              val === undefined || val === null ? "" : String(val),
            );
          }

          const memberMediaUrl =
            custCustomValues.media_url || media_url || member.media_url || null;
          const memberMediaFilename =
            custCustomValues.media_filename ||
            media_filename ||
            "attachment.pdf";

          const payload = {
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: template.campaign_name,
            destination: destMobile,
            userName: member.recipient_name || "Customer",
            source: "ACTE CRM Placement",
            templateParams,
          };

          if (memberMediaUrl) {
            payload.media = {
              url: memberMediaUrl,
              filename: memberMediaFilename,
            };
          }

          const response = await axios.post(
            process.env.AISENSY_API_URL,
            payload,
            { timeout: 20000 },
          );

          const submittedMessageId =
            response.data?.submitted_message_id ||
            response.data?.messageId ||
            response.data?.id ||
            null;

          const sentIST = WhatsAppPlacementCampaignModel.formatToBackendIST();

          await WhatsAppPlacementCampaignModel.updateMessageStatus(
            { campaign_id: newCampaignId, mobile_number: destMobile },
            {
              message_status: "Sent",
              aisensy_message_id: submittedMessageId,
              sent_at: sentIST,
            },
          );

          // Update Customer Placement Template Status Flag ONLY after successful sending
          const flagType = WhatsAppPlacementCampaignModel.getTemplateFlagType(
            template,
            req.body?.template_type || req.body?.template_flag,
          );
          if (flagType && member.customer_id) {
            try {
              await WhatsAppPlacementCampaignModel.updateCustomerTemplateStatus(
                member.customer_id,
                flagType,
              );
            } catch (flagErr) {
              console.error(
                `Error updating member #${member.customer_id} template status:`,
                flagErr.message,
              );
            }
          }

          successCount++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          failedCount++;
          const errorMsg =
            err.response?.data?.message ||
            err.response?.data?.errorMessage ||
            err.response?.data ||
            err.message;

          const failedIST = WhatsAppPlacementCampaignModel.formatToBackendIST();

          try {
            await WhatsAppPlacementCampaignModel.updateMessageStatus(
              { campaign_id: newCampaignId, mobile_number: destMobile },
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
              "Error updating placement message status on failure:",
              updateErr.message,
            );
          }
        }
      }

      await WhatsAppPlacementCampaignModel.recalculateCampaignCounts(newCampaignId);
      console.log(
        `[Follow-up Placement Campaign Complete] Campaign: ${newCampaignId}, Sent: ${successCount}, Failed: ${failedCount}`,
      );
    })();
  } catch (error) {
    console.error("sendTemplateToPlacementCampaignMembers error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during placement campaign follow-up send",
      error: error.message,
    });
  }
};

/**
 * Simulate message status progression for placement campaign messages
 */
const simulatePlacementMessageStatus = async (req, res) => {
  try {
    const { message_id, aisensy_message_id, mobile, status } = req.body;

    const allowedStatuses = ["Pending", "Sent", "Delivered", "Read", "Failed"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    if (!message_id && !aisensy_message_id && !mobile) {
      return res.status(400).json({
        success: false,
        message:
          "Provide at least one identifier: message_id, aisensy_message_id, or mobile",
      });
    }

    let matchQuery = "SELECT id, campaign_id, customer_id, mobile_number FROM whatsapp_placement_campaign_messages WHERE ";
    const params = [];

    if (message_id) {
      matchQuery += "id = ?";
      params.push(message_id);
    } else if (aisensy_message_id) {
      matchQuery += "aisensy_message_id = ?";
      params.push(aisensy_message_id);
    } else {
      matchQuery += "RIGHT(mobile_number, 10) = ? ORDER BY id DESC LIMIT 1";
      params.push(String(mobile).replace(/\D/g, "").slice(-10));
    }

    const [rows] = await pool.query(matchQuery, params);
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No placement message record found matching the criteria",
      });
    }

    const msg = rows[0];
    const nowIST = WhatsAppPlacementCampaignModel.formatToBackendIST();
    const updateData = { message_status: status };

    if (status === "Sent") updateData.sent_at = nowIST;
    if (status === "Delivered") updateData.delivered_at = nowIST;
    if (status === "Read") {
      updateData.read_at = nowIST;
      updateData.delivered_at = nowIST;
    }
    if (status === "Failed") {
      updateData.failed_at = nowIST;
      updateData.error_message = "Simulated delivery failure";
    }

    await WhatsAppPlacementCampaignModel.updateMessageStatus(
      { id: msg.id },
      updateData,
    );
    const updatedCounts =
      await WhatsAppPlacementCampaignModel.recalculateCampaignCounts(
        msg.campaign_id,
      );

    // If status is successful and recipient has customer_id, update template flag
    if (["Sent", "Delivered", "Read"].includes(status) && msg.customer_id) {
      try {
        const camp = await WhatsAppPlacementCampaignModel.getCampaignById(
          msg.campaign_id,
        );
        if (camp?.template_id) {
          const tpl = await WhatsAppTemplateConfigModal.getById(
            camp.template_id,
          );
          const flagType =
            WhatsAppPlacementCampaignModel.getTemplateFlagType(tpl);
          if (flagType) {
            await WhatsAppPlacementCampaignModel.updateCustomerTemplateStatus(
              msg.customer_id,
              flagType,
            );
          }
        }
      } catch (simErr) {
        console.error("Simulation template flag update error:", simErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Placement message #${msg.id} status simulated to '${status}'`,
      data: {
        message_id: msg.id,
        campaign_id: msg.campaign_id,
        customer_id: msg.customer_id,
        new_status: status,
        updated_campaign_counts: updatedCounts,
      },
    });
  } catch (error) {
    console.error("simulatePlacementMessageStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to simulate placement message status",
      error: error.message,
    });
  }
};

/**
 * AiSensy Webhook handshake for Placement endpoint
 */
const verifyAiSensyWebhook = async (req, res) => {
  try {
    const challenge = req.query["hub.challenge"] || req.query.challenge;
    if (challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(200).json({
      success: true,
      message: "AiSensy Placement WhatsApp Webhook endpoint is active and healthy",
      timestamp: WhatsAppPlacementCampaignModel.formatToBackendIST(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Handle AiSensy Webhook delivery status for Placement messages
 */
const handleAiSensyWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (Array.isArray(body?.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          for (const st of change.value?.statuses || []) {
            await WhatsAppPlacementCampaignModel.updateMessageByAisensyId(
              st.id,
              {
                status: st.status,
                error: st.errors?.[0] || null,
                timestamp: st.timestamp,
                destination: st.recipient_id,
              },
            );
          }
        }
      }
    } else if (body?.event === "message_status" && body?.data) {
      await WhatsAppPlacementCampaignModel.updateMessageByAisensyId(
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
    } else if (
      body?.submitted_message_id ||
      body?.message_id ||
      body?.id ||
      body?.destination ||
      body?.mobile
    ) {
      const msgId =
        body.submitted_message_id || body.message_id || body.id || null;
      await WhatsAppPlacementCampaignModel.updateMessageByAisensyId(msgId, {
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

    return res.status(200).json({
      success: true,
      message: "Placement webhook processed successfully",
    });
  } catch (error) {
    console.error("Error processing AiSensy placement webhook:", error);
    return res.status(200).json({
      success: false,
      message: "Placement webhook received with errors",
      error: error.message,
    });
  }
};

/**
 * Get placement template message status flags for a specific customer
 */
const getCustomerPlacementTemplateStatus = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const status =
      await WhatsAppPlacementCampaignModel.getCustomerTemplateStatus(
        customer_id,
      );

    return res.status(200).json({
      success: true,
      message: "Customer placement template status fetched successfully",
      data: status,
    });
  } catch (error) {
    console.error("getCustomerPlacementTemplateStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer placement template status",
      error: error.message,
    });
  }
};

module.exports = {
  getEligiblePlacementCustomers,
  sendSinglePlacementTemplateWhatsApp,
  sendBulkPlacementTemplateWhatsApp,
  getPlacementCampaigns,
  getPlacementCampaignById,
  getPlacementCampaignMessages,
  getPlacementCampaignStatistics,
  sendTemplateToPlacementCampaignMembers,
  simulatePlacementMessageStatus,
  verifyAiSensyWebhook,
  handleAiSensyWebhook,
  getCustomerPlacementTemplateStatus,
};

