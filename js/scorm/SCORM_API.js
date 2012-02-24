/*global window, alert, console, $, JQuery, debug, scorm, Local_API_1484_11 */
/*jslint devel: true, browser: true */
/**
 * SCORM API
 * This is a content API self establishes communication with the LMS in SCORM 2004 or 1.2.
 * Switch Statement will convert SCORM 2004 calls to SCORM 1.2, but you must understand there are limitations
 * on data storage between versions. Example: Suspend Data 64,000 vs 4096 or Bookmark(location) 1000 vs 255.
 * Depending on your usages your content may not squeeze into a SCORM 1.2 space.  Because of this, log messages will
 * be output so you can monitor your cmi "set" value length.  Ultimately, a LMS may block your request because of this.
 * This API is meant to simply common SCORM Tasks, but also offer the ability to use it 'long hand'. Several other
 * public API's are available online, some free some charge based and this is a best effort to boil it all down.
 * Documentation, Samples, Resources, and Credits: ADL, Claude Ostyn, Pipwerks, Rustici
 * Goals: SCORM For Everyone Else, Low Overhead, Simple API's, Containment, and Transparency.
 *
 * Typical CMI Usage:
 * var scorm = new SCORM_API({debug: true, exit_type: 'finish'});
 * scorm.initialize()
 * scorm.getvalue('cmi.location');
 * scorm.setvalue('cmi.location', '4');
 * scorm.commit();
 * scorm.terminate();
 *
 * HTML Event Setup:
 * Tips for onload and onunload, onbeforeunload events.  You may need to make init, exit methods to do other things,
 * vs. directly referencing the SCORM API here.  Feel free to make those methods if you need to.  'window.top' is used because
 * some deployments self occur within a popup in a IFRAME will not fire properly on exit, in some mozilla browsers.
 * window.top.onload         = scorm.initialize;
 * window.top.onunload       = scorm.terminate;
 *
 * @author Mark Statkus <mark@cybercussion.com>
 * @requires JQuery
 * @param options {Object} override default values
 * @constructor
 *
 * The MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
function SCORM_API(options) {
	// Constructor ////////////
	"use strict";
	// Please edit run time options or override them when you instantiate this object.
	var defaults = {
			version : "1.0",
			createDate : "04/05/2011 08:56AM",
			modifiedDate : "02/23/2012 10:00AM",
			debug : false,
			isActive : false,
			throw_alerts : false,
			prefix : "SCORM_API",
			exit_type : "suspend",
			success_status : "unknown",
			use_standalone : true,
			standalone: false,
			completion_status : "unknown"
		},
		// Settings merged with defaults and extended options
		settings = $.extend(defaults, options),
		// Internal API Error Boolean, Error Code object
		isError = 0,
		error = {
			0 : "No Error",
			404 : "Not Found",
			405 : "Prevented on a read only resource"
		},
		// API Object
		API = {
			connection : false,
			version : "none", // 2004, 1.2 or none
			path : false, // Set Path to LMS API or maybe something local later by default?
			data : {// Defaults, I'm moving a few of the SCORM defaults into this data object, they will be maintained here thereafter.
				completion_status : settings.completion_status,
				success_status: settings.success_status,
				exit_type : settings.exit_type
			},
			isActive : settings.isActive  // If SCO is initialized already, this was added for a page by page concept where pages unload and load.
		},
		self = this;
	// Public to Public call hook within the internal API
	// Set some more 'settings'
	settings.error = error;	 // Inherit
	settings.startDate = {}; // Set on Success of Initialize aka "the start time"
	// End Constructor ////////

	// Private ////////////////
	/**
	 * No Console
	 * Lack of support in older browsers forced this
	 * @param msg {String} Debug Message
	 * @param lvl {Mixed} 1=Error, 2=Warning, 3=Log, 4=Info
	 * @event debug fired when no console is available.  You could listen to this to put it in an alternative log.
	 */
	function noconsole(msg, lvl) {
		// ignore (IE 8 and prior or other browser that doesn't support it).  Routing event out so it can be handled.
		$(self).triggerHandler({
			'type': "debug",
			'msg': msg,
			'lvl': lvl
		});
	}

	/**
	 * Debug
	 * Built-In Debug Functionality to output to console (Firebug, Inspector, Dev Tool etc ...)
	 * @param msg {String} Debug Message
	 * @param lvl {Integer} 1=Error, 2=Warning, 3=Log, 4=Info
	 */
	function debug(msg, lvl) {
		if (settings.debug) {// default is false
			if (!window.console) {// IE 7 probably 6 was throwing a error if 'console undefined'
				window.console = {};
				window.console.info = noconsole;
				window.console.log = noconsole;
				window.console.warn = noconsole;
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
		} else {// Toss to get attention (override in defaults)
			if (lvl < 3 && settings.throw_alerts) {
				alert(msg);
			}
		}
		return false;
	}
	/**
	 * Find API
	 * API_1484_11 or API for SCORM 2004 or 1.2
	 * @param win {object} Window level
	 */
	function findAPI(win) {
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
	// SCORM Time centric to SCORM 2004 and 1.2 Compatibility
	/**
	 * Centiseconds To ISO Duration
	 * Borrowed from Claude Ostyn, but touched up for JSLint/JavaScript and evil "with" statement
	 * @param n {Number} Total Seconds
	 * @param bPrecise {Boolean} Only Set true if were dealing with months, years (highly unlikely)
	 * @returns {String} SCORM 2004 Time PT0H0M0S Format
	 */
	function centisecsToISODuration(n, bPrecise) {
		// Note: SCORM and IEEE 1484.11.1 require centisec precision
		// Parameters:
		// n = number of centiseconds
		// bPrecise = optional parameter; if true, duration will
		// be expressed without using year and/or month fields.
		// If bPrecise is not true, and the duration is long,
		// months are calculated by approximation based on average number
		// of days over 4 years (365*4+1), not counting the extra days
		// for leap years. If a reference date was available,
		// the calculation could be more precise, but becomes complex,
		// since the exact result depends on where the reference date
		// falls within the period (e.g. beginning, end or ???)
		// 1 year ~ (365*4+1)/4*60*60*24*100 = 3155760000 centiseconds
		// 1 month ~ (365*4+1)/48*60*60*24*100 = 262980000 centiseconds
		// 1 day = 8640000 centiseconds
		// 1 hour = 360000 centiseconds
		// 1 minute = 6000 centiseconds
		var str = "P",
			nCs = Math.max(n, 0),
			nY = 0,
			nM = 0,
			nD = 0,
			nH = 0,
			nMin = 0,
			nS = 0;
		// Next set of operations uses whole seconds
		//with (Math) { //agrumentavely considered harmful
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
	 * Pad Time
	 * Pads time with proper formatting (double digits)
	 */
	function padTime(n) {
        return n < 10 ? '0' + n : n;
    }
	/**
	 * ISO 8601 Date String UTC
	 * Converts date object into ISO 8601 standard
	 * returns {String} ISO 8601
	 */
	function isoDateStringUTC(d) {
	    return d.getUTCFullYear() + '-' + padTime(d.getUTCMonth() + 1) + '-' + padTime(d.getUTCDate()) + 'T' + padTime(d.getUTCHours()) + ':' + padTime(d.getUTCMinutes()) + ':' + padTime(d.getUTCSeconds()) + 'Z';
	}
	/**
	 * Centiseconds To SCORM 1.2 Duration
	 * Borrowed from Claude Ostyn, but touched up for JSLint/JavaScript and evil "with" statement
	 * @param n {Number} Total Seconds
	 * @param bPrecise {Boolean} Only Set true if were dealing with months, years (highly unlikely)
	 * @returns {String} SCORM 2004 Time PT0H0M0S Format
	 */
	function centisecsToSCORM12Duration(n) {
		// Format is [HH]HH:MM:SS[.SS]
		var bTruncated = false, str, nH, nCs, nM, nS;
		//with (Math) { agrumentavely considered harmful
		n = Math.round(n);
		nH = Math.floor(n / 360000);
		nCs = n - nH * 360000;
		nM = Math.floor(nCs / 6000);
		nCs = nCs - nM * 6000;
		nS = Math.floor(nCs / 100);
		nCs = nCs - nS * 100;
		//}
		if (nH > 9999) {
			nH = 9999;
			bTruncated = true;
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
		//if (bTruncated) alert ("Hours truncated to 9999 to fit HHHH:MM:SS.SS format")
		return str;
	}
	// End SCORM Time Handlers /////////////////////////////	
	/**
	 * Make Boolean
	 * Turns 'yes', 'no', 'true', 'false', '0', '1' into true/false
	 * @param v {String} value to turn to boolean
	 * @returns {Boolean}
	 */
	function makeBoolean(str) {
		if (str === undefined) {
			debug(settings.prefix + " : makeBoolean was given empty string, converting to false", 2);
			return false;
		} else if (str === true || str === false) {
			return Boolean(str);
		} else {
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
	 * Error Message assicoated by error code
	 * @param {Number} error code
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
	 */
	this.getvalue = function (n) {
		var v = null, // success
			lms = API.path, // lms shortcut
			ec = 0, // error code
			nn = null, // new number
			ig = false;	// ignore		
		// Custom event Trigger getvalue
		$(self).triggerHandler({
			'type': "getvalue",
			'n': n
		});
		if (API.isActive) {// it has initialized
			// This is switch cased to appropriately translate SCORM 2004 to 1.2 if needed.
			// Handy if you don't want to go thru all your content calls...
			switch (API.version) {
			case "1.2":
				switch (n) {
				case "cmi.location":
					nn = "cmi.core.lesson_location";
					break;
				case "cmi.completion_threshold":
					// unsupported
					ig = true;
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
				case "cmi.success_status":
				case "cmi.completion_status":
					nn = "cmi.core.lesson_status";
					break;
				case "cmi.session_time":
					nn = "cmi.core.session_time";
					break;
				// Possibly need more here, review further later.
				case "cmi.suspend_data":
					nn = n;
					break;
				default:
					nn = n;
					break;
				}
				if (ig) {
					return 'false';
				} else {
					v = lms.LMSGetValue(nn);
				}
				break;
			case "2004":
				v = lms.GetValue(n);
				break;
			default:
				// handle non-LMS failover (will return 'false' below otherwise)?
				break;
			}
			ec = getLastErrorCode();
			// Clean up Error Codes that are non-critical (like date element not initialized)
			if (ec === 0 || ec === 403) {
				// Clean up differences in LMS responses
				if (typeof v === 'undefined' || v === null || v === 'null') {
					v = "";
				}
				return String(v);
			} else {
				debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + "\nDiagnostic: " + getDiagnostic(ec), 1);
			}
		} else {
			debug(settings.prefix + ": " + n + " Get Aborted, connection not initialized! " + API.isActive, 2);
		}
		return 'false';
	};
	/**
	 * Set Value (SCORM Call)
	 * Sets the cmi object value by name
	 * @param n {String} CMI Object Path as String
	 * @param v {String} Value
	 * @returns {String}
	 */
	this.setvalue = function (n, v) {
		var s = false, // success
			lms = API.path, // lms shortcut
			ec = 0, // error code
			nn = null, // new number
			ig = false;	// ignore
		// Custom Event Trigger setvalue
		$(self).triggerHandler({
			'type': "setvalue",
			'n': n,
			'v': v
		});
		// Security Consideration?
		// It may be worth some minor security later to validate this is being set from a authorized source.  This is lacking support old versions of IE however.
		//debug(settings.prefix + ": The caller of this method is " + arguments.callee.caller.caller.name, 4);  //arguments.callee.caller	
		if (API.isActive) {// it has initialized
			// This is switch cased to appropriately translate SCORM 2004 to 1.2 if needed.
			// Handy if you don't want to go thru all your content calls...
			switch (API.version) {
			case "1.2":
				switch (n) {
				case "cmi.location":
					if (v.length > 255) {
						debug(settings.prefix + ": Warning, your bookmark is over the limit!!", 2);
					}
					nn = "cmi.core.lesson_location";
					break;
				case "cmi.completion_threshold":
					// unsupported
					ig = true;
					break;
				case "cmi.mode":
					nn = "cmi.core.lesson_mode";
					break;
				case "cmi.exit":
					nn = "cmi.core.exit";
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
					API.data.completion_status = v;
					// set local status
					break;
				case "cmi.session_time":
					nn = "cmi.core.session_time";
					break;
				// Possibly need more here, review further later.
				case "cmi.suspend_data":
					if (v.length > 4096) {
						debug(settings.prefix + ": Warning, your suspend data is over the limit!!", 2);
					}
					nn = n;
					break;
				default:
					nn = n;
					break;
				}
				if (ig) {
					return 'false';
				} else {
					s = lms.LMSSetValue(nn, v); //makeBoolean(lms.LMSSetValue(nn, v));
				}
				break;
			case "2004":
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
				break;
			default:
				// handle non-LMS?
				break;
			}
			ec = getLastErrorCode();
			// Ensure Error Codes not critical
			if (ec === 0 || ec === 403) {
				return s;
			} else {
				debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + " for " + n + "\nDiagnostic: " + getDiagnostic(ec), 1);
			}
		} else {
			debug(settings.prefix + ": " + n + " Set Aborted, connection not initialized! Locate where you called it after you Terminated.", 2);
		}
		return 'false';
	};
	/**
	 * Commit (SCORM Call)
	 * Commits the Data to the Server via the LMS API.  SCORM Time done by default.
	 * @param n {String} CMI Object Path as String
	 * @param v {String} Value
	 * @returns {String} 'true' or 'false'
	 */
	this.commit = function () {
		var s            = false,
			lms          = API.path,
			ec           = 0,
			session_secs = 0,
			saveDate     = new Date();
		session_secs     = (saveDate.getTime() - settings.startDate.getTime()) / 1000;
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
			} else {
				debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + " for Commit.\nDiagnostic: " + getDiagnostic(ec), 1);
				return 'false';
			}
		} else {
			debug(settings.prefix + ": Commit Aborted, connection not initialized!", 2);
			return 'false';
		}
	};
	/**
	 * Initialize  (SCORM Call)
	 * Initializes the SCO
	 * @returns {Boolean}
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
				// Check for any errors previously
				if (s && ec === 0) {
					API.isActive = true;
					API.data.completion_status = self.getvalue('cmi.completion_status');
					settings.startDate = new Date();
					// Need to set Start Date
					debug(settings.prefix + ": SCO is initialized.", 3);
					switch (API.data.completion_status) {
					case "not attempted":
					case "unknown":
						self.setvalue("cmi.completion_status", "incomplete");
						break;
					default:
						// Do nothing
						break;
					}
					return 'true';
				} else {
					debug(settings.prefix + ": Error\nError Code: " + ec + "\nError Message: " + getLastErrorMessage(ec) + " for Initialize.\nDiagnostic: " + getDiagnostic(ec), 1);
				}
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
				self.commit();	// Store Data before Terminating
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
	 * @param id {Mixed} Alpha-Numeric Identification of the Interaction you're looking for 
	 * @returns id {String} 'false' if nothing found.
	 */
	this.getObjectiveByID = function (id) {
		var count = self.getvalue("cmi.objectives._count"), // obtain total objectives
			i,
			tID;
		scorm.debug(settings.prefix + ": Objective count is " + count, 4);
		if (count === '' || count === 'false') {
			return 'false';
		} else {
			count = parseInt(count, 10); // convert from string
			for (i = count; i >= 0; i -= 1) {
				tID = self.getvalue("cmi.objectives." + i + ".id");
				scorm.debug(settings.prefix + ": Objective ID Check for " + i + " : " + tID + " vs " + id, 4);
				if (id === tID) {
					return i;
				}
			}
			return 'false';
		}
	};
	/**
	 * Get Interaction By ID
	 * This is fun, they make you go fish the interactions array integer by the ID.
	 * I included this in the main SCORM API because this functionality should be stock.  You're
	 * either going to journal these (history) or treat them like states that you update.  You must decide that.
	 * @param id {Mixed} Alpha-Numeric Identification of the Interaction you're looking for 
	 * @returns id {String} 'false' if nothing found
	 */
	this.getInteractionByID = function (id) {
		var count = self.getvalue("cmi.interactions._count"), // obtain total objectives
			i,
			tID;
		if (count === "") {
			return 'false';
		} else {
			count = parseInt(count, 10) - 1; // convert from string
			scorm.debug(settings.prefix + ": Getting interactions from count " + count, 4);
			for (i = count; i >= 0; i -= 1) {
				tID = this.getvalue("cmi.interactions." + i + ".id");
				scorm.debug(settings.prefix + ": Interaction ID Check for " + i + " : " + tID + " vs " + id, 4);
				if (id === tID) {
					scorm.debug(settings.prefix + ": Interaction By ID Returning " + i);
					return i;
				}
			}
			return 'false';
		}
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
		} else {
			count = parseInt(count, 10) - 1; // convert from string
			scorm.debug(settings.prefix + ": Getting interaction objectives from count " + count, 4);
			for (i = count; i >= 0; i -= 1) {
				tID = self.getvalue("cmi.interactions." + n + ".objectives." + i + ".id");
				scorm.debug(settings.prefix + ": Interaction Objective ID Check for " + i + " : " + tID + " vs " + id, 4);
				if (id === tID) {
					scorm.debug(settings.prefix + ": Interaction Objective By ID Returning " + i);
					return i;
				}
			}
			return 'false';
		}
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
		} else {
			count = parseInt(count, 10) - 1; // convert from string
			scorm.debug(settings.prefix + ": Getting interaction correct responses from count " + count, 4);
			for (i = count; i >= 0; i -= 1) {
				p = self.getvalue("cmi.interactions." + n + ".correct_responses." + i + ".pattern");
				scorm.debug(settings.prefix + ": Interaction Correct Responses Pattern Check for " + i + " : " + p + " vs " + pattern, 4);
				if (pattern === p) {
					scorm.debug(settings.prefix + ": Interaction Correct Responses By Pattern Returning " + i);
					return i;
				}
			}
			return 'false';
		}
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
		if (window.parent && window.parent !== window) {
			findAPI(window.parent);
		}
		if (!API.path && window.top.opener) {
			findAPI(window.top.opener);
		}
		if (API.path) {
			API.connection = true;
			return 'true';
		} else {
			debug(settings.prefix + ": I was unable to locate an API for communication", 2);
			if (settings.use_standalone) {
				// Create Local API in SCORM 2004
				debug(settings.prefix + ": If you included Local_API_1484_11 I'll mimic the LMS.  If not, all SCORM calls will fail.", 4);
				settings.standalone = true;
				API.version = "2004";
				// May or maynot be provided (standalone) if not, this is null (DOA)
				API.path = typeof (Local_API_1484_11) === 'function' ? new Local_API_1484_11() : null;
				return true;
			} else {
				return false;
			}
		}
	};
	/**
	 * Get Last Error (Internal API)
	 * Converts error integer to Message String
	 * @param n {String} name
	 * @returns value {String}
	 */
	this.getLastError = function (n) {
		return error[n];
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
		return (isError !== 0) ? true : false;
	};
	/**
	 * Get (Internal API)
	 * This locally gets values local to this API
	 * @param n {String} name
	 * @returns value {Mixed}
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
	this.isoDateStringUTC = isoDateStringUTC;
	this.makeBoolean = makeBoolean;
	this.debug = debug;
	// Self Initialize, note you could make this call outside, but later I decided to do it by default.
	this.init();
}