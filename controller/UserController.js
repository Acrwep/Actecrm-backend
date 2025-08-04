const userModel = require("../models/UserModel");

const getPositions = async (request, response) => {
  try {
    const positions = await userModel.getPositions();
    response.status(200).json({
      message: "Position fetched successfully",
      data: positions,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching positions",
      details: error.message,
    });
  }
};

const getDepartments = async (request, response) => {
  try {
    const departments = await userModel.getDepartments();
    response.status(200).json({
      message: "Departments fetched successfully",
      data: departments,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching departments",
      details: error.message,
    });
  }
};

const getRoles = async (request, response) => {
  try {
    const roles = await userModel.getRoles();
    response.status(200).json({
      message: "Roles fetched successfully",
      data: roles,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching roles",
      details: error.message,
    });
  }
};

const addUser = async (request, response) => {
  const {
    user_id,
    user_name,
    position_id,
    role_id,
    department_id,
    pre_quality,
    ra,
    hrs,
    post_quality,
    sales_supervisor,
    manager,
    password,
  } = request.body;
  if (!user_id || !user_name || !password || !position_id) {
    return response.status(500).send({
      message:
        "Missing required fields (user_id, user_name, position_id, password)",
    });
  }
  try {
    const result = await userModel.addUser(
      user_id,
      user_name,
      position_id,
      role_id,
      department_id,
      pre_quality,
      ra,
      hrs,
      post_quality,
      sales_supervisor,
      manager,
      password
    );
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

module.exports = {
  getPositions,
  getDepartments,
  getRoles,
  addUser,
};
