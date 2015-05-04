(function(factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        ES6Promise.polyfill(); // load ES6 Promises polyfill
        define(['chai', 'imap-client', 'axe'], factory);
    } else if (typeof exports === 'object') {
        require('es6-promise').polyfill(); // load ES6 Promises polyfill
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
        this.timeout(50000);
        chai.config.includeStack = true;

        // don't log in the tests
        axe.removeAppender(axe.defaultAppender);

        var ic;

        beforeEach(function(done) {
            ic = new ImapClient(loginOptions);
            ic.onSyncUpdate = function() {};
            ic.onCert = function() {};
            ic.onError = function(error) {
                console.error(error);
            };
            ic.login().then(done);
        });


        afterEach(function(done) {
            ic.logout().then(done);
        });

        it('should list well known folders', function(done) {
            ic.listWellKnownFolders().then(function(folders) {
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
            }).then(done);
        });

        it('should search messages', function(done) {
            ic.search({
                path: 'INBOX',
                unread: false,
                answered: false
            }).then(function(uids) {
                expect(uids).to.not.be.empty;
            }).then(done);
        });

        it('should list messages by uid', function(done) {
            ic.listMessages({
                path: 'INBOX',
                firstUid: 1
            }).then(function(messages) {
                expect(messages).to.not.be.empty;
            }).then(done);
        });

        it('should create folder hierarchy', function(done) {
            ic.createFolder({
                path: ['bar', 'baz']
            }).then(function(fullPath) {
                expect(fullPath).to.equal('INBOX.bar.baz');
                return ic.listWellKnownFolders();
                
            }).then(function(folders) {
                var hasFoo = false;
                folders.Other.forEach(function(folder) {
                    hasFoo = hasFoo || folder.path === 'INBOX.bar.baz';
                });

                expect(hasFoo).to.be.true;
                expect(ic._delimiter).to.exist;
                expect(ic._prefix).to.exist;
                expect(hasFoo).to.be.true;
            }).then(done);
        });

        it('should upload Message', function(done) {
            var msg = 'MIME-Version: 1.0\r\nDate: Wed, 9 Jul 2014 15:07:47 +0200\r\nDelivered-To: test@test.com\r\nMessage-ID: <CAHftYYQo=5fqbtnv-DazXhL2j5AxVP1nWarjkztn-N9SV91Z2w@mail.gmail.com>\r\nSubject: integration test\r\nFrom: Test Test <test@test.com>\r\nTo: Test Test <test@test.com>\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nintegration test',
                path = 'INBOX',
                msgCount;

            ic.listMessages({
                path: path,
                firstUid: 1
            }).then(function(messages) {
                expect(messages).to.not.be.empty;
                msgCount = messages.length;

                return ic.uploadMessage({
                    path: path,
                    message: msg
                });
            }).then(function() {
                return ic.listMessages({
                    path: path,
                    firstUid: 1
                });
            }).then(function(messages) {
                expect(messages.length).to.equal(msgCount + 1);
            }).then(done);
        });

        it('should get message parts', function(done) {
            var msg;
            ic.listMessages({
                path: 'INBOX',
                firstUid: 1
            }).then(function(messages) {
                msg = messages.pop();
                return ic.getBodyParts({
                    path: 'INBOX',
                    uid: msg.uid,
                    bodyParts: msg.bodyParts
                });
            }).then(function(bodyParts) {
                expect(msg.bodyParts).to.equal(bodyParts);
                expect(bodyParts[0].raw).to.not.be.empty;
            }).then(done);
        });
    });
});