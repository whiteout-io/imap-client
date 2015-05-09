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

        /*
         * Holds the login state.
         */
        self._loggedIn = false;
        self._listenerLoggedIn = false;

        /*
         * Instance of our imap library
         * (only relevant in unit test environment)
         */
        if (browserbox) {
            self._client = self._listeningClient = browserbox;
        } else {
            var credentials = {
                useSecureTransport: options.secure,
                ignoreTLS: options.ignoreTLS,
                requireTLS: options.requireTLS,
                auth: options.auth,
                ca: options.ca,
                tlsWorkerPath: options.tlsWorkerPath,
                enableCompression: true, // enable compression by default
                compressionWorkerPath: options.compressionWorkerPath
            };
            self._client = new BrowserBox(options.host, options.port, credentials);
            self._listeningClient = new BrowserBox(options.host, options.port, credentials);
        }

        /*
         * Calls the upper layer if the TLS certificate has to be updated
         */
        self._client.oncert = self._listeningClient.oncert = function(certificate) {
            self.onCert(certificate);
        };

        /**
         * Cache object with the following structure:
         *
         *  {
         *      "INBOX": {
         *          exists: 5,
         *          uidNext: 6,
         *          uidlist: [1, 2, 3, 4, 5],
         *          highestModseq: "555"
         *      }
         *  }
         *
         * @type {Object}
         */
        self.mailboxCache = {};

        self._registerEventHandlers(self._client);
        self._registerEventHandlers(self._listeningClient);
    };

    /**
     * Register the event handlers for the respective imap client
     */
    ImapClient.prototype._registerEventHandlers = function(client) {
        client.onselectmailbox = this._onSelectMailbox.bind(this, client);
        client.onupdate = this._onUpdate.bind(this, client);
        client.onclose = this._onClose.bind(this, client);
        client.onerror = this._onError.bind(this, client);
    };

    /**
     * Informs the upper layer if the main IMAP connection errors and cleans up.
     * If the listening IMAP connection fails, it only logs the error.
     */
    ImapClient.prototype._onError = function(client, err) {
        var msg = 'IMAP connection encountered an error! ' + err;

        if (client === this._client) {
            this._loggedIn = false;
            client.close();
            axe.error(DEBUG_TAG, new Error(msg));
            this.onError(new Error(msg)); // report the error
        } else if (client === this._listeningClient) {
            this._listenerLoggedIn = false;
            client.close();
            axe.warn(DEBUG_TAG, new Error('Listening ' + msg));
        }
    };

    /**
     * Informs the upper layer if the main IMAP connection has been unexpectedly closed remotely.
     * If the listening IMAP connection is closed unexpectedly, it only logs the error
     */
    ImapClient.prototype._onClose = function(client) {
        var msg = 'IMAP connection closed unexpectedly!';

        if (client === this._client && this._loggedIn) {
            this._loggedIn = false;
            axe.error(DEBUG_TAG, new Error(msg));
            this.onError(new Error(msg)); // report the error
        } else if (client === this._listeningClient && this._listenerLoggedIn) {
            this._listenerLoggedIn = false;
            axe.warn(DEBUG_TAG, new Error('Listening ' + msg));
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

        if (!self.onSyncUpdate) {
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

            var firstUpdate = cached.exists === 0;

            cached.exists = mailbox.exists;
            cached.uidNext = mailbox.uidNext;

            // list all uid values in the selected mailbox
            self.search({
                path: path,
                client: client
            }).then(function(imapUidList) {
                // normalize the uidlist
                cached.uidlist = cached.uidlist || [];

                // determine deleted uids
                var deltaDeleted = cached.uidlist.filter(function(i) {
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
                var deltaNew = imapUidList.filter(function(i) {
                    return cached.uidlist.indexOf(i) < 0;
                }).sort(sortNumericallyDescending);

                // notify about new messages
                if (deltaNew.length) {
                    axe.debug(DEBUG_TAG, 'new uids in ' + path + ': ' + deltaNew);
                    self.onSyncUpdate({
                        type: 'new',
                        path: path,
                        list: deltaNew
                    });
                }

                // update mailbox info
                cached.uidlist = imapUidList;

                if (!firstUpdate) {
                    axe.debug(DEBUG_TAG, 'no changes in message count in ' + path + '. exists: ' + mailbox.exists + ', uidNext: ' + mailbox.uidNext);
                    self._checkModseq({
                        highestModseq: mailbox.highestModseq,
                        client: client
                    }).catch(function(error) {
                        axe.error(DEBUG_TAG, 'error checking modseq: ' + error + '\n' + error.stack);
                    });
                }
            });
        } else {
            // check for changed flags
            axe.debug(DEBUG_TAG, 'no changes in message count in ' + path + '. exists: ' + mailbox.exists + ', uidNext: ' + mailbox.uidNext);
            self._checkModseq({
                highestModseq: mailbox.highestModseq,
                client: client
            }).catch(function(error) {
                axe.error(DEBUG_TAG, 'error checking modseq: ' + error + '\n' + error.stack);
            });
        }
    };

    ImapClient.prototype._onUpdate = function(client, type, value) {
        var self = this,
            path = client.selectedMailbox,
            cached = self.mailboxCache[path];

        if (!self.onSyncUpdate) {
            return;
        }

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
            }).then(function(imapUidList) {
                // if we do not find anything or the returned item was already known then return
                // if there was no new messages then we get back a single element array where the element
                // is the message with the highest UID value ('*' -> highest UID)
                // ie. if the largest UID in the mailbox is 100 and we search for 123:* then the query is
                // translated to 100:123 as '*' is 100 and this matches the element 100 that we already know about
                if (!imapUidList.length || (imapUidList.length === 1 && cached.uidlist.indexOf(imapUidList[0]) >= 0)) {
                    return;
                }

                imapUidList.sort(sortNumericallyDescending);
                axe.debug(DEBUG_TAG, 'new uids in ' + path + ': ' + imapUidList);
                // update cahced uid list
                cached.uidlist = cached.uidlist.concat(imapUidList);
                // predict the next UID, might not be the actual value set by the server
                cached.uidNext = cached.uidlist[cached.uidlist.length - 1] + 1;

                // notify about new messages
                axe.debug(DEBUG_TAG, 'new uids in ' + path + ': ' + imapUidList);
                self.onSyncUpdate({
                    type: 'new',
                    path: path,
                    list: imapUidList
                });
            }).catch(function(error) {
                axe.error(DEBUG_TAG, 'error handling exists notice: ' + error + '\n' + error.stack);
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
     * @param {String} options.highestModseq MODSEQ value
     *
     * @return {Promise}
     */
    ImapClient.prototype._checkModseq = function(options) {
        var self = this,
            highestModseq = options.highestModseq,
            client = options.client || self._client,
            path = client.selectedMailbox;

        // do nothing if we do not have highestModseq value. it should be at least 1. if it is
        // undefined then the server does not support CONDSTORE extension.
        // Yahoo supports a custom MODSEQ related extension called XYMHIGHESTMODSEQ which
        // returns HIGHESTMODSEQ value when doing SELECT but does not allow to use the CHANGEDSINCE modifier
        // or query the message MODSEQ value. Returned HIGHESTMODSEQ also happens to be a 64 bit number that
        // is larger than Number.MAX_SAFE_INTEGER so it can't be used as a numeric value. To fix errors
        // with Yahoo we double check if the CONDSTORE is listed as a capability or not as checking just
        // the highestModseq value would give us a false positive.
        if (!client.hasCapability('CONDSTORE') || !highestModseq || !path) {
            axe.info(DEBUG_TAG, 'can not check MODSEQ, server does not support CONDSTORE extension');
            return new Promise(function(resolve) {
                resolve([]);
            });
        }

        var cached = self.mailboxCache[path];

        // only do this when we actually do have a last know change number
        if (!(cached && cached.highestModseq && cached.highestModseq !== highestModseq)) {
            return new Promise(function(resolve) {
                resolve([]);
            });
        }

        var msgs = cached.uidlist.slice(-100);
        var firstUid = (msgs.shift() || '1');
        var lastUid = (msgs.pop() || '*');

        axe.debug(DEBUG_TAG, 'listing changes since MODSEQ ' + highestModseq + ' for ' + path);
        return client.listMessages(firstUid + ':' + lastUid, ['uid', 'flags', 'modseq'], {
            byUid: true,
            changedSince: cached.highestModseq
        }).then(function(messages) {
            cached.highestModseq = highestModseq;

            if (!messages || !messages.length) {
                return [];
            }

            axe.debug(DEBUG_TAG, 'changes since MODSEQ ' + highestModseq + ' for ' + path + ' available!');
            self.onSyncUpdate({
                type: 'messages',
                path: path,
                list: messages
            });

            return messages;
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error handling exists notice: ' + error + '\n' + error.stack);
        });
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
    ImapClient.prototype.onSyncUpdate = false;

    /**
     * Log in to an IMAP Session. No-op if already logged in.
     *
     * @return {Prmomise}
     */
    ImapClient.prototype.login = function() {
        var self = this;

        return new Promise(function(resolve) {
            if (self._loggedIn) {
                axe.debug(DEBUG_TAG, 'refusing login while already logged in!');
                return resolve();
            }

            self._client.onauth = function() {
                axe.debug(DEBUG_TAG, 'login completed, ready to roll!');
                self._loggedIn = true;
                resolve();
            };

            self._client.connect();
        });
    };

    /**
     * Log out of the current IMAP session
     *
     * @return {Promise}
     */
    ImapClient.prototype.logout = function() {
        var self = this;

        return new Promise(function(resolve) {
            if (!self._loggedIn) {
                axe.debug(DEBUG_TAG, 'refusing logout while already logged out!');
                return resolve();
            }

            self._client.onclose = function() {
                axe.debug(DEBUG_TAG, 'logout completed, kthxbye!');
                resolve();
            };

            self._loggedIn = false;
            self._client.close();
        });
    };

    /**
     * Starts dedicated listener for updates on a specific IMAP folder, calls back when a change occurrs,
     * or includes information in case of an error

     * @param {String} options.path The path to the folder to subscribe to
     *
     * @return {Promise}
     */
    ImapClient.prototype.listenForChanges = function(options) {
        var self = this;

        return new Promise(function(resolve, reject) {
            if (self._listenerLoggedIn) {
                axe.debug(DEBUG_TAG, 'refusing login listener while already logged in!');
                return resolve();
            }

            self._listeningClient.onauth = function() {
                axe.debug(DEBUG_TAG, 'listener login completed, ready to roll!');
                self._listenerLoggedIn = true;
                axe.debug(DEBUG_TAG, 'listening for changes in ' + options.path);
                self._listeningClient.selectMailbox(options.path).then(resolve).catch(reject);
            };
            self._listeningClient.connect();
        });
    };

    /**
     * Stops dedicated listener for updates
     *
     * @return {Promise}
     */
    ImapClient.prototype.stopListeningForChanges = function() {
        var self = this;

        return new Promise(function(resolve) {
            if (!self._listenerLoggedIn) {
                axe.debug(DEBUG_TAG, 'refusing logout listener already logged out!');
                return resolve();
            }

            self._listeningClient.onclose = function() {
                axe.debug(DEBUG_TAG, 'logout completed, kthxbye!');
                resolve();
            };

            self._listenerLoggedIn = false;
            self._listeningClient.close();
        });
    };

    ImapClient.prototype.selectMailbox = function(options) {
        axe.debug(DEBUG_TAG, 'selecting mailbox ' + options.path);
        return this._client.selectMailbox(options.path);
    };

    /**
     * Provides the well known folders: Drafts, Sent, Inbox, Trash, Flagged, etc. No-op if not logged in.
     * Since there may actually be multiple sent folders (e.g. one is default, others were created by Thunderbird,
     * Outlook, another accidentally matched the naming), we return the well known folders as an array to avoid false positives.
     *
     * @return {Promise<Array>} Array of folders
     */
    ImapClient.prototype.listWellKnownFolders = function() {
        var self = this;

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

        axe.debug(DEBUG_TAG, 'listing folders');

        return self._checkOnline().then(function() {
            return self._client.listMailboxes();
        }).then(function(mailbox) {
            axe.debug(DEBUG_TAG, 'folder list received!');
            walkMailbox(mailbox);
            return wellKnownFolders;

        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error listing folders: ' + error + '\n' + error.stack);
            throw error;
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
                    self._delimiter = mailbox.delimiter;
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
     * Creates a folder with the provided path under the personal namespace
     *
     * @param {String or Array} options.path
     *                   The folder's path. If path is a hierarchy as an array (e.g. ['foo', 'bar', 'baz'] to create foo/bar/bar),
     *                   will create a hierarchy with all intermediate folders if needed.
     * @returns {Promise<String>} Fully qualified path of the folder just created
     */
    ImapClient.prototype.createFolder = function(options) {
        var self = this,
            path = options.path,
            fullPath;

        if (!Array.isArray(path)) {
            path = [path];
        }

        return self._checkOnline().then(function() {
            // spare the check
            if (typeof self._delimiter !== 'undefined' && typeof self._prefix !== 'undefined') {
                return;
            }

            // try to get the namespace prefix and delimiter
            return self._client.listNamespaces().then(function(namespaces) {
                if (namespaces && namespaces.personal && namespaces.personal[0]) {
                    // personal namespace is available
                    self._delimiter = namespaces.personal[0].delimiter;
                    self._prefix = namespaces.personal[0].prefix.split(self._delimiter).shift();
                    return;
                }

                // no namespaces, falling back to empty prefix
                self._prefix = "";

                // if we already have the delimiter, there's no need to retrieve the lengthy folder list
                if (self._delimiter) {
                    return;
                }

                // find the delimiter by listing the folders
                return self._client.listMailboxes().then(function(response) {
                    findDelimiter(response);
                });
            });

        }).then(function() {
            if (!self._delimiter) {
                throw new Error('Could not determine delimiter for mailbox hierarchy');
            }

            if (self._prefix) {
                path.unshift(self._prefix);
            }

            fullPath = path.join(self._delimiter);

            // create path [prefix/]foo/bar/baz
            return self._client.createMailbox(fullPath);

        }).then(function() {
            return fullPath;

        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error creating folder ' + options.path + ': ' + error + '\n' + error.stack);
            throw error;
        });

        // Helper function to find the hierarchy delimiter from a client.listMailboxes() response
        function findDelimiter(mailbox) {
            if ((mailbox.path || '').toUpperCase() === 'INBOX') {
                // found the INBOX, use its hierarchy delimiter, we're done.
                self._delimiter = mailbox.delimiter;
                return;
            }

            if (mailbox.children) {
                // walk the child mailboxes recursively
                mailbox.children.forEach(findDelimiter);
            }
        }
    };

    /**
     * Returns the uids of messages containing the search terms in the options
     * @param {String} options.path The folder's path
     * @param {Boolean} options.answered (optional) Mails with or without the \Answered flag set.
     * @param {Boolean} options.unread (optional) Mails with or without the \Seen flag set.
     * @param {Array} options.header (optional) Query an arbitrary header, e.g. ['Subject', 'Foobar'], or ['X-Foo', 'bar']
     *
     * @returns {Promise<Array>} Array of uids for messages matching the search terms
     */
    ImapClient.prototype.search = function(options) {
        var self = this,
            client = options.client || self._client;

        var query = {},
            queryOptions = {
                byUid: true,
                precheck: self._ensurePath(options.path, client)
            };

        // initial request to AND the following properties
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

        if (options.header) {
            query.header = options.header;
        }

        if (options.uid) {
            query.uid = options.uid;
        }

        axe.debug(DEBUG_TAG, 'searching in ' + options.path + ' for ' + Object.keys(query).join(','));
        return self._checkOnline().then(function() {
            return client.search(query, queryOptions);
        }).then(function(uids) {
            axe.debug(DEBUG_TAG, 'searched in ' + options.path + ' for ' + Object.keys(query).join(',') + ': ' + uids);
            return uids;
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error searching ' + options.path + ': ' + error + '\n' + error.stack);
            throw error;
        });
    };

    /**
     * List messages in an IMAP folder based on their uid
     * @param {String} options.path The folder's path
     * @param {Number} options.firstUid (optional) If you want to fetch a range, this is the uid of the first message. if omitted, defaults to 1
     * @param {Number} options.lastUid (optional) The uid of the last message. if omitted, defaults to *
     * @param {Array} options.uids (optional) If used, fetched individual uids
     *
     * @returns {Promise<Array>} Array of messages with their respective envelope data.
     */
    ImapClient.prototype.listMessages = function(options) {
        var self = this;

        var query = ['uid', 'bodystructure', 'flags', 'envelope', 'body.peek[header.fields (references)]'],
            queryOptions = {
                byUid: true,
                precheck: self._ensurePath(options.path)
            },
            interval;

        if (options.uids) {
            interval = options.uids.join(',');
        } else {
            interval = (options.firstUid || 1) + ':' + (options.lastUid || '*');
        }

        // only if client has CONDSTORE capability
        if (this._client.hasCapability('CONDSTORE')) {
            query.push('modseq');
        }

        axe.debug(DEBUG_TAG, 'listing messages in ' + options.path + ' for interval ' + interval);
        return self._checkOnline().then(function() {
            return self._client.listMessages(interval, query, queryOptions);
        }).then(function(messages) {
            // a message without uid will be ignored as malformed
            messages = messages.filter(function(message) {
                return !!message.uid;
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
                    modseq: message.modseq || '0',
                    subject: message.envelope.subject || '(no subject)',
                    inReplyTo: (message.envelope['in-reply-to'] || '').replace(/[<>]/g, ''),
                    references: references ? references.split(/\s+/).map(function(reference) {
                        return reference.replace(/[<>]/g, '');
                    }) : [],
                    sentDate: message.envelope.date ? new Date(message.envelope.date) : new Date(),
                    unread: (message.flags || []).indexOf('\\Seen') === -1,
                    flagged: (message.flags || []).indexOf('\\Flagged') > -1,
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

            return cleansedMessages;
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error listing messages in ' + options.path + ': ' + error + '\n' + error.stack);
            throw error;
        });
    };

    /**
     * Fetches parts of a message from the imap server
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Array} options.bodyParts Parts of a message, as returned by #listMessages

     * @returns {Promise<Array>} Body parts that have been received from the server
     */
    ImapClient.prototype.getBodyParts = function(options) {
        var self = this,
            query = [],
            queryOptions = {
                byUid: true,
                precheck: self._ensurePath(options.path)
            },
            interval = options.uid + ':' + options.uid,
            bodyParts = options.bodyParts || [];

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
            return new Promise(function(resolve) {
                resolve(bodyParts);
            });
        }

        axe.debug(DEBUG_TAG, 'retrieving body parts for uid ' + options.uid + ' in folder ' + options.path + ': ' + query);
        return self._checkOnline().then(function() {
            return self._client.listMessages(interval, query, queryOptions);
        }).then(function(messages) {
            axe.debug(DEBUG_TAG, 'successfully retrieved body parts for uid ' + options.uid + ' in folder ' + options.path + ': ' + query);

            var message = messages[0];
            if (!message) {
                // message has been deleted while waiting for the command to return
                return bodyParts;
            }

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

            return bodyParts;
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error fetching body parts for uid ' + options.uid + ' in folder ' + options.path + ': ' + error + '\n' + error.stack);
            throw error;
        });
    };

    /**
     * Update IMAP flags for a message with a given UID
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Boolean} options.unread (optional) Marks the message as unread
     * @param {Boolean} options.answered (optional) Marks the message as answered
     * @param {Boolean} options.flagged (optional) Marks the message as answered
     *
     * @returns {Promise}
     */
    ImapClient.prototype.updateFlags = function(options) {
        var self = this,
            interval = options.uid + ':' + options.uid,
            queryOptions = {
                byUid: true,
                precheck: self._ensurePath(options.path)
            },
            queryAdd,
            queryRemove,
            remove = [],
            add = [],
            READ_FLAG = '\\Seen',
            FLAGGED_FLAG = '\\Flagged',
            ANSWERED_FLAG = '\\Answered';

        if (options.unread === true) {
            remove.push(READ_FLAG);
        } else if (options.unread === false) {
            add.push(READ_FLAG);
        }

        if (options.flagged === true) {
            add.push(FLAGGED_FLAG);
        } else if (options.flagged === false) {
            remove.push(FLAGGED_FLAG);
        }

        if (options.answered === true) {
            add.push(ANSWERED_FLAG);
        } else if (options.answered === false) {
            remove.push(ANSWERED_FLAG);
        }

        if (add.length === 0 && remove.length === 0) {
            return new Promise(function() {
                throw new Error('Can not update flags, cause: Not logged in!');
            });
        }

        queryAdd = {
            add: add
        };
        queryRemove = {
            remove: remove
        };

        axe.debug(DEBUG_TAG, 'updating flags for uid ' + options.uid + ' in folder ' + options.path + ': ' + (remove.length > 0 ? (' removing ' + remove) : '') + (add.length > 0 ? (' adding ' + add) : ''));
        return self._checkOnline().then(function() {
            return new Promise(function(resolve) {
                if (add.length > 0) {
                    resolve(self._client.setFlags(interval, queryAdd, queryOptions));
                } else {
                    resolve();
                }
            });
        }).then(function() {
            if (remove.length > 0) {
                return self._client.setFlags(interval, queryRemove, queryOptions);
            }
        }).then(function() {
            axe.debug(DEBUG_TAG, 'successfully updated flags for uid ' + options.uid + ' in folder ' + options.path + ': added ' + add + ' and removed ' + remove);
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error updating flags for uid ' + options.uid + ' in folder ' + options.path + ' : ' + error + '\n' + error.stack);
            throw error;
        });
    };

    /**
     * Move a message to a destination folder
     * @param {String} options.path The origin path where the message resides
     * @param {Number} options.uid The uid of the message
     * @param {String} options.destination The destination folder
     *
     * @returns {Promise}
     */
    ImapClient.prototype.moveMessage = function(options) {
        var self = this,
            interval = options.uid + ':' + options.uid,
            queryOptions = {
                byUid: true,
                precheck: self._ensurePath(options.path)
            };

        axe.debug(DEBUG_TAG, 'moving uid ' + options.uid + ' from ' + options.path + ' to ' + options.destination);
        return self._checkOnline().then(function() {
            return self._client.moveMessages(interval, options.destination, queryOptions);
        }).then(function() {
            axe.debug(DEBUG_TAG, 'successfully moved uid ' + options.uid + ' from ' + options.path + ' to ' + options.destination);
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error moving uid ' + options.uid + ' from ' + options.path + ' to ' + options.destination + ' : ' + error + '\n' + error.stack);
            throw error;
        });
    };

    /**
     * Move a message to a folder
     * @param {String} options.path The path the message should be uploaded to
     * @param {String} options.message A RFC-2822 compliant message
     *
     * @returns {Promise}
     */
    ImapClient.prototype.uploadMessage = function(options) {
        var self = this;

        axe.debug(DEBUG_TAG, 'uploading a message of ' + options.message.length + ' bytes to ' + options.path);
        return self._checkOnline().then(function() {
            return self._client.upload(options.path, options.message);
        }).then(function() {
            axe.debug(DEBUG_TAG, 'successfully uploaded message to ' + options.path);
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error uploading <' + options.message.length + '> bytes to ' + options.path + ' : ' + error + '\n' + error.stack);
            throw error;
        });
    };

    /**
     * Purges a message from a folder
     * @param {String} options.path The origin path where the message resides
     * @param {Number} options.uid The uid of the message
     *
     * @returns {Promise}
     */
    ImapClient.prototype.deleteMessage = function(options) {
        var self = this,
            interval = options.uid + ':' + options.uid,
            queryOptions = {
                byUid: true,
                precheck: self._ensurePath(options.path)
            };

        axe.debug(DEBUG_TAG, 'deleting uid ' + options.uid + ' from ' + options.path);
        return self._checkOnline().then(function() {
            return self._client.deleteMessages(interval, queryOptions);
        }).then(function() {
            axe.debug(DEBUG_TAG, 'successfully deleted uid ' + options.uid + ' from ' + options.path);
        }).catch(function(error) {
            axe.error(DEBUG_TAG, 'error deleting uid ' + options.uid + ' from ' + options.path + ' : ' + error + '\n' + error.stack);
            throw error;
        });
    };

    //
    // Helper methods
    //

    /**
     * Makes sure that the respective instance of browserbox is in the correct mailbox to run the command
     *
     * @param {String} path The mailbox path
     */
    ImapClient.prototype._ensurePath = function(path, client) {
        var self = this;
        client = client || self._client;

        return function(ctx, next) {
            if (client.selectedMailbox === path) {
                return next();
            }

            axe.debug(DEBUG_TAG, 'selecting mailbox ' + path);
            client.selectMailbox(path, {
                ctx: ctx
            }, next);
        };
    };

    ImapClient.prototype._checkOnline = function() {
        var self = this;

        return new Promise(function(resolve) {
            if (!self._loggedIn) {
                throw new Error('Not logged in!');
            }

            resolve();
        });
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
    function sortNumericallyDescending(a, b) {
        return b - a;
    }

    return ImapClient;
});