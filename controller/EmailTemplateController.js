const { request, response } = require("express");
const TemplateModel = require("../models/EmailTemplateModel");

const addTemplate = async (request, response) => {
  const { name, content, user_id } = request.body;
  try {
    const result = await TemplateModel.addTemplate(name, content, user_id);

    return response.status(201).send({
      message: "Template added successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while adding template",
      details: error.message,
    });
  }
};

const getTemplates = async (request, response) => {
  const { user_id } = request.query;
  try {
    const result = await TemplateModel.getTemplates(user_id);

    return response.status(200).send({
      message: "Templates fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching templates",
      details: error.message,
    });
  }
};

const updateTemplate = async (request, response) => {
  const { template_id, name, content, user_id } = request.body;
  try {
    const result = await TemplateModel.updateTemplate(
      template_id,
      name,
      content,
      user_id,
    );

    return response.status(200).send({
      message: "Template updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating template",
      details: error.message,
    });
  }
};

const deleteTemplate = async (request, response) => {
  const { template_id } = request.query;
  try {
    const result = await TemplateModel.deleteTemplate(template_id);

    return response.status(200).send({
      message: "Template has been deleted",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while deleting template",
      details: error.message,
    });
  }
};

const emailSend = async (request, response) => {
  const {
    from_email = "",
    email,
    subject,
    content,
    base64Image,
  } = request.body;
  try {
    const result = await TemplateModel.emailSend(
      from_email,
      email,
      subject,
      content,
      base64Image,
    );

    return response.status(200).send({
      message: "Email sent successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while sending email",
      details: error.message,
    });
  }
};

module.exports = {
  addTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
  emailSend,
};
