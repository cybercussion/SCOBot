/*global debug, scorm, SCOBotUtil */
/*jslint devel: true, browser: true, nomen: true */
/**
 * SCOBot API_1484_11
 * Mimics LMS Connectivity in Local Mode i.e. standalone functionality, and is not meant to be confused with a actual
 * LMS Runtime Environment.  It does not include all the rich error management and is meant to be a light weight way to
 * continue to work offline to help saving you several round trips packaging and uploading your content to an LMS.
 * For a production Runtime, please see https://cybercussion.com/#!SCOBOT2004RTE
 *
 * jQuery dependency removed, and now utilizes SCOBotUtil.
 *
 * For your purposes you can override the cmi (student attempt) below vs. editing the one here (default).  Please read
 * more on the wiki via github. https://github.com/cybercussion/SCOBot
 *
 * Recommend a minify/merge before pushing to a production environment. (JSMin, YUI Compressor, Dojo Shrinksafe etc ...)
 *
 * @event StoreData
 *
 * @author Cybercussion Interactive, LLC <info@cybercussion.com>
 * @license Copyright (c) 2009-2016, Cybercussion Interactive LLC
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 * @requires SCOBotUtil, SCOBotBase
 * @version 4.1.5
 * @param options {Object} override default values
 * @constructor
 */
