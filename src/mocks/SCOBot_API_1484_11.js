/**
 * SCOBot API_1484_11 (Mock)
 * Mimics LMS Connectivity in Local Mode i.e. standalone functionality.
 * Modernized for ES6+ (2026) with localStorage persistence.
 *
 * @author Cybercussion Interactive, LLC
 * @license CC-BY-SA-4.0
 */

import SCOBotUtil from '../utils/SCOBotUtil.js';

export default class SCOBot_API_1484_11 {

    constructor(options = {}) {
        const defaults = {
            version: "5.0.0",
            createdate: "01/20/2026 08:15AM",
            moddate: new Date().toISOString(),
            prefix: "SCOBot_API_1484_11",
            errorCode: 0,
            diagnostic: '',
            initialized: 0,
            terminated: 0,
            cmi: null,
            adl: null,
            // CMI Defaults (SCORM 2004)
            CMI: {
                _version: "Local 1.0",
                comments_from_learner: { _children: "comment,location,timestamp", _count: "0" },
                comments_from_lms: { _children: "comment,location,timestamp", _count: "0" },
                completion_status: "unknown",
                completion_threshold: "0.7",
                credit: "no-credit",
                entry: "ab-initio",
                exit: "",
                interactions: {
                    _children: "id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description",
                    _count: "0"
                },
                launch_data: "?name1=value1&name2=value2&name3=value3",
                learner_id: "100",
                learner_name: "Simulated User",
                learner_preference: {
                    _children: "audio_level,language,delivery_speed,audio_captioning",
                    audio_level: "1",
                    language: "",
                    delivery_speed: "1",
                    audio_captioning: "0"
                },
                location: "",
                max_time_allowed: "",
                mode: "normal",
                objectives: {
                    _children: "id,score,success_status,completion_status,description",
                    _count: "0"
                },
                progress_measure: "",
                scaled_passing_score: "0.7",
                score: {
                    _children: "scaled,raw,min,max",
                    scaled: "",
                    raw: "",
                    min: "",
                    max: ""
                },
                session_time: "PT0H0M0S",
                success_status: "unknown",
                suspend_data: "",
                time_limit_action: "",
                total_time: "PT0H0M0S"
            },
            ADL: {
                nav: {
                    request: "_none_",
                    request_valid: {
                        choice: {},
                        continue: "false",
                        previous: "false"
                    }
                }
            }
        };

        this.settings = SCOBotUtil.extend(defaults, options);

        // Internal State
        this.cmi = {};
        this.adl = {};

        // Constants
        this.completion_status = "|completed|incomplete|not attempted|unknown|";
        this.read_only = "|_version|completion_threshold|credit|entry|launch_data|learner_id|learner_name|_children|_count|mode|maximum_time_allowed|scaled_passing_score|time_limit_action|total_time|comment|";
        this.write_only = "|exit|session_time|";
        this.exit = "|time-out|suspend|logout|normal||";
        this.nav_states = "|_none_|continue|previous|choice|exit|exitAll|abandon|abandonAll|suspendAll";

        this.errors = {
            0: "No error",
            101: "General exception",
            102: "General Initialization Failure",
            103: "Already Initialized",
            104: "Content Instance Terminated",
            111: "General Termination Failure",
            112: "Termination Before Initialization",
            113: "Termination After Termination",
            122: "Retrieve Data Before Initialization",
            123: "Retrieve Data After Termination",
            132: "Store Data Before Initialization",
            133: "Store Data After Termination",
            142: "Commit Before Initialization",
            143: "Commit After Termination",
            201: "General Argument Error",
            301: "General Get Failure",
            351: "General Set Failure",
            391: "General Commit Failure",
            401: "Undefined Data Model",
            402: "Unimplemented Data Model Element",
            403: "Data Model Element Value Not Initialized",
            404: "Data Model Element Is Read Only",
            405: "Data Model Element Is Write Only",
            406: "Data Model Element Type Mismatch",
            407: "Data Model Element Value Out Of Range",
            408: "Data Model Dependency Not Established"
        };
    }

