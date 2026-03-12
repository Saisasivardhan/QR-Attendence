/**
 * Profile Routes
 * Handles viewing and updating profiles for both students and teachers.
 *
 * Endpoints:
 * - GET  /profile/student            (auth required, student only)
 * - PUT  /profile/student            (auth required, student only)
 * - PUT  /profile/student/password   (auth required, student only)
 * - GET  /profile/teacher            (auth required, teacher only)
 * - PUT  /profile/teacher            (auth required, teacher only)
 */

const express = require("express");
const router = express.Router();

const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { authenticate, authorize } = require("../middleware/auth");
const {
  validateStudentProfileUpdate,
  validateTeacherProfileUpdate,
  validateChangePassword,
} = require("../middleware/validate");

/**
 * GET /profile/student
 * Retrieve the authenticated student's full profile.
 */
router.get("/student", authenticate, authorize("student"), async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select("-password -__v");
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found." });
    }

    res.json({
      success: true,
      profile: {
        name: student.name,
        rollNumber: student.rollNumber,
        email: student.email,
        department: student.department,
        gradProgram: student.gradProgram,
        year: student.year,
        subjectCodes: student.subjectCodes,
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
 * Editable fields: year, subjectCodes
 * Immutable fields: name, email, department (rejected if present)
 */
router.put(
  "/student",
  authenticate,
  authorize("student"),
  validateStudentProfileUpdate,
  async (req, res) => {
    try {
      const { year, subjectCodes } = req.body;

      // Reject attempts to modify immutable fields
      if (
        req.body.name !== undefined ||
        req.body.email !== undefined ||
        req.body.department !== undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Name, Email, and Department cannot be modified.",
        });
      }

      const student = await Student.findById(req.user.id);
      if (!student) {
        return res
          .status(404)
          .json({ success: false, message: "Student not found." });
      }

      // Update allowed fields
      if (year !== undefined) student.year = year;
      if (subjectCodes !== undefined) student.subjectCodes = subjectCodes;
      await student.save();

      res.json({
        success: true,
        message: "Profile updated successfully.",
        profile: {
          name: student.name,
          rollNumber: student.rollNumber,
          email: student.email,
          department: student.department,
          gradProgram: student.gradProgram,
          year: student.year,
          subjectCodes: student.subjectCodes,
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
 * PUT /profile/student/password
 * Change the authenticated student's password.
 */
router.put(
  "/student/password",
  authenticate,
  authorize("student"),
  validateChangePassword,
  async (req, res) => {
    try {
      const { newPassword } = req.body;

      const student = await Student.findById(req.user.id);
      if (!student) {
        return res
          .status(404)
          .json({ success: false, message: "Student not found." });
      }

      student.password = newPassword;
      await student.save();

      res.json({
        success: true,
        message: "Password changed successfully.",
      });
    } catch (error) {
      console.error("Change student password error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to change password." });
    }
  },
);

/**
 * GET /profile/teacher
 * Retrieve the authenticated teacher's full profile.
 */
router.get("/teacher", authenticate, authorize("teacher"), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).select("-password -__v");
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: "Teacher not found." });
    }

    res.json({
      success: true,
      profile: {
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        professorType: teacher.professorType,
        subjectCodes: teacher.subjectCodes,
        periodsTaken: teacher.periodsTaken,
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
 * Editable fields: professorType
 * Immutable fields: name, email, department, subjectCodes (rejected if present)
 */
router.put(
  "/teacher",
  authenticate,
  authorize("teacher"),
  validateTeacherProfileUpdate,
  async (req, res) => {
    try {
      const { professorType } = req.body;

      // Reject attempts to modify immutable fields
      if (
        req.body.name !== undefined ||
        req.body.email !== undefined ||
        req.body.department !== undefined ||
        req.body.subjectCodes !== undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Name, Email, Department, and Subject Codes cannot be modified.",
        });
      }

      const teacher = await Teacher.findById(req.user.id);
      if (!teacher) {
        return res
          .status(404)
          .json({ success: false, message: "Teacher not found." });
      }

      // Update allowed fields
      if (professorType) teacher.professorType = professorType;
      await teacher.save();

      res.json({
        success: true,
        message: "Profile updated successfully.",
        profile: {
          name: teacher.name,
          email: teacher.email,
          department: teacher.department,
          professorType: teacher.professorType,
          subjectCodes: teacher.subjectCodes,
          periodsTaken: teacher.periodsTaken,
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

/**
 * PUT /profile/teacher/password
 * Change the authenticated teacher's password.
 */
router.put(
  "/teacher/password",
  authenticate,
  authorize("teacher"),
  validateChangePassword,
  async (req, res) => {
    try {
      const { newPassword } = req.body;

      const teacher = await Teacher.findById(req.user.id);
      if (!teacher) {
        return res
          .status(404)
          .json({ success: false, message: "Teacher not found." });
      }

      teacher.password = newPassword;
      await teacher.save();

      res.json({
        success: true,
        message: "Password changed successfully.",
      });
    } catch (error) {
      console.error("Change teacher password error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to change password." });
    }
  },
);

module.exports = router;
