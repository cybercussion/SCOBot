/*global $, JQuery, ok, module, test, strictEqual, equal, SCORM_API, SCOBot, debug, enableDebug, learner_name, learner_id, mode, local */
var scorm  = new SCORM_API({
		debug: true,
		exit_type: 'suspend',
		success_status: 'passed'
	}),
	SB     = new SCOBot({
		interaction_mode: 'state'
	}),
	setvalue_calls = 0,
	getvalue_calls = 0,
	// These things tend to happen during authoring/creation. We'll use this later to put into suspend data
	character_str = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ˜‌‍‎‏–—―‗‘’‚‛“”„†‡•…‰′″‹›‼‾⁄₣₤₧₪₫€℅ℓ№™Ω℮⅓⅔⅛⅜⅝⅞←↑→↓∂√∞∩∫≠≡■□▲△▼○●♀♂♪";
$(scorm).on("setvalue", function(e) {
	setvalue_calls++;
	return false;
});
$(scorm).on("getvalue", function(e) {
	getvalue_calls++;
	return false;
});

// Much of SCOBOT is a bit auto-pilot so several SCORM calls may be made on one API reference.
module("SCOBOT");
// Debug
test("scorm.debug", function() {
	var sub_method = scorm.debug;
	ok(sub_method("Error Message", 1), "Valid error message");
	ok(sub_method("Warning Message", 2), "Valid warning message");
	ok(sub_method("General Message", 3), "Valid general message");
	ok(sub_method("Log Message", 4), "Valid log message");
	ok(!sub_method("Bogus Message", 5), "Invalid log message");
});

test("SCORM ISO 8601 Time", function() {
	strictEqual(SB.isISO8601UTC('2012-02-12T00:37:29Z'), true, 'Checking a UTC example 2012-02-12T00:37:29Z');
	strictEqual(SB.isISO8601UTC('2012-02-12T00:37:29'), false, 'Checking a non-UTC example 2012-02-12T00:37:29');
	strictEqual(SB.isISO8601UTC('2012-02-1200:37:29'), false, 'Checking a non-UTC example 2012-02-1200:37:29Z');
});

// SB.start is fired onload, nothing to really test here.  We could verify settings however.

test("SCORM Bookmarking", function() {
	strictEqual(SB.setBookmark(2), 'true', 'Setting Bookmark to 2');
	strictEqual(SB.getBookmark(), '2', 'Getting Bookmark, should be 2');
});

test("SCORM Objectives", function() {
	// For True False
	strictEqual(SB.setObjective({
		id: '1_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a true false interaction'
	}), 'true', "Setting Objective True False 1_1 unscored");
	// For Multiple Choice
	strictEqual(SB.setObjective({
		id: '2_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a multiple choice interaction'
	}), 'true', "Setting Objective Multiple Choice 2_1 unscored");
	// For Fill In
	strictEqual(SB.setObjective({
		id: '3_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a fill in interaction'
	}), 'true', "Setting Objective Fill In 3_1 unscored");
	// For Sequencing
	strictEqual(SB.setObjective({
		id: '4_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a sequencing interaction'
	}), 'true', "Setting Objective Sequencing 4_1 unscored");
	// For Long Fill In
	strictEqual(SB.setObjective({
		id: '5_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a long fill in interaction'
	}), 'true', "Setting Objective Long Fill In 5_1 unscored");
	// For Matching
	strictEqual(SB.setObjective({
		id: '6_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a matching interaction'
	}), 'true', "Setting Objective Matching 6_1 unscored");
	// For LikeRT
	strictEqual(SB.setObjective({
		id: '7_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a likert interaction'
	}), 'true', "Setting Objective LikeRT 7_1 unscored");
	// For Other
	strictEqual(SB.setObjective({
		id: '8_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a other interaction'
	}), 'true', "Setting Objective Other 8_1 unscored");
	// For Performance
	strictEqual(SB.setObjective({
		id: '9_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a performance interaction'
	}), 'true', "Setting Objective Performance 8_1 unscored");
	// For Numeric
	strictEqual(SB.setObjective({
		id: '10_1',
		score: {
			scaled: '0',
			raw: '0',
			min: '0',
			max: '1'
		},
		success_status: 'unknkown',
		completion_status: 'not attempted',
		progress_measure: '0',
		description: 'They will answer a numeric interaction'
	}), 'true', "Setting Objective Numeric 8_1 unscored");
});

