// define(function(require) {
//     'use strict';

//     var chai = require('chai'),
//         expect = chai.expect,
//         ImapClient = require('imap-client'),
//         loginOptions;

//     chai.Assertion.includeStack = true;

//     loginOptions = {
//         port: 12345,
//         host: 'localhost',
//         auth: {
//             user: 'testuser',
//             pass: 'testpass'
//         },
//         secure: false,
//         ca: '-----BEGIN CERTIFICATE-----\r\nMIICKTCCAZICCQDpQ20Tsi+iMDANBgkqhkiG9w0BAQUFADBZMQswCQYDVQQGEwJB\r\nVTETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0\r\ncyBQdHkgTHRkMRIwEAYDVQQDEwlsb2NhbGhvc3QwHhcNMTQwMzE3MTM1MzMxWhcN\r\nMTQwNDE2MTM1MzMxWjBZMQswCQYDVQQGEwJBVTETMBEGA1UECBMKU29tZS1TdGF0\r\nZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMRIwEAYDVQQDEwls\r\nb2NhbGhvc3QwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAMD2N+TDbLNTJ9zX\r\nm8QLMYxlPbB8zg7mXKhsUf9nesY16vE8jCYPLGU4KrlwTz8rwU25o2b02RsQJJf1\r\nZHvLJRMbyRftwboeHDUgKwTlEpZr/u4gkhq7nXtDk3oDbMEzhgsIB7BBmF2/h9g0\r\nLPe+xO7IbOcPmkBHtsh8IdHqVuUFAgMBAAEwDQYJKoZIhvcNAQEFBQADgYEAbs6+\r\nswTx03uGJfihujLC7sUiTmv9rFOTiqgElhK0R3Pft4nbWL1Jhn4twUwCa+csCDEA\r\nroItaeKZAC5zUGA4uXn1R0dZdOdLOff7998zSY3V5/cMAUYFztqSJjvqllDXxAmF\r\n30HHOMhiXQI1Wm0pqKlgzGCBt0fObgSaob9Zqbs=\r\n-----END CERTIFICATE-----\r\n'
//     };

//     describe('ImapClient integration tests', function() {
//         var ic;

//         beforeEach(function(done) {
//             ic = new ImapClient(loginOptions);
//             ic.login(done);
//         });

//         afterEach(function(done) {
//             ic.logout(done);
//         });

//         it('should list well known folders', function(done) {
//             ic.listWellKnownFolders(function(error, folders) {
//                 expect(error).to.not.exist;

//                 expect(folders).to.exist;
//                 expect(folders.drafts).to.exist;
//                 expect(folders.drafts.name).to.exist;
//                 expect(folders.drafts.type).to.exist;
//                 expect(folders.drafts.path).to.exist;

//                 expect(folders.sent).to.exist;
//                 expect(folders.trash).to.exist;
//                 expect(folders.junk).to.exist;

//                 done();
//             });
//         });

//         // it('should search messages', function(done) {
//         //     ic.search({
//         //         path: 'INBOX',
//         //         subject: 'blablubb',
//         //         unread: false,
//         //         answered: false
//         //     }, function(error, uids) {
//         //         expect(error).to.not.exist;
//         //         expect(uids).to.not.be.empty;
//         //         done();
//         //     });
//         // });

//         it('should list messages by uid', function(done) {
//             ic.listMessagesByUid({
//                 path: 'INBOX',
//                 firstUid: 1,
//                 lastUid: 3
//             }, function(error, messages) {
//                 expect(error).to.not.exist;
//                 expect(messages).to.not.be.empty;
//                 expect(messages.length).to.equal(3);
//                 expect(messages[0].id).to.not.be.empty;
//                 expect(/[<>]/g.test(messages[0].id)).to.be.false;
//                 expect(messages[0].bodystructure).to.exist;
//                 expect(messages[0].textParts.length).to.equal(1);
//                 done();
//             });
//         });

