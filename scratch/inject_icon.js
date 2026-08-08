const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'dist/DevsFTP-win32-x64');
const destDir = path.join(rootDir, 'dist/win-unpacked');

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
  copyRecursiveSync(srcDir, destDir);
  console.log('✔ Synced dist/DevsFTP-win32-x64 to dist/win-unpacked!');
}
