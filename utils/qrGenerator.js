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
  // Generate a compact nonce (6 bytes = 8 base64 chars) for replay prevention
  const nonceBytes = crypto.randomBytes(6);
  const nonce = nonceBytes.toString("base64url");

  // Build a compact payload string: fields joined by pipe
  // Format: v|sid|tid|sub|ts|nonce
  const ts = Math.floor(Date.now() / 1000);
  const payloadStr = [1, sessionId, teacherId, subjectCode, ts, nonce].join(
    "|",
  );

  // Sign and truncate to 10 bytes (80 bits — sufficient for a 2-3s lived token)
  const sigBuf = crypto
    .createHmac("sha256", QR_SECRET)
    .update(payloadStr)
    .digest();
  const signature = sigBuf.subarray(0, 10).toString("base64url");

  // Combine payload + signature with a dot separator (compact, no JSON overhead)
  const signedData = payloadStr + "." + signature;

  // Compress using zlib (deflate)
  const compressed = zlib.deflateSync(Buffer.from(signedData));

  // Encode as Base64 for QR-safe transport
  const qrData = compressed.toString("base64");

  return { qrData, nonce };
}

/**
 * Generate a QR code image as a data URL from the signed payload
 * Uses low error-correction level (L) for minimal density — ideal for screen-to-camera scanning
 *
 * @param {string} qrData - Base64 encoded signed payload
 * @returns {Promise<string>} Data URL of the QR image (PNG format)
 */
async function generateQRImage(qrData) {
  const options = {
    errorCorrectionLevel: "M", // Low error correction (least dense QR, fine for screen-to-camera)
    type: "image/png",
    width: 600,
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

    // Step 3: Split into payload and signature at the last dot
    const lastDot = decompressed.lastIndexOf(".");
    if (lastDot === -1) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: malformed structure",
      };
    }

    const payloadStr = decompressed.substring(0, lastDot);
    const receivedSig = decompressed.substring(lastDot + 1);

    if (!payloadStr || !receivedSig) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: missing fields",
      };
    }

    // Step 4: Verify truncated HMAC signature
    const expectedSigBuf = crypto
      .createHmac("sha256", QR_SECRET)
      .update(payloadStr)
      .digest();
    const expectedSig = expectedSigBuf.subarray(0, 10).toString("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(receivedSig),
        Buffer.from(expectedSig),
      )
    ) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: signature mismatch (tampered)",
      };
    }

    // Step 5: Parse pipe-separated payload: v|sid|tid|sub|ts|nonce
    const parts = payloadStr.split("|");
    if (parts.length !== 6) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: incomplete payload",
      };
    }

    const [v, sid, tid, sub, ts, n] = parts;

    if (!v || !sid || !tid || !sub || !ts || !n) {
      return {
        valid: false,
        payload: null,
        error: "Invalid QR data: incomplete payload",
      };
    }

    // Step 6: Validate timestamp freshness
    const now = Math.floor(Date.now() / 1000);
    const age = now - parseInt(ts, 10);

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
        version: parseInt(v, 10),
        sessionId: sid,
        teacherId: tid,
        subjectCode: sub,
        timestamp: parseInt(ts, 10),
        nonce: n,
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
