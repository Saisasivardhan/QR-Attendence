/**
 * Secure QR Code Generator & Validator
 *
 * This is the CRITICAL security module that handles:
 * 1. Generating cryptographically signed, compressed, short-lived QR payloads
 * 2. Validating scanned QR payloads with full security checks
 *
 * Security features:
 * - HMAC-SHA256 signing using server secret
 * - zlib compression of payload
 * - Random nonce for replay prevention
 * - Strict timestamp validation (2-3 second window)
 * - Base64 encoding for QR-safe transport
 */

const crypto = require("crypto");
const zlib = require("zlib");
const QRCode = require("qrcode");

const QR_SECRET = process.env.QR_SECRET || "default_qr_secret_change_me";
const QR_TOKEN_VALIDITY = parseInt(process.env.QR_TOKEN_VALIDITY) || 3; // seconds

/**
 * Generate a cryptographically signed QR payload
 *
 * Flow:
 * 1. Create payload with session info + random nonce + timestamp
 * 2. Sign payload using HMAC-SHA256
 * 3. Combine payload + signature
 * 4. Compress using zlib
 * 5. Encode as Base64
 *
 * @param {string} sessionId - Active attendance session ID
 * @param {string} teacherId - Teacher's user ID
 * @param {string} subjectCode - Subject code for the session
 * @returns {object} { qrData, nonce } - Base64 encoded QR data and the nonce used
 */
function generateQRPayload(sessionId, teacherId, subjectCode) {
  // Generate a random nonce (16 bytes = 32 hex chars) for replay prevention
  const nonce = crypto.randomBytes(16).toString("hex");

  // Build the payload object
  const payload = {
    v: 1, // version
    sid: sessionId, // session_id
    tid: teacherId, // teacher_id
    sub: subjectCode, // subject_code
    ts: Math.floor(Date.now() / 1000), // Unix timestamp (seconds)
    n: nonce, // random nonce
  };

  // Convert payload to JSON string
  const payloadStr = JSON.stringify(payload);

  // Sign the payload using HMAC-SHA256 with server secret
  const signature = crypto
    .createHmac("sha256", QR_SECRET)
    .update(payloadStr)
    .digest("hex");

  // Combine payload and signature
  const signedData = JSON.stringify({
    p: payloadStr,
    s: signature,
  });

  // Compress using zlib (deflate)
  const compressed = zlib.deflateSync(Buffer.from(signedData));

  // Encode as Base64 for QR-safe transport
  const qrData = compressed.toString("base64");

  return { qrData, nonce };
}

/**
 * Generate a QR code image as a data URL from the signed payload
 * Uses high error-correction level (H) for maximum reliability
 *
 * @param {string} qrData - Base64 encoded signed payload
 * @returns {Promise<string>} Data URL of the QR image (PNG format)
 */
async function generateQRImage(qrData) {
  const options = {
    errorCorrectionLevel: "H", // Highest error correction
    type: "image/png",
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  };

  return QRCode.toDataURL(qrData, options);
}

/**
 * Validate a scanned QR payload with full security checks
 *
 * Validation steps:
 * 1. Base64 decode
 * 2. Decompress (zlib inflate)
 * 3. Parse signed data structure
 * 4. Verify HMAC-SHA256 signature (tamper detection)
 * 5. Parse inner payload
 * 6. Validate timestamp freshness (within QR_TOKEN_VALIDITY seconds)
 * 7. Return validated payload for further checks (session active, nonce reuse, etc.)
 *
 * @param {string} qrData - The scanned QR code data (Base64 string)
 * @returns {object} { valid, payload, error }
 */
function validateQRPayload(qrData) {
  try {
    // Step 1: Base64 decode
    const compressed = Buffer.from(qrData, "base64");

    // Step 2: Decompress (zlib inflate)
    let decompressed;
    try {
      decompressed = zlib.inflateSync(compressed).toString();
    } catch (e) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: decompression failed",
      };
    }

    // Step 3: Parse signed data structure { p: payloadStr, s: signature }
    let signedData;
    try {
      signedData = JSON.parse(decompressed);
    } catch (e) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: malformed structure",
      };
    }

    if (!signedData.p || !signedData.s) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: missing fields",
      };
    }

    // Step 4: Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac("sha256", QR_SECRET)
      .update(signedData.p)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signedData.s, "hex"),
        Buffer.from(expectedSignature, "hex"),
      )
    ) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: signature mismatch (tampered)",
      };
    }

    // Step 5: Parse inner payload
    let payload;
    try {
      payload = JSON.parse(signedData.p);
    } catch (e) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: malformed payload",
      };
    }

    // Step 6: Validate required fields
    if (
      !payload.v ||
      !payload.sid ||
      !payload.tid ||
      !payload.sub ||
      !payload.ts ||
      !payload.n
    ) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: incomplete payload",
      };
    }

    // Step 7: Validate timestamp freshness
    const now = Math.floor(Date.now() / 1000);
    const age = now - payload.ts;

    if (age < 0) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: future timestamp",
      };
    }

    if (age > QR_TOKEN_VALIDITY) {
      return { valid: false, payload: null, error: "QR code has expired" };
    }

    // All checks passed
    return {
      valid: true,
      payload: {
        version: payload.v,
        sessionId: payload.sid,
        teacherId: payload.tid,
        subjectCode: payload.sub,
        timestamp: payload.ts,
        nonce: payload.n,
      },
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      payload: null,
      error: "QR validation failed: " + error.message,
    };
  }
}

module.exports = {
  generateQRPayload,
  generateQRImage,
  validateQRPayload,
};
