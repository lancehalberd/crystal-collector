const fs = require('fs');
const browserify = require('browserify');
const eslintify = require('eslintify');

const bundler = browserify({
    entries: ['./src/client.js'],
    extensions: ['.js'],
    paths: ['./node_modules','./src/'],
    cache: {},
    packageCache: {}
}).transform({passthrough: 'warnings'}, eslintify)
  .transform("babelify");

bundler.on('update', updateBundle);

function updateBundle() {
    const writeStream = fs.createWriteStream("public/client.js");
    console.log('Updating public/client.js...');
    writeStream.on('finish',  () => {
        console.log('...Finished!');
    })
    bundler.bundle().on("error", function(err) {
        console.log("Browserify error:", err.message);
        console.log(err);
    }).pipe(writeStream);
}

updateBundle();
