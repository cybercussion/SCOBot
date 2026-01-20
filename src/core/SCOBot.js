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

    // --- Interaction & Objective Helpers ---

    setInteraction(data) {
        if (this.isActive) {
            const count = parseInt(this.getvalue("cmi.interactions._count"), 10);
            const idx = count; // New index

            this.setvalue(`cmi.interactions.${idx}.id`, data.id);
            this.setvalue(`cmi.interactions.${idx}.type`, data.type);
            this.setvalue(`cmi.interactions.${idx}.timestamp`, data.timestamp);
            this.setvalue(`cmi.interactions.${idx}.weighting`, data.weighting || '1');
            this.setvalue(`cmi.interactions.${idx}.result`, data.result);
            this.setvalue(`cmi.interactions.${idx}.latency`, data.latency);
            this.setvalue(`cmi.interactions.${idx}.description`, data.description);

            // Correct Responses (Pattern)
            if (data.correct_responses && data.correct_responses.length) {
                data.correct_responses.forEach((cr, i) => {
                    this.setvalue(`cmi.interactions.${idx}.correct_responses.${i}.pattern`, Array.isArray(cr.pattern) ? cr.pattern.join('[,]') : cr.pattern);
                });
            }

            // Learner Response
            if (data.learner_response) {
                const response = Array.isArray(data.learner_response) ? data.learner_response.join('[,]') : data.learner_response;
                this.setvalue(`cmi.interactions.${idx}.learner_response`, response);
            }

            // Objectives
            if (data.objectives && data.objectives.length) {
                data.objectives.forEach((obj, i) => {
                    this.setvalue(`cmi.interactions.${idx}.objectives.${i}.id`, obj.id);
                });
            }

            return 'true';
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
