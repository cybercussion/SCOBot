/**
 * SCOBotBase
 * Modernized for ES6+ (2026)
 *
 * @author Cybercussion Interactive, LLC
 * @license CC-BY-SA-4.0
 */

import SCOBotUtil from '../utils/SCOBotUtil.js';
import SCOBot_API_1484_11 from '../mocks/SCOBot_API_1484_11.js';

export default class SCOBotBase {

    constructor(options = {}) {
        const defaults = {
            version: "5.0.0",
            createDate: "04/05/2011 08:56AM",
            modifiedDate: new Date().toISOString(),
            debug: false,
            isActive: false,
            throw_alerts: false,
            preferred_API: "findAPI", // findAPI, findSCORM12, findSCORM2004
            prefix: "SCOBotBase",
            exit_type: "suspend", // suspend, finish, or "" (undetermined)
            success_status: "unknown", // passed, failed, unknown
            use_standalone: true, // false if you don't want it to fail over locally
            standalone: false, // flag
            completion_status: "incomplete", // default completed, incomplete, unknown
            time_type: "UTC", // UTC or GMT
            cmi: null,
            latency_arr: []
        };

        this.settings = SCOBotUtil.extend(defaults, options);

        this.error = {
            0: "No Error",
            404: "Not Found",
            405: "Prevented on a read only resource"
        };

        this.API = {
            connection: false,
            version: "none", // 2004, 1.2 or none
            mode: "",
            path: false,
            data: {
                completion_status: this.settings.completion_status,
                success_status: this.settings.success_status,
                exit_type: this.settings.exit_type
            },
            isActive: this.settings.isActive
        };

        // Inherit error codes
        this.settings.error = this.error;
        this.settings.startDate = {};

        // Self Initialize (as per original logic)
        this.init();
    }

    /**
     * Debugging
     */
    debug(msg, lvl) {
        if (this.settings.debug) {
            switch (lvl) {
                case 1: console.error(msg); break;
                case 2: console.warn(msg); break;
                case 4: console.info(msg); break;
                case 3: console.log(msg); break;
                default: console.log(msg); return false;
            }
            return true;
        }
        if (lvl < 3 && this.settings.throw_alerts) {
            alert(msg);
        }
        return true;
    }

    /**
     * Initialize Connection
     */
    init() {
        // Search for LMS API across frames
        try {
            if (window.parent && window.parent !== window) {
                this.findAPI(window.parent);
            }
        } catch (e) {
            this.debug(`${this.settings.prefix} Possible Cross-domain issue/local mode (ignore).`, 2);
        }

        if (!this.API.path) {
            try {
                if (window.top.opener) {
                    this.findAPI(window.top.opener);
                }
            } catch (e) {
                this.debug(`${this.settings.prefix} Possible Cross-domain issue/local mode (ignore).`, 2);
            }
        }

        if (this.API.path) {
            this.API.connection = true;
            return true;
        }

        this.debug(`${this.settings.prefix}: I was unable to locate an API for communication`, 2);

        // Standalone Mode (Mock API)
        if (this.settings.use_standalone) {
            this.debug(`${this.settings.prefix}: Using Local_API_1484_11 to mimic LMS.`, 4);
            this.settings.standalone = true;
            this.API.version = "2004";

            // Check if Mock API is available (imported)
            this.API.path = new SCOBot_API_1484_11({ cmi: this.settings.cmi });

            // Rebroadcast 'StoreData' events from the Mock API
            SCOBotUtil.addEvent(this.API.path, 'StoreData', (e) => {
                SCOBotUtil.triggerEvent(this, 'StoreData', e);
            });

            this.API.connection = true;
            return true;
        }

        setTimeout(() => {
            SCOBotUtil.triggerEvent(this, 'nolms', { msg: 'Could not locate Runtime API. Your data will not be persisted.' });
        }, 1000);

        return false;
    }

