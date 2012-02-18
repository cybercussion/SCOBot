/*global $, JQuery, scorm, escape, unescape, window */
/*jslint browser: true */
/**
 * This is a sample SCORM Startup sequence and handicap API's for ease of use.
 * General Concept: When the LMS connects, call var SB = new SCOBOT();
 * SCOBOT
 * This only works with the SCORM_API, but has the basis to work with other API's.
 * Several public API's will call one to many SCORM Calls and this will make every attempt
 * to do common SCORM Tasks or boil down SCORM tasks into a smaller easy to use method.
 * Mode: {get} Browse, Review, Normal
 * Bookmark: {get/set} SCO Progress
 * Suspend Data: {get/set} Suspend Data Object
 * Interactions: {set} Interaction(s)
 * Objectives: {set} Objective(s)
 *
 * @author Mark Statkus <mark@cybercussion.com>
 * @requires scorm, JQuery
 * @param options {Object} overwride default values
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
function SCOBot(options) {
	// Constructor ////////////
	/** @default version, createDate, modifiedDate, prefix, interaction_mode, success_status, bookmark, performance, status, suspend_data, mode */
	var defaults = {
			version: "1.0",
			createDate: "04/07/2011 09:33AM",
			modifiedDate: "02/12/2012 12:05PM",
			prefix: "SCOBot",
			// SCORM buffers and settings
			interaction_mode: "state", // or journaled
			success_status: "unknown",
			location: "",
			completion_status: "",
			suspend_data: {pages: []},
			mode: "",
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
		if(lmsconnected) {
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
		if(!isExit) {
			isExit = true;
			// Custom Event Trigger load
			$(self).triggerHandler({
				'type': "unload"
			});
			self.suspend(); // let the player know were exiting
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
	 * Is Performing
	 * This is based on cmi.success_status
	 * @returns {Boolean} based on if this value has been set (true) or (false) if not
	 */
	function isPerforming() {
		if(settings.success_status !== "passed" && settings.success_status !== "failed") {
			return false;
		}
		return true;
	}
	
	/**
	 * Verify cmi score scaled
	 * Validates if success_status is passed, and exit_type is finish.  Checks that score.max is 1.
	 * May need to tighten this up later, its mostly for SCO's that default to finish and expect them to be complete.
	 */
	function verifyScoreScaled() {
		if(settings.success_status === 'passed' && settings.exit_type === "finish") {
			if(scorm.getvalue('cmi.score.scaled') === 'false') {
				if(scorm.getvalue('cmi.score.max') === '1') {
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
		if(badValues.indexOf('|' + v + '|') >= 0) {
			return true;
		} else {
			return false;
		}
	}
	
	// See $.isArray (JQuery)
	/*function isArray(obj) {
		return (obj.constructor.toString().indexOf("Array") != -1);
	}*/
	
	/**
	 * Is ISO 8601 UTC
	 * I've got a RegEx to validate ISO 8601 UTC time by the 'Z' at the end.
	 * This is a great common way to do this so regardless of time zone you can reflect the 
	 * time this time stamp was referring to.
	 * @returns {Boolean} true or false
	 */
	function isISO8601UTC(v) {
		var ISO8601Exp = /(\d{4}-[01]\d\-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+\-][0-2]\d:[0-5]\d|Z))/;
		return ISO8601Exp.test(v);
	}
	
	/**
	 * Round Value
	 * Rounds to 2 decimal places
	 * @param v {Number}
	 * @returns {Number}
	 */
	function roundVal(v){
		var dec = 2,
			result = Math.round(v*Math.pow(10,dec))/Math.pow(10,dec);
		return result;
	}
	
	/**
	 * Not Started Yet
	 * You should never see this message, but I found I may need to trace this more than once.
	 */
	function notStartedYet() {
		scorm.debug(settings.prefix + ": You didn't call 'Start()' yet, or you already terminated, ignoring.", 2);
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
	 * Find Response Type (May not use this)
	 * This is designed to check for {case_matters: true/false}, {order_matters: true/false} or {lang: x}
	 * @param type {String} order_matters, case_matters, lang
	 * @returns {Number}
	 */
	function findResponseType(type, str) {
		var reg = 0;
		switch(type) {
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
	 * @param type {String} Expects true_false, multiple_choice, fill_in, long_fill_in, matching, performance, sequencing, likert, numeric, other
	 * @param value {Mixed} May take Array or Object of arrays depending
	 * @returns {String} formatted value for interaction type
	 * TODO
	 */
	function encodeInteractionType(type, value) {
		var str = '',
			i = 0,
			arr = [];
		switch(type) {
			/*
			 * True / False
			 * This will expect a {Boolean}, else it will throw error.
			 */
			case 'true_false':
				value = value + "";
				if(value === 'true' || value === 'false') {
					return value;
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing true or false for true_false.  I got " + value + " instead", 1);
					value = '';
				}
			return value;
			/*
			 *  Multiple Choice
			 *  This will expect an {Array} value type ["choice_a", "choice_b"]
			 */
			case 'multiple_choice':
			/*
			 * Sequencing
			 * This will expect an {Array}
			 * Similar to multiple choice
			 */
			case 'sequencing':
				// a[,]b
				if($.isArray(value)) {
					str = value.join("[,]");
					value = str;
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing a array type for multiple choice.  I got " + typeof(value) + " instead\n" + JSON.stringify(value), 1);
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
			case 'fill_in':
				// Word
				// {case_matters=true}{order_matters=true}{lang=en-us}word1[,]word2
				if(typeof(value) === "object") {
					// Check for case_matters
					if(value.case_matters !== undefined) {
						str += "{case_matters=" + value.case_matters + "}";
					}
					// Check for order_matters
					if(value.order_matters !== undefined) {
						str += "{order_matters=" + value.order_matters + "}";
					}
					// Check for lang
					if(value.lang !== undefined) {
						str += "{lang=" + value.lang + "}";
					}
					str += value.words.join("[,]");
					value = str;
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing a object type for fill in.  I got " + typeof(value) + " instead", 1);
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
			case 'long_fill_in':
				// Bunch of text...
				// {case_matters=true}{lang=en}Bunch of text...
				if(typeof(value) === "object") {
					// Check for case_matters
					if(value.case_matters !== undefined) {
						str += "{case_matters=" + value.case_matters + "}";
					}
					// Check for lang
					if(value.lang !== undefined) {
						str += "{lang=" + value.lang + "}";
					}
					str += value.text;
					value = str;
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing a object type for long fill in.  I got " + typeof(value) + " instead", 1);
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
			/*
			 * Performance
			 * This will expect {Array} of {Array}'s
			 * Similar to matching, but its optional to pass the step identifier
			 * [
			 *		["step_1", "inspect wound"],
			 *		["step_2", "clean wound"],
			 *		["step_3", "apply bandage"]
			 * ]
			 */
			case 'performance':
				// tile1[.]target1[,]tile2[.]target3[,]tile3[.]target2
				if($.isArray(value)) {
					for(i=0; i<value.length; i++) {
						if($.isArray(value[i])) {
							arr.push(value[i].join("[.]")); // this isn't working
						} else {
							scorm.debug(settings.prefix + ": Developer, you're not passing a array type for matching/performance.  I got " + typeof(value) + " instead", 1);
							return '';
						}
					}
					str = arr.join("[,]");
					value = str;
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing a array type for matching/performance.  I got " + typeof(value) + " instead", 1);
					value = '';
				}
			return value;

			case 'numeric':
				if(typeof(value) === "number") {
					value = value + "";
				} else {
					scorm.debug(settings.prefix + ": Developer, you're not passing a number type for numeric.  I got " + typeof(value) + " instead", 1);
					value = '';
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
			return value + ""; // Do nothing, but ensure string
				default:
				// Invalid
				scorm.debug(settings.prefix + ": Sorry, invalid interaction type detected for " + type + " on " + value, 1);
			return false;
		}
	}
	
	/**
	 * Decode Value By Interaction Type
	 * This is a data filter to convert input formats from SCORM standard strings to there native JS equivalent.
	 * @param type {String} Expects true_false, multiple_choice, fill_in, long_fill_in, matching, performance, sequencing, likert, numeric, other
	 * @param value {String} SCORM 2004 Format for Interaction learner response, or pattern
	 * @returns {Mixed} formatted value for interaction type
	 * TODO
	 */
	function decodeInteractionType(type, value) {
		var str = '',
			i = 0,
			arr = [],
			obj = {};
		switch(type) {
			case 'true_false':
			return value;
			case 'multiple_choice':
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
			case 'fill_in':
				// Word
				// {case_matters=true}{order_matters=true}{lang=en-us}word1[,]word2
				// Check for case_matters
				arr = findResponseType('case_matters', value);
				if(arr !== null) {
					if(arr[0].search(/^\{case_matters=(true|false)\}$/) !== -1) {
						obj.case_matters = arr[0].substring('{case_matters='.length, arr[0].length - 1);
						value = value.substring(arr[0].length, value.length); // trim off
						scorm.debug("=== case matters" + value, 4);
					}
				}
				// Check for order_matters
				arr = findResponseType('order_matters', value);
				if(arr !== null) {
					if(arr[0].search(/^\{order_matters=(true|false)\}$/) !== -1) {
						obj.order_matters = arr[0].substring('{order_matters='.length, arr[0].length - 1);
						value = value.substring(arr[0].length, value.length); // trim off
						scorm.debug("=== order matters" + value, 4);
					}
				}
				// Check for lang
				arr = findResponseType('lang', value);
				if(arr !== null) {
					if(arr[0].search(/^\{lang=.*?\}$/) !== -1) {
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
			case 'long_fill_in':
				// Bunch of text...
				// {case_matters=true}{lang=en}Bunch of text...
					// Check for case_matters
				arr = findResponseType('case_matters', value);
				if(arr !== null) {
					if(arr[0].search(/^\{case_matters=(true|false)\}$/) !== -1) {
						obj.case_matters = arr[0].substring('{case_matters='.length, arr[0].length - 1);
						value = value.substring(arr[0].length, value.length); // trim off
						scorm.debug("=== case matters" + value, 4);
					}
				}
				// Check for lang
				arr = findResponseType('lang', value);
				if(arr !== null) {
					if(arr[0].search(/^\{lang=.*?\}$/) !== -1) {
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
			/*
			 * Performance
			 * This will expect {Array} of {Array}'s
			 * Similar to matching, but its optional to pass the step identifier
			 * [
			 *		["step_1", "inspect wound"],
			 *		["step_2", "clean wound"],
			 *		["step_3", "apply bandage"]
			 * ]
			 */
			case 'performance':
				// tile1[.]target1[,]tile2[.]target3[,]tile3[.]target2
				arr = value.split("[,]");
				for(i=0; i<arr.length; i++) {
					arr[i] = arr[i].split("[.]"); // this isn't working
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
	 * Update Suspend Data
	 * This will submit existing suspend data and call commit saving it on the LMS
	 * Note, you should use this sparingly.  This causes a round trip of data to the server.
	 * I'd recommend using it between pages, or on a timer if your worried about the student
	 * losing their information due to a power, network or computer outage(s).
	 * @returns {Boolean} true (success) false (fail)
	 */
	function saveSuspendData() {
		var result;
		// May want to consider updating scoring here at this time
		result = scorm.setvalue('cmi.suspend_data', escape(JSON.stringify(settings.suspend_data)));
		if(result === 'true') {
			result = scorm.commit();
			if(result === 'false') {
				scorm.debug(settings.prefix + ": Sorry, there was an issue committing, please review the SCORM Logs", 1);
				return result;
			} else {
				scorm.debug(settings.prefix + ": Suspend Data saved", 4);
				scorm.debug(settings.suspend_data, 4);
				return 'true';
			}
		} else {
			scorm.debug(settings.prefix + ": Sorry, there was an issue saving your suspend data, please review the SCORM Logs", 1);
			return 'false';
		}
	}
	
	/**
	 * Update Suspend Data Usage Statistics
	 * Will update settings.suspend_date_usage with current % level
	 */
	function updateSuspendDataUsageStatistics() {
		settings.suspend_data_usage = roundVal( (escape(JSON.stringify(settings.suspend_data)).length / 64000) * 100) + "%";
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
	 *	scoreScaled      = '0',
	 *	successStatus    = 'failed',
	 *	completionStatus = 'incomplete',
	 *	progressMeasure  = '0'
	 * }
	 * TODO, this is still in progress
	 */
	function checkProgress() {
		var response                 = {},
			scoreRaw                 = 0,
			scoreMax                 = 0,
			scoreMin                 = 0,
			scoreScaled              = 1,
			progressMeasure          = 0,
			completionStatus         = '',
			totalObjectivesCompleted = 0,
			totalKnownObjectives     = parseInt(scorm.getvalue('cmi.objectives._count'), 10),
			totalKnownInteractions   = parseInt(scorm.getvalue('cmi.interactions._count'), 10);

		if(settings.totalInteractions === 0 || settings.totalObjectives === 0) {
			// This is a non-starter, if the SCO Player doesn't set these we are flying blind
			scorm.debug(settings.prefix + ": Sorry, I cannot calculate Progress as the totalInteractions and or Objectives are zero", 2);
			return false;
		} else {
			// Set Score Totals (raw, min, max) and count up totalObjectivesCompleted
			//TODO
			
			
			// Set Score Scaled
			if((scoreMax - scoreMin) === 0) {
				// Division By Zero
				scorm.setvalue('cmi.score.scaled', scoreScaled);
			} else {
				scoreScaled = (scoreRaw - scoreMin) / (scoreMax - scoreMin) + "";
				scorm.setvalue('cmi.score.scaled', scoreScaled);
			}
			
			// Set Progress Measure
			progressMeasure = settings.totalObjectivesCompleted / settings.totalObjectives + "";
			scorm.setvalue('cmi.progress_measure', progressMeasure);
			
			// Set Completion Status
			if(progressMeasure >= scorm.getvalue('cmi.completion_threshold')) {
				scorm.setvalue('cmi.completion_status', 'completed');	
			} else {
				scorm.setvalue('cmi.completion_status', 'incomplete');
			}
			
			// Set Success Status
			if(scoreScaled >= settings.scaled_passing_score) {
				scorm.setvalue('cmi.success_status', 'passed');
			} else {
				scorm.setvalue('cmi.success_status', 'failed');
			}
		}
		return response;
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
	this.start = function() {
		var tmpScaledPassingScore = '';
		scorm.debug(settings.prefix + ": I am starting...", 3);
		if(!isStarted) {
			isStarted = true;
			// Retrieve normal settings/parameters from the LMS
			// Get SCO Mode (normal, browse, review)
			settings.startTime            = currentTime();
			settings.mode                 = scorm.getvalue('cmi.mode'); // normal, browse, review
			/*
			 * Entry is interesting.  You may or may not be able to rely on it. If the LMS sets it you'd
			 * be able identify if this is the first time (ab-intio), or if your resuming.  This would let you know if 
			 * there was even a bookmark, suspend data to even fetch.  Else, you may have to plug at it anyway.
			 * So is it really worth it to bother with this?
			 */
			settings.entry                = scorm.getvalue('cmi.entry'); // ab-initio, resume or empty
			// Entry Check-up ...
			if(settings.entry === '' || settings.entry === 'resume') { // Resume, or possible Resume
				// Get Bookmark
				settings.location = scorm.getvalue('cmi.location');
				
				/* Suspend Data technically should be a JSON String.  Structured data would be best suited to
				 * be recorded this way.  If you don't want to do this, you'll need to back out this portion.
				 * Also, in order to eliminate foreign keys and other special characters from messing up some
				 * LMS's we commonly escape going out, and unescape coming in.  We may even need to base64.
				 * !IMPORTANT- once you do this, your kinda stuck with it.  SCO's will begin to save suspend data
				 * and if you change mid-stream your going to have to handle the fact you need to reverse support
				 * old saved data.  Don't fall victim to this little gem.
				 * GOAL: Deal with this in a managed way
				 */
				settings.suspend_data         = unescape(scorm.getvalue('cmi.suspend_data'));
				// Quality control - You'd be surprised at the things a LMS responds with
				if(settings.suspend_data.length > 0 && !isBadValue(settings.suspend_data)) {
					// Assuming a JSON String
					scorm.debug(settings.prefix + ": Returning suspend data object from a prior session", 4);
					settings.suspend_data = JSON.parse(settings.suspend_data); // Turn this back into a object.
					scorm.debug(settings.suspend_data, 4);
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
			tmpScaledPassingScore         = scorm.getvalue('cmi.scaled_passing_score'); // This may be empty, default otherwise
			if(!isBadValue(tmpScaledPassingScore) && tmpScaledPassingScore !== "-1") {
				settings.scaled_passing_score = tmpScaledPassingScore;
				// else it defaults to what its set to prior.  i.e. no change.
			}
			
			settings.completion_status = scorm.getvalue('cmi.completion_status');
			settings.success_status    = scorm.getvalue('cmi.success_status');
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
	this.setTotals = function(data) {		
		if(isStarted) {
			if(!isBadValue(data.totalInteractions)) {settings.totalInteractions = data.totalInteractions;}
			if(!isBadValue(data.totalObjectives)) {settings.totalInteraction  = data.totalObjectives;}
			if(!isBadValue(data.scoreMin)) {settings.scoreMin = data.scoreMin;}
			if(!isBadValue(data.scoreMax)) {settings.scoreMax = data.scoreMax;}	
			return 'true';
		} else {
			notStartedYet();
			return 'false';
		}
	};
	
	/**
	 * Get Mode
	 * This will return the current SCO Mode we are in (normal, browse, review)
	 * @returns {String} normal, browse, review
	 */
	this.getMode = function() {
		if(isStarted) {
			return settings.mode;
		} else {
			notStartedYet();
			return 'false';
		}
	};
	
	/**
	 * Set Bookmark
	 * This will update the local snap shot, and update SCORM (commit still required)
	 * @param v {String} value
	 * returns {String} 'true' or 'false'.
	 */
	this.setBookmark = function(v) {
		if(isStarted) {
			settings.location = v + ""; // update local snapshot, ensure string
			return scorm.setvalue('cmi.location', settings.location);
		} else {
			notStartedYet();
			return 'false';
		}
	};
	
	/**
	 * Get Bookmark
	 * This will return the local snapshot, but is in sync with cmi.location
	 * @returns {String} bookmark
	 */
	this.getBookmark = function() {
		if(isStarted) {
			return settings.location; // return local snapshot
		} else {
			notStartedYet();
			return 'false';
		}
	};
	
	/**
	 * Get Progress
	 * Hooks to Private method used possibly elsewhere in this API
	 * cmi.score.scaled, 
	 * cmi.success_status, 
	 * cmi.completion_status,
	 * cmi.progress_measure
	 * @returns {Object}
	 */
	this.getProgress = checkProgress;
	
	
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
	this.setSuspendDataByPageID = function(id, title, data) {
		// Suspend data is a array of pages by ID
		var i;
		for(i=0; i<settings.suspend_data.pages.length; i++) {
			if(settings.suspend_data.pages[i].id === id ) {
				// Update Page data
				settings.suspend_data.pages[i].data = data; // overwrite existing
				scorm.debug(settings.prefix + ": Suspend Data Set", 4);
				scorm.debug(settings.suspend_data, 4);
				return 'true';
			}
		}
		// new page push
		settings.suspend_data.pages.push({'id': id, 'title': title, 'data': data});
		updateSuspendDataUsageStatistics();
		scorm.debug(settings.prefix + ": Suspend Data Set.\n\t\t\tCurrent Usage: " + settings.suspend_data_usage, 4);
		scorm.debug(settings.suspend_data, 4);
		
		return 'true';
	};
	
	/**
	 * Get Suspend Data By Page ID
	 * This will get the suspend data by id 
	 * @param id {Mixed}
	 * @returns {Object} but false if empty.
	 */
	this.getSuspendDataByPageID = function(id) {
		// Suspend data is a array of pages by ID
		var i;
		for(i=0; i<settings.suspend_data.pages.length; i++) {
			if(settings.suspend_data.pages[i].id === id) {
				return settings.suspend_data.pages[i].data;
			}
		}
		return 'false';
	};
	
	/**
	 * Get Time From Start
	 * 
	 */
	this.getSecondsFromStart = function() {
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
	 *	type: 'true_false',                  // (true_false, multiple_choice, fill_in, long_fill_in, matching, performance, sequencing, likert, numeric, other)
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
	this.setInteraction = function(data) {
		var n,       // Reserved for the count within interactions.n
			m,       // Reserved for the count within interactions.n.objectives.m
			i,       // Reserved for objective loop
			j,       // Reserved for correct responses loop
			p,       // Reserved for the count within interactions.n.ncorrect_responses.p loop
			p1 = 'cmi.interactions.', // Reduction of retyping
			orig_timestamp = data.timestamp,
			timestamp, // Reserved for converting the Timestamp
			orig_latency = data.latency,
			latency, // Reserved for doing the Timestamp to latency conversion (May not exist)
			namespace, // Reserved for holding the cmi.interaction.n. name space to stop having to re-type it
			result;  // Result of calling values against the SCORM API

		//Time stuff will need to move after ID is added
		timestamp = scorm.isoDateStringUTC(data.timestamp); // 2012-02-12T00:37:29Z formatted
		data.timestamp = timestamp;
		if(typeof(data.latency) === "object") {
			latency        = (orig_latency.getTime() - orig_timestamp.getTime()) / 1000;
			data.latency   = scorm.centisecsToISODuration(latency * 100, true);  // PT0H0M0S
		} else if(data.learner_response.length > 0 && !isBadValue(data.learner_response)) {
			// may want to force latency?
			data.latency = new Date();
			latency        = (orig_latency.getTime() - orig_timestamp.getTime()) / 1000;
			data.latency   = scorm.centisecsToISODuration(latency * 100, true);  // PT0H0M0S
		} // Else you won't record latency as the student didn't touch the question.
		
		// Check for Interaction Mode
		if(settings.interaction_mode === "journaled") {
			// Explicitly stating they want a history of interactions
			n = ''; // we want to use cmi.interactions._count
		} else { 
			// Default to state, which will update by id
			// Lets validate taht this data object has a ID
			if(!isBadValue(data.id)) {
				n = scorm.getInteractionByID(data.id); // we want to update by interaction id
				if(isBadValue(n)) {
					n = scorm.getvalue(p1 + '_count'); // This is a add
				}
				/* 
				 * We need to make several setvalues now against cmi.interactions.n.x
				 * As stated by the standard, if we run into issues they will show in the log from the SCORM API.
				 * I won't currently do anything at this point to handle them here, as I doubt there is little that could be done.
				 */
				p1 += n + "."; // Add n to part 1 str
				result = scorm.setvalue(p1 + 'id', data.id);
				result = scorm.setvalue(p1 + 'type', data.type);
				
				// Objectives will require a loop within data.objectives.length, and we may want to validate if an objective even exists?
				// Either ignore value because its already added, or add it based on _count
				// result = scorm.setvalue('cmi.interactions.'+n+'.objectives.'+m+".id", data.objectives[i].id);
				for(i=0; i<data.objectives.length; i++) {
					// We need to find out if the objective is already added
					m = scorm.getInteractionObjectiveByID(n, data.objectives[i].id); // will return 0 or the locator where it existed or false (not found)
					if(m === 'false') {
						m = scorm.getvalue(p1 + 'objectives._count');
					}
					result = scorm.setvalue(p1 + 'objectives.'+m+'.id', data.objectives[i].id);
				}
				
				result = scorm.setvalue(p1 + 'timestamp', data.timestamp);
				
				// Correct Responses Pattern will require a loop within data.correct_responses.length, may need to format by interaction type 
				//result = scorm.setvalue('cmi.interactions.'+n+'.correct_responses.'+p+'.pattern', data.correct_responses[j].pattern);
				for(j=0; j<data.correct_responses.length; j++) {
					p = scorm.getInteractionCorrectResponsesByPattern(n, data.correct_responses[j].pattern);
					scorm.debug(settings.prefix + ": Trying to locate pattern " + data.correct_responses[j].pattern + " resulted in " + p, 4);
					if(p === 'false') {
						p = scorm.getvalue(p1 + 'correct_responses._count');
						scorm.debug(settings.prefix + ": p is now " + p, 4);
					}
					result = scorm.setvalue(p1 + 'correct_responses.' + p + '.pattern', encodeInteractionType(data.type, data.correct_responses[j].pattern));
				}
				
				result = scorm.setvalue(p1 + 'weighting', data.weighting);
				result = scorm.setvalue(p1 + 'learner_response', encodeInteractionType(data.type, data.learner_response)); // will need to format by interaction type
				result = scorm.setvalue(p1 + 'result', data.result);
				result = scorm.setvalue(p1 + 'latency', data.latency);
				result = scorm.setvalue(p1 + 'description', data.description);
				
				return result;
			} else {
				// This is a show stopper, try to give them some bread crumb to locate the problem.
				scorm.debug(settings.prefix + ": Developer, your passing a interaction without a ID\nSee question:\n" + data.description, 1);
				return 'false';
			}
		}
	};
	
	/**
	 * Get Interaction
	 * Returns the full Interaction object 
	 * @param id {String}
	 * @returns {Mixed} object or string 'false'
	 * {
	 *	id: '1',                             // 4000 chars
	 *	type: 'true_false',                  // (true_false, multiple_choice, fill_in, long_fill_in, matching, performance, sequencing, likert, numeric, other)
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
	this.getInteraction = function(id) {
		var n = 'false', // Interaction count
			p1 = 'cmi.interactions.', // Reduction of typing
			m = 0, // objectives count
			p = 0, // correct_responses count
			i = 0, // loop count
			obj = {}; // Response object
		if(isStarted) {
			n = scorm.getInteractionByID(id);
			if(n === 'false') {
				return n;
			} else {
				// Lets rebuild the Interaction object
				p1 += n + '.';
				obj.id                = id;
				obj.type              = scorm.getvalue(p1 + 'type');
				m                     = scorm.getvalue(p1 + 'objectives._count');
				obj.objectives        = [];
				if(m !== 'false') {
					for(i=0; i<m; i++) {
						obj.objectives.push({
							id: scorm.getvalue(p1 + 'objectives.'+i+'.id')
						});
					}
				}
				obj.timestamp         = scorm.getvalue(p1 + 'timestamp'); // TODO need to convert to date object?
				p                     = scorm.getvalue(p1 + 'correct_responses._count');
				obj.correct_responses = [];
				if(p !== 'false') {
					// Loop thru and grab the patterns
					for(i=0; i<p; i++) {
						obj.correct_responses.push({
							pattern: decodeInteractionType(obj.type, scorm.getvalue(p1 + 'correct_responses.'+i+'.pattern'))
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
					descriptoin: ''
				 };
				 */
			}
		} else {
			notStartedYet();
			return 'false';
		}
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
	this.setObjective = function(data) {
		var n = scorm.getvalue('cmi.objective._count'),
			p1 = 'cmi.objectives.',
			i = 0,
			result = 'false';
		if(n === "" || n === 'false') {
			n = 0;
			p1 += n + ".";
			result = scorm.setvalue(p1 + 'id', data.id);
			result = scorm.setvalue(p1 + 'score.scaled', data.score.scaled);
			result = scorm.setvalue(p1 + 'score.raw', data.score.raw);
			result = scorm.setvalue(p1 + 'score.min', data.score.min);
			result = scorm.setvalue(p1 + 'score.max', data.score.max);
			result = scorm.setvalue(p1 + 'score.success_status', data.success_status);
			result = scorm.setvalue(p1 + 'score.completion_status', data.completion_status);
			result = scorm.setvalue(p1 + 'score.progress_measure', data.progress_measure);
			result = scorm.setvalue(p1 + 'score.description', data.description);
		} else {
			n = scorm.getObjectiveByID(data.id);
			if(isBadValue(n)) {
				n = scorm.getvalue('cmi.objectives._count'); // This is a add
			}
			p1 += n + '.';		
			//scorm.setvalue(p1 + '.id', data.id); // shouldn't change this
			if(!isBadValue(data.score.scaled)) {result = scorm.setvalue(p1 + 'score.scaled', data.score.scaled);}
			if(!isBadValue(data.score.raw)) {result = scorm.setvalue(p1 + 'score.raw', data.score.raw);}
			if(!isBadValue(data.score.min)) {result = scorm.setvalue(p1 + 'score.min', data.score.min);}
			if(!isBadValue(data.score.max)) {result = scorm.setvalue(p1 + 'score.max', data.score.max);}
			if(!isBadValue(data.success_status)) {result = scorm.setvalue(p1 + 'score.success_status', data.success_status);}
			if(!isBadValue(data.completion_status)) {result = scorm.setvalue(p1 + 'score.completion_status', data.completion_status);}
			if(!isBadValue(data.progress_measure)) {result = scorm.setvalue(p1 + 'score.progress_measure', data.progress_measure);}
			if(!isBadValue(data.description)) {result = scorm.setvalue(p1 + 'score.description', data.description);}
		}	
		return result;
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
	this.getObjective = function(id) {
		if(isStarted) {
			// TODO
		} else {
			notStartedYet();
			return 'false';
		}
	};
	/**
	 * Suspend
	 * This will suspend the SCO and ends with terminating.  No data can be saved after this.
	 */
	this.suspend = function() {
		if(isStarted) {
			scorm.debug(settings.prefix + ": I am suspending...", 3);
			if(!isPerforming()) {
				scorm.setvalue('cmi.success_status', 'unknown');
			}
			verifyScoreScaled();
			scorm.setvalue('cmi.exit', 'suspend');
			if(status !== "completed") {
				scorm.setvalue('cmi.completion_status', 'incomplete'); //? May not want to do this
			}
			isStarted = false;
			return scorm.terminate();
		} else {
			notStartedYet();
			return 'false';
		}
	};
	/**
	 * Finish
	 * This will set success status, exit and completion
	 */
	this.finish = function() {
		if(isStarted) {
			scorm.debug(settings.prefix + ": I am finishing...", 3);
			if(!isPerforming()) {
				scorm.setvalue('cmi.success_status', settings.success_status);
			}
			verifyScoreScaled();
			scorm.setvalue('cmi.exit', 'normal');
			if(status !== "completed") {
				scorm.setvalue('cmi.completion_status', 'incomplete'); //? May not want to do this
			}
			// This is completed per this call.
			isStarted = false;
			return scorm.terminate();
		} else {
			notStartedYet();
			return 'false';
		}
	};
	
	/**
	 * Timeout
	 * This will set success status, exit and completion
	 */
	this.timeout = function() {
		if(isStarted) {
			scorm.debug(settings.prefix + ": I am timing out...", 3);
			if(!isPerforming()) {
				scorm.setvalue('cmi.success_status', settings.success_status);
			}
			verifyScoreScaled();
			scorm.setvalue('cmi.exit', 'timeout');
			scorm.setvalue('cmi.completion_status', 'completed'); //? May not want to do this
			// This is completed per this call.
			isStarted = false;
			return scorm.terminate();
		} else {
			notStartedYet();
			return 'false';
		}
	};
	
	/**
	 * Is ISO 8601 UTC
	 * @returns {Boolean} true/false
	 */
	this.isISO8601UTC = isISO8601UTC; // Public to Private hook
	
	/**
	 * Set
	 * This locally sets values local to this API
	 * @param n {String} name
	 * @param v (String,Number,Object,Array,Boolean} value
	 */
	this.set = function(n, v) {
		// May need to maintain read-only perms here, case them out as needed.
		switch(n) {
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
		return (isError !== 0) ? false : true;
	};
	/**
	 * Get 
	 * This locally gets values local to this API
	 * @param n {String} name
	 * @returns value
	 */
	this.get = function(n) {
		if(settings[n] === undefined) {
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
	$(window).bind('unload', exitSCO);
}

/*
 * Mark: I'm leaving this bit of functionality here in case we need it.  See: https://github.com/csnover/js-iso8601
 * Jury is out right now whether we'll need to convert times back into to date times yet but there are a number of 
 * sources for this. 
 * Possibilities to save space (need testing)
 *  1. new Date(s.replace(/-/g,”/”).replace(/T/g,” “).replace(/Z/, ‘ UTC’));
 *  2.
 */

/**
 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
 * © 2011 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 */
/*
(function (Date, undefined) {
    var origParse = Date.parse, numericKeys = [ 1, 4, 5, 6, 7, 10, 11 ];
    Date.parse = function (date) {
        var timestamp, struct, minutesOffset = 0;

        // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
        if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by “undefined” values being passed to Date.UTC
            for (var i = 0, k; (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undefined days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undefined) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        }
        else {
            timestamp = origParse ? origParse(date) : NaN;
        }

        return timestamp;
    };
}(Date));*/