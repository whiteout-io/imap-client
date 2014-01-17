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
    timeout: 1000
};

describe('ImapClient integration tests', function() {
    var ic, server;

    before(function(done) {
        var messages = [{
            raw: 'Delivered-To: receiver@example.com\r\nMIME-Version: 1.0\r\nX-Mailer: Nodemailer (0.5.3-dev; +http://www.nodemailer.com/)\r\nDate: Mon, 07 Oct 2013 02:04:29 -0700 (PDT)\r\nMessage-Id: <1381136667884.3c5d64c9@Nodemailer>\r\nFrom: sender@example.com\r\nTo: receiver@example.com\r\nSubject: [whiteout] Encrypted message\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHi receiver,\r\n\r\nthis is a private conversation. To read my encrypted message below, simply =\r\ninstall Whiteout Mail for Chrome. The app is really easy to use and =\r\nautomatically encrypts sent emails, so that only the two of us can read =\r\nthem: https://chrome.google.com/webstore/detail/whiteout-mail/jjgghafhamhol=\r\njigjoghcfcekhkonijg\r\n\r\n\r\n-----BEGIN ENCRYPTED MESSAGE-----\r\nYADDAYADDACRYPTOBLABLA123\r\n-----END ENCRYPTED MESSAGE-----\r\n\r\n\r\nSent securely from whiteout mail\r\nhttp://whiteout.io\r\n\r\n',
            flags: ['\\Seen']
        }, {
            raw: 'MIME-Version: 1.0\r\nDate: Tue, 01 Oct 2013 07:08:55 GMT\r\nMessage-Id: <1380611335900.56da46df@Nodemailer>\r\nFrom: alice@example.com\r\nTo: bob@example.com\r\nSubject: Hello\r\nContent-Type: multipart/mixed;\r\n boundary="----Nodemailer-0.5.3-dev-?=_1-1380611336047"\r\n\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vZm9vZm9vZm9vZm9v\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="bar.txt"\r\nContent-Disposition: attachment; filename="bar.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYmFyYmFyYmFyYmFyYmFy\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047--',
            flags: []
        }, {
            raw: 'Date: Tue, 15 Oct 2013 10:51:57 +0000\r\nMessage-ID: <123123@foobar>\r\nFrom: bla@blubb.io\r\nTo: blubb@bla.com\r\nSubject: blablubb\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\nMIME-Version: 1.0\r\n\r\nblubb bla',
            flags: ['\\Seen']
        }, {
            raw: 'Content-Type: multipart/encrypted; boundary="Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69"; protocol="application/pgp-encrypted";\r\nSubject: [whiteout] attachment only\r\nFrom: Felix Hammerl <felix.hammerl@gmail.com>\r\nDate: Thu, 16 Jan 2014 14:55:56 +0100\r\nContent-Transfer-Encoding: 7bit\r\nMessage-Id: <3ECDF9DC-895E-4475-B2A9-52AF1F117652@gmail.com>\r\nContent-Description: OpenPGP encrypted message\r\nTo: safewithme.testuser@gmail.com\r\n\r\nThis is an OpenPGP/MIME encrypted message (RFC 2440 and 3156)\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69\r\nContent-Transfer-Encoding: 7bit\r\nContent-Type: application/pgp-encrypted\r\nContent-Description: PGP/MIME Versions Identification\r\n\r\nVersion: 1\r\n\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69\r\nContent-Transfer-Encoding: 7bit\r\nContent-Disposition: inline;\r\n    filename=encrypted.asc\r\nContent-Type: application/octet-stream;\r\n    name=encrypted.asc\r\nContent-Description: OpenPGP encrypted message\r\n\r\ninsert pgp here.\r\n\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69--',
            flags: []
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

    beforeEach(function(done) {
        ic = new ImapClient(loginOptions);
        ic.login(done);
    });

    afterEach(function(done) {
        ic.logout(done);
    });

    after(function(done) {
        server.close(done);
    });

    it('should list all folders', function(done) {
        ic.listAllFolders(function(error, mailboxes) {
            expect(error).to.not.exist;
            expect(mailboxes).to.be.instanceof(Array);
            expect(mailboxes).to.not.be.empty;
            done();
        });
    });

    it('should list well known folders', function(done) {
        ic.listWellKnownFolders(function(error, folders) {
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

    it('should list folders', function(done) {
        ic.listFolders(function(error, mailboxes) {
            expect(error).to.not.exist;
            expect(mailboxes).to.exist;
            expect(mailboxes).to.not.be.empty;
            done();
        });
    });

    it('should list an empty subfolder', function(done) {
        ic.listFolders('[Gmail]/Important', function(error, mailboxes) {
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

    it('should search messages', function(done) {
        ic.search({
            path: 'INBOX',
            subject: 'blablubb',
            unread: false,
            answered: false
        }, function(error, uids) {
            expect(error).to.not.exist;
            expect(uids).to.not.be.empty;
            done();
        });
    });

    it('should list messages by uid', function(done) {
        ic.listMessagesByUid({
            path: 'INBOX',
            firstUid: 1,
            lastUid: 3
        }, function(error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.not.be.empty;
            expect(messages.length).to.equal(3);
            expect(messages[0].id).to.not.be.empty;
            expect(/[<>]/g.test(messages[0].id)).to.be.false;
            expect(messages[0].bodystructure).to.exist;
            done();
        });
    });

    it('should list messages by uid without providing lastUid parameter', function(done) {
        ic.listMessagesByUid({
            path: 'INBOX',
            firstUid: 1
        }, function(error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.not.be.empty;
            expect(messages.length).to.equal(4);
            done();
        });
    });

    it('should get message in plain text', function(done) {
        ic.getPlaintext({
            path: 'INBOX',
            message: {
                uid: 2,
                bodystructure: {
                    '1': {
                        part: '1',
                        type: 'text/plain',
                        parameters: {},
                        encoding: 'quoted-printable',
                        size: 12
                    },
                    '2': {
                        part: '2',
                        type: 'text/plain',
                        parameters: {
                            name: 'foo.txt'
                        },
                        encoding: 'base64',
                        size: 20,
                        disposition: [{
                            type: 'attachment',
                            filename: 'foo.txt'
                        }]
                    },
                    '3': {
                        part: '3',
                        type: 'text/plain',
                        parameters: {
                            name: 'bar.txt'
                        },
                        encoding: 'base64',
                        size: 20,
                        disposition: [{
                            type: 'attachment',
                            filename: 'bar.txt'
                        }]
                    },
                    type: 'multipart/mixed'
                }
            }
        }, function(error, message) {
            expect(error).to.not.exist;
            expect(message).to.exist;
            expect(message.body).to.equal("Hello world");
            done();
        });
    });

    it('should get flags', function(done) {
        ic.getFlags({
            path: 'INBOX',
            uid: 1
        }, function(error, flags) {
            expect(error).to.be.null;
            expect(flags.unread).to.be.false;
            expect(flags.answered).to.be.false;
            done();
        });
    });

    it('should update flags', function(done) {
        ic.updateFlags({
            path: 'INBOX',
            uid: 1,
            unread: true,
            answered: true
        }, function(error, flags) {
            expect(error).to.be.null;
            expect(flags.unread).to.be.true;
            expect(flags.answered).to.be.true;
            done();
        });
    });

    it('should purge message', function(done) {
        ic.listMessagesByUid({
            path: 'INBOX',
            uid: 1,
        }, function(error, messages) {
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
                }, function(error) {
                    expect(error).to.be.null;
                    done();
                });
            }

            done();
        });
    });

    it('should move message', function(done) {
        ic.moveMessage({
            path: 'INBOX',
            uid: 1,
            destination: '[Gmail]/Trash'
        }, function(error) {
            expect(error).to.not.exist;

            done();
        });
    });

    it('should get attachments', function(done) {
        ic.listMessagesByUid({
            path: 'INBOX',
            firstUid: 2,
            lastUid: 2
        }, function(error, messages) {
            expect(error).to.not.exist;

            ic.getAttachment({
                path: 'INBOX',
                uid: messages[0].uid,
                attachment: messages[0].attachments[0]
            }, function(error, attachment) {
                expect(error).to.not.exist;
                expect(attachment).to.exist;
                expect(attachment.content).to.exist;
                expect(attachment.progress).to.equal(1);

                done();
            });
        });
    });

    it('should get encrypted message block', function(done) {
        ic.getEncryptedMessageBlock({
            path: 'INBOX',
            message: {
                uid: 4,
                bodystructure: {
                    '1': {
                        part: '1',
                        type: 'application/pgp-encrypted',
                        parameters: {},
                        encoding: '7bit',
                        size: 12
                    },
                    '2': {
                        part: '2',
                        type: 'application/octet-stream',
                        parameters: {
                            name: 'encrypted.asc'
                        },
                        encoding: '7bit',
                        size: 4357,
                        disposition: [{
                            type: 'inline',
                            filename: 'encrypted.asc'
                        }]
                    },
                    type: 'multipart/encrypted'
                }
            }
        }, function(error, pgpBlock) {
            expect(error).to.be.null;
            expect(pgpBlock).to.equal('insert pgp here.\r\n');

            done();
        });
    });
});