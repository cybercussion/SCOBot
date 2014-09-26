[![Build Status](https://travis-ci.org/cybercussion/SCOBot.png?branch=master)](https://travis-ci.org/cybercussion/SCOBot)

##SCOBot Content support:
Shareable Content Objects (SCOs) are these little portable web pages that can interact with a Learning Management System (LMS).  SCORM itself, is a specification from ADL (Advanced Distributed Learning), though it based much of its work on IMSGlobal, IEEE, AICC and others.
SCOBot gives you the developer, the ability to drop in some JavaScript, and have the capability to communicate with the LMS.  The communication portion of the SCORM standard allows you to call specific Application Programming Interfaces (APIs) that expect everything in a specific format.  SCOBot actually handles much of the pain and suffering trying to figure this all out.
I've added Wiki documentation now, so you can read more about the API support in detail.
Here: https://github.com/cybercussion/SCOBot/wiki - Please refer to this for much more detailed information.

You may be looking for the LMS Runtime API_1484_11.  This project doesn't expose or incorporate the LMS level API.  This is simply a content API which interfaces the runtime.

## Goals:
* **Save** you time trying to support the SCORM Standard.  Yes, its Initialize, Get Value, Set Value, Commit, and Terminate on the surface, but it goes way beyond that.
* **Educate** - Dig deeper into capabilities and examples
* **Modernize** - No one likes 500 global variable constants coupled with endless other issues associated with un-managed code.
* **Transparency** - Know why something isn't working, and have logging to back it up.
* **Test** - Drove the whole project with unit tests against the specification.  Scenarios, make having a complete test impossible.  Which is why there is always room for more testing.

## About the Project:
I've kept this project split up into 3 logical portions, leaving room for anyone to add or subtract from the complete package. The main focal point would be 'QUnit-Tests/js/scorm/', as the surrounding files are simply supporting files like JQuery, QUnit, and further README files.  I've also added all the files that go into a Content Aggregation Model.  This is a package used to export your content to a learning management server.
The portions of this project is split into the following sections:

* **QUnit-Tests/js/scorm/SCOBotBase.js** (Required in a deployment)-
Tip: This file technically shouldn't be edited.
This is the main 'long-hand' SCORM 2004 that connects to the LMS 'API_1484_11' (2004) or 'API' (1.2).  With some additions to rollback to SCORM 1.2.  Please note, I've only taken the SCORM 1.2 rollback so far, as it was needed on another project I worked on.  There will be cases where there just isn't enough space to store some items if your going from 2004 to 1.2 (fair warning).  This supplies the base support of SCORM (Connection to the LMS, initialize, get/set value, commit, terminate).

* **QUnit-Tests/js/scorm/SCOBot.js** (Optional in a deployment)-
Tip: This is totally customizable to fit your needs.  Edit away.
This is a boiled down series of API's that do common things we all do in a Shareable Content Object.  I often get asked questions about SCORM, and I always try to inform people that API Wrappers are commonly just 'line of sight' to the LMS.  There is mild enforcement of the specification, but most of that comes from the LMS API_1484_11.  SCOBot, is an attempt to rollup all that between the lines stuff that our content commonly has to do.  From managing ISO 8601 time, responses and response patterns, structured suspend data, scoring etc ...

* **QUnit-Tests/js/scorm/SCOBot_API_1484_11.js** (Optional in a deployment)-
Tip: This file can be modified if needed.  This holds the CMI Object (customizable), and lightly enforces the specification.
This is a LMS mimic as boiled down, and will slowly be strengthened with-in reason.  Its not the most strict so don't expect it to throw every single error right now.  It keeps the entire CMI object and console logs the JSON object so you can view whats changed during local testing.  If it doesn't cost (lines of code and or file size) a huge amount to strengthen it up I'll slowly be rolling in those error handlers and validators.  SCORM is a rather large spec to enforce however, and my only concern is this might cost more than its worth.  I had considered adding local storage here however in the case of a offline SCO since it could connect to this when its ran offline.  But, this will also add more code and I'd rather that be an option later when and if it arises.

* Also have now added a minified, or packed version of all 3 of these files in a 29KB easy to use single file for those not doing there own builds.  See the **scorm.bot.pack.js** which is only the 3 above files merged, minified and packed.

## QUnit Launchables:
If your testing a LMS, feel free to edit the imsmanifest.xml to fit your needs.  Change the tests to match your launch parameters or launch data.  These tests are not meant to remain static.  Make it fit your needs.
* **qunit_SCORM_API.html** - This will run a series of 90+ tests against SCORM which include some local debug, gets and sets as well as classic Initialize, GetValue, SetValue, Commit and Terminate.  Even some illegal calls.  This whole package is great to run on a LMS to view if the LMS is compliant with SCORM.
The test for this is found at 'js/test/scobotbase.js'.

* **qunit_SCOBot.html** - This will run through a series of 230+ tests rolled up common functionality that pelts the SCORM_API with all the calls, stressing out the Interactions, Objectives, Suspend Data functionality.  This will continue to grow, as I expand the tests to include proper and improper data formats.

* **qunit_SCOBot_prod.html** - This is the same as the one above, but using the minified/packed JavaScript (single file) scorm.bot.pack.js @~30KB.

### Further Reading:
See the Wiki link on github for more detailed info.  I based much the work on the fact that it's been many many years since SCORM 2004, and JavaScript has come quite a ways since those days.  Getting this into JSLint, QUnit and some more structured code made good solid sense to me.  Since this is on peoples radar in such a broad audience its extremely difficult to speak in API terms to someone that wants to just record some information, and has no idea where in the spec to put it.  I understand when building e-learning content you are often faced with teams of people that don't fully grasp or aren't working in the realm of SCORM.  Terms won't always line up, and the sequence doesn't always match up.  You may run out of space within a few areas due to character limits.  These things cause architectual directional changes and can create problems when your close to deploying.  So I'd highly recommend getting more reading online in if you're new to this.
Diagram (from Brandon Bradley) - http://www.xmind.net/share/brandonbradley/xmind-421310/

### What else do you need?
You can construct single pages that allow the LMS to navigate them.  Or you can build a content player that can present a collection of pages.
Commonly players in the past were built using framesets or iframes but you can also use ajax to get around that.
This package includes sample XSDs/DTDs for SCORM 2004.  Once zipped up, you can use this to import to a LMS and run a series of QUnit tests.

I also recommend trying out a bookmarklet I made to check the status of a content object running on your LMS.
[SCOverseer](http://www.cybercussion.com/bookmarklets/SCORM/) - see the Bookmarklet button on that page (drag it to your bookmarks bar).  Directions on page.

Thanks for taking the time to take a look, and thanks to everyone that's assisted with feedback.
[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/3b68b70a86b15441e520b43adf85113a "githalytics.com")](http://githalytics.com/cybercussion/SCOBot)
