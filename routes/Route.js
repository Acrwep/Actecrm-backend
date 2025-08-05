const express = require("express");
const router = express.Router();
const { verifyToken } = require("../validation/Validation");
const LoginController = require("../controller/LoginController");
const UserController = require("../controller/UserController");

router.post("/login", LoginController.login);
router.post("/addUser", UserController.addUser);
router.get("/getUsers", verifyToken, UserController.getUsers);

module.exports = router;
