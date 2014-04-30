(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['chai', 'sinon', 'mailreader', 'browserbox', 'imap-client'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('chai'), require('sinon'), require('mailreader'), require('browserbox'), require('../src/imap-client'));
    }
})(function(chai, sinon, mailreader, browserbox, ImapClient) {
    'use strict';

    describe('ImapClient', function() {
        var expect = chai.expect;
        chai.Assertion.includeStack = true;

        var imap, bboxMock;

        beforeEach(function() {
            bboxMock = sinon.createStubInstance(browserbox);
            imap = new ImapClient({}, mailreader, bboxMock);
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
                    expect(bboxMock.connect.calledTwice).to.be.true;

                    done();
                });
                bboxMock.onauth();
                bboxMock.onauth();
            });

            it('should not login when logged in', function() {
                imap._loggedIn = true;
                imap.login(function(error) {
                    expect(error).to.exist;
                });
            });
        });

        describe('#logout', function() {
            it('should logout', function(done) {
                imap.logout(function() {
                    expect(bboxMock.close.calledTwice).to.be.true;
                    expect(imap._loggedIn).to.be.false;

                    done();
                });
                bboxMock.onclose();
                bboxMock.onclose();
            });

            it('should not logout when not logged in', function() {
                imap._loggedIn = false;
                imap.logout(function(error) {
                    expect(error).to.exist;
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
                expect(imap._currentPath).to.not.exist;
                expect(bboxMock.close.calledTwice).to.be.true; // once for client and for listeningClient
                expect(count).to.equal(1); // onError must only be called once
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
                        specialUse: '\\Drafts',
                        flags: ''
                    }, {
                        name: 'sent',
                        path: 'sent',
                        specialUse: '',
                        flags: '\\Sent'
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
                    expect(imap._currentPath).to.equal('foobar');
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

        describe('#listMessagesByUid', function() {
            it('should list messages by uid', function(done) {
                var listing = [{
                    uid: 1,
                    envelope: {
                        'message-id': 'beepboop',
                        from: ['zuhause@aol.com'],
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
                    }
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
                bboxMock.listMessages.withArgs('1:2', ['uid', 'bodystructure', 'flags', 'envelope'], {
                    byUid: true
                }).yieldsAsync(null, listing);

                imap.listMessagesByUid({
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
                    expect(msgs[0].to).to.be.instanceof(Array);
                    expect(msgs[0].subject).to.equal('SHIAAAT');
                    expect(msgs[0].unread).to.be.false;
                    expect(msgs[0].answered).to.be.true;
                    expect(msgs[0].attachments).to.not.be.empty;
                    expect(msgs[0].textParts[0]).to.equal(listing[0].bodystructure.childNodes[0]);
                    expect(msgs[0].encrypted).to.be.false;
                    expect(msgs[0].attachments).to.not.be.empty;
                    expect(msgs[0].attachments[0].filename).to.equal('foobar.md');
                    expect(msgs[0].attachments[0].filesize).to.equal(211);
                    expect(msgs[0].attachments[0].mimeType).to.equal('text/plain');
                    expect(msgs[0].attachments[0].part).to.equal('2');
                    expect(msgs[0].attachments[0].content).to.be.null;

                    expect(msgs[1].textParts[0]).to.equal(listing[1].bodystructure.childNodes[1].childNodes[1]);

                    done();
                });
            });

            it('should not list messages by uid due to select mailbox error', function(done) {
                bboxMock.selectMailbox.yields({});

                imap.listMessagesByUid({
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

                imap.listMessagesByUid({
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
                imap.listMessagesByUid({}, function(error) {
                    expect(error).to.exist;
                });
            });
        });

        describe('#getBody', function() {
            it('should have no text content', function(done) {
                imap.getBody({
                    message: {
                        textParts: []
                    }
                }, function(error, msg) {
                    expect(error).to.not.exist;
                    expect(msg.body).to.equal('This message contains no text content.');
                    done();
                });
            });

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
                sinon.stub(mailreader, 'parseText', function(opts, cb) {
                    expect(opts.message).to.exist;
                    // this gets called twice, once with raw text 'qweasd' and once with 'blablubb'
                    expect(opts.raw === 'qweasd' || opts.raw === 'blablubb').to.be.true;
                    opts.message.body += 'yadda';

                    cb();
                });

                imap.getBody({
                    path: 'foobar',
                    message: {
                        uid: 123,
                        textParts: [{
                            part: 1
                        }, {
                            part: 2
                        }]
                    }
                }, function(error, msg) {
                    expect(error).to.not.exist;
                    expect(msg.body).to.equal('yaddayadda');
                    expect(imap._currentPath).to.equal('foobar');

                    mailreader.parseText.restore();
                    done();
                });
            });

            it('should fail when list fails', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.listMessages.yieldsAsync({});

                imap.getBody({
                    path: 'foobar',
                    message: {
                        uid: 123,
                        textParts: [{
                            part: 1
                        }, {
                            part: 2
                        }]
                    }
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should fail when select mailbox fails', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync({});

                imap.getBody({
                    path: 'foobar',
                    message: {
                        uid: 123,
                        textParts: [{
                            part: 1
                        }, {
                            part: 2
                        }]
                    }
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should not work when not logged in', function(done) {
                imap._loggedIn = false;
                imap.getBody({
                    path: 'foobar',
                    message: {
                        uid: 123
                    }
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });
        });

        describe('#getAttachment', function() {
            it('should get the attachment', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.listMessages.withArgs('123:123', ['body.peek[1.mime]', 'body.peek[1]'], {
                    byUid: true
                }).yieldsAsync(null, [{
                    'body[1.mime]': 'qwe',
                    'body[1]': 'asd'
                }]);
                sinon.stub(mailreader, 'parseAttachment', function(opts, cb) {
                    expect(opts.attachment).to.exist;
                    expect(opts.raw).to.equal('qweasd');
                    opts.attachment.content = 'asdasd';

                    cb(null, opts.attachment);
                });

                imap.getAttachment({
                    path: 'foobar',
                    uid: 123,
                    attachment: {
                        part: 1
                    }
                }, function(error, attmt) {
                    expect(error).to.not.exist;
                    expect(attmt.content).to.exist;

                    mailreader.parseAttachment.restore();
                    done();
                });
            });

            it('should fail when list fails', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync();
                bboxMock.listMessages.yieldsAsync({});

                imap.getAttachment({
                    path: 'foobar',
                    uid: 123,
                    attachment: {
                        part: 1
                    }
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should fail when select mailbox fails', function(done) {
                bboxMock.selectMailbox.withArgs('foobar').yieldsAsync({});

                imap.getAttachment({
                    path: 'foobar',
                    uid: 123,
                    attachment: {
                        part: 1
                    }
                }, function(error) {
                    expect(error).to.exist;
                    done();
                });
            });

            it('should not work when not logged in', function(done) {
                imap._loggedIn = false;
                imap.getAttachment({
                    path: 'foobar',
                    uid: 123,
                    attachment: {
                        part: 1
                    }
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
                    expect(imap._currentPath).to.equal('INBOX');

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
                    expect(imap._currentPath).to.equal('INBOX');

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
                    expect(imap._currentPath).to.equal('INBOX');

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
                    expect(imap._currentPath).to.equal('INBOX');

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
                    expect(imap._currentPath).to.equal('INBOX');

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
                }, done);
                bboxMock.onupdate('exists');
            });

            it('should return an error when inbox could not be opened', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').yields({});

                imap.listenForChanges({
                    path: 'INBOX'
                }, function(err) {
                    expect(err).to.exist;

                    done();
                });
                bboxMock.onupdate('exists');
            });
        });
    });
});