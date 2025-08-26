/*jshint node:true*/

// Re-export compiled TypeScript bundle for CJS consumers
const bundle = require('./dist/index.js');
module.exports = bundle.default || bundle;
module.exports.Stream = bundle.Stream || (bundle.default && bundle.default.Stream);