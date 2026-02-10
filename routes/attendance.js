/**
 * Attendance Routes
 * Handles the full attendance lifecycle:
 * - Teacher starts/stops sessions
 * - Backend generates secure QR codes
 * - Student scans and validates QR codes
 * - Attendance records and summaries
 *
 * Endpoints:
 * - POST /attendance/start              (teacher)
 * - POST /attendance/stop               (teacher)
 * - GET  /attendance/session/:id        (teacher)
 * - GET  /attendance/qr/current         (teacher - returns QR image)
 * - GET  /attendance/subject/:subjectCode/summary  (teacher)
 * - POST /attendance/scan               (student)
 * - GET  /attendance/student/:subjectCode          (student)
 */

const express = require("express");
const router = express.Router();

const AttendanceSession = require("../models/AttendanceSession");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Subject = require("../models/Subject");

const { authenticate, authorize } = require("../middleware/auth");
const {
  validateAttendanceStart,
  validateAttendanceScan,
  validateSubjectCodeParam,
} = require("../middleware/validate");
const {
  generateQRPayload,
  generateQRImage,
  validateQRPayload,
} = require("../utils/qrGenerator");

/**
 * POST /attendance/start
 * Teacher initiates an attendance session for a selected subject.
 * Creates a new AttendanceSession and returns the session ID.
 */
router.post(
  "/start",
  authenticate,
  authorize("teacher"),
  validateAttendanceStart,
  async (req, res) => {
    try {
      const { subjectCode } = req.body;
      const teacherId = req.user.id;

      // Verify this teacher is assigned to this subject
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (
        !teacher ||
        !teacher.subjectCodes.includes(subjectCode.toUpperCase())
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to teach this subject.",
        });
      }

      // Check if there's already an active session for this teacher
      const existingSession = await AttendanceSession.findOne({
        teacherId,
        active: true,
      });

      if (existingSession) {
        // End previous session before starting new one
        existingSession.active = false;
        existingSession.endTime = new Date();
        await existingSession.save();
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      // Create new attendance session
      const session = new AttendanceSession({
        subjectCode: subjectCode.toUpperCase(),
        teacherId,
        date: today,
        startTime: new Date(),
        active: true,
        usedNonces: [],
      });
      await session.save();

      res.status(201).json({
        success: true,
        message: "Attendance session started.",
        session: {
          id: session._id,
          subjectCode: session.subjectCode,
          date: session.date,
          startTime: session.startTime,
          active: session.active,
        },
      });
    } catch (error) {
      console.error("Start attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start attendance session.",
      });
    }
  },
);

/**
 * POST /attendance/stop
 * Teacher stops the currently active attendance session.
 */
router.post("/stop", authenticate, authorize("teacher"), async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Find active session for this teacher
    const session = await AttendanceSession.findOne({
      teacherId,
      active: true,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No active attendance session found.",
      });
    }

    // Deactivate the session
    session.active = false;
    session.endTime = new Date();
    await session.save();

    // Count attendance records for this session
    const attendanceCount = await Attendance.countDocuments({
      sessionId: session._id,
    });

    res.json({
      success: true,
      message: "Attendance session stopped.",
      session: {
        id: session._id,
        subjectCode: session.subjectCode,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        attendanceCount,
      },
    });
  } catch (error) {
    console.error("Stop attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop attendance session.",
    });
  }
});

/**
 * GET /attendance/session/:id
 * Retrieve details of a specific attendance session.
 */
router.get(
  "/session/:id",
  authenticate,
  authorize("teacher"),
  async (req, res) => {
    try {
      const session = await AttendanceSession.findById(req.params.id);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session not found.",
        });
      }

      // Verify this session belongs to the requesting teacher
      if (session.teacherId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied.",
        });
      }

      const attendanceCount = await Attendance.countDocuments({
        sessionId: session._id,
      });

      res.json({
        success: true,
        session: {
          id: session._id,
          subjectCode: session.subjectCode,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          active: session.active,
          attendanceCount,
        },
      });
    } catch (error) {
      console.error("Get session error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve session.",
      });
    }
  },
);

/**
 * GET /attendance/qr/current
 * Returns a freshly generated secure QR code image for the teacher's active session.
 * This endpoint is polled every 2 seconds by the frontend to refresh the QR.
 *
 * CRITICAL: This is the sole QR generation endpoint. Frontend NEVER generates QR codes.
 */
