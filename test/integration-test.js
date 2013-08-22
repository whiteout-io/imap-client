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
    // host: 'secureimap.t-online.de',
    // auth: {
    //     user: "whiteout.test@t-online.de",
    //     pass: "@6IyFg1SIlWH91Co"
    // },
    host: 'imap.gmail.com',
    auth: {
        user: "safewithme.testuser@gmail.com",
        pass: "hellosafe"
    },
    secure: true
};

describe('ImapClient integration tests', function() {
    this.timeout(20000);

    var ic;

    beforeEach(function(done) {
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

    describe('ImapClient.listFolders', function() {
        it('should list an empty subfolder', function(done) {
            ic.listFolders('[Gmail]/Gesendet', function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.exist;
                expect(mailboxes).to.be.empty;
                done();
            });
        });
    });

    describe('ImapClient.listFolders', function() {
        it('should list subfolders', function(done) {
            ic.listFolders('[Gmail]', function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.exist;
                expect(mailboxes).to.not.be.empty;
                done();
            });
        });
    });

    describe('ImapClient.listMessages', function() {
        it('should list messages', function(done) {
            ic.listMessages({
                path: 'INBOX',
                offset: 0,
                length: 50
            }, function(error, messages) {
                expect(error).to.not.exist;
                expect(messages).to.not.be.empty;
                done();
            });
        });
    });

    describe('ImapClient.getMessage', function() {
        it('should get a specific message', function(done) {
            var attmtReceived = false,
                msgReceived = false;

            function attachmentReady(error, attmt) {
                expect(error).to.not.exist;
                expect(attmt.fileName).to.exist;
                expect(attmt.contentType).to.exist;
                expect(attmt.uint8Array).to.exist;
                attmtReceived = true;
                check();
            }

            function messageReady(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                msgReceived = true;
                check();
            }

            function check() {
                if (attmtReceived && msgReceived) {
                    done();
                }
            }

            ic.getMessage({
                path: 'INBOX',
                uid: 583
            }, messageReady, attachmentReady);
        });
    });

    describe('get two consecutive messages', function() {
        it('should receive the two messages', function(done) {
            var msg1 = false, msg2 = false;

            function firstMessageReady(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.id).to.equal('1376674819251.991dfde@Nodemailer');
                msg1 = true;
                check();
            }

            function secondMessageReady(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.id).to.equal('1376674818845.ee855fa8@Nodemailer');
                msg2 = true;
                check();
            }

            function check() {
                if (msg1 && msg2) {
                    done();
                }
            }

            ic.getMessage({
                path: 'INBOX',
                uid: 447
            }, firstMessageReady);

            ic.getMessage({
                path: 'INBOX',
                uid: 448
            }, secondMessageReady);
        });
    });
});