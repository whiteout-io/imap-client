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

        it('should list well known folders', function(done) {
            this.timeout(60000);
            ic.listWellKnownFolders(function(error, folders) {
                expect(error).to.not.exist;

                expect(folders).to.exist;
                expect(folders.inbox).to.exist;
                expect(folders.inbox.name).to.exist;
                expect(folders.inbox.type).to.exist;
                expect(folders.inbox.path).to.exist;

                expect(folders.drafts).to.exist;
                expect(folders.sent).to.exist;
                expect(folders.trash).to.exist;
                expect(folders.junk).to.exist;

                expect(folders.flagged).to.be.instanceof(Array);
                expect(folders.flagged).to.not.be.empty;

                expect(folders.other).to.be.instanceof(Array);
                expect(folders.other).to.not.be.empty;

                expect(folders.normal).to.be.instanceof(Array);
                expect(folders.normal).to.not.be.empty;

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

        it('should get preview of multipart/mixed message', function(done) {
            ic.getMessagePreview({
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

        it('should get preview of multipart/alternative message', function(done) {
            ic.getMessagePreview({
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

        it('should decode quoted-printable in message preview', function(done) {
            ic.getMessagePreview({
                path: 'INBOX',
                uid: 797,
                textOnly: true
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body.indexOf('Lorem ipsum Tempor non Duis Excepteur dolor tempor ut incididunt irure magna sed Excepteur ad culpa tempor pariatur laborum sunt dolor anim') > -1).to.be.true; // this text contains a quoted-printable line wrap
                done();
            });
        });

        it('should not get preview of a non-existent message', function(done) {
            ic.getMessagePreview({
                path: 'INBOX',
                uid: 999
            }, function(error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;

                done();
            });
        });

        it('should get preview with multipart/mixed and non-nested body part 1', function(done) {
            ic.getMessagePreview({
                path: 'INBOX',
                uid: 781,
                timeout: 500,
                textOnly: true
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body).to.equal('Hello world');

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
            }, onEnd);
        });

        it('should get flags', function(done) {
            ic.getFlags({
                path: 'INBOX',
                uid: 780
            }, function(error, flags) {
                expect(error).to.be.null;
                expect(flags.unread).to.be.true;
                expect(flags.answered).to.be.false;
                done();
            });
        });
        it('should update flags', function(done) {
            ic.updateFlags({
                path: 'INBOX',
                uid: 776,
                unread: true,
                answered: true
            }, function(error, flags) {
                expect(error).to.be.null;
                expect(flags.unread).to.be.true;
                expect(flags.answered).to.be.false;
                done();
            });
        });
    });
});