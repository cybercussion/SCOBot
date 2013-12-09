module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        qunit: {
            files: ['QUnit-Tests/qunit_SCOBot_prod.html', 'QUnit-Tests/qunit_SCORM_API.html']
        }
    });

    // Task to run tests
    grunt.registerTask('test', 'qunit');
};
