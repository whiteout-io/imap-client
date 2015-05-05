# imap-client

High-level UMD module wrapper for [browserbox](https://github.com/whiteout-io/browserbox). This module encapsulates the most commonly used IMAP commands.

Needs ES6 Promises, [supply polyfills where necessary](https://github.com/jakearchibald/es6-promise).

## API

### Constructor

```
var ImapClient = require(‘imap-client’);
var imap = new ImapClient({
    port: 993, // the port to connect to
    host: ’imap.example.com’, // the host to connect to
    secure: true/false, // use SSL?
        ignoreTLS: true/false, // if true, do not call STARTTLS before authentication even if the host advertises support for it
        requireTLS: true/false, // if true, always use STARTTLS before authentication even if the host does not advertise it. If STARTTLS fails, do not try to authenticate the user
    auth.user: ’john.q@example.com’, // username of the user (also applies to oauth2)
    auth.pass: ‘examplepassword’, // password for the user
    auth.xoauth2: ‘EXAMPLEOAUTH2TOKEN’, // OAuth2 access token to be used instead of password
    ca: ‘PEM ENCODED CERT’,     // (optional, used only in conjunction with the TCPSocket shim) if you use TLS with forge, pin a PEM-encoded certificate as a string. Please refer to the [tcp-socket documentation](https://github.com/whiteout-io/tcp-socket) for more information!
    maxUpdateSize: 20 // (optional) the maximum number of messages you want to receive in one update from the server
});
```

### #login() and #logout()

Log in to an IMAP Session. No-op if already logged in.

```
imap.login().then(function() {
    // yay, we’re logged in
})

imap.logout().then(function() {
    // yay, we’re logged out
});
```

### #listenForChanges() and #stopListeningForChanges()

Set up a connection dedicated to listening for changes published by the IMAP server on one specific inbox.

```
imap.listenForChanges({
    path: ‘mailboxpath’
}).then(function() {
    // the audience is listening
    ...
})

imap.stopListeningForChanges().then(function() {
    // we’re not listening anymore
})
```

### #listWellKnownFolders()

Lists folders, grouped to folders that are in the following categories: Inbox, Drafts, All, Flagged, Sent, Trash, Junk, Archive, Other.

### #createFolder(path)

Creates a folder...

```
imap.createFolder({
    path: ['foo', 'bar']
}).then(function(path) {
    // folder created
    console.log('created folder: ' + path);
})
```

### #search(options, callback)

Returns the uids of messages containing the search terms in the options.

```
imap.search({
    answered: true,
    unread: true,
    header: ['X-Foobar', '123qweasdzxc']
}).then(function(uids) {
    console.log(‘uids: ‘ + uids.join(‘, ‘))
});
```

### #listMessages(options, callback)

Lists messages in the mailbox based on their UID.

```
imap.listMessages({
    path: ‘path’, the folder's path
    firstUid: 15, (optional) the uid of the first messagem defaults to 1
    lastUid: 30 (optional) the uid of the last message, defaults to ‘*’
}).then(function(messages) {})
```

Messages have the following attributes:

* uid: The UID in the mailbox
* id: The Mesage-ID header (without "<>")
* inReplyTo: The Message-ID that this message is a reply to
* references: The Message-IDs that this message references
* from, replyTo, to, cc, bcc: The Sender/Receivers
* modseq: The MODSEQ number of this message (as a string – javascript numbers do not tolerate 64 bit uints)
* subject: The message's subject
* sentDate: The date the message was sent
* unread: The unread flag
* answered: The answered flag
* bodyParts: Array of message parts, simplified version of a MIME tree. Used by #getBodyParts

### #getBodyParts()

Fetches parts of a message from the imap server

```
imap.getBodyParts({
    path: 'foo/bar',
    uid: someMessage.uid,
    bodyParts: someMessage.bodyParts
}).then(function() {
    // all done, bodyparts can now be fed to the mailreader
})
```

### #updateFlags(options, callback)

Marks a message as un-/read or un-/answered.

```
imap.updateFlags({
    path: 'foo/bar',
    uid: someMessage.uid,
    unread: true/false/undefined, // (optional) Marks the message as un-/read, no action if omitted
    answered: true/false/undefined // (optional) Marks the message as answered, no action if omitted
}).then(function(
    // all done
});
```

### #moveMessage(options, callback)

Moves a message from mailbox A to mailbox B.

```
imap.moveMessage({
    path: 'foo/bar', // the origin folder
    uid: someMessage.uid, // the message's uid
    destination: 'bla/bli' // the destination folder
}).then(function(
    // all done
});
```

### uploadMessage(options, callback)

Uploads a message to a folder

```
imap.uploadMessage({
    path: 'foo/bar', // the target folder
    message: '...' // RFC-2822 compliant string
}).then(function(
    // all done
});
```

### #deleteMessage(options, callback)

Deletes a message from a folder

```
imap.deleteMessage({
    path: 'foo/bar', // the folder from which to delete the message
    uid: someMessage.uid, // the message's uid
}).then(function(
    // all done
});
```

### #onSyncUpdate

If there are updates available for an IMAP folder, you will receive the changed UIDs in the `#onSyncUpdate` callback. The IMAP client invokes the callback if there are new/changes messages after a mailbox has been selected and on IMAP expunge/exists/fetch updates have been pushed from the server.
If this handler is not set, you will not receive updates from IMAP.

```
var SYNC_TYPE_NEW = 'new';
var SYNC_TYPE_DELETED = 'deleted';
var SYNC_TYPE_MSGS = 'messages';

imap.onSyncUpdate = function(options) {
    var updatedMesages = options.list,
    updatesMailbox = options.path

    if (options.type === SYNC_TYPE_NEW) {
        // new messages available on imap
        // updatedMesages is an array of the newly available UIDs
    } else if (options.type === SYNC_TYPE_DELETED) {
        // messages have been deleted
        // updatedMesages is an array of the deleted UIDs
    } else if (options.type === SYNC_TYPE_MSGS) {
        // NB! several possible reasons why this could be called.
        // updatedMesages is an array of objects
        // if an object in the array has uid value and flags array, it had a possible flag update
    }
};
```

## Getting started

Run the following commands to get started:

    npm install && grunt

## License

```
The MIT License (MIT)

Copyright (c) 2014 Whiteout Networks GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
