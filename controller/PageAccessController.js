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
  const { role_name } = request.body;
  try {
    const result = await PageAccessModel.insertRoles(role_name);
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
  const { group_name, description } = request.body;
  try {
    const result = await PageAccessModel.insertGroups(group_name, description);
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

module.exports = {
  getPermissions,
  insertPermission,
  getRoles,
  insertRoles,
  getGroups,
  insertGroups,
};
