[![Build Status](https://travis-ci.org/cybercussion/SCOBot.png?branch=master)](https://travis-ci.org/cybercussion/SCOBot)
## Why would I use this?

* You are looking to add SCORM support to existing content that needs to report scoring, status and or completion.
* You are designing custom e-learning content and wish to add SCORM Support.
* You are testing or troubleshooting a LMS Platforms SCORM compatibility.
* Furthering your familiarization with SCORM and its possibilities.
* Seeking a managed, modern, transparent, test driven approach to JavaScript.

Wiki has been updated with technical, non-technical information so you can obtain a more well-rounded view of e-learning as a whole.  The audience is commonly broad, with varying skill sets and backgrounds.
SCORM is one of the more popular e-learning standards.  Since SCORM is predominantly a JavaScript communication standard coupled with packaging and sequencing - it can get complicated in a hurry.
After you understand the underlying components that make up the communication, packaging, and sequencing you'll find its pretty much like building a website, and reporting what the user is doing through an API.

## SCORM Support for Content
This project was created to enhance developers capabilities interfacing e-learning standards for SCORM 1.2 and SCORM 2004.  Over the last 5+ years of development, there has been no end to the amount of use cases and scenarios.  Feedback from platform deployments ( new and legacy ) have been rolled into to the source code. 
It's a combination of all the missing API support provided by the Learning Management System Runtime.  SCORM itself started off as a packaging and communication standard.  Later in 2004 this included sequencing and navigation to manage your table of contents.
![Documentation](http://cybercussion.com/css/img/oriented.jpg) 

Location of the Runtime API occurs quickly.  This traverses the Document Object Model seeking out the Runtime API.  Once connected, SCORM communication will initialize.
SCOBot will translate API calls to SCORM 1.2 if the portal does not support SCORM 2004.  This allows you to speak one language throughout your project, but be aware there are some limitations on this compatibility due to differences between the specifications.

## Quick note about Packaging
There are a lot of base files that make up the packaging standard.  These schemas and document type definitions are all based on the XML structures used by the packaging format.
These are optional files used to support the IMS Manifest used to describe your content object(s).  This enables a Learning Management System to import your content, and have some level of a one to many relationship.

Often within e-learning curriculum and instructional specialists use modules like chapters, lessons, topics, units and more.  This organization allows the construction of multi-tiered hierarchies which the LMS can display in a tree, or some other navigational format.
The LMS also has the ability to control navigation within SCORM 2004 beyond what was available in SCORM 1.2.

## Quick note about Communication
SCOBot will search for SCORM 2004, then fail over to SCORM 1.2.  If it cannot locate any API, it will fail over to itself.  Since SCOBot will manage the student data, you could choose to route that to local storage, or post it to a central server.  This is all up to how you or your team wants to handle fail over.
There are many deep or complex parts of SCORM since the communication is mainly string based and you only request one value at a time.  SCOBot will allow you to roll-up larger data chunks into one API call.  This simplifies you needing to remember what name spaces, and what order to manage your own communication.  This also aids in your burying all your SCORM communications deep in your project or in a way that isn't re-usable throughout your training.
 
## Technologies, Frameworks, Libraries
Its very important to understand SCORM should be treated much like loading any other data source.  It's recommended you hold up rendering the training until you establish a connection so things like bookmarks, suspended data and other modes that can establish what you should be doing.  So whether you load data from XML, JSON, a CSV or just more HTML and JavaScript, understand SCOBot will trigger a 'load' event once its LMS connection is ready.  Listen to this event to know when its safe to continue.

## QUnit Tests
These have been included to help in the development of the API.  Part way thru the design it was determined they could also test a Learning Management Systems compatibility with SCORM.  All too often there have been platforms that water down their SCORM support or took shortcuts that aren't apparent until you blast them with a compressed 15 minute session.  You can utilize these QUnit tests to find out if your LMS is in good standing or has some issues that need to be addressed.  One popular issue is a non-cached API.  This means the LMS is attempting to make a round-trip to the server per request.  This roughly simulates a Denial Of Service (DOS) attack, and can cripple the user experience.
Those unfamiliar with the concept of Test Driven Development, can visit [QUnitJS.com](https:/qunitjs.com) for more information.
This is a relatively simple way to build out designed tests to ensure logic in your entire project is functioning with good and bad data.

## SCOBot JavaScript
>Single file script - 
QUnit-Tests/js/scorm.bot.pack.js files merged, minified, packed

>Developer Source Code -
QUnit-Tests/js/scorm/

These can be used to aid in the creation of custom shareable content objects, or even adding SCORM support to a page that previously didn't have it.  Further documentation on how to implement and configure SCOBot in your project can be found within the Wiki.

## Further Reading:
See the Wiki link on github for more detailed info.  The SCOBot Documentation will dig into all the technical aspects of not only the integration, but pre-flight things to think about.
Configuration is normally half the battle of a successful deployment, and should be considered before (not after) you start your project.

## What else do you need?
![Player](http://cybercussion.com/css/img/SCOBotPlayer.png) 
A Player/Presentation layer was not included with this project.  Commonly in the past developers used iframes, or framesets to display a series of HTML page in a sequence.  They also used other technologies like Flash.  A more modern HTML approach now would be to lead content via AJAX.
Presenting your training may require you to construct your own player.  This can mean loading, templatizing, blending views and data.  Building out interactions, layouts etc ... You could be doing this by hand or using a CMS.  
Packaging and or Zipping - You may find once you have SCOBot, plus your presentation you need to now bundle it.  The files in this project were meant to assist you here getting a full scope of what needs to be done to make that successful.  See the Wiki for more info on zipping/packaging options.

## Debugging / Transparency
[SCOverseer](http://www.cybercussion.com/bookmarklets/SCORM/) - see the Bookmarklet button on that page (drag it to your bookmarks bar).  Directions on page.

Thanks for taking the time to take a look, and thanks to everyone that's assisted with feedback.