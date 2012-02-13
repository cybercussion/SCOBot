/*global $, JQuery, ok, module, test, strictEqual, equal, SCORM_API, SCOBot, debug, enableDebug, learner_name, learner_id, mode, local */
var scorm  = new SCORM_API({
								debug: true,
								exit_type: 'suspend',
								success_status: 'passed'
	                       }),
	SB     = new SCOBot({
								debug: true,
								exit_type: 'suspend',
								success_status: 'passed',
								interaction_mode: 'state'
	                       }),
	setvalue_calls = 0,
	getvalue_calls = 0;
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
	// TODO
	strictEqual(SB.setObjective({
		id: '1_1',
		scaled: '0',
		raw: '0',
		min: '0',
		max: '1'
	}), 'true', "Setting Objective 1_1 unscored");
});

test("SCORM Interactions", function() {
	// TODO
	var startTime = new Date(),
		endTime   = new Date(),
		intID     = '1',
		objID     = '1_1',
		n         = '', // for interaction.n Array value (locator)
		m         = ''; // for Interaction.n.objective.m array value (locator)
	endTime.setMinutes(startTime.getMinutes() + 5); // Add 5 minutes for latency, result would be PT5M
	
	strictEqual(SB.setInteraction({
		id: intID,
		type: 'true_false',
		objectives: [
			{
				id: objID
			}
		],
		timestamp: startTime,
		correct_responses: [
			{
				pattern: 'true'
			}
		],
		weighting: '1',
		learner_response: 'true',
		result: 'correct',
		latency: endTime,
		description: 'This is the question?'
	}), 'true', "Setting Interaction 1 unscored");
	
	//test("SCORM Interactions Verification", function() {
		// Verify Data was set properly, I'm using long-hand scorm calls for this
		n = scorm.getInteractionByID(intID);
		m = scorm.getInteractionObjectiveByID(n, objID);
		strictEqual(scorm.getvalue('cmi.interactions.'+n+'.type'), 'true_false', "Verifying interaction type true_false");
		strictEqual(scorm.getvalue('cmi.interactions.'+n+'.learner_response'), 'true', "Verifying interaction learner response true");
		strictEqual(scorm.getvalue('cmi.interactions.'+n+'.result'), 'correct', "Verifying interaction result correct");
		strictEqual(scorm.getvalue('cmi.interactions.'+n+'.latency'), 'PT5M', "Verifying interaction latency calculation PT5M");
	//});
	
});

test("SCORM Suspend Data", function() {
	
});

test("SCORM Suspend SCO", function() {
	strictEqual(SB.suspend(), 'true', 'Suspending SCO');
	scorm.debug("SetValue Calls: " + setvalue_calls + "\nGetValue Calls: " + getvalue_calls, 4);
});
