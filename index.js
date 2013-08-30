'use strict';

var inbox = require('inbox'),
    MailParser = require('mailparser').MailParser,
    ImapClient;

/**
 * Create an instance of ImapClient
 * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
 * @param {String} options.host Hostname of the server.
 * @param {Boolean} options.secure Indicates if the connection is using TLS or not
 * @param {String} options.auth.user Username for login
 * @param {String} options.auth.pass Password for login
 */
ImapClient = function(options) {
    var self = this;

    self._client = inbox.createConnection(options.port, options.host, {
        secureConnection: options.secure,
        auth: options.auth
    });
};

ImapClient.prototype.login = function(callback) {
    var self = this;

    self._client.once('connect', callback);
    self._client.connect();
};

/**
 * Log out of the current IMAP session
 */
ImapClient.prototype.logout = function(callback) {
    var self = this;

    self._client.once('close', callback);
    self._client.close();
};

/**
 * List available IMAP folders
 * @param {String} path [optional] If present, its subfolders will be listed
 * @param callback [Function] callback(error, mailboxes) triggered when the folders are available
 */
ImapClient.prototype.listFolders = function(path, callback) {
    var self = this,
        args = arguments;

    if (typeof args[0] === 'function') {
        listTopLevelFolders.bind(self)(args[0]); // called via ImapClient.listFolders(callback)
    } else if (typeof args[0] === 'string') {
        listSubFolders.bind(self)(path, callback); // called via ImapClient.listFolders(parent, callback)
    }
};

/*
 * This is the simple path, where we just list the top level folders and we're good
 */
var listTopLevelFolders = function(callback) {
    var self = this;

    self._client.listMailboxes(callback);
};

/*
 * This path is a bit more complicated than listTopLevelFolders. Since inbox does not provide a nicer API, we'll do a
 * search along the path until we've reached the target. The folders are always declared via L0/L1/L2/..., so we just
 * track how deep we're in the IMAP folder hierarchy and look for the next nested folders there.
 */
var listSubFolders = function(path, callback) {
    var self = this,
        pathComponents = path.split('/'),
        maxDepth = pathComponents.length;

    function subfolders(error, mailboxes) {
        var mailbox, mailboxPathComponents, currentDepth, i = mailboxes.length;

        if (error) {
            callback(error);
            return;
        }

        while (i--) {
            mailbox = mailboxes[i];
            mailboxPathComponents = mailbox.path.split('/');
            currentDepth = mailboxPathComponents.length;

            if (pathComponents[currentDepth - 1] !== mailboxPathComponents[currentDepth - 1]) {
                // we're on the wrong track, keep searching
                continue;
            }

            // we're on the right track
            if (currentDepth === maxDepth) {
                // we're there, let's go.
                if (mailbox.hasChildren) {
                    mailbox.listChildren(callback);
                } else {
                    // there are no children... the inbox API doc is a bit unclear about the 
                    // behavior if no children are present, also we do not want to do the
                    // roundtrip to the server again, so we call back ourselves.
                    callback(null, []);
                }
                return;
            }

            // we have to go deeper
            mailbox.listChildren(subfolders);
        }
    }

    self._client.listMailboxes(subfolders);
};

/**
 * List messages in an IMAP folder
 * @param {String} options.path The folder's path
 * @param {String} options.offset The offset where to start reading. Positive offsets count from the beginning, negative offset count from the tail.
 * @param {String} options.length Indicates how many messages you want to read
 * @param {Function} callback(error, messages) triggered when the messages are available.
 */
ImapClient.prototype.listMessages = function(options, callback) {
    var self = this;

    self._client.openMailbox(options.path, {
        readOnly: true
    }, function() {
        self._client.listMessages(options.offset, options.length, function(error, messages) {
            var i, email, emails;

            if (!callback) {
                return;
            }

            emails = [];
            i = messages.length;
            while (i--) {
                email = messages[i];
                emails.push({
                    uid: email.UID,
                    id: email.messageId,
                    from: [email.from],
                    to: email.to,
                    cc: email.cc,
                    bcc: email.bcc,
                    subject: email.title,
                    body: null,
                    sentDate: email.date,
                    unread: email.flags.indexOf('\\Seen') === -1,
                    answered: email.flags.indexOf('\\Answered') > -1
                });
            }
            callback(error, emails);
        });
    });
};

