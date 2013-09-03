'use strict';

var rewire = require('rewire'),
    expect = require('chai').expect,
    inbox = require('inbox'),
    EventEmitter = require('events').EventEmitter,
    imapClient = rewire('../index'),
    JsMockito = require('jsmockito').JsMockito,
    JsHamcrest = require('jshamcrest').JsHamcrest,
    ibNsMock, loginOptions, ibMock, MpMock;


JsMockito.Integration.Nodeunit();
JsHamcrest.Integration.Nodeunit();

loginOptions = {
    port: 1234,
    host: 'spiegel.de',
    auth: {
        user: 'dummyUser',
        pass: 'dummyPass'
    },
    secure: true
};

ibMock = (function() {
    var o = new EventEmitter();

    o.expect = function(name) {
        o[name + 'Count']++;
    };

    o.closeCount = 0;
    o.close = function() {
        expect(o.closeCount).to.be.ok;
        o.closeCount--;
        o.emit('close');
    };

    o.unreadMessagesCount = 0;
    o.unreadMessages = function(cb) {
        expect(o.unreadMessagesCount).to.be.ok;
        o.unreadMessagesCount--;
        cb(null, 1337);
    };

    o.connectCount = 0;
    o.connect = function() {
        expect(o.connectCount).to.be.ok;
        o.connectCount--;
        o.emit('connect');
    };

    o.listMailboxesCount = 0;
    o.listMailboxes = function(callback) {
        var hasNoChildren, listNoChildren;

        hasNoChildren = function() {
            return false;
        };
        listNoChildren = function(cb) {
            cb(null, []);
        };

        expect(o.listMailboxesCount).to.be.ok;
        o.listMailboxesCount--;

        if (callback) {
            callback(undefined, [{
                path: 'AROUNDBOX',
                listChildren: function(cb) {
                    cb(null, [{
                        path: 'AROUNDBOX/FooBar',
                        listChildren: function(cb) {
                            cb(null, [{}, {}, {}, {}, {}]);
                        },
                        hasChildren: hasNoChildren
                    }, {
                        path: 'AROUNDBOX/PooBar',
                        hasChildren: hasNoChildren,
                        listChildren: listNoChildren
                    }, {
                        path: 'AROUNDBOX/Duh',
                        hasChildren: hasNoChildren,
                        listChildren: listNoChildren
                    }, {
                        path: 'AROUNDBOX/asdasdasd',
                        hasChildren: hasNoChildren,
                        listChildren: listNoChildren
                    }]);
                }
            }, {
                path: 'INBOX',
                hasChildren: hasNoChildren,
                listChildren: listNoChildren
            }, {
                path: 'OUTBOX',
                hasChildren: hasNoChildren,
                listChildren: listNoChildren
            }]);
        }
    };

    o.openMailboxCount = 0;
    o.openMailbox = function(path, options, callback) {
        expect(o.openMailboxCount).to.be.ok;
        o.openMailboxCount--;

        if (path && callback) {
            callback(undefined, {
                name: path,
                path: path,
                hasChildren: false,
                disabled: false
            });
        }
    };

    o.listMessagesCount = 0;
    o.listMessages = function(from, limit, callback) {
        expect(o.listMessagesCount).to.be.ok;
        o.listMessagesCount--;

        callback(undefined, [{
            UID: 126,
            date: new Date(),
            from: {
                address: 'stuff@bla.io',
                name: 'Test Sender'
            },
            messageId: '<5c4fbb30-042f-11e3-8ffd-0800200c9a66@foomail.com>',
            title: 'Nodemailer Test',
            to: [{
                address: 'testtest1@gmail.com',
                name: 'testtest1'
            }],
            cc: [{
                address: 'testtest2@gmail.com',
                name: 'testtest2'
            }],
            bcc: [{
                address: 'testtest3@gmail.com',
                name: 'testtest3'
            }],
            flags: ['\\Answered']
        }, {
            UID: 127,
            date: new Date(),
            from: {
                address: 'stuff@bla.io',
                name: 'Test Sender'
            },
            messageId: '<5c33bb30-042f-11e3-8ffd-0800200c9a66@foomail.com>',
            title: 'Nodemailer Test',
            to: [{
                address: 'testtest1@gmail.com',
                name: 'testtest1'
            }],
            cc: [],
            bcc: [],
            flags: ['\\Seen']
        }]);
    };

    o.createStreamCount = 0;
    o.createStream = function(options) {
        var fakeStream = new EventEmitter(),
            headers;

        expect(o.createStreamCount).to.be.ok;
        o.createStreamCount--;

        headers = {
            messageId: '<5c4fbb30-042f-11e3-8ffd-0800200c9a66@foomail.com>',
            date: new Date(),
            from: [{
                address: 'stuff@bla.io',
                name: 'Test Sender'
            }],
            to: [{
                address: 'testtest1@gmail.com',
                name: 'testtest1'
            }],
            cc: [{
                address: 'testtest2@gmail.com',
                name: 'testtest2'
            }],
            bcc: [{
                address: 'testtest3@gmail.com',
                name: 'testtest3'
            }],
            subject: 'Nodemailer Test'
        };

        if (options.uid > 0) {
            // this is the good case, a uid > 0 is valid in this test

            if (options.part === '') {
                fakeStream.pipe = function(parser) {
                    var fullMessage = JSON.parse(JSON.stringify(headers));
                    fullMessage.text = 'Lorem ipsum dolor sin amet...';
                    fullMessage.attachments = [{
                        generatedFileName: 'poopoo',
                        contentType: 'text/poopoo',
                        content: new Buffer('poopoo')
                    }];
                    parser.emit('end', fullMessage);
                };
            } else if (options.part === 'HEADER') {
                fakeStream.pipe = function(parser) {
                    parser.emit('end', headers);
                };
            } else if (options.part === '1') {
                process.nextTick(function() {
                    fakeStream.emit('data', new Buffer('Lorem ipsum dolor sin amet...'));
                    fakeStream.emit('end');
                });
            }
            return fakeStream;
        } else if (options.uid === 0) {
            fakeStream.pipe = function() {};
            process.nextTick(function() {
                fakeStream.emit('error', new Error('EVERYTHING IS BROKEN!!!'));
            });
            return fakeStream;
        } else {
            // in case of uid < 0, return nothing, i.e. undefined
        }
    };

    o.resetMock = function() {
        o.closeCount = 0;
        o.connectCount = 0;
        o.unreadMessagesCount = 0;
        o.listMailboxesCount = 0;
        o.openMailboxCount = 0;
        o.listMessagesCount = 0;
        o.createMessageStreamCount = 0;
    };

    return o;
})();
ibNsMock = mock(inbox);
when(ibNsMock).createConnection(anything()).thenReturn(ibMock);

