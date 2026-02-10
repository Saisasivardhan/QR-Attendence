/**
 * AttendanceSession Model
 * Represents an active attendance-taking session initiated by a teacher.
 * Contains session metadata and active status.
 * Used to validate QR codes belong to an ongoing session.
 */

const mongoose = require("mongoose");

const attendanceSessionSchema = new mongoose.Schema(
  {
    subjectCode: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
      uppercase: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD format for easy day-level dedup
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    // Track used nonces to prevent replay attacks
    usedNonces: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
attendanceSessionSchema.index({ subjectCode: 1, date: 1 });
attendanceSessionSchema.index({ teacherId: 1, active: 1 });
attendanceSessionSchema.index({ active: 1 });

module.exports = mongoose.model("AttendanceSession", attendanceSessionSchema);
