/*global window, alert, console, SCOBotUtil, debug, scorm, SCOBot_API_1484_11 */
/*jslint devel: true, browser: true */
/**
 * SCOBot Base
 * Add this to your content to achieve connection to an LMS supporting SCORM 1.2 or 2004.  This API provides the base
 * support to manually make requests via the methods and functionality within this API.
 * Add SCOBot.js to gain the automatic Initialization, Termination/Suspend capability, as well as further friendly API's
 * to assist you managing more aspects of the SCORM Specification.  Also adds in further error management and reporting.
 *
 * Documentation, samples, resources, and credits: ADL, IMSGlobal, Claude Ostyn, Pipwerks, SCORM.com, and StackOverflow
 * Goals: SCORM For Everyone else, low overhead, simple API's, containment, framework independent, and transparency.
 *
 * Please see the wiki below for more information about going commando, and or utilizing the rest of the library.
 * https://github.com/cybercussion/SCOBot
 *
 * Recommend a minify/merge before pushing to a production environment. (JSMin, YUI Compressor, Dojo Shrinksafe etc ...)
 *
 * jQuery dependency removed, and now utilizes SCOBotUtil.
 *
 * @usage
 * var scorm = new SCOBotBase({
 *         debug: true,
 *         time_type: "UTC",           // or GMT
 *         exit_type: 'suspend',       // or finish
 *         success_status: 'unknown',  // passed, failed, unknown
 *         cmi: your_own_runtime_data  // optional way to resume locally or some other custom use case
 *    }),
 *    lmsconnected = scorm.initialize(); // recommend a window.load event.
 * // Sample requests, methods (see wiki for more)
 * scorm.getvalue('cmi.location');
 * scorm.setvalue('cmi.location', '4');
 * scorm.commit();
 * scorm.terminate();
 *
 * @event debug, getvalue, setvalue, exception, terminated, StoreData
 *
 * @author Cybercussion Interactive, LLC <info@cybercussion.com>
 * @license Copyright (c) 2009-2016, Cybercussion Interactive LLC
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 * @version 4.1.5
 * @param options {Object} override default values
 * @constructor
 */
