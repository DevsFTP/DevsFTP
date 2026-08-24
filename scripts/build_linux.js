const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const GPG_KEY = '7DA36A4AD371D675';

console.log('=== DevsFTP Linux Distribution Build Pipeline ===');
console.log('1. Verifying Linux branding assets...');
const linuxIcon = path.join(rootDir, 'assets', 'branding', 'icon_512.png');

if (!fs.existsSync(linuxIcon)) {
  console.warn('⚠️ 512x512 PNG icon missing at assets/branding/icon_512.png; fallback icon will be used.');
} else {
  console.log('✓ Found Linux desktop icon: assets/branding/icon_512.png');
}

console.log('2. Building Linux AppImage, DEB, and tar.gz targets via electron-builder...');
try {
  execSync('npx electron-builder --linux AppImage deb tar.gz', { cwd: rootDir, stdio: 'inherit' });
} catch (err) {
  console.error('⚠️ Linux build failed. Ensure fpm/docker/AppImage tools are available if cross-compiling from Windows.');
  process.exit(1);
}

console.log('3. Signing build outputs with GPG key ' + GPG_KEY + '...');

const targets = [
  { file: 'DevsFTP-1.0.0.AppImage', label: 'AppImage' },
  { file: 'devsftp_1.0.0_amd64.deb', label: 'DEB', deb: true },
  { file: 'devsftp-1.0.0.tar.gz', label: 'tar.gz' }
];

let signingFailed = false;

for (const target of targets) {
  const filePath = path.join(distDir, target.file);
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️ Skipping ' + target.label + ' signing — file not found: ' + filePath);
    continue;
  }
  try {
    if (target.deb) {
      execSync('dpkg-sig --sign builder -k ' + GPG_KEY + ' ' + filePath, { stdio: 'inherit' });
    } else {
      execSync('gpg --batch --yes --detach-sign --armor -u ' + GPG_KEY + ' ' + filePath, { stdio: 'inherit' });
    }
    console.log('✓ Signed: ' + target.file);
  } catch (e) {
    console.warn('⚠️ Signing failed for ' + target.label + ' — ' + e.message);
    signingFailed = true;
  }
}

if (signingFailed) {
  console.warn('⚠️ Some files could not be signed. Ensure gpg and dpkg-sig are installed and your key is in the keyring.');
} else {
  console.log('✅ All outputs signed successfully.');
}

console.log('✅ Linux Build Complete: ' + distDir);
