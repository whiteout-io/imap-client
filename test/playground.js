'use strict';

var ImapClient = require('../index').ImapClient,
    loginOptions, ic;

loginOptions = {
    port: 993,
    host: 'imap.gmail.com',
    auth: {
        user: "safewithme.testuser@gmail.com",
        pass: "hellosafe"
    },
    secure: true
};

console.log('> creating imap client...');
ic = new ImapClient(loginOptions);
console.log('> logging in to gmail...');
ic.login(function() {
    console.log('> logged in, ready to roll.');

    ic.listAllFolders(function(error, paths) {
        var i = 0,
            l = paths.length;

        console.log('> all paths:');
        for (i = 0, l = paths.length; i < l; i++) {
            console.log(paths[i]);
        }
        process.exit(1);
    });
});