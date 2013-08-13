'use strict';

var inbox = require('inbox'),
    MailParser = require('mailparser').MailParser,
    ImapClient;

/**
 * Create an instance of ImapClient
 * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
 * @param {String} options.host Hostname of the server.
 * @param {Boolean} options.secure Indicates if the connection is using TLS or not
 * @param {String} options.host.auth.user Username for login
 * @param {String} options.host.auth.pass Password for login
 */
ImapClient = function(options) {
    var self = this;

    self._client = inbox.createConnection(options.port, options.host, {
        secureConnection: options.secure,
        auth: options.auth
    });
    self._parser = new MailParser();
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
 * @param options.folder [String] The folder name
 * @param options.offset [String] The offset where to start reading. Positive offsets count from the beginning, negative offset count from the tail.
 * @param options.length [String] Indicates how many messages you want to read
 * @param callback [Function] callback(error, messages) triggered when the messages are available.
 */
ImapClient.prototype.listMessages = function(options, callback) {
    var self = this;

    self._client.openMailbox(options.folder, {
        readOnly: true
    }, function() {
        self._client.listMessages(options.offset, options.length, callback);
    });
};

/**
 * Get a certain message from the server.
 * @param options.folder [String] The folder name
 * @param options.uid [Number] The uid of the message
 * @param callback [Function] callback(message) will be called the the message is ready;
 */
ImapClient.prototype.getMessage = function(options, callback) {
    var self = this;

    self._client.openMailbox(options.folder, {
        readOnly: false
    }, function() {
        self._parser.on('end', callback);
        self._client.createMessageStream(options.uid).pipe(self._parser);
    });
};

// export node module
module.exports.ImapClient = ImapClient;
// export module into global scope for use in a require.js shim
if (typeof window !== 'undefined') {
    window.ImapClient = ImapClient;
}