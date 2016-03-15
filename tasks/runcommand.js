'use strict';

var AWS = require('aws-sdk');
var Q = require('q');
var path = require('path');

var CHECK_STATUS_WAIT = 5000
var IN_PROGRESS_STAUSES = ['Pending', 'InProgress', 'Cancelling'];
var SUCCESS_STATUS = 'Success';

module.exports = function(grunt) {
    var autoscaling;
    var ssm;

    // Get array of instance ids in an autoscaling group
    function getInstanceIds(group) {
        return Q.Promise(function(resolve, reject) {
            autoscaling.describeAutoScalingGroups({
                AutoScalingGroupNames: [ group ]
            }, function(error, data) {
                if(error) {
                    reject(error);
                } else {
                    resolve(data.AutoScalingGroups[0].Instances.map(function(instance) {
                        return instance.InstanceId;
                    }));
                }
            });    
        });
    }
    
    // Run shell command on the specified instance
    function runCommand(instanceIds, command, comment, timeout) {
        return Q.Promise(function(resolve, reject) {
            ssm.sendCommand({
                Comment: comment,
                DocumentName: 'AWS-RunShellScript',
                InstanceIds: instanceIds,
                TimeoutSeconds: timeout,
                Parameters: {
                    commands: [ command ],
                    executionTimeout: [ String(timeout) ]
                }
            }, function(error, data) {
                if(error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    }
    
    // Gets the status of the command
    function getCommandStatus(id) {
        return Q.Promise(function(resolve, reject) {
            ssm.listCommands({
                CommandId: id
            }, function(error, data) {
                if(error) {
                    reject(error);
                } else {
                    resolve(data.Commands[0].Status);
                }
            });
        });
    }
    
    // Resolves once the command has finished executing
    function waitForCommand(id) {
        return getCommandStatus(id).then(function(status) {
            if(IN_PROGRESS_STAUSES.indexOf(status) === -1) {
                return status;
            } else {
                return Q.Promise(function(resolve, reject) {
                    setTimeout(function() {
                        return waitForCommand(id).then(resolve, reject);
                    }, CHECK_STATUS_WAIT);
                });
            }
        });
    }

    grunt.registerTask('runcommand', 'runs an EC2 runcommand against an instance or autoscaling group', function() {
        var done = this.async();

        var awsFileAuth = grunt.option('awsFileAuth');
        var autoscalingGroup = grunt.option('autoscaling');
        var command = grunt.option('command');
        var comment = grunt.option('comment') || '';
        var instanceList = grunt.option('instances');
        var region = grunt.option('region') || 'us-east-1';
        var timeout = grunt.option('execTimeout') || 30000;

        // Ensure command specified
        if(!command) {
            grunt.log.writeln('Must specify a command to run.');
            done(false);
            return;
        }
        
        // Ensure at least one instance specified
        if(!autoscalingGroup && !instanceList) {
            grunt.log.writeln('Must specify `autoscaling` or `instances` options.');
            done(false);
            return;
        }
        
        // Initialize AWS
        if(awsFileAuth) {
            var authFile = path.join(process.env.HOME,'.aws.json');
            AWS.config.loadFromPath(authFile);
        }
        AWS.config.update({ region: region });
        autoscaling = new AWS.AutoScaling();
        ssm = new AWS.SSM();

        // Run the command
        var instances = [];
        if(instanceList) {
            instances.concat(instanceList.split(','));
        }
        return Q.resolve().then(function() {
            if(autoscalingGroup) {
                grunt.log.writeln('Looking up instances in autoscaling group');
                return getInstanceIds(autoscalingGroup).then(function(ids) {
                    instances = instances.concat(ids);
                });
            }
        }).then(function() {
            grunt.log.writeln('Running command on instances ' + instances);
            return runCommand(instances, command, comment, Math.round(timeout / 1000));
        }).then(function(data) {
            grunt.log.writeln('Waiting for command to complete');
            return waitForCommand(data.Command.CommandId);
        }).then(function(status) {
            if(status === SUCCESS_STATUS) {
                grunt.log.writeln('Finished running the command');
                done();
            } else {
                return Q.reject('Command failed with status ' + status);
            }
        }).catch(function(error) {
            grunt.log.error(error);
            done(false);
        });
    });
};
