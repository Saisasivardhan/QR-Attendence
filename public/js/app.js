/**
 * Main Application Controller
 * Handles SPA routing, page rendering, and all user interactions.
 * Uses hash-based routing for navigation without page reloads.
 */

// ─── Router ───
class Router {
  constructor() {
    this.routes = {};
    this.currentScanner = null;
    this.qrInterval = null;

    window.addEventListener("hashchange", () => this.route());
  }

  /**
   * Register a route handler
   */
  on(path, handler) {
    this.routes[path] = handler;
  }

  /**
   * Navigate to a route
   */
  navigate(path) {
    window.location.hash = path;
  }

  /**
   * Handle route changes
   */
  route() {
    // Cleanup previous page resources
    this.cleanup();

    const hash = window.location.hash.slice(1) || "/";
    const handler = this.routes[hash];

    if (handler) {
      handler();
    } else {
      this.routes["/"] ? this.routes["/"]() : null;
    }
  }

  /**
   * Cleanup resources when navigating away
   */
  cleanup() {
    if (this.currentScanner) {
      this.currentScanner.stop();
      this.currentScanner = null;
    }
    if (this.qrInterval) {
      clearInterval(this.qrInterval);
      this.qrInterval = null;
    }
  }
}

// ─── Initialize App ───
const router = new Router();
const app = document.getElementById("app");

// ─── Helper Functions ───

function showToast(message, type = "info") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
      <span class="toast-message">${message}</span>
    </div>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || "Submit";
    btn.disabled = false;
  }
}

function initPasswordToggles(root = document) {
  root.querySelectorAll(".password-toggle").forEach((toggle) => {
    if (toggle.dataset.bound === "true") return;

    toggle.dataset.bound = "true";
    toggle.addEventListener("click", () => {
      const input = root.getElementById
        ? root.getElementById(toggle.dataset.target)
        : document.getElementById(toggle.dataset.target);
      const icon = toggle.querySelector("i");
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(isHidden));
      toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      icon.className = isHidden ? "bx bx-show" : "bx bx-hide";
    });
  });
}

function requireAuth(role) {
  if (!ApiService.isAuthenticated()) {
    router.navigate("/");
    return false;
  }
  const user = ApiService.getUser();
  if (role && user?.role !== role) {
    router.navigate("/");
    return false;
  }
  return true;
}

function renderNav(role) {
  const user = ApiService.getUser();
  const currentHash = window.location.hash.slice(1) || "/";

  if (role === "student") {
    return `
      <nav class="nav-bar">
        <div class="nav-brand" onclick="router.navigate('/student')">
          <span class="nav-logo">⛶</span> ScanMark
        </div>
        <div class="nav-links">
          <a class="nav-link ${currentHash === "/student" ? "active" : ""}" onclick="router.navigate('/student')">
            <span class="nav-icon">🏠</span> Home
          </a>
          <a class="nav-link ${currentHash === "/student/scan" ? "active" : ""}" onclick="router.navigate('/student/scan')">
            <span class="nav-icon">📷</span> Scan
          </a>
          <a class="nav-link ${currentHash === "/student/attendance" ? "active" : ""}" onclick="router.navigate('/student/attendance')">
            <span class="nav-icon">📊</span> Attendance
          </a>
          <a class="nav-link ${currentHash === "/student/profile" ? "active" : ""}" onclick="router.navigate('/student/profile')">
            <span class="nav-icon">👤</span> Profile
          </a>
          <a class="nav-link nav-logout" onclick="logout()">
            <span class="nav-icon">⏻</span> Logout
          </a>
        </div>
        <button class="nav-hamburger" onclick="toggleMobileNav()" aria-label="Toggle menu">☰</button>
      </nav>`;
  } else {
    return `
      <nav class="nav-bar">
        <div class="nav-brand" onclick="router.navigate('/teacher')">
          <span class="nav-logo">⛶</span> ScanMark
        </div>
        <div class="nav-links">
          <a class="nav-link ${currentHash === "/teacher" ? "active" : ""}" onclick="router.navigate('/teacher')">
            <span class="nav-icon">🏠</span> Home
          </a>
          <a class="nav-link ${currentHash === "/teacher/session" ? "active" : ""}" onclick="router.navigate('/teacher/session')">
            <span class="nav-icon">📡</span> Session
          </a>
          <a class="nav-link ${currentHash === "/teacher/analytics" ? "active" : ""}" onclick="router.navigate('/teacher/analytics')">
            <span class="nav-icon">📊</span> Analytics
          </a>
          <a class="nav-link ${currentHash === "/teacher/profile" ? "active" : ""}" onclick="router.navigate('/teacher/profile')">
            <span class="nav-icon">👤</span> Profile
          </a>
          <a class="nav-link nav-logout" onclick="logout()">
            <span class="nav-icon">⏻</span> Logout
          </a>
        </div>
        <button class="nav-hamburger" onclick="toggleMobileNav()" aria-label="Toggle menu">☰</button>
      </nav>`;
  }
}

function toggleMobileNav() {
  const links = document.querySelector(".nav-links");
  if (links) links.classList.toggle("nav-open");
}

function logout() {
  router.cleanup();
  ApiService.clearAuth();
  router.navigate("/");
  showToast("Logged out successfully.", "success");
}

// ─── Page: Landing ───
router.on("/", () => {
  app.innerHTML = `
    <div class="landing-page">
      <div class="landing-bg">
        <div class="bg-orb bg-orb-1"></div>
        <div class="bg-orb bg-orb-2"></div>
        <div class="bg-orb bg-orb-3"></div>
      </div>
      <div class="landing-content">
        <div class="landing-hero">
          <div class="hero-badge">Secure & Fast</div>
          <h1 class="hero-title">ScanMark<br><span class="gradient-text">System</span></h1>
          <p class="hero-subtitle">Effortless attendance tracking with cryptographically secure, real-time QR codes. Built for modern classrooms.</p>
        </div>
        <div class="landing-cards">
          <div class="role-card" onclick="router.navigate('/login-student')">
            <div class="role-card-glow"></div>
            <div class="role-icon">🎓</div>
            <h2>Student</h2>
            <p>Scan QR codes to mark attendance, view your records, and manage your profile.</p>
            <button class="btn btn-primary btn-block">Student Login</button>
            <a class="role-register" onclick="event.stopPropagation(); router.navigate('/register-student')">Don't have an account? <strong>Register</strong></a>
          </div>
          <div class="role-card" onclick="router.navigate('/login-teacher')">
            <div class="role-card-glow"></div>
            <div class="role-icon">👨‍🏫</div>
            <h2>Teacher</h2>
            <p>Generate secure QR sessions, track attendance, and view detailed analytics.</p>
            <button class="btn btn-accent btn-block">Teacher Login</button>
            <a class="role-register" onclick="event.stopPropagation(); router.navigate('/register-teacher')">Don't have an account? <strong>Register</strong></a>
          </div>
        </div>
      </div>
    </div>`;
});

