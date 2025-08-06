const express = require("express");
const router = express.Router();
const { verifyToken } = require("../validation/Validation");
const LoginController = require("../controller/LoginController");
const UserController = require("../controller/UserController");
const TrainerController = require("../controller/TrainerController");

router.post("/login", LoginController.login);
router.post("/addUser", UserController.addUser);
router.get("/getUsers", verifyToken, UserController.getUsers);
router.put("/updateUser", verifyToken, UserController.updateUser);
router.get("/getTechnologies", verifyToken, TrainerController.getTechnologies);
router.get("/getBatches", verifyToken, TrainerController.getBatches);

module.exports = router;
