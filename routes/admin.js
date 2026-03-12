/**
 * Admin Routes
 * Handles all admin dashboard API operations.
 *
 * Endpoints:
 * - GET  /admin/stats                         Dashboard statistics
 * - GET  /admin/students                      List all students
 * - GET  /admin/teachers                      List all teachers
 * - GET  /admin/students/:id/recovery-codes   View student recovery codes
 * - GET  /admin/teachers/:id/recovery-codes   View teacher recovery codes
 * - POST /admin/students/:id/recovery-codes   Regenerate student recovery codes
 * - POST /admin/teachers/:id/recovery-codes   Regenerate teacher recovery codes
 * - PUT  /admin/students/:id/reset-password   Reset student password
 * - PUT  /admin/teachers/:id/reset-password   Reset teacher password
 * - DELETE /admin/students/:id                Delete student
 * - DELETE /admin/teachers/:id                Delete teacher
 * - GET  /admin/attendance/overview           System-wide attendance overview
 * - GET  /admin/attendance/live-sessions      Currently active sessions
 * - GET  /admin/attendance/subject/:code      Subject attendance detail
 * - GET  /admin/activity                      Recent activity / audit log
 * - POST /admin/import                        Bulk import teachers & students from parsed Excel data
 */

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Period = require("../models/Period");
const ApiKey = require("../models/ApiKey");
const { authenticate, authorize } = require("../middleware/auth");
const { getCurrentIstDateString, getIstDayRange } = require("../utils/date");

// All admin routes require admin authentication
router.use(authenticate, authorize("admin"));

// ─── Dashboard Stats ───
router.get("/stats", async (req, res) => {
  try {
    const [
      totalStudents,
      registeredStudents,
      totalTeachers,
      registeredTeachers,
      totalSessions,
      activeSessions,
      todaySessions,
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ password: { $ne: null } }),
      Teacher.countDocuments(),
      Teacher.countDocuments({ password: { $ne: null } }),
      Period.countDocuments(),
      Period.countDocuments({ attendenceEndTime: null }),
      Period.countDocuments({
        date: getCurrentIstDateString(),
      }),
    ]);

    // Get unique subjects
    const studentSubjects = await Student.distinct("subjectCodes");
    const teacherSubjects = await Teacher.distinct("subjectCodes");
    const allSubjects = [...new Set([...studentSubjects, ...teacherSubjects])];

    res.json({
      success: true,
      stats: {
        totalStudents,
        registeredStudents,
        preSeededStudents: totalStudents - registeredStudents,
        totalTeachers,
        registeredTeachers,
        preSeededTeachers: totalTeachers - registeredTeachers,
        totalSessions,
        activeSessions,
        todaySessions,
        totalSubjects: allSubjects.length,
        subjects: allSubjects,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
});

// ─── List Students ───
router.get("/students", async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { email: regex }, { rollNumber: regex }];
    }

    if (status === "registered") filter.password = { $ne: null };
    if (status === "pre-seeded") filter.password = null;

    const students = await Student.find(filter)
      .select("name email rollNumber department gradProgram year subjectCodes recoveryCodes password createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const result = students.map((s) => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      rollNumber: s.rollNumber,
      department: s.department,
      gradProgram: s.gradProgram,
      year: s.year,
      subjectCodes: s.subjectCodes,
      isRegistered: !!s.password,
      recoveryCodesLeft: s.recoveryCodes ? s.recoveryCodes.length : 0,
      createdAt: s.createdAt,
    }));

    res.json({ success: true, students: result, count: result.length });
  } catch (error) {
    console.error("Admin list students error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch students." });
  }
});

// ─── List Teachers ───
router.get("/teachers", async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    if (status === "registered") filter.password = { $ne: null };
    if (status === "pre-seeded") filter.password = null;

    const teachers = await Teacher.find(filter)
      .select("name email department professorType subjectCodes recoveryCodes password periodsTaken createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const result = teachers.map((t) => ({
      _id: t._id,
      name: t.name,
      email: t.email,
      department: t.department,
      professorType: t.professorType,
      subjectCodes: t.subjectCodes,
      isRegistered: !!t.password,
      recoveryCodesLeft: t.recoveryCodes ? t.recoveryCodes.length : 0,
      totalSessions: t.periodsTaken ? t.periodsTaken.length : 0,
      createdAt: t.createdAt,
    }));

    res.json({ success: true, teachers: result, count: result.length });
  } catch (error) {
    console.error("Admin list teachers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch teachers." });
  }
});