/*!
 * SCOBotBase, Updated Jan 1st, 2016
 * Copyright (c) 2009-2016, Cybercussion Interactive LLC.
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 */
function SCOBotBase(options) {
    // Constructor ////////////
    "use strict";
    // Please edit run time options or override them when you instantiate this object.
    var Utl      = SCOBotUtil,
        defaults = {
            version:           "4.1.5",
            createDate:        "04/05/2011 08:56AM",
            modifiedDate:      "03/04/2016 12:24AM",
            debug:             false,
            isActive:          false,
            throw_alerts:      false,
            preferred_API:     "findAPI",    // findAPI, findSCORM12, findSCORM2004
            prefix:            "SCOBotBase",
            exit_type:         "suspend",    // suspend, finish, or "" (undetermined)
            success_status:    "unknown",    // passed, failed, unknown
            use_standalone:    true,         // false if you don't want it to fail over locally
            standalone:        false,        // flag
            completion_status: "incomplete", // default completed, incomplete, unknown
            time_type:         "UTC",        // See GMT (pre 1972) vs UTC (post 1972) Time http://www.timeanddate.com/time/gmt-utc-time.html
            cmi:               null,
            latency_arr: []
        },
    // Settings merged with defaults and extended options
        settings = Utl.extend(defaults, options),
    // Internal API Error Boolean, Error Code object
        isError = 0,
        error = {
            0:   "No Error",
            404: "Not Found",
            405: "Prevented on a read only resource"
        },
    // API Object
        API = {
            connection: false,
            version:    "none", // 2004, 1.2 or none
            mode:       "",
            path:       false,  // Set Path to LMS API or maybe something local later by default?
            data:       {       // Defaults, I'm moving a few of the SCORM defaults into this data object, they will be maintained here thereafter.
                completion_status: settings.completion_status,
                success_status:    settings.success_status,
                exit_type:         settings.exit_type
            },
            isActive:   settings.isActive  // If SCO is initialized already, this was added for a page by page concept where pages unload and load.
        },
        self = this;
    // Public to Public call hook within the internal API
    // Set some more 'settings'
    settings.error = error; // Inherit
    settings.startDate = {}; // Set on Success of Initialize aka "the start time"
    // End Constructor ////////
    // Private ////////////////
    /**
     * No Console
     * Lack of support in older browsers forced this
     * @param msg {String} Debug Message
     * @param lvl {*} 1=Error, 2=Warning, 3=Log, 4=Info
     * @event debug fired when no console is available.  You could listen to this to put it in an alternative log.
     */
    function noconsole(msg, lvl) {
        // ignore (IE 8 and prior or other browser that doesn't support it).  Routing event out so it can be handled.
        /*$(self).triggerHandler({
            'type': "debug",
            'msg':  msg,
            'lvl':  lvl
        });*/
        Utl.triggerEvent(self, debug, {msg: msg, lvl: lvl});
    }

    /**
     * Debug
     * Built-In Debug Functionality to output to console (Firebug, Inspector, Dev Tool etc ...)
     * @param msg {String} Debug Message
     * @param lvl {Number} 1=Error, 2=Warning, 3=Log, 4=Info
     */
    function debug(msg, lvl) {
        if (settings.debug) {// default is false
            if (!window.console) {// IE 7 probably 6 was throwing a error if 'console undefined'
                window.console = {};
                window.console.info  = noconsole;
                window.console.log   = noconsole;
                window.console.warn  = noconsole;
                window.console.error = noconsole;
                window.console.trace = noconsole;
            }
            switch (lvl) {
            case 1:
                console.error(msg);
                break;
            case 2:
                console.warn(msg);
                break;
            case 4:
                console.info(msg);
                break;
            case 3:
                console.log(msg);
                break;
            default:
                console.log(msg);
                return false;
            }
            return true;
        }
        if (lvl < 3 && settings.throw_alerts) {
            alert(msg);
        }
        return true; // altered Jan 3rd, 2015 - this conflicted with debugging off on setObjective for QUnit test
    }

    /**
     * Find SCORM 2004
     * API_1484_11
     * @param win {object} Window level
     */
    function findSCORM2004(win) {
        var attempts = 0,
            limit = 500;
        while ((!win.API_1484_11) && (win.parent) && (win.parent !== win) && (attempts <= limit)) {
            attempts += 1;
            win = win.parent;
        }
        if (win.API_1484_11) {//SCORM 2004-specific API.
            API.version = "2004"; //Set version
            API.path = win.API_1484_11;
        } else {
            return false;
        }
        return true;
    }

    /**
     * Find SCORM12
     * API
     * @param win {object} Window level
     */
    function findSCORM12(win) {
        var attempts = 0,
            limit = 500;
        while ((!win.API) && (win.parent) && (win.parent !== win) && (attempts <= limit)) {
            attempts += 1;
            win = win.parent;
        }
        if (win.API) {//SCORM 1.2-specific API
            API.version = "1.2";  //Set version
            API.path = win.API;
        } else {
            return false;
        }
        return true;
    }

    /**
     * Find API
     * API_1484_11 or API for SCORM 2004 or 1.2
     * @param win {object} Window level
     */
    function findAPI(win) {
        if (settings.preferred_API === "findAPI") { // search SCORM2004, then 1.2
            var attempts = 0, limit = 500;
            while ((!win.API && !win.API_1484_11) && (win.parent) && (win.parent !== win) && (attempts <= limit)) {
                attempts += 1;
                win = win.parent;
            }
            if (win.API_1484_11) {//SCORM 2004-specific API.
                API.version = "2004";
                //Set version
                API.path = win.API_1484_11;
            } else if (win.API) {//SCORM 1.2-specific API
                API.version = "1.2";
                //Set version
                API.path = win.API;
            } else {
                return false;
            }
            return true;
        }
        if (settings.preferred_API === "findSCORM12") { // Specifically 1.2
            return findSCORM12(win);
        }
        return findSCORM2004(win); // 2004
    }

    // SCORM Time centric to SCORM 2004 and 1.2 Compatibility
    /**
     * Centiseconds To ISO Duration
     * Borrowed from Claude Ostyn, but touched up for JSLint/JavaScript and evil "with" statement.  Tested on
     * JSPerf for speed.
     * @param n {Number} Total Seconds
     * @param bPrecise {Boolean} Only Set true if were dealing with months, years (highly unlikely)
     * @returns {String} SCORM 2004 Time PT0H0M0S Format
     */
    function centisecsToISODuration(n, bPrecise) {
        /* Note: SCORM and IEEE 1484.11.1 require centisec precision
         Parameters:
         n = number of centiseconds
         bPrecise = optional parameter; if true, duration will
         be expressed without using year and/or month fields.
         If bPrecise is not true, and the duration is long,
         months are calculated by approximation based on average number
         of days over 4 years (365*4+1), not counting the extra days
         for leap years. If a reference date was available,
         the calculation could be more precise, but becomes complex,
         since the exact result depends on where the reference date
         falls within the period (e.g. beginning, end or ???)
         1 year ~ (365*4+1)/4*60*60*24*100 = 3155760000 centiseconds
         1 month ~ (365*4+1)/48*60*60*24*100 = 262980000 centiseconds
         1 day = 8640000 centiseconds
         1 hour = 360000 centiseconds
         1 minute = 6000 centiseconds */
        var str = "P",
            nCs = Math.max(n, 0),
            nY = 0,
            nM = 0,
            nD = 0,
            nH,
            nMin;
        // Next set of operations uses whole seconds
        //with (Math) { //argumentatively considered harmful
        nCs = Math.round(nCs);
        if (bPrecise === true) {
            nD = Math.floor(nCs / 8640000);
        } else {
            nY = Math.floor(nCs / 3155760000);
            nCs -= nY * 3155760000;
            nM = Math.floor(nCs / 262980000);
            nCs -= nM * 262980000;
            nD = Math.floor(nCs / 8640000);
        }
        nCs -= nD * 8640000;
        nH = Math.floor(nCs / 360000);
        nCs -= nH * 360000;
        nMin = Math.floor(nCs / 6000);
        nCs -= nMin * 6000;
        //}
        // Now we can construct string
        if (nY > 0) {
            str += nY + "Y";
        }
        if (nM > 0) {
            str += nM + "M";
        }
        if (nD > 0) {
            str += nD + "D";
        }
        if ((nH > 0) || (nMin > 0) || (nCs > 0)) {
            str += "T";
            if (nH > 0) {
                str += nH + "H";
            }
            if (nMin > 0) {
                str += nMin + "M";
            }
            if (nCs > 0) {
                str += (nCs / 100) + "S";
            }
        }
        if (str === "P") {
            str = "PT0H0M0S";
        }
        // technically PT0S should do but SCORM test suite assumes longer form.
        return str;
    }

    /**
     * Centiseconds to SCORM 1.2 Duration
     * @param n
     * @returns {string}
     */
    function centisecsToSCORM12Duration(n) {
        // Format is [HH]HH:MM:SS[.SS]
        var nH = Math.floor(n / 360000),
            nCs = n - nH * 360000,
            nM = Math.floor(nCs / 6000),
            nS,
            str;
        nCs = nCs - nM * 6000;
        nS = Math.floor(nCs / 100);
        nCs = Math.floor(nCs - nS * 100);
        if (nH > 9999) {
            nH = 9999;
        }
        str = "0000" + nH + ":";
        str = str.substr(str.length - 5, 5);
        if (nM < 10) {
            str += "0";
        }
        str += nM + ":";
        if (nS < 10) {
            str += "0";
        }
        str += nS;
        if (nCs > 0) {
            str += ".";
            if (nCs < 10) {
                str += "0";
            }
            str += nCs;
        }
        return str;
    }

    /**
     * ISO Duration to Centisecond
     * @param str
     * @return {Number}
     */
    function ISODurationToCentisec(str) {
        // Only gross syntax check is performed here
        // Months calculated by approximation based on average number
        // of days over 4 years (365*4+1), not counting the extra days
        // in leap years. If a reference date was available,
        // the calculation could be more precise, but becomes complex,
        // since the exact result depends on where the reference date
        // falls within the period (e.g. beginning, end or ???)
        // 1 year ~ (365*4+1)/4*60*60*24*100 = 3155760000 centiseconds
        // 1 month ~ (365*4+1)/48*60*60*24*100 = 262980000 centiseconds
        // 1 day = 8640000 centiseconds
        // 1 hour = 360000 centiseconds
        // 1 minute = 6000 centiseconds
        var aV = [0, 0, 0, 0, 0, 0],
            bErr = (str.indexOf("P") !== 0),
            bTFound = false,
            aT = ["Y", "M", "D", "H", "M", "S"],
            p = 0,
            i = 0,
            len;
        if (!bErr) {
            str = str.substr(1); //get past the P
            len = aT.length;
            i = 0;
            //for (i = 0; i < len; i += 1) {
            while (i < len) {
                if (str.indexOf("T") === 0) {
                    str = str.substr(1);
                    i = Math.max(i, 3);
                    bTFound = true;
                }
                p = str.indexOf(aT[i]);
                if (p > -1) {
                    /*jslint continue: true */
                    if ((i === 1) && (str.indexOf("T") > -1) && (str.indexOf("T") < p)) {
                        continue;
                    }
                    /*jslint continue: false */
                    if (aT[i] === "S") {
                        aV[i] = parseFloat(str.substr(0, p));
                    } else {
                        aV[i] = parseInt(str.substr(0, p), 10);
                    }
                    if (isNaN(aV[i])) {
                        bErr = true;
                        break;
                    }
                    if ((i > 2) && (!bTFound)) {
                        bErr = true;
                        break;
                    }
                    str = str.substr(p + 1);
                }
                i += 1;
            }
            bErr = !((!bErr) && (len !== 0)); // Fix 2/2016
        }
        if (bErr) {
            return 0;
        }
        return aV[0] * 3155760000 + aV[1] * 262980000
            + aV[2] * 8640000 + aV[3] * 360000 + aV[4] * 6000
            + Math.round(aV[5] * 100);
    }

    /**
     * Pad Time
     * Pads time with proper formatting (double digits)
     */
    function padTime(n) {
        return n < 10 ? '0' + n : n;
    }

    /**
     * SCORM 1.2 Time to Milliseconds
     * @param n HHHH:MM:SS.SS
     * @returns {number} total milliseconds
     */
    function scorm12toMS(n) {
        var t_arr = n.split(":");
        return Math.round(t_arr[0] * 3600000) + (t_arr[1] * 60000) + (t_arr[2] * 1000);
    }

    /**
     * Date To SCORM 1.2 Time
     * @param date
     * @returns {string}
     */
    function dateToscorm12Time(date) {
        var h = date.getHours(),
            m = date.getMinutes(),
            s = date.getSeconds();

        return padTime(h) + ":" + padTime(m) + ":" + padTime(s);
    }

    /**
     * ISO 8601 Date String UTC
     * Converts date object into ISO 8601 standard
     * returns {String} ISO 8601 + UTC
     */
    function isoDateToStringUTC(d) {
        return d.getUTCFullYear() + '-' + padTime(d.getUTCMonth() + 1) + '-' + padTime(d.getUTCDate()) + 'T' + padTime(d.getUTCHours()) + ':' + padTime(d.getUTCMinutes()) + ':' + padTime(d.getUTCSeconds()) + "." + Math.round((d.getUTCMilliseconds() / 1000) % 1000) + 'Z';
    }

    /**
     * ISO 8601 Date String
     * Concerts date into ISO 8601 Standard
     * @returns {String} ISO 8601
     */
    function isoDateToString(d) {
        var offset = d.getTimezoneOffset() > 0 ? '-' : '+';
        return d.getFullYear() + '-' + padTime(d.getMonth() + 1) + '-' + padTime(d.getDate()) + 'T' + padTime(d.getHours()) + ':' + padTime(d.getMinutes()) + ':' + padTime(d.getSeconds()) + "." + Math.round((d.getMilliseconds() / 1000) % 1000) + offset + padTime(d.getTimezoneOffset() / 60) + ':00';
        //return d.getFullYear() + '-' + padTime(d.getMonth() + 1) + '-' + padTime(d.getDate()) + 'T' + padTime(d.getHours()) + ':' + padTime(d.getMinutes()) + ':' + padTime(d.getSeconds());
    }

    /**
     * ISO 8601 String to Date
     * Not extremely clear yet if this is needed at a SCO level.  If not I'll remove it later.
     * @param str {String} ISO8601
     * @return {Object} Date Object or false
     */
    function isoStringToDate(str) {
        var MM = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            d,
            uoffset,
            offset = 0,
            mil = 0,
            dd,
            timebits,
            m,
            resultDate,
            utcdate,
            offsetMinutes;
        /*jslint unparam: true*/
        switch (settings.time_type) {
        case "UTC":
            timebits = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]*)(\.[0-9]*)?)?(?:([+\-])([0-9]{2})([0-9]{2}))?/;
            m = timebits.exec(str);
            if (m) {
                utcdate = Date.UTC(
                    parseInt(m[1], 10),
                    parseInt(m[2], 10) - 1, // months are zero-offset (!)
                    parseInt(m[3], 10),
                    parseInt(m[4], 10),
                    parseInt(m[5], 10), // hh:mm
                    ((m[6] && parseInt(m[6], 10)) || 0),  // optional seconds
                    ((m[7] && parseFloat(m[7]) * 1000)) || 0
                ); // optional fraction
                // utcdate is milliseconds since the epoch
                if (m[9] && m[10]) {
                    offsetMinutes = parseInt(m[9], 10) * 60 + parseInt(m[10], 10);
                    utcdate += (m[8] === '+' ? -1 : +1) * offsetMinutes * 60000;
                }
                resultDate = new Date(utcdate);
            } else {
                resultDate = null;
            }
            return resultDate;
        case "GMT":
            d = str.replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))([\+|\-]\d+:\d+)/, function ($0, $Year, $Month, $Day, $Hour, $Min, $Sec, $Ms, $Offset) {
                offset = parseInt($Offset.substring(1, $Offset.length), 10) * 60;
                mil = $Ms;
                return MM[$Month - 1] + " " + $Day + ", " + $Year + " " + $Hour + ":" + $Min + ":" + $Sec;
            });
            // At this point we have to convert the users offset to the recorded offset to set the date properly.
            dd = new Date(d);
            uoffset = dd.getTimezoneOffset();
            if (uoffset !== offset) {
                dd = new Date(dd.getTime() + (offset - uoffset) * 60000);
                dd.setMilliseconds(mil);
            }
            return dd;
        default:
            d = str.replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/, function ($0, $Year, $Month, $Day, $Hour, $Min, $Sec) {
                return MM[$Month - 1] + " " + $Day + ", " + $Year + " " + $Hour + ":" + $Min + ":" + $Sec;
            });
            dd = new Date(d);
            return dd;
        }
    }
    /*jslint unparam: false*/

    // End SCORM Time Handlers /////////////////////////////
    /**
     * Make Boolean
     * Turns 'yes', 'no', 'true', 'false', '0', '1' into true/false
     * @param str {String} value to turn to boolean
     * @returns {Boolean}
     */
    function makeBoolean(str) {
        if (str === undefined) {
            debug(settings.prefix + " : makeBoolean was given empty string, converting to false", 2);
            return false;
        }
        if (str === true || str === false) {
            return Boolean(str);
        }
        switch (str.toLowerCase()) {
        case "true":
        case "yes":
        case "1":
            return true;
        case "false":
        case "no":
        case "0":
        case null:
            return false;
        default:
            return Boolean(str);
        }
    }

    /**
     * Trigger Warning (internal to this API)
     * Throws a console log when a SCORM API Error occurs
     * @returns {Boolean}
     */
    function triggerWarning(n) {
        debug(error[n], 2);
        return true;
    }

    /**
     * Trigger Exception
     */
    function triggerException(msg) {
        //$(self).triggerHandler({
        Utl.triggerEvent(self, 'exception', {
            //'type':  'exception',
            'error': msg
        });
    }

    /**
     * Get Last LMS Error Code
     * Error Code should be 0 if its anything else, a error has occurred
     * @returns {Number}
     */
    function getLastErrorCode() {
        var lms = API.path, // shortcut
            code = 0;
        // default error code
        if (lms) {
            switch (API.version) {
            case "1.2":
                code = parseInt(lms.LMSGetLastError(), 10);
                break;
            case "2004":
                code = parseInt(lms.GetLastError(), 10);
                break;
            default:
                // handle nonLMS?
                break;
            }
        }
        return code;
    }

    /**
     * Get Last LMS Error Message
     * Error Message associated by error code
     * @param n {Number} error code
     * @returns {String} error message
     */
    function getLastErrorMessage(n) {
        var lms = API.path, // shortcut
            result = 'No LMS Connectivity';
        // default message
        if (lms) {
            switch (API.version) {
            case "1.2":
                result = lms.LMSGetErrorString(n.toString());
                break;
            case "2004":
                result = lms.GetErrorString(n.toString());
                break;
            default:
                // handle nonLMS?
                break;
            }
        }
        return String(result);
    }

    function getDiagnostic(n) {
        var lms = API.path, // shortcut
            result = 'No LMS Connectivity';
        // default message
        if (lms) {
            switch (API.version) {
            case "1.2":
                result = lms.LMSGetDiagnostic(n.toString());
                break;
            case "2004":
                result = lms.GetDiagnostic(n.toString());
                break;
            default:
                // handle nonLMS?
                break;
            }
        }
        return String(result);
    }

    // End Private ////////////
    // Public /////////////////
    // Public SCORM Calls /////
    /**
     * Get Value (SCORM Call)
     * Gets the cmi object value requested
     * @param n {String} CMI Object Path as String
     * @returns {String}
     * @event 'getvalue'
     */
    this.getvalue = function (n) {
        var v     = null,       // success
            lms   = API.path,   // lms shortcut
            ec    = 0,          // error code
            m     = '',         // error message
            d     = '',         // error diagnostic
            nn    = null,       // new number
            tiers = [],
            ig    = false,      // ignore
            start = new Date(), // for latency check
            end;                // for latency check
        if (API.isActive) {// it has initialized
            // This is switch cased to appropriately translate SCORM 2004 to 1.2 if needed.
            // Handy if you don't want to go through all your content calls...
            switch (API.version) {
            case "1.2":
                switch (n) {
                // Get all the ignore calls out of the way...
                // SCORM 1.2 is just a comments string with a max char limit of 4096
                case "cmi.comments_from_lms._count":
                case "cmi.comments_from_lms._children":
                case "cmi.comments_from_learner._count":
                case "cmi.comments_from_learner._children":
                case "cmi.score.scaled":
                case "cmi.progress_measure":
                case "cmi.completion_threshold":
                    ig = true; // unsupported, no fail over
                    break;
                case "cmi.credit":
                    nn = "cmi.core.credit";
                    break;
                case "cmi.location":
                    nn = "cmi.core.lesson_location";
                    break;
                case "cmi.entry":
                    nn = "cmi.core.entry";
                    break;
                case "cmi.mode":
                    nn = "cmi.core.lesson_mode";
                    break;
                case "cmi.exit":
                    nn = "cmi.core.exit";
                    break;
                case "cmi.score.raw":
                    nn = "cmi.core.score.raw";
                    break;
                case "cmi.score.min":
                    nn = "cmi.core.score.min";
                    break;
                case "cmi.score.max":
                    nn = "cmi.core.score.max";
                    break;
                case "cmi.scaled_passing_score":
                    nn = "cmi.student_data.mastery_score";
                    break;
                case "cmi.max_time_allowed":
                    nn = "cmi.student_data.max_time_allowed"; // appears to return 0000:00:00.0
                    break;
                case "cmi.time_limit_action":
                    nn = "cmi.student_data.time_limit_action";
                    break;
                case "cmi.learner_id":
                    nn = "cmi.core.student_id";
                    break;
                case "cmi.learner_name":
                    nn = "cmi.core.student_name";
                    break;
                case "cmi.learner_preferences.audio_level":
                    nn = "cmi.student_preferences.audio";
                    break;
                case "cmi.learner_preferences.delivery_speed":
                    nn = "cmi.student_preferences.speed";
                    break;
                case "cmi.learner_preferences.language":
                    nn = "cmi.student_preferences.language";
                    break;
                case "cmi.learner_preferences.audio_captioning":
                    nn = "cmi.student_preferences.text";
                    break;
                case "cmi.success_status":
                case "cmi.completion_status":
                    nn = "cmi.core.lesson_status";
                    break;
                case "cmi.session_time":
                    nn = "cmi.core.session_time";
                    break;
                case "cmi.total_time":
                    nn = "cmi.core.total_time";
                    break;
                default:
                    // Enhanced cmi.objectives, interactions handler
                    tiers = n.split(".");
                    if (tiers[1] === "interactions") {
                        switch (tiers[2]) {
                        case "_children":
                        case "_count":
                            // ok
                            break;
                        default:
                            if (!isNaN(parseInt(tiers[2], 10))) {
                                switch (tiers[3]) {
                                case "objectives":
                                case "correct_responses":
                                    // ok
                                    break;
                                default:
                                    scorm.debug(settings.prefix + ": Requesting cmi.interactions." + tiers.join(".") + " is a write-only value.  Please check your code.", 2);
                                    return 'false'; // not allowed
                                }
                            }
                        }
                    }
                    if (tiers[1] === "objectives") {
                        switch (tiers[2]) {
                        case "_children":
                        case "_count":
                            // ok
                            break;
                        default:
                            // need to rollback or ignore values that do not exist
                            switch (tiers[3]) {
                                // Deal with Objective differences
                            case "id":
                            case "status":
                                //ok
                                break;
                            case "success_status":
                            case "completion_status":
                                tiers[3] = 'status'; // consolidate
                                break;
                            case "progress_measure":
                            case "description":
                                ig = true;
                                break;
                            case "score":
                                if (tiers[4] === "scaled") {
                                    ig = true;
                                }
                                break;
                            default:
                                scorm.debug(settings.prefix + ": Unexpected namespace passed in '" + n + "', please verify your code.", 2);
                                break;
                            }
                            break;
                        }
                        nn = tiers.join(".");
                    } else {
                        nn = n; // no change
                    }
                    break;
                }

                if (ig) {
                    return 'false';
                }
                v = lms.LMSGetValue(nn);
                break;
            case "2004":
                v = lms.GetValue(n);
                break;
            default:
                // handle non-LMS fail-over (will return 'false' below otherwise)?
                break;
            }
            ec = getLastErrorCode();
            m  = getLastErrorMessage(ec);
            d  = getDiagnostic(ec);
            // Clean up Error Codes that are non-critical (like date element not initialized)
            // Custom event Trigger getvalue
            //$(self).triggerHandler({
            Utl.triggerEvent(self, 'getvalue', {
                //'type': "getvalue",
                'n': n,
                'v': v,
                'error': {
                    'code': ec,
                    'message': m,
                    'diagnostic': d
                }
            });
            end = new Date();
            settings.latency_arr.push({lat: Number(end) - Number(start), v: n}); // latency check.
            if (ec === 0 || ec === 403) {
                // Clean up differences in LMS responses
                if (v === 'undefined' || v === null || v === 'null') { // was typeof v
                    v = "";
                }
                if (API.version === "1.2") {
                    if (v === "0000:00:00.0") {
                        v = ''; // Normalize max_time_allowed
                    }
                }
                return String(v);
            }
            debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + m + "\nDiagnostic: " + d, 1);
            return 'false';
        }
        debug(settings.prefix + ": " + n + " Get Aborted, connection not initialized! " + API.isActive, 2);
        return 'false';
    };
    /**
     * Set Value (SCORM Call)
     * Sets the cmi object value by name
     * @param n {String} CMI Object Path as String
     * @param v {String} Value
     * @returns {String}
     * @event 'setvalue'
     */
    this.setvalue = function (n, v) {
        var s = 'false', // success
            lms = API.path, // lms shortcut
            ec = 0, // error code
            m = '', // error message
            d = '', // error diagnostic
            tiers = [],
            nn = null, // new number
            ig = false; // ignore
        // Security Consideration?
        // It may be worth some minor security later to validate this is being set from a authorized source.  This is lacking support old versions of IE however.
        //debug(settings.prefix + ": The caller of this method is " + arguments.callee.caller.caller.name, 4);  //arguments.callee.caller
        if (API.isActive) {// it has initialized
            // This is switch cased to appropriately translate SCORM 2004 to 1.2 if needed.
            // Handy if you don't want to go through all your content calls...
            switch (API.version) {
            case "1.2":
                API.mode = API.mode === "" ? lms.LMSGetValue('cmi.core.lesson_mode') : API.mode;
                //if (API.mode === "normal") { It was determined that the specification did not enforce a platform behavior like with SCORM 2004
                    switch (n) {
                    case "adl.nav.request":
                    case "adl.nav.request_valid.continue":
                    case "adl.nav.request_valid.previous":
                    case "adl.nav.request_valid.choice":
                    // Ignore all ADL requests
                    case "cmi.score.scaled":
                    case "cmi.progress_measure":
                        ig = true;
                        break;
                    case "cmi.comments_from_learner.comment":
                        if (v.length > 4096) {
                            debug(settings.prefix + ": Warning, the comment is over the limit!!", 2);
                        }
                        nn = "cmi.comments"; // may need to add option to append or delimit
                        break;
                    case "cmi.location":
                        if (v.length > 255) {
                            debug(settings.prefix + ": Warning, your bookmark is over the limit!!", 2);
                        }
                        nn = "cmi.core.lesson_location";
                        break;
                    case "cmi.mode":
                        nn = "cmi.core.lesson_mode";
                        break;
                    case "cmi.exit":
                        nn = "cmi.core.exit";
                        if (v === "normal") { // Fix SCORM 1.2 doesn't have 'normal'
                            v = "";
                        }
                        API.exit_type = v;
                        break;
                    case "cmi.score.raw":
                        nn = "cmi.core.score.raw";
                        break;
                    case "cmi.score.min":
                        nn = "cmi.core.score.min";
                        break;
                    case "cmi.score.max":
                        nn = "cmi.core.score.max";
                        break;
                    case "cmi.success_status":
                    case "cmi.completion_status":
                        nn = "cmi.core.lesson_status";
                        if (v === "unknown" || v === "not attempted") {
                            ig = true;
                        }
                        API.data.completion_status = v;
                        // set local status
                        break;
                    case "cmi.scaled_passing_score":
                        nn = "cmi.student_data.mastery_score";
                        break;
                    case "cmi.learner_preferences.audio_level":
                        nn = "cmi.student_preferences.audio";
                        break;
                    case "cmi.learner_preferences.delivery_speed":
                        nn = "cmi.student_preferences.speed";
                        break;
                    case "cmi.learner_preferences.language":
                        nn = "cmi.student_preferences.language";
                        break;
                    case "cmi.learner_preferences.audio_captioning":
                        nn = "cmi.student_preferences.text";
                        break;
                    case "cmi.session_time":
                        nn = "cmi.core.session_time";
                        break;
                        // Possibly need more here, review further later.
                    case "cmi.total_time":
                        nn = "cmi.core.total_time";
                        break;
                    case "cmi.suspend_data":
                        if (v.length > 4096) {
                            debug(settings.prefix + ": Warning, your suspend data is over the limit!!", 2);
                        }
                        nn = n;
                        break;
                    default:
                        // Enhanced Analysis/Failover
                        tiers = n.split(".");
                        switch (tiers[1]) {
                        case "comments_from_learner":
                            switch (tiers[3]) { // unsupported in SCORM 1.2
                            case "location":
                            case "timestamp":
                                return 'false';
                            }
                            break;
                        case "interactions":
                            if (tiers[2] === 'false') { // count check
                                // something went wrong ignore this
                                scorm.debug(settings.prefix + ": Developer, the interaction count was 'false', and I'm stopping you from pushing this against the LMS.  Verify the code getting interaction count.", 2);
                                return 'false';
                            }
                            switch (tiers[3]) {
                            case "timestamp":
                                tiers[3] = "time";
                                break;
                            case "learner_response":
                                tiers[3] = "student_response";
                                break;
                            case "type":
                                if (v === "long-fill-in" || v === "other") { // unsupported interaction types
                                    //v = "fill-in"; // salvage it?
                                    scorm.debug(settings.prefix + ": Developer, consider revising your recorded interactions.  SB.getAPIVersion() of '1.2' does not support type of " + v, 2);
                                }
                                break;
                            case "result":
                                if (v === "incorrect") {
                                    v = "wrong";
                                }
                                break;
                            default:
                                // nothing to check
                                break;
                            }
                            nn = tiers.join(".");
                            break;
                        case "objectives":
                            // need to rollback or ignore values that do not exist
                            switch (tiers[3]) {
                            case "id":
                                // ok
                                break;
                            case "status":
                            case "success_status":
                            case "completion_status":
                                tiers[3] = 'status'; // consolidate
                                if (v === "unknown") { // not supported, fix - not attempted is allowed.
                                    v = "not attempted"; // convert
                                }
                                break;
                            case "progress_measure":
                            case "description":
                                // Could consider formatting description to the objective.n.id (alphanumeric 255)
                                ig = true;
                                break;
                            case "score":
                                if (tiers[4] === "scaled") {
                                    ig = true;
                                }
                                break;
                            default:
                                scorm.debug(settings.prefix + ": Unexpected value passed in '" + n + "', please verify your code.", 2);
                                break;
                            }
                            nn = tiers.join(".");
                            break;
                        default:
                            nn = n; // no change
                            break;
                        }
                        break;
                    }

                    if (ig) {
                        return 'false';
                    }
                    s = lms.LMSSetValue(nn, v); //makeBoolean(lms.LMSSetValue(nn, v));
                //} else {
                //    debug(settings.prefix + ": Warning, you are not in normal mode.  Ignoring 'set' requests.", 2);
                //    return 'false';
                //}
                break;
            case "2004":
                API.mode = API.mode === "" ? lms.GetValue('cmi.mode') : API.mode;
                //if (API.mode === "normal") { // Whether or not an LMS persists any of the data sent by the SCO, while in a mode of review or browse, is outside the scope of the SCORM.
                    switch (n) {
                    case "cmi.location":
                        if (v.length > 1000) {
                            debug(settings.prefix + ": Warning, your bookmark is over the limit!!", 2);
                        }
                        break;
                    case "cmi.completion_status":
                        API.data.completion_status = v;
                        // set local status
                        break;
                    case "cmi.success_status":
                        API.data.success_status = v;
                        // set local status
                        break;
                    case "cmi.exit":
                        API.data.exit_type = v;
                        // set local status
                        break;
                    case "suspend_data":
                        if (v.length > 64000) {
                            debug(settings.prefix + ": Warning, your suspend data is over the limit!!", 2);
                        }
                        break;
                    default:
                        // any other handling?
                        break;
                    }
                    s = lms.SetValue(n, v); //makeBoolean(lms.SetValue(n, v));
                if (API.mode !== "normal") {
                    debug(settings.prefix + ": Warning, you are not in normal mode.  The LMS may ignore 'SetValue' requests.", 2);
                }
                break;
            default:
                // handle non-LMS?
                break;
            }
            ec = getLastErrorCode();
            m = getLastErrorMessage(ec);
            d = getDiagnostic(ec);
            // Custom Event Trigger setvalue
            //$(self).triggerHandler({
            Utl.triggerEvent(self, 'setvalue', {
                //'type': "setvalue",
                'n': n,
                'v': v,
                'error': {
                    'code': ec,
                    'message': m,
                    'diagnostic': d
                }
            });
            // Ensure Error Codes not critical
            if (ec === 0 || ec === 403) {
                return s;
            }
            debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + " for " + n + "\nDiagnostic: " + getDiagnostic(ec), 1);
            return s;
        }
        debug(settings.prefix + ": " + n + " Set Aborted, connection not initialized! Locate where you called it after you Terminated.", 2);
        return 'false';
    };
    /**
     * Commit (SCORM Call)
     * Commits the Data to the Server via the LMS API.  SCORM Time done by default.
     * @returns {String} 'true' or 'false'
     */
    this.commit = function () {
        var s        = 'false',
            lms      = API.path,
            ec       = 0,
            session_secs,
            saveDate = new Date(),
            lat      = self.checkLatency(),
            speed    = lat > 0.40 ? "slow" : "fast";
        // Write out existing LMS latency
        debug(settings.prefix + " Tip: Current LMS Latency is " + lat + "ms which is " + speed + ".");
        // Clear current latency
        settings.latency_arr = [];
        session_secs = (saveDate.getTime() - settings.startDate.getTime()) / 1000;
        if (API.isActive) {// it has initialized
            debug(settings.prefix + ": Committing data", 3);
            switch (API.version) {
            case "1.2":
                self.setvalue("cmi.core.session_time", centisecsToSCORM12Duration(session_secs * 100));
                s = lms.LMSCommit(""); //makeBoolean(lms.LMSCommit(""));
                break;
            case "2004":
                self.setvalue("cmi.session_time", centisecsToISODuration(session_secs * 100, true));
                s = lms.Commit(""); //makeBoolean(lms.Commit(""));
                break;
            default:
                // handle non-LMS?
                break;
            }
            ec = getLastErrorCode();
            if (ec === 0) {
                return s;
            }
            debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + " for Commit.\nDiagnostic: " + getDiagnostic(ec), 1);
            return 'false';
        }
        debug(settings.prefix + ": Commit Aborted, connection not initialized!", 2);
        return 'false';
    };
    /**
     * Initialize  (SCORM Call)
     * Initializes the SCO
     * @returns {String} 'true' or 'false'
     */
    this.initialize = function () {
        debug(settings.prefix + ": Initialize Called. \n\tversion: " + settings.version + "\n\tModified: " + settings.modifiedDate, 3);
        var s = false, // success boo
            lms = API.path, // shortcut
            ec = 0;
        // error code
        if (!API.isActive) {
            if (lms) {
                switch (API.version) {
                case "1.2":
                    s = makeBoolean(lms.LMSInitialize(""));
                    break;
                case "2004":
                    s = makeBoolean(lms.Initialize(""));
                    break;
                default:
                    // handle local mode ?
                    break;
                }
                ec = getLastErrorCode();
                debug('>>>>>>>>>>>>>>>>>>>>>>>>>>' + s + '>>>>>>>>>>>>>>>>>>>>>>>>', 4);
                // Check for any errors previously
                if (s && ec === 0) {
                    API.isActive = true;
                    API.data.completion_status = self.getvalue('cmi.completion_status');
                    settings.startDate = new Date();
                    //self.setvalue('cmi.exit', settings.exit_type); // Consider setting exit type sooner by default?
                    // Need to set Start Date
                    debug(settings.prefix + ": SCO is initialized.", 3);
                    switch (API.data.completion_status) {
                    case "not attempted":
                    case "unknown":
                        self.setvalue("cmi.completion_status", "incomplete");
                        break;
                    default:
                        if (API.data.completion_status === '') {
                            triggerException("LMS compatibility issue, Please notify a administrator.  Completion Status is empty.");
                        }
                        break;
                    }
                    return 'true';
                }
                debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + " for Initialize.\nDiagnostic: " + getDiagnostic(ec), 1);
            } else {
                debug(settings.prefix + ": Aborted, LMS could not be located!.", 2);
            }
        } else {
            debug(settings.prefix + ": Aborted, connection already initialized!.", 2);
        }
        return 'false';
    };
    /**
     * Terminate (SCORM Call)
     * Terminates the SCO
     * @returns {Boolean}
     */
    this.terminate = function () {
        var s = false, lms = API.path, ec = 0;
        debug(settings.prefix + ": Terminating " + API.isActive + " " + lms, 4);
        if (API.isActive) {
            if (lms) {
                // if not completed or passed, suspend the content.
                debug(settings.prefix + ": completion_status = " + API.data.completion_status + "|| success_status = " + API.data.success_status, 3);
                self.commit(); // Store Data before Terminating (can't trust if LMS wil ldo this)
                switch (API.version) {
                case "1.2":
                    s = lms.LMSFinish(""); //makeBoolean(lms.LMSFinish(""));
                    break;
                case "2004":
                    s = lms.Terminate(""); //makeBoolean(lms.Terminate(""));
                    break;
                default:
                    // handle non-LMS?
                    break;
                }
                if (makeBoolean(s)) {
                    debug(settings.prefix + ": Terminated.", 3);
                    Utl.triggerEvent(self, 'terminated', {});
                    API.isActive = false;
                } else {
                    ec = getLastErrorCode();
                    debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + " for Commit.\nDiagnostic: " + getDiagnostic(ec), 1);
                }
            } else {
                debug(settings.prefix + ": Lost connection to LMS", 2);
            }
        } else {
            debug(settings.prefix + ": Terminate Aborted, connection not initialized!", 2);
        }
        return s;
    };
    // End SCORM Public Calls /////////////
    // Start Public Utility based Support for SCORM Calls
    /**
     * Get Objective By ID
     * This is fun, they make you go fish the objectives array integer by the ID.
     * Objectives do not appear to be 'journaled' as object identifiers have to be unique.
     * As this method is seeking information it may trigger SCORM Errors on the LMS that hint that
     * objects haven't been defined yet.  This is perfectly normal.
     * @param id {*} Alpha-Numeric Identification of the Interaction you're looking for
     * @returns {String} 'false' if nothing found or id
     */
    this.getObjectiveByID = function (id) {
        var count = self.getvalue("cmi.objectives._count"), // obtain total objectives
            i,
            tID;
        scorm.debug(settings.prefix + ": Set Objective - Begin search, Objective count is " + count, 4);
        if (count === '' || count === 'false' || count === '-1') {
            return 'false';
        }
        count = parseInt(count, 10) - 1; // convert from string
        i = count;
        //for (i = count; i >= 0; i -= 1) {
        while (i >= 0) {
            tID = self.getvalue("cmi.objectives." + i + ".id");
            //scorm.debug(settings.prefix + ": Objective ID Check for " + i + " : " + id + " vs " + tID, 4);
            if (id === tID) {
                scorm.debug(settings.prefix + ": Objective ID Match on " + i, 4);
                return i;
            }
            i -= 1;
        }
        return 'false';
    };
    /**
     * Get Interaction By ID
     * This is fun, they make you go fish the interactions array integer by the ID.
     * I included this in the main SCORM API because this functionality should be stock.  You're
     * either going to journal these (history) or treat them like states that you update.  You must decide that.
     * @param id {*} Alpha-Numeric Identification of the Interaction you're looking for
     * @returns {String} 'false' if nothing found or id
     */
    this.getInteractionByID = function (id) {
        var count = self.getvalue("cmi.interactions._count"), // obtain total objectives
            i,
            tID;
        if (count === "" || count === 'false' || count === '-1') { // could be unsupported in SCORM 1.2
            return 'false';
        }
        if (API.version === "1.2") {
            // SCORM 1.2 cannot read these values, but it needs to know the next count.
            scorm.debug(settings.prefix + ": Developer, consider ignoring these requests if SB.getAPIVersion is equal to 1.2", 2);
            return count;
        }
        count = parseInt(count, 10) - 1; // convert from string
        scorm.debug(settings.prefix + ": Getting interactions from count " + count, 4);
        i = count;
        //for (i = count; i >= 0; i -= 1) {
        while (i >= 0) {
            tID = this.getvalue("cmi.interactions." + i + ".id");
            //scorm.debug(settings.prefix + ": Interaction ID Check for " + i + " : " + tID + " vs " + id, 4);
            if (id === tID) {
                scorm.debug(settings.prefix + ": Interaction By ID Returning " + i);
                return i;
            }
            i -= 1;
        }
        return 'false';
    };
    /**
     * Get interaction.n.objective By ID
     * You can have multiple objectives assigned to a interaction.
     */
    this.getInteractionObjectiveByID = function (n, id) {
        var count = self.getvalue("cmi.interactions." + n + ".objectives._count"), // obtain total objectives
            i,
            tID;
        if (count === "" || count === 'false') {
            return '0';
        }
        if (API.version === "1.2") {
            // SCORM 1.2 cannot read these values.
            scorm.debug(settings.prefix + ": Developer, consider ignoring these requests if SB.getAPIVersion is equal to 1.2", 2);
            return 'false';
        }
        count = parseInt(count, 10) - 1; // convert from string
        scorm.debug(settings.prefix + ": Getting interaction objectives from count " + count, 4);
        i = count;
        //for (i = count; i >= 0; i -= 1) {
        while (i >= 0) {
            tID = self.getvalue("cmi.interactions." + n + ".objectives." + i + ".id");
            //scorm.debug(settings.prefix + ": Interaction Objective ID Check for " + i + " : " + tID + " vs " + id, 4);
            if (id === tID) {
                scorm.debug(settings.prefix + ": Interaction Objective By ID Returning " + i);
                return i;
            }
            i -= 1;
        }
        return 'false';
    };
    /**
     * Get interaction.n.correct_responses By pattern
     * You can have multiple correct responses assigned to a interaction.
     */
    this.getInteractionCorrectResponsesByPattern = function (n, pattern) {
        var count = self.getvalue("cmi.interactions." + n + ".correct_responses._count"), // obtain total correct_responses
            i,
            p;
        if (count === "" || count === 'false') {
            scorm.debug(settings.prefix + ": Correct Responses pattern was empty or false", 4);
            return '0'; // never created before so go with 0
        }
        count = parseInt(count, 10) - 1; // convert from string
        scorm.debug(settings.prefix + ": Getting interaction correct responses from count " + count, 4);
        i = count;
        //for (i = count; i >= 0; i -= 1) {
        while (i >= 0) {
            p = self.getvalue("cmi.interactions." + n + ".correct_responses." + i + ".pattern");
            //scorm.debug(settings.prefix + ": Interaction Correct Responses Pattern Check for " + i + " : " + p + " vs " + pattern, 4);
            if (pattern === p) {
                scorm.debug(settings.prefix + ": Interaction Correct Responses By Pattern Returning " + i);
                return "match";
            }
            i -= 1;
        }
        return 'false';
    };
    // End SCORM Public Utilities
    // Internal API Public Calls //////////
    /**
     * Init (Internal API)
     * Initializes the SCORM API, and locates the LMS API
     * @returns {Boolean}
     */
    this.init = function () {
        // Search for LMS API
        var win;
        try {
            win = window.parent;
            if (win && win !== window) {
                findAPI(window.parent);
            }
        } catch (e) {/* Cross Domain issue */
            debug(settings.prefix + " Possible Cross-domain issue/local mode (ignore).", 2);
            //debug(e, 1);
        }
        if (!API.path) {
            try {
                win = window.top.opener;
                findAPI(win);
            } catch (ee) {/* Cross domain issue */
                debug(settings.prefix + " Possible Cross-domain issue/local mode (ignore).", 2);
                //debug(ee, 1);
            }
        }
        if (API.path) {
            API.connection = true;
            return true;
        }
        debug(settings.prefix + ": I was unable to locate an API for communication", 2);
        if (settings.use_standalone) {
            // Create Local API in SCORM 2004
            debug(settings.prefix + ": If you included Local_API_1484_11 I'll mimic the LMS.  If not, all SCORM calls will fail.", 4);
            settings.standalone = true;
            API.version = "2004";
            // May or may not be provided (standalone) if not, this is null (DOA)
            API.path = typeof SCOBot_API_1484_11 === 'function' ? new SCOBot_API_1484_11({cmi: settings.cmi}) : null;
            // API connection is not true for local in this scenario. isConnected() will not work for local in this
            // situation.
            //$(API.path).on('StoreData', function (e) {
            // Add 'StoreData' listener to rebroadcast
            Utl.addEvent(API.path, 'StoreData', function (e) {
                //$(self).triggerHandler({
                Utl.triggerEvent(self, 'StoreData', e);
            });
            return true;
        }
        return false;
    };
    /**
     * Get Last Error (Internal API)
     * Converts error integer to Message String
     * @returns {object}
     * {
     *   code: {number},
     *   msg: {string},
     *   diag: {string}
     * }
     */
    this.getLastError = function () {
        var ec = getLastErrorCode();
        return {
            code: ec,
            msg: getLastErrorMessage(ec),
            diag:getDiagnostic(ec)
        };
    };
    /**
     * Is LMS Connected
     * Will tell you if LMS is truly connected or not.  You may be running locally.
     * @return {Boolean}
     */
    this.isLMSConnected = function () {
        return API.connection;
    };
    /**
     * Get API Version
     * Will return the SCORM API version
     * @return {String} 1.2, 2004
     */
    this.getAPIVersion = function () {
        return API.version;
    };
    /**
     * Is Connection Active
     * Verify connection is initialized.
     * @returns {Boolean}
     */
    this.isConnectionActive = function () {
        return API.isActive;
    };
    /**
     * Check API Latency
     * Its come to my attention that some LMS systems have abysmal performance.
     * Due to server round trips vs. cached computer managed instruction (CMI).
     * Depending on this, you may want to take action.  LMS folk will tell you to decease your SCORM communications.
     * That's a great idea, why didn't I think of that!
     * @returns {Number} millisecond lag for getvalue
     */
    this.checkLatency = function () {
        Utl.calcAverage(settings.latency_arr);
    };
    /**
     * Set (Internal API)
     * This locally sets values local to this API
     * @param n {String} name
     * @param v (String,Number,Object,Array,Boolean} value
     */
    this.set = function (n, v) {
        //debug(settings.prefix + ": set " + n, 3);
        // May need to maintain read-only perms here, case them out as needed.
        switch (n) {
        case "version":
        case "createDate":
        case "modifiedDate":
        case "prefix":
            triggerWarning(405);
            return false;
            //break;
        case "isActive":
            API.isActive = v;
            settings[n] = v;
            break;
        case "startDate":
            settings[n] = new Date(v);
            // Need to set Start Date if forcing isActive!
            break;
        default:
            settings[n] = v;
            break;
        }
        return (isError !== 0);
    };
    /**
     * Get (Internal API)
     * This locally gets values local to this API
     * @param n {String} name
     * @returns {*} value or {Boolean} false
     */
    this.get = function (n) {
        //debug(settings.prefix + ": get " + n, 3);
        if (settings[n] === undefined) {
            triggerWarning(404);
            return false;
        }
        return settings[n];
    };
    /**
     * Hook for External Plugins like Flash to set Time
     * Public to Private API's
     */
    this.centisecsToSCORM12Duration = centisecsToSCORM12Duration;
    this.centisecsToISODuration = centisecsToISODuration;
    this.ISODurationToCentisec = ISODurationToCentisec;
    this.isoDateToStringUTC = isoDateToStringUTC;
    this.isoDateToString = isoDateToString;
    this.isoStringToDate = isoStringToDate;
    this.scorm12toMS = scorm12toMS; // may just make it a date object.
    this.dateToscorm12Time = dateToscorm12Time;
    this.makeBoolean = makeBoolean;
    this.debug = debug;
    // Self Initialize, note you could make this call outside, but later I decided to do it by default.
    this.init();
}
