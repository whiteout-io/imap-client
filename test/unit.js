'use strict';

var rewire = require('rewire'),
    expect = require('chai').expect,
    inbox = require('inbox'),
    EventEmitter = require('events').EventEmitter,
    imapClient = rewire('../index'),
    JsMockito = require('jsmockito').JsMockito,
    JsHamcrest = require('jshamcrest').JsHamcrest,
    ibNsMock, loginOptions, ibMock, MpMock, dummyMail;

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

dummyMail = {
    to: 'zuhause@aol.com',
    from: 'zuhause@aol.com',
    subject: 'dummy subject',
    text: 'dummy text body'
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
        expect(o.listMailboxesCount).to.be.ok;
        o.listMailboxesCount--;

        if (callback) {
            callback(undefined, [{}, {}, {}]);
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

        callback(undefined, [{}, {}, {}, {}]);
    };

    o.createMessageStreamCount = 0;
    o.createMessageStream = function(uid) {
        expect(o.createMessageStreamCount).to.be.ok;
        o.createMessageStreamCount--;

        expect(uid).to.be.ok;
        return {
            pipe: function(obj) {
                obj.emit('end', dummyMail);
            }
        };
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

    describe('list mailboxes', function() {
        it('should list mailboxes', function(done) {
            ibMock.expect('listMailboxes');
            ic.listFolders(function(error, mailboxes) {
                expect(mailboxes.length).to.equal(3);
                done();
            });
        });
    });

    describe('list messages', function() {
        it('should list messages', function(done) {
            ibMock.expect('openMailbox');
            ibMock.expect('listMessages');
            ic.listMessages({
                folder: 'foobar',
                offset: 0,
                length: 4
            }, function(err, messages) {
                expect(messages.length).to.equal(4);
                done();
            });
        });
    });

    describe('list messages', function() {
        it('should list messages', function(done) {
            ibMock.expect('openMailbox');
            ibMock.expect('listMessages');
            ic.listMessages({
                folder: 'foobar',
                offset: 0,
                length: 4
            }, function(err, messages) {
                expect(messages.length).to.equal(4);
                done();
            });
        });
    });

    describe('get message', function() {
        it('should get a specific message', function(done){
            ibMock.expect('openMailbox');
            ibMock.expect('createMessageStream');
            ic.getMessage({
                folder: 'INBOX',
                uid: 123
            }, function(message) {
                expect(message).to.equal(dummyMail);
                done();
            });
        });
    });
});