/**
 * Profile Routes
 * Handles viewing and updating profiles for both students and teachers.
 * Enforces field-level edit restrictions (e.g., roll number is immutable).
 *
 * Endpoints:
 * - GET  /profile/student   (auth required, student only)
 * - PUT  /profile/student   (auth required, student only)
 * - GET  /profile/teacher   (auth required, teacher only)
 * - PUT  /profile/teacher   (auth required, teacher only)
 */

const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { authenticate, authorize } = require("../middleware/auth");
const {
  validateStudentProfileUpdate,
  validateTeacherProfileUpdate,
} = require("../middleware/validate");

/**
 * GET /profile/student
 * Retrieve the authenticated student's full profile.
 */
router.get("/student", authenticate, authorize("student"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const student = await Student.findOne({ userId: user._id });

    res.json({
      success: true,
      profile: {
        name: user.name,
        rollNumber: user.rollNumber,
        email: user.email,
        department: user.department,
        graduation: student?.graduation,
        year: student?.year,
      },
    });
  } catch (error) {
    console.error("Get student profile error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve profile." });
  }
});

/**
 * PUT /profile/student
 * Update the authenticated student's profile.
 * Editable fields: name, email, year
 * Immutable fields: rollNumber, department (rejected if present)
 */
router.put(
  "/student",
  authenticate,
  authorize("student"),
  validateStudentProfileUpdate,
  async (req, res) => {
    try {
      const { name, email, year } = req.body;

      // Reject attempts to modify immutable fields
      if (
        req.body.rollNumber !== undefined ||
        req.body.department !== undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Roll Number and Department cannot be modified.",
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // Check email uniqueness if changing email
      if (email && email !== user.email) {
        const existingEmail = await User.findOne({
          email,
          _id: { $ne: user._id },
        });
        if (existingEmail) {
          return res.status(400).json({
            success: false,
            message: "This email is already in use.",
          });
        }
        user.email = email;
      }

      // Update allowed fields
      if (name) user.name = name;
      await user.save();

      // Update student-specific fields
      if (year !== undefined) {
        await Student.findOneAndUpdate(
          { userId: user._id },
          { year },
          { new: true },
        );
      }

      const student = await Student.findOne({ userId: user._id });

      res.json({
        success: true,
        message: "Profile updated successfully.",
        profile: {
          name: user.name,
          rollNumber: user.rollNumber,
          email: user.email,
          department: user.department,
          graduation: student?.graduation,
          year: student?.year,
        },
      });
    } catch (error) {
      console.error("Update student profile error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update profile." });
    }
  },
);

/**
 * GET /profile/teacher
 * Retrieve the authenticated teacher's full profile.
 */
router.get("/teacher", authenticate, authorize("teacher"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const teacher = await Teacher.findOne({ userId: user._id });

    res.json({
      success: true,
      profile: {
        name: user.name,
        email: user.email,
        department: user.department,
        professorType: teacher?.professorType,
        subjectCodes: teacher?.subjectCodes,
      },
    });
  } catch (error) {
    console.error("Get teacher profile error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve profile." });
  }
});

/**
 * PUT /profile/teacher
 * Update the authenticated teacher's profile.
 * Editable fields: name, professorType
 * Immutable fields: email, department, subjectCodes (rejected if present)
 */
router.put(
  "/teacher",
  authenticate,
  authorize("teacher"),
  validateTeacherProfileUpdate,
  async (req, res) => {
    try {
      const { name, professorType } = req.body;

      // Reject attempts to modify immutable fields
      if (
        req.body.email !== undefined ||
        req.body.department !== undefined ||
        req.body.subjectCodes !== undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Email, Department, and Subject Codes cannot be modified.",
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // Update allowed fields
      if (name) user.name = name;
      await user.save();

      // Update teacher-specific fields
      if (professorType) {
        await Teacher.findOneAndUpdate(
          { userId: user._id },
          { professorType },
          { new: true },
        );
      }

      const teacher = await Teacher.findOne({ userId: user._id });

      res.json({
        success: true,
        message: "Profile updated successfully.",
        profile: {
          name: user.name,
          email: user.email,
          department: user.department,
          professorType: teacher?.professorType,
          subjectCodes: teacher?.subjectCodes,
        },
      });
    } catch (error) {
      console.error("Update teacher profile error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update profile." });
    }
  },
);

module.exports = router;
