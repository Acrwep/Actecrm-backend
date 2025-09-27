const { request, response } = require("express");
const PageAccessModel = require("../models/PageAccessModel");

const getPermissions = async (request, response) => {
  try {
    const result = await PageAccessModel.getPermissions();
    return response.status(200).send({
      massage: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const insertPermission = async (request, response) => {
  const { permission_name } = request.body;
  try {
    const result = await PageAccessModel.insertPermission(permission_name);
    return response.status(201).send({
      massage: "Permission inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting permission",
      details: error.message,
    });
  }
};

const getRoles = async (request, response) => {
  try {
    const result = await PageAccessModel.getRoles();
    return response.status(200).send({
      massage: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const insertRoles = async (request, response) => {
  const { role_name, background_color, text_color } = request.body;
  try {
    const result = await PageAccessModel.insertRoles(
      role_name,
      background_color,
      text_color
    );
    return response.status(201).send({
      massage: "Role inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting role",
      details: error.message,
    });
  }
};

const updateRole = async (request, response) => {
  const { role_name, role_id } = request.body;
  try {
    const result = await PageAccessModel.updateRole(role_name, role_id);
    return response.status(200).send({
      massage: "Role updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating role",
      details: error.message,
    });
  }
};

const deleteRole = async (request, response) => {
  const { role_id } = request.body;
  try {
    const result = await PageAccessModel.deleteRole(role_id);
    return response.status(200).send({
      massage: "Role has been deleted",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while deleting role",
      details: error.message,
    });
  }
};

const getGroups = async (request, response) => {
  try {
    const result = await PageAccessModel.getGroups();
    return response.status(200).send({
      massage: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const insertGroups = async (request, response) => {
  const { group_name, description, background_color, text_color } =
    request.body;
  try {
    const result = await PageAccessModel.insertGroups(
      group_name,
      description,
      background_color,
      text_color
    );
    return response.status(201).send({
      massage: "Group inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting group",
      details: error.message,
    });
  }
};

const getRolePermissions = async (request, response) => {
  try {
    const result = await PageAccessModel.getRolePermissions();
    return response.status(200).send({
      massage: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const insertRolePermissions = async (request, response) => {
  const { role_id, permission_id } = request.body;
  try {
    const result = await PageAccessModel.insertRolePermissions(
      role_id,
      permission_id
    );
    return response.status(201).send({
      massage: "Data inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting Data",
      details: error.message,
    });
  }
};

module.exports = {
  getPermissions,
  insertPermission,
  getRoles,
  insertRoles,
  updateRole,
  deleteRole,
  getGroups,
  insertGroups,
  getRolePermissions,
  insertRolePermissions,
};