    // --- Public API ---

    Initialize(str) {
        console.log(`${this.settings.prefix}: Initializing...`);

        // Check local storage for persistence
        const persisted = this._load();

        if (persisted) {
            console.log(`${this.settings.prefix}: Restoring persisted data...`);
            this.cmi = persisted.cmi;
            this.adl = persisted.adl;
            this.settings.cmi = this.cmi; // Update settings ref

            // Check Exit Type to determine Entry
            if (this.cmi.exit === "suspend") {
                this.cmi.entry = "resume";
            } else {
                this.cmi.entry = "ab-initio"; // Reset if not suspended? or keep? 
                // In generic SCORM, if you finished, you might get a new attempt (ab-initio)
                // For this mock, if you suspend, we resume. If you finished, we might want to reset or Review.
                if (this.cmi.completion_status === "completed" || this.cmi.success_status === "passed") {
                    // Optionally set mode to review? 
                    // this.cmi.mode = "review"; 
                }
            }

        } else {
            // Load Defaults
            this.cmi = this.settings.cmi || JSON.parse(JSON.stringify(this.settings.CMI)); // Deep copy defaults
            this.adl = this.settings.adl || JSON.parse(JSON.stringify(this.settings.ADL));
        }

        this.settings.initialized = 1;
        this.settings.terminated = 0;
        return 'true';
    }

    Terminate(str) {
        this.settings.terminated = 1;
        this.settings.initialized = 0;
        this._save(); // Auto-save on terminate
        return 'true';
    }

    GetValue(key) {
        this.settings.errorCode = 0;
        let r = "false";
        const k = String(key);

        if (!this.isRunning()) {
            this.settings.errorCode = 123;
            return r;
        }

        if (this.isWriteOnly(k)) {
            console.log(`${this.settings.prefix}: ${k} is write only`);
            this.settings.errorCode = 405;
            return "false";
        }

        const tiers = k.toLowerCase().split(".");
        switch (tiers[0]) {
            case "cmi":
                r = this._cmiGetValue(k);
                break;
            case "adl":
                r = this._adlGetValue(k);
                break;
        }

        if (r === "" || r === undefined) {
            this.settings.errorCode = 403;
            r = "false"; // Technically SCORM 2004 returns empty string for uninitialized, but we follow legacy logic here
            if (r === "") r = "";
        }

        return r;
    }

    SetValue(key, value) {
        this.settings.errorCode = 0;
        const k = String(key);
        const v = String(value);

        if (!this.isRunning()) {
            this.settings.errorCode = 132; // Store Data Before Init if 0, After Term if 1
            if (this.settings.terminated) this.settings.errorCode = 133;
            return "false";
        }

        if (this.isReadOnly(k)) {
            console.log(`${this.settings.prefix}: ${k} is read only`);
            this.settings.errorCode = 404; // Read Only
            return "false";
        }

        // Logic split by namespace
        const tiers = k.split(".");
        switch (tiers[0]) {
            case "cmi":
                return this._handleCMISet(tiers, k, v);
            case "adl":
                return this._handleADLSet(tiers, k, v);
        }

        return "false";
    }

    Commit(str) {
        console.log(`${this.settings.prefix}: Commit called.`);
        this._save();

        SCOBotUtil.triggerEvent(this, 'StoreData', {
            name: 'StoreData',
            runtimedata: this.cmi,
            sequence: this.adl
        });

        return 'true';
    }

    GetLastError() { return this.settings.errorCode; }
    GetErrorString(n) { return this.errors[n] || ""; }
    GetDiagnostic(n) { return this.settings.diagnostic; }

    // --- Private Helpers ---

    isRunning() {
        return this.settings.initialized === 1 && this.settings.terminated === 0;
    }

