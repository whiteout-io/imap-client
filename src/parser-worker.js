(function() {
    'use strict';

    // import web worker dependencies
    importScripts('require.js');

    /**
     * In the context of a worker, both self and this reference the global scope for the worker.
     * http://www.html5rocks.com/en/tutorials/workers/basics/#toc-enviornment
     */
    self.onmessage = function(e) {
        require.config({
            baseUrl: '.',
            paths: {
                'node-forge': 'forge',
                'setimmediate': 'setImmediate'
            }
        });

        require(['parser'], function(parser) {
            parser.parse(e.data, function(parsed) {
                self.postMessage(parsed);
            });
        });
    };
}());