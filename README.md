[![Build Status](https://travis-ci.org/cybercussion/SCOBot.png?branch=master)](https://travis-ci.org/cybercussion/SCOBot)

##SCOBot Content support:
Shareable Content Objects (SCOs) are these little portable web pages that can interact with a Learning Management System (LMS).  SCORM is self, is a specification from ADL (Advanced Distributed Learning), though it based much of its work on IMSGlobal, IEEE, AICC and others.
SCOBot gives you the developer, the ability to drop in some JavaScript, and have the capability to communicate with the LMS.  The communication portion of the SCORM standard allows you to call specific Application Programming Interfaces (APIs) that expect everything in a specific format.  SCOBot actually handles much of the pain and suffering trying to figure this all out.
I've added Wiki documentation now, so you can read more about the API support in detail.
Here: https://github.com/cybercussion/SCOBot/wiki - Please refer to this for much more detailed information.

Feel free to email or post any issues you run into.  At the same time this has been built and maintained, its getting used, so having a broader scope of deployment feedback is invaluable. 

You may be looking for the LMS Runtime API_1484_11, and this Project does not offer or include that.

## Goals:
* **Save** you time trying to support the SCORM Standard.  Yes, its Initialize, Get Value, Set Value, Commit, and Terminate on the surface, but it goes way beyond that.
* **Educate** - Examples, concepts, options
* **Modernize** - No one likes 500 global variable constants coupled with endless other issues associated with un-managed code.
* **Transparency** - Know why something isn't working, and have logging to back it up.
* **Test** - Drove the whole project with unit tests against the specification.  Scenarios, make having a complete test impossible.  Which is why there is always room for more testing.

## About the Project:
I've kept this project split up into 4 logical portions, leaving room for anyone to add or subtract from the complete package. The main focal point would be 'QUnit-Tests/js/scorm/', as the surrounding files are simply supporting files like JQuery, QUnit, and further README files.  I've also added all the files that go into a Content Aggregation Model.  This is a package used to export your content to a learning management server.
The portions of this project is split into the following sections:

### Now no longer requires JQuery in v4.x.x.?  So where's the code?

#### Utilities
* **QUnit-Tests/js/scorm/SCOBotUtil.js** (Required in a deployment)-
Utilitiy funcitons replacing lost functionality used by jQuery in 3.x.x and prior.
Includes an event system for JavaScript.  Wiki covers the audit.  Now removed '$' so if you are using jQuery, you don't have to worry about conflicts.  Minified this was a hit for 3.8KB vs 95KB of jQuery.

#### Base Functionality
* **QUnit-Tests/js/scorm/SCOBotBase.js** (Required in a deployment)-
This is now expanded to backwards support SCORM 1.2 with some warnings and limitations.  Will connect to API or API_1484_11 supported by a LMS that hosts SCORM content.  This is the core LMS API lookup, and switchboard used to talk to the Runtime API on the LMS.

#### Full Automation
* **QUnit-Tests/js/scorm/SCOBot.js** (Optional in a deployment)-
This is the automatic sequenced out SCORM calls commonly used.  Supports and boils down some of the more complicated parts of the standard by supporting time stamps (UTC/GMT), duration/latency, formatting interaction info, objectives and rolled up scoring if you choose. You must inform SCOBot how many interactions you have in order for it to caclulate score.  Otherwise, you need to write your own score management internal to your SCO.  Also supports timed (max time allowed) instances.

#### Standalone, Local or Offline failover
* **QUnit-Tests/js/scorm/SCOBot_API_1484_11.js** (Optional in a deployment)-
This is the LMS mimic capability for local testing (non-LMS).  May save you some round trips testing out SCORM Calls, or may even allow you to support taking your content offline or running in a non-LMS fashion.

* Also have now added a minified, or packed version of all 4 of these files in a 39KB easy to use single file for those not doing there own builds.  See the **scorm.bot.pack.js** which is only the 4 above files merged, minified and packed.

## QUnit Launchables:
If your testing a LMS, feel free to edit the imsmanifest.xml to fit your needs.  Change the tests to match your launch parameters or launch data.  These tests are not meant to remain static.  Make it fit your needs.
* **qunit_SCOBotBase.html** - This will run a series of 90+ tests against SCORM which include some local debug, gets and sets as well as classic Initialize, GetValue, SetValue, Commit and Terminate.  Even some illegal calls.  This whole package is great to run on a LMS to view if the LMS is compliant with SCORM.
The test for this is found at 'js/test/scobotbase.js'.

* **qunit_SCOBot_dev_full.html** - This will run through a series of 230+ tests rolled up common functionality that pelts the SCOBotBase with all the calls, stressing out the Interactions, Objectives, Suspend Data functionality.  This will continue to grow, as I expand the tests to include proper and improper data formats.

* **qunit_SCOBot_prod_full.html** - This is the same as the one above, but using the minified/packed JavaScript (single file) scorm.bot.pack.js @~39KB.  Ensures the build process works and puts the code in a state for deployment.
Optionally, you may want to blend this code in with all your base player code instead and make it part of a whole build.

#### So why do some tests fail?
Some are cosmetic (date differences between browsers), launch data or values that were written for something used vs. where it is now deployed or packaged.  Comment out any tests you aren't using, modify the data its comparing to get your test(s) passing.

### Further Reading:
See the Wiki link on github for more detailed info.  I based much the work on the fact that it's been many many years since SCORM 2004, and JavaScript has come quite a ways since those days.  Getting this into JSLint, QUnit and some more structured code made good solid sense to me.  Since this is on peoples radar in such a broad audience its extremely difficult to speak in API terms to someone that wants to just record some information, and has no idea where in the spec to put it.  I understand when building e-learning content you are often faced with teams of people that don't fully grasp or aren't working in the realm of SCORM.  Terms won't always line up, and the sequence doesn't always match up.  You may run out of space within a few areas due to character limits.  These things cause architectual directional changes and can create problems when your close to deploying.  So I'd highly recommend getting more reading online in if you're new to this.
Diagram (from Brandon Bradley) - http://www.xmind.net/share/brandonbradley/xmind-421310/

### What else do you need?
HTML, Flash, Unity... you name it.  Presenting your training may require you to construct your own player.  This can mean loading, templatizing, blending views and data.  Building out interactions, layouts etc ... You could be doing this by hand or using a CMS.  
Packaging and or Zipping - You may find once you have SCOBot, plus your presentation you need to now bundle it.  The files in this project were meant to assist you here getting a full scope of what needs to be done to make that successful.  See the Wiki for more info on zipping/packaging options.

I also recommend trying out a bookmarklet I made to check the status of a content object running on your LMS.
[SCOverseer](http://www.cybercussion.com/bookmarklets/SCORM/) - see the Bookmarklet button on that page (drag it to your bookmarks bar).  Directions on page.

Thanks for taking the time to take a look, and thanks to everyone that's assisted with feedback.
[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/3b68b70a86b15441e520b43adf85113a "githalytics.com")](http://githalytics.com/cybercussion/SCOBot)
