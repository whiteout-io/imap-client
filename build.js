'use strict';

var browserify = require('browserify'),
    fs = require('fs'),
    path = require('path');

var b = browserify('./index.js');
b.require('./src/iconv-dummy', {
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
    var dirName,
        fileName,
        file;

    if (err) {
        throw err;
    }

    dirName = 'src-gen';
    fileName = 'imap-client-browserified.js';

    // create dir if not existant
    try {
        fs.mkdirSync(path.join(__dirname, dirName));
    } catch (e) {}

    file = path.join(__dirname, dirName, fileName);
    fs.writeFileSync(file, src);

    console.log('bundle written to: ' + file);
});