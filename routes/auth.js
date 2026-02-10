/**
 * Authentication Routes
 * Handles student and teacher registration and login.
 *
 * Endpoints:
 * - POST /auth/student/register
 * - POST /auth/student/login
 * - POST /auth/teacher/register
 * - POST /auth/teacher/login
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Subject = require("../models/Subject");

const {
  validateStudentRegister,
  validateTeacherRegister,
  validateStudentLogin,
  validateTeacherLogin,
} = require("../middleware/validate");

/**
 * POST /auth/student/register
 * Register a new student account.
 * Creates both a User document and a linked Student document.
 */
router.post("/student/register", validateStudentRegister, async (req, res) => {
  try {
    const { name, rollNumber, email, graduation, year, department, password } =
      req.body;

    // Check if roll number already exists
    const existingRoll = await User.findOne({ rollNumber });
    if (existingRoll) {
      return res.status(400).json({
        success: false,
        message: "A student with this roll number already exists.",
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email, role: "student" });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "A student with this email already exists.",
      });
    }

    // Create user document
    const user = new User({
      name,
      email,
      rollNumber,
      role: "student",
      department,
      password,
    });
    await user.save();

    // Create linked student document
    const student = new Student({
      userId: user._id,
      graduation,
      year,
    });
    await student.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: "student", rollNumber: user.rollNumber },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(201).json({
      success: true,
      message: "Student registered successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
        email: user.email,
        role: user.role,
        department: user.department,
        graduation: student.graduation,
        year: student.year,
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
 * Authenticate student using Roll Number + Password.
 * Returns JWT token on success.
 */
router.post("/student/login", validateStudentLogin, async (req, res) => {
  try {
    const { rollNumber, password } = req.body;

    // Find user by roll number
    const user = await User.findOne({
      rollNumber: rollNumber.toUpperCase(),
      role: "student",
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid roll number or password.",
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid roll number or password.",
      });
    }

    // Get student details
    const student = await Student.findOne({ userId: user._id });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: "student", rollNumber: user.rollNumber },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
        email: user.email,
        role: user.role,
        department: user.department,
        graduation: student?.graduation,
        year: student?.year,
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
 * Register a new teacher account.
 * Creates User, Teacher, and Subject documents.
 */
router.post("/teacher/register", validateTeacherRegister, async (req, res) => {
  try {
    const { name, email, professorType, department, subjectCodes, password } =
      req.body;

    // Check if email already exists
    const existingEmail = await User.findOne({ email, role: "teacher" });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "A teacher with this email already exists.",
      });
    }

    // Normalize subject codes to uppercase
    const normalizedCodes = subjectCodes.map((code) => code.toUpperCase());

    // Create user document
    const user = new User({
      name,
      email,
      role: "teacher",
      department,
      password,
    });
    await user.save();

    // Create linked teacher document
    const teacher = new Teacher({
      userId: user._id,
      professorType,
      subjectCodes: normalizedCodes,
    });
    await teacher.save();

    // Create/update subject documents for each subject code
    for (const code of normalizedCodes) {
      await Subject.findOneAndUpdate(
        { subjectCode: code },
        {
          subjectCode: code,
          department,
          teacherId: user._id,
        },
        { upsert: true, new: true },
      );
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: "teacher", email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(201).json({
      success: true,
      message: "Teacher registered successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
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

    // Find user by email
    const user = await User.findOne({ email, role: "teacher" });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Get teacher details
    const teacher = await Teacher.findOne({ userId: user._id });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: "teacher", email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        professorType: teacher?.professorType,
        subjectCodes: teacher?.subjectCodes,
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

module.exports = router;
