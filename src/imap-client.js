(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['browserbox', 'mailreader'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('browserbox'), require('mailreader'));
    }
})(function(BrowserBox, mailreader) {
    'use strict';

    /**
     * Create an instance of ImapClient. To observe new mails, assign your callback to this.onIncomingMessage.
     * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
     * @param {String} options.host Hostname of the server.
     * @param {Boolean} options.secure Indicates if the connection is using TLS or not
     * @param {String} options.auth.user Username for login
     * @param {String} options.auth.pass Password for login
     * @param {Number} options.timeout (optional) Timeout to wait for server communication
     * @param {Boolean} options.debug (optional) Outputs all the imap traffic in the console
     * @param {Array} options.ca Array of PEM-encoded certificates that should be pinned.
     */
    var ImapClient = function(options, reader, browserbox) {
        /* Holds the login state. Inbox executes the commands you feed it, i.e. you can do operations on your inbox before a successful login. Which should of cource not be possible. So, we need to track the login state here.
         * @private */
        this._loggedIn = false;

        this._mailreader = reader || mailreader;

        /* Instance of our imap library
         * @private */
        if (browserbox) {
            this._client = browserbox;
        } else {
            this._client = new BrowserBox(options.host, options.port, {
                useSSL: options.secure,
                auth: options.auth,
                ca: options.ca
            });
        }
        this._client.onerror = function(err) {
            this.onError(err);
        }.bind(this);

        if (options.debug) {
            this._client.onlog = console.log;
        }
    };

    /**
     * Log in to an IMAP Session. No-op if already logged in.
     *
     * @param {Function} callback Callback when the login was successful
     */
    ImapClient.prototype.login = function(callback) {
        var self = this;

        if (self._loggedIn) {
            callback(new Error('Already logged in!'));
            return;
        }

        self._client.onauth = function() {
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
            callback(new Error('Can not log out, cause: Not logged in!'));
            return;
        }

        self._client.onclose = function() {
            self._loggedIn = false;
            callback();
        };

        self._client.close();
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
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not list messages, cause: Not logged in!'));
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

        self._client.selectMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.search(query, queryOptions, callback);
        });
    };

    /**
     * List messages in an IMAP folder based on their uid
     * @param {String} options.path The folder's path
     * @param {Number} options.firstUid The uid of the first message. if omitted, defaults to 1
     * @param {Number} options.lastUid (optional) The uid of the last message. if omitted, defaults to *
     * @param {Function} callback(error, messages) will be called at completion, contains an array of messages with their respective envelope data, or information if an error occurred.
     */
    ImapClient.prototype.listMessagesByUid = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not list messages, cause: Not logged in!'));
            return;
        }

        // 
        // matchers for the mime tree
        // 
        // note: i did not put them in the forEach loop because re-declaring them in each iteration seems redundant.
        // 

        // look for nodes that contain well-formed pgp/mime and add them to the list of body parts. (bind to mailObj!)
        var handlePgpMime = function(node) {
            var isPgpMime = /^multipart\/encrypted/i.test(node.type) && node.childNodes && node.childNodes[1];
            if (!isPgpMime) {
                return false;
            }

            // as the standard dictates, the second child node of a multipart/encrypted node contains the pgp payload
            this.textParts.push(node.childNodes[1]);
            return true;
        };

        // look for text/plain nodes that are not attachments and add them to the list of body parts. (bind to mailObj!)
        var handlePlainText = function(node) {
            var isPlainText = (/^text\/plain/i.test(node.type) && !node.disposition);
            if (!isPlainText) {
                return false;
            }

            this.textParts.push(node);
            return true;
        };

        // look for attachment nodes and add all of them to the array of attachments. (bind to mailObj!)
        var handleAttachment = function(node) {
            var isAttachment = (/^text\//i.test(node.type) && node.disposition) || (!/^text\//i.test(node.type) && !/^multipart\//i.test(node.type));
            if (!isAttachment) {
                return false;
            }

            var attmt = {
                part: node.part,
                content: null,
                filesize: node.size || 0,
                mimeType: node.type || "application/octet-stream",
                filename: 'attachment' // placeholder, if there is a better file name, use it
            };

            if (node.dispositionParameters && node.dispositionParameters.filename) {
                attmt.filename = node.dispositionParameters.filename;
            } else if (node.parameters && node.parameters.name) {
                attmt.filename = node.parameters.name;
            }

            this.attachments.push(attmt);
            return true;
        };

        var interval = (options.firstUid || 1) + ':' + (options.lastUid || '*'),
            query = ['uid', 'bodystructure', 'flags', 'envelope'],
            queryOptions = {
                byUid: true
            };

        // open the mailbox
        self._client.selectMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.listMessages(interval, query, queryOptions, onList);
        });

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
                var cleansed = {
                    uid: message.uid,
                    id: message.envelope['message-id'].replace(/[<>]/g, ''),
                    from: message.envelope.from || [],
                    to: message.envelope.to || [],
                    cc: message.envelope.cc || [],
                    bcc: message.envelope.bcc || [],
                    subject: message.envelope.subject || '(no subject)',
                    sentDate: message.envelope.date ? new Date(message.envelope.date) : new Date(),
                    unread: (message.flags || []).indexOf('\\Seen') === -1,
                    answered: (message.flags || []).indexOf('\\Answered') > -1,
                    bodystructure: message.bodystructure || {},
                    bodyParts: [],
                    attachments: [],
                    textParts: []
                };

                cleansedMessages.push(cleansed);

                // walk the mime tree to find pgp/mime nodes
                walkBodystructure(cleansed.bodystructure, handlePgpMime.bind(cleansed));
                if (cleansed.textParts.length > 0) {
                    cleansed.encrypted = true;
                    // the message contains pgp/mime, so forget about the plain text stuff and attachments
                    return;
                }

                cleansed.encrypted = false;
                // the message does not contain pgp/mime, so find all the plain text body parts and attachments
                walkBodystructure(cleansed.bodystructure, handlePlainText.bind(cleansed));
                walkBodystructure(cleansed.bodystructure, handleAttachment.bind(cleansed));
            });

            callback(null, cleansedMessages);
        }
    };

    /**
     * Stream the message body from the server
     * @param {String} options.path The folder's path
     * @param {Number} options.message The message
     * @param {Function} callback(error, message) will be called the message is parsed
     */
    ImapClient.prototype.getBody = function(options, callback) {
        var self = this,
            message = options.message;

        if (!self._loggedIn) {
            callback(new Error('Can not get message preview for uid ' + message.uid + ' in folder ' + options.path + ', cause: Not logged in!'));
            return;
        }

        if (message.textParts.length === 0) {
            // there are no plain text parts
            message.body = 'This message contains no text content.';
            callback(null, message);
            return;
        }

        self._getParts({
            path: options.path,
            uid: message.uid,
            parts: message.textParts
        }, onList);

        // we have received the part from the imap server
        function onList(error, messages) {
            if (error) {
                callback(error);
                return;
            }

            // set an empty body to which text will be appended
            message.body = '';

            // we retrieve only one message in this query, so we're only interested in the first element of the array
            var msg = messages[0],
                rawParts = [];

            // a raw part consists of its MIME header and the payload
            message.textParts.forEach(function(textPart) {
                if (textPart.part) {
                    rawParts.push(msg['body[' + textPart.part + '.mime]'] + msg['body[' + textPart.part + ']']);
                } else {
                    rawParts.push(msg['body[]']);
                }
            });

            // start parsing the raw parts one-by-one
            parseRawParts();

            function parseRawParts() {
                if (rawParts.length === 0) {
                    // we have parsed all the raw parts
                    callback(null, message);
                    return;
                }

                // parse one raw part
                var raw = rawParts.shift();
                self._mailreader.parseText({
                    message: message,
                    raw: raw
                }, parseRawParts);
            }
        }
    };

    /**
     * Streams an attachment from the server
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Object} options.attachment Attachment to fetch, as return in the array by ImapClient.getMessage(). A field 'content' is added when parsing is done
     * @param {Function} callback(error, attachment) will be called the message is parsed
     */
    ImapClient.prototype.getAttachment = function(options, callback) {
        var self = this,
            attmt = options.attachment;

        if (!self._loggedIn) {
            callback(new Error('Can not get attachment, cause: Not logged in!'));
            return;
        }

        self._getParts({
            path: options.path,
            uid: options.uid,
            parts: [attmt]
        }, onList);

        // we have received the attachment from the imap server
        function onList(error, messages) {
            if (error) {
                callback(error);
                return;
            }

            // we retrieve only one message in this query, so we're only interested in the first element of the array
            var msg = messages[0],
                raw = msg['body[' + attmt.part + '.mime]'] + msg['body[' + attmt.part + ']'];

            self._mailreader.parseAttachment({
                attachment: options.attachment,
                raw: raw
            }, callback);
        }
    };

    ImapClient.prototype._getParts = function(options, callback) {
        var self = this,
            query = [],
            queryOptions = {
                byUid: true
            },
            interval = options.uid + ':' + options.uid;

        // formulate a query for each text part. for part 2.1 to be parsed, we need 2.1.MIME and 2.1
        options.parts.forEach(function(part) {
            if (part.part) {
                query.push('body.peek[' + part.part + '.mime]');
                query.push('body.peek[' + part.part + ']');
            } else {
                query.push('body.peek[]');
            }
        });

        // open the mailbox and retrieve the message
        self._client.selectMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.listMessages(interval, query, queryOptions, callback);
        });
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
            query,
            remove = [],
            add = [],
            READ_FLAG = '\\Seen',
            ANSWERED_FLAG = '\\Answered';

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

        query = {
            add: add,
            remove: remove
        };

        if (!self._loggedIn) {
            callback(new Error('Can not update flags, cause: Not logged in!'));
            return;
        }

        self._client.selectMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.setFlags(interval, query, queryOptions, onFlags);
        });

        function onFlags(error, messages) {
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

        self._client.selectMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.moveMessages(interval, options.destination, queryOptions, callback);
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

        self._client.selectMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.deleteMessages(interval, queryOptions, callback);
        });
    };

    //
    // Helper Methods
    //

    /**
     * Helper function that walks the mime tree in a dfs and calls back every time it has found a node the matches the search
     * @param {Object} mimeNode The initial mime-node whose subtree should be traversed
     * @param {function} handler Callback invoked with the current mime node. Returns true if the mime node was interesting, returns false to go deeper.
     */
    function walkBodystructure(mimeNode, handler) {
        if (handler(mimeNode)) {
            // the node was interesting, so no need to look further down the mime tree
            return;
        }

        if (!mimeNode.childNodes) {
            return;
        }

        mimeNode.childNodes.forEach(function(childNode) {
            walkBodystructure(childNode, handler);
        });
    }

    return ImapClient;
});