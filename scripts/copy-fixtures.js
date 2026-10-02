let fs = require('fs');
let path = require('path');




// Copy the test fixtures alongside the compiled tests, since tests load fixtures relative to their own location.
let copyFrom = path.join(__dirname, '../test/fixtures');
let copyTo = path.join(__dirname, '../dist/test/fixtures');
fs.cpSync(copyFrom, copyTo, {recursive: true});
