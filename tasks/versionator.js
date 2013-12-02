/*
 * grunt-cinema6
 * https://github.com/cinema6/c6-grunt-util
 *
 * Copyright (c) 2013 Joshua Minzner
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
    var Q = require('q'),
        crypto = require('crypto');

    grunt.registerMultiTask('versionator', 'Plugin to rename files to include their MD5 hash and generate a JSON file mapping the original name to the versioned one.', function() {
        var done = this.async(),
            options = this.options({
                createSetsWith: function(src) { return src; }
            }),
            files = this.files;

        function buildMap() {
            var map = {};

            grunt.log.subhead('Finding Sets');

            files.forEach(function(group) {
                var dest = group.dest,
                    src = group.src[0],
                    setSrc = options.createSetsWith(src),
                    entry;

                if (group.src.length > 1) {
                    throw new RangeError('Multiple sources cannot map to one destination.');
                }

                if (!grunt.file.isFile(src)) {
                    return;
                }

                if (!map[setSrc]) {
                    grunt.log.ok('Found new set: ' + setSrc);
                    map[setSrc] = {
                        dests: [],
                        srcs: [],
                        hash: crypto.createHash('md5')
                    };
                }

                entry = map[setSrc];

                entry.dests.push(dest);
                entry.srcs.push(src);
                entry.hash.update(grunt.file.read(src, { encoding: null }));
            });

            return map;
        }

        function writeFingerprints(map) {
            var entry, md5;

            grunt.log.subhead('Copying Files');

            function copyFile(dest, index) {
                var fingerprintedDest = [
                        dest.slice(0, dest.lastIndexOf('.')),
                        ('.' + md5),
                        dest.slice(dest.lastIndexOf('.'))
                    ].join(''),
                    src = entry.srcs[index];

                grunt.file.copy(src, fingerprintedDest);

                grunt.log.ok('Copied file: ' + fingerprintedDest);
            }

            for (var setSrc in map) {
                entry = map[setSrc];
                md5 = entry.hash.digest('hex');

                if (entry.srcs.length !== entry.dests.length) {
                    throw new RangeError('Something went wrong. The "' + setSrc + '" set has a different number of srcs and dests.');
                }

                entry.dests.forEach(copyFile);
            }
        }

        function handleError(error) {
            grunt.log.error(error);
        }

        Q.all(buildMap())
            .then(writeFingerprints)
            .then(done, handleError);
    });
};
