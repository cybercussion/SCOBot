/*global $, JQuery, scorm, window */
/*jslint devel: true, browser: true, regexp: true */
/**
 * This is a sample SCORM Startup sequence and handicap API's for ease of use.
 * General Concept: When the LMS connects, call var SB = new SCOBot();
 * SCOBot
 * This only works with the SCORM_API, but has the basis to work with other API's.
 * Several public API's will call one to many SCORM Calls and this will make every attempt
 * to do common SCORM Tasks or boil down SCORM tasks into a smaller easy to use method.
 * Mode: {get} Browse, Review, Normal
 * Bookmark: {get/set} SCO Progress
 * Suspend Data: {get/set} Suspend Data Object
 * Interactions: {set} Interaction(s)
 * Objectives: {set} Objective(s)
 *
 * https://github.com/cybercussion/SCORM_API
 * @author Mark Statkus <mark@cybercussion.com>
 * @requires scorm, JQuery
 * @param options {Object} override default values
 * @constructor
 */
 /*!
 * SCOBot
 * Copyright (c) 2011-2012 Mark Statkus <mark@cybercussion.com>
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
function SCOBot(options) {
	// Constructor ////////////
	"use strict";
	/** @default version, createDate, modifiedDate, prefix, launch_data, interaction_mode, success_status, location, completion_status, suspend_data, mode, scaled_passing_score, totalInteractions, totalObjectives, startTime */
	var defaults = {
			version: "1.0.2",
			createDate: "04/07/2011 09:33AM",
			modifiedDate: "10/23/2012 3:00PM",
			prefix: "SCOBot",
			// SCORM buffers and settings
			launch_data: {},
			interaction_mode: "state", // or journaled
			launch_data_type: "querystring", // or json
			scorm_edition: "3rd", // or 4th - this is a issue with "editions" of SCORM 2004 that differ 
			success_status: "unknown",
			location: "",
			completion_status: "",
			suspend_data: {pages: []},
			mode: "",
			completion_threshold: 0,
			scaled_passing_score: 0.7,
			totalInteractions: 0,
			totalObjectives: 0,
			startTime: 0
		},
		// Settings merged with defaults and extended options
		settings     = $.extend(defaults, options),
		lmsconnected = false,
		isExit       = false,
		isError      = false,
		isStarted    = false,
		badValues    = '|null|undefined|false|| |',
		error        = scorm.get('error'), // no sense retyping this
		self         = this; // Hook
	// End Constructor ////////
	///////////////////////////
	// Private ////////////////
	/**
	 * Initialize SCO
	 * This is commonly done on load of the web page.
	 * Default behavior
	 * @event load
	 * @returns {Boolean} true or false if established LMS connection
	 */
	function initSCO() {
		lmsconnected = scorm.initialize();
		scorm.debug(settings.prefix + ": SCO Loaded from window.onload " + lmsconnected, 4);
		if (lmsconnected) {
			self.start(); // Things you'd do like getting mode, suspend data
			// Custom Event Trigger load
			$(self).triggerHandler({
				'type': "load"
			});
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
		if (!isExit) {
			isExit = true;
			// Custom Event Trigger load
			$(self).triggerHandler({
				'type': "unload"
			});
			if (scorm.get('exit_type') === "normal") {
				self.finish();
			} else {
				self.suspend();
			}
			scorm.debug(settings.prefix + ": SCO is done unloading.", 4);
		}
		return isExit;
	}
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
		$(self).triggerHandler({
			'type': 'exception',
			'error': msg
		});
	}
	/**
	 * Is Performing
	 * This is based on cmi.success_status
	 * @returns {Boolean} based on if this value has been set (true) or (false) if not
	 */
	function isPassed() {
		var success = scorm.getvalue('cmi.success_status');
		return !(success !== "passed" && success !== "failed");
	}
	/**
	 * Verify cmi score scaled
	 * Validates if success_status is passed, and exit_type is normal.  Checks that score.max is 1.
	 * May need to tighten this up later, its mostly for SCO's that default to finish and expect them to be complete.
	 */
	function verifyScoreScaled() {
		var success = scorm.getvalue('cmi.success_status');
		if (success === 'passed' && scorm.get('exit_type') === "normal") {
			if (scorm.getvalue('cmi.score.scaled') === 'false') {
				if (scorm.getvalue('cmi.score.max') === '1') {
					scorm.setvalue('cmi.score.scaled', '1');
				}
			}
		}
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
	 */
	function cleanseData(str) {
		var cleanseExp = /[^\f\r\n\t\v\0\s\S\w\W\d\D\b\\B\\cX\\xhh\\uhhh]/gi; ///(\f\r\n\t\v\0[/b]\s\S\w\W\d\D\b\B\cX\xhh\uhhh)/;
		return str.replace(cleanseExp, '');
	}
	/**
	 * Is ISO 8601
	 * I've got a RegEx to validate ISO 8601 time based on SCORM 2004 Formats.
	 * This is a great common way to do this so regardless of time zone you can reflect the 
	 * time this time stamp was referring to.
	 * Acceptable Format GMT 2012-02-28T15:00:00.0-8:00, UTC 2012-02-28T15:00:00.0-8:00Z, Plain 2012-02-28T15:00:00
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
		var d = new Date();
		return d.getTime() + (Date.remoteOffset || 0);
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
	 * @returns {Number}
	 */
	function findResponseType(type, str) {
		var reg = 0;
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
	 * Set Value By Interaction Type
	 * This is a data filter to convert input formats into SCORM standard strings.  Please review each interaction for what it expects.
	 * This will not enforce SCORM char limits, so please mind your logs if your doing something your not suppose to.
	 * @param type {String} Expects true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other
	 * @param value {Mixed} May take Array or Object of arrays depending
	 * @returns {String} formatted value for interaction type
	 */
	function encodeInteractionType(type, value) {
		var str = '',
			i = 0,
			arr = [];
		switch (type) {
		/*
		 * True / False
		 * This will expect a {Boolean}, else it will throw error.
		 */
		case 'true-false':
			value = value.toString();
			if (value === 'true' || value === 'false') {
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
			 */
		case 'sequencing':
			// a[,]b
			if ($.isArray(value)) {
				str = value.join("[,]");
				value = str;
			} else {
				scorm.debug(settings.prefix + ": Developer, you're not passing a array type for sequencing/choice.  I got " + typeof (value) + " instead\n" + JSON.stringify(value), 1);
				value = '';
			}
			return value;
		/*
		 * Fill In
		 * This will expect an {Object} with optional values
		 * {
		 *		case_matters: true, // optional {Boolean}
		 *		order_maters: true, // optional {Boolean}
		 *		lang: 'en-us',      // optional, can also be alternate letter lang code {String}
		 *		words: [            // required {Array}
		 *			'word1',
		 *			'word2'
		 *		]
		 * }
		 */
		case 'fill-in':
			// Word
			// {case_matters=true}{order_matters=true}{lang=en-us}word1[,]word2
			if ($.isPlainObject(value)) {
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
				str += value.words.join("[,]");
				value = str;
			} else {
				scorm.debug(settings.prefix + ": Developer, you're not passing a object type for fill in.  I got " + typeof (value) + " instead", 1);
				value = '';
			}
			return value;
		/*
		 * Long Fill In
		 * This will expect an {Object} with optional values
		 * {
		 *		case_matters: true,   // Optional {Boolean}
		 *		lang: 'en-us',        // Optional, can also be alternate letter lang code {String}
		 *		text: 'Bunch of text' // Required 4000 character limit {String}
		 * }
		 */
		case 'long-fill-in':
			// Bunch of text...
			// {case_matters=true}{lang=en}Bunch of text...
			if ($.isPlainObject(value)) {
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
				scorm.debug(settings.prefix + ": Developer, you're not passing a object type for long fill in.  I got " + typeof (value) + " instead", 1);
				value = '';
			}
			return value;
		/*
		 * Matching
		 * This will expect {Array} of {Array}'s
		 * [
		 *		['tile1', 'target1'],
		 *		['tile2', 'target3'],
		 *		['tile3', 'target2']
		 * ]
		 */
		case 'matching':
			// tile1[.]target1[,]tile2[.]target3[,]tile3[.]target2
			if ($.isArray(value)) {
				for (i = 0; i < value.length; i += 1) {
					if ($.isArray(value[i])) {
						arr.push(value[i].join("[.]")); // this isn't working
					} else {
						scorm.debug(settings.prefix + ": Developer, you're not passing a array type for matching/performance.  I got " + typeof (value) + " instead", 1);
						return '';
					}
				}
				str = arr.join("[,]");
				value = str;
			} else {
				scorm.debug(settings.prefix + ": Developer, you're not passing a array type for matching/performance.  I got " + typeof (value) + " instead", 1);
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
		 *	order_matters: false,
		 *	answers: [
		 *			["step_1", "inspect wound"],
		 *			["step_2", "clean wound"],
		 *			["step_3", "apply bandage"]
		 *		]
		 *	}
		 * Learner Response:
		 * [
		 *		["step_1", "inspect wound"],
		 *		["step_2", "clean wound"],
		 *		["step_3", "apply bandage"]
		 * ]
		 */
		case 'performance':
			//
			if (!$.isArray(value)) { // This would be a Correct Response Pattern
				// Check for order_matters
				if (value.order_matters !== undefined) {
					str += "{order_matters=" + value.order_matters + "}";
				}
				if ($.isArray(value.answers)) {
					for (i = 0; i < value.answers.length; i += 1) {
						if ($.isArray(value.answers[i])) {
							arr.push(value.answers[i].join("[.]")); // this isn't working
						} else {
							scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance correct response.  I got " + typeof (value.answers[i]) + " instead on " + i, 1);
							scorm.debug(value, 1);
							return '';
						}
					}
					str += arr.join("[,]");
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance correct response.  I got " + typeof (value.answers) + " instead", 1);
					scorm.debug(value, 1);
				}
			} else {
				if (typeof ($.isArray(value))) { // This would be a Learner Response
					for (i = 0; i < value.length; i += 1) {
						if ($.isArray(value[i])) {
							arr.push(value[i].join("[.]")); // this isn't working
						} else {
							scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance learner response.  I got " + typeof (value[i]) + " instead on " + i, 1);
							scorm.debug(value, 1);
							return '';
						}
					}
					str = arr.join("[,]");
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing a array type for performance learner response.  I got " + typeof (value) + " instead", 1);
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
			if (typeof (value) === "number") {
				value = value.toString();
			} else {
				// Verify number to save some time.
				str = parseFloat(value);
				if (str === "NaN") {
					scorm.debug(settings.prefix + ": Developer, your not passing a number for a numeric interaction.  I got " + value + " instead", 1);
				}
			}
			return value;
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
			return value.toString(); // Do nothing, but ensure string
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
	 * @returns {Mixed} formatted value for interaction type
	 */
	function decodeInteractionType(type, value) {
		var i = 0,
			arr = [],
			obj = {},
			match = false;
		switch (type) {
		case 'true-false':
			return value;
		case 'choice':
		case 'sequencing':
			// a[,]b to array
			arr = value.split("[,]");
			value = arr;
			return value;
		/*
		 * Fill In
		 * This will expect an {Object} with optional values
		 * {
		 *		case_matters: true, // optional {Boolean}
		 *		order_maters: true, // optional {Boolean}
		 *		lang: 'en-us',      // optional, can also be alternate letter lang code {String}
		 *		words: [            // required {Array}
		 *			'word1',
		 *			'word2'
		 *		]
		 * }
		 */
		case 'fill-in':
			// Word
			// {case_matters=true}{order_matters=true}{lang=en-us}word1[,]word2
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
		 *		case_matters: true,   // Optional {Boolean}
		 *		lang: 'en-us',        // Optional, can also be alternate letter lang code {String}
		 *		text: 'Bunch of text' // Required 4000 character limit {String}
		 * }
		 */
		case 'long-fill-in':
			// Bunch of text...
			// {case_matters=true}{lang=en}Bunch of text...
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
		 *		['tile1', 'target1'],
		 *		['tile2', 'target3'],
		 *		['tile3', 'target2']
		 * ]
		 */
		case 'matching':
		// tile1[.]target1[,]tile2[.]target3[,]tile3[.]target2
			arr = value.split("[,]");
			for (i = 0; i < arr.length; i += 1) {
				arr[i] = arr[i].split("[.]"); // this isn't working
			}
			return arr;
		/*
		 * Performance
		 * This will expect {Array} of {Array}'s
		 * Similar to matching, but its optional to pass the step identifier
		 * Correct Response Pattern: {Object}
		 * {
		 *	order_matters: false,
		 *	answers: [
		 *			["step_1", "inspect wound"],
		 *			["step_2", "clean wound"],
		 *			["step_3", "apply bandage"]
		 *		]
		 *	}
		 * Learner Response: {Array}
		 * ["step_1", "inspect wound"],
         * ["step_2", "clean wound"],
         * ["step_3", "apply bandage"]
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
			for (i = 0; i < arr.length; i += 1) {
				arr[i] = arr[i].split("[.]"); // this isn't working
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
	 * @returns {Boolean} true (success) false (fail)
	 */
	function setSuspendData() {
		var result;
		// May want to consider updating scoring here at this time
		result = scorm.setvalue('cmi.suspend_data', cleanseData(JSON.stringify(settings.suspend_data)));
		if (result === 'true') {
			scorm.debug(settings.prefix + ": Suspend Data saved", 4);
			scorm.debug(settings.suspend_data, 4);
			return 'true';
		}
		scorm.debug(settings.prefix + ": Sorry, there was an issue saving your suspend data, please review the SCORM Logs", 1);
		return 'false';
	}
	/**
	 * Check Progress
	 * This should be used sparingly.  Its going to total up the scoring real-time based on any interactions and objectives.
	 * cmi.score.scaled, 
	 * cmi.success_status, 
	 * cmi.completion_status,
	 * cmi.progress_measure
	 * @returns {Object} or false
	 * {
	 *	score_scaled      = '0',
	 *	success_status    = 'failed',
	 *	progress_measure  = '0',
	 *	completion_status = 'incomplete'
	 * }
	 */
	function checkProgress() {
		if (isStarted) {
			var response                 = {},
				scoreRaw                 = 0,
				tmpRaw                   = 0,
				scoreMax                 = 0,
				scoreMin                 = 0,
				scoreScaled              = 1,
				progressMeasure          = 0,
				completionStatus         = '',
				totalObjectivesCompleted = 0,
				totalKnownObjectives     = parseInt(scorm.getvalue('cmi.objectives._count'), 10),
				totalKnownInteractions   = parseInt(scorm.getvalue('cmi.interactions._count'), 10),
				i                        = 0,
				count                    = 0;
			if (settings.totalInteractions === 0 || settings.totalObjectives === 0) {
				// This is a non-starter, if the SCO Player doesn't set these we are flying blind
				scorm.debug(settings.prefix + ": Sorry, I cannot calculate Progress as the totalInteractions and or Objectives are zero", 2);
				return 'false';
			}
			// Set Score Totals (raw, min, max) and count up totalObjectivesCompleted
			count = parseInt(scorm.getvalue('cmi.objectives._count'), 10);
			scorm.debug(settings.prefix + " Count is " + count);
			if (count > 0) {
				count = count - 1; //subtract 1 (max count)
				for (i = count; i >= 0; i -= 1) {
					// Count up totalObjectivesCompleted
					//scoreMax += parseInt(scorm.getvalue('cmi.objectives.' + i + '.score.max'), 10); // should be un-used, might validate
					//scoreMin += parseInt(scorm.getvalue('cmi.objectives.' + i + '.score.min'), 10); // should be un-used, might validate
					tmpRaw = parseFloat(scorm.getvalue('cmi.objectives.' + i + '.score.raw'));
					scorm.debug('Score Raw: ' + tmpRaw);
					if (!isNaN(tmpRaw)) {
						scoreRaw += parseFloat(tmpRaw); // Whoops, said Int instead of Float.  Updated 8/14
					} else {
						scorm.debug(settings.prefix + " We got a NaN converting objectives." + i + ".score.raw", 2);
					}
					if (scorm.getvalue('cmi.objectives.' + i + '.completion_status') === 'completed') {
						totalObjectivesCompleted += 1;
					}
				}
			}
			// Set Score Raw
			scorm.debug(settings.prefix + "Setting score " + scorm.setvalue('cmi.score.raw', scoreRaw.toString()));
			// Set Score Scaled
			if ((settings.scoreMax - settings.scoreMin) === 0) {
				// Division By Zero
				scorm.debug(settings.prefix + ": Division by Zero for scoreMax - scoreMin " + settings.scoreMax, 2);
				scorm.setvalue('cmi.score.scaled', scoreScaled);
			} else {
				scoreScaled = ((scoreRaw - settings.scoreMin) / (settings.scoreMax - settings.scoreMin)).toString();
				scorm.debug(settings.prefix + ": Score Scaled = " + scoreScaled, 3);
				scorm.setvalue('cmi.score.scaled', trueRound(scoreScaled, 7));
			}
			// Set Progress Measure
			progressMeasure = (totalObjectivesCompleted / settings.totalObjectives).toString();
			scorm.setvalue('cmi.progress_measure', trueRound(progressMeasure, 7));
			// Set Completion Status
			if (parseFloat(progressMeasure, 10) >= parseFloat(settings.completion_threshold, 10)) {
				scorm.setvalue('cmi.completion_status', 'completed');
			} else {
				scorm.setvalue('cmi.completion_status', 'incomplete');
			}
			// Set Success Status
			if (parseFloat(scoreScaled, 10) >= parseFloat(settings.scaled_passing_score, 10)) {
				scorm.setvalue('cmi.success_status', 'passed');
			} else {
				scorm.setvalue('cmi.success_status', 'failed');
			}
			return {
				score_scaled: scorm.getvalue('cmi.score.scaled'),
				success_status: scorm.getvalue('cmi.success_status'),
				progress_measure: scorm.getvalue('cmi.progress_measure'),
				completion_status: scorm.getvalue('cmi.completion_status')
			};
		}
		return notStartedYet();
	}
	/**
	 * Get Comments From LMS
	 * Checks to see if there are any comments from the LMS, and will
	 * return a complete object back for use with a display.
	 * @return {Object} or 'false'
	 */
	function getCommentsFromLMS() {
		if (isStarted) {
			var p1       = "cmi.comments_from_lms.",
				count    = scorm.getvalue(p1 + '_count'),
				response = [],
				obj      = {},
				i        = 0;
			if (!isBadValue(count)) {
				return 'false';
			}
			count -= 1;
			for (i = 0; i <= count; i += 1) {
				p1 += i + '.';
				obj.comment = scorm.getvalue(p1 + 'comment');
				obj.location = scorm.getvalue(p1 + 'location');
				obj.timestamp = scorm.getvalue(p1 + 'timestamp');
				response.push(obj);
				obj = {};
			}
			return response;
		}
		return notStartedYet();
	}
	/**
	 * Update Status
	 * Rolled up success/completion status functionality
	 */
	function updateStatus() {
		verifyScoreScaled();
		if (!isPassed()) {
			scorm.setvalue('cmi.success_status', 'unknown');
		}
		// Default success status
		if (scorm.get("success_status") === 'passed') {
			scorm.setvalue('cmi.success_status', 'passed');
		}
		// Ensure if its not completed its incomplete
		if (scorm.getvalue('cmi.completion_status') !== "completed") {
			scorm.setvalue('cmi.completion_status', 'incomplete'); //? May not want to do this
		}
		// Default to completed if its the default status
		if (scorm.get("completion_status") === "completed") {
			scorm.setvalue('cmi.completion_status', 'completed'); //? May not want to do this
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
		var tmpCompletionThreshold = '',
			tmpScaledPassingScore = '',
			tmpLaunchData = '';
			//queryStringExp = /\\?([^?=&]+)(=([^&#]*))?/gi;
		scorm.debug(settings.prefix + ": I am starting...", 3);
		if (!isStarted) {
			isStarted = true;
			// Retrieve normal settings/parameters from the LMS
			// Get SCO Mode (normal, browse, review)
			settings.startTime       = currentTime();
			tmpLaunchData            = scorm.getvalue('cmi.launch_data');
			// Turn this into a object and differ between json or querystring formats.
			if (settings.launch_data_type === "json") {
				settings.launch_data = JSON.parse(tmpLaunchData);
			} else {
				tmpLaunchData.replace(
					new RegExp("([^?=&]+)(=([^&]*))?", "g"),
					function ($0, $1, $2, $3) {
						settings.launch_data[$1] = $3;
					}
				);
			}
			scorm.debug(settings.prefix + ": Launch Data:", 4);
			scorm.debug(settings.launch_data, 4);
			settings.mode                 = scorm.getvalue('cmi.mode'); // normal, browse, review
			/*
			 * Entry is interesting.  You may or may not be able to rely on it. If the LMS sets it you'd
			 * be able identify if this is the first time (ab-intio), or if your resuming.  This would let you know if
			 * there was even a bookmark, suspend data to even fetch.  Else, you may have to plug at it anyway.
			 * So is it really worth it to bother with this?
			 */
			settings.entry                = scorm.getvalue('cmi.entry'); // ab-initio, resume or empty
			// Entry Check-up ...
			if (settings.entry === '' || settings.entry === 'resume') { // Resume, or possible Resume
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
				 * GOAL: Deal with this in a managed way
				 */
				settings.suspend_data         = (scorm.getvalue('cmi.suspend_data')); // no longer unescaping
				// Quality control - You'd be surprised at the things a LMS responds with
				if (settings.suspend_data.length > 0 && !isBadValue(settings.suspend_data)) {
					// Assuming a JSON String
					scorm.debug(settings.prefix + ": Returning suspend data object from a prior session", 4);
					settings.suspend_data = JSON.parse(settings.suspend_data); // Turn this back into a object.
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
			}
			// Scaled Passing Score
			tmpCompletionThreshold        = scorm.getvalue('cmi.completion_threshold');
			if (!isBadValue(tmpCompletionThreshold) && tmpCompletionThreshold !== "-1") {
				settings.completion_threshold = tmpCompletionThreshold;
			}
			// Completion Threshold is read-only so it comes from the CAM (imsmanifest.xml) or you manage it yourself.
			tmpScaledPassingScore         = scorm.getvalue('cmi.scaled_passing_score'); // This may be empty, default otherwise
			if (!isBadValue(tmpScaledPassingScore) && tmpScaledPassingScore !== "-1") {
				settings.scaled_passing_score = tmpScaledPassingScore;
				// else it defaults to what its set to prior.  i.e. no change.
			}
			settings.completion_status = scorm.getvalue('cmi.completion_status');
			settings.success_status    = scorm.getvalue('cmi.success_status');
			// Lets check for Comments from the LMS
			settings.comments_from_lms = getCommentsFromLMS();
			if (settings.comments_from_lms !== 'false') {
				// Custom Event Trigger load
				$(self).triggerHandler({
					'type': "comments_lms",
					'data': settings.comments_from_lms
				});
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
	 *	totalInteractions: '0',
	 *	totalObjectives: '0',
	 *	scoreMin: '0',
	 *	scoreMax: '0'
	 * }
	 * @returns {String} 'true' or 'false'
	 */
	this.setTotals = function (data) {
		if (isStarted) {
			if (!isBadValue(data.totalInteractions)) {
				settings.totalInteractions = data.totalInteractions;
			}
			if (!isBadValue(data.totalObjectives)) {
				settings.totalObjectives  = data.totalObjectives;
			}
			if (!isBadValue(data.scoreMin)) {
				settings.scoreMin = trueRound(data.scoreMin, 7);
				scorm.setvalue('cmi.score.min', data.scoreMin.toString());
			}
			if (!isBadValue(data.scoreMax)) {
				settings.scoreMax = trueRound(data.scoreMax, 7);
				scorm.setvalue('cmi.score.max', data.scoreMax.toString());
			}
			return 'true';
		}
		return notStartedYet();
	};
	/**
	 * Get Mode
	 * This will return the current SCO Mode we are in (normal, browse, review)
	 * @returns {String} normal, browse, review
	 */
	this.getMode = function () {
		if (isStarted) {
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
		if (isStarted) {
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
		if (isStarted) {
			settings.location = v.toString(); // update local snapshot, ensure string
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
		if (isStarted) {
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
	 *	sco_id: 'A12345',
	 *	name: 'value',
	 *	pages: [
	 *		{
	 *			id: 1,
	 *			title: 'Presentation',
	 *			data: {data object for a page}
	 *		},
	 *		{
	 *			id: 2,
	 *			title: 'Match Game',
	 *			data: {data object for a page}
	 *		}
	 *	]
	 * };
	 * Calling commit will still be needed to truly save it.
	 * @param id {Mixed}
	 * @param data {Object}
	 * @returns {Boolean}
	 */
	this.setSuspendDataByPageID = function (id, title, data) {
		if (isStarted) {
			// Suspend data is a array of pages by ID
			var i;
			for (i = 0; i < settings.suspend_data.pages.length; i += 1) {
				if (settings.suspend_data.pages[i].id === id) {
					// Update Page data
					settings.suspend_data.pages[i].data = data; // overwrite existing
					scorm.debug(settings.prefix + ": Suspend Data Set", 4);
					scorm.debug(settings.suspend_data, 4);
					return 'true';
				}
			}
			// new page push
			settings.suspend_data.pages.push({'id': id, 'title': title, 'data': data});
			scorm.debug(settings.prefix + ": Suspend Data set:", 4);
			scorm.debug(settings.suspend_data, 4);
			return 'true';
		}
		return notStartedYet();
	};
	/**
	 * Get Suspend Data By Page ID
	 * This will get the suspend data by id 
	 * @param id {Mixed}
	 * @returns {Object} but false if empty.
	 */
	this.getSuspendDataByPageID = function (id) {
		if (isStarted) {
			// Suspend data is a array of pages by ID
			var i;
			for (i = 0; i < settings.suspend_data.pages.length; i += 1) {
				if (settings.suspend_data.pages[i].id === id) {
					return settings.suspend_data.pages[i].data;
				}
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
	 *	id: '1',                             // 4000 chars
	 *	type: 'true-false',                  // (true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other)
	 *	objectives: [
	 *		{
	 *			id: '12'
	 *		}
	 *	],
	 *	timestamp: 'expects date object when interaction starts',  // second(10,0) Pass a date object
	 *	correct_responses: [
	 *		{
	 *			pattern: ''                  // depends on interaction type
	 *		}
	 *	],
	 *	weighting: '1',
	 *	learner_response: 'true',
	 *	result: 'correct',                   // (correct, incorrect, unanticipated, neutral, real (10,7) )
	 *	latency: 'expects date object after interaction is done',  // second(10,2)
	 *	description: "The question commonly" // 250 chars
	 * }
	 * @param data {Object} Interaction Object from SCORM
	 * @returns {String} 'true' or 'false'
	 */
	this.setInteraction = function (data) {
		if (isStarted) {
			var n,       // Reserved for the count within interactions.n
				m,       // Reserved for the count within interactions.n.objectives.m
				i,       // Reserved for objective loop
				j,       // Reserved for correct responses loop
				p,       // Reserved for the count within interactions.n.ncorrect_responses.p loop
				p1 = 'cmi.interactions.', // Reduction of retyping
				p2 = '',                  // Reduction of retyping
				orig_timestamp = data.timestamp || scorm.isoStringToDate(scorm.getvalue(p1 + scorm.getInteractionByID(data.id) + '.timestamp')),
				timestamp, // Reserved for converting the Timestamp
				latency, // Reserved for doing the Timestamp to latency conversion (May not exist)
				namespace, // Reserved for holding the cmi.interaction.n. name space to stop having to re-type it
				result;  // Result of calling values against the SCORM API
			if (!$.isPlainObject(data)) {
				scorm.debug(settings.prefix + ": Developer, your not passing a {object} argument!!  Got " + typeof (data) + " instead.", 1);
				return 'false';
			}
			if (isBadValue(data.id)) {
				// This is a show stopper, try to give them some bread crumb to locate the problem.
				scorm.debug(settings.prefix + ": Developer, your passing a interaction without a ID\nSee question:\n" + data.description, 1);
				return 'false';
			}
			//Time stuff will need to move after ID is added
			//if (typeof (data.timestamp) === "object") {
			if ($.type(data.timestamp) === "date") {
				timestamp = scorm.isoDateToString(data.timestamp); // 2012-02-12T00:37:29 formatted
			}
			data.timestamp = timestamp;
			//if (typeof (data.latency) === "object") {
			if ($.type(data.latency) === "date") {
				latency        = (data.latency.getTime() - orig_timestamp.getTime()) / 1000;
				data.latency   = scorm.centisecsToISODuration(latency * 100, true);  // PT0H0M0S
			} else if (data.learner_response.length > 0 && !isBadValue(data.learner_response)) {
				// may want to force latency?
				data.latency   = new Date();
				latency        = (data.latency.getTime() - orig_timestamp.getTime()) / 1000;
				data.latency   = scorm.centisecsToISODuration(latency * 100, true);  // PT0H0M0S
			} // Else you won't record latency as the student didn't touch the question.
			// Check for Interaction Mode
			p2 = '_count';
			if (settings.interaction_mode === "journaled") {
				// Explicitly stating they want a history of interactions
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
			if (!isBadValue(data.id)) { result = scorm.setvalue(p1 + 'id', data.id); }
			if (!isBadValue(data.type)) {
				result = scorm.setvalue(p1 + 'type', data.type);
			}
			// Objectives will require a loop within data.objectives.length, and we may want to validate if an objective even exists?
			// Either ignore value because its already added, or add it based on _count
			// result = scorm.setvalue('cmi.interactions.'+n+'.objectives.'+m+".id", data.objectives[i].id);
			p2 = 'objectives._count';
			if (data.objectives !== undefined) {
				for (i = 0; i < data.objectives.length; i += 1) {
					// We need to find out if the objective is already added
					m = scorm.getInteractionObjectiveByID(n, data.objectives[i].id); // will return 0 or the locator where it existed or false (not found)
					if (m === 'false') {
						m = scorm.getvalue(p1 + p2) === '-1' ? '0' : scorm.getvalue(p1 + p2);
					}
					result = scorm.setvalue(p1 + 'objectives.' + m + '.id', data.objectives[i].id);
				}
			}
			if (data.timestamp !== undefined) {
				result = scorm.setvalue(p1 + 'timestamp', data.timestamp);
			}
			// Correct Responses Pattern will require a loop within data.correct_responses.length, may need to format by interaction type 
			//result = scorm.setvalue('cmi.interactions.'+n+'.correct_responses.'+p+'.pattern', data.correct_responses[j].pattern);
			p2 = 'correct_responses._count';
			if ($.isArray(data.correct_responses)) {
				// !! Important, some only support 1 correct response pattern (likert, other) !!
				for (j = 0; j < data.correct_responses.length; j += 1) {
					p = scorm.getInteractionCorrectResponsesByPattern(n, data.correct_responses[j].pattern);
					scorm.debug(settings.prefix + ": Trying to locate pattern " + data.correct_responses[j].pattern + " resulted in " + p, 4);
					if (p === 'false') {
						p = scorm.getvalue(p1 + p2) === '-1' ? 0 : scorm.getvalue(p1 + p2);
						scorm.debug(settings.prefix + ": p is now " + p, 4);
					}
					result = scorm.setvalue(p1 + 'correct_responses.' + p + '.pattern', encodeInteractionType(data.type, data.correct_responses[j].pattern));
				}
			} else {
				scorm.debug(settings.prefix + "Something went wrong with Correct Responses, it wasn't an Array.", 1);
			}
			if (!isBadValue(data.weighting)) { result = scorm.setvalue(p1 + 'weighting', data.weighting); }
			if (!isBadValue(data.learner_response)) { result = scorm.setvalue(p1 + 'learner_response', encodeInteractionType(data.type, data.learner_response)); } // will need to format by interaction type
			if (!isBadValue(data.result)) { result = scorm.setvalue(p1 + 'result', data.result); }
			if (!isBadValue(data.latency)) { result = scorm.setvalue(p1 + 'latency', data.latency); }
			if (!isBadValue(data.description)) { result = scorm.setvalue(p1 + 'description', data.description); }
			return result;
		}
		return notStartedYet();
	};
	/**
	 * Get Interaction
	 * Returns the full Interaction object 
	 * @param id {String}
	 * @returns {Mixed} object or string 'false'
	 * {
	 *	id: '1',                             // 4000 chars
	 *	type: 'true-false',                  // (true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other)
	 *	objectives: [
	 *		{
	 *			id: '12'
	 *		}
	 *	],
	 *	timestamp: 'expects date object when interaction starts',  // second(10,0) Pass a date object
	 *	correct_responses: [
	 *		{
	 *			pattern: ''                  // depends on interaction type
	 *		}
	 *	],
	 *	weighting: '1',
	 *	learner_response: 'true',
	 *	result: 'correct',                   // (correct, incorrect, unanticipated, neutral, real (10,7) )
	 *	latency: 'expects date object after interaction is done',  // second(10,2)
	 *	description: "The question commonly" // 250 chars
	 * }
	 * or
	 * 'false'
	 */
	this.getInteraction = function (id) {
		if (isStarted) {
			var n = 'false', // Interaction count
				p1 = 'cmi.interactions.', // Reduction of typing
				m = 0, // objectives count
				p = 0, // correct_responses count
				i = 0, // loop count
				obj = {}; // Response object
			n = scorm.getInteractionByID(id);
			if (n === 'false') {
				return n;
			}
			// Lets rebuild the Interaction object
			p1 += n + '.';
			obj.id                = id;
			obj.type              = scorm.getvalue(p1 + 'type');
			m                     = scorm.getvalue(p1 + 'objectives._count');
			obj.objectives        = [];
			if (m !== 'false') {
				//m -= 1; // Subtract one since the _count is the next avail slot
				for (i = 0; i < m; i += 1) {
					obj.objectives.push({
						id: scorm.getvalue(p1 + 'objectives.' + i + '.id')
					});
				}
			}
			obj.timestamp         = scorm.getvalue(p1 + 'timestamp'); // TODO need to convert to date object?
			p                     = scorm.getvalue(p1 + 'correct_responses._count');
			obj.correct_responses = [];
			if (p !== 'false') {
				// Loop thru and grab the patterns
				//p -= 1; // Subtract one since the count is the next available slot and it will result in a error.
				for (i = 0; i < p; i += 1) {
					obj.correct_responses.push({
						pattern: decodeInteractionType(obj.type, scorm.getvalue(p1 + 'correct_responses.' + i + '.pattern'))
					});
				}
			}
			obj.weighting         = scorm.getvalue(p1 + 'weighting');
			obj.learner_response  = decodeInteractionType(obj.type, scorm.getvalue(p1 + 'learner_response'));
			obj.result            = scorm.getvalue(p1 + 'result');
			obj.latency           = scorm.getvalue(p1 + 'latency'); // TODO need to convert to date object?
			obj.description       = scorm.getvalue(p1 + 'description');
			return obj;
			/*
			 Could return in this format
			 return {
				id: '',
				type: '',
				objectives: [],
				timestamp: {},
				correct_responses: [],
				weighting: '',
				learner_response: '',
				result: '',
				latency: '',
				description: ''
			 };
			 */
		}
		return notStartedYet();
	};
	/**
	 * Set Objective
	 * Sets the data for the scorm objective.  ID's have to be set first and must be unique.
	 * Example data object
	 * {
	 *	id: '1',                            // 4000 chars
	 *	score: {
	 *		scaled: '0',                    // real(10,7) *
	 *		raw: '0',
	 *		min: '0',
	 *		max: '0'
	 *	}
	 *	success_status: 'failed',            // (passed, failed, unknown)
	 *	completion_status: 'incomplete',     // (completed, incomplete, not attempted, unknown)
	 *	progress_measure: '0',               // real(10,7)
	 *	description: 'This is the objective' // 250 Chars
	 * }
	 * @param data {Object} Objective object from SCORM
	 * @returns {String} 'true' or 'false'
	 */
	this.setObjective = function (data) {
		if (isStarted) {
			var p1 = 'cmi.objectives.',
				n = scorm.getObjectiveByID(data.id),
				i = 0,
				result = 'false',
				f = false;
			scorm.debug(settings.prefix + ": Setting Objective at " + n + " (This may be false)");
			if (isBadValue(n)) { // First Run
				n = scorm.getvalue(p1 + '_count');
				if(n === 'false') {
					scorm.debug(settings.prefix + ": LMS is return false, can not proceed, check error codes");
					return n;
				}
				scorm.debug(settings.prefix + ": Objective " + data.id + " was not found.  Adding new at " + n + " " + data.description);
				f = true;
			}
			p1 += n + '.';
			if (f) {
				if (!isBadValue(data.id)) {
					scorm.setvalue(p1 + 'id', data.id.toString());
				} else { // Show stopper
					scorm.debug(settings.prefix + ": You did not pass an objective ID!!", 1);
					return 'false';
				}
			}
			if ($.isPlainObject(data.score)) {
				if (!isBadValue(data.score.scaled)) {
					result = scorm.setvalue(p1 + 'score.scaled', trueRound(data.score.scaled, 7).toString());
				}
				if (!isBadValue(data.score.raw)) {
					result = scorm.setvalue(p1 + 'score.raw', trueRound(data.score.raw, 7).toString());
				}
				if (!isBadValue(data.score.min)) {
					result = scorm.setvalue(p1 + 'score.min', trueRound(data.score.min, 7).toString());
				}
				if (!isBadValue(data.score.max)) {
					result = scorm.setvalue(p1 + 'score.max', trueRound(data.score.max, 7).toString());
				}
			} else {
				scorm.debug(settings.prefix + ": Did not receive a score object.  May or may not be an issue.", 4);
			}
			if (!isBadValue(data.success_status)) {
				result = scorm.setvalue(p1 + 'success_status', data.success_status);
			}
			if (!isBadValue(data.completion_status)) {
				result = scorm.setvalue(p1 + 'completion_status', data.completion_status);
			}
			if (!isBadValue(data.progress_measure)) {
				result = scorm.setvalue(p1 + 'progress_measure', trueRound(data.progress_measure, 7));
			}
			if (!isBadValue(data.description)) {
				result = scorm.setvalue(p1 + 'description', data.description);
			}
			scorm.debug(settings.prefix + ": Progress\n" + JSON.stringify(checkProgress(), null, " "), 4);
			return result;
		}
		return notStartedYet();
	};
	/**
	 * Get Objective
	 * Returns the Objective object by ID
	 * @param id {String}
	 * @returns {Mixed} object or string 'false'
	 * {
	 *	id: '1',                            // 4000 chars
	 *	score: {
	 *		scaled: '0',                    // real(10,7) *
	 *		raw: '0',
	 *		min: '0',
	 *		max: '0'
	 *	}
	 *	success_status: 'failed',            // (passed, failed, unknown)
	 *	completion_status: 'incomplete',     // (completed, incomplete, not attempted, unknown)
	 *	progress_measure: '0',               // real(10,7)
	 *	description: 'This is the objective' // 250 Chars
	 * }
	 * or 
	 * 'false'
	 */
	this.getObjective = function (id) {
		if (isStarted) {
			var n = scorm.getObjectiveByID(id),
				p1 = 'cmi.objectives.',
				obj = {};
			if (n === 'false') {
				return n;
			}
			p1 += n + ".";
			// Build Response
			return {
				id:  scorm.getvalue(p1 + "id"),
				score: {
					scaled: scorm.getvalue(p1 + "score.scaled"),
					raw: scorm.getvalue(p1 + "score.raw"),
					min: scorm.getvalue(p1 + "score.min"),
					max: scorm.getvalue(p1 + "score.max")
				},
				success_status: scorm.getvalue(p1 + "success_status"),
				completion_status: scorm.getvalue(p1 + "completion_status"),
				progress_measure: scorm.getvalue(p1 + "progress_measure"),
				description: scorm.getvalue(p1 + "description")
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
	this.setCommentFromLearner = function(msg, loc, date) {
		var p1 = "cmi.comments_from_learner.",
			n = scorm.getvalue(p1 + "_count");
		if(n === 'false') {
			scorm.debug(settings.prefix + ": Sorry, LMS returned a comments count of 'false'.  Review error logs.");
			return n;
		}
		if(msg.length > 0 && msg.length < 4000) {
			scorm.debug(settings.prefix + ": Sorry, message from learner was empty or exceeded the limit.", 2);
		}
		p1 += n + '.';
		scorm.setvalue(p1 + 'comment', msg);
		scorm.setvalue(p1 + 'location', loc);
		return scorm.setvalue(p1 + 'timestamp', scorm.isoDateToString(date));
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
	this.gradeIt = function() {
		var scoreScaled = 1,
			scoreRaw = scorm.getvalue('cmi.score.raw'),
			scoreMin = scorm.getvalue('cmi.score.min'),
			scoreMax = scorm.getvalue('cmi.score.max'),
			progressMeasure = scorm.getvalue('cmi.progress_measure');
		// Set Score Scaled
		if ((scoreMax - scoreMin) === 0) {
			// Division By Zero
			scorm.debug(settings.prefix + ": Division by Zero for scoreMax - scoreMin " + scoreMax, 2);
			scorm.setvalue('cmi.score.scaled', scoreScaled);
		} else {
			scoreScaled = ((scoreRaw - scoreMin) / (scoreMax - scoreMin)).toString();
			scorm.debug(settings.prefix + ": Score Scaled = " + scoreScaled, 3);
			scorm.setvalue('cmi.score.scaled', trueRound(scoreScaled, 7));
		}
		// Set Completion Status
		if (parseFloat(progressMeasure, 10) >= parseFloat(settings.completion_threshold, 10)) {
			scorm.setvalue('cmi.completion_status', 'completed');
		} else {
			scorm.setvalue('cmi.completion_status', 'incomplete');
		}
		// Set Success Status
		if (parseFloat(scoreScaled, 10) >= parseFloat(settings.scaled_passing_score, 10)) {
			scorm.setvalue('cmi.success_status', 'passed');
		} else {
			scorm.setvalue('cmi.success_status', 'failed');
		}
		return 'true';
	};
	/**
	 * Happy Ending
	 * This will auto-score the student to passed, completed, and scored
	 * @return {String}
	 */
	this.happyEnding = function () {
		if (isStarted) {
			scorm.setvalue('cmi.score.scaled', '1');
			scorm.setvalue('cmi.score.raw', '1');
			scorm.setvalue('cmi.success_status', 'passed');
			return scorm.setvalue('cmi.completion_status', 'completed');
		}
		return notStartedYet();
	};
	/**
	 * Commit
	 * This will commit the data stored at the LMS Level to the backend.  Please use sparingly.
	 * @returns {String} 'true' or 'false'
	 */
	this.commit = function () {
		if (isStarted) {
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
		if (isStarted) {
			setSuspendData();
			scorm.debug(settings.prefix + ": I am suspending...", 3);
			scorm.setvalue('cmi.exit', 'suspend');
			updateStatus();
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
		if (isStarted) {
			setSuspendData();
			scorm.debug(settings.prefix + ": I am finishing...", 3);
			scorm.setvalue('cmi.exit', 'normal');
			updateStatus();
			// This is completed per this call.
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
		if (isStarted) {
			setSuspendData();
			scorm.debug(settings.prefix + ": I am timing out...", 3);
			scorm.setvalue('cmi.exit', 'timeout');
			updateStatus();
			// This is completed per this call.
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
	 * Set
	 * This locally sets values local to this API
	 * @param n {String} name
	 * @param v (String,Number,Object,Array,Boolean} value
	 */
	this.set = function (n, v) {
		// May need to maintain read-only perms here, case them out as needed.
		switch (n) {
		case "version":
		case "createDate":
		case "modifiedDate":
		case "prefix":
			triggerWarning(405);
			break;
		default:
			settings[n] = v;
			break;
		}
		return (isError === 0);
	};
	/**
	 * Get 
	 * This locally gets values local to this API
	 * @param n {String} name
	 * @returns value
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
	$(window).bind('load', initSCO);
	//$(window).bind('beforeunload', exitSCO); // You want to confirm exit?
	$(window).bind('unload', exitSCO);
	// Listen for SCORM API Exception
	$(scorm).on('exception', function (e) {
		triggerException(e.error);
	});
}