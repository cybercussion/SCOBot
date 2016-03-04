/*global $, SCOBotUtil, scorm, window */
/*jslint browser: true, devel: true, indent: 4 regexp: true*/
/**
 * SCOBot
 * This only works with the SCOBotBase and will not work standalone.  It will not work standalone (without a LMS)
 * unless you include the SCOBot_API_1484_11.
 * The 'Bot' in SCOBot is in this API.  This manages the time duration, stamps, interaction and objective formats, as
 * well as sequences/manages many aspects you'd have to construct by hand anyway if you were about to start talking
 * directly to the SCORM Runtime at the LMS.
 *
 * Please see the wiki below for more information about going commando, and or utilizing the rest of the library.
 * https://github.com/cybercussion/SCOBot
 *
 * jQuery dependency removed, and now utilizes SCOBotUtil.
 *
 * Recommend a minify/merge before pushing to a production environment. (JSMin, YUI Compressor, Dojo Shrinksafe etc ...)
 *
 * @usage
 * var SB = new SCOBot({
 *         interaction_mode: "state",         // or journaled
 *         scaled_passing_score: '0.6',       // default passing score (60%) 0.1 - 1
 *         completion_threshold: '1',         // 0.1 - 1
 *         initiate_timer: false,             // max_time_allowed? let SCOBot manage it- true
 *         scorm_strict: true                 // SPM Management and truncation of data to keep things working
 *    });
 * SCOBot comes pre-baked with load/unload listeners among others...
 *
 * Special note on 'cheating' within the SCORM (LMS <-> SCO) world:
 * You can't stop this really within the SCO.  You can chase and chase, and check and status, until you're blue in the
 * face.  Truth is - the student can run several commands commit, and terminate the session before SCOBot or the LMS has
 * anything to say about it.  This does however leave the the power back on the LMS with a simple report.  But, it
 * requires some data forensics to determine if cheating occurred.  More on this via the Wiki.
 *
 * Sequencing
 * SCORM Navigation is entirely based on the learner.  Most LMS systems will leave your content hanging after it
 * Terminates.  SCORM 2004 added Sequencing and Navigation which opened up more options for dictating how your SCO
 * behaves after Terminate is fired. The default behavior is _none_, however if you seek more information about the
 * other possibilities you can locate a SCORM_SeqNav.pdf from ADL in Table 5.6.6a for more detailed info.
 *
 * @event exception, load, unload, message, continue, comments_lms
 *
 * @author Cybercussion Interactive, LLC <info@cybercussion.com>
 * @license Copyright (c) 2009-2016, Cybercussion Interactive LLC
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 * @requires SCOBotBase, SCOBotUtil
 * @version 4.1.5
 * @param options {Object} override default values
 * @constructor
 */
