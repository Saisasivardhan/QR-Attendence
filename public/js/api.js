/**
 * API Service Layer
 * Centralized HTTP client for all backend API calls.
 * Handles authentication headers, error responses, and token management.
 */

const API_BASE = "/api";

class ApiService {
  /**
   * Get stored JWT token
   */
  static getToken() {
    return localStorage.getItem("token");
  }

  /**
   * Store JWT token and user data
   */
  static setAuth(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  }

  /**
   * Clear all stored auth data
   */
  static clearAuth() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("activeSession");
  }

  /**
   * Get stored user data
   */
  static getUser() {
    const data = localStorage.getItem("user");
    return data ? JSON.parse(data) : null;
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Build request headers with optional auth token
   */
  static getHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Generic HTTP request handler
   */
  static async request(method, endpoint, body = null) {
    const options = {
      method,
      headers: this.getHeaders(),
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        // Auto-logout on auth errors
        if (response.status === 401) {
          this.clearAuth();
          if (
            window.location.hash !== "#/login-student" &&
            window.location.hash !== "#/login-teacher" &&
            window.location.hash !== "#/" &&
            window.location.hash !== ""
          ) {
            window.location.hash = "#/";
          }
        }
        throw new Error(data.message || "Request failed");
      }

      return data;
    } catch (error) {
      if (error.message === "Failed to fetch") {
        throw new Error("Network error. Please check your connection.");
      }
      throw error;
    }
  }

  // ─── Auth APIs ───
  static registerStudent(data) {
    return this.request("POST", "/auth/student/register", data);
  }

  static loginStudent(data) {
    return this.request("POST", "/auth/student/login", data);
  }

  static registerTeacher(data) {
    return this.request("POST", "/auth/teacher/register", data);
  }

  static loginTeacher(data) {
    return this.request("POST", "/auth/teacher/login", data);
  }

  // ─── Profile APIs ───
  static getStudentProfile() {
    return this.request("GET", "/profile/student");
  }

  static updateStudentProfile(data) {
    return this.request("PUT", "/profile/student", data);
  }

  static getTeacherProfile() {
    return this.request("GET", "/profile/teacher");
  }

  static updateTeacherProfile(data) {
    return this.request("PUT", "/profile/teacher", data);
  }

  // ─── Attendance APIs ───
  static startAttendance(subjectCode) {
    return this.request("POST", "/attendance/start", { subjectCode });
  }

  static stopAttendance() {
    return this.request("POST", "/attendance/stop");
  }

  static getCurrentQR() {
    return this.request("GET", "/attendance/qr/current");
  }

  static scanAttendance(qrPayload) {
    return this.request("POST", "/attendance/scan", { qrPayload });
  }

  static getStudentAttendance(subjectCode) {
    return this.request(
      "GET",
      `/attendance/student/${encodeURIComponent(subjectCode)}`,
    );
  }

  static getSubjectSummary(subjectCode) {
    return this.request(
      "GET",
      `/attendance/subject/${encodeURIComponent(subjectCode)}/summary`,
    );
  }

  static getSubjects() {
    return this.request("GET", "/attendance/subjects");
  }

  static getAttendanceHistory() {
    return this.request("GET", "/attendance/student/history");
  }

  static getTeacherSessions() {
    return this.request("GET", "/attendance/teacher/sessions");
  }
}
