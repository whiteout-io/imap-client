'use strict';

var rewire = require('rewire'),
    expect = require('chai').expect,
    imapClient = rewire('../index');

imapClient.__set__('inbox', {
    createConnection: function() {
        return 'UGA';
    }
});

describe('rewire', function() {
    describe('test rewire', function() {
        it('should work', function() {
            var ic = new imapClient.ImapClient();
            expect(ic._client).to.equal('UGA');
        });
    });
});