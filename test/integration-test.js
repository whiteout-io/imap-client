(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['chai', 'imap-client', 'axe'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('chai'), require('../src/imap-client'), require('axe-logger'));
    }
})(function(chai, ImapClient, axe) {
    'use strict';

    var expect = chai.expect,
        loginOptions;

    loginOptions = {
        port: 993,
        host: 'secureimap.t-online.de',
        auth: {
            user: 'whiteout.testaccount@t-online.de',
            pass: 'HelloSafer'
        },
        secure: true,
        tlsWorkerPath: 'lib/tcp-socket-tls-worker.js'
    };

    describe('ImapClient t-online integration tests', function() {
        this.timeout(5000);
        chai.config.includeStack = true;

        // don't log in the tests
        axe.removeAppender({});

        var ic;

        beforeEach(function(done) {
            ic = new ImapClient(loginOptions);
            ic.onSyncUpdate = function() {};
            ic.login(done);
            ic.onCert = function () {};
        });


        afterEach(function(done) {
            ic.logout(done);
        });

        it('should list well known folders', function(done) {
            ic.listWellKnownFolders(function(error, folders) {
                expect(error).to.not.exist;

                expect(folders).to.exist;

                expect(folders.Inbox).to.be.instanceof(Array);
                expect(folders.Inbox[0]).to.exist;
                expect(folders.Inbox[0].name).to.exist;
                expect(folders.Inbox[0].type).to.exist;
                expect(folders.Inbox[0].path).to.exist;

                expect(folders.Drafts).to.be.instanceof(Array);
                expect(folders.Drafts).to.not.be.empty;

                expect(folders.Sent).to.be.instanceof(Array);
                expect(folders.Sent).to.not.be.empty;

                expect(folders.Trash).to.be.instanceof(Array);
                expect(folders.Trash).to.not.be.empty;

                expect(folders.Other).to.be.instanceof(Array);

                done();
            });
        });

        it('should search messages', function(done) {
            ic.search({
                path: 'INBOX',
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
                firstUid: 1
            }, function(error, messages) {
                expect(error).to.not.exist;
                expect(messages).to.not.be.empty;
                done();
            });
        });


        it('should upload Message', function(done) {
            var msg = 'MIME-Version: 1.0\r\nDate: Wed, 9 Jul 2014 15:07:47 +0200\r\nDelivered-To: test@test.com\r\nMessage-ID: <CAHftYYQo=5fqbtnv-DazXhL2j5AxVP1nWarjkztn-N9SV91Z2w@mail.gmail.com>\r\nSubject: integration test\r\nFrom: Test Test <test@test.com>\r\nTo: Test Test <test@test.com>\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nintegration test',
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
                    message: msg
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

        it('should get message parts', function(done) {
            ic.listMessages({
                path: 'INBOX',
                firstUid: 1
            }, function(error, messages) {
                var msg = messages.pop();
                ic.getBodyParts({
                    path: 'INBOX',
                    uid: msg.uid,
                    bodyParts: msg.bodyParts
                }, function(error, bodyParts) {
                    expect(error).to.not.exist;
                    expect(msg.bodyParts).to.equal(bodyParts);
                    expect(bodyParts[0].raw).to.not.be.empty;

                    done();
                });
            });
        });
    });
});