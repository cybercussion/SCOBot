/*global $, JQuery, scorm, unescape */
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
function SCOBOT(options) {
	// Constructor ////////////
	/** @default version, createDate, modifiedDate, prefix, interaction_mode, success_status, bookmark, performance, status, suspend_data, mode */
	var defaults = {
		version: "1.0",
		createDate: "04/07/2011 09:33AM",
		modifiedDate: "02/01/2012 13:08AM",
		prefix: "SCOBOT",
		// SCORM buffers and settings
		interaction_mode: "state", // or journaled
		success_status: "passed",
		location: "",
		completion_status: "",
		suspend_data: {},
		mode: "",
		scaled_passing_score: 0.7,
		totalInteractions: 0,
		totalObjectives: 0
	},
	// Settings merged with defaults and extended options
	settings     = $.extend(defaults, options),
	isError      = false,
	isStarted    = false,
	badValues    = '|null|undefined|false|| |',
	error        = scorm.get('error'), // no sense retyping this
	self         = this; // Public to Public Hook


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
	
	/**
	 * Not Started Yet
	 * You should never see this message
	 */
	function notStartedYet() {
		scorm.debug(settings.prefix + ": You didn't call 'Start()' yet, or you already terminated, ignoring.", 2);
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
	 *	successStatus    = '0',
	 *	completionStatus = 'incomplete',
	 *	progressMeasure  = '0'
	 * }
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
			progressMeasure = settings.totalObjectives / settings.totalObjectivesCompleted + "";
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
	 * and will begin to store some common used parameters for use later.
	 * @returns {Boolean}
	 */
	this.start = function() {
		var tmpScaledPassingScore = '';
		scorm.debug(settings.prefix + ": I am starting...", 3);
		if(!isStarted) {
			isStarted = true;
			// Retrieve normal settings/parameters from the LMS
			// Get SCO Mode (normal, browse, review)
			settings.mode                 = scorm.getvalue('cmi.mode');
			// Get Bookmark
			settings.location             = scorm.getvalue('cmi.location');
			// Scaled Passing Score
			tmpScaledPassingScore         = scorm.getvalue('cmi.scaled_passing_score'); // This may be empty, default otherwise
			if(!isBadValue(tmpScaledPassingScore) && tmpScaledPassingScore !== "-1") {
				settings.scaled_passing_score = tmpScaledPassingScore;
				// else it defaults to what its set to prior.  i.e. no change.
			}
			/** Suspend Data technically should be a JSON String.  Structured data would be best suited to
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
				settings.suspend_data = {};
			}
			settings.completion_status = scorm.getvalue('cmi.completion_status');
			settings.success_status    = scorm.getvalue('cmi.success_status');
		} else {
			notStartedYet();
			return false;
		}
		return true;
	};
	
	/**
	 * Set Bookmark
	 * @param v {String} value
	 * returns {String} 'true' or 'false'.
	 */
	this.setBookmark = function(v) {
		if(isStarted) {
			settings.location = v;
			// update local snapshot
			return scorm.setvalue('cmi.location', v);
		} else {
			notStartedYet();
			return false;
		}
	};
	
	/**
	 * Get Bookmark
	 * @returns {String} bookmark
	 */
	this.getBookmark = function() {
		if(isStarted) {
			return settings.location;
			// return local snapshot
		} else {
			notStartedYet();
			return false;
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
	 * Suspend
	 * This will suspend the SCO and ends with terminating.  No data can be saved after this.
	 */
	this.suspend = function() {
		if(isStarted) {
			scorm.debug(settings.prefix + ": I am suspending...", 3);
			if(!isPerforming()) {
				scorm.setvalue('cmi.success_status', 'unknown');
			}
			scorm.setvalue('cmi.exit', 'suspend');
			if(status !== "completed") {
				scorm.setvalue('cmi.completion_status', 'incomplete');
			}
			scorm.terminate();
			isStarted = false;
		} else {
			notStartedYet();
			return false;
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
			scorm.setvalue('cmi.exit', 'normal');
			scorm.setvalue('cmi.completion_status', 'completed');
			// This is completed per this call.
			scorm.terminate();
			isStarted = false;
			return true;
		} else {
			notStartedYet();
			return false;
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
			scorm.setvalue('cmi.exit', 'timeout');
			scorm.setvalue('cmi.completion_status', 'completed');
			// This is completed per this call.
			scorm.terminate();
			isStarted = false;
			return true;
		} else {
			notStartedYet();
			return false;
		}
	};
	
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
	 * 
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
				return true;
			}
		}
		// new page push
		settings.suspend_data.pages.push({'id': id, 'title': title, 'data': data});
		return true;
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
		return false;
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
	 *	timestamp: '22',                     // second(10,0)
	 *	correct_responses: [
	 *		{
	 *			pattern: ''                  // depends on interaction type
	 *		}
	 *	],
	 *	weighting: '1',
	 *	learner_response: 'true',
	 *	result: 'correct',                   // (correct, incorrect, unanticipated, neutral, real (10,7) )
	 *	latency: '12.20',                     // second(10,2)
	 *	description: "The question commonly" // 250 chars
	 * };
	 * @param data {Object}
	 * TODO
	 */
	this.setInteraction = function(data) {
		var n;
		// Check for Interaction Mode
		if(settings.interaction_mode === "journaled") {
			// Explicitly stating they want a history of interactions
			n = ''; // we want to use cmi.interactions._count
		} else { 
			// Default to state, which will update by id
			n = ''; // we want to update by interaction id
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
	 * 
	 * TODO
	 */
	this.setObjective = function(data) {
		
	};
	
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
}