const jwt = require("jsonwebtoken");
// require("dotenv").config();

const login = async (request, response) => {
  try {
    const token = generateToken();
    return response.status(200).send({
      message: "Login successfull",
      token: token,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while login",
      details: error.message,
    });
  }
};

const generateToken = () => {
  return jwt.sign(
    // { id: user.id, email: user.email }, //Payload
    process.env.JWT_SECRET, // Secret
    { expiresIn: "1d" } // Token expires in 1 day
  );
};

module.exports = {
  login,
};
