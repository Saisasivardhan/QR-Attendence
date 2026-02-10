/**
 * Authentication Middleware
 * Verifies JWT tokens from the Authorization header.
 * Attaches decoded user data to req.user for downstream handlers.
 * Also provides role-based access control middleware.
 */

const jwt = require("jsonwebtoken");

/**
 * Verify JWT token from Authorization: Bearer <token> header
 * Rejects requests without valid tokens.
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token format.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, email/rollNumber }
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
}

/**
 * Role-based access control middleware factory
 * @param  {...string} roles - Allowed roles (e.g., 'student', 'teacher')
 * @returns {Function} Express middleware
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
