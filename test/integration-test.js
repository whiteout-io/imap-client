if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {
    'use strict';

    var ImapClient = require('imap-client'),
        expect = require('chai').expect,
        loginOptions;

    loginOptions = {
        port: 993,
        host: 'imap.gmail.com', // 'secureimap.t-online.de'
        auth: {
            user: 'safewithme.testuser@gmail.com', // whiteout.test@t-online.de
            pass: 'hellosafe' // '@6IyFg1SIlWH91Co'
        },
        secure: true
    };

    describe('ImapClient integration tests', function() {
        this.timeout(5000);

        var ic;

        beforeEach(function(done) {
            ic = new ImapClient(loginOptions);
            ic.login(done);
        });


        afterEach(function(done) {
            ic.logout(done);
        });

        it('should return number of unread messages', function(done) {
            ic.unreadMessages('INBOX', function(error, unreadMessages) {
                expect(error).to.be.null;
                expect(unreadMessages).to.be.at.least(1);
                done();
            });
        });
        it('should list all folders', function(done) {
            ic.listAllFolders(function(error, mailboxes) {
                expect(error).to.not.exist;
                expect(mailboxes).to.be.instanceof(Array);
                expect(mailboxes).to.not.be.empty;
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
                    if (message.uid === 780) {
                        expect(message.unread).to.be.true;
                    }
                }
                done();
            });
        });

        it('should get only plain text in multipart/mixed message in text only', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 772,
                textOnly: true
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body).to.equal('do not delete me, i have got something here for you\r\n');
                done();
            });
        });

        it('should get only plain text in multipart/alternative message in text only', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 773,
                textOnly: true
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body).to.equal('asdfasdfasdf');
                done();
            });
        });
        
        it('should decode quoted-printable in plain message in text only', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 779,
                textOnly: true
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body.indexOf('To read my encrypted message below, simply install Whiteout Mail for Chrome.') > -1).to.be.true; // this text contains a quoted-printable line wrap
                done();
            });
        });

        it('should get full message with attachments', function(done) {
            function onEnd(error, message) {
                expect(error).to.be.null;

                expect(message).to.exist;
                expect(message.id).to.exist;
                expect(message.uid).to.equal(772);
                expect(message.to).to.be.instanceof(Array);
                expect(message.from).to.be.instanceof(Array);
                expect(message.subject).to.not.be.empty;
                expect(message.body).to.not.be.empty;
                expect(message.html).to.be.true;
                expect(message.attachments).to.be.instanceof(Array);
                expect(message.attachments).to.not.be.empty;
                done();
            }

            ic.getMessage({
                path: 'INBOX',
                uid: 772,
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

        it('should timeout due to non-existent body part', function(done){
            ic.getMessage({
                path: 'INBOX',
                uid: 781,
                timeout: 500,
                textOnly: true
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body).to.not.exist;

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
                uid: 777
            }, firstMessageReady);

            ic.getMessage({
                path: 'INBOX',
                uid: 776
            }, secondMessageReady);
        });
    });
});