// ─── Page: Student Registration ───
router.on("/register-student", () => {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-container">
        <button class="back-btn" onclick="router.navigate('/')">← Back</button>
        <div class="auth-header">
          <div class="auth-icon">🎓</div>
          <h1>Student Registration</h1>
          <p>Create your account to start marking attendance</p>
        </div>
        <form id="studentRegisterForm" class="auth-form">
          <div class="form-group">
            <label for="reg-email">Email Address</label>
            <input type="email" id="reg-email" placeholder="john@university.edu" required>
            <div id="lookupStatus" class="form-hint" style="margin-top:4px;"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="reg-name">Full Name</label>
              <input type="text" id="reg-name" placeholder="John Doe" required>
            </div>
            <div class="form-group">
              <label for="reg-roll">Roll Number</label>
              <input type="text" id="reg-roll" placeholder="CH21B001" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="reg-gradProgram">Graduation Program</label>
              <select id="reg-gradProgram" required>
                <option value="">Select</option>
                <option value="BTech">BTech</option>
                <option value="MTech">MTech</option>
                <option value="PhD">PhD</option>
              </select>
            </div>
            <div class="form-group">
              <label for="reg-year">Year</label>
              <input type="number" id="reg-year" min="1" max="6" placeholder="1" required>
            </div>
          </div>
          <div class="form-group">
            <label for="reg-dept">Department</label>
            <input type="text" id="reg-dept" placeholder="Chemical Engineering" required>
          </div>
          <div class="form-group">
            <label for="reg-subjects">Subject Codes <span class="form-hint">(comma separated)</span></label>
            <input type="text" id="reg-subjects" placeholder="CS1204, CS303" required>
          </div>
          <div class="form-group">
            <label for="reg-password">Password</label>
            <div class="password-input">
              <input type="password" id="reg-password" placeholder="Min 6 characters" minlength="6" required>
              <button type="button" class="password-toggle" data-target="reg-password" aria-label="Show password" aria-pressed="false">
                <i class='bx bx-hide'></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" id="regStudentBtn">Create Account</button>
        </form>
        <p class="auth-switch">Already have an account? <a onclick="router.navigate('/login-student')">Login here</a></p>
      </div>
    </div>`;

  initPasswordToggles();

  // Email auto-fill on blur
  document.getElementById("reg-email").addEventListener("blur", async (e) => {
    const email = e.target.value.trim();
    const status = document.getElementById("lookupStatus");
    if (!email || !email.includes("@")) return;

    status.textContent = "Looking up...";
    status.style.color = "#aaa";

    try {
      const result = await ApiService.lookupEmail(email);
      if (result.found && result.data.isPreSeeded) {
        const d = result.data;
        const nameEl = document.getElementById("reg-name");
        const rollEl = document.getElementById("reg-roll");
        const subjectsEl = document.getElementById("reg-subjects");

        if (d.name) { nameEl.value = d.name; nameEl.readOnly = true; nameEl.style.opacity = "0.7"; }
        if (d.rollNumber) { rollEl.value = d.rollNumber; rollEl.readOnly = true; rollEl.style.opacity = "0.7"; }
        if (d.subjectCodes && d.subjectCodes.length > 0) {
          subjectsEl.value = d.subjectCodes.join(", ");
          subjectsEl.readOnly = true;
          subjectsEl.style.opacity = "0.7";
        }

        status.textContent = "✔ Account found! Fields auto-filled. Just set your password and remaining details.";
        status.style.color = "#00e676";
      } else if (result.found && !result.data.isPreSeeded) {
        status.textContent = "✖ This email is already registered. Try logging in.";
        status.style.color = "#ff5252";
      } else {
        status.textContent = "New account — fill in all fields.";
        status.style.color = "#aaa";
      }
    } catch (err) {
      status.textContent = "";
    }
  });

  document
    .getElementById("studentRegisterForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("regStudentBtn");
      setLoading(btn, true);

      try {
        const subjectsRaw = document.getElementById("reg-subjects").value;
        const subjectCodes = subjectsRaw
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s);

        const data = {
          name: document.getElementById("reg-name").value.trim(),
          rollNumber: document.getElementById("reg-roll").value.trim(),
          email: document.getElementById("reg-email").value.trim(),
          gradProgram: document.getElementById("reg-gradProgram").value,
          year: parseInt(document.getElementById("reg-year").value),
          department: document.getElementById("reg-dept").value.trim(),
          subjectCodes,
          password: document.getElementById("reg-password").value,
        };

        const result = await ApiService.registerStudent(data);
        showToast("Registration successful! Please log in.", "success");
        router.navigate("/login-student");
      } catch (error) {
        showToast(error.message, "error");
        setLoading(btn, false);
      }
    });
});

// ─── Page: Student Login ───
router.on("/login-student", () => {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-container auth-container-sm">
        <button class="back-btn" onclick="router.navigate('/')">← Back</button>
        <div class="auth-header">
          <div class="auth-icon">🎓</div>
          <h1>Student Login</h1>
          <p>Sign in with your email address</p>
        </div>
        <form id="studentLoginForm" class="auth-form">
          <div class="form-group">
            <label for="login-email">Email Address</label>
            <input type="email" id="login-email" placeholder="john@university.edu" required>
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <div class="password-input">
              <input type="password" id="login-password" placeholder="Enter password" required>
              <button type="button" class="password-toggle" data-target="login-password" aria-label="Show password" aria-pressed="false">
                <i class='bx bx-hide'></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" id="loginStudentBtn">Sign In</button>
        </form>
        <p class="auth-switch">Don't have an account? <a onclick="router.navigate('/register-student')">Register here</a></p>
      </div>
    </div>`;

  initPasswordToggles();

  document
    .getElementById("studentLoginForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("loginStudentBtn");
      setLoading(btn, true);

      try {
        const data = {
          email: document.getElementById("login-email").value.trim(),
          password: document.getElementById("login-password").value,
        };

        const result = await ApiService.loginStudent(data);
        ApiService.setAuth(result.token, result.user);
        showToast("Welcome back!", "success");
        router.navigate("/student");
      } catch (error) {
        showToast(error.message, "error");
        setLoading(btn, false);
      }
    });
});

