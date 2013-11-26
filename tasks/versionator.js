/*
 * grunt-cinema6
 * https://github.com/cinema6/c6-grunt-util
 *
 * Copyright (c) 2013 Joshua Minzner
 * Licensed under the MIT license.
 */

'use strict';

var tmp = require('temporary');

module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-cachebuster');

    grunt.registerMultiTask('versionator', 'Plugin to rename files to include their MD5 hash and generate a JSON file mapping the original name to the versioned one.', function() {
        var files = this.files,
            cwDir = this.data.cwd ? (this.data.cwd + '/') : '',
            destDir = this.data.dest ? (this.data.dest + '/') : '',
            tmpDir = new tmp.Dir(),
            tmpMap = tmpDir.path + '/map.json',
            map = {},
            options = this.options({
                map: destDir + 'map.json'
            }),
            md5s;

        grunt.registerTask('versionator-modify', function() {
            var count = 0;

            md5s = grunt.file.readJSON(tmpMap);

            files.forEach(function(file) {
                var src = file.src[0],
                    dest = (function() {
                        var unprocessedDest = file.dest,
                            modifier = md5s[src] ? ('.' + md5s[src]) : '';

                        return [
                            unprocessedDest.slice(0, unprocessedDest.lastIndexOf('.')),
                            modifier,
                            unprocessedDest.slice(unprocessedDest.lastIndexOf('.'))
                        ].join('');
                    }()),
                    matchCwDir = new RegExp('^' + cwDir),
                    matchDestDir = new RegExp('^' + destDir),
                    mapKey = src.replace(matchCwDir, ''),
                    mapValue = dest.replace(matchDestDir, '');

                if (grunt.file.isFile(src)) {
                    grunt.file.copy(src, dest);
                    map[mapKey] = mapValue;
                    count++;
                }
            });

            grunt.log.oklns('Modified ' + count + ' files.');

            grunt.file.write(options.map, JSON.stringify(map, null, '    '));
            grunt.log.oklns('Wrote map file to ' + options.map + '.');
        });

        grunt.config('cachebuster', {
            versionator: {
                src: files.map(function(file) { return file.src; }),
                dest: tmpMap
            }
        });

        grunt.task.run('cachebuster:versionator');
        grunt.task.run('versionator-modify');
    });
};