router.get(
  "/qr/current",
  authenticate,
  authorize("teacher"),
  async (req, res) => {
    try {
      const teacherId = req.user.id;

      // Find the teacher's active session
      const session = await AttendanceSession.findOne({
        teacherId,
        active: true,
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message:
            "No active attendance session. Please start a session first.",
        });
      }

      // Generate a new secure QR payload
      const { qrData, nonce } = generateQRPayload(
        session._id.toString(),
        teacherId,
        session.subjectCode,
      );

      // Generate QR code image as data URL
      const qrImage = await generateQRImage(qrData);

      // Store the nonce in the session for replay attack prevention
      // Keep only last 100 nonces to prevent unbounded array growth
      if (session.usedNonces.length > 100) {
        session.usedNonces = session.usedNonces.slice(-50);
      }

      res.json({
        success: true,
        qr: {
          image: qrImage,
          sessionId: session._id,
          subjectCode: session.subjectCode,
          generatedAt: Date.now(),
        },
      });
    } catch (error) {
      console.error("Generate QR error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate QR code.",
      });
    }
  },
);

/**
 * POST /attendance/scan
 * Student submits a scanned QR payload for attendance marking.
 *
 * Validation pipeline:
 * 1. Decode & decompress QR payload
 * 2. Verify cryptographic signature
 * 3. Check timestamp freshness
 * 4. Verify session is active
 * 5. Check nonce hasn't been reused (replay prevention)
 * 6. Verify student department matches subject department
 * 7. Prevent duplicate attendance (same subject, same day)
 * 8. Record attendance
 */
router.post(
  "/scan",
  authenticate,
  authorize("student"),
  validateAttendanceScan,
  async (req, res) => {
    try {
      const { qrPayload } = req.body;
      const studentUserId = req.user.id;

      // ─── Step 1-3: Validate QR payload (decode, decompress, verify signature, check timestamp) ───
      const validation = validateQRPayload(qrPayload);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }

      const { sessionId, teacherId, subjectCode, nonce } = validation.payload;

      // ─── Step 4: Verify session is active ───
      const session = await AttendanceSession.findById(sessionId);
      if (!session) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance session.",
        });
      }

      if (!session.active) {
        return res.status(400).json({
          success: false,
          message: "This attendance session has ended.",
        });
      }

      // Verify teacher ID matches session
      if (session.teacherId.toString() !== teacherId) {
        return res.status(400).json({
          success: false,
          message: "QR code does not match the session teacher.",
        });
      }

      // ─── Step 5: Check nonce for replay attack prevention ───
      if (session.usedNonces.includes(nonce)) {
        return res.status(400).json({
          success: false,
          message:
            "This QR code has already been used. Please scan the latest QR code.",
        });
      }

      // ─── Step 6: Verify student department matches subject ───
      const studentUser = await User.findById(studentUserId);
      if (!studentUser) {
        return res.status(404).json({
          success: false,
          message: "Student not found.",
        });
      }

      const subject = await Subject.findOne({
        subjectCode: subjectCode.toUpperCase(),
      });
      if (!subject) {
        return res.status(400).json({
          success: false,
          message: "Subject not found.",
        });
      }

      if (
        studentUser.department.toLowerCase() !==
        subject.department.toLowerCase()
      ) {
        return res.status(403).json({
          success: false,
          message: "Your department does not match this subject's department.",
        });
      }

      // ─── Step 7: Prevent duplicate attendance (same student + subject + day) ───
      const today = new Date().toISOString().split("T")[0];
      const existingAttendance = await Attendance.findOne({
        studentId: studentUserId,
        subjectCode: subjectCode.toUpperCase(),
        date: today,
      });

      if (existingAttendance) {
        return res.status(400).json({
          success: false,
          message: "You have already marked attendance for this subject today.",
        });
      }

      // ─── Step 8: Record attendance and store nonce ───
      const attendance = new Attendance({
        studentId: studentUserId,
        subjectCode: subjectCode.toUpperCase(),
        sessionId: session._id,
        date: today,
        timestamp: new Date(),
      });
      await attendance.save();

      // Mark nonce as used to prevent replay
      session.usedNonces.push(nonce);
      await session.save();

      res.status(201).json({
        success: true,
        message: `Attendance marked successfully for ${subjectCode}.`,
        attendance: {
          subjectCode: attendance.subjectCode,
          date: attendance.date,
          timestamp: attendance.timestamp,
        },
      });
    } catch (error) {
      // Handle duplicate key error (race condition safety net)
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Attendance already marked for this subject today.",
        });
      }
      console.error("Scan attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark attendance.",
      });
    }
  },
);

/**
 * GET /attendance/student/:subjectCode
 * Student views their attendance stats for a specific subject.
 * Returns: total classes conducted, classes attended, attendance percentage.
 */
