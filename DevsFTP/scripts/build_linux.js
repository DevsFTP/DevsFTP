const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

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
  console.log('✅ Linux Distribution Build Complete in: ' + path.join(distDir, 'linux'));
} catch (err) {
  console.error('⚠️ Linux build failed. Ensure fpm/docker/AppImage tools are available if cross-compiling from Windows.');
  process.exit(1);
}
