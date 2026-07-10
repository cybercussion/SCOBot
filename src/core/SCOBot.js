/**
 * SCOBot
 * Modernized for ES6+ (2026)
 *
 * @author Cybercussion Interactive, LLC
 * @license CC-BY-SA-4.0
 */

import SCOBotBase from '../connector/SCOBotBase.js';
import SCOBotUtil from '../utils/SCOBotUtil.js';
import LZString from 'lz-string';

export default class SCOBot extends SCOBotBase {

    constructor(options = {}) {
        // Initialize Base with options
        super(options);

        // SCOBot specifics
        const scoBotDefaults = {
            version: "5.1.0",
            launch_data: {},
            interaction_mode: "state", // or journaled
            launch_data_type: "querystring", // or json
            initiate_timer: true,
            scorm_strict: true,
            scorm_edition: "3rd",
            scorm_status_persist: "success_status",
            useJSONSuspendData: true,
            suspend_data: { pages: [] },
            base64: false, // Legacy flag, we might use compression now
            compression: false, // New flag for LZString
            happyEnding: true,
            doNotStatusUntilFinish: false,
            sequencing: {
                nav: { request: '_none_' }
            },
            location: "",
            mode: "",
            scaled_passing_score: 0.7,
            completion_threshold: 0,
            max_time_allowed: "",
            totalInteractions: 0,
            totalObjectives: 0,
            startTime: 0
        };

        // Merge defaults
        this.settings = SCOBotUtil.extend(this.settings, scoBotDefaults, options);

        // Internal State Buffer
        this.buffer = {
            success_status: "",
            completion_status: "",
            completion_threshold: this.settings.completion_threshold,
            progress_measure: "0",
            scaled_passing_score: this.settings.scaled_passing_score,
            score: {
                scaled: "0",
                raw: "0",
                min: "0",
                max: "0"
            }
        };

        this.isStarted = false;
        this.happyEndingRequest = false;
        this.SCOBotManagedStatus = false;

        // Auto-Initialize handling
        if (typeof window !== 'undefined') {
            SCOBotUtil.addEvent(window, 'loaded', () => this.initSCO());
            SCOBotUtil.addEvent(window, 'beforeunload', () => this.exitSCO());
            SCOBotUtil.addEvent(window, 'unload', () => this.exitSCO());
        }

        // Listen for base exceptions
        SCOBotUtil.addEvent(this, 'exception', (e) => {
            // Re-trigger or handle?
            // console.error("SCOBot Exception:", e.error);
        });
    }

    // --- Lifecycle Methods ---

    initSCO() {
        const connected = this.initialize(); // returns string 'true'/'false'
        this.debug(`${this.settings.prefix}: SCO Loaded. Connected: ${connected}`, 4);

        if (this.makeBoolean(connected)) {
            this.start();
            SCOBotUtil.triggerEvent(this, "load");
        } else {
            const msg = `Sorry, unable to initialize the SCORM Runtime API. Returned: ${connected}`;
            this.debug(`${this.settings.prefix} ${msg}`);
            SCOBotUtil.triggerEvent(this, "exception", { error: msg });
        }
        return connected;
    }