// ─── Page: Teacher Registration ───
router.on("/register-teacher", () => {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-container">
        <button class="back-btn" onclick="router.navigate('/')">← Back</button>
        <div class="auth-header">
          <div class="auth-icon">👨‍🏫</div>
          <h1>Teacher Registration</h1>
          <p>Create your instructor account</p>
        </div>
        <form id="teacherRegisterForm" class="auth-form">
          <div class="form-group">
            <label for="treg-email">Institute Email</label>
            <input type="email" id="treg-email" placeholder="jane@university.edu" required>
            <div id="tregLookupStatus" class="form-hint" style="margin-top:4px;"></div>
          </div>
          <div class="form-group">
            <label for="treg-name">Full Name</label>
            <input type="text" id="treg-name" placeholder="Dr. Jane Smith" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="treg-type">Professor Type</label>
              <select id="treg-type" required>
                <option value="">Select</option>
                <option value="Assistant">Assistant Professor</option>
                <option value="Associate">Associate Professor</option>
                <option value="Professor">Professor</option>
              </select>
            </div>
            <div class="form-group">
              <label for="treg-dept">Department</label>
              <input type="text" id="treg-dept" placeholder="Chemical Engineering" required>
            </div>
          </div>
          <div class="form-group">
            <label for="treg-subjects">Subject Codes <span class="form-hint">(comma separated)</span></label>
            <input type="text" id="treg-subjects" placeholder="CH401, CH402, CH501" required>
          </div>
          <div class="form-group">
            <label for="treg-password">Password</label>
            <div class="password-input">
              <input type="password" id="treg-password" placeholder="Min 6 characters" minlength="6" required>
              <button type="button" class="password-toggle" data-target="treg-password" aria-label="Show password" aria-pressed="false">
                <i class='bx bx-hide'></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-accent btn-block btn-lg" id="regTeacherBtn">Create Account</button>
        </form>
        <p class="auth-switch">Already have an account? <a onclick="router.navigate('/login-teacher')">Login here</a></p>
      </div>
    </div>`;

  initPasswordToggles();

  // Email auto-fill on blur
  document.getElementById("treg-email").addEventListener("blur", async (e) => {
    const email = e.target.value.trim();
    const status = document.getElementById("tregLookupStatus");
    if (!email || !email.includes("@")) return;

    status.textContent = "Looking up...";
    status.style.color = "#aaa";

    try {
      const result = await ApiService.lookupEmail(email);
      if (result.found && result.data.isPreSeeded) {
        const d = result.data;
        const nameEl = document.getElementById("treg-name");
        const subjectsEl = document.getElementById("treg-subjects");

        if (d.name) { nameEl.value = d.name; nameEl.readOnly = true; nameEl.style.opacity = "0.7"; }
        if (d.subjectCodes && d.subjectCodes.length > 0) {
          subjectsEl.value = d.subjectCodes.join(", ");
          subjectsEl.readOnly = true;
          subjectsEl.style.opacity = "0.7";
        }

        status.textContent = "✔ Account found! Fields auto-filled. Set your password and remaining details.";
        status.style.color = "#00e676";
      } else if (result.found && !result.data.isPreSeeded) {
        status.textContent = "✖ This email is already registered. Try logging in.";
        status.style.color = "#ff5252";
      } else {
        status.textContent = "New account — fill in all fields.";
        status.style.color = "#aaa";
      }
    } catch (err) {
      status.textContent = "";
    }
  });

  document
    .getElementById("teacherRegisterForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("regTeacherBtn");
      setLoading(btn, true);

      try {
        const subjectsRaw = document.getElementById("treg-subjects").value;
        const subjectCodes = subjectsRaw
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s);

        if (subjectCodes.length === 0) {
          throw new Error("Please enter at least one subject code.");
        }

        const data = {
          name: document.getElementById("treg-name").value.trim(),
          email: document.getElementById("treg-email").value.trim(),
          professorType: document.getElementById("treg-type").value,
          department: document.getElementById("treg-dept").value.trim(),
          subjectCodes,
          password: document.getElementById("treg-password").value,
        };

        const result = await ApiService.registerTeacher(data);
        showToast("Teacher account created! Please log in.", "success");
        router.navigate("/login-teacher");
      } catch (error) {
        showToast(error.message, "error");
        setLoading(btn, false);
      }
    });
});

// ─── Page: Teacher Login ───
router.on("/login-teacher", () => {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-container auth-container-sm">
        <button class="back-btn" onclick="router.navigate('/')">← Back</button>
        <div class="auth-header">
          <div class="auth-icon">👨‍🏫</div>
          <h1>Teacher Login</h1>
          <p>Sign in with your institute email</p>
        </div>
        <form id="teacherLoginForm" class="auth-form">
          <div class="form-group">
            <label for="tlogin-email">Institute Email</label>
            <input type="email" id="tlogin-email" placeholder="jane@university.edu" required>
          </div>
          <div class="form-group">
            <label for="tlogin-password">Password</label>
            <div class="password-input">
              <input type="password" id="tlogin-password" placeholder="Enter password" required>
              <button type="button" class="password-toggle" data-target="tlogin-password" aria-label="Show password" aria-pressed="false">
                <i class='bx bx-hide'></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-accent btn-block btn-lg" id="loginTeacherBtn">Sign In</button>
        </form>
        <p class="auth-switch">Don't have an account? <a onclick="router.navigate('/register-teacher')">Register here</a></p>
      </div>
    </div>`;

  initPasswordToggles();

  document
    .getElementById("teacherLoginForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("loginTeacherBtn");
      setLoading(btn, true);

      try {
        const data = {
          email: document.getElementById("tlogin-email").value.trim(),
          password: document.getElementById("tlogin-password").value,
        };

        const result = await ApiService.loginTeacher(data);
        ApiService.setAuth(result.token, result.user);
        showToast("Welcome back!", "success");
        router.navigate("/teacher");
      } catch (error) {
        showToast(error.message, "error");
        setLoading(btn, false);
      }
    });
});

