/**
 * QR Attendance System - Main Server
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

// ─── Security Middleware ───

// Helmet: Sets various HTTP security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
});

app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);

// ─── Body Parsing ───
app.use(express.json({ limit: "10kb" })); // Limit body size for security
app.use(express.urlencoded({ extended: false }));

// ─── Static Files ───
// Serve frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// ─── API Routes ───
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const attendanceRoutes = require("./routes/attendance");

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/attendance", attendanceRoutes);

// ─── Health Check ───
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "QR Attendance System is running.",
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
