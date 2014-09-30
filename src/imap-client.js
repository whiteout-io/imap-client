(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['browserbox', 'axe'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('browserbox'), require('axe-logger'));
    }
})(function(BrowserBox, axe) {
    'use strict';

    var DEBUG_TAG = 'imap-client';

    /**
     * Create an instance of ImapClient.
     * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
     * @param {String} options.host Hostname of the server.
     * @param {Boolean} options.secure Indicates if the connection is using TLS or not
     * @param {String} options.auth.user Username for login
     * @param {String} options.auth.pass Password for login
     * @param {String} options.auth.xoauth2 xoauth2 token for login
     * @param {Array} options.ca Array of PEM-encoded certificates that should be pinned.
     * @param {Number} options.maxUpdateSize (optional) The maximum number of messages to receive in an onSyncUpdate of type "new". 0 = all messages. Defaults to 0.
     */
    var ImapClient = function(options, browserbox) {
        var self = this;

        /* Holds the login state. Inbox executes the commands you feed it, i.e. you can do operations on your inbox before a successful login. Which should of cource not be possible. So, we need to track the login state here.
         * @private */
        self._loggedIn = false;

        self._maxUpdateSize = Math.abs(options.maxUpdateSize || 0);

        /* Instance of our imap library
         * @private */
        if (browserbox) {
            self._client = self._listeningClient = browserbox;
        } else {
            var credentials = {
                useSecureTransport: options.secure,
                ignoreTLS: options.ignoreTLS,
                auth: options.auth,
                ca: options.ca
            };
            self._client = new BrowserBox(options.host, options.port, credentials);
            self._listeningClient = new BrowserBox(options.host, options.port, credentials);
        }

        self._client.oncert = self._listeningClient.oncert = function(certificate) {
            self.onCert(certificate);
        };

        self._client.onerror = self._listeningClient.onerror = function(err) {
            // the error handler is the same for both clients. if one instance
            // of browserbox fails, just shutdown the client and avoid further
            // operations

            axe.error(DEBUG_TAG, 'error in imap connection, disconnecting! error: ' + err + '\n' + err.stack);

            if (self._errored) {
                return;
            }

            self._errored = true;
            self._loggedIn = false;
            self._listenerLoggedIn = false;
            self._listeningClient.close();
            self._client.close();

            self.onError(err);
        };

        /**
         * Cache object with the following structure:
         *
         *  {
         *      "INBOX": {
         *          exists: 5,
         *          uidNext: 6,
         *          uidlist: [1, 2, 3, 4, 5],
         *          highestModseq: 555
         *      }
         *  }
         *
         * @type {Object}
         */
        self.mailboxCache = {};

        self._client.onselectmailbox = self._onSelectMailbox.bind(self, self._client);
        self._client.onupdate = self._onUpdate.bind(self, self._client);
        self._listeningClient.onselectmailbox = self._onSelectMailbox.bind(self, self._listeningClient);
        self._listeningClient.onupdate = self._onUpdate.bind(self, self._listeningClient);
    };

    /**
     * Executed whenever 'onselectmailbox' event is emitted in BrowserBox
     *
     * @param {Object} client Listening client object
     * @param {String} path Path to currently opened mailbox
     * @param {Object} mailbox Information object for the opened mailbox
     */
    ImapClient.prototype._onSelectMailbox = function(client, path, mailbox) {
        var self = this,
            cached;

        // If both clients are currently listening the same mailbox, ignore data from listeningClient
        if (client === self._listeningClient && self._listeningClient.selectedMailbox === self._client.selectedMailbox) {
            return;
        }

        axe.debug(DEBUG_TAG, 'selected mailbox ' + path);

        // populate the cahce object for current path
        if (!self.mailboxCache[path]) {
            axe.debug(DEBUG_TAG, 'populating cache object for mailbox ' + path);
            self.mailboxCache[path] = {
                exists: 0,
                uidNext: 0,
                uidlist: []
            };
        }

        cached = self.mailboxCache[path];

        // if exists count does not match, there might be new messages
        // if exists count matches but uidNext is different, then something has been deleted and something added
        if (cached.exists !== mailbox.exists || cached.uidNext !== mailbox.uidNext) {
            axe.debug(DEBUG_TAG, 'possible updates available in ' + path + '. exists: ' + mailbox.exists + ', uidNext: ' + mailbox.uidNext);

            cached.exists = mailbox.exists;
            cached.uidNext = mailbox.uidNext;

            // list all uid values in the selected mailbox
            self.search({
                path: path,
                client: client
            }, function(err, imapUidList) {
                var deltaNew, deltaDeleted,
                    batch;

                // normalize the uidlist
                cached.uidlist = cached.uidlist || [];

                // determine deleted uids
                deltaDeleted = cached.uidlist.filter(function(i) {
                    return imapUidList.indexOf(i) < 0;
                });

                // notify about deleted messages
                if (deltaDeleted.length) {
                    axe.debug(DEBUG_TAG, 'onSyncUpdate for deleted uids in ' + path + ': ' + deltaDeleted);
                    self.onSyncUpdate({
                        type: 'deleted',
                        path: path,
                        list: deltaDeleted
                    });
                }

                // determine new uids
                deltaNew = imapUidList.filter(function(i) {
                    return cached.uidlist.indexOf(i) < 0;
                }).sort(sortNumericallyAscending);
                axe.debug(DEBUG_TAG, 'new uids in ' + path + ': ' + deltaNew);

                // notify about new messages in batches of _maxUpdateSize size
                while (deltaNew.length) {
                    batch = deltaNew.splice(0, (self._maxUpdateSize || deltaNew.length));
                    axe.debug(DEBUG_TAG, 'onSyncUpdate for deleted uids in ' + path + ': ' + batch);
                    self.onSyncUpdate({
                        type: 'new',
                        path: path,
                        list: batch
                    });
                }

                // update mailbox info
                cached.uidlist = imapUidList;

                // check for changed flags
                self.checkModseq({
                    highestModseq: mailbox.highestModseq,
                    client: client
                }, function(error) {
                    if (error) {
                        axe.error(DEBUG_TAG, 'error checking modseq: ' + error + '\n' + error.stack);
                    }
                });
            });
        } else {
            axe.debug(DEBUG_TAG, 'no changes in message count in ' + path + '. exists: ' + mailbox.exists + ', uidNext: ' + mailbox.uidNext);
            // check for changed flags
            self.checkModseq({
                highestModseq: mailbox.highestModseq,
                client: client
            }, function(error) {
                if (error) {
                    axe.error(DEBUG_TAG, 'error checking modseq: ' + error + '\n' + error.stack);
                }
            });
        }
    };

    ImapClient.prototype._onUpdate = function(client, type, value) {
        var self = this,
            path = client.selectedMailbox,
            cached = self.mailboxCache[path];

        // If both clients are currently listening the same mailbox, ignore data from listeningClient
        if (client === self._listeningClient && self._listeningClient.selectedMailbox === self._client.selectedMailbox) {
            return;
        }

        if (!cached) {
            return;
        }

        if (type === 'expunge') {
            axe.debug(DEBUG_TAG, 'expunge notice received for ' + path + ' with sequence number: ' + value);
            // a message has been deleted
            // input format: "* EXPUNGE 123" where 123 is the sequence number of the deleted message

            var deletedUid = cached.uidlist[value - 1];
            // reorder the uidlist by removing deleted item
            cached.uidlist.splice(value - 1, 1);

            if (deletedUid) {
                axe.debug(DEBUG_TAG, 'deleted uid in ' + path + ': ' + deletedUid);
                self.onSyncUpdate({
                    type: 'deleted',
                    path: path,
                    list: [deletedUid]
                });
            }
        } else if (type === 'exists') {
            axe.debug(DEBUG_TAG, 'exists notice received for ' + path + ', checking for updates');

            // there might be new messages (or something was deleted) as the message count in the mailbox has changed
            // input format: "* EXISTS 123" where 123 is the count of messages in the mailbox
            cached.exists = value;
            self.search({
                path: path,
                // search for messages with higher UID than last known uidNext
                uid: cached.uidNext + ':*',
                client: client
            }, function(err, imapUidList) {
                if (err) {
                    return;
                }

                var batch;

                // if we do not find anything or the returned item was already known then return
                // if there was no new messages then we get back a single element array where the element
                // is the message with the highest UID value ('*' -> highest UID)
                // ie. if the largest UID in the mailbox is 100 and we search for 123:* then the query is
                // translated to 100:123 as '*' is 100 and this matches the element 100 that we already know about
                if (!imapUidList.length || (imapUidList.length === 1 && cached.uidlist.indexOf(imapUidList[0]) >= 0)) {
                    return;
                }

                imapUidList.sort(sortNumericallyAscending);
                axe.debug(DEBUG_TAG, 'new uids in ' + path + ': ' + imapUidList);
                // update cahced uid list
                cached.uidlist = cached.uidlist.concat(imapUidList);
                // predict the next UID, might not be the actual value set by the server
                cached.uidNext = cached.uidlist[cached.uidlist.length - 1] + 1;

                // notify about new messages in batches of _maxUpdateSize size
                while (imapUidList.length) {
                    batch = imapUidList.splice(0, (self._maxUpdateSize || imapUidList.length));
                    axe.debug(DEBUG_TAG, 'onSyncUpdate for deleted uids in ' + path + ': ' + batch);
                    self.onSyncUpdate({
                        type: 'new',
                        path: path,
                        list: batch
                    });
                }

            });
        } else if (type === 'fetch') {
            axe.debug(DEBUG_TAG, 'fetch notice received for ' + path);

            // probably some flag updates. A message or messages have been altered in some way
            // and the server sends an unsolicited FETCH response
            // input format: "* 123 FETCH (FLAGS (\Seen))"
            // UID is probably not listed, only the sequence number
            self.onSyncUpdate({
                type: 'messages',
                path: path,
                // listed message object does not contain uid by default
                list: [value].map(function(message) {
                    if (!message.uid && cached.uidlist) {
                        message.uid = cached.uidlist[message['#'] - 1];
                    }
                    return message;
                })
            });
        }
    };

    /**
     * Lists messages with the last check
     *
     * @param {Number} options.highestModseq MODSEQ value
     * @param {Function} callback Runs when the list is fetched
     */
    ImapClient.prototype.checkModseq = function(options, callback) {
        var self = this,
            highestModseq = options.highestModseq,
            client = options.client || self._client,
            path = client.selectedMailbox;

        // do nothing if we do not have highestModseq value. it should be at least 1. if it is
        // undefined then the server does not support CONDSTORE extension
        if (!highestModseq || !path) {
            axe.info(DEBUG_TAG, 'can not check MODSEQ, server does not support CONDSTORE extension');
            return callback(null, []);
        }

        var cached = self.mailboxCache[path];

        // only do this when we actually do have a last know change number
        if (cached && cached.highestModseq && cached.highestModseq !== highestModseq) {
            axe.debug(DEBUG_TAG, 'listing changes since MODSEQ ' + highestModseq + ' for ' + path);
            client.listMessages('1:*', ['uid', 'flags', 'modseq'], {
                byUid: true,
                changedSince: cached.highestModseq
            }, function(err, messages) {
                if (err) {
                    return callback(err);
                }

                cached.highestModseq = highestModseq;

                if (!messages || !messages.length) {
                    return callback(null, []);
                }

                axe.debug(DEBUG_TAG, 'changes since MODSEQ ' + highestModseq + ' for ' + path + ' available!');
                self.onSyncUpdate({
                    type: 'messages',
                    path: path,
                    list: messages
                });
                callback(null, messages);
            });
        } else {
            return callback(null, []);
        }
    };

    /**
     * Synchronization handler
     *
     * type 'new' returns an array of UID values that are new messages
     * type 'deleted' returns an array of UID values that are deleted
     * type 'messages' returns an array of message objects that are somehow updated
     *
     * @param {Object} options Notification options
     * @param {String} options.type Type of the update
     * @param {Array} options.list List of uids/messages
     * @param {String} options.path Selected mailbox
     */
    ImapClient.prototype.onSyncUpdate = function( /* options */ ) {
        this.onError(new Error('Sync handler not set'));
    };

    /**
     * Log in to an IMAP Session. No-op if already logged in.
     *
     * @param {Function} callback Callback when the login was successful
     */
    ImapClient.prototype.login = function(callback) {
        var self = this;

        if (self._loggedIn) {
            axe.debug(DEBUG_TAG, 'refusing login while already logged in!');
            return callback();
        }

        self._client.onauth = function() {
            axe.debug(DEBUG_TAG, 'login completed, ready to roll!');
            self._loggedIn = true;
            callback();
        };

        self._client.connect();
    };

    /**
     * Log out of the current IMAP session
     */
    ImapClient.prototype.logout = function(callback) {
        var self = this;

        if (!self._loggedIn) {
            axe.debug(DEBUG_TAG, 'refusing logout while already logged out!');
            return callback();
        }

        self._client.onclose = function() {
            axe.debug(DEBUG_TAG, 'logout completed, kthxbye!');
            self._loggedIn = false;
            callback();
        };

        self._client.close();
    };

    /**
     * Starts dedicated listener for updates on a specific IMAP folder, calls back when a change occurrs,
     * or includes information in case of an error
     
     * @param {String} options.path The path to the folder to subscribe to
     * @param {String} callback(err) Invoked when listening folder has been selected, or an error occurred
     */
    ImapClient.prototype.listenForChanges = function(options, callback) {
        var self = this;

        if (self._listenerLoggedIn) {
            axe.debug(DEBUG_TAG, 'refusing login listener while already logged in!');
            return callback();
        }

        self._listeningClient.onauth = function() {
            axe.debug(DEBUG_TAG, 'listener login completed, ready to roll!');
            self._listenerLoggedIn = true;
            axe.debug(DEBUG_TAG, 'listening for changes in ' + options.path);
            self._listeningClient.selectMailbox(options.path, callback);
        };
        self._listeningClient.connect();
    };

    /**
     * Stops dedicated listener for updates
     *
     * @param {String} callback(err) Invoked when listenerstopped, or an error occurred
     */
    ImapClient.prototype.stopListeningForChanges = function(callback) {
        var self = this;

        if (!self._listenerLoggedIn) {
            axe.debug(DEBUG_TAG, 'refusing logout listener already logged out!');
            return callback();
        }

        self._listeningClient.onclose = function() {
            axe.debug(DEBUG_TAG, 'logout completed, kthxbye!');
            self._listenerLoggedIn = false;
            callback();
        };
        self._listeningClient.close();
    };

    ImapClient.prototype.selectMailbox = function(options, callback) {
        if (this._client.selectedMailbox !== options.path) {
            axe.debug(DEBUG_TAG, 'selecting mailbox ' + options.path);
            this._client.selectMailbox(options.path, callback);
        }
    };

    /**
     * Provides the well known folders: Drafts, Sent, Inbox, Trash, Flagged, etc. No-op if not logged in.
     * Since there may actually be multiple sent folders (e.g. one is default, others were created by Thunderbird,
     * Outlook, another accidentally matched the naming), we return the well known folders as an array to avoid false positives.
     *
     * @param {Function} callback(error, folders) will be invoked as soon as traversal is done;
     */
    ImapClient.prototype.listWellKnownFolders = function(callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not list well known folders, cause: Not logged in!'));
            return;
        }

        axe.debug(DEBUG_TAG, 'listing folders');

        var wellKnownFolders = {
            Inbox: [],
            Drafts: [],
            All: [],
            Flagged: [],
            Sent: [],
            Trash: [],
            Junk: [],
            Archive: [],
            Other: []
        };

        self._client.listMailboxes(function(error, mailbox) {
            if (error) {
                axe.error(DEBUG_TAG, 'error listing folders: ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            axe.debug(DEBUG_TAG, 'folder list received!');

            walkMailbox(mailbox);
            callback(null, wellKnownFolders);
        });

        function walkMailbox(mailbox) {
            if (mailbox.path && (mailbox.flags || []).indexOf("\\Noselect") === -1) {
                // only list mailboxes here that have a path and are selectable
                axe.debug(DEBUG_TAG, 'name: ' + mailbox.name + ', path: ' + mailbox.path + (mailbox.flags ? (', flags: ' + mailbox.flags) : '') + (mailbox.specialUse ? (', special use: ' + mailbox.specialUse) : ''));

                var folder = {
                    name: mailbox.name || mailbox.path,
                    path: mailbox.path
                };

                if (folder.name.toUpperCase() === 'INBOX') {
                    folder.type = 'Inbox';
                    wellKnownFolders.Inbox.push(folder);
                } else if (mailbox.specialUse === '\\Drafts') {
                    folder.type = 'Drafts';
                    wellKnownFolders.Drafts.push(folder);
                } else if (mailbox.specialUse === '\\All') {
                    folder.type = 'All';
                    wellKnownFolders.All.push(folder);
                } else if (mailbox.specialUse === '\\Flagged') {
                    folder.type = 'Flagged';
                    wellKnownFolders.Flagged.push(folder);
                } else if (mailbox.specialUse === '\\Sent') {
                    folder.type = 'Sent';
                    wellKnownFolders.Sent.push(folder);
                } else if (mailbox.specialUse === '\\Trash') {
                    folder.type = 'Trash';
                    wellKnownFolders.Trash.push(folder);
                } else if (mailbox.specialUse === '\\Junk') {
                    folder.type = 'Junk';
                    wellKnownFolders.Junk.push(folder);
                } else if (mailbox.specialUse === '\\Archive') {
                    folder.type = 'Archive';
                    wellKnownFolders.Archive.push(folder);
                } else {
                    folder.type = 'Other';
                    wellKnownFolders.Other.push(folder);
                }
            }

            if (mailbox.children) {
                // walk the child mailboxes recursively
                mailbox.children.forEach(walkMailbox);
            }
        }
    };

    /**
     * Returns the uids of messages containing the search terms in the options
     * @param {String} options.path The folder's path
     * @param {Boolean} options.answered (optional) Mails with or without the \Answered flag set.
     * @param {Boolean} options.unread (optional) Mails with or without the \Seen flag set.
     * @param {Function} callback(error, uids) invoked with the uids of messages matching the search terms, or an error object if an error occurred
     */
    ImapClient.prototype.search = function(options, callback) {
        var self = this,
            client = options.client || self._client;

        if (!self._loggedIn) {
            callback(new Error('Can not search messages, cause: Not logged in!'));
            return;
        }

        var query = {},
            queryOptions = {
                byUid: true
            };

        // initial request to && (AND) the following properties
        query.all = true;

        if (options.unread === true) {
            query.unseen = true;
        } else if (options.unread === false) {
            query.seen = true;
        }

        if (options.answered === true) {
            query.answered = true;
        } else if (options.answered === false) {
            query.unanswered = true;
        }

        if (options.uid) {
            query.uid = options.uid;
        }

        axe.debug(DEBUG_TAG, 'searching in ' + options.path + ' for ' + query);

        if (client.selectedMailbox !== options.path) {
            client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                axe.error(DEBUG_TAG, 'error selecting mailbox' + options.path + ' : ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            client.search(query, queryOptions, function(error, uids) {
                if (error) {
                    axe.error(DEBUG_TAG, 'error searching mailbox: ' + error + '\n' + error.stack);
                    return callback(error);
                }

                axe.debug(DEBUG_TAG, 'searched in ' + options.path + ' for ' + query + ': ' + uids);

                callback(null, uids);
            });
        }
    };

    /**
     * List messages in an IMAP folder based on their uid
     * @param {String} options.path The folder's path
     * @param {Number} options.firstUid The uid of the first message. if omitted, defaults to 1
     * @param {Number} options.lastUid (optional) The uid of the last message. if omitted, defaults to *
     * @param {Function} callback(error, messages) will be called at completion, contains an array of messages with their respective envelope data, or information if an error occurred.
     */
    ImapClient.prototype.listMessages = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not list messages, cause: Not logged in!'));
            return;
        }

        var interval = (options.firstUid || 1) + ':' + (options.lastUid || '*'),
            query = ['uid', 'bodystructure', 'flags', 'envelope', 'body.peek[header.fields (references)]'],
            queryOptions = {
                byUid: true
            };

        // only if client has CONDSTORE capability
        if (this._client.hasCapability('CONDSTORE')) {
            query.push('modseq');
        }

        axe.debug(DEBUG_TAG, 'listing messages in ' + options.path + ' for interval ' + interval);

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                axe.error(DEBUG_TAG, 'error selecting mailbox' + options.path + ' : ' + error + '\n' + error.stack);
                callback(error);
                return;
            }
            self._client.listMessages(interval, query, queryOptions, onList);
        }

        // process what inbox returns into a usable form for our client
        function onList(error, messages) {
            if (error) {
                axe.error(DEBUG_TAG, 'error listing messages in ' + options.path + ' : ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            // a message without uid will be ignored as malformed
            messages = messages.filter(function(message) {
                if (!message.uid) {
                    axe.warn(DEBUG_TAG, 'folder ' + options.path + ' contains message without uid. message will be ignored! subject ' + message.subject + ', ' + (message.envelope.from || [])[0]);
                    return false;
                }

                return true;
            });

            var cleansedMessages = [];
            messages.forEach(function(message) {
                // construct a cleansed message object

                var references = (message['body[header.fields (references)]'] || '').replace(/^references:\s*/i, '').trim();

                var cleansed = {
                    uid: message.uid,
                    id: (message.envelope['message-id'] || '').replace(/[<>]/g, ''),
                    from: message.envelope.from || [],
                    replyTo: message.envelope['reply-to'] || [],
                    to: message.envelope.to || [],
                    cc: message.envelope.cc || [],
                    bcc: message.envelope.bcc || [],
                    modseq: message.modseq || 0,
                    subject: message.envelope.subject || '(no subject)',
                    inReplyTo: (message.envelope['in-reply-to'] || '').replace(/[<>]/g, ''),
                    references: references ? references.split(/\s+/).map(function(reference) {
                        return reference.replace(/[<>]/g, '');
                    }) : [],
                    sentDate: message.envelope.date ? new Date(message.envelope.date) : new Date(),
                    unread: (message.flags || []).indexOf('\\Seen') === -1,
                    answered: (message.flags || []).indexOf('\\Answered') > -1,
                    bodyParts: []
                };

                walkMimeTree((message.bodystructure || {}), cleansed);
                cleansed.encrypted = cleansed.bodyParts.filter(function(bodyPart) {
                    return bodyPart.type === 'encrypted';
                }).length > 0;
                cleansed.signed = cleansed.bodyParts.filter(function(bodyPart) {
                    return bodyPart.type === 'signed';
                }).length > 0;

                axe.debug(DEBUG_TAG, 'listing message: [uid: ' + cleansed.uid + '][encrypted: ' + cleansed.encrypted + '][signed: ' + cleansed.signed + ']');
                cleansedMessages.push(cleansed);
            });

            callback(null, cleansedMessages);
        }
    };

    /**
     * Fetches parts of a message from the imap server
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Array} options.bodyParts Parts of a message, as returned by #listMessages
     * @param {Function} callback(error, flags) will be called the body parts have been received from the server
     */
    ImapClient.prototype.getBodyParts = function(options, callback) {
        var self = this,
            query = [],
            queryOptions = {
                byUid: true
            },
            interval = options.uid + ':' + options.uid,
            bodyParts = options.bodyParts;

        if (!self._loggedIn) {
            callback(new Error('Can not get bodyParts for uid ' + options.uid + ' in folder ' + options.path + ', cause: Not logged in!'));
            return;
        }

        if (bodyParts.length === 0) {
            callback(null, bodyParts);
            return;
        }

        // formulate a query for each text part. for part 2.1 to be parsed, we need 2.1.MIME and 2.1
        bodyParts.forEach(function(bodyPart) {
            if (typeof bodyPart.partNumber === 'undefined') {
                return;
            }

            if (bodyPart.partNumber === '') {
                query.push('body.peek[]');
            } else {
                query.push('body.peek[' + bodyPart.partNumber + '.mime]');
                query.push('body.peek[' + bodyPart.partNumber + ']');
            }
        });

        if (query.length === 0) {
            callback(null, bodyParts);
            return;
        }

        axe.debug(DEBUG_TAG, 'retrieving body parts for uid ' + options.uid + ' in folder ' + options.path + ': ' + query);

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        // open the mailbox and retrieve the message
        function onMailboxSelected(error) {
            if (error) {
                axe.error(DEBUG_TAG, 'error selecting mailbox' + options.path + ' : ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            self._client.listMessages(interval, query, queryOptions, onPartsReady);
        }

        function onPartsReady(error, messages) {
            if (error) {
                axe.error(DEBUG_TAG, 'error fetching body parts for uid ' + options.uid + ' in folder ' + options.path + ': ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            axe.debug(DEBUG_TAG, 'successfully retrieved body parts for uid ' + options.uid + ' in folder ' + options.path + ': ' + query);

            var message = messages[0];
            bodyParts.forEach(function(bodyPart) {
                if (typeof bodyPart.partNumber === 'undefined') {
                    return;
                }

                if (bodyPart.partNumber === '') {
                    bodyPart.raw = message['body[]'];
                } else {
                    bodyPart.raw = message['body[' + bodyPart.partNumber + '.mime]'] + message['body[' + bodyPart.partNumber + ']'];
                }

                delete bodyPart.partNumber;
            });

            callback(null, bodyParts);
        }
    };

    /**
     * Update IMAP flags for a message with a given UID
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Boolean} options.unread (optional) Marks the message as unread
     * @param {Boolean} options.answered (optional) Marks the message as answered
     * @param {Function} callback(error, flags) will be called the flags have been received from the server
     */
    ImapClient.prototype.updateFlags = function(options, callback) {
        var self = this,
            interval = options.uid + ':' + options.uid,
            queryOptions = {
                byUid: true
            },
            queryAdd,
            queryRemove,
            remove = [],
            add = [],
            READ_FLAG = '\\Seen',
            ANSWERED_FLAG = '\\Answered';

        if (!self._loggedIn) {
            callback(new Error('Can not update flags, cause: Not logged in!'));
            return;
        }

        if (options.unread === true) {
            remove.push(READ_FLAG);
        } else if (options.unread === false) {
            add.push(READ_FLAG);
        }

        if (options.answered === true) {
            add.push(ANSWERED_FLAG);
        } else if (options.answered === true) {
            remove.push(ANSWERED_FLAG);
        }

        if (add.length === 0 && remove.length === 0) {
            callback(new Error('Empty calls are not permitted'));
            return;
        }

        queryAdd = {
            add: add
        };
        queryRemove = {
            remove: remove
        };

        axe.debug(DEBUG_TAG, 'updating flags for uid ' + options.uid + ' in folder ' + options.path + ': ' + (remove.length > 0 ? (' removing ' + remove) : '') + (add.length > 0 ? (' adding ' + add) : ''));

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                axe.error(DEBUG_TAG, 'error selecting mailbox' + options.path + ' : ' + error + '\n' + error.stack);
                onFlagsAdded(error);
            }

            if (add.length === 0) {
                onFlagsAdded(error);
            }

            self._client.setFlags(interval, queryAdd, queryOptions, onFlagsAdded);
        }

        function onFlagsAdded(error, messages) {
            if (error || remove.length === 0) {
                onFlagsRemoved(error, messages);
                return;
            }

            self._client.setFlags(interval, queryRemove, queryOptions, onFlagsRemoved);
        }

        function onFlagsRemoved(error, messages) {
            if (error) {
                axe.error(DEBUG_TAG, 'error updating flags for uid ' + options.uid + ' in folder ' + options.path + ' : ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            axe.debug(DEBUG_TAG, 'successfully updated flags for uid ' + options.uid + ' in folder ' + options.path + ': flags are ' + messages[0].flags + '. added ' + add + ' and removed ' + remove);
            callback(null, {
                unread: messages[0].flags.indexOf(READ_FLAG) === -1,
                answered: messages[0].flags.indexOf(ANSWERED_FLAG) > -1
            });
        }
    };

    /**
     * Move a message to a destination folder
     * @param {String} options.path The origin path where the message resides
     * @param {Number} options.uid The uid of the message
     * @param {String} options.destination The destination folder
     * @param {Function} callback(error) Callback with an error object in case something went wrong.
     */
    ImapClient.prototype.moveMessage = function(options, callback) {
        var self = this,
            interval = options.uid + ':' + options.uid,
            queryOptions = {
                byUid: true
            };

        if (!self._loggedIn) {
            callback(new Error('Cannot move message, cause: Not logged in!'));
            return;
        }

        axe.debug(DEBUG_TAG, 'moving uid ' + options.uid + ' from ' + options.path + ' to ' + options.destination);

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                axe.error(DEBUG_TAG, 'error selecting mailbox' + options.path + ' : ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            self._client.moveMessages(interval, options.destination, queryOptions, function(error) {
                if (error) {
                    axe.error(DEBUG_TAG, 'error moving uid ' + options.uid + ' from ' + options.path + ' to ' + options.destination + ' : ' + error + '\n' + error.stack);
                }
                axe.debug(DEBUG_TAG, 'successfully moved uid ' + options.uid + ' from ' + options.path + ' to ' + options.destination);
                callback(error);
            });
        }
    };

    /**
     * Move a message to a folder
     * @param {String} options.path The path the message should be uploaded to
     * @param {String} options.message A RFC-2822 compliant message
     * @param {Function} callback(error) Callback with an error object in case something went wrong.
     */
    ImapClient.prototype.uploadMessage = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Cannot move message, cause: Not logged in!'));
            return;
        }

        axe.debug(DEBUG_TAG, 'uploading a message of ' + options.message.length + ' bytes to ' + options.path);

        self._client.upload(options.path, options.message, function(error) {
            if (error) {
                axe.error(DEBUG_TAG, 'error uploading <' + options.message.length + '> bytes to ' + options.path + ' : ' + error + '\n' + error.stack);
            }
            axe.debug(DEBUG_TAG, 'successfully uploaded message to ' + options.path);
            callback(error);
        });
    };

    /**
     * Purges a message from a folder
     * @param {String} options.path The origin path where the message resides
     * @param {Number} options.uid The uid of the message
     * @param {Function} callback(error) Callback with an error object in case something went wrong.
     */
    ImapClient.prototype.deleteMessage = function(options, callback) {
        var self = this,
            interval = options.uid + ':' + options.uid,
            queryOptions = {
                byUid: true
            };

        if (!self._loggedIn) {
            callback(new Error('Cannot delete message, cause: Not logged in!'));
            return;
        }

        axe.debug(DEBUG_TAG, 'deleting uid ' + options.uid + ' from ' + options.path);

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                axe.error(DEBUG_TAG, 'error selecting mailbox' + options.path + ' : ' + error + '\n' + error.stack);
                callback(error);
                return;
            }

            self._client.deleteMessages(interval, queryOptions, function(error) {
                if (error) {
                    axe.error(DEBUG_TAG, 'error deleting uid ' + options.uid + ' from ' + options.path + ' : ' + error + '\n' + error.stack);
                }

                axe.debug(DEBUG_TAG, 'successfully deleted uid ' + options.uid + ' from ' + options.path);
                callback(error);
            });
        }
    };

    /*
     * Mime Tree Handling
     * ==================
     *
     * matchEncrypted, matchSigned, ... are matchers that are called on each node of the mimde tree
     * when it is being traversed in a DFS. if one of the matchers returns true, it indicates that it
     * matched respective mime node, hence there is no need to look any further down in the tree.
     *
     */

    var mimeTreeMatchers = [matchEncrypted, matchSigned, matchAttachment, matchText, matchHtml];

    /**
     * Helper function that walks the MIME tree in a dfs and calls the handlers
     * @param {Object} mimeNode The initial MIME node whose subtree should be traversed
     * @param {Object} message The initial root MIME node whose subtree should be traversed
     */
    function walkMimeTree(mimeNode, message) {
        var i = mimeTreeMatchers.length;
        while (i--) {
            if (mimeTreeMatchers[i](mimeNode, message)) {
                return;
            }
        }

        if (mimeNode.childNodes) {
            mimeNode.childNodes.forEach(function(childNode) {
                walkMimeTree(childNode, message);
            });
        }
    }

    /**
     * Matches encrypted PGP/MIME nodes
     *
     * multipart/encrypted
     * |
     * |-- application/pgp-encrypted
     * |-- application/octet-stream <-- ciphertext
     */
    function matchEncrypted(node, message) {
        var isEncrypted = /^multipart\/encrypted/i.test(node.type) && node.childNodes && node.childNodes[1];
        if (!isEncrypted) {
            return false;
        }

        message.bodyParts.push({
            type: 'encrypted',
            partNumber: node.part || '',
        });
        return true;
    }

    /**
     * Matches signed PGP/MIME nodes
     *
     * multipart/signed
     * |
     * |-- *** (signed mime sub-tree)
     * |-- application/pgp-signature
     */
    function matchSigned(node, message) {
        var c = node.childNodes;

        var isSigned = /^multipart\/signed/i.test(node.type) && c && c[0] && c[1] && /^application\/pgp-signature/i.test(c[1].type);
        if (!isSigned) {
            return false;
        }

        message.bodyParts.push({
            type: 'signed',
            partNumber: node.part || '',
        });
        return true;
    }

    /**
     * Matches non-attachment text/plain nodes
     */
    function matchText(node, message) {
        var isText = (/^text\/plain/i.test(node.type) && node.disposition !== 'attachment');
        if (!isText) {
            return false;
        }

        message.bodyParts.push({
            type: 'text',
            partNumber: node.part || ''
        });
        return true;
    }

    /**
     * Matches non-attachment text/html nodes
     */
    function matchHtml(node, message) {
        var isHtml = (/^text\/html/i.test(node.type) && node.disposition !== 'attachment');
        if (!isHtml) {
            return false;
        }

        message.bodyParts.push({
            type: 'html',
            partNumber: node.part || ''
        });
        return true;
    }

    /**
     * Matches non-attachment text/html nodes
     */
    function matchAttachment(node, message) {
        var isAttachment = (/^text\//i.test(node.type) && node.disposition) || (!/^text\//i.test(node.type) && !/^multipart\//i.test(node.type));
        if (!isAttachment) {
            return false;
        }

        var bodyPart = {
            type: 'attachment',
            partNumber: node.part || '',
            mimeType: node.type || 'application/octet-stream',
            id: node.id ? node.id.replace(/[<>]/g, '') : undefined
        };

        if (node.dispositionParameters && node.dispositionParameters.filename) {
            bodyPart.filename = node.dispositionParameters.filename;
        } else if (node.parameters && node.parameters.name) {
            bodyPart.filename = node.parameters.name;
        } else {
            bodyPart.filename = 'attachment';
        }

        message.bodyParts.push(bodyPart);
        return true;
    }

    /**
     * Compares numbers, sorts them ascending
     */
    function sortNumericallyAscending(a, b) {
        return a - b;
    }

    return ImapClient;
});