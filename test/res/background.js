'use strict';

chrome.app.runtime.onLaunched.addListener(function() {
	chrome.app.window.create('test/res/browser-test.html', {
		'bounds': {
			'width': 1024,
			'height': 650
		}
	});
});