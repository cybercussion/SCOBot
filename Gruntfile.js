module.exports = function(grunt) {
    'use strict';

    grunt.loadNpmTasks('grunt-jslint'); // load the task
    grunt.loadNpmTasks('grunt-contrib-qunit');
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jslint: {
            // define the files to lint
            client: {
                src: ['QUnit-Tests/js/scorm/*.js'],
                directives: {
                    browser: true,
                    nomen: true
                },
                options: {
                    junit: 'out/client-junit.xml', // write the output to a JUnit XML
                }
            }
            
        },
        qunit: {
            files: ['QUnit-Tests/qunit_SCOBot_prod.html']
        }
    });
    
    // Task to run tests
    grunt.registerTask('test', ['jslint', 'qunit']);
    
    // grunt.registerTask('dist', ['concat:dist', 'uglify:dist']);
    
};