    findAPI(win) {
        const limit = 500;
        let attempts = 0;

        // Helper to loop up parent windows
        const search = (windowObj, predicate) => {
            let current = windowObj;
            while (current && !predicate(current) && current.parent && current.parent !== current && attempts <= limit) {
                attempts++;
                current = current.parent;
            }
            return predicate(current) ? current : null;
        };

        if (this.settings.preferred_API === "findAPI") {
            // Search 2004 then 1.2
            let found = search(win, w => w.API_1484_11 || w.API);
            if (found) {
                if (found.API_1484_11) {
                    this.API.version = "2004";
                    this.API.path = found.API_1484_11;
                } else if (found.API) {
                    this.API.version = "1.2";
                    this.API.path = found.API;
                }
                return true;
            }
        } else if (this.settings.preferred_API === "findSCORM12") {
            const found = search(win, w => w.API);
            if (found) {
                this.API.version = "1.2";
                this.API.path = found.API;
                return true;
            }
        } else {
            // Default 2004
            const found = search(win, w => w.API_1484_11);
            if (found) {
                this.API.version = "2004";
                this.API.path = found.API_1484_11;
                return true;
            }
        }
        return false;
    }

    initialize() {
        this.debug(`${this.settings.prefix}: Initialize Called.`, 3);
        let success = false;
        let errorCode = 0;

        if (!this.API.isActive) {
            if (this.API.path) {
                switch (this.API.version) {
                    case "1.2":
                        success = this.makeBoolean(this.API.path.LMSInitialize(""));
                        break;
                    case "2004":
                        success = this.makeBoolean(this.API.path.Initialize(""));
                        break;
                }
                errorCode = this.getLastErrorCode();

                if (success && errorCode === 0) {
                    this.API.isActive = true;
                    this.API.data.completion_status = this.getvalue('cmi.completion_status');
                    this.settings.startDate = new Date();

                    this.debug(`${this.settings.prefix}: SCO is initialized.`, 3);

                    // Normalize completion status
                    if (["not attempted", "unknown", ""].includes(this.API.data.completion_status)) {
                        this.setvalue("cmi.completion_status", "incomplete");
                    }
                    return 'true';
                }
                this.debug(`${this.settings.prefix}: Error Initializing.\nCode: ${errorCode} \nMessage: ${this.getLastErrorMessage(errorCode)}`, 1);
            } else {
                this.debug(`${this.settings.prefix}: Aborted, LMS could not be located!`, 2);
            }
        } else {
            this.debug(`${this.settings.prefix}: Aborted, connection already initialized!`, 2);
        }
        return 'false';
    }

    terminate() {
        let success = false;
        let errorCode = 0;

        this.debug(`${this.settings.prefix}: Terminating...`, 4);

        if (this.API.isActive) {
            if (this.API.path) {
                this.commit(); // Ensure save

                switch (this.API.version) {
                    case "1.2":
                        success = this.API.path.LMSFinish("");
                        break;
                    case "2004":
                        success = this.API.path.Terminate("");
                        break;
                }

                if (this.makeBoolean(success)) {
                    this.debug(`${this.settings.prefix}: Terminated.`, 3);
                    SCOBotUtil.triggerEvent(this, 'terminated', {});
                    this.API.isActive = false;
                } else {
                    errorCode = this.getLastErrorCode();
                    this.debug(`${this.settings.prefix}: Error Terminating.\nCode: ${errorCode}`, 1);
                }
            } else {
                this.debug(`${this.settings.prefix}: Lost connection to LMS`, 2);
            }
        }
        return success;
    }

    commit() {
        let success = 'false';
        const sessionSecs = (new Date().getTime() - this.settings.startDate.getTime()) / 1000;

        // Latency check
        const start = new Date();

        if (this.API.isActive) {
            this.debug(`${this.settings.prefix}: Committing data`, 3);

            switch (this.API.version) {
                case "1.2":
                    this.setvalue("cmi.core.session_time", this.centisecsToSCORM12Duration(sessionSecs * 100));
                    success = this.API.path.LMSCommit("");
                    break;
                case "2004":
                    this.setvalue("cmi.session_time", this.centisecsToISODuration(sessionSecs * 100, true));
                    success = this.API.path.Commit("");
                    break;
            }

            const end = new Date();
            const latency = end - start;
            this.debug(`${this.settings.prefix}: Commit Latency: ${latency}ms`, 3);
            this.settings.latency_arr = []; // Reset after check

            if (this.getLastErrorCode() === 0) return success;
            this.debug(`${this.settings.prefix}: Commit Error Code: ${this.getLastErrorCode()}`, 1);
            return 'false';
        }
        return 'false';
    }

