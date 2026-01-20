/**
 * MockAPI_12
 * SCORM 1.2 LMS API Mock for Testing
 *
 * @author Cybercussion Interactive, LLC
 */

export default class MockAPI_12 {
  constructor() {
    this.data = {
      "cmi.core.lesson_status": "not attempted",
      "cmi.core.entry": "ab-initio",
      "cmi.core.exit": "",
      "cmi.core.score.raw": "",
      "cmi.core.location": "",
      "cmi.suspend_data": "",
      "cmi.launch_data": "",
      "cmi.student_preferences.language": "",
      "cmi.student_preferences.audio": "",
      "cmi.student_preferences.speed": "",
      "cmi.student_preferences.text": "",
      // Arrays (simplified for mock)
      "cmi.objectives._count": "0",
      "cmi.interactions._count": "0"
    };
    this.lastError = "0";
  }

  LMSInitialize(param) {
    this.lastError = "0";
    return "true";
  }

  LMSFinish(param) {
    this.lastError = "0";
    return "true";
  }

  LMSGetValue(model) {
    this.lastError = "0";
    // Simple exact match or fallback
    if (this.data.hasOwnProperty(model)) {
      return this.data[model];
    }
    // Handle array counts dynamically if needed, or simple mock
    if (model.includes("._count")) return "0";

    // Handle array getters if data was set
    if (this.data[model] !== undefined) return this.data[model];

    return "";
  }

  LMSSetValue(model, value) {
    this.lastError = "0";
    this.data[model] = value.toString();

    // Dynamic array counting simulation for tests
    if (model.includes(".objectives.") && model.endsWith(".id")) {
      // extract index: cmi.objectives.n.id
      const parts = model.split('.');
      const index = parseInt(parts[2], 10);
      const count = parseInt(this.data["cmi.objectives._count"], 10);
      if (index >= count) {
        this.data["cmi.objectives._count"] = String(index + 1);
      }
    }

    if (model.includes(".interactions.") && model.endsWith(".id")) {
      const parts = model.split('.');
      const index = parseInt(parts[2], 10);
      const count = parseInt(this.data["cmi.interactions._count"], 10);
      if (index >= count) {
        this.data["cmi.interactions._count"] = String(index + 1);
      }
    }

    return "true";
  }

  LMSCommit(param) {
    this.lastError = "0";
    return "true";
  }

  LMSGetLastError() {
    return this.lastError;
  }

  LMSGetErrorString(errCode) {
    return "Mock Error String";
  }

  LMSGetDiagnostic(errCode) {
    return "Mock Diagnostic";
  }
}
