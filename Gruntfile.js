module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jslint: {
            // define the files to lint
            source: {
                src: ['QUnit-Tests/js/scorm/*.js']
            }
            directives: {
                browser: true,
                nomen: true
            }
        },
        qunit: {
            files: ['QUnit-Tests/qunit_SCOBot_prod.html']
        }
    });
    grunt.registerTask('default', 'jslint');
    // Task to run tests
    grunt.registerTask('default', 'qunit');
};
