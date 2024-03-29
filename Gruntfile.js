/*
 * grunt-versionator
 * https://github.com/cinema6/c6-grunt-util
 *
 * Copyright (c) 2013 Joshua Minzner
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    var watchmanUser = process.env.WATCHMAN_USER || process.env.USER || 'anon';
    var baseStreamNames = [
        'devTimeStream',
        'devWatchmanStream',
        'devCwrxStream'];
    var baseTableNames = [
        'devTimeStreamApplication',
        'devWatchmanStreamApplication',
        'devCwrxStreamApplication'
    ];

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>',
      ],
      options: {
        jshintrc: '.jshintrc',
      },
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp'],
    },

    // Configuration to be run (and then tested).
    versionator: {
      default_options: {
        options: {
        },
        files: {
          'tmp/default_options': ['test/fixtures/testing', 'test/fixtures/123'],
        },
      },
      custom_options: {
        options: {
          separator: ': ',
          punctuation: ' !!!',
        },
        files: {
          'tmp/custom_options': ['test/fixtures/testing', 'test/fixtures/123'],
        },
      },
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js'],
    },

    // creating/destorying kinesis streams
    streams: {
      options: {
        waitTime: 5000,
        streams: baseStreamNames.map(function(name) {
            return name + '-' + watchmanUser;
        }),
        tables: baseTableNames.map(function(name) {
            return name + '-' + watchmanUser;
        })
      },
      create: { },
      destroy: { }
    }
  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'versionator', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
