(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['browserbox'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('browserbox'));
    }
})(function(BrowserBox) {
    'use strict';

    /**
     * Create an instance of ImapClient.
     * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
     * @param {String} options.host Hostname of the server.
     * @param {Boolean} options.secure Indicates if the connection is using TLS or not
     * @param {String} options.auth.user Username for login
     * @param {String} options.auth.pass Password for login
     * @param {String} options.auth.xoauth2 xoauth2 token for login
     * @param {Boolean} options.debug (optional) Outputs all the imap traffic in the console
     * @param {Array} options.ca Array of PEM-encoded certificates that should be pinned.
     */
    var ImapClient = function(options, browserbox) {
        var self = this;

        /* Holds the login state. Inbox executes the commands you feed it, i.e. you can do operations on your inbox before a successful login. Which should of cource not be possible. So, we need to track the login state here.
         * @private */
        self._loggedIn = false;

        /* Instance of our imap library
         * @private */
        if (browserbox) {
            self._client = self._listeningClient = browserbox;
        } else {
            var credentials = {
                useSSL: options.secure,
                auth: options.auth,
                ca: options.ca
            };
            self._client = new BrowserBox(options.host, options.port, credentials);
            self._listeningClient = new BrowserBox(options.host, options.port, credentials);
        }
        self._client.onerror = self._listeningClient.onerror = function(err) {
            // the error handler is the same for both clients. if one instance
            // of browserbox fails, just shutdown the client and avoid further
            // operations
            if (self._errored) {
                return;
            }

            self._errored = true;
            self._loggedIn = false;
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

        if (options.debug) {
            self._client.onlog = self._listeningClient.onlog = console.log.bind(console);
        }
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

        // populate the cahce object for current path
        if (!self.mailboxCache[path]) {
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

            // store the new values to cache
            cached.exists = mailbox.exists;
            cached.uidNext = mailbox.uidNext;

            // list all uid values in the selected mailbox
            self.search({
                path: path,
                client: client
            }, function(err, uidlist) {
                var deltaNew, deltaDeleted;

                if (cached.uidlist) {
                    // new messages
                    if ((deltaNew = uidlist.filter(function(i) {
                        return cached.uidlist.indexOf(i) < 0;
                    })) && deltaNew.length) {
                        self.onSyncUpdate({
                            type: 'new',
                            path: path,
                            list: deltaNew
                        });
                    }

                    // deleted messages
                    if ((deltaDeleted = cached.uidlist.filter(function(i) {
                        return uidlist.indexOf(i) < 0;
                    })) && deltaDeleted.length) {
                        self.onSyncUpdate({
                            type: 'deleted',
                            path: path,
                            list: deltaDeleted
                        });
                    }
                }

                // use the uidlist as the new sequence number array
                cached.uidlist = uidlist;

                // check for changed flags
                self.checkModseq({
                    highestModseq: mailbox.highestModseq,
                    client: client
                }, function() {});
            });
        } else {
            // check for changed flags
            self.checkModseq({
                highestModseq: mailbox.highestModseq,
                client: client
            }, function() {});
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
            // a message has been deleted
            // input format: "* EXPUNGE 123" where 123 is the sequence number of the deleted message

            var deletedUid = cached.uidlist[value - 1];
            // reorder the uidlist by removing deleted item
            cached.uidlist.splice(value - 1, 1);

            if (deletedUid) {
                self.onSyncUpdate({
                    type: 'deleted',
                    path: path,
                    list: [deletedUid]
                });
            }
        } else if (type === 'exists') {
            // there might be new messages (or something was deleted) as the message count in the mailbox has changed
            // input format: "* EXISTS 123" where 123 is the count of messages in the mailbox
            cached.exists = value;
            self.search({
                path: client.selectedMailbox,
                // search for messages with higher UID than last known uidNext
                uid: cached.uidNext + ':*',
                client: client
            }, function(err, uidlist) {
                if (err) {
                    return;
                }

                // if we do not find anything or the returned item was already known then return
                // if there was no new messages then we get back a single element array where the element
                // is the message with the highest UID value ('*' -> highest UID)
                // ie. if the largest UID in the mailbox is 100 and we search for 123:* then the query is
                // translated to 100:123 as '*' is 100 and this matches the element 100 that we already know about
                if (!uidlist.length || (uidlist.length === 1 && cached.uidlist.indexOf(uidlist[0]) >= 0)) {
                    return;
                }

                // update cahced uid list
                cached.uidlist = cached.uidlist.concat(uidlist);
                // predict the next UID, might not be the actual value set by the server
                cached.uidNext = cached.uidlist[cached.uidlist.length - 1] + 1;

                self.onSyncUpdate({
                    type: 'new',
                    path: path,
                    list: uidlist
                });
            });
        } else if (type === 'fetch') {
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
            return callback(null, []);
        }

        var cached = self.mailboxCache[path];

        // only do this when we actually do have a last know change number
        if (cached && cached.highestModseq && cached.highestModseq !== highestModseq) {
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
        var self = this,
            authCount = 0;

        if (self._loggedIn) {
            callback(new Error('Already logged in!'));
            return;
        }

        function onauth() {
            authCount++;

            if (authCount >= 2) {
                self._loggedIn = true;
                callback();
            }
        }

        self._listeningClient.onauth = onauth;
        self._client.onauth = onauth;

        self._listeningClient.connect();
        self._client.connect();
    };

    /**
     * Log out of the current IMAP session
     */
    ImapClient.prototype.logout = function(callback) {
        var self = this,
            closeCount = 0;

        if (!self._loggedIn) {
            callback(new Error('Can not log out, cause: Not logged in!'));
            return;
        }

        function onclose() {
            closeCount++;

            if (closeCount >= 2) {
                self._loggedIn = false;
                callback();
            }
        }


        self._listeningClient.onclose = onclose;
        self._client.onclose = onclose;

        self._listeningClient.close();
        self._client.close();
    };

    /**
     * Starts listening for updates on a specific IMAP folder, calls back when a change occurrs,
     * or includes information in case of an error
     * @param {String} options.path The path to the folder to subscribe to
     * @param {String} callback The callback when a change in the mailbox occurs
     */
    ImapClient.prototype.listenForChanges = function(options, callback) {
        this._listeningClient.selectMailbox(options.path, callback);
    };

    ImapClient.prototype.selectMailbox = function(options, callback) {
        if (this._client.selectedMailbox !== options.path) {
            this._client.selectMailbox(options.path, callback);
        }
    };

    /**
     * Provides the well known folders: Drafts, Sent, Inbox, Trash, Flagged, etc. No-op if not logged in.
     * @param {Function} callback(error, folders) will be invoked as soon as traversal is done;
     */
    ImapClient.prototype.listWellKnownFolders = function(callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not list well known folders, cause: Not logged in!'));
            return;
        }

        var wellKnownFolders = {
            other: []
        };

        self._client.listMailboxes(function(error, mailbox) {
            if (error) {
                callback(error);
                return;
            }

            walkMailbox(mailbox);

            callback(null, wellKnownFolders);
        });

        function walkMailbox(mailbox) {
            if (mailbox.name && mailbox.path) {
                var folder = {
                    name: mailbox.name,
                    path: mailbox.path
                };

                if (mailbox.name.toUpperCase() === 'INBOX') {
                    folder.type = 'Inbox';
                    wellKnownFolders.inbox = folder;
                } else if (mailbox.specialUse === '\\Drafts' || mailbox.flags.indexOf('\\Drafts') >= 0) {
                    folder.type = 'Drafts';
                    wellKnownFolders.drafts = folder;
                } else if (mailbox.specialUse === '\\All' || mailbox.flags.indexOf('\\All') >= 0) {
                    folder.type = 'All';
                    wellKnownFolders.all = folder;
                } else if (mailbox.specialUse === '\\Flagged' || mailbox.flags.indexOf('\\Flagged') >= 0) {
                    folder.type = 'Flagged';
                    wellKnownFolders.flagged = folder;
                } else if (mailbox.specialUse === '\\Sent' || mailbox.flags.indexOf('\\Sent') >= 0) {
                    folder.type = 'Sent';
                    wellKnownFolders.sent = folder;
                } else if (mailbox.specialUse === '\\Trash' || mailbox.flags.indexOf('\\Trash') >= 0) {
                    folder.type = 'Trash';
                    wellKnownFolders.trash = folder;
                } else if (mailbox.specialUse === '\\Junk' || mailbox.flags.indexOf('\\Junk') >= 0) {
                    folder.type = 'Junk';
                    wellKnownFolders.junk = folder;
                } else if (mailbox.specialUse === '\\Archive' || mailbox.flags.indexOf('\\Archive') >= 0) {
                    folder.type = 'Archive';
                    wellKnownFolders.archive = folder;
                } else {
                    folder.type = 'Other';
                    wellKnownFolders.other.push(folder);
                }
            }

            if (mailbox.children) {
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

        // initial request to XOR the following properties
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

        if (client.selectedMailbox !== options.path) {
            client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                callback(error);
                return;
            }

            client.search(query, queryOptions, callback);
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

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.listMessages(interval, query, queryOptions, onList);
        }

        // process what inbox returns into a usable form for our client
        function onList(error, messages) {
            if (error) {
                callback(error);
                return;
            }

            // we rely on those parameters, everything else can be recovered from
            messages = messages.filter(function(message) {
                return message.uid && message.envelope['message-id'];
            });

            var cleansedMessages = [];
            messages.forEach(function(message) {
                // construct a cleansed message object

                var references = (message['body[header.fields (references)]'] || '').replace(/^references:\s*/i, '').trim();

                var cleansed = {
                    uid: message.uid,
                    id: message.envelope['message-id'].replace(/[<>]/g, ''),
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
                    bodystructure: message.bodystructure || {},
                    bodyParts: []
                };

                walkMimeTree(cleansed.bodystructure, cleansed);
                cleansed.encrypted = cleansed.bodyParts.filter(function(bodyPart) {
                    return bodyPart.type === 'encrypted';
                }).length > 0;
                cleansed.signed = cleansed.bodyParts.filter(function(bodyPart) {
                    return bodyPart.type === 'signed';
                }).length > 0;

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
            if (bodyPart.partNumber === '') {
                query.push('body.peek[]');
            } else {
                query.push('body.peek[' + bodyPart.partNumber + '.mime]');
                query.push('body.peek[' + bodyPart.partNumber + ']');
            }
        });

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        // open the mailbox and retrieve the message
        function onMailboxSelected(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.listMessages(interval, query, queryOptions, onPartsReady);
        }

        function onPartsReady(error, messages) {
            if (error) {
                callback(error);
                return;
            }

            var message = messages[0];
            bodyParts.forEach(function(bodyPart) {
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

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
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
                callback(error);
                return;
            }

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

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                callback(error);
                return;
            }


            self._client.moveMessages(interval, options.destination, queryOptions, callback);
        }
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

        if (self._client.selectedMailbox !== options.path) {
            self._client.selectMailbox(options.path, onMailboxSelected);
        } else {
            onMailboxSelected();
        }

        function onMailboxSelected(error) {
            if (error) {
                callback(error);
                return;
            }


            self._client.deleteMessages(interval, queryOptions, callback);
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

    var mimeTreeMatchers = [matchEncrypted, matchSigned, matchText, matchHtml, matchAttachment];

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

    return ImapClient;
});