    getvalue(n) {
        let v = null;
        let errorCode = 0;
        let ignore = false;
        let newName = n;
        const start = new Date();

        if (this.API.isActive) {
            // Version Translation
            if (this.API.version === "1.2") {
                const map = this.getSCORM12Map(n);
                if (map.ignore) return 'false';
                newName = map.name;
            }

            // Execute Call
            switch (this.API.version) {
                case "1.2":
                    v = this.API.path.LMSGetValue(newName);
                    break;
                case "2004":
                    v = this.API.path.GetValue(n);
                    break;
            }

            errorCode = this.getLastErrorCode();
            const msg = this.getLastErrorMessage(errorCode);
            const diag = this.getDiagnostic(errorCode);

            // Trigger Event
            SCOBotUtil.triggerEvent(this, 'getvalue', {
                n: n,
                v: v,
                error: { code: errorCode, message: msg, diagnostic: diag }
            });

            // Latency tracking
            const end = new Date();
            this.settings.latency_arr.push({ lat: Number(end) - Number(start), v: n });

            if (errorCode === 0 || errorCode === 403) {
                if (v === 'undefined' || v === null || v === 'null') v = "";
                if (this.API.version === "1.2" && v === "0000:00:00.0") v = ""; // Fix empty time
                return String(v);
            }

            this.debug(`${this.settings.prefix}: GetValue Error ${errorCode}: ${msg}`, 1);
            return 'false';
        }
        this.debug(`${this.settings.prefix}: GetValue Aborted, connection not active.`, 2);
        return 'false';
    }

    setvalue(n, v) {
        let success = 'false';
        let errorCode = 0;
        let newName = n;

        if (this.API.isActive) {
            // Version Translation
            if (this.API.version === "1.2") {
                const map = this.getSCORM12Map(n, v); // v needed for some logic
                if (map.ignore) return 'false';
                newName = map.name;
                // Update Value if translation required (e.g. exit type)
                if (map.value !== undefined) v = map.value;

                // 1.2 Validation (Length checks)
                if (newName === 'cmi.suspend_data' && v.length > 4096) {
                    this.debug(`${this.settings.prefix}: Warning, suspend_data > 4096 chars`, 2);
                }
            } else if (this.API.version === "2004") {
                // 2004 Validation
                if (n === 'cmi.suspend_data' && v.length > 64000) {
                    this.debug(`${this.settings.prefix}: Warning, suspend_data > 64000 chars`, 2);
                }
                // Update local mirrors
                if (n === 'cmi.completion_status') this.API.data.completion_status = v;
                if (n === 'cmi.success_status') this.API.data.success_status = v;
                if (n === 'cmi.exit') this.API.data.exit_type = v;
            }

            // Execute Call
            switch (this.API.version) {
                case "1.2":
                    success = this.API.path.LMSSetValue(newName, v);
                    break;
                case "2004":
                    success = this.API.path.SetValue(n, v);
                    break;
            }

            errorCode = this.getLastErrorCode();

            // Trigger Event
            SCOBotUtil.triggerEvent(this, 'setvalue', {
                n: n,
                v: v,
                error: { code: errorCode, message: this.getLastErrorMessage(errorCode) }
            });

            if (errorCode === 0 || errorCode === 403) return success;
            this.debug(`${this.settings.prefix}: SetValue Error ${errorCode} on ${n}`, 1);
            return success;
        }
        return 'false';
    }

    /**
     * Helper to map SCORM 2004 keys to SCORM 1.2
     */
    getSCORM12Map(n, v = null) {
        let name = n;
        let ignore = false;
        let value = v;

        // Direct Mappings
        const mappings = {
            "cmi.credit": "cmi.core.credit",
            "cmi.location": "cmi.core.lesson_location",
            "cmi.entry": "cmi.core.entry",
            "cmi.mode": "cmi.core.lesson_mode",
            "cmi.exit": "cmi.core.exit",
            "cmi.score.raw": "cmi.core.score.raw",
            "cmi.score.min": "cmi.core.score.min",
            "cmi.score.max": "cmi.core.score.max",
            "cmi.scaled_passing_score": "cmi.student_data.mastery_score",
            "cmi.max_time_allowed": "cmi.student_data.max_time_allowed",
            "cmi.time_limit_action": "cmi.student_data.time_limit_action",
            "cmi.learner_id": "cmi.core.student_id",
            "cmi.learner_name": "cmi.core.student_name",
            "cmi.session_time": "cmi.core.session_time",
            "cmi.total_time": "cmi.core.total_time",
            "cmi.suspend_data": "cmi.suspend_data",
            "cmi.launch_data": "cmi.launch_data"
        };

        if (mappings[n]) {
            name = mappings[n];
            if (n === 'cmi.exit' && v === 'normal') value = ''; // 1.2 doesn't have 'normal'
            return { name, ignore, value };
        }

        // Consolidated status
        if (n === 'cmi.success_status' || n === 'cmi.completion_status') {
            name = "cmi.core.lesson_status";
            // Local update of status
            if (v) this.API.data.completion_status = v;
            return { name, ignore, value };
        }

        // Unsupported/Ignored
        if (n.includes('comments_from_lms') ||
            n === 'cmi.score.scaled' ||
            n === 'cmi.progress_measure' ||
            n.includes('adl.nav')) {
            return { name, ignore: true };
        }

        return { name, ignore, value };
    }

