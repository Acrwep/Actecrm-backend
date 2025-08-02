const express = require("express");
const router = express.Router();
const { verifyToken } = require("../validation/Validation");
const LoginController = require("../controller/LoginController");

router.post("/login", LoginController.login);

module.exports = router;
