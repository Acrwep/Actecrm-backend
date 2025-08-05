const { request, response } = require("express");
const userModel = require("../models/UserModel");

const addUser = async (request, response) => {
  const { user_id, user_name, password } = request.body;
  if (!user_id || !user_name || !password) {
    return response.status(500).send({
      message: "Missing required fields (user_id, user_name, password)",
    });
  }
  try {
    const result = await userModel.addUser(user_id, user_name, password);
    response.status(200).json({
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
  try {
    const users = await userModel.getUsers();
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

module.exports = {
  addUser,
  getUsers,
};