//         it('should list messages by uid without providing lastUid parameter', function(done) {
//             ic.listMessagesByUid({
//                 path: 'INBOX',
//                 firstUid: 1
//             }, function(error, messages) {
//                 expect(error).to.not.exist;
//                 expect(messages).to.not.be.empty;
//                 expect(messages.length).to.equal(4);
//                 done();
//             });
//         });

//         it('should get message in plain text', function(done) {
//             ic.listMessagesByUid({
//                 path: 'INBOX',
//                 firstUid: 2,
//                 lastUid: 2
//             }, function(error, messages) {
//                 ic.getBody({
//                     path: 'INBOX',
//                     message: messages[0]
//                 }, function(error, message) {
//                     expect(error).to.not.exist;
//                     expect(message).to.exist;
//                     expect(message.body).to.equal("Hello world");
//                     done();
//                 });
//             });
//         });

//         it('should get cyphertext of an encrypted message', function(done) {
//             ic.listMessagesByUid({
//                 path: 'INBOX',
//                 firstUid: 4,
//                 lastUid: 4
//             }, function(error, messages) {
//                 ic.getBody({
//                     path: 'INBOX',
//                     message: messages[0]
//                 }, function(error, message) {
//                     expect(error).to.not.exist;
//                     expect(message).to.exist;
//                     expect(message.body).to.equal("insert pgp here.");
//                     done();
//                 });
//             });
//         });

//         // it('should get flags', function(done) {
//         //     ic.getFlags({
//         //         path: 'INBOX',
//         //         uid: 1
//         //     }, function(error, flags) {
//         //         expect(error).to.be.null;
//         //         expect(flags.unread).to.be.false;
//         //         expect(flags.answered).to.be.false;
//         //         done();
//         //     });
//         // });

//         // it('should update flags', function(done) {
//         //     ic.updateFlags({
//         //         path: 'INBOX',
//         //         uid: 1,
//         //         unread: true,
//         //         answered: true
//         //     }, function(error, flags) {
//         //         expect(error).to.be.null;
//         //         expect(flags.unread).to.be.true;
//         //         expect(flags.answered).to.be.true;
//         //         done();
//         //     });
//         // });

//         // it('should purge message', function(done) {
//         //     ic.listMessagesByUid({
//         //         path: 'INBOX',
//         //         uid: 1,
//         //     }, function(error, messages) {
//         //         var i, l;
//         //         expect(error).to.not.exist;

//         //         for (i = 0, l = messages.length; i < l; i++) {
//         //             if (messages[i].subject === 'blablubb') {
//         //                 purge(messages[i].uid);
//         //                 break;
//         //             }
//         //         }

//         //         function purge(uid) {
//         //             ic.deleteMessage({
//         //                 path: 'INBOX',
//         //                 uid: uid
//         //             }, function(error) {
//         //                 expect(error).to.be.null;
//         //                 done();
//         //             });
//         //         }

//         //         done();
//         //     });
//         // });

//         // it('should move message', function(done) {
//         //     ic.moveMessage({
//         //         path: 'INBOX',
//         //         uid: 1,
//         //         destination: '[Gmail]/Trash'
//         //     }, function(error) {
//         //         expect(error).to.not.exist;

//         //         done();
//         //     });
//         // });

//         it('should get attachments', function(done) {
//             ic.listMessagesByUid({
//                 path: 'INBOX',
//                 firstUid: 2,
//                 lastUid: 2
//             }, function(error, messages) {
//                 expect(error).to.not.exist;

//                 ic.getAttachment({
//                     path: 'INBOX',
//                     uid: messages[0].uid,
//                     attachment: messages[0].attachments[0]
//                 }, function(error, attachment) {
//                     expect(error).to.not.exist;
//                     expect(attachment).to.exist;
//                     expect(attachment.content).to.exist;
//                     expect(attachment.progress).to.equal(1);

//                     done();
//                 });
//             });
//         });
//     });
// });