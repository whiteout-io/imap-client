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
        secure: true,
        ca: ['-----BEGIN CERTIFICATE-----\r\nMIIEBDCCAuygAwIBAgIDAjppMA0GCSqGSIb3DQEBBQUAMEIxCzAJBgNVBAYTAlVT\r\nMRYwFAYDVQQKEw1HZW9UcnVzdCBJbmMuMRswGQYDVQQDExJHZW9UcnVzdCBHbG9i\r\nYWwgQ0EwHhcNMTMwNDA1MTUxNTU1WhcNMTUwNDA0MTUxNTU1WjBJMQswCQYDVQQG\r\nEwJVUzETMBEGA1UEChMKR29vZ2xlIEluYzElMCMGA1UEAxMcR29vZ2xlIEludGVy\r\nbmV0IEF1dGhvcml0eSBHMjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\r\nAJwqBHdc2FCROgajguDYUEi8iT/xGXAaiEZ+4I/F8YnOIe5a/mENtzJEiaB0C1NP\r\nVaTOgmKV7utZX8bhBYASxF6UP7xbSDj0U/ck5vuR6RXEz/RTDfRK/J9U3n2+oGtv\r\nh8DQUB8oMANA2ghzUWx//zo8pzcGjr1LEQTrfSTe5vn8MXH7lNVg8y5Kr0LSy+rE\r\nahqyzFPdFUuLH8gZYR/Nnag+YyuENWllhMgZxUYi+FOVvuOAShDGKuy6lyARxzmZ\r\nEASg8GF6lSWMTlJ14rbtCMoU/M4iarNOz0YDl5cDfsCx3nuvRTPPuj5xt970JSXC\r\nDTWJnZ37DhF5iR43xa+OcmkCAwEAAaOB+zCB+DAfBgNVHSMEGDAWgBTAephojYn7\r\nqwVkDBF9qn1luMrMTjAdBgNVHQ4EFgQUSt0GFhu89mi1dvWBtrtiGrpagS8wEgYD\r\nVR0TAQH/BAgwBgEB/wIBADAOBgNVHQ8BAf8EBAMCAQYwOgYDVR0fBDMwMTAvoC2g\r\nK4YpaHR0cDovL2NybC5nZW90cnVzdC5jb20vY3Jscy9ndGdsb2JhbC5jcmwwPQYI\r\nKwYBBQUHAQEEMTAvMC0GCCsGAQUFBzABhiFodHRwOi8vZ3RnbG9iYWwtb2NzcC5n\r\nZW90cnVzdC5jb20wFwYDVR0gBBAwDjAMBgorBgEEAdZ5AgUBMA0GCSqGSIb3DQEB\r\nBQUAA4IBAQA21waAESetKhSbOHezI6B1WLuxfoNCunLaHtiONgaX4PCVOzf9G0JY\r\n/iLIa704XtE7JW4S615ndkZAkNoUyHgN7ZVm2o6Gb4ChulYylYbc3GrKBIxbf/a/\r\nzG+FA1jDaFETzf3I93k9mTXwVqO94FntT0QJo544evZG0R0SnU++0ED8Vf4GXjza\r\nHFa9llF7b1cq26KqltyMdMKVvvBulRP/F/A8rLIQjcxz++iPAsbw+zOzlTvjwsto\r\nWHPbqCRiOwY1nQ2pM714A5AuTHhdUDqB1O6gyHA43LL5Z/qHQF1hwFGPa4NrzQU6\r\nyuGnBXj8ytqU0CwIPX4WecigUCAkVDNx\r\n-----END CERTIFICATE-----\r\n']
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

        it('should search messages', function(done) {
            ic.search({
                path: 'INBOX',
                unread: true,
                answered: false
            }, function(error, uids) {
                expect(error).to.not.exist;
                expect(uids).to.not.be.empty;
                expect(uids).to.contain(780);
                done();
            });
        });

        it('should list messages by uid', function(done) {
            ic.listMessagesByUid({
                path: 'INBOX',
                firstUid: 772
            }, function(error, messages) {
                console.log(messages);
                expect(error).to.not.exist;
                expect(messages).to.not.be.empty;
                done();
            });
        });

        it('should get preview of multipart message', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 781
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body).to.equal('Hello world');
                done();
            });
        });

        it('should decode quoted-printable in message preview', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 797
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body.indexOf('Lorem ipsum Tempor non Duis Excepteur dolor tempor ut incididunt irure magna sed Excepteur ad culpa tempor pariatur laborum sunt dolor anim') > -1).to.be.true; // this text contains a quoted-printable line wrap
                done();
            });
        });

        it('should not get preview of a non-existent message', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 999
            }, function(error, message) {
                expect(error).to.exist;
                expect(message).to.not.exist;

                done();
            });
        });

        it('should get preview with multipart/mixed and non-nested body part 1', function(done) {
            ic.getMessage({
                path: 'INBOX',
                uid: 781
            }, function(error, message) {
                expect(error).to.not.exist;
                expect(message).to.exist;
                expect(message.body).to.equal('Hello world');

                done();
            });
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
                expect(flags.answered).to.be.true;
                done();
            });
        });

        it('should move a message', function(done) {
            var origin = 'INBOX',
                destination;

            ic.listWellKnownFolders(function(error, folders) {
                expect(folders.trash).to.exist;

                destination = folders.trash.path;
                ic.listMessagesByUid({
                    path: origin,
                    firstUid: 1
                }, function(error, msgs) {
                    ic.moveMessage({
                        path: 'INBOX',
                        uid: msgs[msgs.length - 1].uid,
                        destination: destination
                    }, function(error) {
                        expect(error).to.not.exist;

                        moveBack();
                    });
                });
            });

            function moveBack() {
                ic.listMessagesByUid({
                    path: destination,
                    firstUid: 1
                }, function(error, msgs) {
                    ic.moveMessage({
                        path: destination,
                        uid: msgs[msgs.length - 1].uid,
                        destination: 'INBOX'
                    }, function(error) {
                        expect(error).to.not.exist;

                        done();
                    });
                });
            }
        });

        it('should get attachment', function(done) {
            ic.listMessagesByUid({
                path: 'INBOX',
                firstUid: 781,
                lastUid: 781
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
    });
});