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

    describe('ImapClient.unreadMessages', function() {
        it('should return number of unread messages', function(done) {
            ic.unreadMessages('INBOX', function(error, unreadMessages) {
                expect(error).to.be.null;
                expect(unreadMessages).to.equal(1);
                done();
            });
        });
    });

    describe('ImapClient.listFolders', function() {
        it('should list all folders', function(done) {
            ic.listAllFolders(function(error, paths) {
                expect(error).to.not.exist;
                expect(paths).to.be.instanceof(Array);
                expect(paths).to.not.be.empty;
                done();
            });
        });

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
        it('should get a message in text only', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 656,
                textOnly: true
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                done();
            });
        });

        it('should get full message with attachments', function(done) {
            function onEnd(error, message) {
                expect(error).to.be.null;

                expect(message).to.exist;
                expect(message.id).to.exist;
                expect(message.uid).to.equal(583);
                expect(message.to).to.be.instanceof(Array);
                expect(message.from).to.be.instanceof(Array);
                expect(message.subject).to.not.be.empty;
                expect(message.body).to.not.be.empty;
                expect(message.html).to.be.false;
                expect(message.attachments).to.be.instanceof(Array);
                expect(message.attachments).to.not.be.empty;
                done();
            }

            ic.getMessage({
                path: 'INBOX',
                uid: 583,
                textOnly: false
            }, onEnd);
        });

        it('should not get a non-existent message', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 999
            }, function(error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;
                done();
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
                uid: 656
            }, firstMessageReady);

            ic.getMessage({
                path: 'INBOX',
                uid: 655
            }, secondMessageReady);
        });
    });
});