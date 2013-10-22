# Shareable Content Object: SCORM API - SCOBot Content support:
I've added Wiki documentation now, so you can read more about the API support in detail.
Here: https://github.com/cybercussion/SCOBot/wiki - Please refer to this for much more detailed information.

You may be looking for the LMS Runtime API_1484_11.  This project does not currently expose that, but does have a LMS Mimic or Local API_1484_11 used when no LMS is present. More on that below...

## Goals:
* **Save** you time trying to support the SCORM Standard.  Yes, its Initialize, Get Value, Set Value, Commit, and Terminate on the surface, but it goes way beyond that.
* **Educate** - I'm learning, you're learning, we are all learning
* **Modernize** - No one likes 500 global variable constants coupled with endless other issues associated with un-managed code.
* **Transparency** - Know why something isn't working, and have logging to back it up.
* **Test** - Drove the whole project with unit tests against the specification.  Scenarios, make having a complete test impossible.  Which is why there is always room for more testing.

## About the Project:
I've kept this project split up into 3 logical portions, leaving room for anyone to add or subtract from the complete package. The main focal point would be 'QUnit-Tests/js/scorm/', as the surrounding files are simply supporting files like JQuery, QUnit, and further README files.  I've also added all the files that go into a Content Aggregation Model.  This is a package used to export your content to a learning management server.
The portions of this project is split into the following sections:

* **QUnit-Tests/js/scorm/SCORM_API.js** (Required in a deployment)-
Tip: This file technically shouldn't be edited.
This is the main 'long-hand' SCORM 2004 that connects to the LMS 'API_1484_11' (2004) or 'API' (1.2).  With some additions to rollback to SCORM 1.2.  Please note, I've only taken the SCORM 1.2 rollback so far, as it was needed on another project I worked on.  There will be cases where there just isn't enough space to store some items if your going from 2004 to 1.2.  Ok, fair warning.  This supplies the base support of SCORM (Connection to the LMS, initialize, get/set value, commit, terminate).

* **QUnit-Tests/js/scorm/SCOBot.js** (Optional in a deployment)-
Tip: This is totally customizable to fit your needs.  Edit away.
This is a boiled down series of API's that do common things we all do in a Shareable Content Object.  I often get asked questions about SCORM, and I always try to inform people that API Wrappers are commonly just 'line of sight' to the LMS.  There is mild enforcement of the specification, but most of that comes from the LMS API_1484_11.  SCOBot, is an attempt to rollup all that between the lines stuff that our content commonly has to do.  From managing ISO 8601 time, responses and response patterns, structured suspend data, scoring etc ...

* **QUnit-Tests/js/scorm/Local_API_1484_11.js** (Optional in a deployment)-
Tip: This file can be modified if needed.  This holds the CMI Object (customizable), and lightly enforces the specification.
This is a LMS mimic as boiled down, and will slowly be strengthened with-in reason.  Its not the most strict so don't expect it to throw every single error right now.  It keeps the entire CMI object and console logs the JSON object so you can view whats changed during local testing.  If it doesn't cost (lines of code and or file size) a huge amount to strengthen it up I'll slowly be rolling in those error handlers and validators.  SCORM is a rather large spec to enforce however, and my only concern is this might cost more than its worth.  I had considered adding local storage here however in the case of a offline SCO since it could connect to this when its ran offline.  But, this will also add more code and I'd rather that be an option later when and if it arises.

* Also have now added a minified, or packed version of all 3 of these files in a 29KB easy to use single file for those not doing there own builds.  See the **scorm.bot.pack.js** which is only the 3 above files merged, minified and packed.

## So what are you looking at?
I re-bundled this project with all the files you would need to construct a Content Aggregation Model (Package you import into a LMS that supports SCORM 2004).
I hope this helps some people with that process that are manually creating content.  The imsmanifest.xml files within have some example structures and parameters that will hopefully aid you in defining your course, lesson or topics.

## Flavors/Approaches:
You could just use the SCORM_API.js and get down the road.  But, what I've found is you commonly do things that will have to re-entering several bits of this code anyway. I'm leaving the SCOBot open to additions and something that can be customizable.  If anything maybe just something to springboard off of.  The Local_API_1484_11 offers the support of a LMS in standalone mode.  It will not store your data after you exit the browser.  But, it will allow your content to run locally.

This requires you to have a base understanding of SCORM or be open to trying to learn it.  There are several online resources from ADL on this subject which cover the specification in detail.  I'm not even going to make a feeble attempt as it took them over 200 pages to describe the standard.  I couldn't even begin to do it justice in this little README.

