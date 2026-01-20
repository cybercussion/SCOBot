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
            version: "5.1.0",
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
            if (this.cmi.comments_from_learner._children.indexOf(tiers[3]) === -1) {
                return this._throwVocabError(key, value);
            }
            this._setData(key.substr(4), value, this.cmi);
            // Count logic: objects length - 2 (_children, _count)
            this.cmi.comments_from_learner._count = String(this._getObjLength(this.cmi.comments_from_learner) - 2);
            return 'true';
        }

        // Object Array Logic (Interactions/Objectives)
        if (tiers[1] === "interactions") {
            if (this.cmi.interactions._children.indexOf(tiers[3]) === -1) {
                return this._throwVocabError(key, value);
            }

            const index = parseInt(tiers[2], 10);
            if (isNaN(index)) return 'false';

            // Check if interaction exists
            if (!this.cmi.interactions[index]) {
                // STRICT: Must be setting ID to create new interaction
                if (tiers[3] === "id") {
                    this.cmi.interactions[index] = {};
                    this._setData(key.substr(4), value, this.cmi); // Set ID

                    // Initialize Containers
                    console.log(`${this.settings.prefix}: Constructing objectives/correct_responses for new interaction`);
                    this.cmi.interactions[index].objectives = { _count: "-1" };
                    this.cmi.interactions[index].correct_responses = { _count: "-1" };

                    // Update main count
                    this.cmi.interactions._count = String(this._getObjLength(this.cmi.interactions) - 2);
                    return 'true';
                } else {
                    console.warn("Can't add interaction without ID first!");
                    this.settings.errorCode = 408; // Dependency not established
                    return 'false';
                }
            }

            // Handle Interaction Sub-Structures

            // 1. Objectives (cmi.interactions.n.objectives.m.id)
            if (tiers[3] === 'objectives') {
                const m = parseInt(tiers[4], 10);
                if (isNaN(m)) return 'false';

                if (tiers[5] === 'id') {
                    // Check Uniqueness
                    const count = parseInt(this.cmi.interactions[index].objectives._count, 10); // currently technically -1 if empty
                    // The count logic in original was _count based.
                    // If _count is -1, loop 0 times. 
                    // Realistically we iterate existing keys.

                    // Iterate existing to check for duplicate ID
                    const objs = this.cmi.interactions[index].objectives;
                    for (let z in objs) {
                        if (objs.hasOwnProperty(z) && objs[z].id === value) {
                            return this._throwGeneralSetError(key, value, z);
                        }
                    }
                } else {
                    // Validation: If not setting ID, ensure object exists
                    if (!this.cmi.interactions[index].objectives[m]) {
                        this.settings.errorCode = 408; // Dependency
                        return 'false';
                    }
                }

                this._setData(key.substr(4), value, this.cmi);

                // Update objectives count
                // Note: Original code logic for count was specific: (length - 1) because only _count exists initially?
                // If we have { _count: "-1", "0": {...} }, length is 2. 2-1 = 1. Correct count is 0?
                // Wait, strict mode says count is 0-based index or actual count? SCORM is actual count.
                // Original: (getObjLength(obj) - 1).toString(); 
                this.cmi.interactions[index].objectives._count = String(this._getObjLength(this.cmi.interactions[index].objectives) - 1);
                return 'true';
            }

            // 2. Correct Responses
            if (tiers[3] === 'correct_responses') {
                this._setData(key.substr(4), value, this.cmi);
                this.cmi.interactions[index].correct_responses._count = String(this._getObjLength(this.cmi.interactions[index].correct_responses) - 1);
                return 'true';
            }

            // Default Set for Interaction
            this._setData(key.substr(4), value, this.cmi);
            this.cmi.interactions._count = String(this._getObjLength(this.cmi.interactions) - 2);
            return 'true';
        }

        if (tiers[1] === "objectives") {
            const index = parseInt(tiers[2], 10);
            if (isNaN(index)) return 'false';

            if (tiers[3] === "id") {
                // Check Uniqueness
                for (let z in this.cmi.objectives) {
                    if (this.cmi.objectives[z] && this.cmi.objectives[z].id === value) {
                        return this._throwGeneralSetError(key, value, z);
                    }
                }
            } else {
                // If not setting ID, ensure exists
                if (!this.cmi.objectives[index]) {
                    this.settings.errorCode = 408;
                    this.settings.diagnostic = "The objectives.id element must be set before other elements can be set";
                    return 'false';
                }
            }

            this._setData(key.substr(4), value, this.cmi);
            this.cmi.objectives._count = String(this._getObjLength(this.cmi.objectives) - 2);
            return 'true';
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

    _throwGeneralSetError(k, v, o) {
        this.settings.errorCode = 351;
        this.settings.diagnostic = `The ${k} element must be unique. The value '${v}' has already been set in #${o}`;
        return 'false';
    }

    _getObjLength(obj) {
        let length = 0;
        for (let name in obj) {
            if (obj.hasOwnProperty(name)) {
                length += 1;
            }
        }
        return length;
    }
}