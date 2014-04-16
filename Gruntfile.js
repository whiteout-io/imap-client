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
            gmail: {
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
                flatten: false,
                cwd: 'node_modules/',
                src: [
                    'mocha/mocha.js',
                    'mocha/mocha.css',
                    'chai/chai.js',
                    'sinon/pkg/sinon.js',
                    'requirejs/require.js',
                    'tcp-socket/src/*.js',
                    'node-forge/js/forge.min.js',
                    'arraybuffer-slice/index.js',
                    'stringencoding/dist/*',
                    'browserbox/src/*.js',
                    'browserbox/node_modules/utf7/src/*.js',
                    'browserbox/node_modules/imap-handler/src/*.js',
                    'browserbox/node_modules/mimefuncs/src/*.js',
                    'mailreader/src/*.js',
                    'mailreader/node_modules/mimeparser/src/*.js',
                    'mailreader/node_modules/mimeparser/node_modules/addressparser/src/*.js'
                ],
                dest: 'test/lib/',
                rename: function(dest, src) {
                    if (src === 'arraybuffer-slice/index.js') {
                        // 'index.js' is obviously a good name for a polyfill. duh.
                        return dest + 'arraybuffer-slice.js';
                    }
                    return dest + '/' + src.split('/').pop();
                }
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
    grunt.registerTask('testlocal', ['jshint', 'deps', 'mochaTest:unit', 'mocha_phantomjs', 'mochaTest:local']);
    grunt.registerTask('default', ['jshint', 'deps', 'mochaTest:unit', 'mocha_phantomjs', 'mochaTest:local', 'mochaTest:gmail']);
};