    start() {
        this.debug(`${this.settings.prefix}: Starting...`, 3);

        if (this.isStarted) {
            this.debug(`${this.settings.prefix}: Already started.`, 2);
            return false;
        }

        this.isStarted = true;
        this.settings.startTime = new Date().getTime();

        // 1. Launch Data
        let tmpLaunchData = this.getvalue('cmi.launch_data');
        if (this.settings.launch_data_type === "json") {
            try {
                this.settings.launch_data = JSON.parse(tmpLaunchData);
            } catch (e) { this.settings.launch_data = {}; }
        } else {
            // Parse Query String style
            tmpLaunchData.replace(
                new RegExp("([^?=&]+)(=([^&]*))?", "g"),
                ($0, $1, $2, $3) => {
                    this.settings.launch_data[$1] = $3;
                }
            );
        }

        this.settings.mode = this.getvalue('cmi.mode');
        this.settings.entry = this.getvalue('cmi.entry');

        // 2. Resume / Suspend Data
        if (this.settings.mode === "review" || this.settings.entry === '' || this.settings.entry === 'resume') {
            this.debug(`${this.settings.prefix}: Resuming...`, 4);
            this.settings.location = this.getvalue('cmi.location');

            let rawSuspendData = this.getvalue('cmi.suspend_data');

            // Decryption / Decompression
            try {
                if (this.settings.compression) {
                    rawSuspendData = LZString.decompressFromEncodedURIComponent(rawSuspendData) || "";
                } else if (this.settings.base64) {
                    rawSuspendData = decodeURIComponent(window.atob(rawSuspendData));
                } else {
                    rawSuspendData = decodeURIComponent(rawSuspendData);
                }
            } catch (e) {
                this.debug("Error decoding suspend data", 1);
            }

            if (rawSuspendData && rawSuspendData !== 'undefined') {
                try {
                    this.settings.suspend_data = this.settings.useJSONSuspendData ? JSON.parse(rawSuspendData) : rawSuspendData;
                    SCOBotUtil.triggerEvent(this, 'resume', { suspend_data: this.settings.suspend_data });
                    if (this.settings.entry === "") this.settings.entry = "resume";
                } catch (e) {
                    this.debug("Error parsing suspend data JSON", 1);
                    this.settings.suspend_data = { pages: [] };
                }
            } else {
                this.settings.suspend_data = { pages: [] };
            }
        } else {
            // First time
            this.settings.suspend_data = { pages: [] };
        }

        // 3. Thresholds & Scores
        const tmpCompletionThreshold = this.getvalue('cmi.completion_threshold');
        if (tmpCompletionThreshold && tmpCompletionThreshold !== 'false' && tmpCompletionThreshold !== "-1") {
            this.buffer.completion_threshold = tmpCompletionThreshold;
        }

        const tmpScaledPassingScore = this.getvalue('cmi.scaled_passing_score');
        if (tmpScaledPassingScore && tmpScaledPassingScore !== 'false' && tmpScaledPassingScore !== "-1") {
            // Sanity check for 1.2 legacy issues where it might be > 1
            if (parseFloat(tmpScaledPassingScore) > 1) {
                this.buffer.scaled_passing_score = '' + ((parseFloat(tmpScaledPassingScore) * 10) / 1000);
            } else {
                this.settings.scaled_passing_score = tmpScaledPassingScore;
            }
        }

        // 4. Initial Status Sync
        this.buffer.completion_status = this.getvalue('cmi.completion_status');
        this.buffer.success_status = this.getvalue('cmi.success_status');

        // 5. Comments
        this.settings.comments_from_lms = this.getCommentsFromLMS();
        if (this.settings.comments_from_lms !== 'false') {
            SCOBotUtil.triggerEvent(this, 'comments_lms', { data: this.settings.comments_from_lms });
        }

        // 6. Max Time
        this.settings.max_time_allowed = this.getvalue('cmi.max_time_allowed');
        // TODO: Time limit implementation (startTimer)

        return true;
    }

    exitSCO() {
        this.debug(`${this.settings.prefix}: Unloading/Exiting...`, 3);
        if (this.isActive) {
            SCOBotUtil.triggerEvent(this, "unload");
            switch (this.settings.exit_type) {
                case "finish": this.finish(); break;
                case "suspend": this.suspend(); break;
                case "timeout": this.timeout(); break;
                default: this.suspend(); break; // Default to suspend safety
            }
        }
    }

    // --- State Management ---

    finish() {
        if (this.isActive) {
            if (this.settings.sequencing.nav.request !== "_none_") {
                this.setvalue('adl.nav.request', this.settings.sequencing.nav.request);
            }
            this.setvalue('cmi.exit', 'normal');
            this.updateStatus(true);
            this.isStarted = false;
            return this.terminate();
        }
        return 'false';
    }