// ─── View Student Recovery Codes ───
router.get("/students/:id/recovery-codes", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select("name email recoveryCodes");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    res.json({
      success: true,
      user: { name: student.name, email: student.email },
      recoveryCodes: student.recoveryCodes || [],
      remaining: student.recoveryCodes ? student.recoveryCodes.length : 0,
    });
  } catch (error) {
    console.error("Admin view student recovery codes error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recovery codes." });
  }
});

// ─── View Teacher Recovery Codes ───
router.get("/teachers/:id/recovery-codes", async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select("name email recoveryCodes");
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found." });
    }

    res.json({
      success: true,
      user: { name: teacher.name, email: teacher.email },
      recoveryCodes: teacher.recoveryCodes || [],
      remaining: teacher.recoveryCodes ? teacher.recoveryCodes.length : 0,
    });
  } catch (error) {
    console.error("Admin view teacher recovery codes error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recovery codes." });
  }
});

// ─── Regenerate Student Recovery Codes ───
router.post("/students/:id/recovery-codes", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const recoveryCodes = Array.from({ length: 8 }, () => uuidv4().split("-")[0].toUpperCase());
    student.recoveryCodes = recoveryCodes;
    await student.save();

    res.json({
      success: true,
      message: "Recovery codes regenerated for " + student.name,
      recoveryCodes,
    });
  } catch (error) {
    console.error("Admin regenerate student recovery codes error:", error);
    res.status(500).json({ success: false, message: "Failed to regenerate recovery codes." });
  }
});

// ─── Regenerate Teacher Recovery Codes ───
router.post("/teachers/:id/recovery-codes", async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found." });
    }

    const recoveryCodes = Array.from({ length: 8 }, () => uuidv4().split("-")[0].toUpperCase());
    teacher.recoveryCodes = recoveryCodes;
    await teacher.save();

    res.json({
      success: true,
      message: "Recovery codes regenerated for " + teacher.name,
      recoveryCodes,
    });
  } catch (error) {
    console.error("Admin regenerate teacher recovery codes error:", error);
    res.status(500).json({ success: false, message: "Failed to regenerate recovery codes." });
  }
});

// ─── Reset Student Password ───
router.put("/students/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    student.password = newPassword;
    await student.save();

    res.json({ success: true, message: "Password reset for " + student.name });
  } catch (error) {
    console.error("Admin reset student password error:", error);
    res.status(500).json({ success: false, message: "Failed to reset password." });
  }
});

// ─── Reset Teacher Password ───
router.put("/teachers/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found." });
    }

    teacher.password = newPassword;
    await teacher.save();

    res.json({ success: true, message: "Password reset for " + teacher.name });
  } catch (error) {
    console.error("Admin reset teacher password error:", error);
    res.status(500).json({ success: false, message: "Failed to reset password." });
  }
});

// ─── Edit Student ───
router.put("/students/:id/edit", async (req, res) => {
  try {
    const { name, rollNumber, subjectCodes, gradProgram, year, department } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name is required (min 2 characters)." });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    student.name = name.trim();
    if (rollNumber !== undefined) student.rollNumber = rollNumber.trim().toUpperCase() || undefined;
    if (subjectCodes !== undefined) student.subjectCodes = subjectCodes;
    if (gradProgram !== undefined) student.gradProgram = gradProgram || undefined;
    if (year !== undefined) student.year = year || undefined;
    if (department !== undefined) student.department = department.trim() || undefined;

    await student.save();
    res.json({ success: true, message: "Student \"" + student.name + "\" updated successfully." });
  } catch (error) {
    console.error("Admin edit student error:", error);
    res.status(500).json({ success: false, message: "Failed to update student: " + error.message });
  }
});

// ─── Edit Teacher ───
router.put("/teachers/:id/edit", async (req, res) => {
  try {
    const { name, subjectCodes, department, professorType } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name is required (min 2 characters)." });
    }

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found." });
    }

    teacher.name = name.trim();
    if (subjectCodes !== undefined) teacher.subjectCodes = subjectCodes;
    if (department !== undefined) teacher.department = department.trim() || undefined;
    if (professorType !== undefined) teacher.professorType = professorType || undefined;

    await teacher.save();
    res.json({ success: true, message: "Teacher \"" + teacher.name + "\" updated successfully." });
  } catch (error) {
    console.error("Admin edit teacher error:", error);
    res.status(500).json({ success: false, message: "Failed to update teacher: " + error.message });
  }
});