    _load() {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('SCOBot_Mock_Data');
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch (e) { console.error("Error parsing stored data", e); }
            }
        }
        return null;
    }

    _save() {
        if (typeof localStorage !== 'undefined') {
            const payload = {
                cmi: this.cmi,
                adl: this.adl,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('SCOBot_Mock_Data', JSON.stringify(payload));
        }
    }

    _cmiGetValue(key) {
        switch (key) {
            case "cmi.exit":
            case "cmi.session_time":
                this.settings.errorCode = 405; // Write Only
                return "false";
            default:
                return this._getData(key.substr(4), this.cmi);
        }
    }

    _adlGetValue(key) {
        if (key.indexOf('adl.nav.request_valid.choice') >= 0) {
            this.settings.errorCode = 301;
            return "false";
        }
        return this._getData(key.substr(4), this.adl);
    }

    _getData(key, obj) {
        const parts = key.split(".");
        if (parts.length < 2) {
            const val = obj[parts[0]];
            return (val !== undefined) ? String(val) : "false"; // or undefined handling
        } else {
            const head = parts.shift();
            if (obj[head]) {
                return this._getData(parts.join("."), obj[head]);
            }
            this.settings.errorCode = 401; // Undefined Data Model
            return "false";
        }
    }

    _setData(key, val, obj) {
        const parts = key.split(".");
        if (parts.length < 2) {
            obj[parts[0]] = val;
        } else {
            const head = parts.shift();
            if (!obj[head]) obj[head] = {};
            this._setData(parts.join("."), val, obj[head]);
        }
    }

    _handleCMISet(tiers, key, value) {
        // Basic Validation
        if (key === "cmi.completion_status" && this.completion_status.indexOf(`|${value}|`) === -1) return this._throwVocabError(key, value);
        if (key === "cmi.exit" && this.exit.indexOf(`|${value}|`) === -1) return this._throwVocabError(key, value);

        // Deep Dive for Interactions/Objectives creation logic
        if (tiers[1] === "comments_from_learner") {
            // Logic to update _count? 
            // Simplified: Just set data
            this._setData(key.substr(4), value, this.cmi);
            return 'true';
        }

        // Object Array Logic (Interactions/Objectives)
        if (tiers[1] === "interactions" || tiers[1] === "objectives") {
            const index = parseInt(tiers[2], 10);
            if (!isNaN(index)) {
                if (tiers[3] === "id") {
                    // Init object if missing
                    if (!this.cmi[tiers[1]][index]) {
                        this.cmi[tiers[1]][index] = {};
                        // Update _count
                        const currentCount = parseInt(this.cmi[tiers[1]]._count, 10);
                        if (index >= currentCount) {
                            this.cmi[tiers[1]]._count = String(index + 1);
                        }
                    }
                }
                // Ensure target exists
                if (!this.cmi[tiers[1]][index]) {
                    // Start of new object without setting ID first is technically not allowed by strict SCOBot logic usually
                    // But if we are forgiving:
                    this.cmi[tiers[1]][index] = {};
                    const currentCount = parseInt(this.cmi[tiers[1]]._count, 10);
                    if (index >= currentCount) {
                        this.cmi[tiers[1]]._count = String(index + 1);
                    }
                }
            }
        }

        // Default Set
        this._setData(key.substr(4), value, this.cmi);
        return 'true';
    }

    _handleADLSet(tiers, key, value) {
        if (key === "adl.nav.request") {
            if (this.nav_states.indexOf(`|${value}|`) === -1) {
                this.settings.errorCode = 406;
                return 'false';
            }
        }
        this._setData(key.substr(4), value, this.adl);
        return 'true';
    }

    isReadOnly(key) {
        const tiers = key.split('.');
        const v = tiers[tiers.length - 1];
        if (tiers[2] === "request_valid" || tiers[4] === 'id') return true;
        if (tiers[1] === 'comments_from_lms') return true;
        if (tiers[1] === 'comments_from_learner') return false;
        return this.read_only.indexOf('|' + v + '|') >= 0;
    }

    isWriteOnly(key) {
        const tiers = key.split(".");
        const v = tiers[tiers.length - 1];
        return this.write_only.indexOf('|' + v + '|') >= 0;
    }

    _throwVocabError(k, v) {
        this.settings.errorCode = 406;
        this.settings.diagnostic = `Value ${v} is not allowed for ${k}`;
        return 'false';
    }
}