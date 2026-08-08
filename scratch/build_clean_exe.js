const packager = require('@electron/packager');
const path = require('path');
const fs = require('fs');

async function build() {
  const rootDir = 'C:/xampp/htdocs/DevsFTP';
  const outDir = 'C:/xampp/htdocs/DevsFTP/dist';

  console.log('Building DevsFTP executable package...');
  try {
    const appPaths = await packager({
      dir: rootDir,
      name: 'DevsFTP',
      platform: 'win32',
      arch: 'x64',
      out: outDir,
      icon: path.join(rootDir, 'assets/icon.ico'),
      overwrite: true,
      asar: false,
      ignore: [
        /scratch/,
        /dist/,
        /\.git/
      ]
    });
    console.log('SUCCESS! App paths:', appPaths);

    const builtFolder = appPaths[0];
    const targetUnpacked = path.join(outDir, 'win-unpacked');

    function copyRecursiveSync(src, dest) {
      if (!fs.existsSync(src)) return;
      if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => {
          copyRecursiveSync(path.join(src, child), path.join(dest, child));
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    }

    if (builtFolder && fs.existsSync(builtFolder)) {
      copyRecursiveSync(builtFolder, targetUnpacked);
      console.log('✔ Copied executable files to dist/win-unpacked cleanly!');
    }
  } catch (e) {
    console.error('PACKAGER ERROR:', e);
  }
}

build();