    suspend() {
        if (this.isActive) {
            this.debug(`${this.settings.prefix}: Suspending...`, 3);
            this.setvalue('cmi.exit', 'suspend');
            this.isStarted = false;
            return this.terminate();
        }
        return 'false';
    }

    timeout() {
        if (this.isActive) {
            this.debug(`${this.settings.prefix}: Timing out...`, 3);
            this.setvalue('cmi.exit', 'time-out');
            this.updateStatus(true);
            this.isStarted = false;
            return this.terminate();
        }
        return 'false';
    }

    updateStatus(ending) {
        if (ending && this.SCOBotManagedStatus) {
            if (this.settings.doNotStatusUntilFinish) {
                this.setvalue('cmi.score.raw', this.buffer.score.raw);
                this.setvalue('cmi.score.scaled', this.buffer.score.scaled);
                this.setvalue('cmi.progress_measure', this.buffer.progress_measure);
                this.setvalue('cmi.completion_status', this.buffer.completion_status);
                return this.setvalue('cmi.success_status', this.buffer.success_status);
            }
        }

        if (!this.happyEndingRequest) {
            const ss = 'cmi.success_status';
            const cs = 'cmi.completion_status';
            const defss = this.settings.success_status;
            const defcs = this.settings.completion_status;

            const storss = this.getvalue(ss);
            const storcs = this.getvalue(cs);

            const isSuccessSet = (storss === "passed" || storss === "failed");
            const isCompletionSet = (storcs === "completed" || storcs === "incomplete");

            if (this.settings.exit_type === 'finish' || ending) {
                if (!isSuccessSet && storss !== defss) {
                    this.setvalue(ss, defss);
                }

                // Completion logic
                if (this.getAPIVersion() === "1.2" && this.settings.scorm_status_persist === "completion_status" && !isCompletionSet) {
                    this.setvalue(cs, defcs);
                } else {
                    if (!isCompletionSet && storcs !== defcs) {
                        this.setvalue(cs, defcs);
                    }
                }
            }
        }
    }

    // --- Internal Helpers ---

    isBadValue(v) {
        return "|null|undefined|false|NaN|| |".indexOf('|' + v + '|') >= 0;
    }

    trueRound(v, dec) {
        const num = parseFloat(v); // ensure number
        return parseFloat(num.toPrecision(dec));
    }

    findResponseType(type, str) {
        let reg;
        switch (type) {
            case "order_matters":
                reg = /^\{order_matters=.*?\}/;
                break;
            case "case_matters":
                reg = /^\{case_matters=.*?\}/;
                break;
            case "lang":
                reg = /^\{lang=.*?\}/;
                break;
            default:
                this.debug(`${this.settings.prefix}: Sorry, this is not a valid Response type.`, 1);
                break;
        }
        return reg.exec(str);
    }

    isISO8601Duration(v) {
        const iso8601Dur = /^(?:P)([^T]*)(?:T)?(.*)?$/;
        return iso8601Dur.test(v);
    }

    // --- Data Helpers ---

    setSuspendData() {
        // Prepare data
        let cleaned = JSON.stringify(this.settings.suspend_data);
        // We previously "cleansed" chars here, but with LZString/Base64 it's safer.

        let dataToSet = cleaned;
        if (this.settings.compression) {
            dataToSet = LZString.compressToEncodedURIComponent(cleaned);
        } else if (this.settings.base64) {
            dataToSet = window.btoa(encodeURIComponent(cleaned));
        } else {
            dataToSet = encodeURIComponent(cleaned);
        }

        const result = this.setvalue('cmi.suspend_data', dataToSet);
        if (result === 'true') {
            this.debug(`${this.settings.prefix}: Suspend Data saved`, 4);
        }
        return result;
    }

    setSuspendDataByPageID(id, title, data) {
        if (this.isConnectionActive()) {
            const pages = this.settings.suspend_data.pages;
            const existingIndex = pages.findIndex(p => p.id === id);

            if (existingIndex > -1) {
                pages[existingIndex].data = data;
            } else {
                pages.push({ id, title, data });
            }

            return this.setSuspendData();
        }
        return 'false';
    }

