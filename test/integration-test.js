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

        it('should list an empty subfolder', function(done) {
            ic.listFolders('[Gmail]/Gesendet', function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.exist;
                expect(mailboxes).to.be.empty;
                done();
            });
        });

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
                var message;

                expect(error).to.not.exist;
                expect(messages).to.not.be.empty;
                for (var i = messages.length - 1; i >= 0; i--) {
                    message = messages[i];
                    if (message.uid === 653) {
                        expect(message.unread).to.be.true;
                    } else if (message.uid === 447) {
                        expect(message.unread).to.be.false;
                    }
                }
                done();
            });
        });
    });

    describe('ImapClient.getMessage', function() {
        it('should get a specific message', function(done) {
            var attachmentParsed = false,
                bodyParsed = false;

            function onAttachment(attmt) {
                expect(attmt.fileName).to.exist;
                expect(attmt.contentType).to.exist;
                expect(attmt.uint8Array).to.exist;
                attachmentParsed = true;
            }

            function onMessageBody(body) {
                expect(body.type).to.equal('text/plain');
                expect(body.content).to.exist;
                bodyParsed = true;
            }

            function onMessage(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.attachments).to.not.be.empty;

                expect(attachmentParsed).to.be.true;
                expect(bodyParsed).to.be.true;
                done();
            }

            ic.getMessage({
                path: 'INBOX',
                uid: 583,
                onMessage: onMessage,
                onAttachment: onAttachment,
                onMessageBody: onMessageBody
            });
        });

        it('should not get a non-existent message', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 999,
                onMessage: function(error, message) {
                    expect(error).to.exist;
                    expect(message).to.not.exist;
                    done();
                }
            });
        });

        it('should receive the two consecutive messages', function(done) {
            var msg1 = false,
                msg2 = false;

            function firstMessageReady(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.id).to.equal('1377622802704.8db37f1d@Nodemailer');
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
                uid: 652,
                onMessage: firstMessageReady
            });

            ic.getMessage({
                path: 'INBOX',
                uid: 448,
                onMessage: secondMessageReady
            });
        });
    });
});