const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../dist/win-unpacked/DevsFTP-win32-x64');
const destDir = path.join(__dirname, '../dist/win-unpacked');

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

if (fs.existsSync(srcDir)) {
  console.log('Syncing fresh build files from DevsFTP-win32-x64 to dist/win-unpacked...');
  copyRecursiveSync(srcDir, destDir);
  console.log('✔ Sync complete! dist/win-unpacked/DevsFTP.exe is 100% updated.');
} else {
  console.warn('Packaged directory not found:', srcDir);
}
