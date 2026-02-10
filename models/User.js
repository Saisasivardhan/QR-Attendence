/**
 * User Model
 * Base user schema shared by both Students and Teachers.
 * Stores core identity fields: name, email/rollno, role, department, and hashed password.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    rollNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    role: {
      type: String,
      enum: ["student", "teacher"],
      required: [true, "Role is required"],
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast lookups
userSchema.index({ role: 1 });
userSchema.index({ email: 1, role: 1 });
userSchema.index({ rollNumber: 1 });

/**
 * Pre-save hook: hash password before storing
 * Only hashes if the password field has been modified
 */
userSchema.pre("save", async function (next) {
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
 * @param {string} candidatePassword - The plaintext password to verify
 * @returns {boolean} - True if passwords match
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Transform the JSON output: remove password field and __v
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
