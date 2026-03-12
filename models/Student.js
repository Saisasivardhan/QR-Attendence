const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const studentSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
    },
    rollNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    gradProgram: {
      type: String,
      enum: {
        values: ["BTech", "MTech", "PhD"],
        message: "Grad program must be one of: BTech, MTech, PhD",
      },
    },
    department: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      min: [1, "Year must be at least 1"],
      max: [6, "Year cannot exceed 6"],
    },
    subjectCodes: {
      type: [String],
      default: [],
    },
    recoveryCodes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
studentSchema.index({ email: 1 });
studentSchema.index({ subjectCodes: 1 });

/**
 * Pre-save hook: hash password before storing
 */
studentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method: compare a candidate password against the stored hash
 */
studentSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Transform the JSON output: remove password field and __v
 */
studentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.recoveryCodes;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Student", studentSchema);
