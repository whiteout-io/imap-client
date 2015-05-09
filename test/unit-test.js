(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        ES6Promise.polyfill(); // load ES6 Promises polyfill
        define(['chai', 'sinon', 'browserbox', 'axe', 'imap-client'], factory);
    } else if (typeof exports === 'object') {
        require('es6-promise').polyfill(); // load ES6 Promises polyfill
        module.exports = factory(require('chai'), require('sinon'), require('browserbox'), require('axe-logger'), require('../src/imap-client'));
    }
})(function(chai, sinon, browserbox, axe, ImapClient) {
    'use strict';

    // don't log in the tests
    axe.removeAppender(axe.defaultAppender);

    describe('ImapClient', function() {
        var expect = chai.expect;
        chai.config.includeStack = true;

        var imap, bboxMock;

        beforeEach(function() {
            bboxMock = sinon.createStubInstance(browserbox);
            imap = new ImapClient({}, bboxMock);

            expect(imap._client).to.equal(bboxMock);

            imap._loggedIn = true;
        });

        describe('#login', function() {
            it('should login', function(done) {
                imap._loggedIn = false;

                imap.login().then(function() {
                    expect(imap._loggedIn).to.be.true;
                    expect(bboxMock.connect.calledOnce).to.be.true;
                }).then(done);
                bboxMock.onauth();
            });

            it('should not login when logged in', function(done) {
                imap._loggedIn = true;
                imap.login().then(done);
            });
        });

        describe('#logout', function() {
            it('should logout', function(done) {
                imap.logout().then(function() {
                    expect(bboxMock.close.calledOnce).to.be.true;
                    expect(imap._loggedIn).to.be.false;
                }).then(done);
                bboxMock.onclose();
            });

            it('should not logout when not logged in', function(done) {
                imap._loggedIn = false;
                imap.logout().then(done);
            });
        });

        describe('#_onError', function() {
            it('should report error for main imap connection', function(done) {
                imap.onError = function(error) {
                    expect(error).to.exist;
                    expect(imap._loggedIn).to.be.false;
                    expect(bboxMock.close.calledOnce).to.be.true;

                    done();
                };

                bboxMock.onerror();
            });

            it('should not error for listening imap connection', function() {
                imap._loggedIn = false;
                imap._listenerLoggedIn = true;
                imap._client = {}; // _client !== _listeningClient

                bboxMock.onerror();

                expect(imap._listenerLoggedIn).to.be.false;
                expect(bboxMock.close.calledOnce).to.be.true;
            });
        });

        describe('#_onClose', function() {
            it('should error for main imap connection', function(done) {
                imap.onError = function(error) {
                    expect(error).to.exist;
                    expect(imap._loggedIn).to.be.false;

                    done();
                };

                bboxMock.onclose();
            });

            it('should not error for listening imap connection', function() {
                imap._loggedIn = false;
                imap._listenerLoggedIn = true;
                imap._client = {}; // _client !== _listeningClient

                bboxMock.onclose();

                expect(imap._listenerLoggedIn).to.be.false;
            });

        });

        describe('#selectMailbox', function() {
            var path = 'foo';

            it('should select a different mailbox', function(done) {
                bboxMock.selectMailbox.withArgs(path).returns(resolves());

                imap.selectMailbox({
                    path: path
                }).then(done);
            });
        });

        describe('#listWellKnownFolders', function() {
            it('should list well known folders', function(done) {
                // setup fixture
                bboxMock.listMailboxes.returns(resolves({
                    children: [{
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
                }));

                // execute test case
                imap.listWellKnownFolders().then(function(folders) {
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
                    expect(folders.Trash).to.be.empty;

                    expect(folders.Other).to.be.instanceof(Array);

                    expect(bboxMock.listMailboxes.calledOnce).to.be.true;
                }).then(done);
            });

            it('should not list folders when not logged in', function(done) {
                imap._loggedIn = false;
                imap.listWellKnownFolders().catch(function() {
                    done();
                });
            });

            it('should error while listing folders', function(done) {
                // setup fixture
                bboxMock.listMailboxes.returns(rejects());

                // execute test case
                imap.listWellKnownFolders().catch(function() {
                    done();
                });
            });
        });

        describe('#createFolder', function() {
            it('should create folder with namespaces', function(done) {
                bboxMock.listNamespaces.returns(resolves({
                    "personal": [{
                        "prefix": "BLA/",
                        "delimiter": "/"
                    }],
                    "users": false,
                    "shared": false
                }));
                bboxMock.createMailbox.withArgs('BLA/foo').returns(resolves());

                imap.createFolder({
                    path: 'foo'
                }).then(function(fullPath) {
                    expect(fullPath).to.equal('BLA/foo');
                    expect(bboxMock.listNamespaces.calledOnce).to.be.true;
                    expect(bboxMock.createMailbox.calledOnce).to.be.true;
                    expect(imap._delimiter).to.exist;
                    expect(imap._prefix).to.exist;
                    done();
                });
            });

            it('should create folder without namespaces', function(done) {
                bboxMock.listNamespaces.returns(resolves());
                bboxMock.listMailboxes.returns(resolves({
                    "root": true,
                    "children": [{
                        "name": "INBOX",
                        "delimiter": "/",
                        "path": "INBOX"
                    }]
                }));
                bboxMock.createMailbox.withArgs('foo').returns(resolves());

                imap.createFolder({
                    path: 'foo'
                }).then(function(fullPath) {
                    expect(fullPath).to.equal('foo');
                    expect(bboxMock.listNamespaces.calledOnce).to.be.true;
                    expect(bboxMock.createMailbox.calledOnce).to.be.true;
                    expect(imap._delimiter).to.exist;
                    expect(imap._prefix).to.exist;
                    done();
                });
            });

            it('should create folder hierarchy with namespaces', function(done) {
                bboxMock.listNamespaces.returns(resolves({
                    "personal": [{
                        "prefix": "BLA/",
                        "delimiter": "/"
                    }],
                    "users": false,
                    "shared": false
                }));
                bboxMock.createMailbox.withArgs('foo/bar').returns(resolves());
                bboxMock.createMailbox.withArgs('foo/baz').returns(resolves());

                imap.createFolder({
                    path: ['foo', 'bar']
                }).then(function(fullPath) {
                    expect(fullPath).to.equal('BLA/foo/bar');

                    return imap.createFolder({
                        path: ['foo', 'baz']
                    });
                }).then(function(fullPath) {
                    expect(fullPath).to.equal('BLA/foo/baz');

                    expect(bboxMock.listNamespaces.calledOnce).to.be.true;
                    expect(bboxMock.createMailbox.calledTwice).to.be.true;
                    expect(imap._delimiter).to.exist;
                    expect(imap._prefix).to.exist;
                    done();
                });
            });

            it('should create folder hierarchy without namespaces', function(done) {
                bboxMock.listNamespaces.returns(resolves());
                bboxMock.listMailboxes.returns(resolves({
                    "root": true,
                    "children": [{
                        "name": "INBOX",
                        "delimiter": "/",
                        "path": "INBOX"
                    }]
                }));
                bboxMock.createMailbox.withArgs('foo').returns(resolves());

                imap.createFolder({
                    path: ['foo', 'bar']
                }).then(function(fullPath) {
                    expect(fullPath).to.equal('foo/bar');
                    expect(bboxMock.listNamespaces.calledOnce).to.be.true;
                    expect(bboxMock.createMailbox.calledOnce).to.be.true;
                    expect(imap._delimiter).to.exist;
                    expect(imap._prefix).to.exist;
                    done();
                });
            });
        });

        describe('#search', function() {
            it('should search answered', function(done) {
                bboxMock.search.withArgs({
                    all: true,
                    answered: true
                }).returns(resolves([1, 3, 5]));

                imap.search({
                    path: 'foobar',
                    answered: true
                }).then(function(uids) {
                    expect(uids.length).to.equal(3);
                }).then(done);
            });

            it('should search unanswered', function(done) {
                bboxMock.search.withArgs({
                    all: true,
                    unanswered: true
                }).returns(resolves([1, 3, 5]));

                imap.search({
                    path: 'foobar',
                    answered: false
                }).then(function(uids) {
                    expect(uids.length).to.equal(3);
                }).then(done);
            });

            it('should search header', function(done) {
                bboxMock.search.withArgs({
                    all: true,
                    header: ['Foo', 'bar']
                }).returns(resolves([1, 3, 5]));

                imap.search({
                    path: 'foobar',
                    header: ['Foo', 'bar']
                }).then(function(uids) {
                    expect(uids.length).to.equal(3);
                }).then(done);
            });

            it('should search read', function(done) {
                bboxMock.search.withArgs({
                    all: true,
                    seen: true
                }).returns(resolves([1, 3, 5]));

                imap.search({
                    path: 'foobar',
                    unread: false
                }).then(function(uids) {
                    expect(uids.length).to.equal(3);
                }).then(done);
            });

            it('should search unread', function(done) {
                bboxMock.search.withArgs({
                    all: true,
                    unseen: true
                }).returns(resolves([1, 3, 5]));

                imap.search({
                    path: 'foobar',
                    unread: true
                }).then(function(uids) {
                    expect(uids.length).to.equal(3);
                }).then(done);
            });

            it('should not search when not logged in', function(done) {
                imap._loggedIn = false;
                imap.search({
                    path: 'foobar',
                    subject: 'whiteout '
                }).catch(function() {
                    done();
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
                    flags: ['\\Seen', '\\Answered', '\\Flagged'],
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
                bboxMock.listMessages.withArgs('1:2', ['uid', 'bodystructure', 'flags', 'envelope', 'body.peek[header.fields (references)]']).returns(resolves(listing));

                imap.listMessages({
                    path: 'foobar',
                    firstUid: 1,
                    lastUid: 2
                }).then(function(msgs) {
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
                    expect(msgs[0].flagged).to.be.true;
                    expect(msgs[0].references).to.deep.equal(['abc', 'def']);

                    expect(msgs[0].encrypted).to.be.false;
                    expect(msgs[1].encrypted).to.be.true;

                    expect(msgs[0].bodyParts).to.not.be.empty;
                    expect(msgs[0].bodyParts[0].type).to.equal('text');
                    expect(msgs[0].bodyParts[0].partNumber).to.equal('1');
                    expect(msgs[0].bodyParts[1].type).to.equal('attachment');
                    expect(msgs[0].bodyParts[1].partNumber).to.equal('2');

                    expect(msgs[1].flagged).to.be.false;
                    expect(msgs[1].bodyParts[0].type).to.equal('text');
                    expect(msgs[1].bodyParts[1].type).to.equal('encrypted');
                    expect(msgs[1].bodyParts[1].partNumber).to.equal('2');
                    expect(msgs[1].references).to.deep.equal([]);
                }).then(done);
            });

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
                    flags: ['\\Seen', '\\Answered', '\\Flagged'],
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
                    uid: 4,
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
                bboxMock.listMessages.withArgs('1,4', ['uid', 'bodystructure', 'flags', 'envelope', 'body.peek[header.fields (references)]']).returns(resolves(listing));

                imap.listMessages({
                    path: 'foobar',
                    uids: [1,4]
                }).then(function(msgs) {
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
                    expect(msgs[0].flagged).to.be.true;
                    expect(msgs[0].references).to.deep.equal(['abc', 'def']);

                    expect(msgs[0].encrypted).to.be.false;
                    expect(msgs[1].encrypted).to.be.true;

                    expect(msgs[0].bodyParts).to.not.be.empty;
                    expect(msgs[0].bodyParts[0].type).to.equal('text');
                    expect(msgs[0].bodyParts[0].partNumber).to.equal('1');
                    expect(msgs[0].bodyParts[1].type).to.equal('attachment');
                    expect(msgs[0].bodyParts[1].partNumber).to.equal('2');

                    expect(msgs[1].flagged).to.be.false;
                    expect(msgs[1].bodyParts[0].type).to.equal('text');
                    expect(msgs[1].bodyParts[1].type).to.equal('encrypted');
                    expect(msgs[1].bodyParts[1].partNumber).to.equal('2');
                    expect(msgs[1].references).to.deep.equal([]);
                }).then(done);
            });

            it('should not list messages by uid due to list error', function(done) {
                bboxMock.listMessages.returns(rejects());

                imap.listMessages({
                    path: 'foobar',
                    firstUid: 1,
                    lastUid: 2
                }).catch(function() {
                    done();
                });
            });

            it('should not list messages by uid when not logged in', function(done) {
                imap._loggedIn = false;
                imap.listMessages({}).catch(function() {
                    done();
                });
            });
        });

        describe('#getBodyParts', function() {
            it('should get the plain text body', function(done) {
                bboxMock.listMessages.withArgs('123:123', ['body.peek[1.mime]', 'body.peek[1]', 'body.peek[2.mime]', 'body.peek[2]']).returns(resolves([{
                    'body[1.mime]': 'qwe',
                    'body[1]': 'asd',
                    'body[2.mime]': 'bla',
                    'body[2]': 'blubb'
                }]));

                var parts = [{
                    partNumber: '1'
                }, {
                    partNumber: '2'
                }];
                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: parts
                }).then(function(cbParts) {
                    expect(cbParts).to.equal(parts);

                    expect(parts[0].raw).to.equal('qweasd');
                    expect(parts[1].raw).to.equal('blablubb');
                    expect(parts[0].partNumber).to.not.exist;
                    expect(parts[1].partNumber).to.not.exist;
                }).then(done);
            });

            it('should do nothing for malformed body parts', function(done) {
                var parts = [{}, {}];

                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: parts
                }).then(function(cbParts) {
                    expect(cbParts).to.equal(parts);
                    expect(bboxMock.listMessages.called).to.be.false;
                }).then(done);
            });

            it('should fail when list fails', function(done) {
                bboxMock.listMessages.returns(rejects());

                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: [{
                        partNumber: '1'
                    }, {
                        partNumber: '2'
                    }]
                }).catch(function() {
                    done();
                });
            });

            it('should not work when not logged in', function(done) {
                imap._loggedIn = false;
                imap.getBodyParts({
                    path: 'foobar',
                    uid: 123,
                    bodyParts: [{
                        partNumber: '1'
                    }, {
                        partNumber: '2'
                    }]
                }).catch(function() {
                    done();
                });
            });
        });

        describe('#updateFlags', function() {
            it('should update flags', function(done) {
                bboxMock.setFlags.withArgs('123:123', {
                    add: ['\\Flagged', '\\Answered']
                }).returns(resolves());

                bboxMock.setFlags.withArgs('123:123', {
                    remove: ['\\Seen']
                }).returns(resolves());

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    unread: true,
                    flagged: true,
                    answered: true
                }).then(function() {
                    expect(bboxMock.setFlags.calledTwice).to.be.true;
                }).then(done);
            });

            it('should update flags and skip add', function(done) {
                bboxMock.setFlags.withArgs('123:123', {
                    remove: ['\\Answered']
                }).returns(resolves());

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    answered: false
                }).then(function() {
                    expect(bboxMock.setFlags.calledOnce).to.be.true;
                }).then(done);
            });

            it('should update flags and skip remove', function(done) {
                bboxMock.setFlags.withArgs('123:123', {
                    add: ['\\Answered']
                }).returns(resolves());

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    answered: true
                }).then(function() {
                    expect(bboxMock.setFlags.calledOnce).to.be.true;
                }).then(done);
            });

            it('should update flags and skip add', function(done) {
                bboxMock.setFlags.withArgs('123:123', {
                    remove: ['\\Seen']
                }).returns(resolves());

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    unread: true
                }).then(function() {
                    expect(bboxMock.setFlags.calledOnce).to.be.true;
                }).then(done);
            });

            it('should fail due to set flags error', function(done) {
                bboxMock.setFlags.returns(rejects());

                imap.updateFlags({
                    path: 'INBOX',
                    uid: 123,
                    unread: false,
                    answered: true
                }).catch(function() {
                    done();
                });
            });

            it('should not update flags when not logged in', function(done) {
                imap._loggedIn = false;
                imap.updateFlags({}).catch(function() {
                    done();
                });
            });
        });

        describe('#moveMessage', function() {
            it('should work', function(done) {
                bboxMock.moveMessages.withArgs('123:123', 'asdasd').returns(resolves());

                imap.moveMessage({
                    path: 'INBOX',
                    uid: 123,
                    destination: 'asdasd'
                }).then(function() {
                    expect(bboxMock.moveMessages.calledOnce).to.be.true;
                }).then(done);
            });

            it('should fail due to move error', function(done) {
                bboxMock.moveMessages.returns(rejects());

                imap.moveMessage({
                    path: 'INBOX',
                    uid: 123,
                    destination: 'asdasd'
                }).catch(function() {
                    done();
                });
            });

            it('should fail due to not logged in', function(done) {
                imap._loggedIn = false;

                imap.moveMessage({}).catch(function() {
                    done();
                });
            });

        });

        describe('#uploadMessage', function() {
            var msg = 'asdasdasdasd',
                path = 'INBOX';

            it('should work', function(done) {
                bboxMock.upload.withArgs(path, msg).returns(resolves());

                imap.uploadMessage({
                    path: path,
                    message: msg
                }).then(function() {
                    expect(bboxMock.upload.calledOnce).to.be.true;
                }).then(done);
            });

            it('should fail due to move error', function(done) {
                bboxMock.upload.returns(rejects());

                imap.uploadMessage({
                    path: path,
                    message: msg
                }).catch(function() {
                    done();
                });
            });
        });

        describe('#deleteMessage', function() {
            it('should work', function(done) {
                bboxMock.deleteMessages.withArgs('123:123').returns(resolves());

                imap.deleteMessage({
                    path: 'INBOX',
                    uid: 123,
                }).then(function() {
                    expect(bboxMock.deleteMessages.calledOnce).to.be.true;
                }).then(done);

            });

            it('should not fail due to delete error', function(done) {
                bboxMock.deleteMessages.returns(rejects());

                imap.deleteMessage({
                    path: 'INBOX',
                    uid: 123,
                }).catch(function() {
                    done();
                });
            });

            it('should not fail due to not logged in', function(done) {
                imap._loggedIn = false;

                imap.deleteMessage({}).catch(function() {
                    done();
                });
            });
        });

        describe('#listenForChanges', function() {
            it('should start listening', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').returns(resolves());

                imap.listenForChanges({
                    path: 'INBOX'
                }).then(function() {
                    expect(imap._listenerLoggedIn).to.be.true;
                    expect(bboxMock.connect.calledOnce).to.be.true;
                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                }).then(done);
                bboxMock.onauth();
            });

            it('should return an error when inbox could not be opened', function(done) {
                bboxMock.selectMailbox.withArgs('INBOX').returns(rejects());
                imap.listenForChanges({
                    path: 'INBOX'
                }).catch(function() {
                    done();
                });
                bboxMock.onauth();
            });
        });

        describe('#stopListeningForChanges', function() {
            it('should stop listening', function(done) {
                imap._listenerLoggedIn = true;

                imap.stopListeningForChanges().then(function() {
                    expect(bboxMock.close.calledOnce).to.be.true;
                    expect(imap._listenerLoggedIn).to.be.false;
                }).then(done);
                bboxMock.onclose();
            });
        });

        describe('#_ensurePath', function() {
            var ctx = {};

            it('should switch mailboxes', function(done) {
                bboxMock.selectMailbox.withArgs('qweasdzxc', {
                    ctx: ctx
                }).yields();
                imap._ensurePath('qweasdzxc')(ctx, function(err) {
                    expect(err).to.not.exist;
                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    done();
                });
            });

            it('should error during switching mailboxes', function(done) {
                bboxMock.selectMailbox.withArgs('qweasdzxc', {
                    ctx: ctx
                }).yields(new Error());
                imap._ensurePath('qweasdzxc')(ctx, function(err) {
                    expect(err).to.exist;
                    expect(bboxMock.selectMailbox.calledOnce).to.be.true;
                    done();
                });
            });
        });
    });

    function resolves(val) {
        return new Promise(function(res) {
            res(val);
        });
    }

    function rejects(val) {
        return new Promise(function(res, rej) {
            rej(val || new Error());
        });
    }
});