    getSuspendDataByPageID(id) {
        if (this.isConnectionActive()) {
            const page = this.settings.suspend_data.pages.find(p => p.id === id);
            return page ? page.data : 'false';
        }
        return 'false';
    }

    // --- Bookmarking ---

    /**
     * Set Bookmark (classic Content API): stores the resume location.
     * SCORM 2004 allows up to 1000 chars; 1.2 allows 255.
     * @param {String} v Location value (e.g. a page id or index)
     * @returns {String} 'true' or 'false'
     */
    setBookmark(v) {
        if (this.isConnectionActive()) {
            this.settings.location = '' + v;
            return this.setvalue('cmi.location', this.settings.location);
        }
        return 'false';
    }

    /**
     * Get Bookmark (classic Content API)
     * @returns {String} stored cmi.location ('' when unset), or 'false' if not connected
     */
    getBookmark() {
        if (this.isConnectionActive()) {
            const value = this.getvalue('cmi.location');
            // Convert 'false' (not set) to empty string
            return value === 'false' ? '' : value;
        }
        return 'false';
    }

    /**
     * Get Entry (classic Content API): '' | 'ab-initio' | 'resume', captured by start().
     * @returns {String}
     */
    getEntry() {
        return this.settings.entry;
    }

    /**
     * Get Seconds From Start (classic Content API).
     * NOTE: the 4.x original returned startTime - now (negative); corrected here.
     * @returns {Number} elapsed seconds since start(), rounded to 2 places
     */
    getSecondsFromStart() {
        return this.trueRound((new Date().getTime() - this.settings.startTime) / 1000, 2);
    }

    getCommentsFromLMS() {
        if (this.isConnectionActive()) {
            const countStr = this.getvalue("cmi.comments_from_lms._count");
            const count = parseInt(countStr, 10);

            if (isNaN(count)) return 'false';

            const comments = [];
            for (let i = 0; i < count; i++) {
                comments.push({
                    comment: this.getvalue(`cmi.comments_from_lms.${i}.comment`),
                    location: this.getvalue(`cmi.comments_from_lms.${i}.location`),
                    timestamp: this.getvalue(`cmi.comments_from_lms.${i}.timestamp`)
                });
            }
            return comments;
        }
        return 'false';
    }

    getCommentsFromLearner() {
        if (this.isConnectionActive()) {
            const countStr = this.getvalue("cmi.comments_from_learner._count");
            const count = parseInt(countStr, 10);

            if (isNaN(count) || count === 0) return [];

            const comments = [];
            for (let i = 0; i < count; i++) {
                comments.push({
                    comment: this.getvalue(`cmi.comments_from_learner.${i}.comment`),
                    location: this.getvalue(`cmi.comments_from_learner.${i}.location`),
                    timestamp: this.getvalue(`cmi.comments_from_learner.${i}.timestamp`)
                });
            }
            return comments;
        }
        return 'false';
    }

    addLearnerComment(comment, location = '') {
        if (this.isConnectionActive()) {
            const countStr = this.getvalue("cmi.comments_from_learner._count");
            const count = parseInt(countStr, 10) || 0;
            
            const timestamp = new Date().toISOString();
            
            this.setvalue(`cmi.comments_from_learner.${count}.comment`, comment);
            this.setvalue(`cmi.comments_from_learner.${count}.timestamp`, timestamp);
            
            if (location) {
                this.setvalue(`cmi.comments_from_learner.${count}.location`, location);
            }
            
            return 'true';
        }
        return 'false';
    }

    // --- Interaction & Objective Helpers ---

