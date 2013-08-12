'use strict';

var ImapClient, loginOptions, expect;

if (typeof window === 'undefined') {
    ImapClient = require('../index').ImapClient;
    expect = require('chai').expect;
} else {
    ImapClient = window.ImapClient;
    expect = window.chai.expect;
}

loginOptions = {
    port: 993,
    host: 'imap.gmail.com',
    auth: {
        user: "safewithme.testuser@gmail.com",
        pass: "hellosafe"
    },
    secure: true
};

describe('ImapClient integration tests', function() {
    var ic;

    beforeEach(function(done) {
        this.timeout(5000);
        ic = new ImapClient(loginOptions);
        ic.login(done);
    });


    afterEach(function(done) {
        ic.logout(done);
    });

    describe('ImapClient.listFolders', function() {
        it('should list folders', function(done) {
            ic.listFolders(function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.exist;
                done();
            });
        });
    });

    describe('ImapClient.listMessages', function() {
        it('should list messages', function(done) {
            ic.listMessages({
                folder: 'INBOX',
                offset: 0,
                length: 10
            }, function(error, messages) {
                expect(error).to.not.exist;
                expect(messages).to.exist;
                done();
            });
        });
    });

    describe('ImapClient.getMessage', function() {
        it('should get a specific message', function(done) {
            ic.getMessage({
                folder: 'INBOX',
                uid: 127
            }, function(message) {
                expect(message).to.exist;
                done();
            });
        });
    });
});