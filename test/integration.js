require.config({
    baseUrl: 'lib',
    paths: {
        'test': '..',
        'forge': 'forge.min'
    },
    shim: {
        forge: {
            exports: 'forge'
        }
    }

});

require([], function() {
    'use strict';

    mocha.setup('bdd');

    require(['test/integration-test'], function() {
        mocha.run();
    });
});