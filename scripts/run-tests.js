

// Tell mocha where the test files are.
process.argv.push('dist/test/**/*.js');

// Tell mocha *not* to call process.exit() when tests have finished.
process.argv.push('--no-exit');

// Tell mocha to lengthen its per-test timeout to 10 minutes (allows interactive debugging of tests).
process.argv.push('--timeout', '600000');

// Run the tests.
require('../node_modules/mocha/bin/_mocha');
