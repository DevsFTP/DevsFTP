const asar = require('@electron/asar');
const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    try {
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    } catch (e) {}
  });
  return arrayOfFiles;
}

const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const assetsDir = path.join(rootDir, 'assets');
const nodeModulesDir = path.join(rootDir, 'node_modules');

// Step 1: Ensure valid Windows DIB ICO file is built
console.log('Building 100% compliant Windows ICO file...');
try {
  execSync('powershell -ExecutionPolicy Bypass -File scratch/build_valid_windows_ico.ps1', { cwd: rootDir, stdio: 'inherit' });
} catch (e) {
  console.error('Error building ICO file:', e);
}

console.log('Collecting src, assets, and node_modules files for app.asar...');
const srcFiles = getAllFiles(srcDir);
const assetFiles = getAllFiles(assetsDir);
const modFiles = getAllFiles(nodeModulesDir);

const relFiles = [
  'package.json',
  ...srcFiles.map(f => path.relative(rootDir, f).replace(/\\/g, '/')),
  ...assetFiles.map(f => path.relative(rootDir, f).replace(/\\/g, '/')),
  ...modFiles.map(f => path.relative(rootDir, f).replace(/\\/g, '/'))
];

const destAsar = path.join(rootDir, 'dist/win-unpacked/resources/app.asar');
const destUnpackedAssets = path.join(rootDir, 'dist/win-unpacked/resources/assets');

// Copy assets outside ASAR for Windows native APIs (Toast Notifications)
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
try {
  copyDirSync(assetsDir, destUnpackedAssets);
  console.log('✔ Copied assets to dist/win-unpacked/resources/assets for native OS access!');
} catch (e) {
  console.error('Error copying assets to resources:', e);
}

console.log(`Packing ${relFiles.length} files into app.asar...`);
asar.createPackageFromFiles(rootDir, destAsar, relFiles).then(() => {
  console.log('✔ FRESH app.asar PACKED SUCCESSFULLY WITH ASSETS AND ALL NODE_MODULES!');

  const rceditPath = path.join(rootDir, 'node_modules/rcedit/bin/rcedit.exe');
  const exePath = path.join(rootDir, 'dist/win-unpacked/DevsFTP.exe');
  const icoPath = path.join(rootDir, 'assets/icon.ico');

  if (fs.existsSync(rceditPath) && fs.existsSync(exePath) && fs.existsSync(icoPath)) {
    try {
      execSync(`"${rceditPath}" "${exePath}" --set-icon "${icoPath}"`);
      console.log('✔ DevsFTP.exe binary icon permanently patched with rcedit!');
    } catch (e) {
      console.warn('Note: rcedit skipped (executable may be running):', e.message);
    }
  }
}).catch(err => {
  console.error('Error packing app.asar:', err);
});