    gradeIt() {
        let scoreScaled = 1;
        const scoreRaw = parseFloat(this.getvalue('cmi.score.raw'));
        const scoreMin = parseFloat(this.getvalue('cmi.score.min'));
        const scoreMax = parseFloat(this.getvalue('cmi.score.max'));

        if ((scoreMax - scoreMin) !== 0) {
            scoreScaled = ((scoreRaw - scoreMin) / (scoreMax - scoreMin));
            this.setvalue('cmi.score.scaled', scoreScaled.toFixed(7));
        } else {
            this.setvalue('cmi.score.scaled', 1);
        }

        // Completion
        if (this.buffer.completion_status !== "completed") {
            // Logic check
            this.buffer.completion_status = 'completed'; // simplified
            this.setvalue('cmi.completion_status', 'completed');
        }

        // Success
        if (this.buffer.success_status !== "passed") {
            this.buffer.success_status = (scoreScaled >= parseFloat(this.buffer.scaled_passing_score)) ? 'passed' : 'failed';
        }
        this.setvalue('cmi.success_status', this.buffer.success_status);

        return 'true';
    }

    // --- Interaction Encoding ---

    encodeInteractionType(type, val) {
        let value = val;
        let str = '';
        let str2 = '';
        let i = 0;
        let arr = [];
        let arr2 = [];
        let len;
        let index;

        switch (type) {
            case 'true-false':
                value = value.toString().toLowerCase();
                if (value === 'true' || value === 'false') {
                    if (this.getAPIVersion() === "1.2") {
                        return value.substring(0, 1); // t or f
                    }
                    return value;
                }
                this.debug(`${this.settings.prefix}: Invalid true-false value: ${value}`, 1);
                return '';

            case 'choice':
                if (this.getAPIVersion() === "1.2") {
                    if (Array.isArray(value)) {
                        return value.join(",");
                    }
                    this.debug(`${this.settings.prefix}: Invalid choice array: ${value}`, 1);
                    value = '';
                }
            /* falls through */
            case 'sequencing':
                if (Array.isArray(value)) {
                    // Validation could go here (length limit etc)
                    if (this.getAPIVersion() === "1.2") {
                        return value.join(",");
                    }
                    return value.join("[,]");
                }
                this.debug(`${this.settings.prefix}: Invalid sequencing/choice array`, 1);
                return '';

            case 'fill-in':
                if (SCOBotUtil.isPlainObject(value)) {
                    if (value.case_matters !== undefined) str += `{case_matters=${value.case_matters}}`;
                    if (value.order_matters !== undefined) str += `{order_matters=${value.order_matters}}`;
                    if (value.lang !== undefined) str += `{lang=${value.lang}}`;

                    if (Array.isArray(value.words)) {
                        str += value.words.join("[,]");
                    }
                    return str;
                }
                return '';

            case 'long-fill-in':
                if (SCOBotUtil.isPlainObject(value)) {
                    if (value.case_matters !== undefined) str += `{case_matters=${value.case_matters}}`;
                    if (value.lang !== undefined) str += `{lang=${value.lang}}`;
                    str += value.text;
                    return str;
                }
                return '';

            case 'matching':
                // 1.2: source.target,source.target
                // 2004: source[.]target[,]source[.]target
                if (Array.isArray(value)) {
                    len = value.length;
                    for (i = 0; i < len; i++) {
                        if (Array.isArray(value[i])) {
                            arr.push(this.getAPIVersion() === "1.2" ? value[i].join(".") : value[i].join("[.]"));
                        }
                    }
                    return this.getAPIVersion() === "1.2" ? arr.join(",") : arr.join("[,]");
                }
                return '';

            case 'performance':
                // Complex type, typically array of arrays [[step, value], [step, value]]
                // Or Correct Response Pattern Object
                if (!Array.isArray(value)) {
                    // Expect Object (Correct Response Pattern)
                    if (value.order_matters !== undefined) str += `{order_matters=${value.order_matters}}`;

                    if (Array.isArray(value.answers)) {
                        len = value.answers.length;
                        for (i = 0; i < len; i++) {
                            if (Array.isArray(value.answers[i])) {
                                // numeric range inside performance?
                                if (SCOBotUtil.isPlainObject(value.answers[i][1])) {
                                    // {min: x, max: y} -> x[:]y
                                    const min = this.trueRound(value.answers[i][1].min, 7);
                                    const max = this.trueRound(value.answers[i][1].max, 7);
                                    value.answers[i][1] = `${min}[:]${max}`;
                                }
                                arr.push(value.answers[i].join("[.]"));
                            }
                        }
                        return str + arr.join("[,]");
                    }
                } else {
                    // Learner Response (Array)
                    len = value.length;
                    for (i = 0; i < len; i++) {
                        if (Array.isArray(value[i])) {
                            arr.push(value[i].join("[.]"));
                        }
                    }
                    return arr.join("[,]");
                }
                return '';

            case 'numeric':
                if (typeof value === "number") return '' + value;
                if (SCOBotUtil.isPlainObject(value)) {
                    // {min: x, max: y} -> x[:]y
                    const min = this.trueRound(value.min, 7);
                    const max = this.trueRound(value.max, 7);
                    return `${min}[:]${max}`;
                }
                return value;

            case 'likert':
            case 'other':
                return '' + value;

            default:
                return '';
        }
    }

