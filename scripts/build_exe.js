const packager = require('@electron/packager');
const fs = require('fs');
const path = require('path');

async function build() {
  console.log('[1/4] Preparing directories...');
  const rootDir = path.join(__dirname, '..');
  const targetDir = path.join(rootDir, 'dist', 'win-unpacked');
  const tempBuildDir = path.join(rootDir, 'dist', 'temp_build');

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  if (fs.existsSync(tempBuildDir)) {
    fs.rmSync(tempBuildDir, { recursive: true, force: true });
  }

  console.log('[2/4] Packaging application with @electron/packager...');
  try {
    const appPaths = await packager({
      dir: rootDir,
      name: 'DevsFTP',
      platform: 'win32',
      arch: 'x64',
      out: tempBuildDir,
      overwrite: true,
      icon: path.join(rootDir, 'assets', 'icon.ico'),
      ignore: [/^\/dist/, /^\/\.git/]
    });

    console.log('[3/4] Packager produced output at:', appPaths);
    const tempPackDir = appPaths[0];
    fs.mkdirSync(targetDir, { recursive: true });

    const files = fs.readdirSync(tempPackDir);
    for (const file of files) {
      const src = path.join(tempPackDir, file);
      const dest = path.join(targetDir, file);
      fs.cpSync(src, dest, { recursive: true });
    }

    console.log('[4/4] Cleaning temporary build directory...');
    fs.rmSync(tempBuildDir, { recursive: true, force: true });
    console.log('SUCCESS: Generated fresh executable at:', path.join(targetDir, 'DevsFTP.exe'));
  } catch (err) {
    console.error('ERROR during packaging:', err);
    process.exit(1);
  }
}

build();
