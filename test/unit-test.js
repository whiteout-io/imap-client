'use strict';

var rewire = require('rewire'),
    expect = require('chai').expect,
    inbox = require('inbox'),
    EventEmitter = require('events').EventEmitter,
    imapClient = rewire('../index'),
    JsMockito = require('jsmockito').JsMockito,
    JsHamcrest = require('jshamcrest').JsHamcrest,
    ibNsMock, loginOptions, ibMock, MpMock, stream, attmt;


JsMockito.Integration.Nodeunit();
JsHamcrest.Integration.Nodeunit();

stream = new EventEmitter();
attmt = {
    generatedFileName: 'poopoo',
    contentType: 'text/poopoo',
    stream: stream
};

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

    o.createMessageStreamCount = 0;
    o.createMessageStream = function(uid) {
        var fakeStream = new EventEmitter(),
            message, headers = {
                id: '<5c4fbb30-042f-11e3-8ffd-0800200c9a66@foomail.com>',
                sentDate: new Date(),
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
            }, body = {
                type: 'text/plain',
                content: 'Lorem ipsum dolor sin amet...'
            };

        expect(o.createMessageStreamCount).to.be.ok;
        o.createMessageStreamCount--;

        if (uid > 0) {
            // this is the good case, a uid > 0 is valid in this test
            fakeStream.pipe = function(parser) {
                parser.emit('headersReady', headers);
                parser.emit('body', body);
                parser.emit('attachment', attmt);
                stream.emit('data', new Buffer('poo'));
                stream.emit('data', new Buffer('poo'));
                stream.emit('end');
                message = JSON.parse(JSON.stringify(headers));
                message.text = body.content;
                parser.emit('end', message);
            };
            return fakeStream;
        } else if (uid === 0) {
            fakeStream.pipe = function() {};
            setImmediate(function() {
                fakeStream.emit('error', new Error('EVERYTHING IS BROKEN!!!'));
            });
            return fakeStream;
        } else {
            // in case of uid < 0, return nothing, i.e. undefined
        }
    };

    o.resetMock = function() {
        o.closeCount = 0;
        o.listMailboxesCount = 0;
        o.openMailboxCount = 0;
        o.listMessagesCount = 0;
        o.createMessageStreamCount = 0;
        o.addFlagsCount = 0;
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


describe('ImapClient unit tests', function() {
    describe('initialize with user and password', function() {
        it('should initialize', function() {
            var ic = new imapClient.ImapClient(loginOptions);
            expect(ic._client).to.equal(ibMock);
        });
    });
});

describe('ImapClient unit tests', function() {
    var ic;

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
    });

    describe('list subfolders', function() {
        it('should list subfolders', function(done) {
            ibMock.expect('listMailboxes');
            ic.listFolders('AROUNDBOX/FooBar', function(error, mailboxes) {
                expect(mailboxes).to.not.be.empty;
                done();
            });
        });
    });

    describe('list an empty subfolder', function() {
        it('should list subfolders', function(done) {
            ibMock.expect('listMailboxes');
            ic.listFolders('AROUNDBOX/Duh', function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.exist;
                expect(mailboxes).to.be.empty;
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
        it('should get a specific message', function(done) {
            var attachmentParsed = false,
                bodyParsed = false;

            ibMock.expect('openMailbox');
            ibMock.expect('createMessageStream');
            ic.getMessage({
                path: 'INBOX',
                uid: 123,
                onMessage: function(error, message) {
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

                    expect(attachmentParsed).to.be.true;
                    expect(bodyParsed).to.be.true;

                    done();
                },
                onAttachment: function(error, attachment) {
                    expect(error).to.be.null;
                    expect(attachment.fileName).to.equal('poopoo');
                    expect(attachment.contentType).to.equal('text/poopoo');
                    expect(attachment.uint8Array).to.exist;

                    attachmentParsed = true;
                },
                onMessageBody: function(error, message) {
                    expect(error).to.be.null;
                    expect(message.id).to.equal('<5c4fbb30-042f-11e3-8ffd-0800200c9a66@foomail.com>');
                    expect(message.to).to.be.instanceof(Array);
                    expect(message.cc).to.be.instanceof(Array);
                    expect(message.bcc).to.be.instanceof(Array);
                    expect(message.subject).to.equal('Nodemailer Test');
                    expect(message.body).to.equal('Lorem ipsum dolor sin amet...');
                    expect(message.html).to.be.false;

                    bodyParsed = true;
                }
            });
        });
    });

    describe('getMessage with nonexistent uid', function() {
        it('should avoid invoking pipe on nonexistent stream', function(done) {
            ibMock.expect('openMailbox');
            ibMock.expect('createMessageStream');
            ic.getMessage({
                path: 'INBOX',
                uid: -1,
                onMessage: function(error, message) {
                    expect(error).to.exist;
                    expect(message).to.not.exist;
                    done();
                }
            });
        });

        it('should catch stream error', function(done) {
            ibMock.expect('openMailbox');
            ibMock.expect('createMessageStream');
            ic.getMessage({
                path: 'INBOX',
                uid: 0,
                onMessage: function(error, message) {
                    expect(error).to.exist;
                    expect(message).to.not.exist;
                    done();
                }
            });
        });
    });
});