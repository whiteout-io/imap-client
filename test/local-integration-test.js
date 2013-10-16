'use strict';

var ImapClient = require('../src/imap-client'),
    chai = require('chai'),
    expect = chai.expect,
    hoodiecrow = require('hoodiecrow'),
    loginOptions;

chai.Assertion.includeStack = true;

loginOptions = {
    port: 12345,
    host: 'localhost',
    auth: {
        user: 'testuser',
        pass: 'testpass'
    },
    secure: false,
    timeout: 20
};

describe('ImapClient integration tests', function () {
    var ic, server;

    before(function (done) {
        var messages = [{
            raw: 'Delivered-To: receiver@example.com\r\nMIME-Version: 1.0\r\nX-Mailer: Nodemailer (0.5.3-dev; +http://www.nodemailer.com/)\r\nDate: Mon, 07 Oct 2013 02:04:29 -0700 (PDT)\r\nMessage-Id: <1381136667884.3c5d64c9@Nodemailer>\r\nFrom: sender@example.com\r\nTo: receiver@example.com\r\nSubject: [whiteout] Encrypted message\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHi receiver,\r\n\r\nthis is a private conversation. To read my encrypted message below, simply =\r\ninstall Whiteout Mail for Chrome. The app is really easy to use and =\r\nautomatically encrypts sent emails, so that only the two of us can read =\r\nthem: https://chrome.google.com/webstore/detail/whiteout-mail/jjgghafhamhol=\r\njigjoghcfcekhkonijg\r\n\r\n\r\n-----BEGIN ENCRYPTED MESSAGE-----\r\nYADDAYADDACRYPTOBLABLA123\r\n-----END ENCRYPTED MESSAGE-----\r\n\r\n\r\nSent securely from whiteout mail\r\nhttp://whiteout.io\r\n\r\n',
            flags: ['\\Seen']
        }, {
            raw: 'MIME-Version: 1.0\r\nDate: Tue, 01 Oct 2013 07:08:55 GMT\r\nMessage-Id: <1380611335900.56da46df@Nodemailer>\r\nFrom: "Whiteout Test" <whiteout.test@t-online.de>\r\nTo: safewithme.testuser@gmail.com\r\nSubject: Hello\r\nContent-Type: multipart/mixed;\r\n boundary="----Nodemailer-0.5.3-dev-?=_1-1380611336047"\r\n\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vZm9vZm9vZm9vZm9v\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="bar.txt"\r\nContent-Disposition: attachment; filename="bar.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYmFyYmFyYmFyYmFyYmFy\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047--',
            flags: []
        }, {
            raw: 'Date: Tue, 15 Oct 2013 10:51:57 +0000\r\nMessage-ID: <123123@foobar>\r\nFrom: bla@blubb.io\r\nTo: blubb@bla.com\r\nSubject: blablubb\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\nMIME-Version: 1.0\r\n\r\nblubb bla',
            flags: ['\\Seen']
        }];
        server = hoodiecrow({
            storage: {
                "INBOX": {
                    messages: messages
                },
                "": {
                    "separator": "/",
                    "folders": {
                        "[Gmail]": {
                            "flags": ["\\Noselect"],
                            "folders": {
                                "Drafts": {
                                    "special-use": "\\Drafts"
                                },
                                "Important": {
                                    "special-use": "\\Important"
                                },
                                "Sent": {
                                    "special-use": "\\Sent"
                                },
                                "Spam": {
                                    "special-use": "\\Junk"
                                },
                                "Starred": {
                                    "special-use": "\\Flagged"
                                },
                                "Trash": {
                                    "special-use": "\\Trash"
                                }
                            }
                        }
                    }
                }
            }
        });
        server.listen(12345, done);
    });

    beforeEach(function (done) {
        ic = new ImapClient(loginOptions);
        ic.login(done);
    });

    afterEach(function (done) {
        ic.logout(done);
    });

    after(function (done) {
        server.close(done);
    });

    it('should return number of unread messages', function (done) {
        ic.unreadMessages('INBOX', function (error, unreadMessages) {
            expect(error).to.be.null;
            expect(unreadMessages).to.equal(1);
            done();
        });
    });

    it('should list all folders', function (done) {
        ic.listAllFolders(function (error, mailboxes) {
            expect(error).to.not.exist;
            expect(mailboxes).to.be.instanceof(Array);
            expect(mailboxes).to.not.be.empty;
            done();
        });
    });

    it('should list well known folders', function (done) {
        ic.listWellKnownFolders(function (error, folders) {
            expect(error).to.not.exist;

            expect(folders).to.exist;
            expect(folders.drafts).to.exist;
            expect(folders.drafts.name).to.exist;
            expect(folders.drafts.type).to.exist;
            expect(folders.drafts.path).to.exist;

            expect(folders.sent).to.exist;
            expect(folders.trash).to.exist;
            expect(folders.junk).to.exist;

            done();
        });
    });

    it('should list folders', function (done) {
        ic.listFolders(function (error, mailboxes) {
            expect(error).to.not.exist;
            expect(mailboxes).to.exist;
            expect(mailboxes).to.not.be.empty;
            done();
        });
    });

    it('should list an empty subfolder', function (done) {
        ic.listFolders('[Gmail]/Important', function (error, mailboxes) {
            expect(error).to.not.exist;
            expect(mailboxes).to.exist;
            expect(mailboxes).to.be.empty;
            done();
        });
    });

    it('should list subfolders', function (done) {
        ic.listFolders('[Gmail]', function (error, mailboxes) {
            expect(error).to.not.exist;
            expect(mailboxes).to.exist;
            expect(mailboxes).to.not.be.empty;
            done();
        });
    });

    it('should list messages', function (done) {
        ic.listMessages({
            path: 'INBOX',
            offset: 0,
            length: 50
        }, function (error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.not.be.empty;
            done();
        });
    });

    // unsupported by hoodiecrow. uncomment as soon as hoodiecrow supports this!
    // it('should get message preview', function(done) {
    //     ic.getMessagePreview({
    //         path: 'INBOX',
    //         uid: 2,
    //         timeout: 500
    //     }, function(error, message) {
    //         expect(error).to.not.exist;
    //         expect(message).to.exist;
    //         expect(message.body).to.not.be.empty;
    //         expect(message.unread).to.be.true;
    //         expect(message.answered).to.be.false;
    //         done();
    //     });
    // });

    it('should not get preview of a non-existent message', function (done) {
        ic.getMessagePreview({
            path: 'INBOX',
            uid: 999
        }, function (error, message) {
            expect(error).to.exist;
            expect(message).to.not.exist;

            done();
        });
    });

    it('should get full message with attachments', function (done) {
        function onEnd(error, message) {
            expect(error).to.be.null;

            expect(message).to.exist;
            expect(message.id).to.exist;
            expect(message.uid).to.equal(2);
            expect(message.to).to.be.instanceof(Array);
            expect(message.from).to.be.instanceof(Array);
            expect(message.subject).to.not.be.empty;
            expect(message.body).to.not.be.empty;
            expect(message.attachments).to.be.instanceof(Array);
            expect(message.attachments).to.not.be.empty;

            done();
        }

        ic.getMessage({
            path: 'INBOX',
            uid: 2,
        }, onEnd);
    });

    it('should get flags', function (done) {
        ic.getFlags({
            path: 'INBOX',
            uid: 1
        }, function (error, flags) {
            expect(error).to.be.null;
            expect(flags.unread).to.be.false;
            expect(flags.answered).to.be.false;
            done();
        });
    });
    it('should update flags', function (done) {
        ic.updateFlags({
            path: 'INBOX',
            uid: 1,
            unread: true,
            answered: true
        }, function (error, flags) {
            expect(error).to.be.null;
            expect(flags.unread).to.be.true;
            expect(flags.answered).to.be.true;
            done();
        });
    });

    it('should move message', function (done) {
        ic.moveMessage({
            path: 'INBOX',
            uid: 1,
            destination: '[Gmail]/Trash'
        }, function (error) {
            expect(error).to.not.exist;

            done();
        });
    });

    it('should purge message', function (done) {
        ic.listMessages({
            path: 'INBOX',
            offset: 0,
            length: 50
        }, function (error, messages) {
            var i, l;
            expect(error).to.not.exist;

            for (i = 0, l = messages.length; i < l; i++) {
                if (messages[i].subject === 'blablubb') {
                    purge(messages[i].uid);
                    break;
                }
            }

            function purge(uid) {
                ic.deleteMessage({
                    path: 'INBOX',
                    uid: uid
                }, function (error) {
                    expect(error).to.be.null;
                    done();
                });
            }

            done();
        });
    });
});