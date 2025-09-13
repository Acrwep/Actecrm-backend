const express = require("express");
const router = express.Router();
const { verifyToken } = require("../validation/Validation");
const LoginController = require("../controller/LoginController");
const UserController = require("../controller/UserController");
const TrainerController = require("../controller/TrainerController");
const LeadController = require("../controller/LeadController");
const PaymentController = require("../controller/PaymentController");
const EmailController = require("../controller/EmailController");
const CustomerController = require("../controller/CustomerController");

router.post("/login", LoginController.login);

// User start
router.post("/addUser", UserController.addUser);
router.get("/getUsers", verifyToken, UserController.getUsers);
router.put("/updateUser", verifyToken, UserController.updateUser);
// User end

// Trainer start
router.get("/getTechnologies", TrainerController.getTechnologies);
router.get("/getBatches", TrainerController.getBatches);
router.post("/addTrainer", verifyToken, TrainerController.addTrainer);
router.put("/updateTrainer", TrainerController.updateTrainer);
router.post("/getTrainers", verifyToken, TrainerController.getTrainers);
router.get("/getExperience", TrainerController.getExperience);
router.put("/updateStatus", verifyToken, TrainerController.updateStatus);
router.get("/getTrainerById", TrainerController.getTrainerById);
router.get(
  "/getTrainerHistory",
  verifyToken,
  TrainerController.getTrainerHistory
);
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
router.get("/getLeadCount", verifyToken, LeadController.getLeadCount);
router.get("/getRegion", LeadController.getRegion);
// Lead end

// Payment start
router.get("/getPaymentModes", verifyToken, PaymentController.getPaymentModes);
router.post("/createPayment", verifyToken, PaymentController.createPayment);
router.put("/verifyPayment", verifyToken, PaymentController.verifyPayment);
// Payment end

// Mail module start
router.post("/sendMail", verifyToken, EmailController.sendMail);
router.post("/sendInvoice", verifyToken, EmailController.sendInvoiceMail);
router.post("/sendCustomerMail", verifyToken, EmailController.sendCustomerMail);
router.post(
  "/sendCustomerCertificate",
  verifyToken,
  EmailController.sendCourseCertificate
);
router.post("/sendWelcomeMail", EmailController.sendWelcomeMail);
router.post("/sendPaymentMail", EmailController.sendPaymentMail);
// Mail module end

// Customer module start
router.put("/updateCustomer", CustomerController.updateCustomer);
router.post("/getCustomers", verifyToken, CustomerController.getCustomers);
router.get("/getCustomerById", CustomerController.getCustomerById);
router.put("/verifyStudent", verifyToken, CustomerController.verifyStudent);
router.post("/trainerAssign", verifyToken, CustomerController.trainerAssign);
router.put("/verifyTrainer", verifyToken, CustomerController.verifyTrainer);
router.put("/rejectTrainer", verifyToken, CustomerController.rejectTrainer);
router.put("/updateCustomerStatus", CustomerController.updateCustomerStatus);
router.get(
  "/getClassSchedules",
  verifyToken,
  CustomerController.getClassSchedules
);
router.put("/classSchedule", verifyToken, CustomerController.classSchedule);
router.put(
  "/updateClassGiong",
  verifyToken,
  CustomerController.updateClassGiong
);

router.put("/updateReview", verifyToken, CustomerController.updateReview);
router.post("/insertCusTrack", verifyToken, CustomerController.insertCusTrack);
router.post("/pendingFeesList", verifyToken, PaymentController.pendingFeesList);
router.get("/getCusByTrainer", verifyToken, TrainerController.getCusByTrainer);
// Customer module end

router.get(
  "/getPendingFeesCount",
  verifyToken,
  PaymentController.getPendingFeesCount
);
router.post(
  "/generateCertificate",
  verifyToken,
  CustomerController.generateCertificate
);
router.post("/partPayment", verifyToken, PaymentController.partPayment);
// router.get("/getAreas", CustomerController.getAreas);
module.exports = router;