/**
 * Get a certain message from the server.
 * @param {String} options.path [String] The folder's path
 * @param {Number} options.uid The uid of the message
 * @param {Function} options.onBody(error, body) [optional] will be called when the body is parsed. The attachments are not parsed at that point.
 * @param {Function} options.onAttachment(error, attachment) [optional] will be called when an attachment has been parsed
 * @param {Function} options.onEnd(error, message) will be called the message and attachments are fully parsed
 */
ImapClient.prototype.getMessage = function(options) {
    var self = this;

    self._client.openMailbox(options.path, {
        readOnly: false
    }, function() {
        var parser, stream, headers, attachments = [];

        stream = self._client.createMessageStream(options.uid);
        if (!stream) {
            options.onEnd(new Error('Cannot get message: No message with uid ' + options.uid + ' found!'));
            return;
        }

        stream.on('error', function(e) {
            options.onEnd(e);
        });

        parser = new MailParser({
            streamAttachments: true
        });

        parser.on('end', handleEmail);
        parser.on('attachment', handleAttachment);
        parser.on('headers', handleHeaders);
        parser.on('body', handleBody);
        parser.on('error', function(e) {
            options.onEnd(e);
        });

        stream.pipe(parser);

        function handleHeaders(someHeaders) {
            headers = someHeaders;
            headers.uid = options.uid;
        }

        function handleBody(somebody) {
            var body;

            if (typeof options.onBody === 'undefined') {
                return;
            }

            body = headers ? JSON.parse(JSON.stringify(headers)) : {};
            body.html = somebody.type === 'text/html';
            body.body = somebody.content;
            body.attachments = null;
            options.onBody(null, body);
        }

        /*
         * When the parser is done, format it into out email data
         * model and invoke the onMessage callback
         */

        function handleEmail(email) {
            var mail = headers ? JSON.parse(JSON.stringify(headers)) : {};
            mail.html = !! email.html;
            mail.body = email.html || email.text;
            mail.attachments = attachments;
            options.onEnd(null, mail);
        }

        /*
         * When the parser emits 'attachment', we listen to the stream,
         * piece the attachment together and then invoke the onAttachment callback
         */

        function handleAttachment(attachment) {
            var buffers = [],
                attmt;

            if (typeof options.onAttachment === 'undefined') {
                return;
            }

            attachment.stream.on('data', function(chunk) {
                // the attachment is delivered in chunks as binary Buffers
                buffers.push(chunk.toString('binary'));
            });

            // we've reached the end of the attachment, let's piece it together and invoke the callback
            attachment.stream.on('end', function() {
                var length = 0,
                    offset = 0;

                // piece the chunks of binary Buffers together and  put them conveniently 
                // into a typed array which can be used in node and the browser alike
                buffers.forEach(function(element) {
                    length += element.length;
                });
                var buffer = new ArrayBuffer(length);
                var view = new Uint8Array(buffer);
                buffers.forEach(function(element) {
                    for (var i = 0, len = element.length; i < len; i++) {
                        view[offset + i] = element.charCodeAt(i);
                    }
                    offset += element.length;
                });

                attmt = {
                    fileName: attachment.generatedFileName,
                    contentType: attachment.contentType,
                    uint8Array: view
                };

                attachments.push(attmt);

                options.onAttachment(null, attmt);
            });

            attachment.stream.on('error', function(error) {
                console.error('Error during retrieving attachment', error);
            });
        }
    });
};

/**
 * Export module
 */
if (typeof define !== 'undefined' && define.amd) {
    // AMD
    define(['forge'], function(forge) {
        window.forge = forge;
        return ImapClient;
    });
} else if (typeof window !== 'undefined') {
    // export module into global scope
    window.ImapClient = ImapClient;
} else if (typeof module !== 'undefined' && module.exports) {
    // node.js
    module.exports.ImapClient = ImapClient;
}