test("SCORM Interactions", function() {
	var startTime = new Date(),
		endTime   = new Date(startTime),
		intID     = '1',
		objID     = '1_1',
		n         = '', // for interaction.n Array value (locator)
		m         = ''; // for Interaction.n.objective.m array value (locator)
	endTime.setMinutes(startTime.getMinutes() + 5); // Add 5 minutes for latency, result would be PT5M
	
	// True False Interaction
	strictEqual(SB.setInteraction({
		id: intID,                 // {String}
		type: 'true_false',        // {String}
		objectives: [              // {Array}
			{                      // {Object}
				id: objID          // {String}
			}
		],
		timestamp: startTime,      // {Object} date start
		correct_responses: [       // {Array}
			{                      // {Object}
				pattern: 'true'    // {String} true or false
			}
		],
		weighting: '1',            // {String}
		learner_response: 'true',  // {String} true or false
		result: 'correct',         // {String} correct, incorrect, neutral 
		latency: endTime,          // {Object} date end
		description: 'This is the question?' // {String} question commonly
	}), 'true', "Setting true/false Interaction 1");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'true_false', 'Verifying cmi.interactions.'+n+'.type is true_false');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '1_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 1_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'true', 'Verifying cmi.interactions.'+n+'.learner_response is true');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End True False Interaction
	
	// Multiple Choice Interaction
	intID = '2';
	objID = '2_1';
	//endTime.setMinutes(startTime.getMinutes() + 10); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,                // {String}
		type: 'multiple_choice',  // {String}
		objectives: [             // {Array}
			{                     // {Object}
				id: objID         // {String}
			}
		],
		timestamp: startTime,     // {Object} date start
		correct_responses: [      // {Array}
			{                     // {Object}
				pattern: ["a","b"] // {Array}
			}
		],
		weighting: '1',           // {String}
		learner_response: ["a","c"],  // {Array}
		result: 'incorrect',     // {String} correct, incorrect, neutral
		latency: endTime,         // {Object} date end
		description: 'Which choices would <b>you</b> pick?' // {String} question commonly
	}), 'true', "Setting multiple choice Interaction 2");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'multiple_choice', 'Verifying cmi.interactions.'+n+'.type is multiple_choice');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '2_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 2_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'a[,]c', 'Verifying cmi.interactions.'+n+'.learner_response is a[,]c');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'incorrect', 'Verifying cmi.interactions.'+n+'.result is incorrect');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Multiple Choice Interaction
	
	// Fill In Interaction
	intID = '3';
	objID = '3_1';
	//endTime.setMinutes(startTime.getMinutes() + 11); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,             // {String}
		type: 'fill_in',       // {String}
		objectives: [          // {Array}
			{                  // {Object}
				id: objID      // {String}
			}
		],
		timestamp: startTime,  // {Object} date start
		correct_responses: [   // {Array}
			{                  // {Object}
				pattern: {     // {Object}
					case_matters: true,         // {Boolean}
					order_matters: true,        // {Boolean}
					lang: 'en',                 // {String} 2 or 3 letter lang code
					words: ["car","automobile"] // {Array} of {String}s
				}
			}
		],
		weighting: '1',        // {String}
		learner_response: {    // {Object}
			lang: 'en',        // {String} 2 or 3 letter lang code
			words:["car","automobile"] // {Array} of {String}s
		},
		result: 'correct',     // {String} correct, incorrect, neutral
		latency: endTime,      // {Object} date end
		description: 'Which choices would <b>you</b> pick?' // {String} question commonly
	}), 'true', "Setting Fill In Interaction 3");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'fill_in', 'Verifying cmi.interactions.'+n+'.type is fill_in');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '3_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 3_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), '{lang=en}car[,]automobile', 'Verifying cmi.interactions.'+n+'.learner_response is {lang=en}car[,]automobile');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Fill In Interaction
	
	// Sequencing Interaction
	intID = '4';
	objID = '4_1';
	//endTime.setMinutes(startTime.getMinutes() + 15); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,             // {String}
		type: 'sequencing',    // {String}
		objectives: [          // {Array}
			{                  // {Object}
				id: objID      // {String}
			}
		],
		timestamp: startTime,  // {Object} date start
		correct_responses: [   // {Array}
			{                  // {Object}
				pattern: ["c","b", "a"]  // {Array}
			}
		],
		weighting: '1',        // {String}
		learner_response: ["a","c","b"],  // {Array}
		result: 'incorrect',   // {String} correct, incorrect, neutral
		latency: endTime,      // {Object} date end (optional)
		description: 'Place these options in order' // {String}
	}), 'true', "Setting sequencing Interaction 4");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'sequencing', 'Verifying cmi.interactions.'+n+'.type is sequencing');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '4_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 4_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'a[,]c[,]b', 'Verifying cmi.interactions.'+n+'.learner_response is a[,]c[,]b');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'incorrect', 'Verifying cmi.interactions.'+n+'.result is incorrect');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Sequencing Interaction
	
	// Long Fill In Interaction
	intID = '5';
	objID = '5_1';
	//endTime.setMinutes(startTime.getMinutes() + 21); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,                               // {String}
		type: 'long_fill_in',                    // {String}
		objectives: [                            // {Array}
			{                                    // {Object}
				id: objID                        // {String}
			}
		],
		timestamp: startTime,                    // {Object} date start
		correct_responses: [                     // {Array}
			{                                    // {Object}
				pattern: {                       // {Object}
					lang: 'en',                  // {String} lang code (optional)
					case_matters: false,         // {Boolean} (optional)
					text: "it's been a long day" // {String}
				}
			}
		],
		weighting: '1',                          // {String}
		learner_response: {                      // {Object}
			lang: 'en',                          // {String} lang code (optional)
			text: "There was one once, but it's been a long day." // {String}
		},
		result: 'correct',                       // {String} correct, incorrect, neutral
		latency: endTime,                        // {Object} date end (optional)
		description: 'Which choices would <b>you</b> pick?' // {String}
	}), 'true', "Setting long fill in Interaction 5");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'long_fill_in', 'Verifying cmi.interactions.'+n+'.type is long_fill_in');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '5_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 5_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), "{lang=en}There was one once, but it's been a long day.", "Verifying cmi.interactions."+n+".learner_response is {lang=en}There was one once, but it's been a long day.");
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Long Fill In Choice Interaction
	
	// Matching Interaction
	intID = '6';
	objID = '6_1';
	//endTime.setMinutes(startTime.getMinutes() + 15); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,                             // {String}
		type: 'matching',                      // {String}
		objectives: [                          // {Array}
			{                                  // {Object}
				id: objID                      // {String}
			}
		],
		timestamp: startTime,                  // {Object} date start
		correct_responses: [                   // {Array}
			{                                  // {Object}
				pattern: [                     // {Array}
					["tile_1", "target_2"],    // {Array} of {String}s
					["tile_2", "target_1"], 
					["tile_3", "target_3"]
				]
			}
		],
		weighting: '1',                        // {String}
		learner_response: [                    // {Array} 
			["tile_1", "target_2"],            // {Array} of {String}s
			["tile_2", "target_1"],
			["tile_3", "target_3"]
		],
		result: 'correct',                     // {String} correct, incorrect, neutral
		latency: endTime,                      // {Object} date end (optional)
		description: "Place these steps over the matching order you'd do them." // {String} question commonly
	}), 'true', "Setting matching Interaction 6");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'matching', 'Verifying cmi.interactions.'+n+'.type is matching');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '6_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 6_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'tile_1[.]target_2[,]tile_2[.]target_1[,]tile_3[.]target_3', 'Verifying cmi.interactions.'+n+'.learner_response is tile_1[.]target_2[,]tile_2[.]target_1[,]tile_3[.]target_3');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Matching Interaction
	
	// LikeRT Interaction
	intID = '7';
	objID = '7_1';
	//endTime.setMinutes(startTime.getMinutes() + 15); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,                                       // {String}
		type: 'likert',                                  // {String}
		objectives: [                                    // {Array}
			{                                            // {Object}
				id: objID                                // {String}
			}
		],
		timestamp: startTime,                            // {Object} date start
		correct_responses: [
			{                                            // {Object}
				pattern: "strongly_agree"                // {String}
			},
			{                                            // {Object}
				pattern: "agree"                         // {String}
			},
			{                                            // {Object}
				pattern: "disagree"                      // {String}
			},
			{                                            // {Object}
				pattern: "strongly_disagree"             // {String}
			}
		],
		weighting: '1',                                  // {String}
		learner_response: "strongly_agree",              // {String} commonly a unique identifier for the group
		result: 'correct',                               // {String} correct, incorrect, neutral
		latency: endTime,                                // {Object} date end (optional)
		description: "Do you like filling in surveys?"   // {String} question commonly
	}), 'true', "Setting likert Interaction 7");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'likert', 'Verifying cmi.interactions.'+n+'.type is likert');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '7_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 7_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'strongly_agree', 'Verifying cmi.interactions.'+n+'.learner_response is strongly_agree');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End LikeRT Interaction
	
	// Other Interaction
	intID = '8';
	objID = '8_1';
	//endTime.setMinutes(startTime.getMinutes() + 15); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,                                                       // {String}
		type: 'other',                                                   // {String}
		objectives: [                                                    // {Array}
			{                                                            // {Object}
				id: objID                                                // {String}
			}
		],
		timestamp: startTime,                                            // {Object} date start
		correct_responses: [
			{                                                            // {Object}
				pattern: "Anything we want."                             // {String}
			},
			{
				pattern: "Almost anything."                              // {String}
			},
			{
				pattern: "Everything."                                   // {String}
			},
			{
				pattern: "A ton of stuff!"                               // {String}
			}
		],
		weighting: '1',                                                  // {String}
		learner_response: "Anything we want.",                           // {String} 
		result: 'correct',                                               // {String} correct, incorrect, neutral
		latency: endTime,                                                // {Object} date end (optional)
		description: "What can we put in the 'other' interaction type?"  // {String} question commonly
	}), 'true', "Setting other Interaction 8");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'other', 'Verifying cmi.interactions.'+n+'.type is other');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '8_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 8_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'Anything we want.', 'Verifying cmi.interactions.'+n+'.learner_response is Anything we want.');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Other Interaction
	
	// Performance Interaction
	intID = '9';
	objID = '9_1';
	//endTime.setMinutes(startTime.getMinutes() + 15); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,                                                    // {String}
		type: 'performance',                                          // {String}
		objectives: [                                                 // {Array}
			{                                                         // {Object}
				id: objID                                             // {String}
			}
		],
		timestamp: startTime,                                         // {Object} date start
		correct_responses:  [                                         // {Array}
			{                                                         // {Object}
				pattern: {                                            // {Object}
					order_matters: false,                             // {Boolean} (optional)
					answers: [                                        // {Array}
						["step_1", "answer_2"],                       // {Array} of {String}s step identifier (optional)
						["step_2", "answer_1"],
						["step_3", "answer_3"]
					]
				}		
			}
		],
		weighting: '1',                                               // {String}
		learner_response: [                                           // {Array} 
			["step_1", "answer_2"],                                   // {Array} of {String}s step identifier (optional)
			["step_2", "answer_1"],
			["step_3", "answer_3"]
		],
		result: 'correct',                                            // {String} correct, incorrect, neutral
		latency: endTime,                                             // {Object} date end (optional)
		description: "Arrange the pairs into an order of completion." // {String} question commonly
	}), 'true', "Setting matching Interaction 6");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'performance', 'Verifying cmi.interactions.'+n+'.type is performance');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '9_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 9_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'step_1[.]answer_2[,]step_2[.]answer_1[,]step_3[.]answer_3', 'Verifying cmi.interactions.'+n+'.learner_response is step_1[.]step_answer_2[,]step_2[.]answer_1[,]step_3[.]answer_3');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Performance Interaction
	
	// Numeric Interaction
	intID = '10';
	objID = '10_1';
	//endTime.setMinutes(startTime.getMinutes() + 15); // Add 5 minutes for latency, result would be PT10M
	strictEqual(SB.setInteraction({
		id: intID,                                                    // {String}
		type: 'numeric',                                              // {String}
		objectives: [                                                 // {Array}
			{                                                         // {Object}
				id: objID                                             // {String}
			}
		],
		timestamp: startTime,                                         // {Object} date start
		correct_responses:  [                                         // {Array}
			{                                                         // {Object}
				pattern: "10.5"                                       // {String}		
			}
		],
		weighting: '1',                                               // {String}
		learner_response: "10.5",                                     // {String}
		result: 'correct',                                            // {String} correct, incorrect, neutral
		latency: endTime,                                             // {Object} date end (optional)
		description: "Just fill in some random decimal that looks like 10.5." // {String} question commonly
	}), 'true', "Setting numeric Interaction 6");
	
	// Verify Data was set properly, I'm using long-hand scorm calls for this
	n = scorm.getInteractionByID(intID);
	m = scorm.getInteractionObjectiveByID(n, objID);
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'numeric', 'Verifying cmi.interactions.'+n+'.type is numeric');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives._count'), '1', 'Verifying cmi.interactions.'+n+'.objectives._count count is 1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.objectives.'+m+'.id'), '10_1', 'Verifying cmi.interactions.'+n+'.objectives.'+m+'.id id is 9_1');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), '10.5', 'Verifying cmi.interactions.'+n+'.learner_response is 10.5');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', 'Verifying cmi.interactions.'+n+'.result is correct');
	strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', 'Verifying cmi.interactions.'+n+'.latency is PT5M');
	// End Performance Interaction
	
});

