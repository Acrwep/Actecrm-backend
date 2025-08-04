const express = require("express");
const router = express.Router();
const { verifyToken } = require("../validation/Validation");
const LoginController = require("../controller/LoginController");
const UserController = require("../controller/UserController");

router.post("/login", LoginController.login);
router.get("/getPositions", verifyToken, UserController.getPositions);
router.get("/getDepartments", verifyToken, UserController.getDepartments);
router.get("/getRoles", verifyToken, UserController.getRoles);
router.post("/addUser", UserController.addUser);

module.exports = router;