// ─── Page: Student Dashboard (QR Scan) ───
// ─── Page: Student Dashboard (Overview) ───
router.on("/student", async () => {
  if (!requireAuth("student")) return;
  const user = ApiService.getUser();

  app.innerHTML = `
    ${renderNav("student")}
    <div class="dashboard">
      <div class="page-header">
        <h1>Welcome, ${user.name.split(" ")[0]}!</h1>
        <p>Overview of your current attendance status</p>
      </div>
      <div class="dashboard-grid">
        <div class="main-content">
          <div class="section-title">My Subjects</div>
          <div id="subjectsList" class="subjects-grid">
            <div class="loading-state">Loading subjects...</div>
          </div>
        </div>
        <div class="side-content">
          <div class="section-title">Quick Actions</div>
          <div class="action-card" onclick="router.navigate('/student/scan')">
            <div class="action-icon">📷</div>
            <div class="action-text">
              <h3>Scan QR Code</h3>
              <p>Mark attendance for current class</p>
            </div>
            <div class="action-arrow">→</div>
          </div>
          <div class="section-title mt-4">Recent Activity</div>
          <div id="recentActivity" class="activity-list">
            <div class="loading-state">Loading activity...</div>
          </div>
        </div>
      </div>
    </div>`;

  loadStudentDashboard();
});