// ─── Delete Student ───
router.delete("/students/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    // Remove student from all period attendance records
    await Period.updateMany(
      { studentsPresent: student._id },
      { $pull: { studentsPresent: student._id } },
    );

    await Student.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Student " + student.name + " deleted." });
  } catch (error) {
    console.error("Admin delete student error:", error);
    res.status(500).json({ success: false, message: "Failed to delete student." });
  }
});

// ─── Delete Teacher ───
router.delete("/teachers/:id", async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found." });
    }

    await Teacher.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Teacher " + teacher.name + " deleted." });
  } catch (error) {
    console.error("Admin delete teacher error:", error);
    res.status(500).json({ success: false, message: "Failed to delete teacher." });
  }
});

// ─── System-Wide Attendance Overview ───
router.get("/attendance/overview", async (req, res) => {
  try {
    // Get all subjects
    const teacherSubjects = await Teacher.distinct("subjectCodes");
    const studentSubjects = await Student.distinct("subjectCodes");
    const allSubjects = [...new Set([...teacherSubjects, ...studentSubjects])];

    const overview = [];

    for (const code of allSubjects) {
      const totalPeriods = await Period.countDocuments({ subjectCode: code });
      const enrolledStudents = await Student.countDocuments({ subjectCodes: code });
      const teachers = await Teacher.find({ subjectCodes: code }).select("name").lean();

      // Calculate average attendance
      let avgAttendance = 0;
      if (totalPeriods > 0 && enrolledStudents > 0) {
        const periods = await Period.find({ subjectCode: code }).select("studentsPresent").lean();
        const totalPresent = periods.reduce((sum, p) => sum + p.studentsPresent.length, 0);
        avgAttendance = Math.round((totalPresent / (totalPeriods * enrolledStudents)) * 100);
      }

      overview.push({
        subjectCode: code,
        totalPeriods,
        enrolledStudents,
        teachers: teachers.map((t) => t.name),
        avgAttendance,
      });
    }

    overview.sort((a, b) => b.totalPeriods - a.totalPeriods);

    res.json({ success: true, overview });
  } catch (error) {
    console.error("Admin attendance overview error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch attendance overview." });
  }
});

// ─── Live Sessions ───
router.get("/attendance/live-sessions", async (req, res) => {
  try {
    const activeSessions = await Period.find({ attendenceEndTime: null })
      .populate("teacher_id", "name email")
      .populate("studentsPresent", "name rollNumber")
      .sort({ attendenceStartTime: -1 })
      .lean();

    const sessions = activeSessions.map((s) => ({
      _id: s._id,
      subjectCode: s.subjectCode,
      date: s.date,
      startTime: s.attendenceStartTime,
      teacher: s.teacher_id ? { name: s.teacher_id.name, email: s.teacher_id.email } : null,
      studentsPresent: s.studentsPresent.length,
      studentList: s.studentsPresent.map((st) => ({ name: st.name, rollNumber: st.rollNumber })),
    }));

    res.json({ success: true, sessions, count: sessions.length });
  } catch (error) {
    console.error("Admin live sessions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch live sessions." });
  }
});

// ─── Subject Attendance Detail ───
router.get("/attendance/subject/:code", async (req, res) => {
  try {
    const subjectCode = req.params.code.toUpperCase();

    const periods = await Period.find({ subjectCode })
      .populate("teacher_id", "name")
      .populate("studentsPresent", "name rollNumber")
      .sort({ date: -1 })
      .lean();

    const enrolledStudents = await Student.find({ subjectCodes: subjectCode })
      .select("name rollNumber email")
      .lean();

    // Build student attendance summary
    const studentAttendance = enrolledStudents.map((s) => {
      const attended = periods.filter((p) =>
        p.studentsPresent.some((sp) => sp._id.toString() === s._id.toString()),
      ).length;
      return {
        _id: s._id,
        name: s.name,
        rollNumber: s.rollNumber,
        email: s.email,
        attended,
        total: periods.length,
        percentage: periods.length > 0 ? Math.round((attended / periods.length) * 100) : 0,
      };
    });

    studentAttendance.sort((a, b) => a.percentage - b.percentage);

    res.json({
      success: true,
      subjectCode,
      totalPeriods: periods.length,
      enrolledStudents: enrolledStudents.length,
      studentAttendance,
      lowAttendance: studentAttendance.filter((s) => s.percentage < 75),
    });
  } catch (error) {
    console.error("Admin subject attendance error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch subject attendance." });
  }
});

