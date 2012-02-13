/*global $, JQuery, debug, scorm */
/**
 * Local API_1484_11
 * Mimic's LMS Connectivity in Local Mode i.e. standalone functionality
 *
 * @author Mark Statkus <mark@cybercussion.com>
 * @requires JQuery
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
function Local_API_1484_11(options) {
	/*jslint nomen: false */ // All these '_' trip up JSLint, and are associated with the SCORM Spec.
	var defaults = {
		version : "1.0",
		moddate : "2010-7-17 08:15",
		createdate : "2010-7-17 08:15",
		prefix: "Local_API_1484_11",
		errorCode : 0,
		diagnostic : '',
		initialized : 0,
		terminated : 0
	},
	// Settings merged with defaults and extended options */
	settings = $.extend(defaults, options), CMI = {
		_version : "1.0",
		comments_from_learner : {
			_children : "comment,location,timestamp",
			_count : "0"
		},
		comments_from_lms : {
			_children : "comment,location,timestamp",
			_count : "0"
		},
		completion_status : "unknown",
		completion_threshold : "",
		credit : "no_credit",
		entry : "ab-initio",
		exit : "",
		interactions : {
			_children : "id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description",
			_count : "0"
		},
		launch_data : "",
		learner_id : "100",
		learner_name : "Simulated User",
		learner_preference : {
			_children : "audio_level,language,delivery_speed,audio_captioning",
			audio_level : "",
			language : "",
			delivery_speed : "",
			audio_captioning : ""
		},
		location : "",
		max_time_allowed : "",
		mode : "normal",
		objectives : {
			_children : "id,score,success_status,completion_status,description",
			_count : "0"
		},
		progress_measure : "",
		scaled_passing_score : "",
		score : {
			_children : "scaled,raw,min,max",
			scaled : "",
			raw : "",
			min : "",
			max : ""
		},
		session_time : "PT0H0M0S",
		success_status : "unknown",
		suspend_data : "",
		time_limit_action : "",
		total_time : "PT0H0M0S"
	}, 
	cmi = {},
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
	 */
	read_only = "|_version|completion_threshold|credit|entry|launch_data|learner_id|learner_name|_children|_count|mode|maximum_time_allowed|scaled_passing_score|time_limit_action|total_time|comment|", //timestamp RO in comments
	/**
	 * Write Only values
	 */
	write_only = "|exit|session_time|", exit = "|time-out|suspend|logout|normal||", self = this;
	// For the above please see: http://scorm.com/wp-content/assets/scorm_ref_poster/RusticiSCORMPoster.pdf
	
	// Private

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
		if(ka.length < 2) {
			obj[ka[0]] = val;
			//only one part (no dots) in key, just set value
		} else {
			if(!obj[ka[0]]) {
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
		scorm.debug(settings.prefix + ": GetData Checking " + key, 4);
		var ka = key.split(/\./), v;
		//split the key by the dots
		if(ka.length < 2) {
			try {
				scorm.debug(settings.prefix + ":  getData returning -   key:" + ka[0] + " value:" + obj[ka[0]], 4);
				return obj[ka[0]];
			} catch (e) {
				settings.errorCode = 402;
				return null; // DEVELOPER: Need to throw "Object Not Defined" error	
			}
			//only one part (no dots) in key, just set value
		} else {
			v = ka.shift();
			if(obj[v]) {
				return getData(ka.join("."), obj[v]);
			} else {
				settings.errorCode = 402;
				return 'false';
			}
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
		switch(key) {
			//Write Only
			case "cmi.exit":
			case "cmi.session_time":
				settings.errorCode = 405;
				break;

			default:
				r = getData(key.substr(4, key.length), cmi);
				//eval(data);
				scorm.debug(settings.prefix + ": cmiGetValue got " + r, 4);
				// Filter
				if(r === undefined || r === null) {
					settings.errorCode = 401;
					r = "false";
				}
				scorm.debug(settings.prefix + ":  Running: " + self.isRunning() + " GetValue Returning: " + r, 4);
				break;
		}
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
		var tiers = key.split("."),
			v = tiers[tiers.length - 1]; // last value
		if(tiers[0] === "adl" && tiers[4] === "id") {
			return true;
		} else if(tiers[1] === "comments_from_lms") {// entirely read only
			return true;
		} else {
			if(read_only.indexOf('|' + v + '|') >= 0) {
				return true;
			}
		}
		return false;
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
		if(write_only.indexOf('|' + v + '|') >= 0) {
			return true;
		}
		return false;
	}
	/** 
	 * Get Object Length
	 * @param {Object}
	 * returns {Number}
	 */
	function getObjLength(obj) {
		var i, length=0;
		for(i in obj) {
			if(obj[i]) {
				length++;
			}
		}
		return length;
	}
	/** 
	 * Throw Vocabulary Error
	 * This sets the errorCode and Diagnostic for the key and value attempted.  
	 * @param k {String} key
	 * @param v {String} value
	 * @returns {String} 'false' as dictated by SCORM
	 */
	function throwVocabError(k, v) {
		settings.diganostic = "The " + k + " of " + v + " must be a proper vocabulary element.";
		settings.errorCode = "406";
		return 'false';
	}
	
	/**
	 * isRunning, Returns true if initialized is 1 and terminated is 0
	 * @returns true or false
	 */
	this.isRunning = function() {
		if(settings.initialized === 1 && settings.terminated === 0) {
			return true;
		} else {
			return false;
		}
	};
	/*jslint nomen: true */
	this.Initialize = function() {
		scorm.debug(settings.prefix + ":  Initializing...", 3);
		cmi = CMI;
		// Clean CMI Object
		settings.initialized = 1;
		settings.terminated = 0;
		return 'true';
	};
	/**
	 * GetValue (SCORM)
	 * @param key {String}
	 * @returns "true" or "false" depending on if its been initialized prior
	 */
	this.GetValue = function(key) {
		scorm.debug(settings.prefix + ":  Running: " + this.isRunning() + " GetValue: " + key + "...", 4);
		settings.errorCode = 0;
		var r = "false",
			k = key + '', // ensure string
			tiers = [];
		if ( this.isRunning() ) {
			if ( isWriteOnly(k) ) {
				scorm.debug(settings.prefix + ": This " + k + " is write only", 4);
				settings.errorCode = 405;
				return "false";
			} else {
				tiers = k.toLowerCase().split(".");
				switch(tiers[0]) {
					case "cmi":
						scorm.debug(settings.prefix + ": CMI Getting " + k, 4);
						r = cmiGetValue(k);
						break;
					case "ssp":
	
						break;
					case "adl":
	
						break;
				}
				return r;
			}
		} else {
			settings.errorCode = 123;
			return r;
		}
	};
	/**
	 * SetValue (SCORM)
	 * @param key {String}
	 * @param value {String]
	 * @returns "true" or "" depending on if its been initialized prior
	 */
	this.SetValue = function(key, value) {
		scorm.debug(settings.prefix + ":  Running: " + this.isRunning() + " SetValue: " + key + " :: " + value, 4);
		settings.errorCode = 0;
		var s,
			tiers = [],
			k = key + '',   // ensure string
			v = value + '', // ensure string
			obj,
			ka,
			i;
		if(this.isRunning()) {
			//eval(param + "=" + value +";");
			//s = data;
			if(isReadOnly(k)) {
				scorm.debug(settings.prefix + ": This " + k + " is read only", 4);
				settings.errorCode = 404;
				return "false";
			} else {
				tiers = k.split(".");
				scorm.debug(settings.prefix + ": Tiers " + tiers[1], 4);
				switch(tiers[0]) {
					case "cmi":
						switch(key) {
							case "cmi.location":
								if(v.length > 1000) {
									scorm.debug(settings.prefix + ": Some LMS's might truncate your bookmark as you've passed " + v.length + " characters of bookmarking data", 2);
								}
							break;
							case "cmi.completion_status":
								if(completion_status.indexOf('|' + v + '|') === -1) {
									// Invalid value
									return throwVocabError(key, v);
								}
								break;
							case "cmi.exit":
								if(exit.indexOf('|' + v + '|') === -1) {
									// Invalid value
									return throwVocabError(key, v);
								}
								break;
							default:
								// Need to dig in to some of these lower level values
								switch(tiers[1]) {
									/*jslint nomen: false */ // _ built in to SCORM 2004
									case "interactions":
										//scorm.debug(settings.prefix + ": Checking Interactions .... " + getObjLength(cmi.interactions), 4);
										cmi.interactions._count = (getObjLength(cmi.interactions) - 2) + ""; // Why -2?  _count and _children
										
										// Check interactions.n.objectives._count
										// This one is tricky because if a id is added at tier[3] this means the objective count needs to increase for this interaction.
										// This is alpha or numeric
										if(tiers[3] === 'objectives') {
											// Wait, before you go trying set a count on a undefined object, lets make sure it exists...
											if(!cmi.interactions[tiers[2]].objectives) {
												// Setup Objectives for the first time
												scorm.debug(settings.prefix + ": Constructing objectives object for new interaction", 4);
												cmi.interactions[tiers[2]].objectives = {};
												cmi.interactions[tiers[2]].objectives._count = "0";
												cmi.interactions[tiers[2]].objectives._children = "id,score,success_status,completion_status,description";
											}
											cmi.interactions[tiers[2]].objectives._count = (getObjLength(cmi.interactions[tiers[2]].objectives) - 1) + ""; // Why -1?  _count
										}
										// this should work (Subtract _count, and _children)
										if(parseInt(tiers[2], 10) === "NaN") {
											return 'false';
										}
										break;
									case "objectives":
										// Objectives require a unique ID, which to me contradicts journaling
										if(tiers[3] === "id") {
											var count = parseInt(cmi.objectives._count, 10);
											for(var z=0; z<count; z++) {
												if(cmi.objectives[z].id === v) {
													settings.errorCode = "351";
													settings.diagnostic = "The objectives.id elmeent must be unique.  The value '" + v + "' has already been set in objective #"+z;
													return 'false';
												}	
											}
										}
										// End Unique ID Check
										// Now Verify the objective in question even has a ID yet, if not throw error.
										if(tiers[3] !== "id") {
											var arr = parseInt(tiers[2], 10);
											if(cmi.objectives[arr] === undefined) {
												settings.errorCode = "408";
												settings.diagnostic = "The objectives.id element must be setbefore other elements can be set";
												return 'false';
											}
										}
										// END ID CHeck
										cmi.objectives._count = (getObjLength(cmi.objectives) - 2) + ""; // Why -2?  _count and _children
										// ditto
										if(parseInt(tiers[2], 10) === "NaN") {
											return 'false';
										}
										break;
								}
								break;
							// More reenforcement to come ...
						}
						// Rip off 'cmi.' before we add this to the model
						setData(k.substr(4, k.length), v, cmi);
						break;
					case "ssp":
						// Still to do (build off cmi work)
						break;
					case "adl":
						// Still to do (build off cmi work)
						break;
				}

				return "true";
			}

		} else {
			// Determine Error Code
			if(settings.terminated) {
				settings.errorCode = 133;
			} else {
				settings.errorCode = 132;
			}
			return "false";
		}
	};

	this.Commit = function(v) {
		scorm.debug(cmi);
		// trace object as its committed
		return 'true';
	};

	this.Terminate = function() {
		// Could do things here like a LMS
		settings.terminated = 1;
		settings.initialized = 0;
		return 'true';
	};
	/**
	 * GetErrorString (SCORM) - Returns the error string from the associated Number
	 * @param param number
	 * @returns string
	 */
	this.GetErrorString = function(param) {
		if(param !== "") {
			var errorString = "", nparam = parseInt(param, 10);
			switch(nparam) {
				case 0:
					errorString = "No error";
					break;
				case 101:
					errorString = "General exception";
					break;
				case 102:
					errorString = "General Initialization Failure";
					break;
				case 103:
					errorString = "Already Initialized";
					break;
				case 104:
					errorString = "Content Instance Terminated";
					break;
				case 111:
					errorString = "General Termination Failure";
					break;
				case 112:
					errorString = "Termination Before Initialization";
					break;
				case 113:
					errorString = "Termination After Termination";
					break;
				case 122:
					errorString = "Retrieve Data Before Initialization";
					break;
				case 123:
					errorString = "Retrieve Data After Termination";
					break;
				case 132:
					errorString = "Store Data Before Initialization";
					break;
				case 133:
					errorString = "Store Data After Termination";
					break;
				case 142:
					errorString = "Commit Before Initialization";
					break;
				case 143:
					errorString = "Commit After Termination";
					break;
				case 201:
					errorString = "General Argument Error";
					break;
				case 301:
					errorString = "General Get Failure";
					break;
				case 351:
					errorString = "General Set Failure";
					break;
				case 391:
					errorString = "General Commit Failure";
					break;
				case 401:
					errorString = "Undefined Data Model";
					break;
				case 402:
					errorString = "Unimplemented Data Model Element";
					break;
				case 403:
					errorString = "Data Model Element Value Not Initialized";
					break;
				case 404:
					errorString = "Data Model Element Is Read Only";
					break;
				case 405:
					errorString = "Data Model Element Is Write Only";
					break;
				case 406:
					errorString = "Data Model Element Type Mismatch";
					break;
				case 407:
					errorString = "Data Model Element Value Out Of Range";
					break;
				case 408:
					errorString = "Data Model Dependency Not Established";
					break;
				default:
					errorString = "Unknown error ID passed " + param;
					break;
			}
			return errorString;
		} else {
			return "";
		}
	};
	/**
	 * GetLastError (SCORM) - Returns the error number from the last error
	 * @param param number
	 * @returns number
	 */
	this.GetLastError = function() {
		return settings.errorCode;
	};
	this.GetDiagnostic = function() {
		return settings.diagnostic;
	};
}