    decodeInteractionType(type, val) {
        let value = val;
        let arr = [];
        let obj = {};
        let len;
        let i;

        switch (type) {
            case 'true-false':
                if (this.getAPIVersion() === "1.2") {
                    return value === "t" ? "true" : "false";
                }
                return value;

            case 'choice':
            case 'sequencing':
                return value.split("[,]");

            case 'fill-in':
                // Decode meta tags
                let arrMeta = this.findResponseType('case_matters', value);
                if (arrMeta) {
                    obj.case_matters = arrMeta[0].substring(14, arrMeta[0].length - 1);
                    value = value.replace(arrMeta[0], '');
                }
                arrMeta = this.findResponseType('order_matters', value);
                if (arrMeta) {
                    obj.order_matters = arrMeta[0].substring(15, arrMeta[0].length - 1);
                    value = value.replace(arrMeta[0], '');
                }
                arrMeta = this.findResponseType('lang', value);
                if (arrMeta) {
                    obj.lang = arrMeta[0].substring(6, arrMeta[0].length - 1);
                    value = value.replace(arrMeta[0], '');
                }
                obj.words = value.split("[,]");
                return obj;

            case 'matching':
                arr = value.split("[,]");
                for (i = 0; i < arr.length; i++) {
                    arr[i] = arr[i].split("[.]");
                }
                return arr;

            case 'performance':
                // Check order matters
                let arrMatch = this.findResponseType('order_matters', value);
                let match = false;
                if (arrMatch) {
                    match = true;
                    obj.order_matters = arrMatch[0].substring(15, arrMatch[0].length - 1);
                    value = value.replace(arrMatch[0], '');
                }
                arr = value.split("[,]");
                for (i = 0; i < arr.length; i++) {
                    arr[i] = arr[i].split("[.]");
                }
                if (match) {
                    obj.answers = arr;
                    return obj;
                }
                return arr;

            default:
                return value;
        }
    }

    // --- Interaction & Objective Helpers ---

