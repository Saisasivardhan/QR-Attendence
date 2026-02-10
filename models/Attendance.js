/**
 * Attendance Model
 * Records individual student attendance entries.
 * Linked to a specific session, subject, and student.
 * Compound unique index on (studentId, subjectCode, date) prevents
 * duplicate attendance per subject per day.
 */

const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendanceSession",
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// CRITICAL: Compound unique index to prevent duplicate attendance per student per subject per day
attendanceSchema.index(
  { studentId: 1, subjectCode: 1, date: 1 },
  { unique: true },
);

// Additional indexes for queries
attendanceSchema.index({ subjectCode: 1 });
attendanceSchema.index({ sessionId: 1 });
attendanceSchema.index({ studentId: 1, subjectCode: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
