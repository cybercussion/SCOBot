# You made it.

This project was broke down originally to encompass an entire functioning SCO with the exception that rather than a quiz, assessment, game or otherwise it was a QUnit series of tests.

These files are the main formatted source code for the SCOBot Content API.  Per the documentation you can mix and match which files you use in your project.  You may use them all, or include them in your own build processes.

##SCOBotUtil
This now includes an event system and other utilitiy methods used by the library.  Since it was too difficult to expand this to more libraries without relying on these features, they are now baked in.  No dependancies on jQuery or any other framework/library.

##SCOBotBase
This is the bare minimum for establishing a connection to the lms, and providing the backwards compatibilty with both SCORM 1.2 and SCORM 2004.  If you only use this file, your choosing to manage interacting with SCORM directly.

##SCOBot
This automates the sequence doing typical load, initialize, checking mode, entry, suspend data and more.  Creates friendly missing API's from the SCORM communication standard that makes setting objectives and interactions much easier.  Baked in is a load, and unload event which will manage common tasks all SCO's must do.  Also allows you to simply call happyEnding() to auto score your content.  You can even take advantage of letting SCOBot score your objectives for you.

##SCOBot_API_1484_11
This is a local (simple) skeleton of the SCORM 2004 Runtime API.  This mainly serves the purpose of allowing you to work offline and view console messages related to the communication standard of SCORM.  Keep in mind this is only SCORM 2004's base API and does not include things like the Sequence and Navigation portion, or Shared State Persistence.  It is NOT the actual Runtime API so it does not strictly enforce all portions of the student attempt.
