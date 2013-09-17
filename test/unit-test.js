if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {
    'use strict';

    var expect = require('chai').expect,
        inbox = require('inbox'),
        Mailparser = require('mailparser').MailParser,
        sinon = require('sinon'),
        ImapClient = require('..'),
        loginOptions = {
            port: 1234,
            host: 'spiegel.de',
            auth: {
                user: 'dummyUser',
                pass: 'dummyPass'
            },
            secure: true
        };

    describe('ImapClient', function() {
        var imap, mailparserMock, inboxMock;

        beforeEach(function() {
            var createConnectionStub;

            mailparserMock = sinon.createStubInstance(Mailparser);
            inboxMock = sinon.createStubInstance(inbox.IMAPClient);

            createConnectionStub = sinon.stub(inbox, 'createConnection', function() {
                return inboxMock;
            });

            imap = new ImapClient(loginOptions, inbox);

            expect(createConnectionStub.called).to.be.true;
        });

        afterEach(function() {
            inbox.createConnection.restore();
        });


        it('should login', function(done) {
            // setup fixture
            inboxMock.once.yields();

            // execute test case
            imap.login(function() {
                expect(inboxMock.connect.calledOnce).to.be.true;
                expect(inboxMock.once.calledOnce).to.be.true;

                done();
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
            imap.listAllFolders(function(error, paths) {
                expect(error).to.not.exist;
                expect(paths).to.not.be.empty;
                expect(paths.length).to.equal(5);
                expect(inboxMock.listMailboxes.calledOnce).to.be.true;

                done();
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

        it('should return number of unread messages', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.unreadMessages.yields(null, 1337);

            imap.unreadMessages('INBOX', function(error, unreadMessages) {
                expect(error).to.be.null;
                expect(unreadMessages).to.equal(1337);
                done();
            });
        });


        it('should list messages', function(done) {
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
            }, function(error, unreadMessages) {
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

        it('should get a specific message with text only', function(done) {
            var ee = {};
            ee.pipe = function(parser) {
                parser.end("From: 'Sender Name' <sender@example.com>\r\nTo: 'Receiver Name' <receiver@example.com>\r\nSubject: Hello world!\r\n");
            };
            ee.on = function(ev, cb) {
                if (ev === 'data') {
                    cb('asdasd!');
                } else if (ev === 'end') {
                    cb();
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
                textOnly: true
            }, function(error, msg) {
                expect(error).to.be.null;
                expect(inboxMock.createStream.calledTwice).to.be.true;
                expect(msg.uid).to.equal(123);
                expect(msg.from).to.be.instanceof(Array);
                expect(msg.to).to.be.instanceof(Array);
                expect(msg.subject).to.equal('Hello world!');
                expect(msg.body).to.equal('asdasd!');

                done();
            });
        });

        it('should get a complete message', function(done) {
            var ee = {};
            ee.on = function(){};
            ee.pipe = function(parser) {
                parser.end("From: Felix Hammerl <felix.hammerl@gmail.com>\nContent-Type: multipart/mixed; boundary='Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A'\nSubject: test\nMessage-Id: <CAEB0027-379C-4E08-9367-8764B9A93D60@gmail.com>\nDate: Tue, 20 Aug 2013 13:47:05 +0200\nTo: 'safewithme.testuser@gmail.com' <safewithme.testuser@gmail.com>\nMime-Version: 1.0 (Mac OS X Mail 6.5)\n\n\n--Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A\nContent-Transfer-Encoding: 7bit\nContent-Type: text/plain;\n    charset=us-ascii\n\nasdasdasd\n\n\n--Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A\nContent-Disposition: attachment;\n    filename=README.md\nContent-Type: application/octet-stream;\n    x-unix-mode=0644;\n    name='README.md'\nContent-Transfer-Encoding: 7bit\n\nhtml5-mail\n==========\n\nHTML5 Mail App with Client-side Encryption\n\n## Getting started\nRequired packages: nodejs, npm\n\n    npm install\n    grunt dev\n    \nbrowse to http://localhost:8585\n--Apple-Mail=_5827A735-830A-490E-A024-8A991985B61A--");
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 1234,
                textOnly: false
            }, function(error, msg) {
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

        it('should catch stream error in full message mode', function(done) {
            var ee = {};
            ee.pipe = function(){};
            ee.on = function(event, cb) {
                if (event === 'error') {
                    cb(new Error('New Shit Has Come To Light!'));
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
                textOnly: true
            }, function(error, message) {
                expect(error).to.exist;
                expect(error.message).to.equal('New Shit Has Come To Light!');
                expect(message).to.not.exist;
                done();
            });
        });

        it('should catch stream error in text-only mode', function(done) {
            var ee = {};
            ee.pipe = function(){};
            ee.on = function(event, cb) {
                if (event === 'error') {
                    cb(new Error('New Shit Has Come To Light!'));
                }
            };

            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(ee);

            imap.getMessage({
                path: 'INBOX',
                uid: 123,
                textOnly: false
            }, function(error, message) {
                expect(error).to.exist;
                expect(error.message).to.equal('New Shit Has Come To Light!');
                expect(message).to.not.exist;
                done();
            });
        });

        it('should avoid invoking pipe on nonexistent stream in text-only mode', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(null);
            imap.getMessage({
                path: 'INBOX',
                uid: 123,
                textOnly: true
            }, function(error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;
                done();
            });
        });

        it('should avoid invoking pipe on nonexistent stream in full message mode', function(done) {
            inboxMock.openMailbox.yields();
            inboxMock.createStream.returns(null);
            imap.getMessage({
                path: 'INBOX',
                uid: 123,
                textOnly: false
            }, function(error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;
                done();
            });
        });
    });
});