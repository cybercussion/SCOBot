module.exports = function(grunt) {
    'use strict';
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        dirs: {
            src: 'QUnit-Tests/js/scorm/',
            dest: 'QUnit-Tests/js/<%= pkg.name %>-<%= pkg.version %>',
        },
        jslint: {
            // define the files to lint
            client: {
                src: ['<%= dirs.src %>*.js'],
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
            files: ['QUnit-Tests/qunit_SCOBot.html']
        },
        concat: {
            dist: {
                src: ['<%= dirs.src %>*.js'],
                dest: '<%= dirs.dest %>-min.js',
            }
        },
        packjs: {
            default_options: {
                options: {
                    base64: true,
                    shrink: true
                },
                files: {
                    '<%= dirs.dest %>-pack.js': '<%= dirs.dest %>-min.js'
                }
            }
        }
    });
    
    // Tasks
    grunt.loadNpmTasks('grunt-jslint'); // load the task
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-packer');
    //grunt.loadNpmTasks('grunt-jsmin-sourcemap');
    
    // Task to run tests
    grunt.registerTask('test', ['jslint', 'qunit', 'concat', 'packjs']); // packer (not found?)
    // Task to Distribute
    //grunt.registerTask('dist', ['concat']);
    
};
