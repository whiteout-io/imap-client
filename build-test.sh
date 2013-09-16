#!/bin/sh

echo "> copying dependencies for browser testing\n"

# basics to get the test environment up
cp -v node_modules/chai/chai.js test/lib/
cp -v node_modules/mocha/mocha.js test/lib/
cp -v node_modules/mocha/mocha.css test/res/
cp -v node_modules/mocha/mocha.js test/lib/
cp -v node_modules/requirejs/require.js test/lib/

# stuff to get the dependencies up and running

# inbox
cp -v node_modules/inbox/src/*.js test/lib/
cp -v node_modules/inbox/node_modules/mimelib/src/mimelib.js test/lib/
cp -v node_modules/inbox/node_modules/mimelib/node_modules/addressparser/src/addressparser.js test/lib/
cp -v node_modules/inbox/node_modules/mimelib/node_modules/encoding/src/encoding.js test/lib/
cp -v node_modules/inbox/node_modules/mimelib/node_modules/encoding/node_modules/iconv-lite/src/*.js test/lib/
cp -v node_modules/inbox/node_modules/mimelib/node_modules/encoding/node_modules/mime/src/*.js test/lib/
cp -v node_modules/inbox/node_modules/mimelib/node_modules/encoding/mime/src/mime.js test/lib/
cp -v node_modules/inbox/node_modules/node-shims/src/*.js test/lib/
cp -v node_modules/inbox/node_modules/node-shims/node_modules/node-forge/js/*.js test/lib/
cp -v node_modules/inbox/node_modules/node-shims/node_modules/setimmediate/setImmediate.js test/lib/
cp -v node_modules/inbox/node_modules/utf7/src/utf7.js test/lib/
cp -v node_modules/inbox/node_modules/xoauth2/src/xoauth2.js test/lib/

#mailparser
cp -v node_modules/mailparser/src/*.js test/lib/

echo "\n> browser test is ready for execution\n"
