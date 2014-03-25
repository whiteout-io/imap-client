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
            //
            // WEB WORKERS ARE DISABLED DUE TO THE ISSUE OF LOADING STRINGENCODING POLYFILLS IN A WORKER CONTEXT
            //
            window.Worker = undefined;
            
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
                expect(folders.flagged).to.exist;

                expect(folders.other).to.be.instanceof(Array);
                expect(folders.other).to.not.be.empty;

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
                done();
            });
        });

        it('should list messages by uid', function(done) {
            ic.listMessagesByUid({
                path: 'INBOX',
                firstUid: 1
            }, function(error, messages) {
                expect(error).to.not.exist;
                expect(messages).to.not.be.empty;
                done();
            });
        });

        it('should get plain text', function(done) {
            ic.listMessagesByUid({
                path: 'INBOX',
                firstUid: 1
            }, function(error, messages) {
                ic.getBody({
                    path: 'INBOX',
                    message: messages[0]
                }, function(error, message) {
                    expect(error).to.not.exist;
                    expect(message).to.exist;
                    expect(message.body).to.not.be.empty;
                    done();
                });
            });
        });
    });
});