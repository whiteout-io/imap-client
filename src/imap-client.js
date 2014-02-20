if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {
    'use strict';

    var inbox = require('inbox'),
        mime = require("mime"),
        MailParser = require('mailparser').MailParser,
        ImapClient;

    require('setimmediate');

    /**
     * Create an instance of ImapClient. To observe new mails, assign your callback to this.onIncomingMessage.
     * @param {Number} options.port Port is the port to the server (defaults to 143 on non-secure and to 993 on secure connection).
     * @param {String} options.host Hostname of the server.
     * @param {Boolean} options.secure Indicates if the connection is using TLS or not
     * @param {String} options.auth.user Username for login
     * @param {String} options.auth.pass Password for login
     * @param {Number} options.timeout (optional) Timeout to wait for server communication
     * @param {Function} options.errorHandler(error) (optional) a global error handler, e.g. for connection issues
     * @param {Array} options.ca Array of PEM-encoded certificates that should be pinned.
     */
    ImapClient = function(options, ibx) {
        var self = this;

        /* Holds the login state. Inbox executes the commands you feed it, i.e. you can do operations on your inbox before a successful login. Which should of cource not be possible. So, we need to track the login state here.
         * @private */
        self._loggedIn = false;

        /* Instance of our imap library
         * @private */
        self._client = (ibx || inbox).createConnection(options.port, options.host, {
            timeout: options.timeout,
            secureConnection: options.secure,
            auth: options.auth,
            ca: options.ca
        });
        self._client.on('new', function(message) {
            if (typeof self.onIncomingMessage === 'function') {
                message.flags = message.flags || [];
                self.onIncomingMessage({
                    uid: message.UID,
                    id: message.messageId,
                    from: [message.from],
                    to: message.to,
                    cc: message.cc,
                    bcc: message.bcc,
                    subject: message.title,
                    body: null,
                    sentDate: message.date,
                    unread: message.flags.indexOf('\\Seen') === -1,
                    answered: message.flags.indexOf('\\Answered') > -1
                });
            }
        });

        self._client.on('error', function(error) {
            self.onError(error);
        });
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

        self._client.connect();
        self._client.once('connect', function() {
            self._loggedIn = true;
            callback();
        });
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

        self._client.close();
        self._client.once('close', callback);
    };

    /**
     * Provides the well known folders: Drafts, Sent, Inbox, Trash, Flagged, etc. No-op if not logged in.
     * @param {Function} callback(error, folders) will be invoked as soon as traversal is done;
     */
    ImapClient.prototype.listWellKnownFolders = function(callback) {
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

                if (folders[i].type === types.INBOX) {
                    wellKnownFolders.inbox = folder;
                } else if (folders[i].type === types.DRAFTS) {
                    wellKnownFolders.drafts = folder;
                } else if (folders[i].type === types.SENT) {
                    wellKnownFolders.sent = folder;
                } else if (folders[i].type === types.TRASH) {
                    wellKnownFolders.trash = folder;
                } else if (folders[i].type === types.JUNK) {
                    wellKnownFolders.junk = folder;
                } else if (folders[i].type === types.FLAGGED) {
                    wellKnownFolders.flagged.push(folder);
                } else if (folders[i].type === types.NORMAL) {
                    wellKnownFolders.normal.push(folder);
                } else {
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
    ImapClient.prototype.listAllFolders = function(callback) {
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
    ImapClient.prototype.listFolders = function(path, callback) {
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
     * Returns the uids of messages containing the search terms in the options
     * @param {String} options.path The folder's path
     * @param {String} options.subject (optional) Mails containing string in the subject
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

        self._client.openMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.search(options, callback);
        });
    };

    /**
     * List messages in an IMAP folder based on their uid
     * @param {String} options.path The folder's path
     * @param {Number} options.firstUid The uid of the first message
     * @param {Number} options.lastUid (optional) The uid of the last message. if omitted, lists all availble messages
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
            if (!(node.type && node.type === 'multipart/encrypted' && node['2'])) {
                return false;
            }

            // as the standard dictates, the second child node of a multipart/encrypted node contains the pgp payload
            this.textParts.push(node['2']);
            return true;
        };

        // look for text/plain nodes that are not attachments and add them to the list of body parts. (bind to mailObj!)
        var handlePlainText = function(node) {
            if (!(node.type.indexOf('text/plain') === 0 && !node.disposition)) {
                return false;
            }

            this.textParts.push(node);
            return true;
        };

        // look for attachment nodes and add all of them to the array of attachments. (bind to mailObj!)
        var handleAttachment = function(node) {
            var self = this;

            if (!node.disposition) {
                return false;
            }

            node.disposition.forEach(function(attmt) {
                // if we have a generic content type, try to infer the mime type based on the file ending
                var mimeType = node.type;
                if (mimeType === "application/octet-stream") {
                    mimeType = mime.lookup(attmt.filename.split(".").pop().toLowerCase());
                }

                self.attachments.push({
                    filename: attmt.filename,
                    filesize: node.size,
                    mimeType: mimeType,
                    part: node.part,
                    content: null
                });
            });
            return true;
        };

        // open the mailbox
        self._client.openMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.uidListMessages(options.firstUid, options.lastUid, processHeaders);
        });

        // process what inbox returns into a usable form for our client
        function processHeaders(error, mails) {
            if (error) {
                callback(error);
                return;
            }

            var processedMails = [];
            mails.forEach(function(mail) {
                mail.flags = mail.flags || [];
                mail.messageId = mail.messageId.replace(/[<>]/g, '');

                // construct a cleansed mail object
                var processedMail = {
                    uid: mail.UID,
                    id: mail.messageId,
                    from: [mail.from],
                    to: mail.to,
                    cc: mail.cc,
                    bcc: mail.bcc,
                    subject: mail.title,
                    body: null,
                    sentDate: mail.date,
                    unread: mail.flags.indexOf('\\Seen') === -1,
                    answered: mail.flags.indexOf('\\Answered') > -1,
                    bodystructure: mail.bodystructure,
                    attachments: [],
                    textParts: []
                };

                processedMails.push(processedMail);

                // walk the mime tree to find pgp/mime nodes
                walkMimeTree(processedMail.bodystructure, handlePgpMime.bind(processedMail));
                if (processedMail.textParts.length > 0) {
                    processedMail.encrypted = true;
                    // the mail contains pgp/mime, so forget about the plain text stuff and attachments
                    return;
                }

                processedMail.encrypted = false;
                // the mail does not contain pgp/mime, so find all the plain text body parts and attachments
                walkMimeTree(processedMail.bodystructure, handlePlainText.bind(processedMail));
                walkMimeTree(processedMail.bodystructure, handleAttachment.bind(processedMail));
            });

            callback(null, processedMails);
        }
    };

    /**
     * Stream the message body from the server
     * @param {String} options.path The folder's path
     * @param {Number} options.message The message
     * @param {Function} callback(error, message) will be called the message is parsed
     */
    ImapClient.prototype.getBody = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not get message preview for uid ' + options.message.uid + ' in folder ' + options.path + ', cause: Not logged in!'));
            return;
        }

        if (options.message.textParts.length === 0) {
            // there are no plain text parts
            options.message.body = 'This message contains no text content.';
            callback(null, options.message);
            return;
        }

        self._client.openMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            // set an empty body to which text will be appended
            options.message.body = '';

            /*
             * to be able to use mailparser, we have to piece together one node of the message, e.g.
             * if the attachment is in body part 2, we cannot simply fetch body part 2, since the headers are missing.
             * however, we fetch the MIME-headers and piece them together with the payload of the body part,
             * so that mailparser can nicely parse them.
             * the flag streamingPayload is set to true when we stop streaming the headers and start streaming the
             * payload, in order to not end() the mailparser stream prematurely.
             */
            var stream, mailparser,
                streamHeader = true, // helper flag if we're streaming MIME-headers or text content
                currentTextpart; // helper flag if the MIME-headers are done

            // start streaming text parts
            streamNextPart();

            // set up the stream
            function streamNextPart() {
                // are there are more text parts left to stream?
                // if not, we're done here.
                if (options.message.textParts.length === 0 && !currentTextpart) {
                    callback(null, options.message);
                    return;
                }

                // we need to get the next body part
                if (streamHeader) {
                    currentTextpart = options.message.textParts.shift();
                    mailparser = new MailParser();
                    mailparser.on('end', function(parsed) {
                        // the mailparser parses the pgp/mime attachments, so we need to do a little extra work here
                        var text = parsed.text || parsed.attachments[0].content.toString('binary');

                        // remove the unnecessary \n and \r\n at the end of the string...
                        text = text.replace(/[\r]?\n$/g, '');

                        // the mailparser parsed the content of the text node, so let's add it to the mail body
                        options.message.body += text;

                        // the current part parsed, so let's stream the next text part
                        streamHeader = true;
                        currentTextpart = undefined;
                        streamNextPart();
                    });

                }

                stream = self._client.createStream({
                    uid: options.message.uid,
                    part: currentTextpart.part + (streamHeader ? '.MIME' : '') // according to RFC3501 the MIME headers for part '1' are '1.MIME'
                });
                stream.on('error', callback);
                stream.on('data', onData);
                stream.on('end', onEnd);
            }

            // just forward all the 'data' events to the mailparser and update attachment.progress
            function onData(chunk) {
                if (!chunk) {
                    return;
                }

                // write to mailparser                
                mailparser.write(chunk);
            }

            // do *not* forward the first 'end' event to the mailparser, we don't
            // want to close the parser stream after the headers are done.
            // this is why we can't simply pipe the streams to the parser.
            function onEnd(chunk) {
                onData(chunk);

                if (streamHeader) {
                    // we have the mime header, now stream the attachment's raw payload
                    streamHeader = false;
                    streamNextPart();
                } else {
                    // parse the whole attachment
                    mailparser.end();
                }
            }
        });
    };

    /**
     * Parses a message
     * @param {Number} options.message The meta data of the message, as retrieved by ImapClient.listMessagesByUid()
     * @param {String} options.block The string representation of the decrypted PGP message block
     * @param {Function} callback(error, message) will be called when the message decrypted PGP message block was parsed
     */
    ImapClient.prototype.parseDecryptedMessageBlock = function(options, callback) {
        var mailparser = new MailParser(),
            message = options.message;

        mailparser.on("end", function(parsed) {
            message.body = parsed.text ? parsed.text : '';
            if (parsed.attachments) {
                parsed.attachments.forEach(function(attmt) {
                    message.attachments.push({
                        filename: attmt.generatedFileName,
                        filesize: attmt.length,
                        mimeType: attmt.contentType,
                        content: bufferToTypedArray(attmt.content)
                    });
                });
            }
            callback(null, message);
        });
        mailparser.end(options.block);
    };

    /**
     * Streams an attachment from the server
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Object} options.attachment Attachment to fetch, as return in the array by ImapClient.getMessage(). A field 'content' and 'progress' is added during parsing
     * @param {Function} callback(error, attachment) will be called the message is parsed
     */
    ImapClient.prototype.getAttachment = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not get attachment, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            /*
             * to be able to use mailparser, we have to piece together one node of the message, e.g.
             * if the attachment is in body part 2, we cannot simply fetch body part 2, since the headers are missing.
             * however, we fetch the MIME-headers and piece them together with the payload of the body part,
             * so that mailparser can nicely parse them.
             * the flag streamingPayload is set to true when we stop streaming the headers and start streaming the
             * payload, in order to not end() the mailparser stream prematurely.
             */
            var stream, mailparser,
                bytesRead = 0,
                progress, // helper to update attachment.progress 
                streamingPayload = false; // helper flag if the MIME-headers are done

            mailparser = new MailParser();
            mailparser.on("end", function(parsed) {
                options.attachment.content = bufferToTypedArray(parsed.attachments[0].content);
                callback(null, options.attachment);
            });

            // set the progress flag for the attachment
            options.attachment.progress = 0;

            // stream the attachment's MIME-header first
            streamAttachmentPart(options.attachment.part + '.MIME');

            // set up the streams
            function streamAttachmentPart(part) {
                stream = self._client.createStream({
                    uid: options.uid,
                    part: part
                });
                stream.on('error', callback);
                stream.on('data', onData);
                stream.on('end', onEnd);
            }

            // just forward all the 'data' events to the mailparser and update attachment.progress
            function onData(chunk) {
                if (!chunk) {
                    return;
                }

                // write to mailparser                
                mailparser.write(chunk);

                // update attachment.progress
                if (streamingPayload) {
                    bytesRead += chunk.length;
                    progress = bytesRead / options.attachment.filesize;
                    progress = progress <= 1 ? progress : 1;
                    options.attachment.progress = progress;
                }
            }

            // do *not* forward the first 'end' event to the mailparser, we don't
            // want to close the parser stream after the headers are done.
            // this is why we can't simply pipe the streams to the parser.
            function onEnd(chunk) {
                onData(chunk);

                if (!streamingPayload) {
                    // we have the mime header, now stream the attachment's raw payload
                    streamingPayload = true;
                    streamAttachmentPart(options.attachment.part);
                } else {
                    // parse the whole attachment
                    mailparser.end();
                }
            }
        });
    };

    /**
     * Fetches IMAP flags for a message with a given UID from the server
     * @param {String} options.path The folder's path
     * @param {Number} options.uid The uid of the message
     * @param {Function} callback(error, flags) will be called the flags have been received from the server
     */
    ImapClient.prototype.getFlags = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Can not get flags, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.fetchFlags(options.uid, function(error, flags) {
                if (error) {
                    callback(error);
                    return;
                }

                if (flags === null) {
                    callback(null, {});
                } else {
                    callback(null, {
                        unread: flags.indexOf('\\Seen') === -1,
                        answered: flags.indexOf('\\Answered') > -1
                    });
                }
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
    ImapClient.prototype.updateFlags = function(options, callback) {
        var self = this,
            READ_FLAG = '\\Seen',
            ANSWERED_FLAG = '\\Answered';

        if (!self._loggedIn) {
            callback(new Error('Can not update flags, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, function(error) {
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

            self._client.removeFlags(options.uid, remove, function(error) {
                if (error) {
                    callback(error);
                    return;
                }

                self._client.addFlags(options.uid, add, function(error, flags) {
                    if (flags === true) {
                        callback(null, {});
                    } else {
                        callback(null, {
                            unread: flags.indexOf(READ_FLAG) === -1,
                            answered: flags.indexOf(ANSWERED_FLAG) > -1
                        });
                    }
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
    ImapClient.prototype.moveMessage = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Cannot move message, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, function(error) {
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
    ImapClient.prototype.deleteMessage = function(options, callback) {
        var self = this;

        if (!self._loggedIn) {
            callback(new Error('Cannot delete message, cause: Not logged in!'));
            return;
        }

        self._client.openMailbox(options.path, function(error) {
            if (error) {
                callback(error);
                return;
            }

            self._client.deleteMessage(options.uid, callback);
        });
    };

    //
    // Helper Methods
    //

    /**
     * Turns a node-style buffer into a typed array
     * @param  {Buffer} buffer A node-style buffer
     * @return {Uint8Array}    Uint8Array view on the ArrayBuffer
     */
    function bufferToTypedArray(buffer) {
        var ab = new ArrayBuffer(buffer.length),
            view = new Uint8Array(ab),
            i, len;

        for (i = 0, len = buffer.length; i < len; i++) {
            view[i] = buffer.readUInt8(i);
        }
        return view;
    }

    /**
     * Helper function that walks the mime tree in a dfs and calls back every time it has found a node the matches the search
     * @param  {Object}   mimeNode  The initial mime-node whose subtree should be traversed
     * @param  {function} handler   Callback invoked with the current mime node. Returns true if the mime node was interesting, returns false to go deeper.
     */
    function walkMimeTree(mimeNode, handler) {
        if (handler(mimeNode)) {
            // the node was interesting, so no need to look further down the mime tree
            return;
        }

        if (mimeNode.type.indexOf('multipart/') === 0) {
            // this is a multipart/* part, we have to go deeper
            for (var i = 1; typeof mimeNode[i] !== 'undefined'; i++) {
                walkMimeTree(mimeNode[i], handler);
            }
        }
    }



    return ImapClient;
});