/*!
 * Local_API_1484_11, Updated January 1st, 2016
 * Copyright (c) 2009-2016, Cybercussion Interactive LLC.
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 */
function SCOBot_API_1484_11(options) {
    // Constructor
    "use strict";
    var Utl      = SCOBotUtil,
        defaults = {
            version:     "4.1.5",
            createdate:  "07/17/2010 08:15AM",
            moddate:     "03/04/2016 12:24PM",
            prefix:      "SCOBot_API_1484_11",
            errorCode:   0,
            diagnostic:  '',
            initialized: 0,
            terminated:  0,
            cmi: null,
            adl: null,
            // CMI is the Computer Managed Instruction object (the student attempt).  Edit these values as you see fit.
            CMI:         {
                _version:              "Local 1.0",
                comments_from_learner: {
                    _children: "comment,location,timestamp",
                    _count:    "0"
                },
                comments_from_lms:     {
                    _children: "comment,location,timestamp",
                    _count:    "0"
                },
                completion_status:     "unknown",
                completion_threshold:  "0.7",
                credit:                "no-credit",
                entry:                 "ab-initio",
                exit:                  "",
                interactions:          {
                    _children: "id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description",
                    _count:    "0"
                },
                launch_data:           "?name1=value1&name2=value2&name3=value3", // {\"name1\": \"value1\", \"name2\": \"value2\", \"name3\": \"value3\"} or ?name1=value1&name2=value2&name3=value3
                learner_id:            "100",
                learner_name:          "Simulated User",
                learner_preference:    {
                    _children:        "audio_level,language,delivery_speed,audio_captioning",
                    audio_level:      "1",
                    language:         "",
                    delivery_speed:   "1",
                    audio_captioning: "0"
                },
                location:              "",
                max_time_allowed:      "", // PT26.4S for 26.4 Seconds
                mode:                  "normal",
                objectives:            {
                    _children: "id,score,success_status,completion_status,description",
                    _count:    "0"
                },
                progress_measure:      "",
                scaled_passing_score:  "0.7",
                score:                 {
                    _children: "scaled,raw,min,max",
                    scaled:    "",
                    raw:       "",
                    min:       "",
                    max:       ""
                },
                session_time:          "PT0H0M0S",
                success_status:        "unknown",
                suspend_data:          "",
                time_limit_action:     "", // exit, no message or continue, message etc ...
                total_time:            "PT0H0M0S"
            },
            ADL: {
                nav: {
                    request: "_none_",
                    request_valid: {
                        choice  : {}, // "{target=<STRING>} - keep in mind you have no lesson structure in standalone mode"
                        continue: "false",
                        previous: "false"
                    }
                }
            }
        },
        // Settings merged with defaults and extended options */
        settings = Utl.extend(defaults, options),
        cmi = {},
        adl = {},
        /**
         * Completion Status's that are allowed
         */
        completion_status = "|completed|incomplete|not attempted|unknown|",
        /**
         Read Only values -
         The hash following could of been much simpler had certain name spaces always been read-only in all areas.
         This would of allowed me to just evaluate the last item and perform that rule globally.  The following are issues -
         id -       This is read-only under adl.data.n.id, and read/write everywhere else
         comments_from_lms are entirely read-only (global rule)
         timestamp is RO for comments from LMS
         */
        read_only = "|_version|completion_threshold|credit|entry|launch_data|learner_id|learner_name|_children|_count|mode|maximum_time_allowed|scaled_passing_score|time_limit_action|total_time|comment|",
        /**
         * Write Only values
         */
        write_only = "|exit|session_time|",
        exit = "|time-out|suspend|logout|normal||",
        nav_states = "|_none_|continue|previous|choice|exit|exitAll|abandon|abandonAll|suspendAll",
        errors     = {
            0:   "No error",
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
        },
        self = this;
    // Private
    /**
     * Throw Vocabulary Error
     * This sets the errorCode and Diagnostic for the key and value attempted.
     * @param k {String} key
     * @param v {String} value
     * @returns {String} 'false'
     */
    function throwVocabError(k, v) {
        settings.diganostic = "The " + k + " of " + v + " must be a proper vocabulary element.";
        settings.errorCode = 406;
        return 'false';
    }

    /**
     * Throw Unimplemented Error
     * 402 data model doesn't exist yet.
     * @param key {String}
     * @returns {String} 'false'
     */
    function throwUnimplemented(key) {
        settings.errorCode = 402;
        settings.diagnostic = 'The value for key ' + key + ' has not been created yet.';
        return 'false';
    }

    /**
     * Throw General Set Error
     * This sets the errorCode and Diagnostic for the key and value attempted.
     * Note, messages differ too much for this to be genericized.  I think the SCORM Error, Message and Diagnostic needs to be bundled better.
     * @param k {String} key
     * @param v {String} value
     * @param o {String} optional
     * @returns {String} 'false'
     */
    function throwGeneralSetError(k, v, o) {
        settings.errorCode = "351";
        settings.diagnostic = "The " + k + " element must be unique.  The value '" + v + "' has already been set in #" + o;
        return 'false';
    }

    /**
     * Set Data (Private)
     * This covers setting key's values against a object even when there are numbers as objects
     * It will chase thru the Object dot syntax to locate the key you request.  This worked out
     * better than doing a eval(param); which breaks when numbers are introduced.
     * @param key {String} Location of value in object
     * @param val {String} Value of the Key
     * @param obj {Object} Object to search and set
     */
    function setData(key, val, obj) {
        //if (!obj) { obj = data;} //outside (non-recursive) call, use "data" as our base object
        var ka = key.split(/\./);
        //split the key by the dots
        if (ka.length < 2) {
            obj[ka[0]] = val;
            //only one part (no dots) in key, just set value
        } else {
            if (!obj[ka[0]]) {
                obj[ka[0]] = {};
            }//create our "new" base obj if it doesn't exist
            obj = obj[ka.shift()];
            //remove the new "base" obj from string array, and hold actual object for recursive call
            setData(ka.join("."), val, obj);
            //join the remaining parts back up with dots, and recursively set data on our new "base" obj
        }
    }

    /**
     * Get Data (Private)
     * This covers getting key's values against a object even when there are numbers as objects
     * It will chase thru the Object dot syntax to locate the key you request.  This worked out
     * better than doing a eval(param); which breaks when numbers are introduced.
     * @param key {String} Location of value in object
     * @param obj {Object} Object to search
     * @returns {String}
     */
    function getData(key, obj) {
        //if (!obj) { obj = data;} //outside (non-recursive) call, use "data" as our base object
        //scorm.debug(settings.prefix + ": GetData Checking " + key, 4);
        var ka = key.split(/\./), v;
        //split the key by the dots
        if (ka.length < 2) {
            try {
                //scorm.debug(settings.prefix + ":  getData returning -   key:" + ka[0] + " value:" + obj[ka[0]], 4);
                return obj[ka[0]];
            } catch (e) {
                throwUnimplemented(key);
                return 'false';
            }
            //only one part (no dots) in key, just set value
        } else {
            v = ka.shift();
            if (obj[v]) {
                return String(getData(ka.join("."), obj[v])); // just in case its undefined
            }
            return throwUnimplemented(key);
            //join the remaining parts back up with dots, and recursively set data on our new "base" obj
        }
    }

    /**
     * CMI Get Value (Private)
     * This covers getting CMI Keys and returning there values.
     * It will have mild error control against the CMI object for Write Only values.
     * @param key {String} Location of value in object
     * @returns {String}
     */
    function cmiGetValue(key) {
        var r = "false";
        switch (key) {
            //Write Only
        case "cmi.exit":
        case "cmi.session_time":
            settings.errorCode = 405;
            settings.diagnostic = "Sorry, this has been specified as a read-only value for " + key;
            break;

        default:
            r = getData(key.substr(4, key.length), cmi);
            //scorm.debug(settings.prefix + ": cmiGetValue got " + r, 4);
            // Filter
            if (r === 'undefined') {
                settings.errorCode = 401;
                settings.diagnostic = "Sorry, there was a undefined response from " + key;
                r = "false";
            }
            break;
        }
        scorm.debug(settings.prefix + ": GetValue " + key + " = " + r, 4);
        return r;
    }

    /**
     * ADL Get Value (Private)
     * This covers the ADL Sequence and Navigation object present in SCORM 2004
     * @param key {String}
     * @returns {String}
     */
    function adlGetValue(key) {
        var r = "false";
        // Stop a jump navigation request since there is no navigation in this scenario.
        if (key.indexOf('adl.nav.request_valid.choice') >= 0) {
            settings.errorCode = 301;
            scorm.debug(settings.prefix + "Sorry, targeted 'choice' requests not allowed by this API since there is no navigation.", 2);
        } else {
            r = getData(key.substr(4, key.length), adl);
            // Filter
            if (r === 'undefined') {
                settings.errorCode = 401;
                settings.diagnostic = "Sorry, there was a undefined response from " + key;
                r = "false";
            }
        }
        scorm.debug(settings.prefix + ": GetValue " + key + " = " + r, 4);
        return r;
    }

    /**
     * Is Read Only?
     * I've placed several of the read-only items in a delimited string.  This is used to compare
     * the key, to known read-only values to keep you from changing something your not supposed to.
     * @param key {String} like cmi.location
     * @returns {Boolean} true or false
     */
    function isReadOnly(key) {
        // See note above about read-only
        var tiers = key.split('.'),
            v = tiers[tiers.length - 1]; // last value
        if (tiers[2] === "request_valid" || tiers[4] === 'id') {
            return true;
        }
        if (tiers[1] === 'comments_from_lms') {// entirely read only
            return true;
        }
        if (tiers[1] === 'comments_from_learner') { // Condition where comment in this case is allowed.
            return false;
        }
        return read_only.indexOf('|' + v + '|') >= 0;
    }

    /**
     * Is Write Only?
     * I've placed several write-only items in a delimited string.  This is used to compare
     * the key, to known write-only values to keep you from reading things your not suppose to.
     * @param key {String}
     * @returns {Boolean} true or false
     */
    function isWriteOnly(key) {
        var tiers = key.split("."),
            v = tiers[tiers.length - 1]; // last value
        return write_only.indexOf('|' + v + '|') >= 0;
    }

    /**
     * Round Value
     * Rounds to 2 decimal places
     * @param v {Number}
     * @returns {Number}
     */
    function roundVal(v) {
        var dec = 2;
        return Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec);
    }

    /**
     * Get Object Length
     * @param obj {Object}
     * returns {Number}
     */
    function getObjLength(obj) {
        var name,
            length = 0;
        for (name in obj) {
            if (obj.hasOwnProperty(name)) {
                length += 1;
            }
        }
        return length;
    }

    function checkExitType() {
        if (cmi.exit === "suspend") {
            cmi.entry = "resume";
        }
    }

    /**
     * Update Suspend Data Usage Statistics
     * Will update settings.suspend_date_usage with current % level
     */
    function suspendDataUsageStatistic() {
        return roundVal((cmi.suspend_data.length / 64000) * 100) + "%";
    }

    // End Private
    // Public
    /**
     * isRunning, Returns true if initialized is 1 and terminated is 0
     * @returns {Boolean} true or false
     */
    this.isRunning = function () {
        return settings.initialized === 1 && settings.terminated === 0;
    };
    /*jslint nomen: true */
    /**
     * Initialize Session (SCORM) only once!
     * @returns {String} "true" or "false" depending on if its been initialized prior
     */
    this.Initialize = function () {
        scorm.debug(settings.prefix + ":  Initializing...", 3);
        // Computer Managed Instruction
        if (settings.cmi !== null) {
            cmi = settings.cmi;
            checkExitType();
        } else {
            cmi = settings.CMI;
        }
        // ADL - Sequence and Navigation
        if (settings.adl !== null) {
            adl = settings.adl;
        } else {
            adl = settings.ADL;
        }
        // Clean CMI Object
        settings.initialized = 1;
        settings.terminated = 0;
        return 'true';
    };
    /**
     * GetValue (SCORM)
     * @param key {String}
     * @returns {String} "true" or "false" depending on if its been initialized prior
     */
    this.GetValue = function (key) {
        //scorm.debug(settings.prefix + ":  Running: " + this.isRunning() + " GetValue: " + key + "...", 4);
        settings.errorCode = 0;
        var r = "false",
            k = key.toString(), // ensure string
            tiers = [];
        if (this.isRunning()) {
            if (isWriteOnly(k)) {
                scorm.debug(settings.prefix + ": This " + k + " is write only", 4);
                settings.errorCode = 405;
                return "false";
            }
            tiers = k.toLowerCase().split(".");
            switch (tiers[0]) {
            case "cmi":
                r = cmiGetValue(k);
                break;
            case "ssp":

                break;
            case "adl":
                r = adlGetValue(k);
                break;
            }
            // Responding with 403 if empty
            if (r === "") {
                settings.errorCode = 403;
            }
            return r;
        }
        settings.errorCode = 123;
        return r;
    };
    /**
     * SetValue (SCORM)
     * @param key {String}
     * @param value {String}
     * @returns {String} "true" or "" depending on if its been initialized prior
     */
    this.SetValue = function (key, value) {
        scorm.debug(settings.prefix + ": SetValue: " + key + " = " + value, 4);
        settings.errorCode = 0;
        var tiers = [],
            k = key.toString(), // ensure string
            v = value.toString(), // ensure string
            z = 0,
            count = 0,
            arr = [];
        if (this.isRunning()) {
            if (isReadOnly(k)) {
                scorm.debug(settings.prefix + ": This " + k + " is read only", 4);
                settings.errorCode = 404;
                settings.diagnostic = "This namespace is read-only.";
                return "false";
            }
            tiers = k.split(".");
            //scorm.debug(settings.prefix + ": Tiers " + tiers[1], 4);
            switch (tiers[0]) {
            case "cmi":
                switch (key) {
                case "cmi.location":
                    if (v.length > 1000) {
                        scorm.debug(settings.prefix + ": Some LMS's might truncate your bookmark as you've passed " + v.length + " characters of bookmarking data", 2);
                    }
                    break;
                case "cmi.completion_status":
                    if (completion_status.indexOf('|' + v + '|') === -1) {
                        // Invalid value
                        return throwVocabError(key, v);
                    }
                    break;
                case "cmi.exit":
                    if (exit.indexOf('|' + v + '|') === -1) {
                        // Invalid value
                        return throwVocabError(key, v);
                    }
                    break;
                default:
                    // Need to dig in to some of these lower level values
                    switch (tiers[1]) {
                    case "comments_from_lms":
                        settings.errorCode = "404";
                        settings.diagnostic = "The cmi.comments_from_lms element is entirely read only.";
                        return 'false';
                    case "comments_from_learner":
                        // Validate
                        if (cmi.comments_from_learner._children.indexOf(tiers[3]) === -1) {
                            return throwVocabError(key, v);
                        }
                        setData(k.substr(4, k.length), v, cmi);
                        cmi.comments_from_learner._count = (getObjLength(cmi.comments_from_learner) - 2).toString(); // Why -1?  _count and _children
                        return 'true';
                    case "interactions":
                        // Validate
                        if (cmi.interactions._children.indexOf(tiers[3]) === -1) {
                            return throwVocabError(key, v);
                        }
                        //scorm.debug(settings.prefix + ": Checking Interactions .... " + getObjLength(cmi.interactions), 4);
                        cmi.interactions._count = (getObjLength(cmi.interactions) - 2).toString(); // Why -2?  _count and _children
                        // Check interactions.n.objectives._count
                        // This one is tricky because if a id is added at tier[3] this means the objective count needs to increase for this interaction.
                        // Interactions array values may not exist yet, which is why its important to build these out ahead of time.
                        // this should work (Subtract _count, and _children)
                        if (isNaN(parseInt(tiers[2], 10))) {
                            return 'false';
                        }
                        // Interactions uses objectives and correct_repsponses that need to be constructed.
                        // Legal build of interaction array item
                        if (!Utl.isPlainObject(cmi.interactions[tiers[2]])) {
                            if (tiers[3] === "id") {
                                cmi.interactions[tiers[2]] = {};
                                setData(k.substr(4, k.length), v, cmi);
                                cmi.interactions._count = (getObjLength(cmi.interactions) - 2).toString(); // Why -2?  _count and _children
                                if (!Utl.isPlainObject(cmi.interactions[tiers[2]].objectives)) {
                                    // Setup Objectives for the first time
                                    scorm.debug(settings.prefix + ": Constructing objectives object for new interaction", 4);
                                    cmi.interactions[tiers[2]].objectives = {};
                                    cmi.interactions[tiers[2]].objectives._count = "-1";
                                }
                                // Wait, before you go trying set a count on a undefined object, lets make sure it exists...
                                if (!Utl.isPlainObject(cmi.interactions[tiers[2]].correct_responses)) {
                                    // Setup Objectives for the first time
                                    scorm.debug(settings.prefix + ": Constructing correct responses object for new interaction", 4);
                                    cmi.interactions[tiers[2]].correct_responses = {};
                                    cmi.interactions[tiers[2]].correct_responses._count = "-1";
                                }
                                return 'true';
                            }
                            scorm.debug("Can't add interaction without ID first!", 3);
                            return 'false';
                            // throw error code
                        }
                        // Manage Objectives
                        if (tiers[3] === 'objectives') { // cmi.interactions.n.objectives
                            // Objectives require a unique ID
                            if (tiers[5] === "id") {
                                count = parseInt(cmi.interactions[tiers[2]].objectives._count, 10);
                                z = count;
                                //for (z = 0; z < count; z += 1) {
                                while (z < count) {
                                    if (cmi.interactions[tiers[2]].objectives[z].id === v) {
                                        return throwGeneralSetError(key, v, z);
                                        //settings.errorCode = "351";
                                        //settings.diagnostic = "The objectives.id element must be unique.  The value '" + v + "' has already been set in objective #" + z;
                                    }
                                    z += 1;
                                }
                            } else {
                                return throwVocabError(key, v);
                            }
                            setData(k.substr(4, k.length), v, cmi);
                            cmi.interactions[tiers[2]].objectives._count = (getObjLength(cmi.interactions[tiers[2]].objectives) - 1).toString(); // Why -1?  _count
                            return 'true';
                        }
                        // Manage Correct Responses
                        if (tiers[3] === 'correct_responses') {
                            // Validate Correct response patterns
                            setData(k.substr(4, k.length), v, cmi);
                            cmi.interactions[tiers[2]].correct_responses._count = (getObjLength(cmi.interactions[tiers[2]].correct_responses) - 1).toString(); // Why -1?  _count
                        }
                        setData(k.substr(4, k.length), v, cmi);
                        cmi.interactions._count = (getObjLength(cmi.interactions) - 2).toString(); // Why -2?  _count and _children
                        return 'true';
                        //break;
                    case "objectives":
                        // Objectives require a unique ID, which to me contradicts journaling
                        if (tiers[3] === "id") {
                            count = parseInt(cmi.objectives._count, 10);
                            //for (z = 0; z < count; z += 1) {
                            while (z < count) {
                                if (cmi.objectives[z].id === v) {
                                    settings.errorCode = "351";
                                    settings.diagnostic = "The objectives.id element must be unique.  The value '" + v + "' has already been set in objective #" + z;
                                    return 'false';
                                }
                                z += 1;
                            }
                        }
                        // End Unique ID Check
                        // Now Verify the objective in question even has a ID yet, if not throw error.
                        if (tiers[3] !== "id") {
                            arr = parseInt(tiers[2], 10);
                            if (cmi.objectives[arr] === undefined) {
                                settings.errorCode = "408";
                                settings.diagnostic = "The objectives.id element must be set before other elements can be set";
                                return 'false';
                            }
                        }
                        // END ID CHeck
                        if (isNaN(parseInt(tiers[2], 10))) {
                            return 'false';
                            // throw error code
                        }
                        setData(k.substr(4, k.length), v, cmi);
                        cmi.objectives._count = (getObjLength(cmi.objectives) - 2).toString(); // Why -2?  _count and _children
                        return 'true';
                    }
                    break;
                    // More reinforcement to come ...
                }
                // Rip off 'cmi.' before we add this to the model
                setData(k.substr(4, k.length), v, cmi);
                break;
            case "ssp":
                // Unless local storage was used, persisting would be difficult.
                break;
            case "adl":
                // This value is dynamic since it commonly includes a {target=STRING}
                if (key.indexOf('adl.nav.request_valid.choice') >= 0) {
                    settings.errorCode = "404";
                    settings.diagnostic = "The requested namespace is read-only.";
                    return 'false';
                }
                // Check the rest
                switch (key) {
                case "adl.nav.request":
                    if (nav_states.indexOf('|' + v + '|') === -1) {
                        settings.errorCode = "406";
                        settings.diagnostic = "The requested namespace value did not match any allowed states.";
                        return 'false';
                    }
                    break;
                // This should get caught by isReadOnly above
                case "adl.nav.request_valid.continue":
                case "adl.nav.request_valid.previous":
                    settings.errorCode = "404";
                    settings.diagnostic = "The requested namespace is read-only.";
                    return 'false';
                default:
                    // Further evaluation?
                    if (tiers[1] !== "nav") {
                        settings.errorCode = "351";
                        settings.diagnostic = "The requested namespace does not exist.";
                        return 'false';
                    }
                    break;
                }
                setData(k.substr(4, k.length), v, adl);
                break;
            }
            return "true";
        }
        // Determine Error Code
        if (settings.terminated) {
            settings.errorCode = 133;
        } else {
            settings.errorCode = 132;
        }
        return "false";
    };
    /**
     * Commit (SCORM)
     * Typically empty, I'm unaware of anyone ever passing anything.
     * @returns {String} "true" or "false"
     */
    this.Commit = function () {
        scorm.debug(settings.prefix + ": Commit called.\nSuspend Data Usage " + suspendDataUsageStatistic(), 4);
        //$(self).triggerHandler({
        Utl.triggerEvent(self, 'StoreData', {
            name: 'StoreData',
            runtimedata: cmi,
            sequence: adl
        });
        return 'true';
    };
    /**
     * Terminate
     * @returns {String}
     */
    this.Terminate = function () {
        // Could do things here like a LMS
        //self.Commit(); // Force commit?
        settings.terminated = 1;
        settings.initialized = 0;
        return 'true';
    };
    /**
     * GetErrorString (SCORM) - Returns the error string from the associated Number
     * @param param number
     * @returns string
     */
    this.GetErrorString = function (param) {
        if (param !== "") {
            var nparam = parseInt(param, 10);
            if (errors[nparam] !== undefined) {
                return errors[nparam];
            }
        }
        return "";
    };
    /**
     * GetLastError (SCORM) - Returns the error number from the last error
     * @returns {Number}
     */
    this.GetLastError = function () {
        return settings.errorCode;
    };
    /**
     * Get Diagnostic
     * This would return further information from the lms about a error
     * @returns {String} description of error in more detail
     */
    this.GetDiagnostic = function () {
        return settings.diagnostic;
    };
}