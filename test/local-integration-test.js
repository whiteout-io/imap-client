'use strict';

require('es6-promise').polyfill(); // load ES6 Promises polyfill

// this test is node-only (hoodiecrow is fired up)

var chai = require('chai'),
    expect = chai.expect,
    ImapClient = require('../src/imap-client'),
    hoodiecrow = require('hoodiecrow'),
    loginOptions = {
        port: 12345,
        host: 'localhost',
        auth: {
            user: 'testuser',
            pass: 'testpass'
        },
        secure: false
    };

describe('ImapClient local integration tests', function() {
    var ic, imap;

    chai.config.includeStack = true;
    before(function() {
        imap = hoodiecrow({
            storage: {
                'INBOX': {
                    messages: [{
                        raw: 'Message-Id: <abcde>\r\nX-Foobar: 123qweasdzxc\r\nSubject: hello 1\r\n\r\nWorld 1!'
                    }, {
                        raw: 'Message-Id: <qwe>\r\nSubject: hello 2\r\n\r\nWorld 2!',
                        flags: ['\\Seen']
                    }, {
                        raw: 'Message-Id: <asd>\r\nSubject: hello 3\r\n\r\nWorld 3!'
                    }, {
                        raw: 'MIME-Version: 1.0\r\nDate: Tue, 01 Oct 2013 07:08:55 GMT\r\nMessage-Id: <1380611335900.56da46df@Nodemailer>\r\nFrom: alice@example.com\r\nTo: bob@example.com\r\nSubject: Hello\r\nContent-Type: multipart/mixed;\r\n boundary="----Nodemailer-0.5.3-dev-?=_1-1380611336047"\r\n\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vZm9vZm9vZm9vZm9v\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="bar.txt"\r\nContent-Disposition: attachment; filename="bar.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYmFyYmFyYmFyYmFyYmFy\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047--'
                    }, {
                        raw: 'Content-Type: multipart/encrypted; boundary="Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69"; protocol="application/pgp-encrypted";\r\nSubject: [whiteout] attachment only\r\nFrom: Felix Hammerl <felix.hammerl@gmail.com>\r\nDate: Thu, 16 Jan 2014 14:55:56 +0100\r\nContent-Transfer-Encoding: 7bit\r\nMessage-Id: <3ECDF9DC-895E-4475-B2A9-52AF1F117652@gmail.com>\r\nContent-Description: OpenPGP encrypted message\r\nTo: safewithme.testuser@gmail.com\r\n\r\nThis is an OpenPGP/MIME encrypted message (RFC 2440 and 3156)\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69\r\nContent-Transfer-Encoding: 7bit\r\nContent-Type: application/pgp-encrypted\r\nContent-Description: PGP/MIME Versions Identification\r\n\r\nVersion: 1\r\n\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69\r\nContent-Transfer-Encoding: 7bit\r\nContent-Disposition: inline;\r\n    filename=encrypted.asc\r\nContent-Type: application/octet-stream;\r\n    name=encrypted.asc\r\nContent-Description: OpenPGP encrypted message\r\n\r\ninsert pgp here.\r\n\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69--',
                    }, {
                        raw: 'MIME-Version: 1.0\r\nDate: Tue, 01 Oct 2013 07:08:55 GMT\r\nMessage-Id: <1380611335900.56da46df@Nodemailer>\r\nFrom: alice@example.com\r\nTo: bob@example.com\r\nSubject: Hello\r\nContent-Type: multipart/mixed;\r\n boundary="----Nodemailer-0.5.3-dev-?=_1-1380611336047"\r\n\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vZm9vZm9vZm9vZm9v\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="bar.txt"\r\nContent-Disposition: attachment; filename="bar.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYmFyYmFyYmFyYmFyYmFy\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047--'
                    }]
                },
                '': {
                    'separator': '/',
                    'folders': {
                        '[Gmail]': {
                            'flags': ['\\Noselect'],
                            'folders': {
                                'All Mail': {
                                    'flags': '\\All'
                                },
                                'Drafts': {
                                    'flags': '\\Drafts'
                                },
                                'Important': {
                                    'flags': '\\Important'
                                },
                                'Sent Mail': {
                                    'flags': '\\Sent'
                                },
                                'Spam': {
                                    'flags': '\\Junk'
                                },
                                'Starred': {
                                    'flags': '\\Flagged'
                                },
                                'Trash': {
                                    'flags': '\\Trash'
                                }
                            }
                        }
                    }
                }
            }
        });

        imap.listen(loginOptions.port);
    });

    after(function(done) {
        imap.close(done);
    });

    beforeEach(function(done) {
        ic = new ImapClient(loginOptions);
        ic.onSyncUpdate = function() {};
        ic.login().then(done);
    });

    afterEach(function(done) {
        ic.logout().then(done);
    });

    it('should notify about new messages', function(done) {
        var invocations = 0; // counts the message updates

        ic.onSyncUpdate = function(options) {
            invocations++;

            expect(options.list.length).to.equal(6);
            expect(options.type).to.equal('new');
            done();
        };

        ic.selectMailbox({
            path: 'INBOX'
        });
    });

    it('should list well known folders', function(done) {
        ic.listWellKnownFolders().then(function(folders) {
            expect(folders).to.exist;

            expect(folders.Inbox).to.be.instanceof(Array);
            expect(folders.Inbox[0]).to.exist;
            expect(folders.Inbox[0].name).to.exist;
            expect(folders.Inbox[0].type).to.exist;
            expect(folders.Inbox[0].path).to.exist;

            expect(folders.Drafts).to.be.instanceof(Array);
            expect(folders.Drafts).to.not.be.empty;

            expect(folders.Sent).to.be.instanceof(Array);
            expect(folders.Sent).to.not.be.empty;

            expect(folders.Trash).to.be.instanceof(Array);
            expect(folders.Trash).to.not.be.empty;

            expect(folders.Other).to.be.instanceof(Array);
            expect(folders.Other).to.not.be.empty;
        }).then(done);
    });

    it('should search messages', function(done) {
        ic.search({
            path: 'INBOX',
            unread: false,
            answered: false
        }).then(function(uids) {
            expect(uids).to.not.be.empty;
        }).then(done);
    });

    it('should create folder', function(done) {
        ic.createFolder({
            path: 'foo'
        }).then(function(fullPath) {
            expect(fullPath).to.equal('foo');
            return ic.listWellKnownFolders();

        }).then(function(folders) {
            var hasFoo = false;

            folders.Other.forEach(function(folder) {
                hasFoo = hasFoo || folder.path === 'foo';
            });

            expect(hasFoo).to.be.true;
            expect(ic._delimiter).to.exist;
            expect(ic._prefix).to.exist;
        }).then(done);
    });

    it('should create folder hierarchy', function(done) {
        ic.createFolder({
            path: ['bar', 'baz']
        }).then(function(fullPath) {
            expect(fullPath).to.equal('bar/baz');
            return ic.listWellKnownFolders();
        }).then(function(folders) {
            var hasFoo = false;

            folders.Other.forEach(function(folder) {
                hasFoo = hasFoo || folder.path === 'bar/baz';
            });

            expect(hasFoo).to.be.true;
        }).then(done);
    });

    it('should search messages for header', function(done) {
        ic.search({
            path: 'INBOX',
            header: ['X-Foobar', '123qweasdzxc']
        }).then(function(uids) {
            expect(uids).to.deep.equal([1]);
        }).then(done);
    });

    it('should list messages by uid', function(done) {
        ic.listMessages({
            path: 'INBOX',
            firstUid: 1,
            lastUid: 3
        }).then(function(messages) {
            expect(messages).to.not.be.empty;
            expect(messages.length).to.equal(3);
            expect(messages[0].id).to.not.be.empty;
            expect(messages[0].bodyParts.length).to.equal(1);
        }).then(done);
    });

    it('should list all messages by uid', function(done) {
        ic.listMessages({
            path: 'INBOX',
            firstUid: 1
        }).then(function(messages) {
            expect(messages).to.not.be.empty;
            expect(messages.length).to.equal(6);
        }).then(done);
    });

    it('should get message parts', function(done) {
        var msgs;
        ic.listMessages({
            path: 'INBOX',
            firstUid: 4,
            lastUid: 4
        }).then(function(messages) {
            msgs = messages;
            return ic.getBodyParts({
                path: 'INBOX',
                uid: messages[0].uid,
                bodyParts: messages[0].bodyParts
            });

        }).then(function(bodyParts) {
            expect(msgs[0].bodyParts).to.equal(bodyParts);
            expect(bodyParts[0].type).to.equal('text');
            expect(bodyParts[0].raw).to.equal('Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world');

        }).then(done);
    });

    it('should update flags', function(done) {
        ic.updateFlags({
            path: 'INBOX',
            uid: 1,
            unread: true,
            flagged: true,
            answered: true
        }).then(function() {
            done();
        });
    });

    it('should purge message', function(done) {
        ic.listMessages({
            path: 'INBOX',
            firstUid: 1
        }).then(function(messages) {
            expect(messages).to.not.be.empty;
            return ic.deleteMessage({
                path: 'INBOX',
                uid: 2
            });

        }).then(function() {
            return ic.listMessages({
                path: 'INBOX',
                firstUid: 1
            });

        }).then(function(messages) {
            expect(messages).to.not.be.empty;
            messages.forEach(function(message) {
                expect(message.uid).to.not.equal(2);
            });

        }).then(done);
    });

    it('should upload Message', function(done) {
        var msg = 'MIME-Version: 1.0\r\nDate: Wed, 9 Jul 2014 15:07:47 +0200\r\nDelivered-To: test@test.com\r\nMessage-ID: <CAHftYYQo=5fqbtnv-DazXhL2j5AxVP1nWarjkztn-N9SV91Z2w@mail.gmail.com>\r\nSubject: test\r\nFrom: Test Test <test@test.com>\r\nTo: Test Test <test@test.com>\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\ntest',
            path = 'INBOX',
            msgCount;

        ic.listMessages({
            path: path,
            firstUid: 1
        }).then(function(messages) {
            expect(messages).to.not.be.empty;
            msgCount = messages.length;

            return ic.uploadMessage({
                path: path,
                message: msg,
                flags: ['\\Seen']
            });
        }).then(function() {
            return ic.listMessages({
                path: path,
                firstUid: 1
            });
        }).then(function(messages) {
            expect(messages.length).to.equal(msgCount + 1);
        }).then(done);
    });

    it('should move message', function(done) {
        var destination = '[Gmail]/Trash';

        ic.listMessages({
            path: destination,
            firstUid: 1
        }).then(function(messages) {
            expect(messages).to.be.empty;
            return ic.listMessages({
                path: 'INBOX',
                firstUid: 1
            });

        }).then(function(messages) {
            expect(messages).to.not.be.empty;
            return ic.moveMessage({
                path: 'INBOX',
                uid: messages[0].uid,
                destination: destination
            });

        }).then(function() {
            return ic.listMessages({
                path: destination,
                firstUid: 1
            });

        }).then(function(messages) {
            expect(messages).to.not.be.empty;
        }).then(done);
    });

    it('should timeout', function(done) {
        ic.onError = function(err) {
            expect(err).to.exist;
            expect(ic._loggedIn).to.be.false;
            done();
        };

        ic._client.client.TIMEOUT_SOCKET_LOWER_BOUND = 20; // fails 20ms after writing to socket
        ic._client.client.socket.ondata = function() {}; // browserbox won't be receiving data anymore

        // fire anything at the socket
        ic.listMessages({
            path: 'INBOX',
            firstUid: 1
        });
    });

    it.skip('should not error for listening client timeout', function(done) {
        ic.listenForChanges({
            path: 'INBOX'
        }).then(function() {
            ic._listeningClient.client.TIMEOUT_SOCKET_LOWER_BOUND = 20; // fails 20ms after dropping into idle/noop
            ic._listeningClient.client.socket.ondata = function() {}; // browserbox won't be receiving data anymore

            // the listening client does not cause an error, so we let it fail silently
            // in the background and check back after a 1 s delay
            setTimeout(function() {
                expect(ic._listenerLoggedIn).to.be.false;
                done();
            }, 1000);
        });
    });
});