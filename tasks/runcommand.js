'use strict';

var AWS = require('aws-sdk');
var Q = require('q');
var path = require('path');

module.exports = function(grunt) {
    var autoscaling;
    var ssm;

    // Initializes required AWS Objects
    function initAWS(auth, region) {
        AWS.config.loadFromPath(auth);
        AWS.config.update({ region: region });
        autoscaling = new AWS.AutoScaling();
        ssm = new AWS.SSM();
    }

    // Get array of instance ids in an autoscaling group
    function getInstanceIds(group) {
        return new Q.Promise(function(resolve, reject) {
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
        return new Q.Promise(function(resolve, reject) {
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

    grunt.registerTask('runcommand', 'runs an EC2 runcommand against an instance or autoscaling group', function() {
        var done = this.async();

        var auth = grunt.option('awsAuth') || path.join(process.env.HOME,'.aws.json');
        var autoscalingGroup = grunt.option('autoscaling');
        var command = grunt.option('command');
        var comment = grunt.option('comment') || '';
        var instanceList = grunt.option('instances');
        var region = grunt.option('region') || 'us-east-1';
        var timeout = grunt.option('execTimeout') || 10000;

        initAWS(auth, region);
        
        if(!command) {
            grunt.log.writeln('Must specify a command to run.');
            done(false);
            return;
        }
        
        if(!autoscalingGroup && !instanceList) {
            grunt.log.writeln('Must specify `autoscaling` or `instances` options.');
            done(false);
            return;
        }
        
        var instances = [];
        if(instanceList) {
            instances.concat(instanceList.split(','));
        }
        return Q.resolve(function() {
            if(autoscalingGroup) {
                return getInstanceIds(autoscalingGroup).then(function(ids) {
                    instances.concat(ids);
                });
            }
        }).then(function() {
            return runCommand(instances, command, comment, Math.round(timeout / 1000));
        }).then(function() {
            grunt.log.writeln('Finished running the command');
            done();
        }).catch(function(error) {
            grunt.log.error(error);
            done(false);
        });
    });
};