async function loadStudentDashboard() {
  try {
    const subjectsResult = await ApiService.getSubjects();
    const historyResult = await ApiService.getAttendanceHistory();

    const subjectsList = document.getElementById("subjectsList");
    const activityList = document.getElementById("recentActivity");

    if (subjectsResult.subjects.length === 0) {
      subjectsList.innerHTML = `
        <div class="empty-card">
          <p>No subjects found for your department.</p>
        </div>`;
    } else {
      // For each subject, we might want to fetch attendance, but for now let's just show them
      subjectsList.innerHTML = subjectsResult.subjects
        .map(
          (sub) => `
        <div class="subject-card" onclick="router.navigate('/student/attendance?code=${sub.subjectCode}')">
          <div class="subject-header">
            <span class="subject-code">${sub.subjectCode}</span>
            <span class="subject-dept">${sub.department}</span>
          </div>
          <h3 class="subject-name">Subject Details</h3>
          <div class="subject-footer">
            <span>View Attendance</span>
            <span class="arrow">→</span>
          </div>
        </div>`,
        )
        .join("");
    }

    if (historyResult.history.length === 0) {
      activityList.innerHTML = `<div class="empty-state-sm">No recent scans.</div>`;
    } else {
      activityList.innerHTML = historyResult.history
        .map(
          (h) => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div class="activity-info">
            <div class="activity-subject">${h.subjectCode}</div>
            <div class="activity-time">${new Date(h.timestamp).toLocaleDateString()} at ${new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>`,
        )
        .join("");
    }
  } catch (error) {
    showToast("Failed to load dashboard data.", "error");
  }
}

// ─── Page: Student Scanner ───
router.on("/student/scan", () => {
  if (!requireAuth("student")) return;

  app.innerHTML = `
    ${renderNav("student")}
    <div class="dashboard">
      <div class="page-header">
        <h1>Scan QR Code</h1>
        <p>Scan the live QR code displayed by your teacher</p>
      </div>
      <div class="scanner-container">
        <div class="scanner-viewport">
          <video id="scannerVideo" autoplay muted playsinline></video>
          <canvas id="scannerCanvas" class="scanner-canvas"></canvas>
          <div class="scanner-overlay">
            <div class="scanner-frame">
              <div class="corner tl"></div>
              <div class="corner tr"></div>
              <div class="corner bl"></div>
              <div class="corner br"></div>
            </div>
          </div>
          <div id="scannerStatus" class="scanner-status">
            <span class="pulse-dot"></span> Initializing camera...
          </div>
        </div>
        <div class="scanner-controls">
          <button id="startScanBtn" class="btn btn-primary btn-lg" onclick="startScanning()">
            <span class="btn-icon">📷</span> Start Scanning
          </button>
          <button id="stopScanBtn" class="btn btn-outline btn-lg" onclick="stopScanning()" style="display:none;">
            <span class="btn-icon">⏹</span> Stop Scanner
          </button>
        </div>
        <div id="scanResult" class="scan-result" style="display:none;"></div>
      </div>
    </div>`;
});

// Scanner functions
async function startScanning() {
  const video = document.getElementById("scannerVideo");
  const canvas = document.getElementById("scannerCanvas");
  const status = document.getElementById("scannerStatus");

  if (!video || !canvas) return;

  document.getElementById("startScanBtn").style.display = "none";
  document.getElementById("stopScanBtn").style.display = "inline-flex";

  router.currentScanner = new QRScanner(video, canvas, async (data) => {
    status.innerHTML =
      '<span class="pulse-dot success"></span> QR Code detected! Verifying...';

    try {
      const result = await ApiService.scanAttendance(data);
      document.getElementById("scanResult").style.display = "block";
      document.getElementById("scanResult").innerHTML = `
        <div class="result-card result-success">
          <div class="result-icon">✓</div>
          <h3>Attendance Marked!</h3>
          <p>${result.message}</p>
          <div class="result-details">
            <span>Subject: <strong>${result.attendance.subjectCode}</strong></span>
            <span>Date: <strong>${result.attendance.date}</strong></span>
          </div>
        </div>`;
      showToast(result.message, "success");
    } catch (error) {
      document.getElementById("scanResult").style.display = "block";
      document.getElementById("scanResult").innerHTML = `
        <div class="result-card result-error">
          <div class="result-icon">✕</div>
          <h3>Scan Failed</h3>
          <p>${error.message}</p>
        </div>`;
      showToast(error.message, "error");
    }
  });

  try {
    await router.currentScanner.start();
    status.innerHTML =
      '<span class="pulse-dot active"></span> Scanning for QR codes...';
  } catch (error) {
    status.innerHTML = `<span class="pulse-dot error"></span> ${error.message}`;
    showToast(error.message, "error");
  }
}

function stopScanning() {
  if (router.currentScanner) {
    router.currentScanner.stop();
    router.currentScanner = null;
  }
  document.getElementById("startScanBtn").style.display = "inline-flex";
  document.getElementById("stopScanBtn").style.display = "none";
  document.getElementById("scannerStatus").innerHTML =
    '<span class="pulse-dot"></span> Scanner stopped';
}

// ─── Page: Student Attendance View ───
// ─── Page: Student Attendance View ───
router.on("/student/attendance", () => {
  if (!requireAuth("student")) return;

  // Check for subject code in URL params
  const urlParams = new URLSearchParams(window.location.hash.split("?")[1]);
  const defaultCode = urlParams.get("code") || "";

  app.innerHTML = `
    ${renderNav("student")}
    <div class="dashboard">
      <div class="page-header">
        <h1>Subject Analytics</h1>
        <p>Detailed attendance report for your subjects</p>
      </div>
      <div class="content-card">
        <form id="attendanceQueryForm" class="inline-form">
          <div class="form-group">
            <label for="att-subject">Subject Code</label>
            <input type="text" id="att-subject" value="${defaultCode}" placeholder="e.g., CH401" required>
          </div>
          <button type="submit" class="btn btn-primary" id="viewAttBtn">View Stats</button>
        </form>
        <div id="attendanceResult"></div>
      </div>
    </div>`;

  if (defaultCode) {
    setTimeout(() => {
      document
        .getElementById("attendanceQueryForm")
        .dispatchEvent(new Event("submit"));
    }, 100);
  }

  document
    .getElementById("attendanceQueryForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("viewAttBtn");
      setLoading(btn, true);

      try {
        const subjectCode = document
          .getElementById("att-subject")
          .value.trim()
          .toUpperCase();
        const result = await ApiService.getStudentAttendance(subjectCode);
        const att = result.attendance;

        const percentage = att.percentage;
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (percentage / 100) * circumference;
        const color =
          percentage >= 80
            ? "#00e676"
            : percentage >= 40
              ? "#ffab00"
              : "#ff5252";

        document.getElementById("attendanceResult").innerHTML = `
        <div class="attendance-stats fade-in">
          <div class="stat-circle-container">
            <svg class="stat-circle" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
              <circle cx="60" cy="60" r="54" fill="none" stroke="${color}" stroke-width="8"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                stroke-linecap="round" transform="rotate(-90 60 60)"/>
            </svg>
            <div class="stat-circle-value">
              <span class="stat-percent" style="color:${color}">${percentage}%</span>
              <span class="stat-label">Attendance</span>
            </div>
          </div>
          <div class="stat-info">
            <h3>${att.subjectCode}</h3>
            <div class="stat-row">
              <div class="stat-item">
                <span class="stat-num">${att.totalClasses}</span>
                <span class="stat-desc">Total Classes</span>
              </div>
              <div class="stat-item">
                <span class="stat-num">${att.classesAttended}</span>
                <span class="stat-desc">Attended</span>
              </div>
            </div>
          </div>
        </div>`;
      } catch (error) {
        document.getElementById("attendanceResult").innerHTML = `
        <div class="empty-state">
          <p class="error-text">${error.message}</p>
        </div>`;
        showToast(error.message, "error");
      }

      setLoading(btn, false);
    });
});

// ─── Page: Student Profile ───
router.on("/student/profile", () => {
  if (!requireAuth("student")) return;

  app.innerHTML = `
    ${renderNav("student")}
    <div class="dashboard">
      <div class="page-header">
        <h1>My Profile</h1>
        <button class="btn btn-outline btn-sm" id="editProfileBtn" onclick="toggleStudentEdit()">✏️ Edit</button>
      </div>
      <div class="content-card" id="profileContent">
        <div class="profile-loading">Loading profile...</div>
      </div>
    </div>`;

  loadStudentProfile();
});

async function loadStudentProfile() {
  try {
    const result = await ApiService.getStudentProfile();
    const p = result.profile;
    renderStudentProfileView(p);
  } catch (error) {
    document.getElementById("profileContent").innerHTML = `
      <div class="empty-state"><p class="error-text">${error.message}</p></div>`;
  }
}

function renderStudentProfileView(p) {
  document.getElementById("profileContent").innerHTML = `
    <div class="profile-view fade-in">
      <div class="profile-avatar">${p.name?.charAt(0).toUpperCase() || "S"}</div>
      <div class="profile-fields">
        <div class="profile-field">
          <span class="field-label">Name</span>
          <span class="field-value">${p.name}</span>
        </div>
        <div class="profile-field">
          <span class="field-label">Roll Number</span>
          <span class="field-value"><span class="badge badge-blue">${p.rollNumber}</span></span>
        </div>
        <div class="profile-field">
          <span class="field-label">Email</span>
          <span class="field-value">${p.email}</span>
        </div>
        <div class="profile-field">
          <span class="field-label">Department</span>
          <span class="field-value">${p.department}</span>
        </div>
        <div class="profile-field">
          <span class="field-label">Graduation Program</span>
          <span class="field-value"><span class="badge badge-purple">${p.gradProgram}</span></span>
        </div>
        <div class="profile-field">
          <span class="field-label">Year</span>
          <span class="field-value">${p.year}</span>
        </div>
        <div class="profile-field">
          <span class="field-label">Subjects Registered</span>
          <span class="field-value">${
            p.subjectCodes && p.subjectCodes.length > 0
              ? p.subjectCodes.map(s => `<span class="badge badge-blue">${s}</span>`).join(' ')
              : '<span class="text-muted">None</span>'
          }</span>
        </div>
      </div>
    </div>`;
}

function toggleStudentEdit() {
  const btn = document.getElementById("editProfileBtn");
  const content = document.getElementById("profileContent");

  if (btn.dataset.editing === "true") {
    loadStudentProfile();
    btn.textContent = "✏️ Edit";
    btn.dataset.editing = "false";
    return;
  }

  btn.textContent = "✕ Cancel";
  btn.dataset.editing = "true";

  const user = ApiService.getUser();

  content.innerHTML = `
    <form id="editStudentForm" class="profile-edit fade-in">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="edit-name" value="${user.name || ""}" required>
      </div>
      <div class="form-group disabled-field">
        <label>Email <span class="immutable-badge">Cannot be changed</span></label>
        <input type="email" value="${user.email || ""}" disabled>
      </div>
      <div class="form-group">
        <label>Year of Studying</label>
        <input type="number" id="edit-year" value="${user.year || 1}" min="1" max="6" required>
      </div>
      <div class="form-group disabled-field">
        <label>Roll Number <span class="immutable-badge">Cannot be changed</span></label>
        <input type="text" value="${user.rollNumber || ""}" disabled>
      </div>
      <div class="form-group disabled-field">
        <label>Department <span class="immutable-badge">Cannot be changed</span></label>
        <input type="text" value="${user.department || ""}" disabled>
      </div>
      <button type="submit" class="btn btn-primary btn-lg" id="saveProfileBtn">Save Changes</button>
    </form>`;

  document
    .getElementById("editStudentForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("saveProfileBtn");
      setLoading(saveBtn, true);

      try {
        const data = {
          name: document.getElementById("edit-name").value.trim(),
          year: parseInt(document.getElementById("edit-year").value),
        };

        const result = await ApiService.updateStudentProfile(data);

        // Update stored user data
        const currentUser = ApiService.getUser();
        const updated = { ...currentUser, ...data };
        ApiService.setAuth(ApiService.getToken(), updated);

        showToast("Profile updated successfully!", "success");
        btn.textContent = "✏️ Edit";
        btn.dataset.editing = "false";
        renderStudentProfileView(result.profile);
      } catch (error) {
        showToast(error.message, "error");
        setLoading(saveBtn, false);
      }
    });
}

// ─── Page: Teacher Dashboard (Session & QR) ───
// ─── Page: Teacher Dashboard (Overview) ───
router.on("/teacher", async () => {
  if (!requireAuth("teacher")) return;
  const user = ApiService.getUser();

  app.innerHTML = `
    ${renderNav("teacher")}
    <div class="dashboard">
      <div class="page-header">
        <h1>Teacher Dashboard</h1>
        <p>Manage your subjects and attendance sessions</p>
      </div>
      <div class="dashboard-grid">
        <div class="main-content">
          <div class="section-title">My Subjects</div>
          <div id="teacherSubjectsList" class="subjects-grid">
            <div class="loading-state">Loading subjects...</div>
          </div>
        </div>
        <div class="side-content">
          <div class="section-title">Actions</div>
          <div class="action-card accent" onclick="router.navigate('/teacher/session')">
            <div class="action-icon">📡</div>
            <div class="action-text">
              <h3>New Session</h3>
              <p>Start taking attendance</p>
            </div>
            <div class="action-arrow">→</div>
          </div>
          <div class="section-title mt-4">Past Sessions</div>
          <div id="pastSessions" class="activity-list">
            <div class="loading-state">Loading sessions...</div>
          </div>
        </div>
      </div>
    </div>`;

  loadTeacherDashboard();
});

async function loadTeacherDashboard() {
  try {
    const subjectsResult = await ApiService.getSubjects();
    const sessionsResult = await ApiService.getTeacherSessions();

    const subjectsList = document.getElementById("teacherSubjectsList");
    const sessionsList = document.getElementById("pastSessions");

    if (subjectsResult.subjects.length === 0) {
      subjectsList.innerHTML = `<div class="empty-card"><p>No subjects assigned yet.</p></div>`;
    } else {
      subjectsList.innerHTML = subjectsResult.subjects
        .map(
          (sub) => `
        <div class="subject-card subject-card-teacher" onclick="router.navigate('/teacher/analytics?code=${sub.subjectCode}')">
          <div class="subject-header">
            <span class="subject-code">${sub.subjectCode}</span>
            <span class="badge badge-purple">${sub.department}</span>
          </div>
          <h3 class="subject-name">Subject Analytics</h3>
          <div class="subject-footer">
            <span>View Detailed Report</span>
            <span class="arrow">→</span>
          </div>
        </div>`,
        )
        .join("");
    }

    if (sessionsResult.sessions.length === 0) {
      sessionsList.innerHTML = `<div class="empty-state-sm">No past sessions.</div>`;
    } else {
      sessionsList.innerHTML = sessionsResult.sessions
        .map(
          (s) => `
        <div class="activity-item">
          <div class="activity-dot active"></div>
          <div class="activity-info">
            <div class="activity-subject">${s.subjectCode}</div>
            <div class="activity-time">${new Date(s.startTime).toLocaleDateString()} • ${s.attendanceCount} students</div>
          </div>
        </div>`,
        )
        .join("");
    }
  } catch (error) {
    showToast("Failed to load teacher dashboard.", "error");
  }
}

// ─── Page: Teacher Session (QR Generation) ───
router.on("/teacher/session", () => {
  if (!requireAuth("teacher")) return;
  const user = ApiService.getUser();

  const subjectOptions = (user.subjectCodes || [])
    .map((code) => `<option value="${code}">${code}</option>`)
    .join("");

  app.innerHTML = `
    ${renderNav("teacher")}
    <div class="dashboard">
      <div class="page-header">
        <h1>Attendance Session</h1>
        <p>Select a subject and start taking attendance</p>
      </div>
      <div class="content-card">
        <div class="session-controls">
          <div class="form-group">
            <label for="session-subject">Subject Code</label>
            <select id="session-subject" required>
              <option value="">Select Subject</option>
              ${subjectOptions}
            </select>
          </div>
          <div class="session-actions">
            <button class="btn btn-primary btn-lg" id="startSessionBtn" onclick="startSession()">
              <span class="btn-icon">▶</span> Start Attendance
            </button>
            <button class="btn btn-danger btn-lg" id="stopSessionBtn" onclick="stopSession()" style="display:none;">
              <span class="btn-icon">⏹</span> Stop Session
            </button>
          </div>
        </div>
      </div>
      <div id="qrDisplay" class="qr-display-container" style="display:none;">
        <div class="qr-card">
          <div class="qr-header">
            <div class="qr-live-badge"><span class="pulse-dot active"></span> LIVE</div>
            <h2 id="qrSubjectLabel">-</h2>
          </div>
          <div class="qr-image-wrapper">
            <img id="qrImage" class="qr-image" alt="QR Code" />
            <div class="qr-refresh-ring" id="qrRefreshRing"></div>
          </div>
          <p class="qr-hint">QR refreshes every 2 seconds • Ask students to scan</p>
          <div class="qr-timer" id="qrTimer">Session active: <span id="sessionDuration">0:00</span></div>
        </div>
      </div>
    </div>`;

  checkActiveSession();
});

async function checkActiveSession() {
  try {
    const result = await ApiService.getCurrentQR();
    if (result.success) {
      // There's an active session, show the QR
      showQRDisplay(result.qr.subjectCode);
      updateQRImage(result.qr.image);
      startQRRefresh();
    }
  } catch (e) {
    // No active session, that's fine
  }
}

let sessionStartTime = null;
let sessionTimerInterval = null;

async function startSession() {
  const subjectCode = document.getElementById("session-subject").value;
  if (!subjectCode) {
    showToast("Please select a subject code.", "error");
    return;
  }

  const btn = document.getElementById("startSessionBtn");
  setLoading(btn, true);

  try {
    const result = await ApiService.startAttendance(subjectCode);
    showToast(`Attendance session started for ${subjectCode}!`, "success");
    showQRDisplay(subjectCode);
    startQRRefresh();
    sessionStartTime = Date.now();
    startSessionTimer();
  } catch (error) {
    showToast(error.message, "error");
    setLoading(btn, false);
  }
}

async function stopSession() {
  try {
    const result = await ApiService.stopAttendance();
    showToast(
      `Session stopped. ${result.session.attendanceCount} students marked attendance.`,
      "success",
    );
    hideQRDisplay();
    stopQRRefresh();
    stopSessionTimer();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function showQRDisplay(subjectCode) {
  document.getElementById("qrDisplay").style.display = "block";
  document.getElementById("qrSubjectLabel").textContent = subjectCode;
  document.getElementById("startSessionBtn").style.display = "none";
  document.getElementById("stopSessionBtn").style.display = "inline-flex";
  document.getElementById("session-subject").disabled = true;
}

function hideQRDisplay() {
  document.getElementById("qrDisplay").style.display = "none";
  document.getElementById("startSessionBtn").style.display = "inline-flex";
  document.getElementById("stopSessionBtn").style.display = "none";
  document.getElementById("session-subject").disabled = false;
  const btn = document.getElementById("startSessionBtn");
  btn.textContent = "▶ Start Attendance";
  btn.disabled = false;
}

function updateQRImage(imageDataUrl) {
  const img = document.getElementById("qrImage");
  if (img) {
    img.src = imageDataUrl;
    img.classList.add("qr-pulse");
    setTimeout(() => img.classList.remove("qr-pulse"), 300);
  }
}

function startQRRefresh() {
  stopQRRefresh();

  // Fetch new QR every 2 seconds
  router.qrInterval = setInterval(async () => {
    try {
      const result = await ApiService.getCurrentQR();
      if (result.success) {
        updateQRImage(result.qr.image);
      }
    } catch (error) {
      if (error.message.includes("No active")) {
        hideQRDisplay();
        stopQRRefresh();
        stopSessionTimer();
      }
    }
  }, 2000);
}

function stopQRRefresh() {
  if (router.qrInterval) {
    clearInterval(router.qrInterval);
    router.qrInterval = null;
  }
}

function startSessionTimer() {
  stopSessionTimer();
  sessionStartTime = sessionStartTime || Date.now();

  sessionTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const el = document.getElementById("sessionDuration");
    if (el) el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  }, 1000);
}

function stopSessionTimer() {
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }
  sessionStartTime = null;
}

// ─── Page: Teacher Analytics ───
router.on("/teacher/analytics", () => {
  if (!requireAuth("teacher")) return;
  const user = ApiService.getUser();

  // Check for subject code in URL params
  const urlParams = new URLSearchParams(window.location.hash.split("?")[1]);
  const defaultCode = urlParams.get("code") || "";

  const subjectOptions = (user.subjectCodes || [])
    .map(
      (code) =>
        `<option value="${code}" ${code === defaultCode ? "selected" : ""}>${code}</option>`,
    )
    .join("");

  app.innerHTML = `
    ${renderNav("teacher")}
    <div class="dashboard">
      <div class="page-header">
        <h1>Attendance Analytics</h1>
        <p>View attendance records for your subjects</p>
      </div>
      <div class="content-card">
        <form id="analyticsForm" class="inline-form">
          <div class="form-group">
            <label for="analytics-subject">Subject Code</label>
            <select id="analytics-subject" required>
              <option value="">Select Subject</option>
              ${subjectOptions}
            </select>
          </div>
          <button type="submit" class="btn btn-accent" id="viewAnalyticsBtn">View Report</button>
        </form>
        <div id="analyticsResult"></div>
      </div>
    </div>`;

  if (defaultCode) {
    setTimeout(() => {
      document
        .getElementById("analyticsForm")
        .dispatchEvent(new Event("submit"));
    }, 100);
  }

  document
    .getElementById("analyticsForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const subjectCode = document.getElementById("analytics-subject").value;
      if (!subjectCode) {
        showToast("Please select a subject.", "error");
        return;
      }

      const btn = document.getElementById("viewAnalyticsBtn");
      setLoading(btn, true);

      try {
        const result = await ApiService.getSubjectSummary(subjectCode);

        if (result.students.length === 0) {
          document.getElementById("analyticsResult").innerHTML = `
          <div class="empty-state fade-in">
            <div class="empty-icon">📋</div>
            <p>No students found for ${subjectCode}.</p>
          </div>`;
        } else {
          const rows = result.students
            .map((s, i) => {
              const pColor =
                s.percentage >= 80
                  ? "stat-good"
                  : s.percentage >= 40
                    ? "stat-warn"
                    : "stat-bad";
              return `
            <tr class="fade-in" style="animation-delay: ${i * 30}ms">
              <td>${s.name}</td>
              <td><span class="badge badge-blue">${s.rollNumber}</span></td>
              <td>${s.totalClasses}</td>
              <td>${s.classesAttended}</td>
              <td><span class="stat-badge ${pColor}">${s.percentage}%</span></td>
            </tr>`;
            })
            .join("");

          document.getElementById("analyticsResult").innerHTML = `
          <div class="analytics-summary fade-in">
            <div class="summary-stat">
              <span class="summary-num">${result.totalClasses}</span>
              <span class="summary-label">Total Classes</span>
            </div>
            <div class="summary-stat">
              <span class="summary-num">${result.students.length}</span>
              <span class="summary-label">Students</span>
            </div>
          </div>
          <div class="table-container fade-in">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Total Classes</th>
                  <th>Attended</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
        }
      } catch (error) {
        document.getElementById("analyticsResult").innerHTML = `
        <div class="empty-state"><p class="error-text">${error.message}</p></div>`;
        showToast(error.message, "error");
      }

      setLoading(btn, false);
    });
});

