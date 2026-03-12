/**
 * ApiKey Model
 * Stores API keys for external access to attendance data.
 */

const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ApiKey", apiKeySchema);