// ─── Activity / Audit Log ───
router.get("/activity", async (req, res) => {
  try {
    // Get recent sessions (last 50)
    const recentSessions = await Period.find()
      .populate("teacher_id", "name email")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const activities = recentSessions.map((s) => ({
      type: "session",
      subjectCode: s.subjectCode,
      date: s.date,
      startTime: s.attendenceStartTime,
      endTime: s.attendenceEndTime,
      isActive: !s.attendenceEndTime,
      teacher: s.teacher_id ? s.teacher_id.name : "Unknown",
      studentsCount: s.studentsPresent.length,
      createdAt: s.createdAt,
    }));

    // Get recently registered users
    const recentStudents = await Student.find({ password: { $ne: null } })
      .select("name email createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const recentTeachers = await Teacher.find({ password: { $ne: null } })
      .select("name email createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const registrations = [
      ...recentStudents.map((s) => ({ type: "registration", role: "student", name: s.name, email: s.email, createdAt: s.createdAt })),
      ...recentTeachers.map((t) => ({ type: "registration", role: "teacher", name: t.name, email: t.email, createdAt: t.createdAt })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, sessions: activities, registrations });
  } catch (error) {
    console.error("Admin activity log error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch activity log." });
  }
});

// ─── Quick Add (single user) ───
router.post("/quick-add", async (req, res) => {
  try {
    const { role, email, name, subjectCodes, rollNumber } = req.body;

    if (!role || !email || !name) {
      return res.status(400).json({ success: false, message: "Role, email, and name are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const codes = (subjectCodes || "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (role === "teacher") {
      await Teacher.findOneAndUpdate(
        { email: cleanEmail },
        {
          $set: { name: cleanName, email: cleanEmail },
          $addToSet: codes.length ? { subjectCodes: { $each: codes } } : {},
        },
        { upsert: true, new: true },
      );
      return res.json({ success: true, message: `Teacher "${cleanName}" added successfully.` });
    }

    if (role === "student") {
      const cleanRoll = (rollNumber || "").trim().toUpperCase();
      const setFields = { name: cleanName, email: cleanEmail };
      if (cleanRoll) setFields.rollNumber = cleanRoll;

      await Student.findOneAndUpdate(
        { email: cleanEmail },
        {
          $set: setFields,
          $addToSet: codes.length ? { subjectCodes: { $each: codes } } : {},
        },
        { upsert: true, new: true },
      );
      return res.json({ success: true, message: `Student "${cleanName}" added successfully.` });
    }

    return res.status(400).json({ success: false, message: "Invalid role. Must be 'student' or 'teacher'." });
  } catch (error) {
    console.error("Admin quick-add error:", error);
    res.status(500).json({ success: false, message: "Quick add failed: " + error.message });
  }
});

// ─── Bulk Import (from client-parsed Excel) ───
router.post("/import", express.json({ limit: "2500mb" }), async (req, res) => {
  try {
    const { teachers = [], students = [] } = req.body;

    if (!teachers.length && !students.length) {
      return res.status(400).json({ success: false, message: "No data to import. Excel must have a Teacher or Student sheet." });
    }

    // --- Teachers ---
    const teacherMap = {};
    for (const row of teachers) {
      const email = (row["Email"] || "").trim().toLowerCase();
      const name = (row["Name"] || "").trim();
      const subjectCode = (row["Subject Code"] || "").trim().toUpperCase();

      if (!email || !subjectCode) continue;

      if (!teacherMap[email]) {
        teacherMap[email] = { name, email, subjectCodes: [] };
      }
      if (!teacherMap[email].subjectCodes.includes(subjectCode)) {
        teacherMap[email].subjectCodes.push(subjectCode);
      }
    }

    let teachersUpserted = 0;
    for (const t of Object.values(teacherMap)) {
      await Teacher.findOneAndUpdate(
        { email: t.email },
        {
          $set: { name: t.name, email: t.email },
          $addToSet: { subjectCodes: { $each: t.subjectCodes } },
        },
        { upsert: true, new: true },
      );
      teachersUpserted++;
    }

    // --- Students ---
    const studentMap = {};
    for (const row of students) {
      const email = (row["Email"] || "").trim().toLowerCase();
      const name = (row["Name "] || row["Name"] || "").trim();
      const rollNumber = (row["Roll No"] || "").trim().toUpperCase();
      const subjectCode = (row["Subject Code"] || "").trim().toUpperCase();

      if (!email || !subjectCode) continue;

      if (!studentMap[email]) {
        studentMap[email] = { name, email, rollNumber, subjectCodes: [] };
      }
      if (!studentMap[email].subjectCodes.includes(subjectCode)) {
        studentMap[email].subjectCodes.push(subjectCode);
      }
    }

    let studentsUpserted = 0;
    for (const s of Object.values(studentMap)) {
      await Student.findOneAndUpdate(
        { email: s.email },
        {
          $set: { name: s.name, email: s.email, rollNumber: s.rollNumber },
          $addToSet: { subjectCodes: { $each: s.subjectCodes } },
        },
        { upsert: true, new: true },
      );
      studentsUpserted++;
    }

    res.json({
      success: true,
      message: `Imported ${teachersUpserted} teacher(s) and ${studentsUpserted} student(s).`,
      teachersUpserted,
      studentsUpserted,
    });
  } catch (error) {
    console.error("Admin import error:", error);
    res.status(500).json({ success: false, message: "Import failed: " + error.message });
  }
});

// ─── Website URL Config ───
router.get("/config/website-url", (req, res) => {
  res.json({ success: true, url: process.env.WEBSITE_URL || "" });
});

// ─── Periods By Date (for API Key tab) ───
router.get("/periods-by-date", async (req, res) => {
  try {
    const { date, subjectCode } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: "Date is required." });
    }

    // Use attendenceStartTime range (IST day boundaries) — same approach
    // as the teacher sessions endpoint, so results match exactly.
    const { start, end } = getIstDayRange(date);
    const filter = {
      attendenceStartTime: { $gte: start, $lte: end },
    };
    if (subjectCode) filter.subjectCode = subjectCode.toUpperCase();

    const periods = await Period.find(filter)
      .sort({ attendenceStartTime: 1 })
      .select("subjectCode attendenceStartTime attendenceEndTime")
      .lean();

    res.json({
      success: true,
      periods: periods.map((p) => ({
        _id: p._id,
        subjectCode: p.subjectCode,
        startTime: p.attendenceStartTime,
        endTime: p.attendenceEndTime,
      })),
    });
  } catch (error) {
    console.error("Admin periods-by-date error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch periods." });
  }
});

