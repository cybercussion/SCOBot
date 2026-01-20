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
            version: "5.1.0",
            createDate: "04/05/2011 08:56AM",
            modifiedDate: new Date().toISOString(),
            debug: false,
            isActive: false,
            throw_alerts: false,
            prefix: "SCOBotBase",
            exit_type: "",
            success_status: "",
            use_standalone: false,
            standalone: false,
            time_type: "UTC", // UTC, GMT, ""
            latency_arr: [],
            cmi: null // mocked data
        };

        this.settings = SCOBotUtil.extend(defaults, options);
        this.API = {
            path: null,
            version: "",
            mode: "",
            connection: false,
            isActive: false,
            data: {
                completion_status: "",
                success_status: "",
                exit_type: ""
            }
        };

        // Initialize immediately
        this.init();
    }

    // Debugging
    debug(msg, lvl) {
        if (this.settings.debug) {
            // Check for console support and levels
            if (!window.console) {
                // Fallback for ancient browsers? Unlikely needed in 2026 but keeping spirit
                window.status = msg;
                return;
            }
            switch (lvl) {
                case 1: console.error(msg); break;
                case 2: console.warn(msg); break;
                case 3: console.info(msg); break;
                case 4: console.log(msg); break;
                default: console.log(msg); break;
            }
        }
    }

    // Initialize Connection
    init() {
        // Search for LMS API
        let win;
        try {
            win = window.parent;
            if (win && win !== window) {
                this.findAPI(window.parent);
            }
        } catch (e) {
            this.debug(this.settings.prefix + " Possible Cross-domain issue/local mode (ignore).", 2);
        }

        if (!this.API.path) {
            try {
                win = window.top.opener;
                this.findAPI(win);
            } catch (ee) {
                this.debug(this.settings.prefix + " Possible Cross-domain issue/local mode (ignore).", 2);
            }
        }

        if (this.API.path) {
            this.API.connection = true;
            return true;
        }

        // Check current window (Self) - useful for testing or flattened environments
        this.findAPI(window);
        if (this.API.path) {
            this.API.connection = true;
            return true;
        }

        this.debug(this.settings.prefix + ": I was unable to locate an API for communication", 2);

        // Fallback for standalone / local mode
        setTimeout(() => {
            SCOBotUtil.triggerEvent(this, 'nolms', { msg: 'Could not locate Runtime API. Your data will not be persisted.' });
        }, 1000);

        if (this.settings.use_standalone) {
            this.debug(this.settings.prefix + ": Using Local_API_1484_11 to mimic LMS.", 4);
            this.settings.standalone = true;
            this.API.version = "2004";

            // mimic API
            this.API.path = new SCOBot_API_1484_11({ cmi: this.settings.cmi });
            this.API.connection = true;

            // Rebroadcast StoreData events from mock
            SCOBotUtil.addEvent(this.API.path, 'StoreData', (e) => {
                SCOBotUtil.triggerEvent(this, 'StoreData', e);
            });
            return true;
        }

        return false;
    }

    findAPI(win) {
        let attempts = 0;
        const limit = 500;

        const search = (windowObj, predicate) => {
            while (windowObj && windowObj.document) {
                if (predicate(windowObj)) return windowObj;
                attempts++;
                if (attempts > limit) return null;
                // Walk up
                if (windowObj === windowObj.parent) break;
                windowObj = windowObj.parent;
            } // end while
            return null;
        };

        // SCORM  2004
        let api = search(win, (w) => w.API_1484_11);
        if (api) {
            this.API.version = "2004";
            this.API.path = api.API_1484_11;
        } else {
            // SCORM 1.2
            attempts = 0;
            api = search(win, (w) => w.API);
            if (api) {
                this.API.version = "1.2";
                this.API.path = api.API;
            }
        }

        if (this.API.path) {
            this.debug(`${this.settings.prefix}: API Found. Version: ${this.API.version}`, 3);
        }
    }

    initialize() {
        this.debug(`${this.settings.prefix}: Initialize Called.`, 3);
        let success = false;

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

                const errorCode = this.getLastErrorCode();

                if (success && errorCode === 0) {
                    this.API.isActive = true;
                    // Sync initial status
                    this.API.data.completion_status = this.getvalue('cmi.completion_status');
                    this.settings.startDate = new Date();

                    this.debug(this.settings.prefix + ": SCO is initialized.", 3);

                    // Normalize "not attempted" or "unknown" to "incomplete" on start
                    switch (this.API.data.completion_status) {
                        case "not attempted":
                        case "unknown":
                            this.setvalue("cmi.completion_status", "incomplete");
                            break;
                        default:
                            if (this.API.data.completion_status === '') {
                                // triggerWarning logic?
                                console.warn("LMS Issue: Completion status empty");
                            }
                            break;
                    }
                    return 'true';
                }

                this.debug(`${this.settings.prefix}: Initialize Error ${errorCode}`, 1);
            } else {
                this.debug(this.settings.prefix + ": Aborted, LMS could not be located!.", 2);
            }
        } else {
            this.debug(this.settings.prefix + ": Aborted, connection already initialized!.", 2);
        }
        return 'false';
    }

    terminate() {
        let success = false;
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
                    this.debug(this.settings.prefix + ": Terminated.", 3);
                    SCOBotUtil.triggerEvent(this, 'terminated', {});
                    this.API.isActive = false;
                } else {
                    this.debug(`${this.settings.prefix}: Terminate Error ${this.getLastErrorCode()}`, 1);
                }
            } else {
                this.debug(this.settings.prefix + ": Lost connection to LMS", 2);
            }
        }
        return success;
    }

    commit() {
        let success = 'false';
        const sessionSecs = (new Date().getTime() - this.settings.startDate.getTime()) / 1000;

        if (this.API.isActive) {
            this.debug(this.settings.prefix + ": Committing data", 3);

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

            if (this.getLastErrorCode() === 0) return success;
            this.debug(`${this.settings.prefix}: Commit Error ${this.getLastErrorCode()}`, 1);
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
            "cmi.launch_data": "cmi.launch_data",
            // Learner Preferences
            "cmi.learner_preferences.audio_level": "cmi.student_preferences.audio",
            "cmi.learner_preferences.delivery_speed": "cmi.student_preferences.speed",
            "cmi.learner_preferences.language": "cmi.student_preferences.language",
            "cmi.learner_preferences.audio_captioning": "cmi.student_preferences.text",
            // Consolidated Status
            "cmi.success_status": "cmi.core.lesson_status",
            "cmi.completion_status": "cmi.core.lesson_status"
        };

        if (mappings[n]) {
            name = mappings[n];
            // Special Value Translations & Side Effects
            if (n === 'cmi.exit' && v === 'normal') value = ''; // 1.2 doesn't have 'normal'
            if (n === 'cmi.completion_status' && v) this.API.data.completion_status = v;
            if (n === 'cmi.success_status' && v) this.API.data.success_status = v;

            return { name, ignore, value };
        }

        // Unsupported/Ignored
        if (n.includes('comments_from_lms') ||
            n === 'cmi.score.scaled' ||
            n === 'cmi.progress_measure' ||
            n.includes('adl.nav')) {
            return { name, ignore: true };
        }

        // Dynamic Objectives Mapping
        if (n.indexOf("cmi.objectives.") === 0) {
            // Map success_status or completion_status back to just 'status'
            if (n.match(/\.(success_status|completion_status)$/)) {
                name = n.replace(/\.(success_status|completion_status)$/, ".status");
                if (v === 'unknown') value = "not attempted"; // 1.2 preference
                return { name, ignore, value };
            }
        }

        // Dynamic Interactions Mapping
        if (n.indexOf("cmi.interactions.") === 0) {
            if (n.endsWith(".timestamp")) name = n.replace(".timestamp", ".time");
            if (n.endsWith(".learner_response")) name = n.replace(".learner_response", ".student_response");
            if (n.endsWith(".result") && v === 'incorrect') value = "wrong";
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
        if (!this.API.path) return "";
        return this.API.version === "1.2"
            ? this.API.path.LMSGetErrorString(n.toString())
            : this.API.path.GetErrorString(n.toString());
    }

    getDiagnostic(n) {
        if (!this.API.path) return "";
        return this.API.version === "1.2"
            ? this.API.path.LMSGetDiagnostic(n.toString())
            : this.API.path.GetDiagnostic(n.toString());
    }

    makeBoolean(str) {
        if (str === undefined) return false;
        if (typeof str === 'boolean') return str;
        return (str === "true" || str === "1");
    }

    // --- Time / Math Helpers ---

    ISODurationToCentisec(str) {
        // Simple Parser for PT1H30M10S
        const match = str.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?/);
        if (!match) return 0;

        const hours = parseInt(match[4] || 0, 10);
        const minutes = parseInt(match[5] || 0, 10);
        const seconds = parseInt(match[6] || 0, 10);

        return ((hours * 3600) + (minutes * 60) + seconds) * 100;
    }

    centisecsToISODuration(n, bPrecise) {
        const str = "P" + "T" + ((n / 100) / 3600).toFixed(2) + "H"; // Rough implementation
        // Better implementation:
        let totalSeconds = Math.floor(n / 100);
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `PT${hours}H${minutes}M${seconds}S`;
    }

    centisecsToSCORM12Duration(n) {
        const pad = (num) => (num < 10 ? '0' + num : num);
        let totalSeconds = Math.floor(n / 100);
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        let sub = Math.round((n % 100)); // centiseconds

        // HHHH:MM:SS.SS
        let hStr = "0000" + hours;
        hStr = hStr.substr(hStr.length - 4);

        return `${hStr}:${pad(minutes)}:${pad(seconds)}.${pad(sub)}`;
    }

    isoDateToStringUTC(d) {
        return d.toISOString();
    }

    isoDateToString(d) {
        return d.toISOString(); // Close enough for modern, or use manual formatting if needed
    }

    isoStringToDate(str) {
        const MM = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        let d, uoffset, offset = 0, mil = 0, dd;

        switch (this.settings.time_type) {
            case "UTC":
                // 2026-01-20T...
                const utcdate = str.replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})((?:\.\d+)|)(Z|([+\-]\d{2}:\d{2}))/,
                    ($0, $Year, $Month, $Day, $Hour, $Min, $Sec, $Ms, $Offset) => {
                        let y = parseInt($Year, 10),
                            m = parseInt($Month, 10) - 1,
                            da = parseInt($Day, 10),
                            h = parseInt($Hour, 10),
                            mi = parseInt($Min, 10),
                            s = parseInt($Sec, 10),
                            ms = ($Ms && $Ms.length > 1) ? parseInt($Ms.substring(1), 10) : 0;

                        return Date.UTC(y, m, da, h, mi, s, ms);
                    }
                );
                return new Date(parseInt(utcdate, 10)); // Fixed to parse the logic result
            case "GMT":
                d = str.replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+\-]\d+:\d+)/,
                    ($0, $Year, $Month, $Day, $Hour, $Min, $Sec, $Ms, $Offset) => {
                        offset = parseInt($Offset.substring(1), 10) * 60;
                        mil = $Ms || 0;
                        return `${MM[$Month - 1]} ${$Day}, ${$Year} ${$Hour}:${$Min}:${$Sec}`;
                    }
                );
                dd = new Date(d);
                // Adjust for offset?
                return dd;
            default:
                d = str.replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
                    ($0, $Year, $Month, $Day, $Hour, $Min, $Sec) => {
                        return `${MM[$Month - 1]} ${$Day}, ${$Year} ${$Hour}:${$Min}:${$Sec}`;
                    }
                );
                return new Date(d);
        }
    }

    scorm12toMS(str) {
        // HHHH:MM:SS.SS
        const parts = str.match(/(\d+):(\d+):(\d+)(?:\.(\d+))?/);
        if (!parts) return 0;

        let h = parseInt(parts[1], 10) * 3600000;
        let m = parseInt(parts[2], 10) * 60000;
        let s = parseInt(parts[3], 10) * 1000;
        let ms = parts[4] ? parseInt(parts[4], 10) * 10 : 0; // .SS = centiseconds usually in SCORM 1.2

        return h + m + s + ms;
    }

    dateToscorm12Time(d) {
        // HH:MM:SS
        const dt = d || new Date();
        const pad = (n) => (n < 10 ? '0' + n : n);
        return `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    }

    // --- Legacy Public Helpers ---

    getObjectiveByID(id) {
        const countStr = this.getvalue("cmi.objectives._count");
        if (countStr === '' || countStr === 'false' || countStr === '-1') return 'false';

        let i = parseInt(countStr, 10) - 1;
        while (i >= 0) {
            const tID = this.getvalue(`cmi.objectives.${i}.id`);
            if (id === tID) {
                this.debug(`${this.settings.prefix}: Objective ID Match on ${i}`, 4);
                return i; // Returns index as number (or should it be string? legacy returned number)
            }
            i--;
        }
        return 'false';
    }

    getInteractionByID(id) {
        const countStr = this.getvalue("cmi.interactions._count");
        if (countStr === "" || countStr === 'false' || countStr === '-1') return 'false';

        if (this.API.version === "1.2") {
            this.debug(`${this.settings.prefix}: Developer, consider ignoring these requests if SB.getAPIVersion is equal to 1.2`, 2);
            return countStr; // SCORM 1.2 can't read interactions, returns count?
        }

        let i = parseInt(countStr, 10) - 1;
        this.debug(`${this.settings.prefix}: Getting interactions from count ${i}`, 4);

        while (i >= 0) {
            const tID = this.getvalue(`cmi.interactions.${i}.id`);
            if (id === tID) {
                this.debug(`${this.settings.prefix}: Interaction By ID Returning ${i}`);
                return i;
            }
            i--;
        }
        return 'false';
    }

    getInteractionObjectiveByID(n, id) {
        const countStr = this.getvalue(`cmi.interactions.${n}.objectives._count`);
        if (countStr === "" || countStr === 'false') return '0';

        if (this.API.version === "1.2") {
            this.debug(`${this.settings.prefix}: Developer, consider ignoring these requests if SB.getAPIVersion is equal to 1.2`, 2);
            return 'false';
        }

        let i = parseInt(countStr, 10) - 1;
        while (i >= 0) {
            const tID = this.getvalue(`cmi.interactions.${n}.objectives.${i}.id`);
            if (id === tID) {
                this.debug(`${this.settings.prefix}: Interaction Objective By ID Returning ${i}`);
                return i;
            }
            i--;
        }
        return 'false';
    }

    getInteractionCorrectResponsesByPattern(n, pattern) {
        const countStr = this.getvalue(`cmi.interactions.${n}.correct_responses._count`);
        if (countStr === "" || countStr === 'false') return '0';

        let i = parseInt(countStr, 10) - 1;
        while (i >= 0) {
            const p = this.getvalue(`cmi.interactions.${n}.correct_responses.${i}.pattern`);
            if (pattern === p) {
                this.debug(`${this.settings.prefix}: Interaction Correct Responses By Pattern Returning ${i}`);
                return "match";
            }
            i--;
        }
        return 'false';
    }

    getLastError() {
        const ec = this.getLastErrorCode();
        return {
            code: ec,
            msg: this.getLastErrorMessage(ec),
            diag: this.getDiagnostic(ec)
        };
    }

    isLMSConnected() {
        return this.API.connection;
    }

    checkLatency() {
        return SCOBotUtil.calcAverage(this.settings.latency_arr);
    }

    // Public Getters for internal state
    getMode() { return this.API.mode; }
    isActive() { return this.API.isActive; }
    isConnectionActive() { return this.API.isActive; }
    getAPIVersion() { return this.API.version; }
}
