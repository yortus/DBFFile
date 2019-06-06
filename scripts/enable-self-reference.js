let fs = require('fs');
let path = require('path');




// Create a symlink at `node_modules/penc` pointing to `dist/commonjs`
try {
    let linkFrom = path.join(__dirname, '../node_modules/dbffile');
    let linkTo = path.join(__dirname, '../dist');
    fs.symlinkSync(linkTo, linkFrom, 'junction');
}
catch (err) {
    // An EEXIST error implies we already have a self-ref, in which case we ignore and continue. 
    if (err.code !== 'EEXIST') throw err;
}
