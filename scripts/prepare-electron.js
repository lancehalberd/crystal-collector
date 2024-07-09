const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const electronPkgJson = require('../electron/package.json');
const parentPkgJson = require('../package.json');

const src = path.join(__dirname, '..', 'public');
const dest = path.join(__dirname, '..', 'electron', 'out-resources');

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to);
    fs.readdirSync(from).forEach(element => {
        if (fs.lstatSync(path.join(from, element)).isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

// Copy build dir to electron out-resources, which is where electron-forge
// looks for source files.
rimraf.sync(dest);
copyFolderSync(src, dest);

// Overwrite nested package.json version, because this is what electron-forge
// uses to set the version in the Electron app.
electronPkgJson.version = parentPkgJson.version;
fs.writeFileSync(
  path.join(__dirname, '..', 'electron', 'package.json'),
  JSON.stringify(electronPkgJson, null, 2)
);
