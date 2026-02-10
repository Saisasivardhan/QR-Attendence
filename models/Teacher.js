/**
 * Teacher Model
 * Extends the User model with teacher-specific fields:
 * professor type, subject codes taught.
 * References the User model via user_id.
 */

const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    professorType: {
      type: String,
      enum: {
        values: ["Assistant", "Associate", "Professor"],
        message:
          "Professor type must be one of: Assistant, Associate, Professor",
      },
      required: [true, "Professor type is required"],
    },
    subjectCodes: {
      type: [String],
      required: [true, "At least one subject code is required"],
      validate: {
        validator: function (arr) {
          return arr.length > 0;
        },
        message: "At least one subject code must be provided",
      },
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast lookups
teacherSchema.index({ userId: 1 });
teacherSchema.index({ subjectCodes: 1 });

module.exports = mongoose.model("Teacher", teacherSchema);
