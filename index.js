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
    self._parser = new MailParser({
        streamAttachments: true
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
 * @param callback [Function] callback(error, mailboxes) triggered when the folders are available
 */
ImapClient.prototype.listFolders = function(callback) {
    var self = this;

    self._client.listMailboxes(callback);
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
                    sentDate: email.date
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
 * @param {Function} messageReady(error, message) will be called the message is ready
 * @param {Function} attachmentReady(error, attachment) will be called the attachment
 */
ImapClient.prototype.getMessage = function(options, messageReady, attachmentReady) {
    var self = this;

    self._client.openMailbox(options.path, {
        readOnly: false
    }, function() {
        self._parser.on('end', function(email) {
            var mail;
            if (!messageReady) {
                return;
            }

            mail = {
                sentDate: email.headers.date,
                id: email.messageId,
                from: email.from,
                to: email.to,
                cc: email.cc,
                bcc: email.bcc,
                subject: email.subject,
                body: email.text,
            };
            if (typeof email.attachments !== 'undefined') {
                mail.attachments = email.attachments;
            }

            messageReady(null, mail);
        });

        self._parser.on('attachment', function(attachment) {
            var buffers = [];
            attachment.stream.on('data', function(chunk) {
                buffers.push(chunk.toString('binary'));
            });

            attachment.stream.on('end', function() {
                var length = 0,
                    offset = 0;

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
                attachmentReady(null, {
                    fileName: attachment.generatedFileName,
                    contentType: attachment.contentType,
                    uint8Array: view
                });
            });

            attachment.stream.on('error', function(error) {
                console.error('Error during retrieving attachment', error);
                attachmentReady(error);
            });
        });

        self._parser.on('error', function(error) {
            console.error('Error while recrieving message', error);
            messageReady(error);
        });

        self._client.createMessageStream(options.uid).pipe(self._parser);
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