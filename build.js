'use strict';

var browserify = require('browserify'),
    fs = require('fs'),
    path = require('path');

var b = browserify('./index.js');
b.require('./iconv-dummy', {
    expose: 'iconv'
});
b.require('net-chromeify', {
    expose: 'net'
});
b.require('tls-chromeify', {
    expose: 'tls'
});
b.require('browserify-mime', {
    expose: 'mime'
});

b.bundle(function(err, src) {
    if (err) {
        throw err;
    }

    var file = path.join(__dirname + '/index-browserified.js');
    fs.writeFileSync(file, src);

    console.log('bundle written to: ' + file);
});