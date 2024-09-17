const fs = require('fs');
const path = require('path');
const stream = fs.openSync((path.join(__dirname, '..', 'src', 'isDemo.js')), 'w');
fs.writeSync(stream, 'const IS_DEMO = false;\nmodule.exports = {IS_DEMO};\n');
fs.closeSync(stream);
