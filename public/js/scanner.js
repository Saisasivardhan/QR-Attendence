/**
 * QR Scanner Module
 * Handles browser camera access using getUserMedia API.
 * Reads QR codes from the camera feed using a lightweight canvas-based decoder.
 *
 * Note: We use a simple interval-based scanning approach that reads frames
 * from the video feed and attempts to decode QR codes.
 */

class QRScanner {
  constructor(videoElement, canvasElement, onScan) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d", { willReadFrequently: true });
    this.onScan = onScan;
    this.scanning = false;
    this.stream = null;
    this.animationFrame = null;
  }

  /**
   * Start the camera and begin scanning for QR codes
   */
  async start() {
    try {
      // Request camera access (prefer back camera on mobile)
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      this.video.srcObject = this.stream;
      this.video.setAttribute("playsinline", true);
      await this.video.play();

      this.scanning = true;
      this.scan();

      return true;
    } catch (error) {
      console.error("Camera access error:", error);
      if (error.name === "NotAllowedError") {
        throw new Error(
          "Camera access was denied. Please allow camera permissions and try again.",
        );
      } else if (error.name === "NotFoundError") {
        throw new Error(
          "No camera found. Please connect a camera and try again.",
        );
      }
      throw new Error("Failed to access camera: " + error.message);
    }
  }

  /**
   * Continuous scanning loop - reads frames and attempts QR decode
   */
  scan() {
    if (!this.scanning) return;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      // Set canvas dimensions to match video
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      // Draw current frame to canvas
      this.ctx.drawImage(
        this.video,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );

      // Get image data for QR detection
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );

      // Attempt to decode QR code using jsQR library
      if (typeof jsQR !== "undefined") {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          // Draw detection overlay
          this.drawDetection(code.location);

          // Callback with decoded data
          this.onScan(code.data);

          // Pause briefly after successful scan
          this.scanning = false;
          setTimeout(() => {
            this.scanning = true;
            this.scan();
          }, 3000);
          return;
        }
      }
    }

    this.animationFrame = requestAnimationFrame(() => this.scan());
  }

  /**
   * Draw QR code detection overlay on canvas
   */
  drawDetection(location) {
    this.ctx.beginPath();
    this.ctx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
    this.ctx.lineTo(location.topRightCorner.x, location.topRightCorner.y);
    this.ctx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
    this.ctx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
    this.ctx.closePath();
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = "#00ff88";
    this.ctx.stroke();
  }

  /**
   * Stop the camera and scanning
   */
  stop() {
    this.scanning = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }
}
