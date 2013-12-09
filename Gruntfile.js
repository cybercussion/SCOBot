module.exports = function(grunt) {
    'use strict';

    grunt.loadNpmTasks('grunt-jslint'); // load the task
    grunt.loadNpmTasks('grunt-contrib-qunit');
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jslint: {
            // define the files to lint
            server: {
                src: ['QUnit-Tests/js/scorm/*.js'],
                directives: {
                    browser: true,
                    nomen: true
                },
                options: {
                    junit: 'out/server-junit.xml', // write the output to a JUnit XML
                    log: 'out/server-lint.log',
                    jslintXml: 'out/server-jslint.xml',
                    errorsOnly: true, // only display errors
                    failOnError: false, // defaults to true
                    checkstyle: 'out/server-checkstyle.xml' // write a checkstyle-XML
                }
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
