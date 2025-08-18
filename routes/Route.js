const express = require("express");
const router = express.Router();
const { verifyToken } = require("../validation/Validation");
const LoginController = require("../controller/LoginController");
const UserController = require("../controller/UserController");
const TrainerController = require("../controller/TrainerController");
const LeadController = require("../controller/LeadController");
const PaymentController = require("../controller/PaymentController");
const EmailController = require("../controller/EmailController");

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
router.put("/updateStatus", verifyToken, TrainerController.updateStatus);
// Trainer end

// Lead start
router.get("/getTrainingMode", verifyToken, LeadController.getTrainingMode);
router.get("/getPriority", verifyToken, LeadController.getPriority);
router.get("/getLeadType", verifyToken, LeadController.getLeadType);
router.get("/getStatus", verifyToken, LeadController.getStatus);
router.get("/getResponseStatus", verifyToken, LeadController.getResponseStatus);
router.get("/getBranches", verifyToken, LeadController.getBranches);
router.get("/getBatchTrack", verifyToken, LeadController.getBatchTrack);
router.post("/insertLead", verifyToken, LeadController.insertLead);
router.post("/getLeads", verifyToken, LeadController.getLeads);
router.get("/getLeadFollowUps", verifyToken, LeadController.getLeadFollowUps);
router.put("/updateFollowUp", verifyToken, LeadController.updateFollowUp);
router.put("/updateLead", verifyToken, LeadController.updateLead);
// Lead end

// Payment start
router.get("/getPaymentModes", verifyToken, PaymentController.getPaymentModes);
// Payment end

// Mail module start
router.post("/sendMail", verifyToken, EmailController.sendMail);
// Mail module end
module.exports = router;
