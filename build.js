const fs = require('fs');
const browserify = require('browserify');
const watchify = require('watchify');
const eslintify = require('eslintify');

const bundler = browserify({
    entries: ['./src/client.js'],
    extensions: ['.js'],
    paths: ['./node_modules','./src/'],
    cache: {},
    packageCache: {},
    plugin: [watchify]
}).transform({passthrough: 'warnings'}, eslintify)
  .transform("babelify");

bundler.on('update', updateBundle);
bundler.on('bundle', function(err) {
    console.log('   ...Updated public/client.js!');
});

function updateBundle() {
    console.log('Updating public/client.js...');
    bundler.bundle().on("error", function(err) {
        console.log("Browserify error:", err.message);
        console.log(err);
    }).pipe(fs.createWriteStream("public/client.js"));
}

updateBundle();