// ─── Page: Teacher Profile ───
router.on("/teacher/profile", () => {
  if (!requireAuth("teacher")) return;

  app.innerHTML = `
    ${renderNav("teacher")}
    <div class="dashboard">
      <div class="page-header">
        <h1>My Profile</h1>
        <button class="btn btn-outline btn-sm" id="editProfileBtn" onclick="toggleTeacherEdit()">✏️ Edit</button>
      </div>
      <div class="content-card" id="profileContent">
        <div class="profile-loading">Loading profile...</div>
      </div>
    </div>`;

  loadTeacherProfile();
});

async function loadTeacherProfile() {
  try {
    const result = await ApiService.getTeacherProfile();
    const p = result.profile;
    renderTeacherProfileView(p);
  } catch (error) {
    document.getElementById("profileContent").innerHTML = `
      <div class="empty-state"><p class="error-text">${error.message}</p></div>`;
  }
}

function renderTeacherProfileView(p) {
  const subjectBadges = (p.subjectCodes || [])
    .map((c) => `<span class="badge badge-green">${c}</span>`)
    .join(" ");

  document.getElementById("profileContent").innerHTML = `
    <div class="profile-view fade-in">
      <div class="profile-avatar teacher-avatar">${p.name?.charAt(0).toUpperCase() || "T"}</div>
      <div class="profile-fields">
        <div class="profile-field">
          <span class="field-label">Name</span>
          <span class="field-value">${p.name}</span>
        </div>
        <div class="profile-field">
          <span class="field-label">Institute Email</span>
          <span class="field-value">${p.email}</span>
        </div>
        <div class="profile-field">
          <span class="field-label">Professor Type</span>
          <span class="field-value"><span class="badge badge-purple">${p.professorType}</span></span>
        </div>
        <div class="profile-field">
          <span class="field-label">Department</span>
          <span class="field-value">${p.department}</span>
        </div>
        <div class="profile-field">
          <span class="field-label">Subject Codes</span>
          <span class="field-value">${subjectBadges}</span>
        </div>
      </div>
    </div>`;
}