/*!
 * SCOBot, Updated Jan 1st, 2016
 * Copyright (c) 2009-2016, Cybercussion Interactive LLC. All rights reserved.
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 */
function SCOBot(options) {
    // Constructor ////////////
    "use strict";
    /** @default version, createDate, modifiedDate, prefix, launch_data, interaction_mode, success_status, location, completion_status, suspend_data, mode, scaled_passing_score, totalInteractions, totalObjectives, startTime */
    var Utl      = SCOBotUtil, // Hook for jQuery 'like' functionality
        defaults = {
            version:                "4.1.5",
            createDate:             "04/07/2011 09:33AM",
            modifiedDate:           "03/04/2016 12:23AM",
            prefix:                 "SCOBot",
            // SCOBot default parameters
            launch_data:            {},
            interaction_mode:       "state",          // or journaled
            launch_data_type:       "querystring",    // or json
            initiate_timer:         true,
            scorm_strict:           true,             // You can override this.  Will enforce SPM of SCORM Spec
            scorm_edition:          "3rd",            // or 4th - this is a issue with "editions" of SCORM 2004 that differ
            scorm_status_persist:   "success_status", // could alternatively set it to 'completion_status' (*SCORM 1.2 only)
            useJSONSuspendData:     true,             // you may manage this yourself, set it to false if you do
            suspend_data:           {pages: []},      // May be replaced by LMS value on resume
            base64:                 false,            // true if you want to encode suspend data and decode on resume.
            happyEnding:            true,             // Disable if you manage scoring, and don't want to expose the API call
            doNotStatusUntilFinish: false,            // Hot fix: Some platforms(if graded) will launch you in review mode, even though your exit is suspend. See buffer below.
            sequencing: {
                nav: {
                    request: '_none_'                   // continue, previous, choice, exit, exitAll, abandon, abandonAll, suspendAll, and _none_.  choice allows {target=<STRING>} like “{target=intro}choice” where STRING is the identifierref from the manifest.  This would act like a 'jump' navigation capability.  This is executed by the LMS on Terminate.  You could pass capabilities also thru launch data or parameters to convey options for the SCO to calculate. _none_ is default.
                }
            },
            location:               "",               // will be replaced by LMS value
            mode:                   "",               // will be replaced by LMS value
            scaled_passing_score:   0.7,              // Override for default unless imsmanifest (LMS) has value
            completion_threshold:   0,                // Override for default unless imsmanifest (LMS) has value
            max_time_allowed:       '',               // will be replaced by LMS value
            totalInteractions:      0,                // See setTotals below
            totalObjectives:        0,
            startTime:              0
        },
        // Settings merged with defaults and extended options
        settings     = Utl.extend(defaults, options),
        // 4.0.4 Status/State Buffer Private now to prevent direct tampering
        buffer       = {
            success_status      : '',
            completion_status   : '',
            completion_threshold: settings.completion_threshold, // cache
            progress_measure    : '0',
            scaled_passing_score: settings.scaled_passing_score, // cache
            score               : {
                scaled: '0',
                raw   : '0',
                min   : '0',
                max   : '0'
            }
        },
        lmsconnected = 'false',
        isError      = false,
        isStarted    = false,
        happyEndingRequest = false,                   // if you enable happyEnding, and call it, it will take precedence.
        SCOBotManagedStatus = false,                  // if you setTotals, SCOBot will manage the status.
        badValues    = '|null|undefined|false|NaN|| |',
        error        = scorm.get('error'), // no sense retyping this
        self         = this; // Hook
    // End Constructor ////////
    ///////////////////////////
    // Private ////////////////
    /**
     * Trigger Warning (internal to this API)
     * Throws a console log when a SCORM API Error occurs
     * @returns {Boolean}
     */
    function triggerWarning(n) {
        scorm.debug(error[n], 2);
        return true;
    }

    /**
     * Trigger Exception
     * Throws an event the player can listen to in order to handle an exception.
     * This would be common to a non-compliance in an LMS and loss of student data.
     */
    function triggerException(msg) {
        Utl.triggerEvent(self, 'exception', {error: msg});
    }
    /**
     * Initialize SCO
     * This is commonly done on load of the web page.
     * Default behavior
     * @event load
     * @returns {String} 'true' or 'false' if established LMS connection
     */
    function initSCO() {
        lmsconnected = scorm.initialize(); // returns string
        scorm.debug(settings.prefix + ": SCO Loaded from window.onload " + lmsconnected, 4);
        if (lmsconnected === 'true') {
            self.start(); // Things you'd do like getting mode, suspend data
            Utl.triggerEvent(self, "load");
        } else {
            var msg = "Sorry, unable to initialize the SCORM Runtime API. Returned: " + lmsconnected;
            scorm.debug(settings.prefix + msg);
            triggerException(msg);
        }
        return lmsconnected;
    }

    /**
     * Exit SCO
     * Commonly done when unload or beforeunload is triggered
     * Default behavior
     * @event unload
     * @returns {Boolean} true or false if successfully exited
     */
    function exitSCO() {
        scorm.debug(settings.prefix + ": SCO is being unloaded, forcing exit ...", 3);
        if (scorm.isConnectionActive()) {
            Utl.triggerEvent(self, "unload");
            switch (scorm.get('exit_type')) {
            case "finish":
                self.finish();
                break;
            case "suspend":
                self.suspend();
                break;
            case "timeout":
                self.timeout();
                break;
            default:
                scorm.debug(settings.prefix + ": unknown exit type", 2);
                break;
            }
            scorm.debug(settings.prefix + ": SCO is done unloading.", 4);
        }
        return true;
    }

    /**
     * Is Bad Value
     * We get a variety of responses from an LMS
     * @returns {Boolean} true if its bad.
     */
    function isBadValue(v) {
        return badValues.indexOf('|' + v + '|') >= 0;
    }

    /**
     * Cleanse Data
     * This will escape out characters that may of been cross-contaminated from other proprietary sources.
     * These can often result in UTF-8 and other encoding issues and may result in errors.
     * You may even consider not using cleanseData, and using another utf8-base64 library from the internets.
     */
    function cleanseData(str) {
        var cleanseExp = /[^\f\r\n\t\v\0\s\S\w\W\d\D\b\\B\\cX\\xhh\\uhhh]/gi; // input.replace(/\s/g, '')
        return str.replace(cleanseExp, '');
    }

    /**
     * Is ISO 8601
     * I've got a RegEx to validate ISO 8601 time based on SCORM 2004 Formats.
     * This is a great common way to do this so regardless of time zone you can reflect the
     * time this time stamp was referring to.
     * Acceptable Format GMT 2012-02-28T15:00:00.0-8:00, UTC 2012-02-28T15:00:00.0-8:00Z, Plain 2012-02-28T15:00:00
     * @param v {String} ISO 8601 timestamp
     * @returns {Boolean} true or false
     */
    function isISO8601(v) {
        var iso8601Exp;
        switch (scorm.get('time_type')) {
        case "UTC": // AT GMT
            iso8601Exp = /^(\d{4})-0?(\d+)-0?(\d+)[T ]0?(\d+):0?(\d+):0?(\d+)(?:\.(\d+))(|Z)$/;
            break;
        case "GMT": // FROM GMT
            iso8601Exp = /^(\d{4})-0?(\d+)-0?(\d+)[T ]0?(\d+):0?(\d+):0?(\d+)(?:\.(\d+))[\+\-]\d{2}:\d{2}$/;
            break;
        default:    // Now, regardless of GMT
            iso8601Exp = /^(\d{4})-0?(\d+)-0?(\d+)[T ]0?(\d+):0?(\d+):0?(\d+)$/;
            break;
        }
        return iso8601Exp.test(v);
    }

    /**
     * is ISO 8601 Duration
     * This is a PT0H0M0S format
     * @param v {String}
     * @return {Boolean}
     */
    function isISO8601Duration(v) {
        var iso8601Dur = /^(?:P)([^T]*)(?:T)?(.*)?$/;
        return iso8601Dur.test(v);
    }

    /**
     * Not Started Yet
     * You should never see this message, but I found I may need to trace this more than once.
     * @returns {String} 'false'
     */
    function notStartedYet() {
        scorm.debug(settings.prefix + ": You didn't call 'start()' yet, or you already terminated, ignoring.", 2);
        return 'false';
    }

    /**
     * Current Time
     * @returns {Number} Milliseconds
     */
    function currentTime() {
        return (new Date().getTime());
    }

    /**
     * True Round
     * May consider using this to fit within real(10,7) scoring in the event the decimal goes over 7 digits
     * @param v {Number} value
     * @param dec {Number} decimal places
     * @return {Number}
     */
    function trueRound(v, dec) {
        var num = parseFloat(v); // ensure number
        return parseFloat(num.toPrecision(dec));
    }

    /**
     * Find Response Type (May not use this)
     * This is designed to check for {case_matters: true/false}, {order_matters: true/false} or {lang: x}
     * @param type {String} order_matters, case_matters, lang
     * @param str {String}
     * @returns {Number}
     */
    function findResponseType(type, str) {
        var reg;
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
            scorm.debug(settings.prefix + ": Sorry, this is not a valid Response type.", 1);
            break;
        }
        return reg.exec(str);
    }

    /**
     * Times Up
     */
    function timesUp() {
        scorm.debug("Times Up!");
        var time_action = scorm.getvalue('cmi.time_limit_action').split(','),
            message = (time_action[1] === "message");
        if (message) {
            /*$(self).triggerHandler({
                'type': "message",
                'text': "Time Limit Exceeded"
            });*/
            Utl.triggerEvent(self, 'message', {text: "Time Limit Exceeded"});
        }
        scorm.set('exit_type', "timeout");
        if (time_action[0] === "exit") {
            // Force unload method to wrap player up and Terminate
            // switch default exit type to time-out
            exitSCO();
        } else {
            /*$(self).triggerHandler({
                'type': "continue"
            });*/
            Utl.triggerEvent(self, 'continue');
        }
    }

    /**
     * Set Value By Interaction Type
     * This is a data filter to convert input formats into SCORM standard strings.  Please review each interaction for what it expects.
     * This will not enforce SCORM char limits, so please mind your logs if your doing something your not suppose to.
     * @param type {String} Expects true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other
     * @param value {*} May take Array or Object of arrays depending
     * @returns {*} formatted value for interaction type or Boolean false
     */
    function encodeInteractionType(type, value) {
        var str = '',
            str2 = '',
            i = 0,
            arr = [],
            arr2 = [],
            len,
            index;
        switch (type) {
            /*
             * True / False
             * This will expect a {Boolean}, else it will throw error.
             * In SCORM 1.2 this has to be t, f or 0, 1
             */
        case 'true-false':
            value = value.toString().toLowerCase();
            if (value === 'true' || value === 'false') {
                if (scorm.getAPIVersion() === "1.2") {
                    return value.substring(0, 1); // return first char
                }
                return value;
            }
            scorm.debug(settings.prefix + ": Developer, you're not passing true or false for true-false.  I got " + value + " instead", 1);
            return '';
            /*
             *  Multiple Choice
             *  This will expect an {Array} value type ["choice_a", "choice_b"]
             */
        case 'choice':
            /*
             * Sequencing
             * This will expect an {Array}
             * Similar to multiple choice
             * In SCORM 1.2 Choice is different.  a, b, c or 1, 2, 3
             */
            if (scorm.getAPIVersion() === "1.2") { // not a fan of doing this but I didn't want to add more code.  JSLint will complain.
                if (Utl.isArray(value)) {
                    if (value.length > 26 && settings.scorm_strict) {
                        scorm.debug(settings.prefix + ": Developer, you're passing a sum of values that exceeds SCORMs limit of 26 for this pattern.  Consider using 'performance' instead.", 2);
                    }
                    // Check char limit?
                    return value.join(",");
                }
                scorm.debug(settings.prefix + ": Developer, you're not passing a array type for sequencing/choice.  I got " + typeof value + " instead\n" + JSON.stringify(value), 1);
                value = '';
            }
        /* falls through */
        case 'sequencing':
            // 2004 a[,]b and in 1.2 this was a alpha numeric string: Diagnosis SCORM 2004 format is fine.
            if (Utl.isArray(value)) {
                index = 0;
                // Quck validation it doesn't exceed array length 36
                if (value.length > 36 && settings.scorm_strict) {
                    scorm.debug(settings.prefix + ": Developer, you're passing a sum of values that exceeds SCORMs limit of 36 for this pattern.", 2);
                    value = value.slice(0, 36);
                }
                // Quick validation of short_identifier_types
                for (index in value) {
                    if (value.hasOwnProperty(index)) {
                        if (value[index].length > 10 && settings.scorm_strict) {
                            scorm.debug(settings.prefix + ": Developer, you're passing values that exceed SCORMs limit of 10 characters.  Yours have " + value[index].length + ". I will truncate this as not to lose data.", 2);
                            value[index] = value[index].substring(0, 10);
                        }
                    }
                }
                str = scorm.getAPIVersion() === "1.2" ? value.join(",") : value.join("[,]");
                value = str;
            } else {
                scorm.debug(settings.prefix + ": Developer, you're not passing a array type for sequencing/choice.  I got " + typeof value + " instead\n" + JSON.stringify(value), 1);
                value = '';
            }
            return value;
            /*
             * Fill In
             * This will expect an {Object} with optional values
             * {
             *      case_matters: true, // optional {Boolean}
             *      order_maters: true, // optional {Boolean}
             *      lang: 'en-us',      // optional, can also be alternate letter lang code {String}
             *      words: [            // required {Array}
             *          'word1',
             *          'word2'
             *      ]
             * }
             */
        case 'fill-in':
            /* Word
             * {case_matters=true}{order_matters=true}{lang=en-us}word1[,]word2
             * In SCORM 1.2 this is expected to be alpha-numeric only.  These special symbols won't work.
             */
            if (Utl.isPlainObject(value)) {
                // Check for case_matters
                if (value.case_matters !== undefined) {
                    str += "{case_matters=" + value.case_matters + "}";
                }
                // Check for order_matters
                if (value.order_matters !== undefined) {
                    str += "{order_matters=" + value.order_matters + "}";
                }
                // Check for lang
                if (value.lang !== undefined) {
                    str += "{lang=" + value.lang + "}";
                }
                if (Utl.isArray(value.words)) { // new error check
                    str += value.words.join("[,]");
                } else {
                    scorm.debug(settings.prefix + ": Developer, expected an array of word(s) for fill-in.  I got " + typeof value.words + " instead", 1);
                }
                value = str;
            } else {
                scorm.debug(settings.prefix + ": Developer, you're not passing a object type for fill in.  I got " + typeof value + " instead", 1);
                value = '';
            }
            return value;
            /*
             * Long Fill In
             * This will expect an {Object} with optional values
             * {
             *      case_matters: true,   // Optional {Boolean}
             *      lang: 'en-us',        // Optional, can also be alternate letter lang code {String}
             *      text: 'Bunch of text' // Required 4000 character limit {String}
             * }
             */
        case 'long-fill-in':
            // Bunch of text...
            // {case_matters=true}{lang=en}Bunch of text...
            if (Utl.isPlainObject(value)) {
                // Check for case_matters
                if (value.case_matters !== undefined) {
                    str += "{case_matters=" + value.case_matters + "}";
                }
                // Check for lang
                if (value.lang !== undefined) {
                    str += "{lang=" + value.lang + "}";
                }
                str += value.text;
                value = str;
            } else {
                scorm.debug(settings.prefix + ": Developer, you're not passing a object type for long fill in.  I got " + typeof value + " instead", 1);
                value = '';
            }
            return value;
            /*
             * Matching
             * This will expect {Array} of {Array}'s
             * [
             *      ['tile1', 'target1'],
             *      ['tile2', 'target3'],
             *      ['tile3', 'target2']
             * ]
             */
        case 'matching':
            // tile1[.]target1[,]tile2[.]target3[,]tile3[.]target2 (SCORM 2004)
            // tile1.target1,tile2.target3,tile3.target2 (SCORM 1.2)
            if (Utl.isArray(value)) {
                len = value.length;
                i = 0;
                while (i < len) {
                //for (i = 0; i < len; i += 1) {
                    if (Utl.isArray(value[i])) {
                        arr.push(scorm.getAPIVersion() === "1.2" ? value[i].join(".") : value[i].join("[.]"));
                    } else {
                        scorm.debug(settings.prefix + ": Developer, you're not passing a array type for matching/performance.  I got " + typeof value + " instead", 1);
                        return '';
                    }
                    i += 1;
                }
                str = scorm.getAPIVersion() === "1.2" ? arr.join(",") : arr.join("[,]");
                value = str;
            } else {
                scorm.debug(settings.prefix + ": Developer, you're not passing a array type for matching/performance.  I got " + typeof value + " instead", 1);
                value = '';
            }
            return value;
            /*
             * Performance
             * This will expect {Array} of {Array}'s
             * Similar to matching, but its optional to pass the step identifier
             * Correct Responses Pattern:
             * Correct Response Pattern: {Object}
             * {
             *  order_matters: false,
             *  answers: [
             *          ["step_1", "inspect wound"],
             *          ["step_2", "clean wound"],
             *          ["step_3", "apply bandage"]
             *     ]
             * }
             * Learner Response: [
             *          ["step_1", "inspect wound"],
             *          ["step_2", "clean wound"],
             *          ["step_3", "apply bandage"]
             * ]
             */
        case 'performance':
            // 255 alpha numeric SCORM 1.2 (uncertain if {} [] : characters will work.)
            // SCORM 2004 greatly expanded delimiters see page 136
            if (!Utl.isArray(value)) { // This would be a Correct Response Pattern
                // Check for order_matters
                if (value.order_matters !== undefined) {
                    str += "{order_matters=" + value.order_matters + "}";
                }
                if (Utl.isArray(value.answers)) {
                    len = value.answers.length;
                    i = 0;
                    //for (i = 0; i < len; i += 1) {
                    while (i < len) {
                        if (Utl.isArray(value.answers[i])) {
                            // Need to check if answer is object
                            if (Utl.isPlainObject(value.answers[i][1])) {
                                arr2 = [trueRound(value.answers[i][1].min, 7), trueRound(value.answers[i][1].max, 7)];
                                str2 = arr2.join("[:]");
                                value.answers[i][1] = str2;
                            }
                            arr.push(value.answers[i].join("[.]"));
                        } else {
                            scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance correct response.  I got " + typeof (value.answers[i]) + " instead on " + i, 1);
                            scorm.debug(value, 1);
                            return '';
                        }
                        i += 1;
                    }
                    str += arr.join("[,]");
                } else {
                    scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance correct response.  I got " + typeof value.answers + " instead", 1);
                    scorm.debug(value, 1);
                }
            } else {
                if (Utl.isArray(value)) { // This would be a Learner Response Dev: had 'typeof' on it?
                    len = value.length;
                    i = 0;
                    //for (i = 0; i < len; i += 1) {
                    while (i < len) {
                        if (Utl.isArray(value[i])) {
                            arr.push(value[i].join("[.]")); // this isn't working
                        } else {
                            scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance learner response.  I got " + typeof value[i] + " instead on " + i, 1);
                            scorm.debug(value, 1);
                            return '';
                        }
                        i += 1;
                    }
                    str = arr.join("[,]");
                } else {
                    scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance learner response.  I got " + typeof value + " instead", 1);
                    value = '';
                }
            }
            value = str;
            return value;
        /**
         * Numeric
         * comments coming
         */
        case 'numeric':
            if (typeof value === "number") {
                str = '' +value;
            } else if (Utl.isPlainObject(value)) {
                arr = [trueRound(value.min, 7), trueRound(value.max, 7)];
                str = arr.join("[:]");
            } else {
                // Verify number to save some time.
                //str = parseFloat(value);
                if (isNaN(value)) {
                    scorm.debug(settings.prefix + ": Developer, your not passing a number for a numeric interaction.  I got " + value + " instead", 1);
                }
                str = value;
            }
            return str;
            /*
             * LikeRT
             * No real hands on here, expects a {String}
             * This is like 'other', but expects a short identifier type
             */
        case 'likert':
            /*
             * Other
             * This will take a {String} and recommended not to go beyond 4000 chars
             */
        case 'other':
            // Anything up to 4000 characters
            return '' + value; // Do nothing, but ensure string
        default:
            // Invalid
            scorm.debug(settings.prefix + ": Sorry, invalid interaction type detected for " + type + " on " + value, 1);
            return false;
        }
    }

    /**
     * Decode Value By Interaction Type
     * This is a data filter to convert input formats from SCORM standard strings to there native JS equivalent.
     * @param type {String} Expects true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other
     * @param value {String} SCORM 2004 Format for Interaction learner response, or pattern
     * @returns {*} formatted value for interaction type
     */
    function decodeInteractionType(type, value) {
        var i = 0,
            arr = [],
            obj = {},
            len,
            match = false;
        switch (type) {
        case 'true-false':
            if (scorm.getAPIVersion() === "1.2") {
                return value === "t" ? "true" : "false"; // put it back to expected format
            }
            return value;
        case 'choice':
            // Do if condition here for SCORM 1.2 then break;  Same format as sequence in 2004.
        case 'sequencing':
            // a[,]b to array
            arr = value.split("[,]");
            value = arr;
            return value;
            /*
             * Fill In
             * This will expect an {Object} with optional values
             * {
             *      case_matters: true, // optional {Boolean}
             *      order_maters: true, // optional {Boolean}
             *      lang: 'en-us',      // optional, can also be alternate letter lang code {String}
             *      words: [            // required {Array}
             *          'word1',
             *          'word2'
             *      ]
             * }
             */
        case 'fill-in':
            // Word
            // {case_matters=true}{order_matters=true}{lang=en-us}word1[,]word2
            // In SCORM 1.2 this is alpha numeric only.  Need to handle with if/else.
            // Check for case_matters
            arr = findResponseType('case_matters', value);
            if (arr !== null) {
                if (arr[0].search(/^\{case_matters=(true|false)\}$/) !== -1) {
                    obj.case_matters = arr[0].substring('{case_matters='.length, arr[0].length - 1);
                    value = value.substring(arr[0].length, value.length); // trim off
                    scorm.debug("=== case matters" + value, 4);
                }
            }
            // Check for order_matters
            arr = findResponseType('order_matters', value);
            if (arr !== null) {
                if (arr[0].search(/^\{order_matters=(true|false)\}$/) !== -1) {
                    obj.order_matters = arr[0].substring('{order_matters='.length, arr[0].length - 1);
                    value = value.substring(arr[0].length, value.length); // trim off
                    scorm.debug("=== order matters" + value, 4);
                }
            }
            // Check for lang
            arr = findResponseType('lang', value);
            if (arr !== null) {
                if (arr[0].search(/^\{lang=.*?\}$/) !== -1) {
                    obj.lang = arr[0].substring('{lang='.length, arr[0].length - 1); // returns language value
                    value = value.substring(arr[0].length, value.length); // trim off
                }
            }
            obj.words = value.split("[,]");
            return obj;
            /*
             * Long Fill In
             * This will expect an {Object} with optional values
             * {
             *      case_matters: true,   // Optional {Boolean}
             *      lang: 'en-us',        // Optional, can also be alternate letter lang code {String}
             *      text: 'Bunch of text' // Required 4000 character limit {String}
             * }
             */
        case 'long-fill-in':
            // Bunch of text...
            // {case_matters=true}{lang=en}Bunch of text...
            // Unsupported in SCORM 1.2
            // Check for case_matters
            arr = findResponseType('case_matters', value);
            if (arr !== null) {
                if (arr[0].search(/^\{case_matters=(true|false)\}$/) !== -1) {
                    obj.case_matters = arr[0].substring('{case_matters='.length, arr[0].length - 1);
                    value = value.substring(arr[0].length, value.length); // trim off
                    scorm.debug("=== case matters" + value, 4);
                }
            }
            // Check for lang
            arr = findResponseType('lang', value);
            if (arr !== null) {
                if (arr[0].search(/^\{lang=.*?\}$/) !== -1) {
                    obj.lang = arr[0].substring('{lang='.length, arr[0].length - 1); // returns language value
                    value = value.substring(arr[0].length, value.length); // trim off
                }
            }
            obj.text = value;
            return obj;
            /*
             * Matching
             * This will expect {Array} of {Array}'s
             * [
             *      ['tile1', 'target1'],
             *      ['tile2', 'target3'],
             *      ['tile3', 'target2']
             * ]
             */
        case 'matching':
            // tile1[.]target1[,]tile2[.]target3[,]tile3[.]target2
            arr = value.split("[,]");
            len = arr.length;
            i = 0;
            //for (i = 0; i < len; i += 1) {
            while (i < len) {
                arr[i] = arr[i].split("[.]"); // this isn't working
                i += 1;
            }
            return arr;
            /*
             * Performance
             * This will expect {Array} of {Array}'s
             * Similar to matching, but its optional to pass the step identifier
             * Correct Response Pattern: {Object}
             * {
             *  order_matters: false,
             *  answers: [
             *      ["step_1", "inspect wound"],
             *      ["step_2", "clean wound"],
             *      ["step_3", "apply bandage"]
             *  ]
             * }
             * Learner Response: [ {Array}
             *      ["step_1", "inspect wound"],
             *      ["step_2", "clean wound"],
             *      ["step_3", "apply bandage"]
             * ]
             */
        case 'performance':
            // {order_matters=false}tile1[.]target1[,]tile2[.]target3[,]tile3[.]target2
            // Check for order_matters (located in the correct_response pattern)
            arr = findResponseType('order_matters', value);
            if (arr !== null) {
                if (arr[0].search(/^\{order_matters=(true|false)\}$/) !== -1) {
                    match = true; // This is a correct_responses.n.pattern
                    obj.order_matters = arr[0].substring('{order_matters='.length, arr[0].length - 1);
                    value = value.substring(arr[0].length, value.length); // trim off
                    scorm.debug("=== order matters" + value, 4);
                }
            }
            arr = value.split("[,]");
            len = arr.length;
            i = 0;
            //for (i = 0; i < len; i += 1) {
            while (i < len) {
                arr[i] = arr[i].split("[.]"); // this isn't working
                i += 1;
            }
            if (match) {
                obj.answers = arr;
                return obj;
            }
            return arr;
        /**
         * Numeric
         * This falls into a simple hand off
         */
        case 'numeric':
            /*
             * LikeRT
             * No real hands on here, expects a {String}
             * This is like 'other', but expects a short identifier type
             */
        case 'likert':
            /*
             * Other
             * This will take a {String} and recommended not to go beyond 4000 chars
             */
        case 'other':
            // Anything up to 4000 characters
            return value; // Do nothing
        default:
            // Invalid
            scorm.debug(settings.prefix + ": Sorry, invalid interaction type detected for " + type + " on " + value, 1);
            return false;
        }
    }

    /**
     * Set Suspend Data
     * This will set existing suspend data managed by escaping the values
     * @returns {String} true (success) false (fail)
     */
    function setSuspendData() {
        var result,
            cleansedData = cleanseData(JSON.stringify(settings.suspend_data)),
            data = settings.base64 ? window.btoa(encodeURIComponent(cleansedData)) : encodeURIComponent(cleansedData);
        result = scorm.setvalue('cmi.suspend_data', data);
        if (result === 'true') {
            scorm.debug(settings.prefix + ": Suspend Data saved", 4);
            scorm.debug(settings.suspend_data, 4);
            return 'true';
        }
        return 'false';
    }

    /**
     * Check Progress
     * This should be used sparingly.  Its going to total up the scoring real-time based on any interactions and objectives.
     * If you are using objectives this feature is managing the status/scoring after you've setTotals.
     * cmi.score.scaled,
     * cmi.success_status,
     * cmi.completion_status,
     * cmi.progress_measure
     * @dependency setTotals where you tell SCOBot how many interactions and objectives you have.
     * @returns {*} object or false string
     * {
     *  score_scaled      = '0',
     *  success_status    = 'failed',
     *  progress_measure  = '0',
     *  completion_status = 'incomplete'
     * }
     * Updated in 4.0.4
     */
    function checkProgress() {
        if (scorm.isConnectionActive()) {
            var tmpRaw = 0,
                totalObjectivesCompleted = 0,
                i = 0,
                count;
            buffer.completion_status = scorm.getvalue('cmi.completion_status'); // refresh
            buffer.success_status    = scorm.getvalue('cmi.success_status'); // refresh
            buffer.score.raw         = 0; // reset to number for calculation
            if (settings.totalInteractions === 0 || settings.totalObjectives === 0) {
                // This is a non-starter, if the SCO Player doesn't set these we are flying blind
                scorm.debug(settings.prefix + ": Sorry, I cannot calculate Progress as the totalInteractions and or Objectives are zero", 2);
                return 'false';
            }
            // Set Score Totals (raw, min, max) and count up totalObjectivesCompleted
            count = parseInt(scorm.getvalue('cmi.objectives._count'), 10);
            scorm.debug(settings.prefix + ": Objectives Count is " + count);
            if (count > 0) {
                count = count - 1; //subtract 1 (max count)
                //for (i = count; i >= 0; i -= 1) {
                i = count;
                while (i >= 0) {
                    // Count up totalObjectivesCompleted
                    tmpRaw = parseFloat(scorm.getvalue('cmi.objectives.' + i + '.score.raw'));
                    scorm.debug(settings.prefix + ': Score Raw: ' + tmpRaw);
                    if (!isNaN(tmpRaw)) {
                        buffer.score.raw += parseFloat(tmpRaw); // Whoops, said Int instead of Float.  Updated 8/14
                    } else {
                        scorm.debug(settings.prefix + ": We got a NaN converting objectives." + i + ".score.raw.  This may be a global/local objective via the imsmanifest.xml.", 2);
                    }
                    if (scorm.getvalue('cmi.objectives.' + i + '.completion_status') === 'completed') {
                        totalObjectivesCompleted += 1;
                    }
                    i -= 1;
                }
            }
            // Set Score Raw
            // Convert buffer.score.raw to string
            buffer.score.raw = '' + buffer.score.raw; // reset to string for consistency
            // Set Score Scaled ///////////////////////
            if ((parseFloat(buffer.score.max) - parseFloat(buffer.score.min)) === 0) {
                // Division By Zero
                scorm.debug(settings.prefix + ": Division by Zero for scoreMax - scoreMin " + buffer.score.max, 2);
                buffer.score.scaled = '1'; // buffer it
            } else {
                buffer.score.scaled = '' + trueRound(((buffer.score.raw - buffer.score.min) / (buffer.score.max - buffer.score.min)), 7);
                scorm.debug(settings.prefix + ": Score Scaled = " + buffer.score.scaled, 3);
            }
            // Set Progress Measure ///////////////////
            buffer.progress_measure = '' + trueRound((totalObjectivesCompleted / settings.totalObjectives), 7);
            // Set Completion Status
            buffer.completion_status = (parseFloat(buffer.progress_measure) >= parseFloat(buffer.completion_threshold)) ? 'completed' : 'incomplete';

            // Set Success Status /////////////////////
            scorm.debug(settings.prefix + ": Pass/Fail check - Calculated scaled score:" + parseFloat(buffer.score.scaled) + " vs. " + parseFloat(buffer.scaled_passing_score), 3);
            buffer.success_status = (parseFloat(buffer.score.scaled) >= parseFloat(buffer.scaled_passing_score)) ? 'passed' : 'failed';

            if (!settings.doNotStatusUntilFinish) {
                scorm.debug(settings.prefix + " Setting score immediately...", 4);
                scorm.setvalue('cmi.score.raw', buffer.score.raw);
                scorm.setvalue('cmi.score.scaled', buffer.score.scaled); // default score for division by zero
                scorm.setvalue('cmi.progress_measure', buffer.progress_measure);
                scorm.setvalue('cmi.completion_status', buffer.completion_status);
                scorm.setvalue('cmi.success_status', buffer.success_status);
            }
            // Cleaning this up since these values were just set, no reason to recall
            return {
                score_scaled:      buffer.score.scaled,     //scorm.getvalue('cmi.score.scaled'),
                success_status:    buffer.success_status,   //scorm.getvalue('cmi.success_status'),
                progress_measure:  buffer.progress_measure, //scorm.getvalue('cmi.progress_measure'),
                completion_status: buffer.completion_status //scorm.getvalue('cmi.completion_status')
            };
        }
        return notStartedYet();
    }

    /**
     * Get Comments From LMS
     * Checks to see if there are any comments from the LMS, and will
     * return a complete object back for use with a display.
     * @return {*} object or 'false'
     */
    function getCommentsFromLMS() {
        if (scorm.isConnectionActive()) {
            var p1 = "cmi.comments_from_lms.",
                count = scorm.getvalue(p1 + '_count'),
                response = [],
                obj = {},
                i;
            if (!isBadValue(count)) {
                return 'false';
            }
            count -= 1;
            i = 0;
            //for (i = 0; i <= count; i += 1) {
            while (i <= count) {
                p1 += i + '.';
                obj.comment   = scorm.getvalue(p1 + 'comment');
                obj.location  = scorm.getvalue(p1 + 'location');
                obj.timestamp = scorm.getvalue(p1 + 'timestamp');
                response.push(obj);
                obj = {};
                i += 1;
            }
            return response;
        }
        return notStartedYet();
    }

    /**
     * Update Status
     * This is used as a catch-all in the event your default exit type is 'finish' or is also part of a exit strategy
     * to make sure completion and success are filled in.  You may not score the student in these situations.
     * If values are set outside of defaults they are overwritten (ignored).
     */
    function updateStatus(ending) {
        if (ending && SCOBotManagedStatus) {
            scorm.debug(settings.prefix + ": I am finishing... storing score on finish? " + settings.doNotStatusUntilFinish, 3);
            if (settings.doNotStatusUntilFinish) {

                scorm.setvalue('cmi.score.raw', buffer.score.raw);
                scorm.setvalue('cmi.score.scaled', buffer.score.scaled); // default score for division by zero
                scorm.setvalue('cmi.progress_measure', buffer.progress_measure);
                scorm.setvalue('cmi.completion_status', buffer.completion_status);
                return scorm.setvalue('cmi.success_status', buffer.success_status);
            }
        }
        if (!happyEndingRequest) {
            var ss = 'cmi.success_status',
                cs = 'cmi.completion_status',
                defss = scorm.get('success_status'),
                defcs = scorm.get('completion_status'),
                storss = self.getvalue(ss),
                storcs = self.getvalue(cs),
                isSuccessSet = false,
                isCompletionSet = false;
            if (storss === "passed" || storss === "failed") {
                isSuccessSet = true;
            }
            if (storcs === "completed" || storcs === "incomplete") {
                isCompletionSet = true;
            }
            if (scorm.get('exit_type') === 'finish' || ending) {
                if (storss !== defss && !isSuccessSet) {
                    scorm.debug(settings.prefix + ": Overriding default success status to " + defss, 3);
                    self.setvalue(ss, defss);
                }
                // Modified to set if completion_status wishes to be persisted.  Otherwise it will not be set.
                if (scorm.getAPIVersion() === "1.2" && settings.scorm_status_persist === "completion_status" && !isCompletionSet) {
                    self.setvalue(cs, defcs);
                } else {
                    if (storcs !== defcs && !isCompletionSet) {
                        scorm.debug(settings.prefix + ": Overriding default completion status to " + defcs, 3);
                        self.setvalue(cs, defcs);
                    }
                }
            }
        }
    }
    // End Private ////////////
    ///////////////////////////
    // Public /////////////////
    /**
     * Start (Internal API)
     * Initializes the SCORM Startup, and communicates with SCORM (cruise control)
     * and will begin to store some common used parameters for use later. Like:
     * 1. mode
     * 2. location (bookmark)
     * 3. scaled_passing_score
     * 4. suspend_data
     * 5. completion_status
     * 6. success_status
     * These can be obtained by asking SB.get('location'); i.e. the name space for these after you start,
     * and during the session.
     * @returns {Boolean}
     */
    this.start = function () {
        var tmpLaunchData = '',
            tmpCompletionThreshold = '',
            tmpScaledPassingScore = '',
            objectiveCountCheck;
        //queryStringExp = /\\?([^?=&]+)(=([^&#]*))?/gi;
        scorm.debug(settings.prefix + ": I am starting...", 3);
        if (!isStarted) {
            isStarted = true;
            // Retrieve normal settings/parameters from the LMS
            // Get SCO Mode (normal, browse, review)
            settings.startTime = currentTime();
            tmpLaunchData = scorm.getvalue('cmi.launch_data');
            // Turn this into a object and differ between json or querystring formats.
            if (settings.launch_data_type === "json") {
                settings.launch_data = JSON.parse(tmpLaunchData);
            } else {
                /*jslint unparam: true*/
                tmpLaunchData.replace(
                    new RegExp("([^?=&]+)(=([^&]*))?", "g"),
                    function ($0, $1, $2, $3) {
                        settings.launch_data[$1] = $3;
                    }
                );
                /*jslint unparam: false*/
            }
            scorm.debug(settings.prefix + ": Launch Data:", 4);
            scorm.debug(settings.launch_data, 4);
            settings.mode = scorm.getvalue('cmi.mode'); // normal, browse, review
            /*
             * Entry is interesting.  You may or may not be able to rely on it. If the LMS sets it you'd
             * be able identify if this is the first time (ab-intio), or if your resuming.  This would let you know if
             * there was even a bookmark, suspend data to even fetch.  Else, you may have to plug at it anyway.
             * So is it really worth it to bother with this?  Feel free to change the below to fit your needs.
             * In review mode, we will just assume we are actually reviewing a session.  Entry is really void at
             * that point, regardless of what the entry type is.  If the LMS is doing odd stuff, let me know, and I may
             * be able to shed some light on it.
             */
            settings.entry = scorm.getvalue('cmi.entry'); // ab-initio, resume or empty
            // Entry Check-up ...
            if (settings.mode === "review" || settings.entry === '' || settings.entry === 'resume') { // Resume, or possible Resume
                scorm.debug(settings.prefix + ": Resuming...", 4);
                // Get Bookmark
                settings.location = scorm.getvalue('cmi.location');
                /* Suspend Data technically should be a JSON String.  Structured data would be best suited to
                 * be recorded this way.  If you don't want to do this, you'll need to back out this portion.
                 * Also, in order to eliminate foreign keys and other special characters from messing up some
                 * LMS's we commonly escape going out, and unescape coming in.  I noticed this was increasing
                 * the suspend_data string length by almost 50%.  I'm opting to use a cleanseData() method now
                 * to define a whitelist of safe characters.  We may even need to base64.
                 * !IMPORTANT- once you do this, your kinda stuck with it.  SCO's will begin to save suspend data
                 * and if you change mid-stream your going to have to handle the fact you need to reverse support
                 * old saved data.  Don't fall victim to this little gem.
                 * GOAL: Deal with this in a managed way, but allow people to use it without the management.
                 * 11-26-2014 - Adding base64 Support which you can choose to set to true/false.  Please keep in mind
                 * that IE 6, 7, 8, 9 may require the use of a polyfill since they don't support window.atob/btoa
                 */
                settings.suspend_data = settings.base64 ? decodeURIComponent(window.atob(scorm.getvalue('cmi.suspend_data'))) : decodeURIComponent(scorm.getvalue('cmi.suspend_data')); // no longer unescaping
                // Quality control - You'd be surprised at the things a LMS responds with
                if (settings.suspend_data.length > 0 && !isBadValue(settings.suspend_data)) {
                    // Assuming a JSON String
                    scorm.debug(settings.prefix + ": Returning suspend data object from a prior session", 4);
                    /* you may not be using JSON suspend data, and managing that yourself. */
                    settings.suspend_data = settings.useJSONSuspendData ? JSON.parse(settings.suspend_data) : settings.suspend_data; // Turn this back into a object.
                    scorm.debug(settings.suspend_data, 4);
                    if (settings.entry === "") {
                        settings.entry = "resume";
                    } // most definitely its a resume if there is suspend data.
                } else {
                    scorm.debug(settings.prefix + ": Creating new suspend data object", 4);
                    // Object already created by default see settings.suspend_data
                }
            } else {
                // First time
                scorm.debug(settings.prefix + ": First time running this SCO based on LMS entry value.", 4);
                scorm.debug(settings.prefix + ": Creating new suspend data object", 4);
                // SCOBot: Consider warning the developer of a Platform that already has a objective present.
                objectiveCountCheck = parseInt(scorm.getvalue('cmi.objectives._count'), 10);
                if (objectiveCountCheck > 0 ) {
                    scorm.debug(settings.prefix + ": Warning, there are/is " + objectiveCountCheck + " objective(s) already present in this attempt!", 2);
                }
            }
            // Scaled Passing Score
            tmpCompletionThreshold = scorm.getvalue('cmi.completion_threshold'); // Snapshot Completion Threshold
            if (!isBadValue(tmpCompletionThreshold) && tmpCompletionThreshold !== "-1") {
                buffer.completion_threshold = tmpCompletionThreshold; // Override from imsmanifest.xml
            }
            // Completion Threshold is read-only so it comes from the CAM (imsmanifest.xml) or you manage it yourself.
            tmpScaledPassingScore = scorm.getvalue('cmi.scaled_passing_score'); // This may be empty, default otherwise
            if (!isBadValue(tmpScaledPassingScore) && tmpScaledPassingScore !== "-1") {
                /*
                 * Sanity check, we may have a LMS that allows the teacher to set a passing score.
                 * This may or may not actually be what we are expecting (out of spec with SCORM 2004)
                 * Change 75 to 0.75 just in case.  Possibly a relic from SCORM 1.2.
                 */
                if (parseFloat(tmpScaledPassingScore > 1)) {
                    buffer.scaled_passing_score = '' + ((parseFloat(tmpScaledPassingScore) * 10) / 1000);
                }
                settings.scaled_passing_score = buffer.scaled_passing_score; // Override from imsmanifest.xml
            }
            // Replace current state and status
            buffer.completion_status = scorm.getvalue('cmi.completion_status'); // buffer current status
            buffer.success_status    = scorm.getvalue('cmi.success_status');    // buffer current status
            // Lets check for Comments from the LMS
            settings.comments_from_lms = getCommentsFromLMS();
            if (settings.comments_from_lms !== 'false') {
                // Custom Event Trigger load
                Utl.triggerEvent(self, 'comments_lms', {data: settings.comments_from_lms});
            }
            // Check if there is a max_time_allowed
            settings.max_time_allowed = scorm.getvalue('cmi.max_time_allowed');
            if (isISO8601Duration(settings.max_time_allowed)) {
                if (settings.initiate_timer) {
                    scorm.debug(settings.prefix + ": This SCO has a set time, I am starting the timer for " + settings.max_time_allowed + "...");
                    self.startTimer();
                }
            } else {
                scorm.debug(settings.prefix + ": This is not ISO8601 time duration. " + settings.max_time_allowed);
            }
        } else {
            scorm.debug(settings.prefix + ": You already called start!  I don't see much point in doing this more than once.", 2);
            return false;
        }
        return true;
    };
    /**
     * Set Totals
     * This will take in total objectives, interactions, score max and score min to aid
     * in the calculation of a score rollup.
     * @param data {Object}
     * {
     *  totalInteractions: '0',
     *  totalObjectives: '0',
     *  scoreMin: '0',
     *  scoreMax: '0'
     * }
     * @returns {String} 'true' or 'false'
     */
    this.setTotals = function (data) {
        SCOBotManagedStatus = true;
        if (scorm.isConnectionActive()) {
            if (!isBadValue(data.totalInteractions)) {
                settings.totalInteractions = data.totalInteractions;
            }
            if (!isBadValue(data.totalObjectives)) {
                settings.totalObjectives = data.totalObjectives;
            }
            if (!isBadValue(data.scoreMin)) {
                buffer.score.min = trueRound(data.scoreMin, 7);
                scorm.setvalue('cmi.score.min', '' + buffer.score.min);
            }
            if (!isBadValue(data.scoreMax)) {
                buffer.score.max = trueRound(data.scoreMax, 7);
                scorm.setvalue('cmi.score.max', '' + buffer.score.max);
            }
            return 'true';
        }
        return notStartedYet();
    };
    /**
     * Start Timer
     * This will begin the timer based on the time provided by max_time_allowed.  This depends on the time_limit_action.
     */
    this.startTimer = function () {
        var time = scorm.ISODurationToCentisec(settings.max_time_allowed) * 10;
        if (time === 0) {
            scorm.debug(settings.prefix + "Recieved a zero duration.  Ignoring.", 2);
        } else {
            setTimeout(timesUp, time);
        }
    };
    /**
     * Debug
     * Relay so you don't have to say scorm vs SB
     * @type {*} *see SCORM_API debug
     */
    this.debug = scorm.debug;
    /**
     * Get Value
     * Relay so you can keep talking to SCOBot for one-to-one SCORM calls.
     * @type {*|Function} *see SCORM_API getvalue
     */
    this.getvalue = scorm.getvalue;
    /**
     * Set Value
     * Relay so you can keep talking to SCObot for one-to-one SCORM calls.
     * @type {*|Function} *see SCORM_API setvalue
     */
    this.setvalue = scorm.setvalue;
    /**
     * Get Mode
     * This will return the current SCO Mode we are in (normal, browse, review)
     * @returns {String} normal, browse, review
     */
    this.getMode = function () {
        if (scorm.isConnectionActive()) {
            return settings.mode;
        }
        return notStartedYet();
    };
    /**
     * Get Entry
     * This will return the entry type (ab-initio, resume or "")
     * @returns {String} ab-initio, resume , ""
     */
    this.getEntry = function () {
        if (scorm.isConnectionActive()) {
            return settings.entry;
        }
        return notStartedYet();
    };
    /**
     * Set Bookmark
     * This will update the local snap shot, and update SCORM (commit still required)
     * @param v {String} value
     * returns {String} 'true' or 'false'.
     */
    this.setBookmark = function (v) {
        if (scorm.isConnectionActive()) {
            settings.location = '' + v; // update local snapshot, ensure string
            return scorm.setvalue('cmi.location', settings.location);
        }
        return notStartedYet();
    };
    /**
     * Get Bookmark
     * This will return the local snapshot, but is in sync with cmi.location
     * @returns {String} bookmark
     */
    this.getBookmark = function () {
        if (scorm.isConnectionActive()) {
            return settings.location; // return local snapshot
        }
        return notStartedYet();
    };
    /**
     * Progress
     * Hooks to Private method used possibly elsewhere in this API
     * cmi.score.scaled,
     * cmi.success_status,
     * cmi.completion_status,
     * cmi.progress_measure
     * @returns {Object}
     */
    this.progress = checkProgress;
    /**
     * Set Suspend Data By Page ID
     * This will set the suspend data by id (could be a page ID as long as its unique)
     * Suspend data is a 64,000 character string.  In this case it will be a JSON Object that
     * freely converts to a JSON String or Object.
     * Now you could require that the end user have a id in their data object, or in this case keep it
     * separate for search ability.  Either way you'll have to verify they are passing a id.
     * I've opted to make them pass the ID.  I'm also opting to keep this as a object instead of
     * just a page array.  You may want to add more things to suspend data than just pages.
     * Example structure of this:
     * {
     *  sco_id: '12345',
     *  name: 'value',
     *  pages: [
     *      {
     *          id: 1,
     *          title: 'Presentation',
     *          data: {data object for a page}
     *      },
     *      {
     *          id: 2,
     *          title: 'Match Game',
     *          data: {data object for a page}
     *     }
     *  ]
     * };
     * Calling commit will still be needed to truly save it.
     * @param id {*}
     * @param title {String}
     * @param data {Object}
     * @returns {String}
     */
    this.setSuspendDataByPageID = function (id, title, data) {
        if (scorm.isConnectionActive()) {
            // Suspend data is a array of pages by ID
            var i = 0,
                len = settings.suspend_data.pages.length;
            //for (i = 0; i < len; i += 1) {
            while (i < len) {
                if (settings.suspend_data.pages[i].id === id) {
                    // Update Page data
                    settings.suspend_data.pages[i].data = data; // overwrite existing
                    scorm.debug(settings.prefix + ": Suspend Data Set", 4);
                    scorm.debug(settings.suspend_data, 4);
                    return setSuspendData();
                    //return 'true';
                }
                i += 1;
            }
            // new page push
            settings.suspend_data.pages.push({'id': id, 'title': title, 'data': data});
            scorm.debug(settings.prefix + ": Suspend Data set:", 4);
            scorm.debug(settings.suspend_data, 4);
            return setSuspendData();
            //return 'true';
        }
        return notStartedYet();
    };
    /**
     * Get Suspend Data By Page ID
     * This will get the suspend data by id
     * @param id {*}
     * @returns {*} object, but false if empty.
     */
    this.getSuspendDataByPageID = function (id) {
        if (scorm.isConnectionActive()) {
            // Suspend data is a array of pages by ID
            var i = 0,
                len = settings.suspend_data.pages.length;
            //for (i = 0; i < len; i += 1) {
            while (i < len) {
                if (settings.suspend_data.pages[i].id === id) {
                    return settings.suspend_data.pages[i].data;
                }
                i += 1;
            }
            return 'false';
        }
        return notStartedYet();
    };
    /**
     * Get Time From Start
     *
     */
    this.getSecondsFromStart = function () {
        return settings.startTime - currentTime(); // turn in to seconds
    };
    /**
     * Set Interaction
     * This will set an interaction based on Journaling or State.
     * Parameter for choosing a version is located in the defaults.
     * Note: If you are recording Journaling make sure its something the LMS
     * supports or plans to support, or your just blimping out your interactions array
     * for no reason.
     * You may ask what is "real(10,7)".  This is a binary floating point with a precision up to 7 characters to the right of the decimal.
     * Example Data Object:
     * {
     *  id: '1',                             // 4000 chars
     *  type: 'true-false',                  // (true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other)
     *  objectives: [
     *    {
     *       id: '12'
     *    }
     *  ],
     *  timestamp: 'expects date object when interaction starts',  // second(10,0) Pass a date object
     *  correct_responses: [
     *      {
     *          pattern: ''                  // depends on interaction type
     *      }
     *  ],
     *  weighting: '1',
     *  learner_response: 'true',
     *  result: 'correct',                   // (correct, incorrect, unanticipated, neutral, real (10,7) )
     *  latency: 'expects date object after interaction is done',  // second(10,2)
     *  description: "The question commonly" // 250 chars
     * }
     * @param data {Object} Interaction Object from SCORM
     * @returns {String} 'true' or 'false'
     */
    this.setInteraction = function (data) {
        if (scorm.isConnectionActive()) {
            var version = scorm.getAPIVersion(),
                n, // Reserved for the count within interactions.n
                m, // Reserved for the count within interactions.n.objectives.m
                i, // Reserved for objective loop
                j, // Reserved for correct responses loop
                p, // Reserved for the count within interactions.n.ncorrect_responses.p loop
                p1 = 'cmi.interactions.', // Reduction of retyping
                p2, // Reduction of retyping
                orig_timestamp = data.timestamp || scorm.isoStringToDate(scorm.getvalue(p1 + scorm.getInteractionByID(data.id) + '.timestamp')),
                timestamp, // Reserved for converting the Timestamp
                latency, // Reserved for doing the Timestamp to latency conversion (May not exist)
                result, // Result of calling values against the SCORM API
            //cr,
            //cr_hash = '', // Correct Response limit is 5.  If you pass duplicates I'm going to stop it from happening.
                len,
                key;
            if (!Utl.isPlainObject(data)) {
                scorm.debug(settings.prefix + ": Developer, your not passing a {object} argument!!  Got " + typeof data + " instead.", 1);
                return 'false';
            }
            if (isBadValue(data.id)) {
                // This is a show stopper, try to give them some bread crumb to locate the problem.
                scorm.debug(settings.prefix + ": Developer, your passing a interaction without a ID\nSee question:\n" + data.description, 1);
                for (key in data) {
                    if (data.hasOwnProperty(key)) {
                        scorm.debug("key: " + key + "\n value: " + data[key]);
                    }
                }
                return 'false';
            }
            //Time stuff will need to move after ID is added
            //if (typeof (data.timestamp) === "object") {
            if (Utl.type(data.timestamp) === "date") {
                timestamp = scorm.getAPIVersion() === "1.2" ? scorm.dateToscorm12Time(data.timestamp) : scorm.isoDateToString(data.timestamp); // HH:MM:SS vs 2012-02-12T00:37:29
            }
            data.timestamp = timestamp; // SCORM API Will convert timestamp to time
            //if (typeof (data.latency) === "object") {
            if (Utl.type(data.latency) === "date") {
                latency = (data.latency.getTime() - orig_timestamp.getTime()) * 0.001;
                data.latency = scorm.getAPIVersion() === "1.2" ? scorm.centisecsToSCORM12Duration(latency * 100) : scorm.centisecsToISODuration(latency * 100, true);
            } else if (data.learner_response.length > 0 && !isBadValue(data.learner_response)) {
                // may want to force latency?
                data.latency = new Date();
                latency = (data.latency.getTime() - orig_timestamp.getTime()) * 0.001;
                data.latency = scorm.getAPIVersion() === "1.2" ? scorm.centisecsToSCORM12Duration(latency * 100) : scorm.centisecsToISODuration(latency * 100, true);
            } // Else you won't record latency as the student didn't touch the question.
            // Check for Interaction Mode
            p2 = '_count';
            if (settings.interaction_mode === "journaled" || version === "1.2") {
                // Explicitly stating they want a history of interactions (default behavior of SCORM 1.2)
                n = scorm.getvalue(p1 + p2) === "-1" ? '0' : scorm.getvalue(p1 + p2); // we want to use cmi.interactions._count
            } else {
                // Default to state, which will update by id
                n = scorm.getInteractionByID(data.id); // we want to update by interaction id
                if (isBadValue(n)) {
                    n = scorm.getvalue(p1 + p2) === "-1" ? '0' : scorm.getvalue(p1 + p2);
                }
            }
            /*
             * We need to make several setvalues now against cmi.interactions.n.x
             * As stated by the standard, if we run into issues they will show in the log from the SCORM API.
             * I won't currently do anything at this point to handle them here, as I doubt there is little that could be done.
             */
            p1 += n + "."; // Add n to part 1 str
            if (!isBadValue(data.id)) {
                result = scorm.setvalue(p1 + 'id', data.id);
            }
            if (!isBadValue(data.type)) {
                if (scorm.getAPIVersion() === "1.2") {
                    switch (data.type) {
                    case "other":
                    case "long-fill-in":
                        data.type = "fill-in";
                        break;
                    default:
                        break;
                    }
                }
                result = scorm.setvalue(p1 + 'type', data.type); // SCORM 1.2 doesn't support long-fill-in or other.  May need to re-route?  Performance or fill-in?
            }
            // Objectives will require a loop within data.objectives.length, and we may want to validate if an objective even exists?
            // Either ignore value because its already added, or add it based on _count
            // result = scorm.setvalue('cmi.interactions.'+n+'.objectives.'+m+".id", data.objectives[i].id);
            p2 = 'objectives._count';
            if (data.objectives !== undefined) {
                i = 0;
                len = data.objectives.length;
                while (i < len) {
                //for (i = 0; i < data.objectives.length; i += 1) {
                    // We need to find out if the objective is already added
                    m = scorm.getInteractionObjectiveByID(n, data.objectives[i].id); // will return 0 or the locator where it existed or false (not found)
                    if (m === 'false') {
                        m = scorm.getvalue(p1 + p2) === '-1' ? '0' : scorm.getvalue(p1 + p2);
                    }
                    result = scorm.setvalue(p1 + 'objectives.' + m + '.id', data.objectives[i].id);
                    i += 1;
                }
            }
            if (data.timestamp !== undefined) {
                if (version !== "1.2") {
                    result = scorm.setvalue(p1 + 'timestamp', data.timestamp);
                } else {
                    result = scorm.setvalue(p1 + 'time', data.timestamp);
                }
            }
            // Correct Responses Pattern will require a loop within data.correct_responses.length, may need to format by interaction type
            //result = scorm.setvalue('cmi.interactions.'+n+'.correct_responses.'+p+'.pattern', data.correct_responses[j].pattern);
            p2 = 'correct_responses._count';
            if (Utl.isArray(data.correct_responses)) {
                // !! Important, some only support 1 correct response pattern (likert, other) !!
                j = 0;
                len = data.correct_responses.length;
                while (j < len) {
                //for (j = 0; j < len; j += 1) {
                    p = scorm.getInteractionCorrectResponsesByPattern(n, data.correct_responses[j].pattern);
                    scorm.debug(settings.prefix + ": Trying to locate pattern " + data.correct_responses[j].pattern + " resulted in " + p, 4);
                    if (p === 'false') {
                        p = scorm.getvalue(p1 + p2) === '-1' ? 0 : scorm.getvalue(p1 + p2);
                        scorm.debug(settings.prefix + ": p is now " + p, 4);
                    }
                    if (p === "match") {
                        scorm.debug(settings.prefix + ": Developer, I've already added this correct response type '" + data.correct_responses[j].pattern + "'", 2);
                    } else {
                        result = scorm.setvalue(p1 + 'correct_responses.' + p + '.pattern', encodeInteractionType(data.type, data.correct_responses[j].pattern));
                    }
                    j += 1;
                }
            } else {
                scorm.debug(settings.prefix + ": Something went wrong with Correct Responses, it wasn't an Array.", 1);
            }
            if (!isBadValue(data.weighting)) {
                result = scorm.setvalue(p1 + 'weighting', data.weighting);
            }
            if (!isBadValue(data.learner_response)) {
                if (version !== "1.2") {
                    result = scorm.setvalue(p1 + 'learner_response', encodeInteractionType(data.type, data.learner_response));
                } else {
                    result = scorm.setvalue(p1 + 'student_response', encodeInteractionType(data.type, data.learner_response));
                }
            } // will need to format by interaction type
            if (!isBadValue(data.result)) {
                result = scorm.setvalue(p1 + 'result', data.result);
            }
            if (!isBadValue(data.latency)) {
                result = scorm.setvalue(p1 + 'latency', data.latency);
            }
            if (version !== "1.2") { // not supported in SCORM 1.2
                if (!isBadValue(data.description)) {
                    result = scorm.setvalue(p1 + 'description', data.description);
                }
            }
            return result;
        }
        return notStartedYet();
    };
    /**
     * Get Interaction
     * Returns the full Interaction object
     * @param id {String}
     * @returns {*} object or string 'false'
     * {
     *  id: '1',                             // 4000 chars
     *  type: 'true-false',                  // (true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other)
     *  objectives: [
     *      {
     *          id: '12'
     *      }
     *  ],
     *  timestamp: 'expects date object when interaction starts',  // second(10,0) Pass a date object
     *  correct_responses: [
     *      {
     *          pattern: ''                  // depends on interaction type
     *      }
     *  ],
     *  weighting: '1',
     *  learner_response: 'true',
     *  result: 'correct',                   // (correct, incorrect, unanticipated, neutral, real (10,7) )
     *  latency: 'expects date object after interaction is done',  // second(10,2)
     *  description: "The question commonly" // 250 chars
     * }
     * or
     * 'false'
     */
    this.getInteraction = function (id) {
        if (scorm.isConnectionActive()) {
            var n, // Interaction count
                p1 = 'cmi.interactions.', // Reduction of typing
                m, // objectives count
                p, // correct_responses count
                i = 0, // loop count
                obj = {}, // Response object
                ts, // temp
                ly, // temp
                timestamp, // for converting to date object
                latency; // for converting to date object
            n = scorm.getInteractionByID(id);
            if (n === 'false') {
                return n;
            }
            // Lets rebuild the Interaction object
            p1 += n + '.';
            obj.id = id;
            obj.type = scorm.getvalue(p1 + 'type');
            // SCORM 1.2 interactions are write only so no need to translate.  Shouldn't even allow it to make the call.
            m = scorm.getvalue(p1 + 'objectives._count');
            // Fix the time stamps up ...
            ts = scorm.getvalue(p1 + 'timestamp');
            ly = scorm.getvalue(p1 + 'latency');
            timestamp = (isISO8601(ts)) ? scorm.isoStringToDate(ts) : ts;
            latency = (isISO8601(ly)) ? scorm.isoStringToDate(ly) : ly;
            // End
            obj.objectives = [];
            if (m !== 'false') {
                //m -= 1; // Subtract one since the _count is the next avail slot
                while (i < m) {
                //for (i = 0; i < m; i += 1) {
                    obj.objectives.push({
                        id: scorm.getvalue(p1 + 'objectives.' + i + '.id')
                    });
                    i += 1;
                }
            }
            obj.timestamp = timestamp;
            p = scorm.getvalue(p1 + 'correct_responses._count');
            obj.correct_responses = [];
            if (p !== 'false') {
                // Loop thru and grab the patterns
                i = 0;
                while (i < p) {
                //for (i = 0; i < p; i += 1) {
                    obj.correct_responses.push({
                        pattern: decodeInteractionType(obj.type, scorm.getvalue(p1 + 'correct_responses.' + i + '.pattern'))
                    });
                    i += 1;
                }
            }
            obj.weighting = scorm.getvalue(p1 + 'weighting');
            obj.learner_response = decodeInteractionType(obj.type, scorm.getvalue(p1 + 'learner_response'));
            obj.result = scorm.getvalue(p1 + 'result');
            obj.latency = latency;
            obj.description = scorm.getvalue(p1 + 'description');
            return obj;
        }
        return notStartedYet();
    };
    /**
     * Set Objective
     * Sets the data for the scorm objective.  ID's have to be set first and must be unique.
     * Example data object
     * {
     *  id: '1',                            // 4000 chars
     *  score: {
     *      scaled: '0',                    // real(10,7) *
     *      raw: '0',
     *      min: '0',
     *      max: '0'
     *  }
     *  success_status: 'failed',            // (passed, failed, unknown)
     *  completion_status: 'incomplete',     // (completed, incomplete, not attempted, unknown)
     *  progress_measure: '0',               // real(10,7)
     *  description: 'This is the objective' // 250 Chars
     * }
     * @param data {Object} Objective object from SCORM
     * @returns {String} 'true' or 'false'
     */
    this.setObjective = function (data) {
        if (scorm.isConnectionActive()) {
            var p1 = 'cmi.objectives.',
                n = scorm.getObjectiveByID(data.id),
                result = 'false',
                f = false,
                def1 = ": Passed no or bad ",
                def2 = " ignored.",
                sv = scorm.setvalue,
                key,
                version = scorm.getAPIVersion();
            scorm.debug(settings.prefix + ": Setting Objective at " + n + " (This may be false)");
            if (isBadValue(n)) { // First Run
                n = scorm.getvalue(p1 + '_count');
                if (n === 'false') {
                    scorm.debug(settings.prefix + ": LMS is return false, can not proceed, check error codes");
                    return n;
                }
                scorm.debug(settings.prefix + ": Objective " + data.id + " was not found.  Adding new at " + n + " " + data.description);
                f = true;
            }
            p1 += n + '.';
            if (f) {
                if (!isBadValue(data.id)) {
                    sv(p1 + 'id', '' + data.id);
                } else { // Show stopper
                    scorm.debug(settings.prefix + ": You did not pass an objective ID!!  What I did get below:", 1);
                    for (key in data) {
                        if (data.hasOwnProperty(key)) {
                            scorm.debug("key: " + key + "\n value: " + data[key]);
                        }
                    }
                    return 'false';
                }
            }
            if (Utl.isPlainObject(data.score)) {
                if (version === "2004") {
                    result = !isBadValue(data.score.scaled) ? sv(p1 + 'score.scaled', trueRound(data.score.scaled, 7).toString()) : scorm.debug(settings.prefix + def1 + p1 + "score.scaled: " + data.score.scaled + def2, 3);
                }
                result = !isBadValue(data.score.raw) ? sv(p1 + 'score.raw', trueRound(data.score.raw, 7).toString()) : scorm.debug(settings.prefix + def1 + p1 + "score.raw: " + data.score.raw + def2, 3);
                result = !isBadValue(data.score.min) ? sv(p1 + 'score.min', trueRound(data.score.min, 7).toString()) : scorm.debug(settings.prefix + def1 + p1 + "score.min: " + data.score.min + def2, 3);
                result = !isBadValue(data.score.max) ? sv(p1 + 'score.max', trueRound(data.score.max, 7).toString()) : scorm.debug(settings.prefix + def1 + p1 + "score.max: " + data.score.max + def2, 3);
            } else {
                scorm.debug(settings.prefix + ": Did not receive a score object.  May or may not be an issue.", 4);
            }
            if (version === "2004") {
                result = !isBadValue(data.success_status) ? sv(p1 + 'success_status', data.success_status) : scorm.debug(settings.prefix + def1 + p1 + "success_status: " + data.success_status + def2, 3);
                result = !isBadValue(data.completion_status) ? sv(p1 + 'completion_status', data.completion_status) : scorm.debug(settings.prefix + def1 + p1 + "completion_status: " + data.completion_status + def2, 3);
                result = !isBadValue(data.progress_measure) ? sv(p1 + 'progress_measure', data.progress_measure) : scorm.debug(settings.prefix + def1 + p1 + "progress_measure: " + data.progress_measure + def2, 3);
                result = !isBadValue(data.description) ? sv(p1 + 'description', data.description) : scorm.debug(settings.prefix + def1 + p1 + "description: " + data.description + def2, 3);
            } else {
                // Above not supported by SCORM 1.2, but 'status' could be success_status or completion_status
                result = !isBadValue(data[settings.scorm_status_persist]) ? sv(p1 + 'status', data[settings.scorm_status_persist]) : scorm.debug(settings.prefix + def1 + p1 + "status: " + data[settings.scorm_status_persist] + def2, 3);
            }
            scorm.debug(settings.prefix + ": Progress\n" + JSON.stringify(checkProgress(), null, " "), 4);
            return result.toString();
        }
        return notStartedYet();
    };
    /**
     * Get Objective
     * Returns the Objective object by ID
     * @param id {String}
     * @returns {*} object or string 'false'
     * {
     *  id: '1',                            // 4000 chars
     *  score: {
     *      scaled: '0',                    // real(10,7) *
     *      raw: '0',
     *      min: '0',
     *      max: '0'
     *  }
     *  success_status: 'failed',            // (passed, failed, unknown)
     *  completion_status: 'incomplete',     // (completed, incomplete, not attempted, unknown)
     *  progress_measure: '0',               // real(10,7)
     *  description: 'This is the objective' // 250 Chars
     * }
     * or
     * 'false'
     */
    this.getObjective = function (id) {
        if (scorm.isConnectionActive()) {
            var n = scorm.getObjectiveByID(id),
                p1 = 'cmi.objectives.';
            if (n === 'false') {
                return n;
            }
            p1 += n + ".";
            // Build Response
            return {
                id:                scorm.getvalue(p1 + "id"),
                score:             {
                    scaled: scorm.getvalue(p1 + "score.scaled"),            // false in SCORM 1.2
                    raw:    scorm.getvalue(p1 + "score.raw"),
                    min:    scorm.getvalue(p1 + "score.min"),
                    max:    scorm.getvalue(p1 + "score.max")
                },
                success_status:    scorm.getvalue(p1 + "success_status"),   // Merged with 'status'
                completion_status: scorm.getvalue(p1 + "completion_status"),
                progress_measure:  scorm.getvalue(p1 + "progress_measure"), // false in SCORM 1.2
                description:       scorm.getvalue(p1 + "description")       // false in SCORM 1.2
            };
        }
        return notStartedYet();
    };
    /**
     * Set Comment From Learner
     * This will set the comment, location and time the student made a comment
     * @param msg {String} comment
     * @param loc {String} location
     * @param date {Object} New Date object (for timestamp)
     * @return {String}
     */
    this.setCommentFromLearner = function (msg, loc, date) {
        if (scorm.isConnectionActive()) {
            var p1 = "cmi.comments_from_learner.",
                n = scorm.getvalue(p1 + "_count");
            if (n === 'false') {
                scorm.debug(settings.prefix + ": Sorry, LMS returned a comments count of 'false'.  Review error logs.");
                return n;
            }
            if (msg.length === 0 || msg.length > 4000) {
                scorm.debug(settings.prefix + ": Sorry, message from learner was empty or exceeded the limit. Length:" + msg.length, 2);
            }
            p1 += n + '.';
            scorm.setvalue(p1 + 'comment', msg);
            scorm.setvalue(p1 + 'location', loc);
            return scorm.setvalue(p1 + 'timestamp', scorm.isoDateToString(date));
        }
        return notStartedYet();
    };
    /**
     * Grade It
     * This method will set cmi.score.scaled, cmi.success_status, and cmi.completion_status.  This is for situations
     * where you are doing simple scoring, with NO objectives or interactions.
     * Prereq for this would be to have passed in scaled_passing_score and completion_threshold in to SCOBot
     * If none are provided it will default to 'passed' and 'completed'
     * Special Note: If you are using Objectives, Interactions and set the totals, you do not need to use this method.
     * @return {String} 'true' or 'false'
     */
    this.gradeIt = function () {
        var scoreScaled = 1,
            scoreRaw         = scorm.getvalue('cmi.score.raw'),
            scoreMin         = scorm.getvalue('cmi.score.min'),
            scoreMax         = scorm.getvalue('cmi.score.max');
        // Set Score Scaled
        if ((scoreMax - scoreMin) === 0) {
            // Division By Zero
            scorm.debug(settings.prefix + ": Division by Zero for scoreMax - scoreMin " + scoreMax, 2);
            scorm.setvalue('cmi.score.scaled', scoreScaled);
        } else {
            scoreScaled = '' + ((scoreRaw - scoreMin) / (scoreMax - scoreMin));
            scorm.debug(settings.prefix + ": Score Scaled = " + scoreScaled, 3);
            scorm.setvalue('cmi.score.scaled', trueRound(scoreScaled, 7));
        }
        // Set Completion Status
        if (buffer.completion_status !== "completed") {
            buffer.completion_status = (parseFloat(buffer.progress_measure) >= parseFloat(buffer.completion_threshold)) ? 'completed' : 'incomplete';
            scorm.setvalue('cmi.completion_status', buffer.completion_status);
        }
        // Set Success Status unless the default is passed (not graded typically or just auto scored)
        if (buffer.success_status !== "passed") {
            buffer.success_status = (parseFloat(scoreScaled) >= parseFloat(buffer.scaled_passing_score)) ? 'passed' : 'failed';
        }
        scorm.setvalue('cmi.success_status', buffer.success_status);
        return 'true';
    };
    /**
     * Happy Ending
     * This will auto-score the student to passed, completed, and scored
     * Make sure happyEnding is true, if you want to use this feature.
     * @return {String}
     */
    this.happyEnding = function () {
        var activeConn = scorm.isConnectionActive();
        SCOBotManagedStatus = false;
        if (activeConn && settings.happyEnding && !settings.doNotStatusUntilFinish) {
            happyEndingRequest = true;
            scorm.setvalue('cmi.score.scaled', '1');
            scorm.setvalue('cmi.score.min', '0');
            scorm.setvalue('cmi.score.max', '100');
            scorm.setvalue('cmi.score.raw', '100');
            scorm.setvalue('cmi.success_status', 'passed');
            scorm.setvalue('cmi.progress_measure', '1');
            return scorm.setvalue('cmi.completion_status', 'completed');
        }
        if (activeConn && settings.happyEnding && settings.doNotStatusUntilFinish) {
            happyEndingRequest = true;
            // Not ok
            buffer.score.scaled      = '1';
            buffer.score.raw         = '100';
            buffer.success_status    = 'passed';
            buffer.completion_status = 'completed';
            buffer.progress_measure  = '1';
            // ok
            scorm.setvalue('cmi.score.min', '0');
            return scorm.setvalue('cmi.score.max', '100');
        }
        return notStartedYet();
    };
    /**
     * Commit
     * This will commit the data stored at the LMS Level to the backend.  Please use sparingly.
     * @returns {String} 'true' or 'false'
     */
    this.commit = function () {
        if (scorm.isConnectionActive()) {
            return scorm.commit('');
        }
        return notStartedYet();
    };
    /**
     * Suspend
     * This will suspend the SCO and ends with terminating.  No data can be saved after this.
     * @returns {String} 'true' or 'false'
     */
    this.suspend = function () {
        if (scorm.isConnectionActive()) {
            scorm.debug(settings.prefix + ": I am suspending...", 3);
            scorm.setvalue('cmi.exit', 'suspend');
            // This will be resumed later.
            // updateStatus resevered for 'ending' calculations with default status values.
            isStarted = false;
            return scorm.terminate();
        }
        return notStartedYet();
    };
    /**
     * Finish
     * This will set success status, exit and completion
     * @returns {String} 'true' or 'false'
     */
    this.finish = function () {
        if (scorm.isConnectionActive()) {
            // Check sequence
            if (settings.sequencing.nav.request !== "_none_") { // don't bother unless its different
                scorm.setvalue('adl.nav.request', settings.sequencing.nav.request);
            }
            // Exit
            scorm.setvalue('cmi.exit', 'normal');
            // This is done/submitted per this call.  An attempt ending method.
            updateStatus(true);
            isStarted = false;
            return scorm.terminate();
        }
        return notStartedYet();
    };
    /**
     * Timeout
     * This will set success status, exit and completion
     * @returns {String} 'true' or 'false'
     */
    this.timeout = function () {
        if (scorm.isConnectionActive()) {
            scorm.debug(settings.prefix + ": I am timing out...", 3);
            scorm.setvalue('cmi.exit', 'time-out');
            // This is done/submitted per this call.  An attempt ending method.
            updateStatus(true);
            isStarted = false;
            return scorm.terminate();
        }
        return notStartedYet();
    };
    /**
     * Is ISO 8601 UTC
     * @returns {Boolean} true/false
     */
    this.isISO8601 = isISO8601;
    /**
     * Get API Version
     * Hook back to scorm in case your talking to SB exclusively
     * @returns {String} 1.2, 2004
     */
    this.getAPIVersion = scorm.getAPIVersion;
    /**
     * Set
     * This locally sets values local to this API
     * @param n {String} name
     * @param v (String,Number,Object,Array,Boolean} value
     * @return {Boolean}
     */
    this.set = function (n, v) {
        // May need to maintain read-only perms here, case them out as needed.
        switch (n) {
        case "version":
        case "createDate":
        case "modifiedDate":
        case "prefix":
        case "scaled_passing_score":
        case "completion_threshold":
            triggerWarning(405);
            break;
        default:
            settings[n] = v;
            break;
        }
        return (isError === false);
    };
    /**
     * Get
     * This locally gets values local to this API
     * @param n {String} name
     * @returns {*} value or {Boolean} false
     */
    this.get = function (n) {
        if (settings[n] === undefined) {
            triggerWarning(404);
            return false;
        }
        return settings[n];
    };
    // End Public //////////////
    /**
     * Wrap up Constructor
     * Certain versions of mozilla had an issue with not firing the window unload event.
     * At the time, I used window.top to get around this.  Later I started seeing with JQuery
     * different behavior once I incorporated it.  So at this point I'm using window not window.top.
     */
    Utl.addEvent(window, 'loaded', initSCO);
    Utl.addEvent(window, 'onbeforeunload', exitSCO); // you may want to prompt
    Utl.addEvent(window, 'unload', exitSCO);
    Utl.addEvent(scorm, 'exception', function (e) {
        triggerException(e.error);
    });
}