    setInteraction(data) {
        if (this.isConnectionActive()) {
            const version = this.getAPIVersion();
            let n; // Interaction count
            let m; // Objective count
            let i; // Objective loop
            let j; // Correct response loop
            let p; // Correct response pattern count
            let p1 = 'cmi.interactions.';
            let p2; // _count string helper
            let result = 'false';

            // Validate Data Object
            if (!SCOBotUtil.isPlainObject(data)) {
                this.debug(`${this.settings.prefix}: Developer, you're not passing a {object} argument!!`, 1);
                return 'false';
            }
            if (this.isBadValue(data.id)) {
                this.debug(`${this.settings.prefix}: Developer, you're passing a interaction without a ID`, 1);
                return 'false';
            }

            // Convert String Timestamp to Date if needed
            if (typeof data.timestamp === 'string') {
                // Try native parse first
                const d = new Date(data.timestamp);
                if (!isNaN(d.getTime())) {
                    data.timestamp = d;
                } else {
                    // Fallback to internal parser (SCORM 1.2 or specific formats)
                    data.timestamp = this.isoStringToDate(data.timestamp);
                }
            }

            // Timestamp / Latency Handling
            // Need original timestamp for latency calculation
            const orig_timestamp = data.timestamp || this.isoStringToDate(this.getvalue(`${p1}${this.getInteractionByID(data.id)}.timestamp`));

            let timestamp;
            if (Object.prototype.toString.call(data.timestamp) === '[object Date]') {
                timestamp = (version === "1.2")
                    ? this.dateToscorm12Time(data.timestamp)
                    : (this.settings.time_type === "UTC" ? this.isoDateToStringUTC(data.timestamp) : this.isoDateToString(data.timestamp));
            } else {
                timestamp = data.timestamp; // Assume pre-formatted string? Or undefined.
            }
            data.timestamp = timestamp;

            // Latency Calculation
            let latency;
            if (Object.prototype.toString.call(data.latency) === '[object Date]') {
                latency = (data.latency.getTime() - orig_timestamp.getTime()) * 0.001;
                data.latency = (version === "1.2")
                    ? this.centisecsToSCORM12Duration(latency * 100)
                    : this.centisecsToISODuration(latency * 100, true);
            } else if (data.learner_response && data.learner_response.length > 0 && !this.isBadValue(data.learner_response)) {
                // Auto-calculate latency if learner response exists but no latency provided
                const now = new Date();
                const diff = (now.getTime() - (orig_timestamp ? orig_timestamp.getTime() : now.getTime())) * 0.001;
                data.latency = (version === "1.2")
                    ? this.centisecsToSCORM12Duration(diff * 100)
                    : this.centisecsToISODuration(diff * 100, true);
            }

            // Interaction Mode Check
            p2 = '_count';
            if (this.settings.interaction_mode === "journaled" || version === "1.2") {
                // SCORM 1.2 is journaled by nature (mostly write-only)
                const count = this.getvalue(p1 + p2);
                n = (count === "-1") ? '0' : count;
            } else {
                // State mode - update by ID
                n = this.getInteractionByID(data.id);
                if (this.isBadValue(n)) {
                    const count = this.getvalue(p1 + p2);
                    n = (count === "-1") ? '0' : count;
                }
            }

            p1 += n + "."; // e.g. cmi.interactions.0.

            // set ID
            if (!this.isBadValue(data.id)) {
                result = this.setvalue(p1 + 'id', data.id);
            }

            // set Type
            if (!this.isBadValue(data.type)) {
                if (version === "1.2") {
                    switch (data.type) {
                        case "other":
                        case "long-fill-in":
                            data.type = "fill-in";
                            break;
                        default:
                            break;
                    }
                }
                // SCORM 1.2 doesn't support long-fill-in, map to fill-in
                result = this.setvalue(p1 + 'type', data.type);
            }

            // set Objectives
            if (data.objectives !== undefined) {
                const len = data.objectives.length;
                for (i = 0; i < len; i++) {
                    // Check duplication
                    m = this.getInteractionObjectiveByID(n, data.objectives[i].id);
                    if (m === 'false') {
                        const objCount = this.getvalue(`${p1}objectives._count`);
                        m = (objCount === '-1') ? '0' : objCount;
                    }
                    result = this.setvalue(`${p1}objectives.${m}.id`, data.objectives[i].id);
                }
            }

            // set Timestamp
            if (data.timestamp !== undefined) {
                if (version !== "1.2") {
                    result = this.setvalue(p1 + 'timestamp', data.timestamp);
                } else {
                    result = this.setvalue(p1 + 'time', data.timestamp);
                }
            }

            // set Correct Responses
            if (Array.isArray(data.correct_responses)) {
                const len = data.correct_responses.length;
                for (j = 0; j < len; j++) {
                    p = this.getInteractionCorrectResponsesByPattern(n, data.correct_responses[j].pattern);
                    if (p === 'false') {
                        const crCount = this.getvalue(`${p1}correct_responses._count`);
                        p = (crCount === '-1') ? 0 : crCount;
                    }

                    if (p === "match") {
                        this.debug(`${this.settings.prefix}: Duplicate correct response pattern ignored: ${data.correct_responses[j].pattern}`, 2);
                    } else {
                        result = this.setvalue(
                            `${p1}correct_responses.${p}.pattern`,
                            this.encodeInteractionType(data.type, data.correct_responses[j].pattern)
                        );
                    }
                }
            }

            // set Weighting
            if (!this.isBadValue(data.weighting)) {
                result = this.setvalue(p1 + 'weighting', data.weighting);
            }

            // set Learner Response
            if (!this.isBadValue(data.learner_response)) {
                if (version !== "1.2") {
                    result = this.setvalue(p1 + 'learner_response', this.encodeInteractionType(data.type, data.learner_response));
                } else {
                    result = this.setvalue(p1 + 'student_response', this.encodeInteractionType(data.type, data.learner_response));
                }
            }

            // set Result
            if (!this.isBadValue(data.result)) {
                result = this.setvalue(p1 + 'result', data.result);
            }

            // set Latency
            if (!this.isBadValue(data.latency)) {
                result = this.setvalue(p1 + 'latency', data.latency);
            }

            // set Description
            if (version !== "1.2") {
                if (!this.isBadValue(data.description)) {
                    result = this.setvalue(p1 + 'description', data.description);
                }
            }

            return result;
        }
        return 'false';
    }

