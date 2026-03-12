/**
 * ScanMark - Main Server
 *
 * Express.js server with:
 * - MongoDB connection via Mongoose
 * - Security middleware (Helmet, CORS, Rate Limiting)
 * - JWT authentication
 * - Static file serving for the frontend
 * - API routes for auth, profiles, and attendance
 */

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy in front of Express (e.g., Cloudflare tunnel)
// This is required for express-rate-limit to get the correct user IP
app.set("trust proxy", 1);

// ─── Security Middleware ───

// Helmet: Sets various HTTP security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      },
    },
  }),
);

// CORS: Allow same-origin requests
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Rate Limiting: Prevent brute force and DDoS
const generalLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 5000,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 500,
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
});

const scanLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 4000,
  message: {
    success: false,
    message: "Too many scan requests, please try again later.",
  },
});

app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);
app.use("/api/attendance/scan", scanLimiter);

// ─── Body Parsing ───
// Skip the global 10kb limit for the bulk-import route (has its own limit)
app.use((req, res, next) => {
  if (req.path === "/api/admin/import") return next();
  express.json({ limit: "10kb" })(req, res, next);
});
app.use(express.urlencoded({ extended: false }));

// ─── Static Files ───
// Serve frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ─── API Routes ───
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const attendanceRoutes = require("./routes/attendance");
const adminRoutes = require("./routes/admin");

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);

// ─── API Key Authenticated Attendance API ───
const Period = require("./models/Period");
const Student = require("./models/Student");
const ApiKey = require("./models/ApiKey");
const { getIstDayRange } = require("./utils/date");

function toIstString(date) {
  if (!date) return null;
  return new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

app.get("/api/attendance/:subjectCode/:date/:periodNumber", async (req, res) => {
  try {
    // ─── API Key Validation ───
    const apikey = req.query.apikey;
    if (!apikey) {
      return res.status(403).json({ success: false, message: "Access Forbidden. API key is required." });
    }

    const validKey = await ApiKey.findOne({ key: apikey, active: true });
    if (!validKey) {
      return res.status(403).json({ success: false, message: "Access Forbidden. Invalid or revoked API key." });
    }

    const subjectCode = req.params.subjectCode.toUpperCase();
    const dateParam = req.params.date; // DD-MM-YYYY
    const periodNumber = parseInt(req.params.periodNumber, 10);

    if (!subjectCode || !dateParam || isNaN(periodNumber) || periodNumber < 1) {
      return res.status(400).json({ success: false, message: "Invalid parameters. Expected /:subjectCode/:date(DD-MM-YYYY)/:periodNumber?apikey=YOUR_KEY" });
    }

    // Convert DD-MM-YYYY to YYYY-MM-DD for IST day range query
    const dateParts = dateParam.split("-");
    if (dateParts.length !== 3) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use DD-MM-YYYY." });
    }
    const isoDate = dateParts[2] + "-" + dateParts[1] + "-" + dateParts[0];

    // Use attendenceStartTime range (IST day boundaries) to find periods
    const { start, end } = getIstDayRange(isoDate);
    const periods = await Period.find({
      subjectCode,
      attendenceStartTime: { $gte: start, $lte: end },
    })
      .sort({ attendenceStartTime: 1 })
      .populate("studentsPresent", "name rollNumber email")
      .lean();

    if (!periods.length) {
      return res.status(404).json({ success: false, message: "No periods found for " + subjectCode + " on " + dateParam });
    }

    if (periodNumber > periods.length) {
      return res.status(404).json({ success: false, message: "Period " + periodNumber + " not found. Only " + periods.length + " period(s) exist on " + dateParam });
    }

    const period = periods[periodNumber - 1];

    // Get all enrolled students for this subject
    const enrolledStudents = await Student.find({ subjectCodes: subjectCode })
      .select("name rollNumber email")
      .sort({ rollNumber: 1 })
      .lean();

    const presentIds = new Set(period.studentsPresent.map((s) => s._id.toString()));

    const students = enrolledStudents.map((s) => ({
      name: s.name,
      rollNumber: s.rollNumber,
      email: s.email,
      present: presentIds.has(s._id.toString()),
    }));

    res.json({
      success: true,
      subjectCode,
      date: dateParam,
      periodNumber,
      startTime: toIstString(period.attendenceStartTime),
      endTime: toIstString(period.attendenceEndTime),
      totalEnrolled: enrolledStudents.length,
      totalPresent: period.studentsPresent.length,
      totalAbsent: enrolledStudents.length - period.studentsPresent.length,
      students,
    });
  } catch (error) {
    console.error("Attendance API error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch attendance data." });
  }
});

// ─── Health Check ───
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ScanMark is running.",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ───
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    res
      .status(404)
      .json({ success: false, message: "API endpoint not found." });
  } else {
    res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "An internal server error occurred.",
  });
});

// ─── MongoDB Connection & Server Start ───
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/qr_attendance")
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

module.exports = app;
