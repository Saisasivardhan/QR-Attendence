/**
 * Attendance Routes
 * Handles the full attendance lifecycle using the Period model:
 * - Teacher starts/stops periods
 * - Backend generates secure QR codes
 * - Student scans and validates QR codes
 * - Attendance records and summaries
 *
 * Endpoints:
 * - POST /attendance/start                          (teacher)
 * - POST /attendance/stop                           (teacher)
 * - GET  /attendance/session/:id                    (teacher)
 * - GET  /attendance/qr/current                     (teacher - returns QR image)
 * - GET  /attendance/subject/:subjectCode/summary   (teacher)
 * - POST /attendance/scan                           (student)
 * - GET  /attendance/student/:subjectCode           (student)
 */

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Period = require("../models/Period");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

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
const {
  getCurrentIstDateString,
  getIstDateString,
  getIstDayRange,
} = require("../utils/date");

function getPeriodIstDate(period) {
  return getIstDateString(period.attendenceStartTime || new Date());
}

/**
 * POST /attendance/start
 * Teacher initiates an attendance period for a selected subject.
 * Creates a new Period and adds it to teacher's periodsTaken.
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
      const teacher = await Teacher.findById(teacherId);
      if (
        !teacher ||
        !teacher.subjectCodes.includes(subjectCode.toUpperCase())
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to teach this subject.",
        });
      }

      // Check if there's already an active period (no endTime) for this teacher
      const existingPeriod = await Period.findOne({
        teacher_id: teacherId,
        attendenceEndTime: null,
      });

      if (existingPeriod) {
        // End previous period before starting new one
        existingPeriod.attendenceEndTime = new Date();
        await existingPeriod.save();
      }

      // Store session dates in IST so midnight rollover matches local institute time.
      const today = getCurrentIstDateString();

      // Create new period
      const period = new Period({
        teacher_id: teacherId,
        subjectCode: subjectCode.toUpperCase(),
        date: today,
        attendenceStartTime: new Date(),
        studentsPresent: [],
      });
      await period.save();

      // Add period to teacher's periodsTaken
      teacher.periodsTaken.push(period._id);
      await teacher.save();

      res.status(201).json({
        success: true,
        message: "Attendance period started.",
        session: {
          id: period._id,
          subjectCode: period.subjectCode,
          date: getPeriodIstDate(period),
          startTime: period.attendenceStartTime,
          active: true,
        },
      });
    } catch (error) {
      console.error("Start attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start attendance period.",
      });
    }
  },
);

/**
 * POST /attendance/stop
 * Teacher stops the currently active attendance period.
 */
router.post("/stop", authenticate, authorize("teacher"), async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Find active period (no endTime) for this teacher
    const period = await Period.findOne({
      teacher_id: teacherId,
      attendenceEndTime: null,
    });

    if (!period) {
      return res.status(404).json({
        success: false,
        message: "No active attendance period found.",
      });
    }

    // End the period
    period.attendenceEndTime = new Date();
    await period.save();

    res.json({
      success: true,
      message: "Attendance period stopped.",
      session: {
        id: period._id,
        subjectCode: period.subjectCode,
        date: getPeriodIstDate(period),
        startTime: period.attendenceStartTime,
        endTime: period.attendenceEndTime,
        attendanceCount: period.studentsPresent.length,
      },
    });
  } catch (error) {
    console.error("Stop attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop attendance period.",
    });
  }
});

/**
 * GET /attendance/session/:id
 * Retrieve details of a specific attendance period.
 */
router.get(
  "/session/:id",
  authenticate,
  authorize("teacher"),
  async (req, res) => {
    try {
      const period = await Period.findById(req.params.id);

      if (!period) {
        return res.status(404).json({
          success: false,
          message: "Period not found.",
        });
      }

      // Verify this period belongs to the requesting teacher
      if (period.teacher_id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied.",
        });
      }

      res.json({
        success: true,
        session: {
          id: period._id,
          subjectCode: period.subjectCode,
          date: getPeriodIstDate(period),
          startTime: period.attendenceStartTime,
          endTime: period.attendenceEndTime,
          active: period.attendenceEndTime === null,
          attendanceCount: period.studentsPresent.length,
        },
      });
    } catch (error) {
      console.error("Get session error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve period.",
      });
    }
  },
);

/**
 * GET /attendance/qr/current
 * Returns a freshly generated secure QR code image for the teacher's active period.
 */