    setObjective(data) {
        if (this.isActive) {
            const count = parseInt(this.getvalue("cmi.objectives._count"), 10);
            let idx = count;

            // Check if exists
            for (let i = 0; i < count; i++) {
                if (this.getvalue(`cmi.objectives.${i}.id`) === data.id) {
                    idx = i;
                    break;
                }
            }

            this.setvalue(`cmi.objectives.${idx}.id`, data.id);
            if (data.score) {
                this.setvalue(`cmi.objectives.${idx}.score.scaled`, data.score.scaled);
                this.setvalue(`cmi.objectives.${idx}.score.raw`, data.score.raw);
                this.setvalue(`cmi.objectives.${idx}.score.min`, data.score.min);
                this.setvalue(`cmi.objectives.${idx}.score.max`, data.score.max);
            }
            this.setvalue(`cmi.objectives.${idx}.success_status`, data.success_status);
            this.setvalue(`cmi.objectives.${idx}.completion_status`, data.completion_status);
            this.setvalue(`cmi.objectives.${idx}.progress_measure`, data.progress_measure);
            this.setvalue(`cmi.objectives.${idx}.description`, data.description);

            return 'true';
        }
        return 'false';
    }

    getObjective(id) {
        if (this.isActive) {
            const count = parseInt(this.getvalue("cmi.objectives._count"), 10);
            for (let i = 0; i < count; i++) {
                if (this.getvalue(`cmi.objectives.${i}.id`) === id) {
                    return {
                        id: id,
                        score: {
                            scaled: this.getvalue(`cmi.objectives.${i}.score.scaled`),
                            raw: this.getvalue(`cmi.objectives.${i}.score.raw`),
                            min: this.getvalue(`cmi.objectives.${i}.score.min`),
                            max: this.getvalue(`cmi.objectives.${i}.score.max`)
                        },
                        success_status: this.getvalue(`cmi.objectives.${i}.success_status`),
                        completion_status: this.getvalue(`cmi.objectives.${i}.completion_status`),
                        progress_measure: this.getvalue(`cmi.objectives.${i}.progress_measure`),
                        description: this.getvalue(`cmi.objectives.${i}.description`)
                    };
                }
            }
        }
        return 'false';
    }

    // For now, I'll ensure we expose the "happyEnding" which is popular
    happyEnding() {
        if (this.isConnectionActive() && this.settings.happyEnding) {
            this.happyEndingRequest = true;
            this.setvalue('cmi.score.scaled', '1');
            this.setvalue('cmi.score.min', '0');
            this.setvalue('cmi.score.max', '100');
            this.setvalue('cmi.score.raw', '100');
            this.setvalue('cmi.success_status', 'passed');
            this.setvalue('cmi.progress_measure', '1');
            return this.setvalue('cmi.completion_status', 'completed');
        }
        return 'false';
    }
}
