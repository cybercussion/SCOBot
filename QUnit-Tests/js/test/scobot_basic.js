/*global $, JQuery, QUnit, ok, module, test, strictEqual, equal, SCORM_API, SCOBot, debug, enableDebug, learner_name, learner_id */
/**
 * This is a basic test of SCOBot, no real interactive or objective information passed.
 * Think of this more like a less advanced implementation where scoring and progress are not tied to anything.
 */
QUnit.config.reorder = false;
var scorm = new SCORM_API({
        debug:          true,
        throw_alerts:   false,
        time_type:      'GMT',
        exit_type:      'suspend',
        success_status: 'unknown'
    }),
    SB = new SCOBot({
        interaction_mode: 'state',
        launch_data_type: 'querystring'
    }),
    entry = 'ab-initio',
    version = '1.0',
    local = false,
    setvalue_calls = 0,
    getvalue_calls = 0,
// These things tend to happen during authoring/creation. We'll use this later to put into suspend data
    character_str = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ˜‌‍‎‏–—―‗‘’‚‛“”„†‡•…‰′″‹›‼‾⁄₣₤₧₪₫€℅ℓ№™Ω℮⅓⅔⅛⅜⅝⅞←↑→↓∂√∞∩∫≠≡■□▲△▼○●♀♂♪";
$(scorm).on("setvalue", function (e) {
    "use strict";
    setvalue_calls += 1;
});
$(scorm).on("getvalue", function (e) {
    "use strict";
    getvalue_calls += 1;
});
$(scorm).on("StoreData", function (e) {
    "use strict";
    SB.debug("Call to Store Data was made.", 3);
    SB.debug(e.runtimedata);
});

// Much of SCOBOT is a bit auto-pilot so several SCORM calls may be made on one API reference.
module("SCOBot");
// Debug
test("SB.debug", function () {
    "use strict";
    var sub_method = SB.debug;
    ok(sub_method("Error Message", 1), "Valid error message");
    ok(sub_method("Warning Message", 2), "Valid warning message");
    ok(sub_method("General Message", 3), "Valid general message");
    ok(sub_method("Log Message", 4), "Valid log message");
    ok(!sub_method("Bogus Message", 5), "Invalid log message");
});

test("ISO 8601 UTC Time", function () {
    "use strict";
    scorm.set("time_type", "UTC");
    strictEqual(SB.isISO8601('2012-02-12T00:37:29.0Z'), true, 'Checking a UTC example 2012-02-12T00:37:29.0Z');
    strictEqual(SB.isISO8601('2012-02-12T00:37:29'), false, 'Checking a non-UTC example 2012-02-12T00:37:29');
    strictEqual(SB.isISO8601('2012-02-1200:37:29'), false, 'Checking a malformed example 2012-02-1200:37:29');
});
/**
 * Verify ISO 8601 Timestamp (this can fail per browser due to time formatting or timezone)
 */
test("ISO 8601 Time", function () {
    "use strict";
// non UTC (This was all I could get to work con cloud.scorm.com)
    scorm.set("time_type", "");
    strictEqual(SB.isISO8601('2012-02-27T15:33:08'), true, 'Checking a non-UTC example 2012-02-27T15:33:08');
    strictEqual(SB.isISO8601('2012-02-1200:37:29'), false, 'Checking a malformed example 2012-02-1200:37:29');
    strictEqual(SB.isISO8601('2012-02-12T00:37:29Z'), false, 'Checking a UTC example 2012-02-12T00:37:29Z');
    // GMT
    scorm.set("time_type", "GMT");
    strictEqual(SB.isISO8601('2009-03-24T16:24:32.5+01:00'), true, 'Checking a GMT example 2009-03-24T16:24:32.5+01:00');
    strictEqual(SB.isISO8601('2012-02-27T15:33:08.08:00'), false, 'Checking a GMT example 2012-02-27T15:33:08.08:00');
    //strictEqual(scorm.isoStringToDate('2012-03-20T10:47:54.0-07:00'), 'March 20, 2012 - 10:47PM', "Checking ISO String back to date");
    var date = scorm.isoStringToDate('2012-03-20T10:47:54.0-07:00');
    strictEqual(String(date), 'Tue Mar 20 2012 10:47:54 GMT-0700 (PDT)', 'Checking ISO8601 String to Date equals - Tue Mar 20 2012 10:47:54 GMT-0700 (PDT)');
});
/**
 * Verify LMS Connected
 */
test("LMS Connected", function () {
    "use strict";
    if (local) {
        strictEqual(scorm.isLMSConnected(), false, 'Local enabled, should not find a LMS.');
    } else {
        strictEqual(scorm.isLMSConnected(), true, 'Local disabled, should find a LMS.');
    }
});

/**
 * Mode (normal, browse, review)
 */
test("Mode", function () {
    "use strict";
    strictEqual(SB.getMode(), 'normal', "Checking that Mode is normal");
});

/**
 * Bookmarking
 */
