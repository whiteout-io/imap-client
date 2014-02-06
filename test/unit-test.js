if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {
    'use strict';

    var chai = require('chai'),
        expect = chai.expect,
        inbox = require('inbox'),
        sinon = require('sinon'),
        ImapClient = require('..');

    chai.Assertion.includeStack = true;

    describe('ImapClient', function() {
        var imap, inboxMock;

        beforeEach(function(done) {
            var createConnectionStub, loginOptions = {
                    port: 1234,
                    host: 'spiegel.de',
                    auth: {
                        user: 'dummyUser',
                        pass: 'dummyPass'
                    },
                    secure: true,
                    timeout: 1234,
                    ca: ['asdasd']
                };

            inboxMock = sinon.createStubInstance(inbox.IMAPClient);
            createConnectionStub = sinon.stub(inbox, 'createConnection', function(port, host, opts) {
                if (port === 1234 && host === 'spiegel.de' && opts.ca[0] === 'asdasd' && opts.secureConnection === true && opts.auth.user === 'dummyUser' && opts.auth.pass === 'dummyPass' && opts.timeout === 1234) {
                    return inboxMock;
                }
            });

            imap = new ImapClient(loginOptions, inbox);
            imap._loggedIn = true;
            imap.onIncomingMessage = function(mail) {
                expect(mail.uid).to.equal(1337);
                expect(mail.id).to.equal('beepboop');
                expect(mail.from).to.be.instanceof(Array);
                expect(mail.to).to.be.instanceof(Array);
                expect(mail.subject).to.equal('SHIAAAT');
                expect(mail.unread).to.be.false;
                expect(mail.answered).to.be.true;
                done();
            };

            expect(createConnectionStub.called).to.be.true;
            expect(inboxMock.on.calledTwice).to.be.true;
            expect(inboxMock.on.calledWith('error')).to.be.true;
            expect(inboxMock.on.calledWith('new', sinon.match(function(func) {
                expect(func).to.exist;
                func({
                    UID: 1337,
                    messageId: 'beepboop',
                    from: 'zuhause@aol.com',
                    to: ['bankrupt@duh.com'],
                    title: 'SHIAAAT',
                    sentDate: '',
                    flags: ['\\Seen', '\\Answered']
                });
                return true;
            }))).to.be.true;
        });

        afterEach(function() {
            inbox.createConnection.restore();
        });


        it('should login', function(done) {
            // setup fixture
            inboxMock.once.yields();
            imap._loggedIn = false;

            // execute test case
            imap.login(function(error) {
                expect(error).to.not.exist;
                expect(imap._loggedIn).to.be.true;
                expect(inboxMock.connect.calledOnce).to.be.true;
                expect(inboxMock.once.calledOnce).to.be.true;

                done();
            });
        });

        it('should not login when logged in', function() {
            imap._loggedIn = true;
            imap.login(function(error) {
                expect(error).to.exist;
            });
        });

        it('should logout', function(done) {
            // setup fixture
            inboxMock.once.yields();

            // execute test case
            imap.logout(function() {
                expect(inboxMock.close.calledOnce).to.be.true;
                expect(inboxMock.once.calledOnce).to.be.true;

                done();
            });
        });

        it('should not logout when not logged in', function() {
            imap._loggedIn = false;
            imap.logout(function(error) {
                expect(error).to.exist;
            });
        });

        it('should list top level folders', function(done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{}, {}, {}]);

            // execute test case
            imap.listFolders(function(error, mailboxes) {
                expect(error).to.be.null;
                expect(mailboxes).to.not.be.empty;
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should not list top level folders when not logged in', function() {
            imap._loggedIn = false;
            imap.listFolders(function(error) {
                expect(error).to.exist;
            });
        });

        it('should error while listing top level folders', function(done) {
            // setup fixture
            inboxMock.listMailboxes.yields([]);

            // execute test case
            imap.listFolders(function(error, mailboxes) {
                expect(error).to.exist;
                expect(mailboxes).to.not.exist;
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should list subfolders', function(done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{
                path: 'INBOX',
                hasChildren: true,
                listChildren: function(cb) {
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
            imap.listFolders('INBOX', function(error, mailboxes) {
                expect(error).to.be.null;
                expect(mailboxes).to.not.be.empty;
                expect(mailboxes[0].path).to.equal('INBOX/FOO');
                expect(mailboxes[1].path).to.equal('INBOX/BAR');
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should not list sub folders when not logged in', function() {
            imap._loggedIn = false;
            imap.listFolders('', function(error) {
                expect(error).to.exist;
            });
        });

        it('should list an empty subfolder', function(done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{
                path: 'OUTBOX',
                hasChildren: false
            }]);

            // execute test case
            imap.listFolders('OUTBOX', function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.exist;
                expect(mailboxes).to.be.empty;
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });



        it('should list all folders', function(done) {
            // setup fixture
            inboxMock.listMailboxes.yields(null, [{
                path: 'INBOX',
                hasChildren: true,
                listChildren: function(cb) {
                    cb(null, [{
                        path: 'INBOX/FOO',
                        hasChildren: true,
                        listChildren: function(cb) {
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
            imap.listAllFolders(function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.not.be.empty;
                expect(mailboxes.length).to.equal(5);
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
            });
        });

        it('should not list all folders when not logged in', function() {
            imap._loggedIn = false;
            imap.listAllFolders(function(error) {
                expect(error).to.exist;
            });
        });

        it('should list well known folders', function(done) {
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
                listChildren: function(cb) {
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
            imap.listWellKnownFolders(function(error, folders) {
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

        it('should not list well known folders when not logged in', function() {
            imap._loggedIn = false;
            imap.listWellKnownFolders(function(error) {
                expect(error).to.exist;
            });
        });

        it('should error while listing all folders', function(done) {
            // setup fixture
            inboxMock.listMailboxes.yields(new Error('fubar'));

            // execute test case
            imap.listAllFolders(function(error, mailboxes) {
                expect(error).to.exist;
                expect(mailboxes).to.not.exist;

                done();
            });
        });

        it('should search', function(done) {
            inboxMock.openMailbox.withArgs('foobar').yields();
            inboxMock.search.yields(null, [1, 3, 5]);
            imap.search({
                path: 'foobar',
                subject: 'whiteout '
            }, function(error, uids) {
                expect(error).to.be.null;
                expect(uids.length).to.equal(3);
                done();
            });
        });

        it('should not search when not logged in', function() {
            imap._loggedIn = false;
            imap.search({
                path: 'foobar',
                subject: 'whiteout '
            }, function(error) {
                expect(error).to.exist;
            });
        });


        it('should list messages by uid', function(done) {
            var listing = [{
                UID: 1,
                messageId: 'beepboop',
                from: 'zuhause@aol.com',
                to: ['bankrupt@duh.com'],
                title: 'SHIAAAT',
                sentDate: '',
                flags: ['\\Seen', '\\Answered'],
                bodystructure: {
                    '1': {
                        part: '1',
                        type: 'text/plain',
                        parameters: {
                            charset: 'us-ascii'
                        },
                        encoding: '7bit',
                        size: 13,
                        lines: 2
                    },
                    '2': {
                        part: '2',
                        type: 'application/octet-stream',
                        parameters: {
                            name: 'foobar.md',
                            'x-unix-mode': '0644'
                        },
                        encoding: '7bit',
                        size: 211,
                        disposition: [{
                            type: 'attachment',
                            filename: 'foobar.md'
                        }]
                    },
                    type: 'multipart/mixed'
                }
            }, {
                UID: 2,
                messageId: 'beepboop',
                from: 'zuhause@aol.com',
                to: ['bankrupt@duh.com'],
                title: 'SHIAAAT',
                sentDate: '',
                flags: ['\\Seen', '\\Answered'],
                bodystructure: {
                    part: '1',
                    type: 'text/plain',
                    parameters: {
                        charset: 'us-ascii'
                    },
                    encoding: '7bit',
                    size: 13,
                    lines: 2
                }
            }, {
                UID: 3,
                messageId: 'ajabwelvzbslvnasd',
                from: 'god@aol.com',
                to: ['devil@aol.com'],
                title: 'we broke, man.',
                sentDate: '',
                flags: ['\\Seen', '\\Answered'],
                bodystructure: {
                    1: {
                        part: '1',
                        type: 'text/plain',
                        parameters: {
                            charset: 'us-ascii'
                        },
                        encoding: '7bit',
                        size: 13,
                        lines: 2
                    },
                    2: {
                        part: '1',
                        type: 'multipart/encrypted',
                        1: {
                            part: '2.1',
                            type: 'application/pgp-encrypted',
                            encoding: '7bit'
                        },
                        2: {
                            part: '2.2',
                            type: 'application/octet-stream',
                            encoding: '7bit'
                        }
                    },
                    type: 'multipart/mixed'
                }
            }];
            inboxMock.openMailbox.withArgs('foobar').yields();
            inboxMock.uidListMessages.withArgs(1, 2).yields(null, listing);
            imap.listMessagesByUid({
                path: 'foobar',
                firstUid: 1,
                lastUid: 2
            }, function(error, msgs) {
                expect(error).to.be.null;
                expect(msgs.length).to.equal(3);

                expect(msgs[0].uid).to.equal(3);
                expect(msgs[0].isEncrypted).to.be.true;
                expect(msgs[0].encryptedBodypart).to.equal(listing[2].bodystructure[2][2]);

                expect(msgs[1].uid).to.equal(2);
                expect(msgs[1].id).to.equal('beepboop');
                expect(msgs[1].from).to.be.instanceof(Array);
                expect(msgs[1].to).to.be.instanceof(Array);
                expect(msgs[1].subject).to.equal('SHIAAAT');
                expect(msgs[1].unread).to.be.false;
                expect(msgs[1].answered).to.be.true;
                expect(msgs[1].attachments).to.be.empty;

                expect(msgs[2].attachments).to.not.be.empty;
                expect(msgs[2].attachments[0].filename).to.equal('foobar.md');
                expect(msgs[2].attachments[0].filesize).to.equal(211);
                expect(msgs[2].attachments[0].mimeType).to.equal('text/x-markdown');
                expect(msgs[2].attachments[0].part).to.equal('2');
                expect(msgs[2].attachments[0].content).to.be.null;

                done();
            });
        });

        it('should not list messages by uid due to error', function(done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.listMessagesByUid({
                path: 'foobar',
                firstUid: 1,
                lastUid: 2
            }, function(error, msg) {
                expect(error).to.exist;
                expect(msg).to.not.exist;
                done();
            });
        });

        it('should not list messages by uid when not logged in', function() {
            imap._loggedIn = false;
            imap.listMessagesByUid({
                path: 'foobar',
                firstUid: 1,
                lastUid: 2
            }, function(error) {
                expect(error).to.exist;
            });
        });

        it('should get a plain text message', function(done) {
            var ee = {};
            ee.on = function(ev, cb) {
                if (ev === 'data') {
                    cb('To read my encrypted message below, simply =\r\ninstall Whiteout Mail for Chrome.');
                } else if (ev === 'end') {
                    cb();
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.uidListMessages.withArgs(123, 123).yields(null, [{
                UID: 123,
                messageId: 'beepboop',
                from: 'zuhause@aol.com',
                to: ['bankrupt@duh.com'],
                title: 'Hello world!',
                sentDate: '',
                flags: ['\\Seen', '\\Answered'],
                bodystructure: {
                    part: '1',
                    type: 'text/plain',
                    parameters: {
                        charset: 'utf-8'
                    },
                    encoding: 'quoted-printable',
                    size: 11, // that's not the actual value ...
                    lines: 1 // that's not the actual value ...
                }
            }]);
            inboxMock.createStream.withArgs({
                uid: 123,
                part: '1'
            }).returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
            }, function(error, msg) {
                expect(error).to.be.null;
                expect(msg.uid).to.equal(123);
                expect(msg.from).to.be.instanceof(Array);
                expect(msg.to).to.be.instanceof(Array);
                expect(msg.subject).to.equal('Hello world!');
                expect(inboxMock.createStream.called).to.be.true;
                expect(msg.body).to.equal('To read my encrypted message below, simply install Whiteout Mail for Chrome.');

                done();
            });
        });

        it('should get a plain text from a nested body part', function(done) {
            var ee = {};
            ee.on = function(ev, cb) {
                if (ev === 'data') {
                    cb('To read my encrypted message below, simply =\r\ninstall Whiteout Mail for Chrome.');
                } else if (ev === 'end') {
                    cb();
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.uidListMessages.withArgs(123, 123).yields(null, [{
                UID: 123,
                messageId: 'beepboop',
                from: 'zuhause@aol.com',
                to: ['bankrupt@duh.com'],
                title: 'Hello world!',
                sentDate: '',
                flags: ['\\Seen', '\\Answered'],
                bodystructure: {
                    '1': {
                        '1': {
                            part: '1.1',
                            type: 'text/plain',
                            parameters: {},
                            encoding: 'quoted-printable',
                            size: 1549,
                            lines: 40
                        },
                        '2': {
                            part: '1.2',
                            type: 'text/html',
                            parameters: {},
                            encoding: 'quoted-printable',
                            size: 1934,
                            lines: 43
                        },
                        type: 'multipart/alternative'
                    },
                    '2': {
                        part: '2',
                        type: 'application/x-gpt',
                        parameters: {
                            name: 'elements.gp5'
                        },
                        encoding: 'base64',
                        size: 75648,
                        disposition: [{
                            type: 'attachment',
                            filename: 'Doom.gp5'
                        }]
                    },
                    type: 'multipart/mixed'
                }
            }]);
            inboxMock.createStream.withArgs({
                uid: 123,
                part: '1.1'
            }).returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
            }, function(error, msg) {
                expect(error).to.be.null;
                expect(msg.uid).to.equal(123);
                expect(msg.from).to.be.instanceof(Array);
                expect(msg.to).to.be.instanceof(Array);
                expect(msg.subject).to.equal('Hello world!');
                expect(msg.body).to.equal('To read my encrypted message below, simply install Whiteout Mail for Chrome.');
                expect(inboxMock.createStream.called).to.be.true;

                done();
            });
        });

        it('should not get preview of a non-existent message', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.uidListMessages.withArgs(999, 999).yields(null, []);

            imap.getMessage({
                path: 'INBOX',
                uid: 999
            }, function(error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;

                done();
            });
        });

        it('should not get a message due to error while opening the mail box', function(done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
            }, function(error, msg) {
                expect(error).to.exist;
                expect(msg).to.not.exist;
                done();
            });
        });

        it('should not get a message when not logged in', function() {
            imap._loggedIn = false;
            imap.getMessage({}, function(error) {
                expect(error).to.exist;
            });
        });

        it('should catch stream error', function(done) {
            var ee = {};
            ee.pipe = function() {};
            ee.on = function(event, cb) {
                if (event === 'error') {
                    cb(new Error('New Shit Has Come To Light!'));
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.uidListMessages.withArgs(123, 123).yields(null, [{
                UID: 123,
                messageId: 'beepboop',
                from: 'zuhause@aol.com',
                to: ['bankrupt@duh.com'],
                title: 'Hello world!',
                sentDate: '',
                flags: ['\\Seen', '\\Answered'],
                bodystructure: {
                    part: '1',
                    type: 'text/plain',
                    parameters: {
                        charset: 'utf-8'
                    },
                    encoding: 'quoted-printable',
                    size: 11, // that's not the actual value ...
                    lines: 1 // that's not the actual value ...
                }
            }]);
            inboxMock.createStream.returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
            }, function(error, message) {
                expect(error).to.exist;
                expect(error.message).to.equal('New Shit Has Come To Light!');
                expect(message).to.not.exist;
                done();
            });
        });

        it('should get flags', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.fetchFlags.yields(null, ['\\Seen', '\\Answered']);

            imap.getFlags({
                path: 'INBOX',
                uid: 123,
            }, function(error, flags) {
                expect(error).to.be.null;
                expect(flags.unread).to.be.false;
                expect(flags.answered).to.be.true;
                done();
            });
        });

        it('should get flags when inbox messes up', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.fetchFlags.yields(null, null);

            imap.getFlags({
                path: 'INBOX',
                uid: 123,
            }, function(error, flags) {
                expect(error).to.be.null;
                expect(flags).to.deep.equal({});
                done();
            });
        });

        it('should not get flags when not logged in', function() {
            imap._loggedIn = false;
            imap.getFlags({}, function(error) {
                expect(error).to.exist;
            });
        });

        it('should not get flags due to error', function(done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.getFlags({
                path: 'INBOX',
                uid: 123,
            }, function(error, flags) {
                expect(error).to.exist;
                expect(flags).to.not.exist;
                done();
            });
        });

        it('should update flags', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.removeFlags.yields(null, []);
            inboxMock.addFlags.yields(null, ['\\Seen', '\\Answered']);

            imap.updateFlags({
                path: 'INBOX',
                uid: 123,
                unread: false,
                answered: true
            }, function(error, flags) {
                expect(error).to.be.null;
                expect(flags.unread).to.be.false;
                expect(flags.answered).to.be.true;

                expect(inboxMock.openMailbox.calledWith('INBOX')).to.be.true;
                expect(inboxMock.removeFlags.calledWith(123, [])).to.be.true;
                expect(inboxMock.addFlags.calledWith(123, ['\\Seen', '\\Answered'])).to.be.true;

                done();
            });
        });

        it('should update flags when inbox messes up', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.removeFlags.yields(null, []);
            inboxMock.addFlags.yields(null, true);

            imap.updateFlags({
                path: 'INBOX',
                uid: 123,
                unread: false,
                answered: true
            }, function(error, flags) {
                expect(error).to.be.null;
                expect(flags).to.deep.equal({});

                expect(inboxMock.openMailbox.calledWith('INBOX')).to.be.true;
                expect(inboxMock.removeFlags.calledWith(123, [])).to.be.true;
                expect(inboxMock.addFlags.calledWith(123, ['\\Seen', '\\Answered'])).to.be.true;

                done();
            });
        });

        it('should not update flags when not logged in', function() {
            imap._loggedIn = false;
            imap.updateFlags({}, function(error) {
                expect(error).to.exist;
            });
        });

        it('should not update flags due to error', function(done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.updateFlags({
                path: 'INBOX',
                uid: 123,
                unread: false,
                answered: true
            }, function(error, flags) {
                expect(error).to.exist;
                expect(flags).to.not.exist;

                done();
            });
        });

        it('should move a message', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.moveMessage.yields(null);

            imap.moveMessage({
                path: 'INBOX',
                uid: 123,
                destination: 'asdasd'
            }, function(error) {
                expect(error).to.be.null;
                expect(inboxMock.openMailbox.calledWith('INBOX')).to.be.true;
                expect(inboxMock.moveMessage.calledWith(123, 'asdasd')).to.be.true;
                done();
            });
        });

        it('should not move a message due to error', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.moveMessage.yields(new Error("AIN'T NOBODY GOT TIME FOR THAT?!"));

            imap.moveMessage({
                path: 'INBOX',
                uid: 123,
                destination: 'asdasd'
            }, function(error) {
                expect(error).to.exist;

                expect(inboxMock.openMailbox.calledWith('INBOX')).to.be.true;
                expect(inboxMock.moveMessage.calledWith(123, 'asdasd')).to.be.true;
                done();
            });
        });

        it('should not move a message due to not logged in', function() {
            imap._loggedIn = false;

            imap.moveMessage({}, function(error) {
                expect(error).to.exist;
            });
        });

        it('should delete message', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.deleteMessage.yields(null);

            imap.deleteMessage({
                path: 'INBOX',
                uid: 123,
            }, function(error) {
                expect(error).to.be.null;
                expect(inboxMock.openMailbox.calledWith('INBOX')).to.be.true;
                expect(inboxMock.deleteMessage.calledWith(123)).to.be.true;
                done();
            });

        });

        it('should not delete message due to error', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.deleteMessage.yields(new Error("AIN'T NOBODY GOT TIME FOR THAT?!"));

            imap.deleteMessage({
                path: 'INBOX',
                uid: 123,
            }, function(error) {
                expect(error).to.exist;
                expect(inboxMock.openMailbox.calledWith('INBOX')).to.be.true;
                expect(inboxMock.deleteMessage.calledWith(123)).to.be.true;
                done();
            });

        });

        it('should not delete message due to not logged in', function() {
            imap._loggedIn = false;

            imap.deleteMessage({}, function(error) {
                expect(error).to.exist;
            });

        });

        it('should stream attachments', function(done) {
            var ee = {}, streamBody = false;
            ee.on = function(ev, cb) {
                if (ev === 'data') {
                    if (!streamBody) {
                        cb('Content-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\n');
                        streamBody = true;
                    } else {
                        cb('Zm9vZm9vZm9vZm9vZm9v\r\n');
                    }
                } else if (ev === 'end') {
                    cb();
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.withArgs({
                uid: 123,
                part: '2'
            }).returns(ee);
            inboxMock.createStream.withArgs({
                uid: 123,
                part: '2.MIME'
            }).returns(ee);

            imap.getAttachment({
                path: 'INBOX',
                uid: 123,
                attachment: {
                    filename: 'foo.txt',
                    filesize: 20,
                    mimeType: 'text/plain',
                    part: '2'
                }
            }, function(error, attmt) {
                expect(error).to.be.null;
                expect(attmt).to.exist;
                expect(attmt.content).to.exist;
                expect(attmt.progress).to.equal(1);

                done();
            });
        });

        it('should not stream attachments when not logged in', function() {
            imap._loggedIn = false;
            imap.getAttachment({}, function(error) {
                expect(error).to.exist;
            });
        });

        it('should not stream attachments due to error while opening the mail box', function(done) {
            inboxMock.openMailbox.yields(new Error('fubar'));

            imap.getAttachment({
                path: 'INBOX',
                uid: 123,
                attachment: {
                    filename: 'foo.txt',
                    filesize: 20,
                    mimeType: 'text/plain',
                    part: '2'
                }
            }, function(error, attmt) {
                expect(error).to.exist;
                expect(attmt).to.not.exist;
                done();
            });
        });

        it('should not stream attachments due to stream error', function(done) {
            var ee = {};
            ee.on = function(event, cb) {
                if (event === 'error') {
                    cb(new Error('New Shit Has Come To Light!'));
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.withArgs({
                uid: 123,
                part: '2.MIME'
            }).returns(ee);


            imap.getAttachment({
                path: 'INBOX',
                uid: 123,
                attachment: {
                    filename: 'foo.txt',
                    filesize: 20,
                    mimeType: 'text/plain',
                    part: '2'
                }
            }, function(error, attmt) {
                expect(error).to.exist;
                expect(attmt).to.not.exist;
                done();
            });
        });

        it('should parse decrypted message block', function(done) {
            imap.parseDecryptedMessageBlock({
                message: {
                    attachments: []
                },
                block: 'Content-Type: multipart/signed;\r\n boundary="Apple-Mail=_433FF43D-2E02-4B38-942D-9AE0C7953710";\r\n    protocol="application/pgp-signature";\r\n   micalg=pgp-sha512\r\n\r\n\r\n--Apple-Mail=_433FF43D-2E02-4B38-942D-9AE0C7953710\r\nContent-Type: multipart/mixed;\r\n   boundary="Apple-Mail=_096BEDB9-F742-4C28-ABC3-225E390C070D"\r\n\r\n--Apple-Mail=_096BEDB9-F742-4C28-ABC3-225E390C070D\r\nContent-Disposition: attachment;\r\n  filename="user test 20131210 dad.md"\r\nContent-Type: application/octet-stream;\r\n x-unix-mode=0644;\r\n   name="user test 20131210 dad.md"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n- sichere und unsichere absender sind sichtbar und unterscheidbar\r\n- was ist ein pgp key?\r\n- hamburger button ist selbsterklaerend, "das kennt man"\r\n- arbeitsweise der app und value assumption sind verstaendlich\r\n--Apple-Mail=_096BEDB9-F742-4C28-ABC3-225E390C070D\r\nContent-Transfer-Encoding: 7bit\r\nContent-Type: text/plain;\r\n  charset=us-ascii\r\n\r\n\r\n\r\n--Apple-Mail=_096BEDB9-F742-4C28-ABC3-225E390C070D--\r\n\r\n--Apple-Mail=_433FF43D-2E02-4B38-942D-9AE0C7953710\r\nContent-Transfer-Encoding: 7bit\r\nContent-Disposition: attachment;\r\n   filename=signature.asc\r\nContent-Type: application/pgp-signature;\r\n  name=signature.asc\r\nContent-Description: Message signed with OpenPGP using GPGMail\r\n\r\n-----BEGIN PGP SIGNATURE-----\r\nComment: GPGTools - https://gpgtools.org\r\n\r\niQEcBAEBCgAGBQJS1+TtAAoJEDzmUwH7XO/cQoUH/AtZlFzQYLECIxrxj14PFDLP\r\nS36ZYBe2BUBDyGmacqGEGmHYyYbAWWz5ju1YQZq6tfS8YCZpV+YFrXhgx16MSXi6\r\neNC02rb0KztkaI7DlwA+AhfbZ8VwhXkHGKW8zG6fXSgmEoOZbbdHpb8aSshJWWBB\r\nDYUU2SNZQRO2OCuHLr7fGmCzpQGDehcRIhdFTTZIskuYOlGvlj+wDC7qGQ4QWmzi\r\nnaPOA4egdAkbskN3DqYm4Zi/pzR7oVSwQIyaYuh/Vw69m1P48Eg6HndJS6cZWk7m\r\nnA3YnoIna6JTanxRi0/jb2QFDpZ1eQvq8v9qZqTomRivZdqlyxO5/fQIYLhjJvg=\r\n=UF7l\r\n-----END PGP SIGNATURE-----\r\n\r\n--Apple-Mail=_433FF43D-2E02-4B38-942D-9AE0C7953710--\r\n'
            }, function(error, message) {
                expect(error).to.be.null;
                expect(message.body).to.exist;
                expect(message.attachments).to.not.be.empty;

                done();
            });
        });
    });
});