## QUnit Launchables:
If your testing a LMS, feel free to edit the imsmanifest.xml to fit your needs.  Change the tests to match your launch parameters or launch data.  These tests are not meant to remain static.  Make it fit your needs.
* **qunit_SCORM_API.html** - This will run a series of 90+ tests against SCORM which include some local debug, gets and sets as well as classic Initialize, GetValue, SetValue, Commit and Terminate.  Even some illegal calls.  This whole package is great to run on a LMS to view if the LMS is compliant with SCORM.
The test for this is found at 'js/test/scorm_api.js'.

* **qunit_SCOBot.html** - This will run thru a series of rolled up common functionality that pelts the SCORM_API with all the calls, stressing out the Interactions, Objectives, Suspend Data functionality.  This will continue to grow, as I expand the tests to include proper and improper data formats.

* **qunit_SCOBot_prod.html** - This is the same as the one above, but using the minified/packed JavaScript (single file) scorm.bot.pack.js @ 29KB.

### Further Reading:
There are additional HTML based 'read me' files I've written up over the months I worked on this.  I based much the work on the fact that it's been many many years since SCORM 2004, and JavaScript has come quite a ways since those days.  Getting this into JSLint, QUnit and some more structured code made good solid sense to me.  Since this is on peoples radar in such a broad audience its extremely difficult to speak in API terms to someone that wants to just record some information, and has no idea where in the spec to put it.  I understand when building e-learning content you are often faced with teams of people that don't fully grasp or aren't working in the realm of SCORM.  Terms won't always line up, and the sequence doesn't always match up.  You may run out of space within a few areas due to character limits.  These things cause architectual directional changes and can create problems when your close to deploying.  So I'd highly recommend getting more reading online in if you're new to this.
Diagram (from Brandon Bradley) - http://www.xmind.net/share/brandonbradley/xmind-421310/

### What else do you need?
You'll need to have a presentation layer that supports navigation (if you have more than one page).  This has typically been accomplished in HTML or Flash.  You'll need to integrate it with your navigation if you implement Bookmarking (cmi.location).  If you have assessments or quizes and you want to report there interactions and objectives you can use SCOBot to pass data objects that will record or retrieve these for you.  Similarly if you want to suspend data that doesn't fit into a interaction or a objective you can store objects of data that will be submitted as JSON Strings to the LMS, then on resume, will turn them back into Native objects in JavaScript.  This is all organized by Page right now, so if you do something differnet, you'll have to add your own API's.  You may want to consider adding a couple buttons like Save and or Submit.  You could also consider commiting your data between pages incase your worried about a student losing there session.
This is obviously just the beginning scratch on how you'll integrate, but I've tried to comment in the code as much as possible so this works with jsdocs.
If you're using Flash, I haven't made a External Interface AS2/3 Class to work with this, but it wouldn't be to hard to build one if you needed to interface SCOBot.  


In action at http://hivelms.com/test.html *see QUnit SCO.

## Tips on Best Practices:
I highly recommend anyone who's working with JavaScript consider the use of merging and minifying or doing further and packing their files.  This is why there is not just a single file, and why I'm not setting this up as a 'release'.  It's left broken up so you can choose what you want and don't want.  There are several ways to accomplish this if your not familiar with it.
Merge would be the act of concatenating all your JavaScript files in the order that they are in within your HTML page.
Minify will remove useless tabbing, white space
Packing would be the process of shrinking variables, remove line returns and base64ing or obfuscating the code.
You'll see a 50+% reduction in size, and with gzipping can see 70-80% reduction from the source code.  This is a reduction of HTTP hits and bandwidth.
Please use JSLint to verify other code in your project will not break as a result of this.  Most common error is missing semi-colons.  Once line returns are removed, this will result in a JavaScript error.

## About the Author:
I've worked on a variety of e-learning projects since 2001.  I've utilized several 3rd Party API's, and for better or worse after dealing with unmanaged JavaScript code or lacking features opted to dive into figuring this out.  I have written a LMS API_1484_11 runtime, at the same time as making the client API.  This allowed me to put the reference materials in practice and write tests that to work against the specification.
At this point, now that I have the core foundation down, I'll be turning my attention to the SCOBot portion so this is more easily consumable to entry and mid level developers or first time e-learner developers.  Don't feel too horrible if your coming in new to this.  It took years to really consume it.  So much focus is on the content, rarely we get a chance to geek out on what makes a student pass/fail, and all the information thats needed to make that happen.  Course when I finish SCORM 20XX will be out.

Thanks for taking the time to take a look, and thanks to everyone that's assisted with feedback.
[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/3b68b70a86b15441e520b43adf85113a "githalytics.com")](http://githalytics.com/cybercussion/SCOBot)
