(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['chai', 'sinon', 'browserbox', 'axe', 'imap-client'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('chai'), require('sinon'), require('browserbox'), require('axe-logger'), require('../src/imap-client'));
    }
})(function(chai, sinon, browserbox, axe, ImapClient) {
    'use strict';

    // don't log in the tests
    axe.removeAppender(axe.defaultAppender);

    describe('ImapClient', function() {
        var expect = chai.expect;
        chai.Assertion.includeStack = true;

        var imap, bboxMock;

        beforeEach(function() {
            bboxMock = sinon.createStubInstance(browserbox);
            imap = new ImapClient({}, bboxMock);
            expect(imap._client).to.equal(bboxMock);
            imap._loggedIn = true;
        });

        afterEach(function() {});

        describe('#login', function() {
            it('should login', function(done) {
                imap._loggedIn = false;

                imap.login(function(error) {
                    expect(error).to.not.exist;
                    expect(imap._loggedIn).to.be.true;
                    expect(bboxMock.connect.calledOnce).to.be.true;

                    done();
                });
                bboxMock.onauth();
            });

            it('should not login when logged in', function() {
                imap._loggedIn = true;
                imap.login(function(error) {
                    expect(error).to.not.exist;
                });
            });
        });

        describe('#logout', function() {
            it('should logout', function(done) {
                imap.logout(function() {
                    expect(bboxMock.close.calledOnce).to.be.true;
                    expect(imap._loggedIn).to.be.false;

                    done();
                });
                bboxMock.onclose();
            });

            it('should not logout when not logged in', function() {
                imap._loggedIn = false;
                imap.logout(function(error) {
                    expect(error).to.not.exist;
                });
            });
        });

        describe('#onError', function() {
            it('should report an error', function() {
                var count = 0;
                imap.onError = function(err) {
                    expect(err).to.exist;
                    count++;
                };
                imap._client.onerror({});
                imap._client.onerror({});
                imap._client.onerror({});

                expect(imap._loggedIn).to.be.false;
                expect(imap._errored).to.be.true;
                expect(bboxMock.close.calledTwice).to.be.true; // once for client and for listeningClient
                expect(count).to.equal(1); // onError must only be called once
            });
        });

        describe('#selectMailbox', function() {
            var path = 'foo';

            it('should select a different mailbox', function(done) {
                bboxMock.selectMailbox.withArgs(path).yieldsAsync();

                imap.selectMailbox({
                    path: path
                }, done);
            });

            it('should not re-select the same mailbox', function() {
                imap._client.selectedMailbox = path;
                imap.selectMailbox({
                    path: path
                });
            });
        });

        describe('#listWellKnownFolders', function() {
            it('should list well known folders', function(done) {
                // setup fixture
                bboxMock.listMailboxes.yieldsAsync(null, {
                    children: [{
                        name: 'INBOX',
                        path: 'INBOX'
                    }, {
                        name: 'drafts',
                        path: 'drafts',
                        specialUse: '\\Drafts'
                    }, {
                        name: 'sent',
                        path: 'sent',
                        specialUse: '\\Sent'
                    }]
                });

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

                    expect(bboxMock.listMailboxes.calledOnce).to.be.true;

                    done();
                });
            });

            it('should not list folders when not logged in', function() {
                imap._loggedIn = false;
                imap.listWellKnownFolders(function(error) {
                    expect(error).to.exist;
                });
            });

            it('should error while listing folders', function(done) {
                // setup fixture
                bboxMock.listMailboxes.yields({});

                // execute test case
                imap.listWellKnownFolders(function(error, mailboxes) {
                    expect(error).to.exist;
                    expect(mailboxes).to.not.exist;

                    done();
                });
            });
        });

        describe('#search', function() {
            it('should search answered', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.search.withArgs({
                    all: true,
                    answered: true
                }, {
                    byUid: true
                }).yieldsAsync(null, [1, 3, 5]);

                imap.search({
                    path: 'foobar',
                    answered: true
                }, function(error, uids) {
                    expect(error).to.be.null;
                    expect(uids.length).to.equal(3);
                    done();
                });
            });

            it('should search unanswered', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.search.withArgs({
                    all: true,
                    unanswered: true
                }, {
                    byUid: true
                }).yieldsAsync(null, [1, 3, 5]);

                imap.search({
                    path: 'foobar',
                    answered: false
                }, function(error, uids) {
                    expect(error).to.be.null;
                    expect(uids.length).to.equal(3);
                    done();
                });
            });

            it('should search read', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.search.withArgs({
                    all: true,
                    seen: true
                }, {
                    byUid: true
                }).yieldsAsync(null, [1, 3, 5]);

                imap.search({
                    path: 'foobar',
                    unread: false
                }, function(error, uids) {
                    expect(error).to.be.null;
                    expect(uids.length).to.equal(3);
                    done();
                });
            });

            it('should search unread', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.search.withArgs({
                    all: true,
                    unseen: true
                }, {
                    byUid: true
                }).yieldsAsync(null, [1, 3, 5]);

                imap.search({
                    path: 'foobar',
                    unread: true
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
        });

        describe('#listMessages', function() {
            it('should list messages by uid', function(done) {
                var listing = [{
                    uid: 1,
                    envelope: {
                        'message-id': 'beepboop',
                        from: ['zuhause@aol.com'],
                        'reply-to': ['zzz@aol.com'],
                        to: ['bankrupt@duh.com'],
                        subject: 'SHIAAAT',
                        date: new Date()
                    },
                    flags: ['\\Seen', '\\Answered'],
                    bodystructure: {
                        type: 'multipart/mixed',
                        childNodes: [{
                            part: '1',
                            type: 'text/plain'
                        }, {
                            part: '2',
                            type: 'text/plain',
                            size: 211,
                            disposition: 'attachment',
                            dispositionParameters: {
                                filename: 'foobar.md'
                            }
                        }]
                    },
                    'body[header.fields (references)]': 'References: <abc>\n <def>\n\n'
                }, {
                    uid: 2,
                    envelope: {
                        'message-id': 'ajabwelvzbslvnasd',
                    },
                    bodystructure: {
                        type: 'multipart/mixed',
                        childNodes: [{
                            part: '1',
                            type: 'text/plain',
                        }, {
                            part: '2',
                            type: 'multipart/encrypted',
                            childNodes: [{
                                part: '2.1',
                                type: 'application/pgp-encrypted',
                            }, {
                                part: '2.2',
                                type: 'application/octet-stream',
                            }]
                        }]
                    }
                }];
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.listMessages.withArgs('1:2', ['uid', 'bodystructure', 'flags', 'envelope', 'body.peek[header.fields (references)]'], {
                    byUid: true
                }).yieldsAsync(null, listing);

                imap.listMessages({
                    path: 'foobar',
                    firstUid: 1,
                    lastUid: 2
                }, function(error, msgs) {
                    expect(error).to.be.null;
                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    expect(bboxMock.listMessages.calledOnce).to.be.true;

                    expect(msgs.length).to.equal(2);

                    expect(msgs[0].uid).to.equal(1);
                    expect(msgs[0].id).to.equal('beepboop');
                    expect(msgs[0].from).to.be.instanceof(Array);
                    expect(msgs[0].replyTo).to.be.instanceof(Array);
                    expect(msgs[0].to).to.be.instanceof(Array);
                    expect(msgs[0].subject).to.equal('SHIAAAT');
                    expect(msgs[0].unread).to.be.false;
                    expect(msgs[0].answered).to.be.true;
                    expect(msgs[0].references).to.deep.equal(['abc', 'def']);

                    expect(msgs[0].encrypted).to.be.false;
                    expect(msgs[1].encrypted).to.be.true;

                    expect(msgs[0].bodyParts).to.not.be.empty;
                    expect(msgs[0].bodyParts[0].type).to.equal('text');
                    expect(msgs[0].bodyParts[0].partNumber).to.equal('1');
                    expect(msgs[0].bodyParts[1].type).to.equal('attachment');
                    expect(msgs[0].bodyParts[1].partNumber).to.equal('2');

                    expect(msgs[1].bodyParts[0].type).to.equal('text');
                    expect(msgs[1].bodyParts[1].type).to.equal('encrypted');
                    expect(msgs[1].bodyParts[1].partNumber).to.equal('2');
                    expect(msgs[1].references).to.deep.equal([]);

                    done();
                });
            });

            it('should not list messages by uid due to select mailbox error', function(done) {
                bboxMock.selectMailbox.yields({});

                imap.listMessages({
                    path: 'foobar',
                    firstUid: 1,
                    lastUid: 2
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should not list messages by uid due to list error', function(done) {
                bboxMock.selectMailbox.yields();
                bboxMock.listMessages.yields({});

                imap.listMessages({
                    path: 'foobar',
                    firstUid: 1,
                    lastUid: 2
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should not list messages by uid when not logged in', function() {
                imap._loggedIn = false;
                imap.listMessages({}, function(error) {
                    expect(error).to.exist;
                });
            });
        });

        describe('#getBodyParts', function() {
            it('should get the plain text body', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.listMessages.withArgs('123:123', ['body.peek[1.mime]', 'body.peek[1]', 'body.peek[2.mime]', 'body.peek[2]'], {
                    byUid: true
                }).yieldsAsync(null, [{
                    'body[1.mime]': 'qwe',
                    'body[1]': 'asd',
                    'body[2.mime]': 'bla',
                    'body[2]': 'blubb'
                }]);

                var parts = [{
                    partNumber: '1'
                }, {
                    partNumber: '2'
                }];
                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: parts
                }, function(error, cbParts) {
                    expect(error).to.not.exist;
                    expect(cbParts).to.equal(parts);

                    expect(parts[0].raw).to.equal('qweasd');
                    expect(parts[1].raw).to.equal('blablubb');
                    expect(parts[0].partNumber).to.not.exist;
                    expect(parts[1].partNumber).to.not.exist;

                    done();
                });
            });

            it('should do nothing for malformed body parts', function(done) {
                var parts = [{}, {}];

                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: parts
                }, function(error, cbParts) {
                    expect(error).to.not.exist;
                    expect(cbParts).to.equal(parts);

                    expect(bboxMock.selectMailbox.called).to.be.false;
                    expect(bboxMock.listMessages.called).to.be.false;

                    done();
                });
            });

            it('should fail when list fails', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.listMessages.yieldsAsync({});

                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: [{
                        partNumber: '1'
                    }, {
                        partNumber: '2'
                    }]
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should fail when select mailbox fails', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync({});

                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: [{
                        partNumber: '1'
                    }, {
                        partNumber: '2'
                    }]
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should not work when not logged in', function(done) {
                imap._loggedIn = false;
                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });
        });

        describe('#updateFlags', function() {
            it('should update flags', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields();
                bboxMock.setFlags.withArgs('123:123', {
                    add: ['\\Answered']
                }, {
                    byUid: true
                }).yields(null, [{
                    flags: ['\\Answered']
                }]);
                bboxMock.setFlags.withArgs('123:123', {
                    remove: ['\\Seen']
                }, {
                    byUid: true
                }).yields(null, [{
                    flags: ['\\Answered']
                }]);

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    unread: true,
                    answered: true
                }, function(error, flags) {
                    expect(error).to.be.null;
                    expect(flags.unread).to.be.true;
                    expect(flags.answered).to.be.true;

                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    expect(bboxMock.setFlags.calledTwice).to.be.true;

                    done();
                });
            });

            it('should update flags and skip remove', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields();
                bboxMock.setFlags.withArgs('123:123', {
                    add: ['\\Answered']
                }, {
                    byUid: true
                }).yields(null, [{
                    flags: ['\\Answered']
                }]);

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    answered: true
                }, function(error, flags) {
                    expect(error).to.be.null;
                    expect(flags.unread).to.be.true;
                    expect(flags.answered).to.be.true;

                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    expect(bboxMock.setFlags.calledOnce).to.be.true;

                    done();
                });
            });

            it('should update flags and skip add', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields();
                bboxMock.setFlags.withArgs('123:123', {
                    remove: ['\\Seen']
                }, {
                    byUid: true
                }).yields(null, [{
                    flags: []
                }]);

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    unread: true
                }, function(error, flags) {
                    expect(error).to.be.null;
                    expect(flags.unread).to.be.true;
                    expect(flags.answered).to.be.false;

                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    expect(bboxMock.setFlags.calledOnce).to.be.true;

                    done();
                });
            });

            it('should fail due to set flags error', function(done) {
                bboxMock.selectMailbox.yieldsAsync();
                bboxMock.setFlags.yieldsAsync({});

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

            it('should fail due to select mailbox error', function(done) {
                bboxMock.selectMailbox.yieldsAsync({});

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

            it('should not update flags when not logged in', function() {
                imap._loggedIn = false;
                imap.updateFlags({}, function(error) {
                    expect(error).to.exist;
                });
            });
        });

        describe('#moveMessage', function() {
            it('should work', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields();
                bboxMock.moveMessages.withArgs('123:123', 'asdasd', {
                    byUid: true
                }).yields();

                imap.moveMessage({
                    path: 'INBOX',
                    uid: 123,
                    destination: 'asdasd'
                }, function(error) {
                    expect(error).to.not.exist;
                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    expect(bboxMock.moveMessages.calledOnce).to.be.true;

                    done();
                });
            });

            it('should fail due to move error', function(done) {
                bboxMock.selectMailbox.yields();
                bboxMock.moveMessages.yields({});

                imap.moveMessage({
                    path: 'INBOX',
                    uid: 123,
                    destination: 'asdasd'
                }, function(error) {
                    expect(error).to.exist;

                    done();
                });
            });

            it('should fail due to select mailbox error', function(done) {
                bboxMock.selectMailbox.yieldsAsync({});

                imap.moveMessage({
                    path: 'INBOX',
                    uid: 123,
                    destination: 'asdasd'
                }, function(error) {
                    expect(error).to.exist;

                    done();
                });
            });

            it('should fail due to not logged in', function() {
                imap._loggedIn = false;

                imap.moveMessage({}, function(error) {
                    expect(error).to.exist;
                });
            });

        });

        describe('#uploadMessage', function() {
            var msg = 'asdasdasdasd',
                path = 'INBOX';

            it('should work', function(done) {
                bboxMock.upload.withArgs(path, msg).yields();

                imap.uploadMessage({
                    path: path,
                    message: msg
                }, function(error) {
                    expect(error).to.not.exist;
                    expect(bboxMock.upload.calledOnce).to.be.true;

                    done();
                });
            });

            it('should fail due to move error', function(done) {
                bboxMock.upload.yields({});

                imap.uploadMessage({
                    path: path,
                    message: msg
                }, function(error) {
                    expect(error).to.exist;

                    done();
                });
            });
        });

        describe('#deleteMessage', function() {
            it('should work', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields();
                bboxMock.deleteMessages.withArgs('123:123', {
                    byUid: true
                }).yields(null);

                imap.deleteMessage({
                    path: 'INBOX',
                    uid: 123,
                }, function(error) {
                    expect(error).to.be.null;
                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    expect(bboxMock.deleteMessages.calledOnce).to.be.true;

                    done();
                });

            });

            it('should not fail due to delete error', function(done) {
                bboxMock.selectMailbox.yields();
                bboxMock.deleteMessages.yields({});

                imap.deleteMessage({
                    path: 'INBOX',
                    uid: 123,
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should fail due to select mailbox error', function(done) {
                bboxMock.selectMailbox.yieldsAsync({});

                imap.deleteMessage({
                    path: 'INBOX',
                    uid: 123,
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should not fail due to not logged in', function() {
                imap._loggedIn = false;

                imap.deleteMessage({}, function(error) {
                    expect(error).to.exist;
                });
            });
        });

        describe('#listenForChanges', function() {
            it('should start listening', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields();

                imap.listenForChanges({
                    path: 'INBOX'
                }, function(err) {
                    expect(err).to.not.exist;
                    expect(imap._listenerLoggedIn).to.be.true;
                    expect(bboxMock.connect.calledOnce).to.be.true;
                    done();
                });
                bboxMock.onauth();
            });

            it('should return an error when inbox could not be opened', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields({});

                imap.listenForChanges({
                    path: 'INBOX'
                }, function(err) {
                    expect(err).to.exist;
                    done();
                });
                bboxMock.onauth();
            });
        });

        describe('#stopListeningForChanges', function() {
            it('should stop listening', function(done) {
                imap._listenerLoggedIn = true;

                imap.stopListeningForChanges(function(err) {
                    expect(err).to.not.exist;
                    expect(bboxMock.close.calledOnce).to.be.true;
                    expect(imap._listenerLoggedIn).to.be.false;
                    done();
                });
                bboxMock.onclose();
            });
        });
    });
});