'use strict';

// this test is node-only (hoodiecrow is fired up)

var chai = require('chai'),
    expect = chai.expect,
    ImapClient = require('../src/imap-client'),
    hoodiecrow = require('hoodiecrow'),
    axe = require('axe'),
    loginOptions = {
        port: 12345,
        host: 'localhost',
        auth: {
            user: 'testuser',
            pass: 'testpass'
        },
        secure: false
    };

// don't log in the tests
axe.removeAppender(axe.defaultAppender);

describe('ImapClient local integration tests', function() {
    var ic, imap;

    chai.Assertion.includeStack = true;
    before(function() {
        imap = hoodiecrow({
            storage: {
                'INBOX': {
                    messages: [{
                        raw: 'Message-Id: <abcde>\r\nSubject: hello 1\r\n\r\nWorld 1!'
                    }, {
                        raw: 'Message-Id: <abcde>\r\nSubject: hello 2\r\n\r\nWorld 2!',
                        flags: ['\\Seen']
                    }, {
                        raw: 'Message-Id: <abcde>\r\nSubject: hello 3\r\n\r\nWorld 3!'
                    }, {
                        raw: 'MIME-Version: 1.0\r\nDate: Tue, 01 Oct 2013 07:08:55 GMT\r\nMessage-Id: <1380611335900.56da46df@Nodemailer>\r\nFrom: alice@example.com\r\nTo: bob@example.com\r\nSubject: Hello\r\nContent-Type: multipart/mixed;\r\n boundary="----Nodemailer-0.5.3-dev-?=_1-1380611336047"\r\n\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vZm9vZm9vZm9vZm9v\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="bar.txt"\r\nContent-Disposition: attachment; filename="bar.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYmFyYmFyYmFyYmFyYmFy\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047--',
                    }, {
                        raw: 'Content-Type: multipart/encrypted; boundary="Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69"; protocol="application/pgp-encrypted";\r\nSubject: [whiteout] attachment only\r\nFrom: Felix Hammerl <felix.hammerl@gmail.com>\r\nDate: Thu, 16 Jan 2014 14:55:56 +0100\r\nContent-Transfer-Encoding: 7bit\r\nMessage-Id: <3ECDF9DC-895E-4475-B2A9-52AF1F117652@gmail.com>\r\nContent-Description: OpenPGP encrypted message\r\nTo: safewithme.testuser@gmail.com\r\n\r\nThis is an OpenPGP/MIME encrypted message (RFC 2440 and 3156)\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69\r\nContent-Transfer-Encoding: 7bit\r\nContent-Type: application/pgp-encrypted\r\nContent-Description: PGP/MIME Versions Identification\r\n\r\nVersion: 1\r\n\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69\r\nContent-Transfer-Encoding: 7bit\r\nContent-Disposition: inline;\r\n    filename=encrypted.asc\r\nContent-Type: application/octet-stream;\r\n    name=encrypted.asc\r\nContent-Description: OpenPGP encrypted message\r\n\r\ninsert pgp here.\r\n\r\n--Apple-Mail=_CC38E51A-DB4D-420E-AD14-02653EB88B69--',
                    }, {
                        raw: 'MIME-Version: 1.0\r\nDate: Tue, 01 Oct 2013 07:08:55 GMT\r\nMessage-Id: <1380611335900.56da46df@Nodemailer>\r\nFrom: alice@example.com\r\nTo: bob@example.com\r\nSubject: Hello\r\nContent-Type: multipart/mixed;\r\n boundary="----Nodemailer-0.5.3-dev-?=_1-1380611336047"\r\n\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vZm9vZm9vZm9vZm9v\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047\r\nContent-Type: text/plain; name="bar.txt"\r\nContent-Disposition: attachment; filename="bar.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYmFyYmFyYmFyYmFyYmFy\r\n------Nodemailer-0.5.3-dev-?=_1-1380611336047--',
                    }]
                },
                '': {
                    'separator': '/',
                    'folders': {
                        '[Gmail]': {
                            'flags': ['\\Noselect'],
                            'folders': {
                                'All Mail': {
                                    'flags': '\\All'
                                },
                                'Drafts': {
                                    'flags': '\\Drafts'
                                },
                                'Important': {
                                    'flags': '\\Important'
                                },
                                'Sent Mail': {
                                    'flags': '\\Sent'
                                },
                                'Spam': {
                                    'flags': '\\Junk'
                                },
                                'Starred': {
                                    'flags': '\\Flagged'
                                },
                                'Trash': {
                                    'flags': '\\Trash'
                                }
                            }
                        }
                    }
                }
            }
        }),
        imap.listen(loginOptions.port);
    });

    after(function(done) {
        imap.close(done);
    });

    beforeEach(function(done) {
        ic = new ImapClient(loginOptions);
        ic.onSyncUpdate = function() {};
        ic.login(done);
    });

    afterEach(function(done) {
        ic.logout(done);
    });

    it('should throw', function(done) {
        var ic = new ImapClient(loginOptions);
        ic.onError = function(err) {
            expect(err.message).to.equal('Sync handler not set');
            ic.logout(done);
        };
        ic.login(function() {
            ic.listMessages({
                path: 'INBOX',
                firstUid: 1,
                lastUid: 3
            }, function() {});
        });
    });

    it('should list well known folders', function(done) {
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
            expect(folders.flagged).to.exist;

            expect(folders.other).to.be.instanceof(Array);
            expect(folders.other).to.not.be.empty;

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
        ic.listMessages({
            path: 'INBOX',
            firstUid: 1,
            lastUid: 3
        }, function(error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.not.be.empty;
            expect(messages.length).to.equal(3);
            expect(messages[0].id).to.not.be.empty;
            expect(messages[0].bodystructure).to.exist;
            expect(messages[0].bodyParts.length).to.equal(1);
            done();
        });
    });

    it('should list all messages by uid', function(done) {
        ic.listMessages({
            path: 'INBOX',
            firstUid: 1
        }, function(error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.not.be.empty;
            expect(messages.length).to.equal(6);
            done();
        });
    });

    it('should get message parts', function(done) {
        ic.listMessages({
            path: 'INBOX',
            firstUid: 4,
            lastUid: 4
        }, function(error, messages) {
            ic.getBodyParts({
                path: 'INBOX',
                uid: messages[0].uid,
                bodyParts: messages[0].bodyParts
            }, function(error, bodyParts) {
                expect(error).to.not.exist;
                expect(messages[0].bodyParts).to.equal(bodyParts);
                expect(bodyParts[0].type).to.equal('text');
                expect(bodyParts[0].raw).to.equal('Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nHello world');

                done();
            });
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
        ic.listMessages({
            path: 'INBOX',
            firstUid: 1
        }, function(error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.not.be.empty;

            ic.deleteMessage({
                path: 'INBOX',
                uid: 2
            }, function(error) {
                expect(error).to.not.exist;

                ic.listMessages({
                    path: 'INBOX',
                    firstUid: 1
                }, function(error, messages) {
                    expect(error).to.not.exist;
                    expect(messages).to.not.be.empty;

                    messages.forEach(function(message) {
                        expect(message.uid).to.not.equal(2);
                    });

                    done();
                });
            });
        });
    });

    it('should upload Message', function(done) {
        var msg = 'MIME-Version: 1.0\r\nDate: Wed, 9 Jul 2014 15:07:47 +0200\r\nDelivered-To: test@test.com\r\nMessage-ID: <CAHftYYQo=5fqbtnv-DazXhL2j5AxVP1nWarjkztn-N9SV91Z2w@mail.gmail.com>\r\nSubject: test\r\nFrom: Test Test <test@test.com>\r\nTo: Test Test <test@test.com>\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\ntest',
            path = 'INBOX';

        ic.listMessages({
            path: path,
            firstUid: 1
        }, function(error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.not.be.empty;
            var msgCount = messages.length;

            ic.uploadMessage({
                path: path,
                message: msg,
                flags: ['\\Seen']
            }, function(error) {
                expect(error).to.not.exist;

                ic.listMessages({
                    path: path,
                    firstUid: 1
                }, function(error, messages) {
                    expect(error).to.not.exist;
                    expect(messages.length).to.equal(msgCount + 1);

                    done();
                });
            });
        });
    });

    it('should move message', function(done) {
        var destination = '[Gmail]/Trash';

        ic.listMessages({
            path: destination,
            firstUid: 1
        }, function(error, messages) {
            expect(error).to.not.exist;
            expect(messages).to.be.empty;

            ic.moveMessage({
                path: 'INBOX',
                uid: 3,
                destination: destination
            }, function(error) {
                expect(error).to.not.exist;

                ic.listMessages({
                    path: destination,
                    firstUid: 1
                }, function(error, messages) {
                    expect(error).to.not.exist;
                    expect(messages).to.not.be.empty;

                    done();
                });
            });
        });
    });
});