/*global $, JQuery, scorm, DEFAULT_SUCCESS_STATUS */

/**
 * This is a sample SCORM Startup sequence and handicap API's for ease of use.
 * General Concept: When the LMS connects, call var SB = new SCOBOT();
 * SCOBOT
 * This only works with the SCORM_API, but has the basis to work with other API's.
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
		version : "1.0",
		createDate : "04/07/2011 09:33AM",
		modifiedDate : "04/29/2011 09:21AM",
		prefix : "SCOBOT"
	},
	// Settings merged with defaults and extended options
	settings     = $.extend(defaults, options), isError = false, isStarted = false, error = scorm.get('error'), // no sense retyping this
	that         = this, // Public to Public Hook
	//SCORM based holders/buffers for data (translations for cryptic stuff)
	mode         = '', 
	bookmark     = '', 
	suspend_data = '', 
	status       = '', 
	performance  = '';

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
		if(performance !== "passed" && performance !== "failed") {
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
	 * @returns {Boolean}
	 */
	this.Start = function() {
		scorm.debug(settings.prefix + ": I am starting...", 3);
		if(!isStarted) {
			isStarted = true;
			mode = scorm.getvalue('cmi.mode');
			bookmark = scorm.getvalue('cmi.location');
			suspend_data = scorm.getvalue('cmi.suspend_data');
			status = scorm.getvalue('cmi.completion_status');
			performance = scorm.getvalue('cmi.success_status');
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
	this.SetBookmark = function(v) {
		if(isStarted) {
			bookmark = v;
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
	this.GetBookmark = function() {
		if(isStarted) {
			return bookmark;
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
	this.Suspend = function() {
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
	this.Finish = function() {
		if(isStarted) {
			scorm.debug(settings.prefix + ": I am finishing...", 3);
			if(!isPerforming()) {
				scorm.setvalue('cmi.success_status', DEFAULT_SUCCESS_STATUS);
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
	this.Timeout = function() {
		if(isStarted) {
			scorm.debug(settings.prefix + ": I am timing out...", 3);
			if(!isPerforming()) {
				scorm.setvalue('cmi.success_status', DEFAULT_SUCCESS_STATUS);
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
	 * Set (Internal API)
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
	 * Get (Internal API)
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