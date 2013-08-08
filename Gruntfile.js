module.exports = function(grunt) {
	'use strict';

	// Project configuration.
	grunt.initConfig({
		jshint: {
			all: ['Gruntfile.js', 'index.js', 'test/imap-client-test.js'],
			options: {
				jshintrc: '.jshintrc'
			}
		}
	});

	// Load the plugin(s)
	grunt.loadNpmTasks('grunt-contrib-jshint');

	// Default task(s).
	grunt.registerTask('test', ['jshint']);
};