router.get(
  "/student/:subjectCode",
  authenticate,
  authorize("student"),
  validateSubjectCodeParam,
  async (req, res) => {
    try {
      const studentUserId = req.user.id;
      const subjectCode = req.params.subjectCode.toUpperCase();

      // Get total sessions (unique dates) for this subject
      const totalSessions = await AttendanceSession.distinct("date", {
        subjectCode,
      });

      // Get student's attendance records for this subject
      const attended = await Attendance.countDocuments({
        studentId: studentUserId,
        subjectCode,
      });

      const totalClasses = totalSessions.length;
      const percentage =
        totalClasses > 0
          ? Math.round((attended / totalClasses) * 100 * 100) / 100
          : 0;

      res.json({
        success: true,
        attendance: {
          subjectCode,
          totalClasses,
          classesAttended: attended,
          percentage,
        },
      });
    } catch (error) {
      console.error("Get student attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve attendance data.",
      });
    }
  },
);

/**
 * GET /attendance/subject/:subjectCode/summary
 * Teacher views attendance summary for all students in a subject.
 * Returns a table with: name, roll number, total classes, attended, percentage.
 */
router.get(
  "/subject/:subjectCode/summary",
  authenticate,
  authorize("teacher"),
  validateSubjectCodeParam,
  async (req, res) => {
    try {
      const subjectCode = req.params.subjectCode.toUpperCase();
      const teacherId = req.user.id;

      // Verify teacher teaches this subject
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (!teacher || !teacher.subjectCodes.includes(subjectCode)) {
        return res.status(403).json({
          success: false,
          message: "You do not teach this subject.",
        });
      }

      // Get subject info for department matching
      const subject = await Subject.findOne({ subjectCode });
      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found.",
        });
      }

      // Get total sessions (unique dates) for this subject
      const totalSessions = await AttendanceSession.distinct("date", {
        subjectCode,
      });
      const totalClasses = totalSessions.length;

      // Get all students in the same department
      const students = await User.find({
        role: "student",
        department: { $regex: new RegExp(`^${subject.department}$`, "i") },
      }).select("_id name rollNumber");

      // Build summary for each student
      const summary = [];
      for (const student of students) {
        const attended = await Attendance.countDocuments({
          studentId: student._id,
          subjectCode,
        });

        const percentage =
          totalClasses > 0
            ? Math.round((attended / totalClasses) * 100 * 100) / 100
            : 0;

        summary.push({
          name: student.name,
          rollNumber: student.rollNumber,
          totalClasses,
          classesAttended: attended,
          percentage,
        });
      }

      // Sort by roll number
      summary.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

      res.json({
        success: true,
        subjectCode,
        totalClasses,
        students: summary,
      });
    } catch (error) {
      console.error("Get subject summary error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve attendance summary.",
      });
    }
  },
);

/**
 * GET /attendance/student/history
 * Returns a chronological list of all attendance records for the student.
 */
router.get(
  "/student/history",
  authenticate,
  authorize("student"),
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const history = await Attendance.find({ studentId })
        .sort({ timestamp: -1 })
        .limit(50);

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      console.error("Get attendance history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve attendance history.",
      });
    }
  },
);

/**
 * GET /attendance/teacher/sessions
 * Returns a list of all historical sessions held by the teacher.
 */
router.get(
  "/teacher/sessions",
  authenticate,
  authorize("teacher"),
  async (req, res) => {
    try {
      const teacherId = req.user.id;
      const sessions = await AttendanceSession.find({ teacherId })
        .sort({ startTime: -1 })
        .limit(50);

      // Add attendance count for each session
      const sessionsWithCount = await Promise.all(
        sessions.map(async (s) => {
          const count = await Attendance.countDocuments({ sessionId: s._id });
          return {
            ...s.toObject(),
            attendanceCount: count,
          };
        }),
      );

      res.json({
        success: true,
        sessions: sessionsWithCount,
      });
    } catch (error) {
      console.error("Get teacher sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve session history.",
      });
    }
  },
);

/**
 * GET /attendance/subjects
 * Returns all subjects relevant to the authenticated user.
 * For students: All subjects in their department.
 * For teachers: All subjects they are assigned to teach.
 */
router.get("/subjects", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === "student") {
      const user = await User.findById(userId);
      const subjects = await Subject.find({
        department: { $regex: new RegExp(`^${user.department}$`, "i") },
      });
      return res.json({ success: true, subjects });
    } else {
      const teacher = await Teacher.findOne({ userId });
      const subjects = await Subject.find({
        subjectCode: { $in: teacher.subjectCodes },
      });
      return res.json({ success: true, subjects });
    }
  } catch (error) {
    console.error("Get subjects error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve subjects.",
    });
  }
});

module.exports = router;
