if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {
    'use strict';

    var MailParser = require('mailparser').MailParser,
        parser = {};

    parser.parse = function(raw, cb) {
        var mp = new MailParser();

        mp.on('end', function(email) {
            var attachments;

            //the browser can't clone node-buffer from the worker, so let's create typed arrays
            if (email.attachments instanceof Array && email.attachments.length > 0) {
                attachments = [];
                email.attachments.forEach(function(attachment) {
                    attachments.push({
                        fileName: attachment.generatedFileName,
                        contentType: attachment.contentType,
                        uint8Array: bufferToTypedArray(attachment.content)
                    });
                });
                email.attachments = attachments;
            }

            cb(email);
        });
        mp.end(raw);
    };


    function bufferToTypedArray(buffer) {
        var ab = new ArrayBuffer(buffer.length);
        var view = new Uint8Array(ab);
        for (var i = 0, len = buffer.length; i < len; i++) {
            view[i] = buffer.readUInt8(i);
        }
        return view;
    }

    return parser;
});