'use strict';

var ic = module.exports,
    inbox = require('inbox');
    // mp = require('mailparser');

ic.ImapClient = function(options) {
    var self = this;

    self._client = inbox.createConnection(options);
};

// ic.ImapClient.prototype.logout = function() {
//     // client.close();
// };

// ic.ImapClient.prototype.listFolders = function(callback) {
//     // client.listMailboxes(callback);
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