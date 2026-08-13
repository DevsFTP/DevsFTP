const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const exePath = path.join(distDir, 'win-unpacked', 'DevsFTP.exe');
const icoPath = path.join(rootDir, 'assets', 'icon.ico');
const rceditPath = path.join(rootDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

console.log('1. Cleaning existing dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

console.log('2. Building win-unpacked dir target first via electron-builder...');
execSync('npx electron-builder --win dir', { cwd: rootDir, stdio: 'inherit' });

console.log('3. Injecting DevsFTP icon & Win32 PE version metadata resources into DevsFTP.exe via rcedit...');
if (fs.existsSync(rceditPath) && fs.existsSync(exePath) && fs.existsSync(icoPath)) {
  const rceditCmd = `"${rceditPath}" "${exePath}" ` +
    `--set-icon "${icoPath}" ` +
    `--set-version-string "FileDescription" "DevsFTP — An FTP/SFTP client that works with you, not against you." ` +
    `--set-version-string "ProductName" "DevsFTP" ` +
    `--set-version-string "CompanyName" "DevsFTP.com" ` +
    `--set-version-string "LegalCopyright" "Copyright © 2026 DevsFTP.com" ` +
    `--set-version-string "OriginalFilename" "DevsFTP.exe" ` +
    `--set-file-version "1.0.0.0" ` +
    `--set-product-version "1.0.0.0"`;

  execSync(rceditCmd, { cwd: rootDir, stdio: 'inherit' });
  console.log('✓ Win32 PE Header Icon & Version Metadata updated successfully!');
} else {
  console.error('⚠️ Could not locate rcedit-x64.exe, DevsFTP.exe, or icon.ico');
}

console.log('4. Generating NSIS Installer and Portable binaries from pre-branded unpacked executable...');
execSync('npx electron-builder --win nsis portable --prepackaged dist/win-unpacked', { cwd: rootDir, stdio: 'inherit' });

console.log('5. Touching executable timestamp & refreshing Windows Shell cache...');
try {
  const now = new Date();
  fs.utimesSync(exePath, now, now);
  execSync('ie4uinit.exe -show', { stdio: 'ignore' });
} catch (e) {}

console.log('✅ Clean Branded Windows build complete at: ' + exePath);
