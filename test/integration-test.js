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
                    } else if (message.uid === 655) {
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

            function onBody(error, message) {
                expect(error).to.be.null;
                expect(message.id).to.exist;
                expect(message.to).to.be.instanceof(Array);
                expect(message.subject).to.equal('test');
                expect(message.body).to.equal('asdasdasd\n\n');
                expect(message.html).to.be.false;

                bodyParsed = true;
            }

            function onAttachment(error, attmt) {
                expect(error).to.be.null;
                expect(attmt.fileName).to.exist;
                expect(attmt.contentType).to.exist;
                expect(attmt.uint8Array).to.exist;

                expect(bodyParsed).to.be.true;
                attachmentParsed = true;
            }

            function onEnd(error, message) {
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
                onEnd: onEnd,
                onAttachment: onAttachment,
                onBody: onBody
            });
        });

        it('should not get a non-existent message', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 999,
                onEnd: function(error, message) {
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
                expect(message.id).to.equal('7ADB0F57-B2D1-406B-963B-843530CC61DC@gmail.com');
                msg1 = true;
                check();
            }

            function secondMessageReady(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.id).to.equal('40A57DCE-BF14-468F-9AD3-18592AABC8E6@whiteout.io');
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
                uid: 656,
                onEnd: firstMessageReady
            });

            ic.getMessage({
                path: 'INBOX',
                uid: 655,
                onEnd: secondMessageReady
            });
        });

        it('should receive onBody event from a non-multipart message', function(done) {
            var bodyReceived = false;
            ic.getMessage({
                path: 'INBOX',
                uid: 655,
                onBody: function(error, message) {
                    expect(error).to.not.exist;
                    expect(message).to.exist;

                    bodyReceived = true;
                },
                onEnd: function(error, message) {
                    expect(error).to.not.exist;
                    expect(message).to.exist;
                    expect(bodyReceived).to.be.true;

                    done();
                }
            });
        });
    });
});