MpMock = mockFunction();
when(MpMock)().thenReturn(new EventEmitter());

imapClient.__set__({
    MailParser: MpMock,
    inbox: ibNsMock
});


describe('ImapClient', function() {
    var ic;

    describe('initializer', function() {
        it('should initialize with user and password', function() {
            ic = new imapClient.ImapClient(loginOptions);
            expect(ic._client).to.equal(ibMock);
        });
    });

    describe('instance method', function() {
        beforeEach(function() {
            ic = new imapClient.ImapClient(loginOptions);
            expect(ic._client).to.equal(ibMock);
        });


        afterEach(function() {
            ibMock.resetMock();
        });

        describe('login', function() {
            it('should login', function(done) {
                ibMock.expect('connect');
                ic.login(done);
            });
        });

        describe('logout', function() {
            it('should logout', function(done) {
                ibMock.expect('close');
                ic.logout(done);
            });
        });

        describe('list folders', function() {
            it('should list folders', function(done) {
                ibMock.expect('listMailboxes');
                ic.listFolders(function(error, mailboxes) {
                    expect(mailboxes.length).to.equal(3);
                    done();
                });
            });

            it('should list subfolders', function(done) {
                ibMock.expect('listMailboxes');
                ic.listFolders('AROUNDBOX/FooBar', function(error, mailboxes) {
                    expect(mailboxes).to.not.be.empty;
                    done();
                });
            });

            it('should an empty subfolder', function(done) {
                ibMock.expect('listMailboxes');
                ic.listFolders('AROUNDBOX/Duh', function(error, mailboxes) {
                    expect(error).to.not.exist;
                    expect(mailboxes).to.exist;
                    expect(mailboxes).to.be.empty;
                    done();
                });
            });
        });

        describe('unread messages', function() {
            it('should return number of unread messages', function(done) {
                ibMock.expect('openMailbox');
                ibMock.expect('unreadMessages');
                ic.unreadMessages('INBOX', function(error, unreadMessages) {
                    expect(error).to.be.null;
                    expect(unreadMessages).to.equal(1337);
                    done();
                });
            });
        });


        describe('list messages', function() {
            it('should list messages', function(done) {
                ibMock.expect('openMailbox');
                ibMock.expect('listMessages');
                ic.listMessages({
                    path: 'foobar',
                    offset: 0,
                    length: 2
                }, function(err, messages) {
                    expect(messages.length).to.equal(2);
                    expect(messages[1].id).to.equal('<5c4fbb30-042f-11e3-8ffd-0800200c9a66@foomail.com>');
                    expect(messages[1].uid).to.equal(126);
                    expect(messages[1].from).to.deep.equal([{
                        address: 'stuff@bla.io',
                        name: 'Test Sender'
                    }]);
                    expect(messages[1].to).to.deep.equal([{
                        address: 'testtest1@gmail.com',
                        name: 'testtest1'
                    }]);
                    expect(messages[1].cc).to.deep.equal([{
                        address: 'testtest2@gmail.com',
                        name: 'testtest2'
                    }]);
                    expect(messages[1].bcc).to.deep.equal([{
                        address: 'testtest3@gmail.com',
                        name: 'testtest3'
                    }]);
                    expect(messages[1].subject).to.equal('Nodemailer Test');
                    expect(messages[1].body).to.not.be.ok;
                    expect(messages[1].sentDate).to.be.ok;
                    expect(messages[1].unread).to.be.true;
                    expect(messages[1].answered).to.be.true;
                    expect(messages[0].unread).to.be.false;
                    expect(messages[0].answered).to.be.false;
                    done();
                });
            });
        });

        describe('get message', function() {
            it('should get a specific message with text and attachment', function(done) {
                ibMock.expect('openMailbox');
                ibMock.expect('createStream');
                ic.getMessage({
                    path: 'INBOX',
                    uid: 123,
                    textOnly: false
                }, function(error, message) {
                    expect(error).to.be.null;
                    expect(message.id).to.equal('<5c4fbb30-042f-11e3-8ffd-0800200c9a66@foomail.com>');
                    expect(message.from).to.deep.equal([{
                        address: 'stuff@bla.io',
                        name: 'Test Sender'
                    }]);
                    expect(message.to).to.be.instanceof(Array);
                    expect(message.cc).to.be.instanceof(Array);
                    expect(message.bcc).to.be.instanceof(Array);
                    expect(message.subject).to.equal('Nodemailer Test');
                    expect(message.body).to.equal('Lorem ipsum dolor sin amet...');
                    expect(message.html).to.be.false;
                    expect(message.sentDate).to.be.ok;
                    expect(message.attachments.length).to.equal(1);
                    expect(message.attachments[0].fileName).to.equal('poopoo');
                    expect(message.attachments[0].contentType).to.equal('text/poopoo');
                    expect(message.attachments[0].uint8Array).to.exist;

                    done();
                });
            });

            it('should get a specific message with text only', function(done) {
                ibMock.expect('openMailbox');
                ibMock.expect('createStream');
                ibMock.expect('createStream');
                ic.getMessage({
                    path: 'INBOX',
                    uid: 123,
                    textOnly: true
                }, function(error, message) {
                    expect(error).to.be.null;
                    expect(message.id).to.equal('<5c4fbb30-042f-11e3-8ffd-0800200c9a66@foomail.com>');
                    expect(message.from).to.deep.equal([{
                        address: 'stuff@bla.io',
                        name: 'Test Sender'
                    }]);
                    expect(message.to).to.be.instanceof(Array);
                    expect(message.cc).to.be.instanceof(Array);
                    expect(message.bcc).to.be.instanceof(Array);
                    expect(message.subject).to.equal('Nodemailer Test');
                    expect(message.body).to.equal('Lorem ipsum dolor sin amet...');
                    expect(message.html).to.be.false;
                    expect(message.sentDate).to.be.ok;
                    expect(message.attachments).to.be.instanceof(Array);

                    done();
                });
            });

            it('should avoid invoking pipe on nonexistent stream', function(done) {
                ibMock.expect('openMailbox');
                ibMock.expect('createStream');
                ic.getMessage({
                    path: 'INBOX',
                    uid: -1,
                    textOnly: false
                }, function(error, message) {
                    expect(error).to.exist;
                    expect(message).to.not.exist;
                    done();
                });
            });

            it('should catch stream error', function(done) {
                ibMock.expect('openMailbox');
                ibMock.expect('createStream');
                ic.getMessage({
                    path: 'INBOX',
                    uid: 0,
                    textOnly: false
                }, function(error, message) {
                    expect(error).to.exist;
                    expect(message).to.not.exist;
                    done();
                });
            });
        });
    });
});