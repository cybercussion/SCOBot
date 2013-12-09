module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        qunit: {
            files: ['QUnit-Tests/qunit_SCOBot_prod.html']
        },
        jshint: {
            // define the files to lint
            files: ['QUnit-Tests/js/scorm/*.js'],
            // configure JSHint (documented at http://www.jshint.com/docs/)
            options: {
                // more options here if you want to override JSHint defaults
                globals: {
                    jQuery: true,
                    console: true,
                    module: true
                }
            }
        }
    });

    // Task to run tests
    grunt.registerTask('test', 'qunit');
};
