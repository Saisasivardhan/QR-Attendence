/**
 * Authentication Routes
 * Handles student and teacher registration and login.
 *
 * Endpoints:
 * - GET  /auth/lookup?email=...
 * - POST /auth/student/register
 * - POST /auth/student/login
 * - POST /auth/teacher/register
 * - POST /auth/teacher/login
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

const {
  validateStudentRegister,
  validateTeacherRegister,
  validateStudentLogin,
  validateTeacherLogin,
} = require("../middleware/validate");

/**
 * GET /auth/lookup?email=...
 * Look up pre-seeded student/teacher by email.
 * Returns pre-filled data if found (without password).
 */
router.get("/lookup", async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    // Check students first
    const student = await Student.findOne({ email }).select("-password -__v");
    if (student) {
      return res.json({
        success: true,
        found: true,
        role: "student",
        data: {
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          subjectCodes: student.subjectCodes,
          // Pre-seeded records won't have a password
          isPreSeeded: !student.password,
        },
      });
    }

    // Check teachers
    const teacher = await Teacher.findOne({ email }).select("-password -__v");
    if (teacher) {
      return res.json({
        success: true,
        found: true,
        role: "teacher",
        data: {
          name: teacher.name,
          email: teacher.email,
          subjectCodes: teacher.subjectCodes,
          isPreSeeded: !teacher.password,
        },
      });
    }

    return res.json({ success: true, found: false });
  } catch (error) {
    console.error("Lookup error:", error);
    res.status(500).json({ success: false, message: "Lookup failed." });
  }
});

/**
 * POST /auth/student/register
 * Register a new student or complete a pre-seeded registration.
 */
router.post("/student/register", validateStudentRegister, async (req, res) => {
  try {
    const { name, email, rollNumber, gradProgram, year, department, password, subjectCodes } =
      req.body;

    // Check if a pre-seeded record exists (no password)
    const existing = await Student.findOne({ email });
    if (existing && existing.password) {
      return res.status(400).json({
        success: false,
        message: "A student with this email is already registered.",
      });
    }

    let student;
    if (existing && !existing.password) {
      // Complete pre-seeded registration
      existing.name = name || existing.name;
      existing.rollNumber = rollNumber || existing.rollNumber;
      existing.gradProgram = gradProgram;
      existing.year = year;
      existing.department = department;
      existing.password = password;
      if (subjectCodes && subjectCodes.length > 0) {
        existing.subjectCodes = [...new Set([...existing.subjectCodes, ...subjectCodes])];
      }
      // Generate 8 recovery codes
      const recoveryCodes = Array.from({ length: 8 }, () => uuidv4().split("-")[0].toUpperCase());
      existing.recoveryCodes = recoveryCodes;
      await existing.save();
      student = existing;
      student._plainRecoveryCodes = recoveryCodes;
    } else {
      // Brand new registration
      const recoveryCodes = Array.from({ length: 8 }, () => uuidv4().split("-")[0].toUpperCase());
      student = new Student({
        name,
        email,
        rollNumber,
        gradProgram,
        year,
        department,
        password,
        subjectCodes: subjectCodes || [],
        recoveryCodes,
      });
      await student.save();
      student._plainRecoveryCodes = recoveryCodes;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: student._id, role: "student", email: student.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(201).json({
      success: true,
      message: "Student registered successfully.",
      token,
      recoveryCodes: student._plainRecoveryCodes,
      user: {
        id: student._id,
        role: "student",
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
        gradProgram: student.gradProgram,
        year: student.year,
        subjectCodes: student.subjectCodes,
      },
    });
  } catch (error) {
    console.error("Student registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
      error: error.message,
    });
  }
});

/**
 * POST /auth/student/login
 * Authenticate student using Email + Password.
 * Returns JWT token on success.
 */