    // --- Internal Helpers ---

    getLastErrorCode() {
        if (!this.API.path) return 0;
        return this.API.version === "1.2"
            ? parseInt(this.API.path.LMSGetLastError(), 10)
            : parseInt(this.API.path.GetLastError(), 10);
    }

    getLastErrorMessage(n) {
        if (!this.API.path) return "No LMS Connectivity";
        return this.API.version === "1.2"
            ? this.API.path.LMSGetErrorString(n.toString())
            : this.API.path.GetErrorString(n.toString());
    }

    getDiagnostic(n) {
        if (!this.API.path) return "No LMS Connectivity";
        return this.API.version === "1.2"
            ? this.API.path.LMSGetDiagnostic(n.toString())
            : this.API.path.GetDiagnostic(n.toString());
    }

    makeBoolean(str) {
        if (!str) return false;
        if (str === true || str === false) return Boolean(str);
        const s = String(str).toLowerCase();
        return (s === "true" || s === "yes" || s === "1");
    }

    // --- Time Utilities (Ported) ---

    ISODurationToCentisec(str) {
        // PT0H0M0S
        let h = 0, m = 0, s = 0;
        const duration = str.match(/^P(([0-9]+)Y)?(([0-9]+)M)?(([0-9]+)D)?(T(([0-9]+)H)?(([0-9]+)M)?(([0-9]+)(\.[0-9]+)?S)?)?$/);
        if (duration) {
            h = parseFloat(duration[9]) || 0;
            m = parseFloat(duration[11]) || 0;
            s = parseFloat(duration[13]) || 0;
            // Note: Year/Month/Day logic omitted for simple SCO sessions typically
        }
        return Math.round((h * 360000) + (m * 6000) + (s * 100));
    }

    centisecsToISODuration(n, bPrecise) {
        const nCs = Math.max(n, 0);
        let str = "P";
        // Simple implementation for common cases
        const nH = Math.floor(nCs / 360000);
        const remainderH = nCs % 360000;
        const nMin = Math.floor(remainderH / 6000);
        const remainderM = remainderH % 6000;
        const nSec = remainderM / 100;

        if (nH > 0 || nMin > 0 || nSec > 0) {
            str += "T";
            if (nH > 0) str += nH + "H";
            if (nMin > 0) str += nMin + "M";
            if (nSec > 0) str += nSec + "S";
        }
        if (str === "P") str = "PT0H0M0S";
        return str;
    }

    centisecsToSCORM12Duration(n) {
        // Format [HH]HH:MM:SS.SS
        const pad = (num) => (num < 10 ? '0' + num : num);
        let nH = Math.floor(n / 360000);
        let nCs = n - (nH * 360000);
        let nM = Math.floor(nCs / 6000);
        nCs = nCs - (nM * 6000);
        let nS = Math.floor(nCs / 100);
        nCs = Math.floor(nCs - (nS * 100));

        if (nH > 9999) nH = 9999;

        let str = ("0000" + nH).slice(-4) + ":"; // 4 digit hour allowed in 1.2? Standard usually says 2-4.
        str += pad(nM) + ":";
        str += pad(nS);
        if (nCs > 0) str += "." + pad(nCs);

        return str;
    }

    // Public Getters for internal state
    getMode() { return this.API.mode; }
    isActive() { return this.API.isActive; }
}