// ─── Generate API Key ───
router.post("/apikeys", async (req, res) => {
  try {
    const { label } = req.body;
    if (!label || !label.trim()) {
      return res.status(400).json({ success: false, message: "Label is required." });
    }

    const key = uuidv4();
    const apiKey = await ApiKey.create({ key, label: label.trim() });

    res.json({
      success: true,
      message: "API key generated.",
      apiKey: { _id: apiKey._id, key: apiKey.key, label: apiKey.label, active: apiKey.active, createdAt: apiKey.createdAt },
    });
  } catch (error) {
    console.error("Admin generate API key error:", error);
    res.status(500).json({ success: false, message: "Failed to generate API key." });
  }
});

// ─── List API Keys ───
router.get("/apikeys", async (req, res) => {
  try {
    const apiKeys = await ApiKey.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, apiKeys });
  } catch (error) {
    console.error("Admin list API keys error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch API keys." });
  }
});

// ─── Revoke (Delete) API Key ───
router.delete("/apikeys/:id", async (req, res) => {
  try {
    const apiKey = await ApiKey.findByIdAndDelete(req.params.id);
    if (!apiKey) {
      return res.status(404).json({ success: false, message: "API key not found." });
    }
    res.json({ success: true, message: "API key revoked." });
  } catch (error) {
    console.error("Admin delete API key error:", error);
    res.status(500).json({ success: false, message: "Failed to revoke API key." });
  }
});

module.exports = router;
