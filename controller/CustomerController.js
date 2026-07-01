const { request, response } = require("express");
const CustomerModel = require("../models/CustomerModel");
const CommonModel = require("../models/CommonModel");

const nodemailer = require("nodemailer");

const updateCustomer = async (request, response) => {
  const {
    name,
    email,
    phonecode,
    phone,
    whatsapp_phone_code,
    whatsapp,
    date_of_birth,
    gender,
    date_of_joining,
    enrolled_course,
    branch_id,
    batch_track_id,
    batch_timing_id,
    current_location,
    signature_image,
    profile_image,
    placement_support,
    id,
    region_id,
    country,
    state,
    area,
    is_server_required,
    is_customer_updated,
    place_of_supply,
    address,
    state_code,
    gst_number,
    lead_id,
    ra_id,
  } = request.body;
  try {
    const result = await CustomerModel.updateCustomer(
      name,
      email,
      phonecode,
      phone,
      whatsapp_phone_code,
      whatsapp,
      date_of_birth,
      gender,
      date_of_joining,
      enrolled_course,
      region_id,
      branch_id,
      batch_track_id,
      batch_timing_id,
      current_location,
      signature_image,
      profile_image,
      placement_support,
      id,
      country,
      state,
      area,
      is_server_required,
      is_customer_updated,
      place_of_supply,
      address,
      state_code,
      gst_number,
      lead_id,
      ra_id,
    );
    return response.status(200).send({
      message: "Customer updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating customer",
      details: error.message,
    });
  }
};

const getCustomers = async (request, response) => {
  const {
    from_date,
    to_date,
    status,
    name,
    email,
    mobile,
    course,
    user_ids,
    page,
    limit,
    region,
  } = request.body;
  try {
    const result = await CustomerModel.getCustomers(
      from_date,
      to_date,
      status,
      name,
      email,
      mobile,
      course,
      user_ids,
      page,
      limit,
      region,
    );
    return response.status(200).send({
      message: "Customers fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching customers",
      details: error.message,
    });
  }
};

const getCustomerById = async (request, response) => {
  const { customer_id } = request.query;
  try {
    const result = await CustomerModel.getCustomerById(customer_id);
    return response.status(200).send({
      message: "Customer fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching customer",
      details: error.message,
    });
  }
};

const verifyStudent = async (request, response) => {
  const { customer_id, proof_communication, comments, is_satisfied } =
    request.body;
  try {
    const result = await CustomerModel.verifyStudent(
      customer_id,
      proof_communication,
      comments,
      is_satisfied,
    );
    return response.status(200).send({
      message: "Verified successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while verifying",
      details: error.message,
    });
  }
};

const trainerAssign = async (request, response) => {
  const {
    customer_id,
    trainer_id,
    commercial,
    mode_of_class,
    trainer_type,
    proof_communication,
    comments,
    created_date,
  } = request.body;
  try {
    const result = await CustomerModel.trainerAssign(
      customer_id,
      trainer_id,
      commercial,
      mode_of_class,
      trainer_type,
      proof_communication,
      comments,
      created_date,
    );
    return response.status(200).send({
      message: "Trainer assigned successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while assigning trainer",
      details: error.message,
    });
  }
};

const verifyTrainer = async (request, response) => {
  const { id, verified_date } = request.body;
  try {
    const result = await CustomerModel.verifyTrainer(id, verified_date);
    return response.status(200).send({
      message: "Trainer verified successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while verifying trainer",
      details: error.message,
    });
  }
};

const rejectTrainer = async (request, response) => {
  const { id, rejected_date, comments } = request.body;
  try {
    const result = await CustomerModel.rejectTrainer(
      id,
      rejected_date,
      comments,
    );
    return response.status(200).send({
      message: "Trainer has been rejected",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while rejecting trainer",
      details: error.message,
    });
  }
};

const updateCustomerStatus = async (request, response) => {
  const { customer_ids } = request.body;
  try {
    const result = await CustomerModel.updateCustomerStatus(customer_ids);
    return response.status(200).send({
      message: "Status updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating status",
      details: error.message,
    });
  }
};

