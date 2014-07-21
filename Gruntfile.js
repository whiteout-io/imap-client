module.exports = function(grunt) {
    'use strict';

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: ['*.js', 'src/*.js', 'test/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        connect: {
            dev: {
                options: {
                    port: 10000,
                    base: '.',
                    keepalive: true
                }
            }
        },

        mocha_phantomjs: {
            all: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/unit.html']
            }
        },

        mochaTest: {
            tonline: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/integration-test.js']
            },
            local: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/local-integration-test.js']
            },
            unit: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/unit-test.js']
            }
        },

        watch: {
            js: {
                files: ['src/*.js', 'test/*.js', 'test/*.html'],
                tasks: ['deps']
            }
        },

        copy: {
            npm: {
                expand: true,
                flatten: true,
                cwd: 'node_modules/',
                src: [
                    'mocha/mocha.js',
                    'mocha/mocha.css',
                    'chai/chai.js',
                    'axe/axe.js',
                    'sinon/pkg/sinon.js',
                    'requirejs/require.js',
                    'tcp-socket/src/*.js',
                    'node-forge/js/forge.min.js',
                    'browserbox/src/*.js',
                    'browserbox/node_modules/utf7/src/*.js',
                    'browserbox/node_modules/imap-handler/src/*.js',
                    'browserbox/node_modules/mimefuncs/src/*.js',
                    'browserbox/node_modules/mimefuncs/node_modules/stringencoding/dist/stringencoding.js'
                ],
                dest: 'test/lib/'
            },
            app: {
                expand: true,
                flatten: true,
                cwd: 'src/',
                src: [
                    '*.js',
                ],
                dest: 'test/lib/'
            }
        },

        clean: ['test/lib/**/*']
    });

    // Load the plugin(s)
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-mocha-phantomjs');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');

    // Default task(s).
    grunt.registerTask('deps', ['clean', 'copy']);
    grunt.registerTask('dev', ['deps', 'connect:dev']);
    grunt.registerTask('default', ['jshint', 'deps', 'mochaTest:unit', 'mocha_phantomjs', 'mochaTest:local', 'mochaTest:tonline']);
};