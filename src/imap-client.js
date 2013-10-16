if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {
    'use strict';

    var inbox = require('inbox'),
        parser = require('./parser'),
        mimelib = require('mimelib'),
        ImapClient;

    require('setimmediate');

    /**
     * Create an instance of ImapClient
     * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
     * @param {String} options.host Hostname of the server.
     * @param {Boolean} options.secure Indicates if the connection is using TLS or not
     * @param {String} options.auth.user Username for login
     * @param {String} options.auth.pass Password for login
     * @param {Number} options.timeout (optional) Timeout to wait for server communication
     * @param {Function} options.errorHandler(error) (optional) a global error handler, e.g. for connection issues
     */
    ImapClient = function (options, ibx) {
        var self = this;

        /* Holds the login state. Inbox executes the commands you feed it, i.e. you can do operations on your inbox before a successful login. Which should of cource not be possible. So, we need to track the login state here.
         * @private */
        self._loggedIn = false;

        /* Instance of our imap library
         * @private */
        self._client = (ibx || inbox).createConnection(options.port, options.host, {
            timeout: options.timeout,
            secureConnection: options.secure,
            auth: options.auth
        });

        if (typeof options.errorHandler !== 'undefined') {
            self._client.on('error', options.errorHandler);
        }
    };

    /**
     * Log in to an IMAP Session. No-op if already logged in.
     *
     * @param {Function} callback Callback when the login was successful
     */
    ImapClient.prototype.login = function (callback) {
        var self = this;

        if (self._loggedIn) {
            callback(new Error('Already logged in!'));
            return;
        }

        self._client.connect();
        self._client.once('connect', function () {
            self._loggedIn = true;
            callback();
        });
    };

    /**
     * Log out of the current IMAP session
     */
    ImapClient.prototype.logout = function (callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not log out, cause: Not logged in!'));
            return;
        }

        self._client.close();
        self._client.once('close', callback);
    };

    /**
     * Provides the well known folders: Drafts, Sent, Inbox, Trash, Flagged, etc. No-op if not logged in.
     * @param {Function} callback(error, folders) will be invoked as soon as traversal is done;
     */
    ImapClient.prototype.listWellKnownFolders = function (callback) {
        var self = this,
            types = {
                INBOX: 'Inbox',
                DRAFTS: 'Drafts',
                SENT: 'Sent',
                TRASH: 'Trash',
                FLAGGED: 'Flagged',
                JUNK: 'Junk',
                NORMAL: 'Normal'
            };

        if (!self._loggedIn) {
            callback(new Error('Can not list well known folders, cause: Not logged in!'));
            return;
        }

        self.listAllFolders(filterWellKnownFolders);

        function filterWellKnownFolders(error, folders) {
            if (error) {
                callback(error);
                return;
            }

            var wellKnownFolders = {}, folder, i;
            wellKnownFolders.normal = [];
            wellKnownFolders.flagged = [];
            wellKnownFolders.other = [];

            for (i = folders.length - 1; i >= 0; i--) {
                folder = {
                    name: folders[i].name,
                    type: folders[i].type,
                    path: folders[i].path
                };
                switch (folders[i].type) {
                case types.INBOX:
                    wellKnownFolders.inbox = folder;
                    break;
                case types.DRAFTS:
                    wellKnownFolders.drafts = folder;
                    break;
                case types.SENT:
                    wellKnownFolders.sent = folder;
                    break;
                case types.TRASH:
                    wellKnownFolders.trash = folder;
                    break;
                case types.JUNK:
                    wellKnownFolders.junk = folder;
                    break;
                case types.FLAGGED:
                    wellKnownFolders.flagged.push(folder);
                    break;
                case types.NORMAL:
                    wellKnownFolders.normal.push(folder);
                    break;
                default:
                    wellKnownFolders.other.push(folder);
                }
            }

            callback(null, wellKnownFolders);
        }
    };

    /**
     * Will traverse all available IMAP folders via DFS and return their paths as Array
     * @param {Function} callback(error, folders) will be invoked as soon as traversal is done;
     */
    ImapClient.prototype.listAllFolders = function (callback) {
        var self = this,
            folders = [],
            mbxQueue = [],
            error;

        if (!self._loggedIn) {
            callback(new Error('Can not list all folders, cause: Not logged in!'));
            return;
        }

        function subfolders(someError, mailboxes) {
            if (someError) {
                // we have an error, so store it and stop processing. processQueue will catch this.
                error = someError;
            } else {
                while (mailboxes.length) {
                    // add all mailboxes to the mbxQueue
                    mbxQueue.push(mailboxes.splice(0, 1)[0]);
                }
            }

            // done with this layer, process this subtree
            setImmediate(processQueue);
        }

        function processQueue() {
            var mailbox;

            if (typeof error !== 'undefined') {
                callback(error);
                return;
            }

            if (!mbxQueue.length) {
                // nothing left to process, we're done
                callback(null, folders);
                return;
            }

            mailbox = mbxQueue.splice(0, 1)[0];
            folders.push(mailbox);
            if (mailbox.hasChildren) {
                // we have reached an inner node, process the subtree
                mailbox.listChildren(subfolders);
            } else {
                // we have reached a leaf, process the next sibling
                setImmediate(processQueue);
            }
        }

        self._client.listMailboxes(subfolders);
    };

    /**
     * List available IMAP folders
     * @param {String} path [optional] If present, its subfolders will be listed
     * @param callback [Function] callback(error, mailboxes) triggered when the folders are available
     */
    ImapClient.prototype.listFolders = function (path, callback) {
        var self = this,
            args = arguments;

        if (typeof args[0] === 'function') {
            if (!self._loggedIn) {
                args[0](new Error('Can not list folders, cause: Not logged in!'));
                return;
            }
            listTopLevelFolders.bind(self)(args[0]); // called via ImapClient.listFolders(callback)
        } else if (typeof args[0] === 'string') {
            if (!self._loggedIn) {
                callback(new Error('Can not list folders, cause: Not logged in!'));
                return;
            }

            listSubFolders.bind(self)(path, callback); // called via ImapClient.listFolders(parent, callback)
        }
    };

    /*
     * This is the simple path, where we just list the top level folders and we're good
     */
    var listTopLevelFolders = function (callback) {
        var self = this;

        self._client.listMailboxes(callback);
    };

    /*
     * This path is a bit more complicated than listTopLevelFolders. Since inbox does not provide a nicer API, we'll do a
     * search along the path until we've reached the target. The folders are always declared via L0/L1/L2/..., so we just
     * track how deep we're in the IMAP folder hierarchy and look for the next nested folders there.
     */
    var listSubFolders = function (path, callback) {
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
    ImapClient.prototype.listMessages = function (options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not list messages, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, {
            readOnly: true
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.listMessages(options.offset, options.length, function (error, messages) {
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
     * Returns the number of unread messages in a folder
     * @param {String} path The folder's path
     * @param  {Function} callback(error, unreadCount) invoked with the number of unread messages, or an error object if an error occurred
     */
    ImapClient.prototype.unreadMessages = function (path, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not retrieve unread count, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(path, {
            readOnly: true
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.unreadMessages(callback);
        });
    };

    /**
     * Fetches the preview of a message from the server
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Number} options.timeout Timeout if an error occurs during the message retrieval, only relevant if options.textOnly is true
     * @param {Function} callback(error, message) will be called the message and attachments are fully parsed
     */
    ImapClient.prototype.getMessagePreview = function (options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not get message preview for uid ' + options.uid + ' in folder ' + options.path + ', cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, {
            readOnly: true
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }

            var stream, raw = '';

            stream = self._client.createStream({
                uid: options.uid,
                part: 'HEADER'
            });

            if (!stream) {
                callback(new Error('Cannot get message: No message with uid ' + options.uid + ' found!'));
                return;
            }
            stream.on('error', callback);
            stream.on('data', onData);
            stream.on('end', onEnd);

            function onData(chunk) {
                if (typeof chunk === 'undefined') {
                    return;
                }

                raw += (typeof chunk === 'string') ? chunk : chunk.toString('binary');
            }

            function onEnd(chunk) {
                onData(chunk);
                parse({
                    raw: raw,
                    nonConcurrent: true
                }, onHeader);
            }

            function onHeader(error, header) { // we received the header, now it's time to process the rest...
                var rawBody = '',
                    timeoutId,
                    timeoutFired = false;

                if (error) {
                    callback(error);
                    return;
                }

                streamBodyPart('1');
                armTimeout();

                function streamBodyPart(part) {
                    stream = self._client.createStream({
                        uid: options.uid,
                        part: part
                    });

                    stream.on('data', onBodyData);
                    stream.on('end', onBodyEnd);
                    stream.on('error', callback);
                }

                function onBodyData(chunk) {
                    disarmTimeout(); // we have received anything, so the timeout can be discarded, even if it was only an 'end' event

                    if (typeof chunk === 'undefined') {
                        return;
                    }

                    rawBody += (typeof chunk === 'string') ? chunk : chunk.toString('binary');
                }

                function onBodyEnd(chunk) {
                    if (timeoutFired) {
                        return;
                    }
                    onBodyData(chunk);

                    if (header.headers['content-type'].indexOf('multipart/mixed') > -1) {
                        if (rawBody.slice(0, 2) === '--') {
                            // the body part 1 most likely contains a nested part. start again with body part 1.1
                            rawBody = '';
                            streamBodyPart('1.1');
                            armTimeout();

                            return;
                        }
                    }

                    if (header.headers['content-transfer-encoding'] && header.headers['content-transfer-encoding'].indexOf('quoted-printable') > -1) {
                        rawBody = mimelib.decodeQuotedPrintable(rawBody);
                    }

                    informDelegate();
                }

                function armTimeout() {
                    timeoutId = setTimeout(function () {
                        timeoutFired = true;
                        informDelegate();
                    }, options.timeout ? options.timeout : 5000);
                }

                function disarmTimeout() {
                    clearTimeout(timeoutId);
                }

                function informDelegate() {
                    var emailObj = {
                        uid: options.uid,
                        id: header.messageId,
                        from: header.from,
                        to: header.to,
                        cc: header.cc,
                        bcc: header.bcc,
                        subject: header.subject,
                        body: rawBody,
                        html: false,
                        sentDate: header.date,
                        attachments: []
                    };

                    if (timeoutFired) {
                        delete emailObj.body;
                    }

                    callback(null, emailObj);
                }
            }
        });
    };

    /**
     * Fetches a full message from the server and parses it
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Function} callback(error, message) will be called the message and attachments are fully parsed
     */
    ImapClient.prototype.getMessage = function (options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not get message for uid ' + options.uid + ' in folder ' + options.path + ', cause: Not logged in!'));
            return;
        }

        self.getRawMessage(options, onRaw);

        function onRaw(error, raw) {
            if (error) {
                callback(error);
                return;
            }

            parse({
                raw: raw
            }, onMessage);
        }

        function onMessage(error, email) {
            callback(null, {
                uid: options.uid,
                id: email.messageId,
                from: email.from,
                to: email.to,
                cc: email.cc,
                bcc: email.bcc,
                subject: email.subject,
                body: email.html || email.text,
                html: !! email.html,
                sentDate: email.date,
                attachments: email.attachments
            });
        }
    };

    /**
     * Fetches a full message from the server and parses it
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Function} callback(error, message) will be called the message and attachments are fully parsed
     */
    ImapClient.prototype.getRawMessage = function (options, callback) {
        var self = this;

        self._client.openMailbox(options.path, {
            readOnly: true
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }
            var stream, raw = '';

            stream = self._client.createStream({
                uid: options.uid,
                part: false
            });

            if (!stream) {
                callback(new Error('Cannot get message: No message with uid ' + options.uid + ' found!'));
                return;
            }

            stream.on('error', callback);
            stream.on('data', onData);
            stream.on('end', onEnd);

            function onData(chunk) {
                if (typeof chunk === 'undefined') {
                    return;
                }
                raw += (typeof chunk === 'string') ? chunk : chunk.toString('binary');
            }

            function onEnd(chunk) {
                onData(chunk);
                callback(null, raw);
            }
        });
    };

    function parse(options, cb) {
        if (options.nonConcurrent || typeof window === 'undefined' || !window.Worker) {
            parser.parse(options.raw, function (parsed) {
                cb(null, parsed);
            });
            return;
        }

        var worker = new Worker('../lib/parser-worker.js');
        worker.onmessage = function (e) {
            cb(null, e.data);
        };
        worker.onerror = function (e) {
            var error = new Error('Error handling web worker: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
            console.error(error);
            cb(error);
        };

        worker.postMessage(options.raw);
    }

    /**
     * Fetches IMAP flags for a message with a given UID from the server
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Function} callback(error, flags) will be called the flags have been received from the server
     */
    ImapClient.prototype.getFlags = function (options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not get flags, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, {
            readOnly: true
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.fetchFlags(options.uid, function (error, flags) {
                if (error) {
                    callback(error);
                    return;
                }

                callback(null, {
                    unread: flags.indexOf('\\Seen') === -1,
                    answered: flags.indexOf('\\Answered') > -1
                });
            });
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
    ImapClient.prototype.updateFlags = function (options, callback) {
        var self = this,
            READ_FLAG = '\\Seen',
            ANSWERED_FLAG = '\\Answered';

        if (!self._loggedIn) {
            callback(new Error('Can not update flags, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, {
            readOnly: false
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }

            var remove = [],
                add = [];

            if (typeof options.unread !== 'undefined') {
                options.unread ? remove.push(READ_FLAG) : add.push(READ_FLAG);
            }

            if (typeof options.answered !== 'undefined') {
                options.answered ? add.push(ANSWERED_FLAG) : remove.push(ANSWERED_FLAG);
            }

            self._client.removeFlags(options.uid, remove, function (error) {
                if (error) {
                    callback(error);
                    return;
                }

                self._client.addFlags(options.uid, add, function (error, flags) {
                    callback(null, {
                        unread: flags.indexOf(READ_FLAG) === -1,
                        answered: flags.indexOf(ANSWERED_FLAG) > -1
                    });
                });
            });
        });
    };

    /**
     * Move a message to a destination folder
     * @param {String} options.path The origin path where the message resides
     * @param {Number} options.uid The uid of the message
     * @param {String} options.destination The destination folder
     * @param {Function} callback(error) Callback with an error object in case something went wrong.
     */
    ImapClient.prototype.moveMessage = function (options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Cannot move message, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, {
            readOnly: false
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.moveMessage(options.uid, options.destination, callback);
        });
    };

    /**
     * Purges a message from a folder
     * @param {String} options.path The origin path where the message resides
     * @param {Number} options.uid The uid of the message
     * @param {Function} callback(error) Callback with an error object in case something went wrong.
     */
    ImapClient.prototype.deleteMessage = function (options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Cannot delete message, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, {
            readOnly: false
        }, function (error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.deleteMessage(options.uid, callback);
        });
    };


    return ImapClient;
});