const express = require("express");
const router = express.Router();
const { verifyToken } = require("../validation/Validation");
const LoginController = require("../controller/LoginController");
const UserController = require("../controller/UserController");
const TrainerController = require("../controller/TrainerController");
const LeadController = require("../controller/LeadController");

router.post("/login", LoginController.login);

// User start
router.post("/addUser", UserController.addUser);
router.get("/getUsers", verifyToken, UserController.getUsers);
router.put("/updateUser", verifyToken, UserController.updateUser);
// User end

// Trainer start
router.get("/getTechnologies", verifyToken, TrainerController.getTechnologies);
router.get("/getBatches", verifyToken, TrainerController.getBatches);
router.post("/addTrainer", verifyToken, TrainerController.addTrainer);
router.put("/updateTrainer", verifyToken, TrainerController.updateTrainer);
router.post("/getTrainers", verifyToken, TrainerController.getTrainers);
router.get("/getExperience", verifyToken, TrainerController.getExperience);
// Trainer end

// Lead start
router.get("/getTrainingMode", verifyToken, LeadController.getTrainingMode);
router.get("/getPriority", verifyToken, LeadController.getPriority);
router.get("/getLeadType", verifyToken, LeadController.getLeadType);
router.get("/getStatus", verifyToken, LeadController.getStatus);
router.get("/getResponseStatus", verifyToken, LeadController.getResponseStatus);
router.get("/getBranches", verifyToken, LeadController.getBranches);
router.get("/getBatchTrack", verifyToken, LeadController.getBatchTrack);
// Lead end
module.exports = router;
