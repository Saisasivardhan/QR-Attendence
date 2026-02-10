/**
 * Subject Model
 * Stores subject information including code, name, department, and teaching assignments.
 * Used to validate department-matching during attendance scanning.
 */

const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    subjectCode: {
      type: String,
      required: [true, "Subject code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast lookups
subjectSchema.index({ subjectCode: 1 });
subjectSchema.index({ teacherId: 1 });
subjectSchema.index({ department: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