router.post("/student/login", validateStudentLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find student by email
    const student = await Student.findOne({ email: email.toLowerCase() });
    if (!student || !student.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Verify password
    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: student._id, role: "student", email: student.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: student._id,
        role: "student",
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
        gradProgram: student.gradProgram,
        year: student.year,
        subjectCodes: student.subjectCodes,
      },
    });
  } catch (error) {
    console.error("Student login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

/**
 * POST /auth/teacher/register
 * Register a new teacher or complete a pre-seeded registration.
 */
router.post("/teacher/register", validateTeacherRegister, async (req, res) => {
  try {
    const { name, email, professorType, department, subjectCodes, password } =
      req.body;

    // Check if a pre-seeded record exists (no password)
    const existing = await Teacher.findOne({ email });
    if (existing && existing.password) {
      return res.status(400).json({
        success: false,
        message: "A teacher with this email is already registered.",
      });
    }

    // Normalize subject codes to uppercase
    const normalizedCodes = (subjectCodes || []).map((code) => code.toUpperCase());

    let teacher;
    if (existing && !existing.password) {
      // Complete pre-seeded registration
      existing.name = name || existing.name;
      existing.professorType = professorType;
      existing.department = department;
      existing.password = password;
      if (normalizedCodes.length > 0) {
        existing.subjectCodes = [...new Set([...existing.subjectCodes, ...normalizedCodes])];
      }
      // Generate 8 recovery codes
      const recoveryCodes = Array.from({ length: 8 }, () => uuidv4().split("-")[0].toUpperCase());
      existing.recoveryCodes = recoveryCodes;
      await existing.save();
      teacher = existing;
      teacher._plainRecoveryCodes = recoveryCodes;
    } else {
      // Brand new registration
      const recoveryCodes = Array.from({ length: 8 }, () => uuidv4().split("-")[0].toUpperCase());
      teacher = new Teacher({
        name,
        email,
        professorType,
        department,
        password,
        subjectCodes: normalizedCodes,
        recoveryCodes,
      });
      await teacher.save();
      teacher._plainRecoveryCodes = recoveryCodes;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: teacher._id, role: "teacher", email: teacher.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(201).json({
      success: true,
      message: "Teacher registered successfully.",
      token,
      recoveryCodes: teacher._plainRecoveryCodes,
      user: {
        id: teacher._id,
        role: "teacher",
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        professorType: teacher.professorType,
        subjectCodes: teacher.subjectCodes,
      },
    });
  } catch (error) {
    console.error("Teacher registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
      error: error.message,
    });
  }
});

/**
 * POST /auth/teacher/login
 * Authenticate teacher using Email + Password.
 * Returns JWT token on success.
 */
router.post("/teacher/login", validateTeacherLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find teacher by email
    const teacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (!teacher || !teacher.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Verify password
    const isMatch = await teacher.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: teacher._id, role: "teacher", email: teacher.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: teacher._id,
        role: "teacher",
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        professorType: teacher.professorType,
        subjectCodes: teacher.subjectCodes,
      },
    });
  } catch (error) {
    console.error("Teacher login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

/**
 * POST /auth/forgot-password/verify-email
 * Check if the email exists (student or teacher) and has recovery codes.
 */
router.post("/forgot-password/verify-email", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const student = await Student.findOne({ email });
    if (student && student.password) {
      return res.json({ success: true, role: "student" });
    }

    const teacher = await Teacher.findOne({ email });
    if (teacher && teacher.password) {
      return res.json({ success: true, role: "teacher" });
    }

    return res.status(404).json({ success: false, message: "No registered account found with this email." });
  } catch (error) {
    console.error("Forgot password verify-email error:", error);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
});

/**
 * POST /auth/forgot-password/verify-code
 * Verify a recovery code for the given email.
 */
router.post("/forgot-password/verify-code", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const code = (req.body.code || "").trim().toUpperCase();

    if (!email || !code) {
      return res.status(400).json({ success: false, message: "Email and recovery code are required." });
    }

    // Find user in either collection
    let user = await Student.findOne({ email });
    let role = "student";
    if (!user || !user.password) {
      user = await Teacher.findOne({ email });
      role = "teacher";
    }

    if (!user || !user.password) {
      return res.status(404).json({ success: false, message: "No registered account found." });
    }

    if (!user.recoveryCodes || user.recoveryCodes.length === 0) {
      return res.status(400).json({ success: false, message: "No recovery codes found. Please contact admin." });
    }

    const codeIndex = user.recoveryCodes.indexOf(code);
    if (codeIndex === -1) {
      return res.status(400).json({ success: false, message: "Invalid recovery code." });
    }

    // Remove the used code (one-time use)
    user.recoveryCodes.splice(codeIndex, 1);
    await user.save();

    // Generate a short-lived token for password reset (10 minutes)
    const resetToken = jwt.sign(
      { id: user._id, role, purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );

    res.json({ success: true, resetToken });
  } catch (error) {
    console.error("Forgot password verify-code error:", error);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
});

/**
 * POST /auth/forgot-password/reset
 * Reset password using the reset token from verify-code step.
 */
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: "Reset token and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    // Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ success: false, message: "Reset link expired or invalid. Please try again." });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(400).json({ success: false, message: "Invalid reset token." });
    }

    const Model = decoded.role === "student" ? Student : Teacher;
    const user = await Model.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Forgot password reset error:", error);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
});

// ─── Admin Login (hardcoded credentials) ───
const ADMIN_EMAIL = "attendance-admin@nitw.ac.in";
const ADMIN_PASS = "adminnitw@1959";

router.post("/admin/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASS) {
      return res.status(401).json({ success: false, message: "Invalid admin credentials." });
    }

    const token = jwt.sign(
      { role: "admin", email: ADMIN_EMAIL },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.json({
      success: true,
      token,
      user: { role: "admin", email: ADMIN_EMAIL, name: "Admin" },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

module.exports = router;
