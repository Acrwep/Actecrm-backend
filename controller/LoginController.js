const jwt = require("jsonwebtoken");
const loginModel = require("../models/LoginModel");

const login = async (request, response) => {
  const { user_id, password } = request.body;
  try {
    const validateUser = await loginModel.login(user_id, password);

    if (validateUser) {
      const token = generateToken(validateUser);
      return response.status(200).send({
        message: "Login successful",
        token: token,
        data: validateUser,
      });
    } else {
      throw new Error("Invalid userId and password");
    }
  } catch (error) {
    response.status(500).send({
      message: "Error while login",
      details: error.message,
    });
  }
};

const changePassword = async (request, response) => {
  const { user_id, currentPassword, newPassword } = request.body;
  try {
    const result = await loginModel.changePassword(
      user_id,
      currentPassword,
      newPassword
    );
    return response.status(200).json({
      message: "Password changed successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while changing password",
      details: error.message,
    });
  }
};

const generateToken = (user) => {
  // Verify JWT_SECRET exists and is valid
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Invalid JWT secret configuration");
  }

  return jwt.sign(
    {
      id: user.id,
      position: user.position_id,
    },
    process.env.JWT_SECRET, // From .env file
    { expiresIn: "1d" }
  );
};

module.exports = {
  login,
  changePassword,
};
