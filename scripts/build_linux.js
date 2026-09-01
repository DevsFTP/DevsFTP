const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const GPG_KEY = '7DA36A4AD371D675';

console.log('=== DevsFTP Linux Build & Signing Pipeline ===');

console.log('1. Building Linux targets (AppImage, deb, tar.gz)...');
execSync('npx electron-builder --linux AppImage deb tar.gz', { cwd: rootDir, stdio: 'inherit' });

console.log('2. Signing Linux release packages with GPG Key: ' + GPG_KEY);
const pkg = require(path.join(rootDir, 'package.json'));
const version = pkg.version || '1.0.1';

const targets = [
  { file: `DevsFTP-${version}.AppImage`, label: 'AppImage' },
  { file: `devsftp_${version}_amd64.deb`, label: 'DEB', deb: true },
  { file: `devsftp-${version}.tar.gz`, label: 'tar.gz' }
];

const distFiles = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];

for (const target of targets) {
  // Case-insensitive file matching to prevent casing mismatches on Linux
  const matchingFileName = distFiles.find(f => f.toLowerCase() === target.file.toLowerCase());
  const filePath = matchingFileName ? path.join(distDir, matchingFileName) : path.join(distDir, target.file);

  if (!fs.existsSync(filePath)) {
    console.warn('⚠️ Skipping ' + target.label + ' signing — file not found: ' + filePath);
    continue;
  }
  try {
    if (target.deb) {
      execSync('dpkg-sig --sign builder -k ' + GPG_KEY + ' "' + filePath + '"', { stdio: 'inherit' });
    } else {
      execSync('gpg --batch --yes --detach-sign --armor -u ' + GPG_KEY + ' "' + filePath + '"', { stdio: 'inherit' });
    }
    console.log('✓ Signed: ' + (matchingFileName || target.file));
  } catch (e) {
    console.warn('⚠️ Signing failed for ' + target.label + ' — ' + e.message);
  }
}

console.log('=== Linux Build & Signing Complete ===');
