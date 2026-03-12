const mongoose = require("mongoose");

const periodSchema = new mongoose.Schema(
  {
    teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    subjectCode: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
      uppercase: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
    },
    attendenceStartTime: {
      type: Date,
      default: Date.now,
    },
    attendenceEndTime: {
      type: Date,
      default: null,
    },
    studentsPresent: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
periodSchema.index({ teacher_id: 1 });
periodSchema.index({ subjectCode: 1, date: 1 });
periodSchema.index({ teacher_id: 1, attendenceEndTime: 1 });

module.exports = mongoose.model("Period", periodSchema);
