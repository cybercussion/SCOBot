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
            version: "5.2.6",
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
            // '' = "never set this session": the doNotStatusUntilFinish replay skips it, so a
            // course that never graded gets no zeros written over the learner's record.
            progress_measure: "",
            scaled_passing_score: this.settings.scaled_passing_score,
            score: {
                scaled: "",
                raw: "",
                min: "0",
                max: "0"
            }
        };

        this.isStarted = false;
        this.happyEndingRequest = false;
        this.SCOBotManagedStatus = false;
        // doNotStatusUntilFinish: the buffer fields set THIS session, in the order they were last set.
        // Only these are sent at session end; a field merely read at start() is never re-sent.
        this._held = new Set();
        this._initSCOCalled = false;

        // Auto-Initialize handling
        if (typeof window !== 'undefined') {
            // Auto-connect, unless the content already called initSCO() itself (the README's Quick Start does).
            SCOBotUtil.addEvent(window, 'loaded', () => { if (!this._initSCOCalled) this.initSCO(); });
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
        this._initSCOCalled = true;
        // Already connected (a direct call plus the auto-connect, or two calls): nothing to do, nothing to report.
        if (this.isConnectionActive()) return 'true';
        // Never re-open a terminated session: the LMS would answer 104 and many show the learner an error.
        if (this.API.terminated) {
            this.debug(`${this.settings.prefix}: initSCO after terminate ignored.`, 2);
            return 'false';
        }
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
        // initialize()'s own unknown->incomplete normalisation is not a result of this session.
        // Kept here (not moved into initSCO): start() performs no setvalue of its own, so nothing
        // session-authored can precede this clear; any setvalue added to start() above this line
        // would be silently dropped from the hold.
        this._held.clear();

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
        // isConnectionActive() is the canonical check; bare `this.isActive` was a truthy non-call (inherited method reference).
        if (this.isConnectionActive()) {
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
        // isConnectionActive() is the canonical check; bare `this.isActive` was a truthy non-call (inherited method reference).
        if (this.isConnectionActive()) {
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
        // isConnectionActive() is the canonical check; bare `this.isActive` was a truthy non-call (inherited method reference).
        if (this.isConnectionActive()) {
            this.debug(`${this.settings.prefix}: Suspending...`, 3);
            this.setvalue('cmi.exit', 'suspend');
            // Owner ruling 2026-11-06: held status goes to the LMS at ANY session end, suspend included.
            if (this.settings.doNotStatusUntilFinish) this._replayHeld();
            this.isStarted = false;
            return this.terminate();
        }
        return 'false';
    }

    timeout() {
        // isConnectionActive() is the canonical check; bare `this.isActive` was a truthy non-call (inherited method reference).
        if (this.isConnectionActive()) {
            this.debug(`${this.settings.prefix}: Timing out...`, 3);
            this.setvalue('cmi.exit', 'time-out');
            this.updateStatus(true);
            this.isStarted = false;
            return this.terminate();
        }
        return 'false';
    }

    updateStatus(ending) {
        if (this.settings.doNotStatusUntilFinish) {
            // Holding: nothing SCOBot-managed reaches the LMS mid-session, defaults included.
            if (!ending) return 'true';
            // Session end (finish/timeout): send what was held, then apply defaults exactly as with
            // the option off -- the LMS now holds what it would have held without the option.
            this._replayHeld();
        }

        if (!this.happyEndingRequest) {
            const ss = 'cmi.success_status';
            const cs = 'cmi.completion_status';
            const defss = this.settings.success_status;
            const defcs = this.settings.completion_status;

            const storss = this.getvalue(ss);
            const storcs = this.getvalue(cs);

            let isSuccessSet = (storss === "passed" || storss === "failed");
            let isCompletionSet = (storcs === "completed" || storcs === "incomplete");
            if (this.getAPIVersion() === "1.2") {
                // 1.2 has ONE lesson_status: a real passed/failed/completed counts as set for both
                // checks, so no author default overwrites the learner's result.
                const real12 = (storss === "passed" || storss === "failed" || storss === "completed" ||
                    storcs === "passed" || storcs === "failed" || storcs === "completed");
                if (real12) { isSuccessSet = true; isCompletionSet = true; }
            }

            if (this.settings.exit_type === 'finish' || ending) {
                if (defss && !isSuccessSet && storss !== defss) {
                    this.setvalue(ss, defss);
                }

                // Completion logic
                if (this.getAPIVersion() === "1.2" && this.settings.scorm_status_persist === "completion_status" && defcs && !isCompletionSet) {
                    this.setvalue(cs, defcs);
                } else {
                    if (defcs && !isCompletionSet && storcs !== defcs) {
                        this.setvalue(cs, defcs);
                    }
                }
            }
        }
    }

    /** doNotStatusUntilFinish: mark a buffer field as set this session (moves it to the end of the order). */
    _hold(field) {
        this._held.delete(field);
        this._held.add(field);
    }

    /**
     * doNotStatusUntilFinish: send the buffer fields set this session, in the order they were last set,
     * so on 1.2 (one lesson_status) the final value is the one the option-off path would have left.
     * Never writes a field that was only read at start(), nor a '' / 'NaN' value.
     */
    _replayHeld() {
        const keys = {
            'score.raw': ['cmi.score.raw', () => this.buffer.score.raw],
            'score.scaled': ['cmi.score.scaled', () => this.buffer.score.scaled],
            'progress_measure': ['cmi.progress_measure', () => this.buffer.progress_measure],
            'completion_status': ['cmi.completion_status', () => this.buffer.completion_status],
            'success_status': ['cmi.success_status', () => this.buffer.success_status]
        };
        // Snapshot first: each replayed write re-mirrors into the buffer and _held (1.2 sets both
        // statuses), so reading live inside the loop would let one status overwrite the other.
        let plan = [...this._held].map((f) => [keys[f][0], keys[f][1]()]);
        if (this.getAPIVersion() === '1.2') {
            // 1.2 maps both statuses onto one lesson_status: when they carry the same value, send it once,
            // keeping the later entry so the position of the last status write is unchanged.
            // If the dropped entry is completion, the connector's API.data.completion_status mirror
            // (SCOBotBase.js ~:423) is not refreshed by it: harmless, it is read only at initialize (~:186).
            const ci = plan.findIndex(([n]) => n === 'cmi.completion_status');
            const si = plan.findIndex(([n]) => n === 'cmi.success_status');
            if (ci >= 0 && si >= 0 && plan[ci][1] === plan[si][1]) {
                plan.splice(Math.min(ci, si), 1);
            }
        }
        let result = 'true';
        for (const [n, v] of plan) {
            if (!this.isBadValue(v)) result = this.setvalue(n, v);
        }
        // Clear AFTER the loop: each replayed setvalue goes back through the override and re-holds its
        // field, so clearing first would leave the burst armed for a second replay (e.g. exitSCO after
        // a finish whose Terminate failed).
        this._held.clear();
        return result;
    }

    /**
     * setvalue, plus: while doNotStatusUntilFinish is on, a status/score value the LMS accepted also
     * updates the buffer, so the finish() replay carries the content's latest value rather than the
     * session's starting one. A rejected value is not buffered (it would only be rejected again).
     */
    setvalue(n, v) {
        const result = super.setvalue(n, v);
        if (this.settings && this.settings.doNotStatusUntilFinish && this.buffer && this.makeBoolean(result)) {
            const val = String(v);
            switch (n) {
                case 'cmi.score.raw':
                case 'cmi.core.score.raw':
                    this.buffer.score.raw = val; this._hold('score.raw'); break;
                case 'cmi.score.scaled':
                    this.buffer.score.scaled = val; this._hold('score.scaled'); break;
                case 'cmi.progress_measure':
                    this.buffer.progress_measure = val; this._hold('progress_measure'); break;
                case 'cmi.completion_status':
                case 'cmi.success_status':
                case 'cmi.core.lesson_status':
                    if (this.getAPIVersion() === '1.2') {
                        // 1.2 has one lesson_status: the latest write is the whole status, so the
                        // replay (completion then success) must end on this value, not an older one.
                        this.buffer.completion_status = val;
                        this.buffer.success_status = val;
                        this._hold('completion_status');
                        this._hold('success_status');
                    } else if (n === 'cmi.completion_status') {
                        this.buffer.completion_status = val;
                        this._hold('completion_status');
                    } else if (n === 'cmi.success_status') {
                        this.buffer.success_status = val;
                        this._hold('success_status');
                    }
                    break;
            }
        }
        return result;
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
     * Get Mode (classic Content API): 'normal' | 'browse' | 'review',
     * captured by start(). Overrides the Base connector's stub, whose
     * API.mode field is never populated.
     * @returns {String}
     */
    getMode() {
        return this.settings.mode;
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

    /**
     * Set Totals (classic Content API): declare totals so SCOBot manages
     * progress_measure and score bounds. Call once after start().
     * @param {Object} data {totalInteractions, totalObjectives, scoreMin, scoreMax}
     * @returns {String} 'true' or 'false'
     */
    setTotals(data) {
        // Legacy flag only: it no longer drives the doNotStatusUntilFinish replay (that uses _held).
        this.SCOBotManagedStatus = true;
        if (this.isConnectionActive()) {
            if (!this.isBadValue(data.totalInteractions)) {
                this.settings.totalInteractions = parseInt(data.totalInteractions, 10);
            }
            if (!this.isBadValue(data.totalObjectives)) {
                this.settings.totalObjectives = parseInt(data.totalObjectives, 10);
            }
            if (!this.isBadValue(data.scoreMin)) {
                this.buffer.score.min = '' + this.trueRound(data.scoreMin, 7);
                this.setvalue('cmi.score.min', this.buffer.score.min);
            }
            if (!this.isBadValue(data.scoreMax)) {
                this.buffer.score.max = '' + this.trueRound(data.scoreMax, 7);
                this.setvalue('cmi.score.max', this.buffer.score.max);
            }
            return 'true';
        }
        return 'false';
    }

    gradeIt() {
        // doNotStatusUntilFinish: compute into the buffer only; it is sent at session end.
        const hold = !!this.settings.doNotStatusUntilFinish;
        let scoreScaled = 1;
        // With the option on, a raw set this session lives in the buffer (e.g. happyEnding) until session end.
        const scoreRawStr = (hold && this._held.has('score.raw')) ? this.buffer.score.raw : this.getvalue('cmi.score.raw');
        const scoreRaw = parseFloat(scoreRawStr);
        const scoreMin = parseFloat(this.getvalue('cmi.score.min'));
        const scoreMax = parseFloat(this.getvalue('cmi.score.max'));

        // No raw score = nothing to grade: send no scaled score and invent no success_status.
        const hasRaw = !this.isBadValue(scoreRawStr) && String(scoreRawStr).trim() !== '' && Number.isFinite(scoreRaw);

        // Decision table: a raw score is required in every row. Zero-width range + raw = scaled 1 (1.0.4 rule);
        // max > min + raw = graded; blank/non-finite/inverted bounds or no raw = nothing to grade.
        const width = scoreMax - scoreMin;
        const gradable = Number.isFinite(width) && hasRaw && (width === 0 || width > 0);

        if (!gradable) {
            // nothing to grade: no scaled score, no NaN
        } else if (width !== 0) {
            scoreScaled = ((scoreRaw - scoreMin) / (scoreMax - scoreMin));
            if (hold) {
                if (Number.isFinite(scoreScaled)) {
                    this.buffer.score.scaled = scoreScaled.toFixed(7);
                    this._hold('score.scaled');
                }
            } else {
                this.setvalue('cmi.score.scaled', scoreScaled.toFixed(7));
            }
        } else if (hold) {
            this.buffer.score.scaled = '1';
            this._hold('score.scaled');
        } else {
            this.setvalue('cmi.score.scaled', 1);
        }
        if (hold && hasRaw) {
            this.buffer.score.raw = scoreRawStr;
            this._hold('score.raw');
        }

        // Completion (restored 4.x gate): progress_measure vs completion_threshold.
        // Default threshold 0 keeps prior behavior (always completed).
        // CMI is authoritative: setObjective writes cmi.progress_measure through as it
        // runs, but this.buffer.progress_measure is only updated in-process by
        // setObjective. On a resumed session (new SCOBot instance rehydrated from a
        // prior suspend/commit) the buffer never gets rehydrated from CMI, so if the
        // learner finishes via a non-interactive page (no setObjective call) the buffer
        // is still at its "0" construction default even though CMI holds the real,
        // persisted progress. Read CMI first and fall back to the buffer only for
        // pre-commit states where CMI hasn't been written yet.
        if (this.buffer.completion_status !== "completed") {
            // With doNotStatusUntilFinish the buffer holds this session's progress (newer than CMI's).
            const cmiProgress = this.getvalue('cmi.progress_measure');
            const cmiOk = cmiProgress && cmiProgress !== 'false';
            const progress = (hold && this.buffer.progress_measure !== '')
                ? this.buffer.progress_measure
                : (cmiOk ? cmiProgress : (this.buffer.progress_measure || '0')); // '' seed reads as 0, as before
            this.buffer.completion_status =
                (parseFloat(progress) >= parseFloat(this.buffer.completion_threshold))
                    ? 'completed' : 'incomplete';
            if (hold) this._hold('completion_status');
            else this.setvalue('cmi.completion_status', this.buffer.completion_status);
        }

        // Success (only when there is a raw score to grade)
        if (gradable) {
            if (this.buffer.success_status !== "passed") {
                this.buffer.success_status = (scoreScaled >= parseFloat(this.buffer.scaled_passing_score)) ? 'passed' : 'failed';
            }
            if (hold) this._hold('success_status'); // the option-off path always writes success here
            else this.setvalue('cmi.success_status', this.buffer.success_status);
        }

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
            } else if (typeof data.latency === 'string' && this.isISO8601Duration(data.latency)) {
                // Caller (e.g. the reference player) already computed and supplied a valid
                // ISO8601 duration. Honor it as-is: previously this branch was unreachable
                // because the learner_response auto-calc below ran unconditionally whenever
                // learner_response was present, silently clobbering a supplied latency with
                // ~now - orig_timestamp (effectively PT0H0M0S). Classic 4.x SCOBot had the
                // same gap for string latencies (it only preserved latency passed as a Date
                // object), so this is a genuine fix rather than a behavior regression vs 4.x.
            } else if (data.learner_response && data.learner_response.length > 0 && !this.isBadValue(data.learner_response)) {
                // Auto-calculate latency if learner response exists but no valid latency provided
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
                    const correctResponse = this.encodeInteractionType(data.type, data.correct_responses[j].pattern);
                    p = this.getInteractionCorrectResponsesByPattern(n, correctResponse);
                    if (p === 'false') {
                        const crCount = this.getvalue(`${p1}correct_responses._count`);
                        p = (crCount === '-1') ? 0 : crCount;
                    }

                    if (p === "match") {
                        this.debug(`${this.settings.prefix}: Duplicate correct response pattern ignored: ${data.correct_responses[j].pattern}`, 2);
                    } else {
                        result = this.setvalue(
                            `${p1}correct_responses.${p}.pattern`,
                            correctResponse
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

    /**
     * Get Interaction (classic Content API): find by id, return decoded object
     * (inverse of setInteraction, mirrors getObjective's shape).
     * @param {String} id
     * @returns {Object|String} interaction object or 'false'
     */
    getInteraction(id) {
        if (this.isConnectionActive()) {
            const count = parseInt(this.getvalue('cmi.interactions._count'), 10);
            if (isNaN(count)) {
                return 'false';
            }
            const version = this.getAPIVersion();
            for (let i = 0; i < count; i++) {
                if (this.getvalue(`cmi.interactions.${i}.id`) === id) {
                    const p1 = `cmi.interactions.${i}.`;
                    const type = this.getvalue(p1 + 'type');
                    const responseKey = version !== '1.2' ? 'learner_response' : 'student_response';
                    return {
                        id: id,
                        type: type,
                        learner_response: this.decodeInteractionType(type, this.getvalue(p1 + responseKey)),
                        result: this.getvalue(p1 + 'result'),
                        weight: this.getvalue(p1 + 'weighting'),
                        latency: version !== '1.2' ? this.getvalue(p1 + 'latency') : '',
                        timestamp: version !== '1.2' ? this.getvalue(p1 + 'timestamp') : this.getvalue(p1 + 'time'),
                        description: version !== '1.2' ? this.getvalue(p1 + 'description') : ''
                    };
                }
            }
        }
        return 'false';
    }

    setObjective(data) {
        // isConnectionActive() is the canonical check; bare `this.isActive` was a truthy non-call (inherited method reference).
        if (this.isConnectionActive()) {
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

            // Maintain progress_measure (restored 4.x behavior):
            // completed objectives / totalObjectives declared via setTotals.
            if (this.settings.totalObjectives > 0 && data.completion_status === 'completed') {
                const objCount = parseInt(this.getvalue('cmi.objectives._count'), 10);
                let completedCount = 0;
                for (let j = 0; j < objCount; j++) {
                    if (this.getvalue(`cmi.objectives.${j}.completion_status`) === 'completed') {
                        completedCount++;
                    }
                }
                this.buffer.progress_measure = '' + this.trueRound(completedCount / this.settings.totalObjectives, 7);
                if (this.settings.doNotStatusUntilFinish) {
                    this._hold('progress_measure'); // sent at session end
                } else {
                    this.setvalue('cmi.progress_measure', this.buffer.progress_measure);
                }
            }

            return 'true';
        }
        return 'false';
    }

    getObjective(id) {
        // isConnectionActive() is the canonical check; bare `this.isActive` was a truthy non-call (inherited method reference).
        if (this.isConnectionActive()) {
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
        if (this.isConnectionActive() && this.settings.happyEnding && this.settings.doNotStatusUntilFinish) {
            // 1.0.4 behaviour: hold the result in the buffer, send only the score bounds now.
            this.happyEndingRequest = true;
            this.buffer.score.scaled = '1';
            this.buffer.score.raw = '100';
            this.buffer.success_status = 'passed';
            this.buffer.completion_status = 'completed';
            this.buffer.progress_measure = '1';
            // Same order as the option-off branch writes them, so 1.2's lesson_status ends the same.
            ['score.scaled', 'score.raw', 'success_status', 'progress_measure', 'completion_status'].forEach((f) => this._hold(f));
            this.setvalue('cmi.score.min', '0');
            return this.setvalue('cmi.score.max', '100');
        }
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
