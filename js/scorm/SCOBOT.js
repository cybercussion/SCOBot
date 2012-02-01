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
	var defaults = {
		version: "1.0",
		createDate: "04/07/2011 09:33AM",
		modifiedDate: "02/01/2012 13:08AM",
		prefix: "SCOBOT",
		// SCORM buffers
		success_status: "passed",
		bookmark: "",
		performance: "",
		status: "",
		suspend_data: "",
		mode: ""
	},
	// Settings merged with defaults and extended options
	settings     = $.extend(defaults, options),
	isError      = false,
	isStarted    = false,
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
		if(settings.performance !== "passed" && settings.performance !== "failed") {
			return false;
		}
		return true;
	}

	/**
	 * Not Started Yet
	 * You should never see this message
	 */
	function notStartedYet() {
		scorm.debug(settings.prefix + ": You didn't call 'Start()' yet, or you already terminated, ignoring.", 2);
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
		scorm.debug(settings.prefix + ": I am starting...", 3);
		if(!isStarted) {
			isStarted = true;
			// Retrieve normal settings/parameters from the LMS
			settings.mode         = scorm.getvalue('cmi.mode');
			settings.bookmark     = scorm.getvalue('cmi.location');
			settings.suspend_data = unescape(scorm.getvalue('cmi.suspend_data'));
			/** Suspend Data technically should be a JSON String.  Structured data would be best suited to
			 * be recorded this way.  If you don't want to do this, you'll need to back out this portion.
			 * Also, in order to eliminate foreign keys and other special characters from messing up some
			 * LMS's we commonly escape going out, and unescape coming in.  We may even need to base64.
			 * !IMPORTANT- once you do this, your kinda stuck with it.  SCO's will begin to save suspend data
			 * and if you change mid-stream your going to have to handle the fact you need to reverse support
			 * old saved data.
			 * GOAL: Deal with this in a managed way
			 */
			if(settings.suspend_data.length > 0) {
				// Assuming a JSON String
				settings.suspend_data = JSON.parse(settings.suspend_data); // Turn this back into a object.
			}
			settings.status       = scorm.getvalue('cmi.completion_status');
			settings.performance  = scorm.getvalue('cmi.success_status');
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
			settings.bookmark = v;
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
			return settings.bookmark;
			// return local snapshot
		} else {
			notStartedYet();
			return false;
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
	 * Set Suspend Data
	 * This will set the suspend data by id (could be a page ID as long as its unique)
	 * Suspend data is a 64,000 character string.  In this case it will be a JSON Object that
	 * freely converts to a JSON String or Object.
	 * @param id {Integer}
	 * @param data {Object}
	 * @returns {Boolean}
	 */
	this.setSuspendData = function(id, data) {
		// Suspend data is a array of pages by ID
		var i;
		for(i=0; i<settings.suspend_data.length; i++) {
			if(settings.suspend_data[i].id == id ) {
				settings.suspend_data[i].data = data; // overwrite existing
				return true;
			}
		}
		settings.suspend_data.push({'id': id, 'data': data});
		return true;
	};
	
	/**
	 * Get Suspend Data
	 * This will get the suspend data by id 
	 * @param id {Integer}
	 * @returns {Object} but false if empty.
	 */
	this.getSuspendData = function(id) {
		// Suspend data is a array of pages by ID
		var i;
		for(i=0; i<settings.suspend_data.length; i++) {
			if(settings.suspend_data[i].id == id) {
				return settings.suspend_data.data;
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
	 * data = {
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
	 *			pattern: ''
	 *		}
	 *	],
	 *	weighting: '1',
	 *	learner_response: 'true',
	 *	result: 'correct',                   // (correct, incorrect, unanticipated, neutral, real (10,7) )
	 *	latency: '12.2',                     // second(10,2)
	 *	description: "The question commonly" // 250 chars
	 * }
	 * @param data {Object}
	 */
	this.setInteraction = function(data) {
		var count;
		
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