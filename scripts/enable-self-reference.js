var fs = require('fs');
var path = require('path');


// Add dbffile.js and dbffile.d.ts to dbffile's own node_modules folder, so it can require() itself (e.g. in tests).
fs.writeFileSync(path.join(__dirname, '../node_modules/dbffile.js'), `module.exports = require('..');`);
fs.writeFileSync(path.join(__dirname, '../node_modules/dbffile.d.ts'), `export * from '..';`);
