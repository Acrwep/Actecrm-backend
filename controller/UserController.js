const { request, response } = require("express");
const userModel = require("../models/UserModel");

const addUser = async (request, response) => {
  const { user_id, user_name, password, users, roles } = request.body;
  if (!user_id || !user_name || !password) {
    return response.status(500).send({
      message: "Missing required fields (user_id, user_name, password)",
    });
  }

  const formattedUsers = Array.isArray(users) ? users : [users];
  const formattedRoles = Array.isArray(roles) ? roles : [roles];
  try {
    const result = await userModel.addUser(
      user_id,
      user_name,
      password,
      formattedUsers,
      formattedRoles
    );
    response.status(201).json({
      message: "User addedd successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while adding user",
      details: error.message,
    });
  }
};

const getUsers = async (request, response) => {
  const { user_id, user_name } = request.query;
  try {
    const users = await userModel.getUsers(user_id, user_name);
    response.status(200).json({
      message: "User fetched successfully",
      data: users,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching users",
      details: error.message,
    });
  }
};

const updateUser = async (request, response) => {
  const { id, user_id, user_name, password, users, roles } = request.body;
  const formattedUsers = Array.isArray(users) ? users : [users];
  const formattedRoles = Array.isArray(roles) ? roles : [roles];
  try {
    const users = await userModel.updateUser(
      id,
      user_id,
      user_name,
      password,
      formattedUsers,
      formattedRoles
    );
    response.status(200).json({
      message: "User updated successfully",
      data: users,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while update users",
      details: error.message,
    });
  }
};

module.exports = {
  addUser,
  getUsers,
  updateUser,
};