function toggleTeacherEdit() {
  const btn = document.getElementById("editProfileBtn");
  const content = document.getElementById("profileContent");

  if (btn.dataset.editing === "true") {
    loadTeacherProfile();
    btn.textContent = "✏️ Edit";
    btn.dataset.editing = "false";
    return;
  }

  btn.textContent = "✕ Cancel";
  btn.dataset.editing = "true";

  const user = ApiService.getUser();
  const subjectBadges = (user.subjectCodes || [])
    .map((c) => `<span class="badge badge-green">${c}</span>`)
    .join(" ");

  content.innerHTML = `
    <form id="editTeacherForm" class="profile-edit fade-in">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="tedit-name" value="${user.name || ""}" required>
      </div>
      <div class="form-group">
        <label>Professor Type</label>
        <select id="tedit-type" required>
          <option value="Assistant" ${user.professorType === "Assistant" ? "selected" : ""}>Assistant Professor</option>
          <option value="Associate" ${user.professorType === "Associate" ? "selected" : ""}>Associate Professor</option>
          <option value="Professor" ${user.professorType === "Professor" ? "selected" : ""}>Professor</option>
        </select>
      </div>
      <div class="form-group disabled-field">
        <label>Institute Email <span class="immutable-badge">Cannot be changed</span></label>
        <input type="text" value="${user.email || ""}" disabled>
      </div>
      <div class="form-group disabled-field">
        <label>Department <span class="immutable-badge">Cannot be changed</span></label>
        <input type="text" value="${user.department || ""}" disabled>
      </div>
      <div class="form-group disabled-field">
        <label>Subject Codes <span class="immutable-badge">Cannot be changed</span></label>
        <div class="disabled-badges">${subjectBadges}</div>
      </div>
      <button type="submit" class="btn btn-accent btn-lg" id="saveTeacherBtn">Save Changes</button>
    </form>`;

  document
    .getElementById("editTeacherForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("saveTeacherBtn");
      setLoading(saveBtn, true);

      try {
        const data = {
          name: document.getElementById("tedit-name").value.trim(),
          professorType: document.getElementById("tedit-type").value,
        };

        const result = await ApiService.updateTeacherProfile(data);

        const currentUser = ApiService.getUser();
        const updated = { ...currentUser, ...data };
        ApiService.setAuth(ApiService.getToken(), updated);

        showToast("Profile updated!", "success");
        btn.textContent = "✏️ Edit";
        btn.dataset.editing = "false";
        renderTeacherProfileView(result.profile);
      } catch (error) {
        showToast(error.message, "error");
        setLoading(saveBtn, false);
      }
    });
}

// ─── Initial Route ───
document.addEventListener("DOMContentLoaded", () => {
  // Redirect authenticated users to their dashboard
  if (ApiService.isAuthenticated()) {
    const user = ApiService.getUser();
    const hash = window.location.hash.slice(1);
    if (!hash || hash === "/") {
      router.navigate(user.role === "teacher" ? "/teacher" : "/student");
      return;
    }
  }
  router.route();
});