test("SCORM Get Interaction By ID", function() {
	var interaction = SB.getInteraction('1'); // True False
	

	interaction = SB.getInteraction('2'); // Multiple Choice

	interaction = SB.getInteraction('3'); // Fill In
	
	interaction = SB.getInteraction('4'); // Sequencing
	
	interaction = SB.getInteraction('5'); // Long Fill In
	
	interaction = SB.getInteraction('6'); // Matching
	
	interaction = SB.getInteraction('7'); // LikeRT
	
	interaction = SB.getInteraction('8'); // Other
	
	strictEqual(SB.getInteraction('999'), 'false', "Getting bogus interaction, should be false");

});
test("SCORM Get Objective By ID", function() {
	
	
});

test("SCORM Set Suspend Data By Page ID", function() {
	var result,
		answer_arr = ["a","b","c","d"],
		images_arr = ["bird.png", "bug.png", "helicopter.png"];
	// Save Suspend Data for Page 1
	strictEqual(SB.setSuspendDataByPageID(1, 'Sample Data 1', {
		answers: answer_arr,
		characters: character_str,
		question: "This <b>is</b> the question?",
		numtries: 2
	}), 'true', 'Setting some sample suspend data for page 1');
	// Verify saved Suspend Data for Page 1
	result = SB.getSuspendDataByPageID(1);
	strictEqual(result.answers, answer_arr, "Verify answers: ['a','b','c','d']");
	strictEqual(result.characters, character_str, "Verify Character String");
	strictEqual(result.question, 'This <b>is</b> the question?', 'Verify question: This <b>is</b> the question?');
	strictEqual(result.numtries, 2, 'Verify numtries: 2');
	// End Test 1
	// Save Suspend Data for Page 2
	strictEqual(SB.setSuspendDataByPageID(2, 'Sample Data 2', {
		short_answer: "This is a short answer with text they typed in.",
		characters: character_str,
		question: "How did you feel about the question?",
		images: images_arr
	}), 'true', 'Setting some sample suspend data for page 2');
	// Verify saved Suspend Data for Page 4
	result = SB.getSuspendDataByPageID(2);
	strictEqual(result.short_answer, 'This is a short answer with text they typed in.', 'Verify short_answer: This is a short answer with text they typed in.');
	strictEqual(result.characters, character_str, "Verify Character String");
	strictEqual(result.question, 'How did you feel about the question?', 'Verify question: How did you feel about the question?');
	strictEqual(result.images, images_arr, "Verify answers: ['bird.png', 'bug.png', 'helicopter.png']");
	// End Test 2
});

test("SCORM Suspend SCO", function() {
	strictEqual(SB.suspend(), 'true', 'Suspending SCO');
	scorm.debug("SetValue Calls: " + setvalue_calls + "\nGetValue Calls: " + getvalue_calls, 4);
});