test("Bookmarking", function () {
    "use strict";
    if (local) {
        // There would be no bookmark unless one was manually set
        strictEqual(SB.setBookmark(2), 'true', 'Setting Bookmark to 2');
        strictEqual(SB.getBookmark(), '2', 'Getting Bookmark, should be 2');
    } else {
        if (SB.getEntry() === "resume") {
            strictEqual(SB.getBookmark(), '2', 'Getting Bookmark, should be 2');
        } else {
            strictEqual(SB.setBookmark(2), 'true', 'Setting Bookmark to 2');
            strictEqual(SB.getBookmark(), '2', 'Getting Bookmark, should be 2');
        }
    }
});

/**
 * Max Time Allowed
 */
test("Max Time Allowed", function () {
    "use strict";
    var max_time_allowed = SB.getvalue('cmi.max_time_allowed');
    strictEqual(max_time_allowed, '', "Checking max time allowed ('')");
    // Note, if you update the CAM to pass imsss:attemptAbsoluteDurationLimit please update this test!
});

/**
 * Comments from LMS
 */
test("Comments from LMS", function () {
    "use strict";
    strictEqual(SB.getvalue('cmi.comments_from_lms._count'), '0', "Getting Comments from LMS count '0'");
    // UPDATE YOUR TESTS HERE IF YOU INTEND TO CHECK FOR COMMENTS
});

/**
 * Check Comments from Learner
 */
test("Check Comments from Learner", function () {
    "use strict";
    var learner_comment_count = SB.getvalue('cmi.comments_from_learner._count'),
        bookmarkCount;
    if (SB.getEntry() !== "resume") {
        // Verify previous comments
        strictEqual(learner_comment_count, '0', "Getting Comments from Learner count '0'");
    } else {
        scorm.debug(SB.getSuspendDataByPageID(3));
        bookmarkCount = SB.getSuspendDataByPageID(3).fromLearner; // pull last suspended count to compare
        strictEqual(learner_comment_count, bookmarkCount, "Getting Comments from Learner count " + bookmarkCount); // this is getting set each visit aka resume attempt.
    }
});

/**
 * Set Comment From Learner
 */
test("Set Comment from Learner", function () {
    "use strict";
    var commentTime = new Date();
    strictEqual(SB.setCommentFromLearner("This is a comment from learner", "QUnit Test", commentTime), 'true', "Setting comment from learner.");
    // Expand later if you like, but please update the expected count above.
    // Increment the stored counter so on resume after several comments it can be evaluated for correctness.
    SB.setSuspendDataByPageID(3, 'countTracker', {
        fromLearner: SB.getvalue('cmi.comments_from_learner._count')
    });
});


/**
 * Set Suspend Data by Page ID
 */
test("Set Suspend Data By Page ID", function () {
    "use strict";
    var result,
        answer_arr = ["a", "b", "c", "d"],
        images_arr = ["bird.png", "bug.png", "helicopter.png"];
    // Save Suspend Data for Page 1
    strictEqual(SB.setSuspendDataByPageID(1, 'Sample Data 1', {
        answers:    answer_arr,
        characters: character_str,
        question:   "This <b>is</b> the question?",
        numtries:   2
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
        characters:   character_str,
        question:     "How did you feel about the question?",
        images:       images_arr
    }), 'true', 'Setting some sample suspend data for page 2');
    // Verify saved Suspend Data for Page 4
    result = SB.getSuspendDataByPageID(2);
    strictEqual(result.short_answer, 'This is a short answer with text they typed in.', 'Verify short_answer: This is a short answer with text they typed in.');
    strictEqual(result.characters, character_str, "Verify Character String");
    strictEqual(result.question, 'How did you feel about the question?', 'Verify question: How did you feel about the question?');
    strictEqual(result.images, images_arr, "Verify answers: ['bird.png', 'bug.png', 'helicopter.png']");
    // End Test 2
});

/**
 * Happy Ending (auto-score/complete)
 */
test("Happy Ending", function () {
    "use strict";
    SB.happyEnding();
    // Verify Happy ending values
    strictEqual(scorm.getvalue('cmi.score.scaled'), '1', "Checking to make sure score.scaled is 1");
    strictEqual(scorm.getvalue('cmi.score.raw'), '1', "Checking to make sure score.raw is 1");
    strictEqual(scorm.getvalue('cmi.success_status'), 'passed', "Checking to make sure success_status is passed.");
    strictEqual(scorm.getvalue('cmi.completion_status'), 'completed', "Checking to make sure completion_status is completed.");
});

/**
 * Suspend The SCO **Terminating**
 */
test("Suspend SCO", function () {
    "use strict";
    SB.debug(">>>>>>>>> Suspending <<<<<<<<<");
    /*strictEqual(scorm.commit(), 'true', "Committing to check navigation possibilities.");
    if (!local) {
        canContinue = SB.getvalue('adl.nav.request_valid.continue');
        strictEqual(canContinue, 'true', 'Checking for adl.nav.request_valid.continue'); // Check your imss sequencing flow control!!!
        if (canContinue === 'true' || canContinue === 'unknown') {
            //SB.setvalue('adl.nav.request', 'continue'); // Enable if you want it to cruise past this SCO
        }
    }*/
    strictEqual(SB.suspend(), 'true', 'Suspending SCO');
    SB.debug("SetValue Calls: " + setvalue_calls + "\nGetValue Calls: " + getvalue_calls, 4);
});
