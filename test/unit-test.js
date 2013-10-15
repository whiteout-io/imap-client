if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {
    'use strict';

    var chai = require('chai'),
        expect = chai.expect,
        inbox = require('inbox'),
        sinon = require('sinon'),
        ImapClient = require('..');

    chai.Assertion.includeStack = true;

    describe('ImapClient', function () {
        var imap, inboxMock,
            loginOptions = {
                port: 1234,
                host: 'spiegel.de',
                auth: {
                    user: 'dummyUser',
                    pass: 'dummyPass'
                },
                errorHandler: function () {},
                secure: true
            };

        beforeEach(function () {
            var createConnectionStub;

            inboxMock = sinon.createStubInstance(inbox.IMAPClient);
            createConnectionStub = sinon.stub(inbox, 'createConnection', function () {
                return inboxMock;
            });

            imap = new ImapClient(loginOptions, inbox);
            imap._loggedIn = true;

            expect(createConnectionStub.called).to.be.true;
            expect(inboxMock.on.calledOnce).to.be.true;
            expect(inboxMock.on.calledWith('error', loginOptions.errorHandler)).to.be.true;
        });

        afterEach(function () {
            inbox.createConnection.restore();
        });


        it('should login', function (done) {
            // setup fixture
            inboxMock.once.yields();
            imap._loggedIn = false;

            // execute test case
            imap.login(function (error) {
                expect(error).to.not.exist;
                expect(imap._loggedIn).to.be.true;
                expect(inboxMock.connect.calledOnce).to.be.true;
                expect(inboxMock.once.calledOnce).to.be.true;

                done();
            });
        });

        it('should not login when logged in', function () {
            imap._loggedIn = true;
            imap.login(function (error) {
                expect(error).to.exist;
            });
        });

        it('should logout', function (done) {
            // setup fixture
            inboxMock.once.yields();

            // execute test case
            imap.logout(function () {
                expect(inboxMock.close.calledOnce).to.be.true;
                expect(inboxMock.once.calledOnce).to.be.true;

                done();
            });
        });

        it('should not logout when not logged in', function () {
            imap._loggedIn = false;
            imap.logout(function (error) {
                expect(error).to.exist;
            });
        });

        it('should list top level folders', function (done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{}, {}, {}]);

            // execute test case
            imap.listFolders(function (error, mailboxes) {
                expect(error).to.be.null;
                expect(mailboxes).to.not.be.empty;
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should not list top level folders when not logged in', function () {
            imap._loggedIn = false;
            imap.listFolders(function (error) {
                expect(error).to.exist;
            });
        });

        it('should error while listing top level folders', function (done) {
            // setup fixture
            inboxMock.listMailboxes.yields([]);

            // execute test case
            imap.listFolders(function (error, mailboxes) {
                expect(error).to.exist;
                expect(mailboxes).to.not.exist;
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should list subfolders', function (done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{
                path: 'INBOX',
                hasChildren: true,
                listChildren: function (cb) {
                    cb(null, [{
                        path: 'INBOX/FOO',
                        hasChildren: false
                    }, {
                        path: 'INBOX/BAR',
                        hasChildren: false
                    }]);
                }
            }, {
                path: 'OUTBOX',
                hasChildren: false
            }]);

            // execute test case
            imap.listFolders('INBOX', function (error, mailboxes) {
                expect(error).to.be.null;
                expect(mailboxes).to.not.be.empty;
                expect(mailboxes[0].path).to.equal('INBOX/FOO');
                expect(mailboxes[1].path).to.equal('INBOX/BAR');
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should not list sub folders when not logged in', function () {
            imap._loggedIn = false;
            imap.listFolders('', function (error) {
                expect(error).to.exist;
            });
        });

        it('should list an empty subfolder', function (done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{
                path: 'OUTBOX',
                hasChildren: false
            }]);

            // execute test case
            imap.listFolders('OUTBOX', function (error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.exist;
                expect(mailboxes).to.be.empty;
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });



        it('should list all folders', function (done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{
                path: 'INBOX',
                hasChildren: true,
                listChildren: function (cb) {
                    cb(null, [{
                        path: 'INBOX/FOO',
                        hasChildren: true,
                        listChildren: function (cb) {
                            cb(null, [{
                                path: 'INBOX/FOO/POO',
                                hasChildren: false
                            }]);
                        }
                    }, {
                        path: 'INBOX/BAR',
                        hasChildren: false
                    }]);
                }
            }, {
                path: 'OUTBOX',
                hasChildren: false
            }]);

            // execute test case
            imap.listAllFolders(function (error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.not.be.empty;
                expect(mailboxes.length).to.equal(5);
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should not list all folders when not logged in', function () {
            imap._loggedIn = false;
            imap.listAllFolders(function (error) {
                expect(error).to.exist;
            });
        });

        it('should list well known folders', function (done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{
                name: 'Posteingang',
                path: 'INBOX',
                type: 'Inbox'
            }, {
                name: 'Stuff',
                path: 'Stuff',
                type: 'Normal'
            }, {
                name: 'Foobar',
                path: 'Foobar',
                type: 'Normal'
            }, {
                name: '[Gmail]',
                path: '[Gmail]',
                hasChildren: true,
                listChildren: function (cb) {
                    cb(null, [{
                        name: 'Entwürfe',
                        path: '[Gmail]/Entw&APw-rfe',
                        type: 'Drafts'
                    }, {
                        name: 'Papierkorb',
                        path: '[Gmail]/Papierkorb',
                        type: 'Trash'
                    }, {
                        name: 'Gesendet',
                        path: '[Gmail]/Gesendet',
                        type: 'Sent'
                    }, {
                        name: 'Spam',
                        path: '[Gmail]/Spam',
                        type: 'Junk'
                    }, {
                        name: 'Besonders',
                        path: '[Gmail]/Besonders',
                        type: 'Flagged'
                    }, {
                        name: 'Lala',
                        path: '[Gmail]/lala',
                        type: 'Flagged'
                    }, {
                        name: 'Foobar',
                        path: '[Gmail]/Foobar',
                        type: 'Normal'
                    }]);
                }
            }]);

            // execute test case
            imap.listWellKnownFolders(function (error, folders) {
                expect(error).to.not.exist;
                expect(folders).to.exist;
                expect(folders.inbox).to.exist;
                expect(folders.inbox.name).to.exist;
                expect(folders.inbox.type).to.exist;
                expect(folders.inbox.path).to.exist;
                expect(folders.drafts).to.exist;
                expect(folders.sent).to.exist;
                expect(folders.trash).to.exist;
                expect(folders.junk).to.exist;

                expect(folders.flagged).to.be.instanceof(Array);
                expect(folders.flagged.length).to.equal(2);

                expect(folders.other).to.be.instanceof(Array);
                expect(folders.other.length).to.equal(1);

                expect(folders.normal).to.be.instanceof(Array);
                expect(folders.normal.length).to.equal(3);

                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should not list well known folders when not logged in', function () {
            imap._loggedIn = false;
            imap.listWellKnownFolders(function (error) {
                expect(error).to.exist;
            });
        });

        it('should error while listing all folders', function (done) {
            // setup fixture
            inboxMock.listMailboxes.yields(new Error('fubar'));

            // execute test case
            imap.listAllFolders(function (error, mailboxes) {
                expect(error).to.exist;
                expect(mailboxes).to.not.exist;

                done();
            });
        });

        it('should return number of unread messages', function (done) {
            inboxMock.openMailbox.yields();
            inboxMock.unreadMessages.yields(null, 1337);

            imap.unreadMessages('INBOX', function (error, unreadMessages) {
                expect(error).to.be.null;
                expect(unreadMessages).to.equal(1337);
                done();
            });
        });

        it('should not return number of unread messages when not logged in', function () {
            imap._loggedIn = false;
            imap.unreadMessages('', function (error) {
                expect(error).to.exist;
            });
        });

        it('should error when querying unread messages', function (done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.unreadMessages('INBOX', function (error, unreadMessages) {
                expect(error).to.exist;
                expect(unreadMessages).to.not.exist;
                done();
            });
        });

        it('should not list messages due to error', function (done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.listMessages({
                path: 'foobar',
                offset: 0,
                length: 2
            }, function (error, msg) {
                expect(error).to.exist;
                expect(msg).to.not.exist;
                done();
            });
        });

        it('should list messages', function (done) {
            inboxMock.openMailbox.yields();
            inboxMock.listMessages.yields(null, [{
                UID: 1337,
                messageId: 'beepboop',
                from: 'zuhause@aol.com',
                to: ['bankrupt@duh.com'],
                title: 'SHIAAAT',
                sentDate: '',
                flags: ['\\Seen', '\\Answered']
            }]);
            imap.listMessages({
                path: 'foobar',
                offset: 0,
                length: 2
            }, function (error, unreadMessages) {
                expect(error).to.be.null;
                expect(unreadMessages.length).to.equal(1);
                expect(unreadMessages[0].uid).to.equal(1337);
                expect(unreadMessages[0].id).to.equal('beepboop');
                expect(unreadMessages[0].from).to.be.instanceof(Array);
                expect(unreadMessages[0].to).to.be.instanceof(Array);
                expect(unreadMessages[0].subject).to.equal('SHIAAAT');
                expect(unreadMessages[0].unread).to.be.false;
                expect(unreadMessages[0].answered).to.be.true;
                done();
            });
        });

        it('should not list messages when not logged in', function () {
            imap._loggedIn = false;
            imap.listMessages({}, function (error) {
                expect(error).to.exist;
            });
        });

        it('should get a preview and decode quoted-printable', function (done) {
            var ee = {}, count = 0;
            ee.on = function (ev, cb) {
                if (ev === 'data') {
                    if (count === 0) {
                        cb("Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\nFrom: 'Sender Name' <sender@example.com>\r\nTo: 'Receiver Name' <receiver@example.com>\r\nSubject: Hello world!\r\n");
                    } else {
                        cb('To read my encrypted message below, simply =\r\ninstall Whiteout Mail for Chrome.');
                    }
                    count++;
                } else if (ev === 'end') {
                    cb();
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessagePreview({
                path: 'INBOX',
                uid: 123,
            }, function (error, msg) {
                expect(error).to.be.null;
                expect(inboxMock.createStream.calledTwice).to.be.true;
                expect(msg.uid).to.equal(123);
                expect(msg.from).to.be.instanceof(Array);
                expect(msg.to).to.be.instanceof(Array);
                expect(msg.subject).to.equal('Hello world!');
                expect(msg.body).to.equal('To read my encrypted message below, simply install Whiteout Mail for Chrome.');

                done();
            });
        });

        it('should get preview with nested body parts', function (done) {
            var ee = {}, count = 0;
            ee.on = function (ev, cb) {
                if (ev === 'data') {
                    if (count === 0) {
                        cb("Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\nFrom: 'Sender Name' <sender@example.com>\r\nTo: 'Receiver Name' <receiver@example.com>\r\nSubject: Hello world!\r\n");
                    } else if (count === 0) {
                        cb('--047d7b2e4c46a8395c04e5048cce\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nasdasdasdasd\r\n\r\n--047d7b2e4c46a8395c04e5048cce\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n<div dir="ltr">asdasdasdasd</div>\r\n\r\n--047d7b2e4c46a8395c04e5048cce--');
                    } else {
                        cb('asdasdasdasd');
                    }
                    count++;
                } else if (ev === 'end') {
                    cb();
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessagePreview({
                path: 'INBOX',
                uid: 123,
            }, function (error, msg) {
                expect(error).to.be.null;
                expect(inboxMock.createStream.calledTwice).to.be.true;
                expect(msg.uid).to.equal(123);
                expect(msg.from).to.be.instanceof(Array);
                expect(msg.to).to.be.instanceof(Array);
                expect(msg.subject).to.equal('Hello world!');
                expect(msg.body).to.equal('asdasdasdasd');

                done();
            });
        });

        it('should not get preview due to error', function (done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.getMessagePreview({
                path: 'INBOX',
                uid: 123,
            }, function (error, msg) {
                expect(error).to.exist;
                expect(msg).to.not.exist;
                done();
            });
        });

        it('should not get a message preview when not logged in', function () {
            imap._loggedIn = false;
            imap.getMessagePreview({}, function (error) {
                expect(error).to.exist;
            });
        });

        it('should timeout when a non-existent body part should be retrieved', function (done) {
            var ee = {}, count = 0;
            ee.on = function (ev, cb) {
                if (ev === 'data') {
                    if (count === 0) {
                        cb("Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\nFrom: 'Sender Name' <sender@example.com>\r\nTo: 'Receiver Name' <receiver@example.com>\r\nSubject: Hello world!\r\n");
                    }
                    count++;
                } else if (ev === 'end') {
                    if (count === 1) {
                        cb();
                    }
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessagePreview({
                path: 'INBOX',
                uid: 123,
                timeout: 10
            }, function (error, msg) {
                expect(error).to.be.null;
                expect(inboxMock.createStream.calledTwice).to.be.true;
                expect(msg.uid).to.equal(123);
                expect(msg.from).to.be.instanceof(Array);
                expect(msg.to).to.be.instanceof(Array);
                expect(msg.subject).to.equal('Hello world!');
                expect(msg.body).to.not.exist;

                done();
            });
        });

        it('should catch stream error at preview', function (done) {
            var ee = {};
            ee.pipe = function () {};
            ee.on = function (event, cb) {
                if (event === 'error') {
                    cb(new Error('New Shit Has Come To Light!'));
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessagePreview({
                path: 'INBOX',
                uid: 123,
            }, function (error, message) {
                expect(error).to.exist;
                expect(error.message).to.equal('New Shit Has Come To Light!');
                expect(message).to.not.exist;
                done();
            });
        });

        it('should avoid invoking pipe on nonexistent stream in preview', function (done) {
            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(null);

            imap.getMessagePreview({
                path: 'INBOX',
                uid: 123,
            }, function (error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;
                done();
            });
        });

        it('should get a complete message', function (done) {
            var ee = {};
            ee.on = function (ev, cb) {
                if (ev === 'end') {
                    cb("From: Felix Hammerl <felix.hammerl@gmail.com>\nContent-Type: multipart/mixed; boundary='Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A'\nSubject: test\nMessage-Id: <CAEB0027-379C-4E08-9367-8764B9A93D60@gmail.com>\nDate: Tue, 20 Aug 2013 13:47:05 +0200\nTo: 'safewithme.testuser@gmail.com' <safewithme.testuser@gmail.com>\nMime-Version: 1.0 (Mac OS X Mail 6.5)\n\n\n--Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A\nContent-Transfer-Encoding: 7bit\nContent-Type: text/plain;\n    charset=us-ascii\n\nasdasdasd\n\n\n--Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A\nContent-Disposition: attachment;\n    filename=README.md\nContent-Type: application/octet-stream;\n    x-unix-mode=0644;\n    name='README.md'\nContent-Transfer-Encoding: 7bit\n\nhtml5-mail\n==========\n\nHTML5 Mail App with Client-side Encryption\n\n## Getting started\nRequired packages: nodejs, npm\n\n    npm install\n    grunt dev\n    \nbrowse to http://localhost:8585\n--Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A--");
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 1234,
            }, function (error, msg) {
                expect(error).to.be.null;
                expect(inboxMock.createStream.calledOnce).to.be.true;
                expect(msg.uid).to.equal(1234);
                expect(msg.from).to.be.instanceof(Array);
                expect(msg.to).to.be.instanceof(Array);
                expect(msg.subject).to.equal('test');
                expect(msg.body).to.equal('asdasdasd\n\n');
                expect(msg.attachments).to.not.be.empty;

                done();
            });
        });

        it('should not get a complete message when not logged in', function () {
            imap._loggedIn = false;
            imap.getMessage({}, function (error) {
                expect(error).to.exist;
            });
        });

        it('should catch stream error in full message mode', function (done) {
            var ee = {};
            ee.pipe = function () {};
            ee.on = function (event, cb) {
                if (event === 'error') {
                    cb(new Error('New Shit Has Come To Light!'));
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
            }, function (error, message) {
                expect(error).to.exist;
                expect(error.message).to.equal('New Shit Has Come To Light!');
                expect(message).to.not.exist;
                done();
            });
        });

        it('should avoid invoking pipe on nonexistent stream in full message mode', function (done) {
            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(null);
            imap.getMessage({
                path: 'INBOX',
                uid: 123,
            }, function (error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;
                done();
            });
        });

        it('should get flags', function (done) {
            inboxMock.openMailbox.yields();
            inboxMock.fetchFlags.yields(null, ['\\Seen', '\\Answered']);

            imap.getFlags({
                path: 'INBOX',
                uid: 123,
            }, function (error, flags) {
                expect(error).to.be.null;
                expect(flags.unread).to.be.false;
                expect(flags.answered).to.be.true;
                done();
            });
        });

        it('should not get flags when not logged in', function () {
            imap._loggedIn = false;
            imap.getFlags({}, function (error) {
                expect(error).to.exist;
            });
        });

        it('should not get flags due to error', function (done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.getFlags({
                path: 'INBOX',
                uid: 123,
            }, function (error, flags) {
                expect(error).to.exist;
                expect(flags).to.not.exist;
                done();
            });
        });

        it('should update flags', function (done) {
            inboxMock.openMailbox.yields();
            inboxMock.removeFlags.yields(null, []);
            inboxMock.addFlags.yields(null, ['\\Seen', '\\Answered']);

            imap.updateFlags({
                path: 'INBOX',
                uid: 123,
                unread: false,
                answered: true
            }, function (error, flags) {
                expect(error).to.be.null;
                expect(flags.unread).to.be.false;
                expect(flags.answered).to.be.true;
                done();
            });
        });

        it('should not update flags when not logged in', function () {
            imap._loggedIn = false;
            imap.updateFlags({}, function (error) {
                expect(error).to.exist;
            });
        });

        it('should not update flags due to error', function (done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.updateFlags({
                path: 'INBOX',
                uid: 123,
                unread: false,
                answered: true
            }, function (error, flags) {
                expect(error).to.exist;
                expect(flags).to.not.exist;
                done();
            });
        });
    });
});