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
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/unit-test.js', 'test/local-integration-test.js']
            }
        },
        watch: {
            unit: {
                files: ['test/unit-test.js'],
                tasks: ['unit']
            },
            integration: {
                files: ['test/integration-test.js', 'test/browser-test.js'],
                tasks: ['integration']
            },
            js: {
                files: ['src/*.js'],
                tasks: ['unit']
            }
        },
        copy: {
            npm: {
                expand: true,
                flatten: true,
                cwd: 'node_modules/',
                src: [
                    'chai/chai.js',
                    'mocha/mocha.js',
                    'mocha/mocha.css',
                    'requirejs/require.js',
                    'inbox/src/*.js',
                    'inbox/node_modules/node-shims/src/*.js',
                    'inbox/node_modules/node-shims/node_modules/node-forge/js/*.js',
                    'inbox/node_modules/utf7/src/utf7.js',
                    'inbox/node_modules/xoauth2/src/xoauth2.js',
                    'mimelib/src/mimelib.js',
                    'mimelib/node_modules/addressparser/src/addressparser.js',
                    'mimelib/node_modules/encoding/src/encoding.js',
                    'mimelib/node_modules/encoding/node_modules/iconv-lite/src/*.js',
                    'mimelib/node_modules/encoding/node_modules/mime/src/*.js',
                    'mailparser/src/*.js',
                    'mailparser/node_modules/mime/src/mime.js',
                    'setimmediate/setImmediate.js'
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
        clean: {
            test: ['test/lib/']
        }
    });

    // Load the plugin(s)
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');

    // Default task(s).
    grunt.registerTask('unit', ['jshint', 'mochaTest']);
    grunt.registerTask('integration', ['jshint', 'clean:test', 'copy']);
    grunt.registerTask('default', ['jshint', 'mochaTest', 'clean:test', 'copy']);

};