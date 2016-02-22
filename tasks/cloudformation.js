'use strict';

var AWS = require('aws-sdk');
var Q = require('q');
var cloudFormation = new AWS.CloudFormation({
    region: 'us-east-1'
});

var CREATE_WAIT_TIME = 60000;
var CREATING_STATUS = 'CREATE_IN_PROGRESS';
var DELETE_WAIT_TIME = 60000;
var STATUSES = [
    'CREATE_IN_PROGRESS', 'CREATE_FAILED', 'CREATE_COMPLETE', 'ROLLBACK_IN_PROGRESS',
    'ROLLBACK_FAILED', 'ROLLBACK_COMPLETE', 'DELETE_IN_PROGRESS', 'UPDATE_IN_PROGRESS',
    'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_IN_PROGRESS',
    'UPDATE_ROLLBACK_FAILED', 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
    'UPDATE_ROLLBACK_COMPLETE'
];

module.exports = function(grunt) {
    function createStack(stack, templateUrl, tags) {
        return Q.Promise(function(resolve, reject) {
            cloudFormation.createStack({
                StackName: stack,
                TemplateURL: templateUrl,
                Tags: tags
            }, function(error, data) {
                if(error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    }
    
    function destroyStack(stack) {
        return Q.Promise(function(resolve, reject) {
            cloudFormation.deleteStack({
                StackName: stack
            }, function(error, data) {
                if(error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    }
    
    function describeStack(stack) {
        return Q.Promise(function(resolve, reject) {
            cloudFormation.describeStacks({
                StackName: stack
            }, function(error, data) {
                if(error) {
                    reject(error);
                } else {
                    resolve(data.Stacks[0]);
                }
            });
        });
    }
    
    function listStackNames() {
        return Q.Promise(function(resolve, reject) {
            cloudFormation.listStacks({
                StackStatusFilter: STATUSES
            }, function(error, data) {
                if(error) {
                    reject(error);
                } else {
                    resolve(data.StackSummaries.map(function(summary) {
                        return summary.StackName;
                    }));
                }
            });
        });
    }
    
    function ensureStackCreated(stackName, waitTime) {
        return describeStack(stackName).then(function(stack) {
            if(stack.StackStatus === CREATING_STATUS) {
                return Q.Promise(function(resolve, reject) {
                    setTimeout(function() {
                        ensureStackCreated(stackName, waitTime).then(resolve, reject);
                    }, waitTime);
                });
            }
        });
    }
    
    function ensureStackDeleted(stackName, waitTime) {
        return listStackNames().then(function(stackNames) {
            if(stackNames.indexOf(stackName) !== -1) {
                return Q.Promise(function(resolve, reject) {
                    setTimeout(function() {
                        ensureStackDeleted(stackName, waitTime).then(resolve, reject);
                    }, waitTime);
                });
            }
        });
    }
            
    grunt.registerTask('cloudformation:create', 'creates a CloudFormation stack', function() {
        var done = this.async();
        var target = this.target;

        var createWaitTime = grunt.option('createWaitTime') || CREATE_WAIT_TIME;
        var stackName = grunt.option('stackName');
        var tags = JSON.parse(grunt.option('tags') || '[]');
        var template = grunt.option('template');

        if(!stackName || !template) {
            grunt.log.writeln('Must specify `stackName` and `template` options.');
            done(false);
        }
        
        createStack(stackName, template, tags).then(function() {
            return ensureStackCreated(stackName, createWaitTime);
        }).then(done).catch(function(error) {
            grunt.log.error(error);
            done(false);
        });
    });

    grunt.registerTask('cloudformation:destroy', 'deletes a CloudFormation stack', function() {
        var done = this.async();
        var target = this.target;

        var stackName = grunt.option('stackName');
        var deleteWaitTime = grunt.option('deleteWaitTime') || DELETE_WAIT_TIME;

        if(!stackName) {
            grunt.log.writeln('Must specify `stackName` option.');
            done(false);
            return;
        }
        
        destroyStack(stackName).then(function() {
            return ensureStackDeleted(stackName, deleteWaitTime);
        }).then(done).catch(function(error) {
            grunt.log.error(error);
            done(false);
        });
    });
};
