const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const teacherSchema = new mongoose.Schema(
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
    subjectCodes: {
      type: [String],
      default: [],
    },
    department: {
      type: String,
      trim: true,
    },
    professorType: {
      type: String,
      enum: {
        values: ["Assistant", "Associate", "Professor"],
        message:
          "Professor type must be one of: Assistant, Associate, Professor",
      },
    },
    recoveryCodes: {
      type: [String],
      default: [],
    },
    periodsTaken: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Period",
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
teacherSchema.index({ email: 1 });
teacherSchema.index({ subjectCodes: 1 });

/**
 * Pre-save hook: hash password before storing
 */
teacherSchema.pre("save", async function (next) {
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
teacherSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Transform the JSON output: remove password field and __v
 */
teacherSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.recoveryCodes;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Teacher", teacherSchema);
