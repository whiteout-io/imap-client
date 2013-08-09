'use strict';

var ic = module.exports,
    inbox = require('inbox');
    // mp = require('mailparser');

/**
 * Create an instance of ImapClient
 * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
 * @param {String} options.host Hostname of the server.
 * @param {Boolean} options.secure Indicates if the connection is using TLS or not
 * @param {String} options.host.auth.user Username for login
 * @param {String} options.host.auth.pass Password for login
 */
ic.ImapClient = function(options) {
    var self = this;

    self._client = inbox.createConnection(options.port, options.host, {
        secureConnection: options.secure,
        auth: options.auth
    });
};

ic.ImapClient.prototype.logout = function() {
    var self = this;

    self._client.close();
};

// ic.ImapClient.prototype.listFolders = function(callback) {
//     var self = this;

//     self._client.listMailboxes(callback);
// };

// ic.ImapClient.prototype.listMessages = function(options, callback) {
//     // options: folder, offset, length
//     // client.openMailbox(path[, options], callback)
//     // client.listMessages(from[, limit], callback)
// };

// ic.ImapClient.prototype.getMessage = function(uuid, callback) {
//     // mailparser = new mp.MailParser()
//     // var stream = client.createMessageStream(uid)
//     // stream.pipe(mailparser);
// };