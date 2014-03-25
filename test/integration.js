require.config({
    baseUrl: 'lib',
    paths: {
        'test': '..',
        'forge': 'forge.min',
    }
});

require([], function() {
    'use strict';

    mocha.setup('bdd');

    require(['test/imap-client-integration'], function() {
        mocha.run();
    });
});