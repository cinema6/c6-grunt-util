(function() {
    'use strict';

    module.exports = function(grunt) {
        var Q = require('q'),
            AWS = require('aws-sdk'),
            crypto = require('crypto'),
            mime = require('mime');

        grunt.registerMultiTask('s3', 'task to upload files to AWS S3.', function() {
            var done = this.async(),
                options = this.options(),
                config = {
                    accessKeyId: options.key,
                    secretAccessKey: options.secret,
                    region: options.region
                },
                uploads = this.data.upload,
                s3, qS3;

            function QS3(s3) {
                for (var key in s3) {
                    if (typeof s3[key] === 'function') {
                        this[key] = Q.nbind(s3[key], s3);
                    } else {
                        this[key] = s3[key];
                    }
                }
            }

            function upload(uploads) {
                var uploadPromises = [];

                uploads.forEach(function(upload) {
                    var files = grunt.file.expand(upload.src),
                        rel = upload.rel || '',
                        dest = upload.dest || '',
                        uploadOptions = upload.options || {},
                        groupPromises = [];

                    files.forEach(function(file) {
                        var contents = grunt.file.isFile(file) ? grunt.file.read(file, { encoding: null }) : null,
                            key = (function(file) {
                                var destIsDir = ((dest === '') || (dest.substr(dest.length - 1) === '/'));

                                if (contents && file.indexOf(rel) !== 0) {
                                    throw new Error('The rel property (' + rel + ') is not a base!');
                                } else {
                                    return destIsDir ? (dest + file.replace(rel, '')) : dest;
                                }
                            }(file)),
                            config = (function(uploadOptions) {
                                this.ACL = options.access || 'private';
                                this.Body = contents;
                                this.Bucket = options.bucket;
                                this.Key = key;
                                this.ContentMD5 = (function(contents) {
                                    var hash = crypto.createHash('md5');

                                    if (!contents) { return null; }

                                    return hash.update(contents)
                                        .digest('base64');
                                }(contents));
                                this.ContentType = mime.lookup(file);

                                for (var param in uploadOptions) {
                                    this[param] = uploadOptions[param];
                                }

                                return this;
                            }.call({}, uploadOptions));

                        function logSuccess() {
                            grunt.log.ok('\u2713 ' + file + ' \u2192 s3://' + options.bucket + '/' + key);
                        }

                        function retry() {
                            grunt.log.error('Failed to upload ' + file + '. Retrying.');

                            return qS3.putObject(config)
                                .then(logSuccess);
                        }

                        if (!contents) { return; }

                        groupPromises.push(qS3.putObject(config).then(logSuccess, retry));
                    });

                    uploadPromises.push(Q.all(groupPromises));
                });

                return Q.all(uploadPromises);
            }

            function handleError(error) {
                grunt.fail.fatal(error);
            }

            AWS.config.apiVersion = '2013-12-03';
            AWS.config.update(config);

            s3 = new AWS.S3();
            qS3 = new QS3(s3);

            upload(uploads)
                .then(done, handleError);
        });
    };
}());
