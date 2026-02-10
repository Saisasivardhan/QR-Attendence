/**
 * Input Validation Middleware
 * Uses express-validator to sanitize and validate incoming request data.
 * Prevents injection attacks and ensures data integrity.
 */

const { body, param, validationResult } = require("express-validator");

/**
 * Process validation results - returns 400 with error details if validation fails
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
}

// ─── Student Registration Validation ───
const validateStudentRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2-100 characters")
    .escape(),
  body("rollNumber")
    .trim()
    .notEmpty()
    .withMessage("Roll number is required")
    .isAlphanumeric()
    .withMessage("Roll number must be alphanumeric")
    .toUpperCase(),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("graduation")
    .trim()
    .notEmpty()
    .withMessage("Graduation type is required")
    .isIn(["BTech", "MTech", "PhD"])
    .withMessage("Graduation must be BTech, MTech, or PhD"),
  body("year")
    .notEmpty()
    .withMessage("Year is required")
    .isInt({ min: 1, max: 6 })
    .withMessage("Year must be between 1 and 6")
    .toInt(),
  body("department")
    .trim()
    .notEmpty()
    .withMessage("Department is required")
    .escape(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  handleValidationErrors,
];

// ─── Teacher Registration Validation ───
const validateTeacherRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2-100 characters")
    .escape(),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("professorType")
    .trim()
    .notEmpty()
    .withMessage("Professor type is required")
    .isIn(["Assistant", "Associate", "Professor"])
    .withMessage("Invalid professor type"),
  body("department")
    .trim()
    .notEmpty()
    .withMessage("Department is required")
    .escape(),
  body("subjectCodes")
    .isArray({ min: 1 })
    .withMessage("At least one subject code is required"),
  body("subjectCodes.*")
    .trim()
    .notEmpty()
    .withMessage("Subject code cannot be empty")
    .isAlphanumeric()
    .withMessage("Subject code must be alphanumeric"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  handleValidationErrors,
];

// ─── Login Validation ───
const validateStudentLogin = [
  body("rollNumber")
    .trim()
    .notEmpty()
    .withMessage("Roll number is required")
    .toUpperCase(),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

const validateTeacherLogin = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// ─── Profile Update Validation ───
const validateStudentProfileUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2-100 characters")
    .escape(),
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("year")
    .optional()
    .isInt({ min: 1, max: 6 })
    .withMessage("Year must be between 1 and 6")
    .toInt(),
  handleValidationErrors,
];

const validateTeacherProfileUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2-100 characters")
    .escape(),
  body("professorType")
    .optional()
    .trim()
    .isIn(["Assistant", "Associate", "Professor"])
    .withMessage("Invalid professor type"),
  handleValidationErrors,
];

// ─── Attendance Validation ───
const validateAttendanceStart = [
  body("subjectCode")
    .trim()
    .notEmpty()
    .withMessage("Subject code is required")
    .toUpperCase(),
  handleValidationErrors,
];

const validateAttendanceScan = [
  body("qrPayload").notEmpty().withMessage("QR payload is required"),
  handleValidationErrors,
];

const validateSubjectCodeParam = [
  param("subjectCode")
    .trim()
    .notEmpty()
    .withMessage("Subject code is required")
    .toUpperCase(),
  handleValidationErrors,
];

module.exports = {
  validateStudentRegister,
  validateTeacherRegister,
  validateStudentLogin,
  validateTeacherLogin,
  validateStudentProfileUpdate,
  validateTeacherProfileUpdate,
  validateAttendanceStart,
  validateAttendanceScan,
  validateSubjectCodeParam,
};