router.get(
  "/qr/current",
  authenticate,
  authorize("teacher"),
  async (req, res) => {
    try {
      const teacherId = req.user.id;

      // Find the teacher's active period
      const period = await Period.findOne({
        teacher_id: teacherId,
        attendenceEndTime: null,
      });

      if (!period) {
        return res.status(404).json({
          success: false,
          message:
            "No active attendance period. Please start a period first.",
        });
      }

      // Generate a new secure QR payload
      const { qrData, nonce } = generateQRPayload(
        period._id.toString(),
        teacherId,
        period.subjectCode,
      );

      // Generate QR code image as data URL
      const qrImage = await generateQRImage(qrData);

      res.json({
        success: true,
        qr: {
          image: qrImage,
          sessionId: period._id,
          subjectCode: period.subjectCode,
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
 * 4. Verify period is active
 * 5. Verify student is registered for this subject
 * 6. Prevent duplicate attendance (same period)
 * 7. Record attendance
 */
router.post(
  "/scan",
  authenticate,
  authorize("student"),
  validateAttendanceScan,
  async (req, res) => {
    try {
      const { qrPayload } = req.body;
      const studentId = req.user.id;

      // Step 1-3: Validate QR payload
      const validation = validateQRPayload(qrPayload);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }

      const { sessionId, teacherId, subjectCode } = validation.payload;

      // Step 4: Verify period is active
      const period = await Period.findById(sessionId);
      if (!period) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance period.",
        });
      }

      if (period.attendenceEndTime !== null) {
        return res.status(400).json({
          success: false,
          message: "This attendance period has ended.",
        });
      }

      // Verify teacher ID matches period
      if (period.teacher_id.toString() !== teacherId) {
        return res.status(400).json({
          success: false,
          message: "QR code does not match the period teacher.",
        });
      }

      // Step 5: Verify student is registered for this subject
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found.",
        });
      }

      if (!student.subjectCodes.includes(subjectCode.toUpperCase())) {
        return res.status(403).json({
          success: false,
          message: "You are not registered for this subject.",
        });
      }

      // Step 6: Prevent duplicate attendance (same student in same period)
      if (period.studentsPresent.some((id) => id.toString() === studentId)) {
        return res.status(400).json({
          success: false,
          message: "You have already marked attendance for this period.",
        });
      }

      // Step 7: Record attendance — push student id to studentsPresent
      period.studentsPresent.push(studentId);
      await period.save();

      res.status(201).json({
        success: true,
        message: `Attendance marked successfully for ${subjectCode}.`,
        attendance: {
          subjectCode: period.subjectCode,
          date: getPeriodIstDate(period),
          timestamp: new Date(),
        },
      });
    } catch (error) {
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
 */
router.get(
  "/student/:subjectCode",
  authenticate,
  authorize("student"),
  validateSubjectCodeParam,
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const subjectCode = req.params.subjectCode.toUpperCase();

      // Get all periods for this subject
      const allPeriods = await Period.find({ subjectCode })
        .sort({ attendenceStartTime: 1 })
        .select("attendenceStartTime studentsPresent");

      const totalPeriods = allPeriods.length;

      // Build per-date records and count attended
      let attended = 0;
      const records = allPeriods.map((period) => {
        const present = period.studentsPresent.some(
          (id) => id.toString() === studentId,
        );
        if (present) attended++;
        return {
          date: getPeriodIstDate(period),
          time: period.attendenceStartTime,
          status: present ? "Present" : "Absent",
        };
      });

      const percentage =
        totalPeriods > 0
          ? Math.round((attended / totalPeriods) * 100 * 100) / 100
          : 0;

      res.json({
        success: true,
        attendance: {
          subjectCode,
          totalClasses: totalPeriods,
          classesAttended: attended,
          percentage,
          records,
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
 * Teacher views attendance summary for all students registered for a subject.
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
      const teacher = await Teacher.findById(teacherId);
      if (!teacher || !teacher.subjectCodes.includes(subjectCode)) {
        return res.status(403).json({
          success: false,
          message: "You do not teach this subject.",
        });
      }

      // Get total periods for this subject
      const totalPeriods = await Period.countDocuments({ subjectCode });

      // Get all students registered for this subject
      const students = await Student.find({
        subjectCodes: subjectCode,
      }).select("_id name email rollNumber");

      // Build summary for each student
      const summary = [];
      for (const student of students) {
        const attended = await Period.countDocuments({
          subjectCode,
          studentsPresent: student._id,
        });

        const percentage =
          totalPeriods > 0
            ? Math.round((attended / totalPeriods) * 100 * 100) / 100
            : 0;

        summary.push({
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          totalClasses: totalPeriods,
          classesAttended: attended,
          percentage,
        });
      }

      // Sort by name
      summary.sort((a, b) => a.name.localeCompare(b.name));

      res.json({
        success: true,
        subjectCode,
        totalClasses: totalPeriods,
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
 * Returns a chronological list of attendance for the student.
 */
router.get(
  "/student/history",
  authenticate,
  authorize("student"),
  async (req, res) => {
    try {
      const studentId = req.user.id;

      const periods = await Period.find({ studentsPresent: studentId })
        .sort({ attendenceStartTime: -1 })
        .limit(50)
        .select("subjectCode attendenceStartTime");

      const history = periods.map((period) => ({
        _id: period._id,
        subjectCode: period.subjectCode,
        date: getPeriodIstDate(period),
        attendenceStartTime: period.attendenceStartTime,
      }));

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
 * Returns a list of all historical periods held by the teacher.
 */
router.get(
  "/teacher/sessions",
  authenticate,
  authorize("teacher"),
  async (req, res) => {
    try {
      const teacherId = req.user.id;
      const periods = await Period.find({ teacher_id: teacherId })
        .sort({ attendenceStartTime: -1 })
        .limit(50);

      const sessionsWithCount = periods.map((p) => ({
        ...p.toObject(),
        attendanceCount: p.studentsPresent.length,
      }));

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
 * GET /attendance/subject/:subjectCode/sessions
 * Returns paginated sessions for a teacher and subject, with optional date filtering.
 */
router.get(
  "/subject/:subjectCode/sessions",
  authenticate,
  authorize("teacher"),
  validateSubjectCodeParam,
  async (req, res) => {
    try {
      const subjectCode = req.params.subjectCode.toUpperCase();
      const teacherId = req.user.id;
      const teacher = await Teacher.findById(teacherId).select("subjectCodes");

      if (!teacher || !teacher.subjectCodes.includes(subjectCode)) {
        return res.status(403).json({
          success: false,
          message: "You do not teach this subject.",
        });
      }

      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
      const date = typeof req.query.date === "string" ? req.query.date.trim() : "";

      const filter = {
        teacher_id: teacherId,
        subjectCode,
      };

      if (date) {
        const { start, end } = getIstDayRange(date);
        filter.attendenceStartTime = { $gte: start, $lte: end };
      }

      const total = await Period.countDocuments(filter);
      const periods = await Period.find(filter)
        .sort({ attendenceStartTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("_id date attendenceStartTime attendenceEndTime studentsPresent")
        .lean();

      res.json({
        success: true,
        subjectCode,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        sessions: periods.map((period) => ({
          id: period._id,
          date: getPeriodIstDate(period),
          startTime: period.attendenceStartTime,
          endTime: period.attendenceEndTime,
          attendanceCount: period.studentsPresent.length,
          active: period.attendenceEndTime === null,
        })),
      });
    } catch (error) {
      console.error("Get subject sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve subject sessions.",
      });
    }
  },
);

/**
 * DELETE /attendance/subject/:subjectCode/session/:periodId
 * Permanently deletes one attendance session for the teacher and subject.
 */
router.delete(
  "/subject/:subjectCode/session/:periodId",
  authenticate,
  authorize("teacher"),
  validateSubjectCodeParam,
  async (req, res) => {
    try {
      const subjectCode = req.params.subjectCode.toUpperCase();
      const teacherId = req.user.id;
      const { periodId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(periodId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid session ID.",
        });
      }

      const teacher = await Teacher.findById(teacherId).select("subjectCodes periodsTaken");
      if (!teacher || !teacher.subjectCodes.includes(subjectCode)) {
        return res.status(403).json({
          success: false,
          message: "You do not teach this subject.",
        });
      }

      const period = await Period.findOne({
        _id: periodId,
        teacher_id: teacherId,
        subjectCode,
      });

      if (!period) {
        return res.status(404).json({
          success: false,
          message: "Session not found.",
        });
      }

      if (period.attendenceEndTime === null) {
        return res.status(400).json({
          success: false,
          message: "Active sessions cannot be deleted. Stop the session first.",
        });
      }

      await Period.deleteOne({ _id: period._id });
      teacher.periodsTaken = teacher.periodsTaken.filter(
        (id) => id.toString() !== period._id.toString(),
      );
      await teacher.save();

      res.json({
        success: true,
        message: "Session deleted successfully.",
        deletedSession: {
          id: period._id,
          date: getPeriodIstDate(period),
          startTime: period.attendenceStartTime,
          endTime: period.attendenceEndTime,
        },
      });
    } catch (error) {
      console.error("Delete subject session error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete session.",
      });
    }
  },
);

/**
 * GET /attendance/subjects
 * Returns all subjects relevant to the authenticated user.
 * For students: subjects they are registered for.
 * For teachers: subjects they teach.
 */
router.get("/subjects", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === "student") {
      const student = await Student.findById(userId);
      return res.json({
        success: true,
        subjects: (student?.subjectCodes || []).map((code) => ({ subjectCode: code })),
      });
    } else {
      const teacher = await Teacher.findById(userId);
      return res.json({
        success: true,
        subjects: (teacher?.subjectCodes || []).map((code) => ({ subjectCode: code })),
      });
    }
  } catch (error) {
    console.error("Get subjects error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve subjects.",
    });
  }
});

/**
 * GET /attendance/subject/:subjectCode/grid
 * Returns a full attendance grid: all students (rows) x all periods/dates (columns).
 * Each cell indicates whether the student was present in that period.
 * Used by the "Manage Students Attendance" page.
 */
router.get(
  "/subject/:subjectCode/grid",
  authenticate,
  authorize("teacher"),
  validateSubjectCodeParam,
  async (req, res) => {
    try {
      const subjectCode = req.params.subjectCode.toUpperCase();
      const teacherId = req.user.id;

      // Verify teacher teaches this subject
      const teacher = await Teacher.findById(teacherId);
      if (!teacher || !teacher.subjectCodes.includes(subjectCode)) {
        return res.status(403).json({
          success: false,
          message: "You do not teach this subject.",
        });
      }

      // Get all periods for this subject taught by this teacher, sorted by date
      const periods = await Period.find({
        subjectCode,
        teacher_id: teacherId,
      })
        .sort({ attendenceStartTime: 1 })
        .select("_id attendenceStartTime studentsPresent");

      // Get all students registered for this subject
      const students = await Student.find({
        subjectCodes: subjectCode,
      })
        .select("_id name rollNumber")
        .sort({ name: 1 });

      // Build columns (one per period)
      const columns = periods.map((p) => ({
        periodId: p._id,
        date: getPeriodIstDate(p),
        time: p.attendenceStartTime,
      }));

      // Build rows (one per student) with attendance status per period
      const rows = students.map((student) => {
        const attendance = {};
        periods.forEach((p) => {
          attendance[p._id.toString()] = p.studentsPresent.some(
            (id) => id.toString() === student._id.toString(),
          );
        });
        return {
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          attendance,
        };
      });

      res.json({
        success: true,
        subjectCode,
        columns,
        rows,
      });
    } catch (error) {
      console.error("Get attendance grid error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve attendance grid.",
      });
    }
  },
);

/**
 * PUT /attendance/subject/:subjectCode/grid
 * Bulk-update attendance for a subject.
 * Accepts a map of { periodId: [studentId, ...] } representing the new studentsPresent for each period.
 */
router.put(
  "/subject/:subjectCode/grid",
  authenticate,
  authorize("teacher"),
  validateSubjectCodeParam,
  async (req, res) => {
    try {
      const subjectCode = req.params.subjectCode.toUpperCase();
      const teacherId = req.user.id;
      const { updates } = req.body; // { periodId: [studentId, ...], ... }

      if (!updates || typeof updates !== "object") {
        return res.status(400).json({
          success: false,
          message: "Invalid request body. Expected { updates: { periodId: [studentIds] } }.",
        });
      }

      // Verify teacher teaches this subject
      const teacher = await Teacher.findById(teacherId);
      if (!teacher || !teacher.subjectCodes.includes(subjectCode)) {
        return res.status(403).json({
          success: false,
          message: "You do not teach this subject.",
        });
      }

      // Get the set of valid student IDs for this subject
      const validStudents = await Student.find({
        subjectCodes: subjectCode,
      }).select("_id");
      const validStudentIds = new Set(validStudents.map((s) => s._id.toString()));

      const periodIds = Object.keys(updates);

      // Validate all periods belong to this teacher and subject
      const periods = await Period.find({
        _id: { $in: periodIds },
        subjectCode,
        teacher_id: teacherId,
      });

      if (periods.length !== periodIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more period IDs are invalid or do not belong to you.",
        });
      }

      // Update each period
      for (const period of periods) {
        const newPresent = updates[period._id.toString()];
        if (!Array.isArray(newPresent)) continue;

        // Filter to only valid student IDs
        const filtered = newPresent.filter((id) => validStudentIds.has(id));
        period.studentsPresent = filtered;
        await period.save();
      }

      res.json({
        success: true,
        message: "Attendance updated successfully.",
      });
    } catch (error) {
      console.error("Update attendance grid error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update attendance.",
      });
    }
  },
);

module.exports = router;
