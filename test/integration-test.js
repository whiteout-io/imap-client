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
        ca: ['-----BEGIN CERTIFICATE-----\nMIIGmzCCBYOgAwIBAgIIIbZ3foy9DqgwDQYJKoZIhvcNAQEFBQAwcTELMAkGA1UE\nBhMCREUxHDAaBgNVBAoTE0RldXRzY2hlIFRlbGVrb20gQUcxHzAdBgNVBAsTFlQt\nVGVsZVNlYyBUcnVzdCBDZW50ZXIxIzAhBgNVBAMTGkRldXRzY2hlIFRlbGVrb20g\nUm9vdCBDQSAyMB4XDTEzMDMwMTEzNTgyOVoXDTE5MDcwOTIzNTkwMFowgckxCzAJ\nBgNVBAYTAkRFMSUwIwYDVQQKExxULVN5c3RlbXMgSW50ZXJuYXRpb25hbCBHbWJI\nMR8wHQYDVQQLExZULVN5c3RlbXMgVHJ1c3QgQ2VudGVyMQwwCgYDVQQIEwNOUlcx\nDjAMBgNVBBETBTU3MjUwMRAwDgYDVQQHEwdOZXRwaGVuMSAwHgYDVQQJExdVbnRl\ncmUgSW5kdXN0cmllc3RyLiAyMDEgMB4GA1UEAxMXVGVsZVNlYyBTZXJ2ZXJQYXNz\nIERFLTEwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCwg+9QiuYAxX9/\n4F9XRZrS1o0q+aa9L/5/K3vc+RqPpliiZ24vTkJc1JDpXrbWXS25uT3yzHukQrhI\nq0AbcRqNEAeFi5EhUiEM/vtb4BYGHdqfXQ3etgYYcCtJ43NAHaSgsyQ9kyGV2lmM\nwkeAX3qZ2CGE9/cR6w+bOogHArBdk2JaHG09myNZDytr6oUbWLjLd/qhC9YzyZSX\nbZgE/kh5L5Y6P9paw2pDdn7+Ni4pXzlmoj1k43uiz+h2ibe3DO9dKMZAaEKeyG1O\ng0f0r53M8O+8Bm2sXtWelrAgrfFlISgWzO1hkNs12rWpr4c5Ygde/behx9OQmPwp\nmS+e3WvTAgMBAAGjggLcMIIC2DAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFGJP\nE842Z4TNGfygTxmL7xVUATIcMB8GA1UdIwQYMBaAFDHDeRu69VPXF+CJei0XbAqz\nK50zMBIGA1UdEwEB/wQIMAYBAf8CAQAwWQYDVR0gBFIwUDBEBgkrBgEEAb1HDQIw\nNzA1BggrBgEFBQcCARYpaHR0cDovL3d3dy50ZWxlc2VjLmRlL3NlcnZlcnBhc3Mv\nY3BzLmh0bWwwCAYGZ4EMAQICMIHvBgNVHR8EgecwgeQwOqA4oDaGNGh0dHA6Ly9j\ncmwuc2VydmVycGFzcy50ZWxlc2VjLmRlL3JsL0RUX1JPT1RfQ0FfMi5jcmwwgaWg\ngaKggZ+GgZxsZGFwOi8vbGRhcC5zZXJ2ZXJwYXNzLnRlbGVzZWMuZGUvQ049RGV1\ndHNjaGUlMjBUZWxla29tJTIwUm9vdCUyMENBJTIwMixPVT1ULVRlbGVTZWMlMjBU\ncnVzdCUyMENlbnRlcixPPURldXRzY2hlJTIwVGVsZWtvbSUyMEFHLEM9REU/QXV0\naG9yaXR5UmV2b2NhdGlvbkxpc3QwggEjBggrBgEFBQcBAQSCARUwggERMCoGCCsG\nAQUFBzABhh5odHRwOi8vb2NzcDAyLnRlbGVzZWMuZGUvb2NzcHIwQQYIKwYBBQUH\nMAKGNWh0dHA6Ly9jcmwuc2VydmVycGFzcy50ZWxlc2VjLmRlL2NydC9EVF9ST09U\nX0NBXzIuY2VyMIGfBggrBgEFBQcwAoaBkmxkYXA6Ly9sZGFwLnNlcnZlcnBhc3Mu\ndGVsZXNlYy5kZS9DTj1EZXV0c2NoZSUyMFRlbGVrb20lMjBSb290JTIwQ0ElMjAy\nLE9VPVQtVGVsZVNlYyUyMFRydXN0JTIwQ2VudGVyLE89RGV1dHNjaGUlMjBUZWxl\na29tJTIwQUcsQz1ERT9jQUNlcnRpZmljYXRlMA0GCSqGSIb3DQEBBQUAA4IBAQBO\nE04qoEkEc9ad+WwSurVYfcDdjGvpqrtbI89woXDsWLQTMhA7D7jVuls90SJns0vc\nK9qoYkEGt0/ZlawLe2lyNWtueHfUf+dgleUunwHYLxuj3jQ2ERzQLVLrswjecRpX\nvGAGej89WpGQ9PMq27WGNC5WCmzVC9rk5naFgacsbwKwyjU0LoBArtAQnAAlpHDw\nPenv1Pe7MhUkCK0LqdTvkI/AHFzPYg/l5E3j8lQQ8hiKx8U6wf9xVKECLA2RlRqY\nUX2rpjQNxnvEq/mEQv3x3mLOEFJ3TAKI+soDgOOi0OG8+ywhm6S+7Z9lTlJ+BcD6\noy1MNKd4CQbltHLMTFUH\n-----END CERTIFICATE-----\n']
    };

    describe('ImapClient t-online integration tests', function() {
        this.timeout(5000);
        chai.Assertion.includeStack = true;

        // don't log in the tests
        axe.removeAppender({});

        var ic;

        beforeEach(function(done) {
            ic = new ImapClient(loginOptions);
            ic.onSyncUpdate = function() {};
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

                expect(folders.other).to.be.instanceof(Array);

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