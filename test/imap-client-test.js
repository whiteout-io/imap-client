'use strict';

var rewire = require('rewire'),
    expect = require('chai').expect,
    imapClient = rewire('../index'),
    inbox = require('inbox'),
    JsMockito = require('jsmockito').JsMockito,
    JsHamcrest = require('jshamcrest').JsHamcrest,
    ibNsMock, loginOptions, ibMock;

JsMockito.Integration.Nodeunit();
JsHamcrest.Integration.Nodeunit();

ibNsMock = mock(inbox);
imapClient.__set__({
    inbox: ibNsMock
});

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
    var o;

    o = {};

    o.expect = function(name) {
        o[name + 'Count']++;
    };

    o.closeCount = 0;
    o.close = function() {
        expect(o.closeCount).to.be.ok;
        o.closeCount--;
    };

    o.listMailboxesCount = 0;
    o.listMailboxes = function(callback) {
        expect(o.listMailboxesCount).to.be.ok;
        o.listMailboxesCount--;

        if(callback) {
            callback();
        }
    };

    o.resetMock = function() {
        o.closeCount = 0;
        o.listMailboxesCount = 0;
    };

    return o;
})();

when(ibNsMock).createConnection(anything()).thenReturn(ibMock);

describe('ImapClient', function() {
    describe('initialize with user and password', function() {
        it('should initialize', function() {
            var ic = new imapClient.ImapClient(loginOptions);
            expect(ic._client).to.equal(ibMock);
        });
    });
});

describe('ImapClient', function() {
    var ic;

    beforeEach(function() {
        ic = new imapClient.ImapClient(loginOptions);
        expect(ic._client).to.equal(ibMock);
    });


    afterEach(function() {
        ibMock.resetMock();
    });

    describe('logout', function() {
        it('should logout', function() {
            ibMock.expect('close');
            ic.logout();
        });
    });

    // describe('list mailboxes', function() {
    //     it('should list mailboxes', function(done) {
    //         ibMock.expect('listMailboxes');
    //         ic.listFolders(done);
    //     });
    // });

});

