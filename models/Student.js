/**
 * Student Model
 * Extends the User model with student-specific fields:
 * graduation type, year of study.
 * References the User model via user_id.
 */

const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    graduation: {
      type: String,
      enum: {
        values: ["BTech", "MTech", "PhD"],
        message: "Graduation must be one of: BTech, MTech, PhD",
      },
      required: [true, "Graduation type is required"],
    },
    year: {
      type: Number,
      required: [true, "Year of studying is required"],
      min: [1, "Year must be at least 1"],
      max: [6, "Year cannot exceed 6"],
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast user lookup
studentSchema.index({ userId: 1 });

module.exports = mongoose.model("Student", studentSchema);