const getClassSchedules = async (request, response) => {
  try {
    const result = await CustomerModel.getClassSchedules();
    return response.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const classSchedule = async (request, response) => {
  const { customers } = request.body;
  try {
    const result = await CustomerModel.classSchedule(customers);
    return response.status(200).send({
      message: "Class scheduled successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while scheduling class",
      details: error.message,
    });
  }
};

const updateClassGiong = async (request, response) => {
  const { customers } = request.body;
  try {
    const result = await CustomerModel.updateClassGiong(customers);
    return response.status(200).send({
      message: "Percentage updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating percentage",
      details: error.message,
    });
  }
};

const updateReview = async (request, response) => {
  const { customers } = request.body;
  try {
    const result = await CustomerModel.updateReview(customers);
    return response.status(200).send({
      message: "review updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating review",
      details: error.message,
    });
  }
};

const insertCusTrack = async (request, response) => {
  const { customers } = request.body;
  try {
    const result = await CustomerModel.insertCusTrack(customers);
    return response.status(201).send({
      message: "Inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting",
      details: error.message,
    });
  }
};

const generateCertificate = async (request, response) => {
  const {
    customer_id,
    customer_name,
    course_name,
    course_duration,
    course_completion_month,
    current_location,
  } = request.body;
  try {
    const result = await CommonModel.generateCertificate(
      customer_id,
      customer_name,
      course_name,
      course_duration,
      course_completion_month,
      current_location,
    );
    return response.status(201).send({
      message: "Inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting",
      details: error.message,
    });
  }
};

const getCertificate = async (request, response) => {
  const { customer_id } = request.query;
  try {
    const result = await CommonModel.getCertificate(customer_id);
    return response.status(200).send({
      message: "Certificate fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching certificate",
      details: error.message,
    });
  }
};

const preCertificate = async (request, response) => {
  const {
    customer_name,
    course_name,
    course_duration,
    course_completion_month,
    certificate_number,
    location,
  } = request.body;
  try {
    const result = await CommonModel.preCertificate(
      customer_name,
      course_name,
      course_duration,
      course_completion_month,
      certificate_number,
      location,
    );
    return response.status(200).send({
      message: "Certificate fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching certificate",
      details: error.message,
    });
  }
};

const getCustomerHistory = async (request, response) => {
  const { customer_id } = request.query;
  try {
    const result = await CustomerModel.getCustomerHistory(customer_id);
    return response.status(200).send({
      message: "Customer history fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching customer history",
      details: error.message,
    });
  }
};

const checkIsCustomerReg = async (request, response) => {
  const { email } = request.query;
  try {
    const result = await CustomerModel.checkIsCustomerReg(email);
    return response.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const getCustomersV1 = async (request, response) => {
  const {
    name,
    email,
    mobile,
    status,
    course,
    from_date,
    to_date,
    user_ids,
    page,
    limit,
    region,
    date_type,
    domain,
  } = request.body;
  try {
    const result = await CustomerModel.getCustomersV1(
      from_date,
      to_date,
      status,
      name,
      email,
      mobile,
      course,
      user_ids,
      page,
      limit,
      region,
      date_type,
      domain,
    );
    return response.status(200).send({
      message: "Customers fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching customers",
      details: error.message,
    });
  }
};

const updateCertificate = async (request, response) => {
  const {
    id,
    customer_id,
    customer_name,
    course_name,
    course_duration,
    course_completion_month,
    certificate_number,
    current_location,
    updated_date,
  } = request.body;
  try {
    const result = await CustomerModel.updateCertificate(
      id,
      customer_id,
      customer_name,
      course_name,
      course_duration,
      course_completion_month,
      certificate_number,
      current_location,
      updated_date,
    );
    return response.status(200).send({
      message: "Certificate updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating certificate",
      details: error.message,
    });
  }
};

const otpSend = async (request, response) => {
  const { email } = request.body;
  try {
    const user = await CustomerModel.checkUserByEmail(email);
    if (!user) {
      return response.status(404).send({ message: "Email not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);
    await CustomerModel.otpSend(email, otp, otp_expiry);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "OTP Verification Code",
      html: `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>OTP Verification</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: #ffffff; padding: 40px 20px 20px;">
                        <img src="cid:companyLogo" alt="Company Logo" style="max-width: 200px; height: auto; display: block;" />
                        </td>
                    </tr>
                    
                    <!-- Divider -->
                    <tr>
                        <td align="center" style="padding: 0 30px;">
                            <div style="height: 1px; background-color: #e5e7eb; width: 100%;"></div>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px; font-weight: 600; text-align: center;">Verify Your Email Address</h2>
                            <p style="margin-top: 0; text-align: center;">
                                Thank you for choosing <strong>ACTE Technologies</strong>. Please use the following One-Time Password (OTP) to complete your verification process.
                            </p>

                            <!-- OTP Box -->
                            <div style="text-align: center; margin: 40px 0;">
                                <div style="display: inline-block; background-color: #f8fafc; padding: 20px 40px; border-radius: 12px; border: 2px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                    <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb; font-family: monospace;">
                                        ${otp}
                                    </span>
                                </div>
                            </div>

                            <p style="margin-bottom: 24px; text-align: center; font-size: 15px;">
                                This OTP is valid for the next <strong>10 minutes</strong>.
                            </p>

                            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                                    <strong>Security Notice:</strong> Please do not share this code with anyone. Our team will never ask you for this OTP.
                                </p>
                            </div>

                            <p style="margin-bottom: 0; text-align: center; font-size: 14px;">
                                If you did not request this verification, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #f9fafb; padding: 24px; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 8px;">
                                <strong>ACTE Technologies</strong>
                            </p>
                            <p style="margin: 0; font-size: 12px;">
                                © ${new Date().getFullYear()} ACTE Technologies. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>`,
      attachments: [
        {
          filename: "logo.png", // name of the file
          path: "./acte-logo.png", // local path of your logo file
          cid: "companyLogo", // same cid as used in <img src="cid:companyLogo">
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return response
          .status(500)
          .send({ message: "Error sending email", error: error.message });
      }
      return response.status(200).send({ message: "OTP sent to your email" });
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while sending OTP",
      details: error.message,
    });
  }
};

const verifyOTP = async (request, response) => {
  const { email, otp } = request.body;
  try {
    const user = await CustomerModel.verifyOTP(email, otp);
    if (!user) {
      return response.status(400).send({ message: "Invalid or expired OTP" });
    }
    return response.status(200).send({ message: "OTP verified successfully" });
  } catch (error) {
    response.status(500).send({
      message: "Error while verifying OTP",
      details: error.message,
    });
  }
};

module.exports = {
  updateCustomer,
  getCustomers,
  getCustomerById,
  verifyStudent,
  trainerAssign,
  verifyTrainer,
  rejectTrainer,
  updateCustomerStatus,
  getClassSchedules,
  classSchedule,
  updateClassGiong,
  updateReview,
  insertCusTrack,
  generateCertificate,
  getCertificate,
  getCustomerHistory,
  checkIsCustomerReg,
  preCertificate,
  getCustomersV1,
  updateCertificate,
  otpSend,
  verifyOTP,
};
