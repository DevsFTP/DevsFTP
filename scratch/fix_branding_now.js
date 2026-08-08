/**
 * Full-Bleed High-Precision Branding & Windows ICO Generator
 * Uses Electron offscreen BrowserWindow with zero HTML margins (margin:0; padding:0)
 * to capture pixel-perfect transparent PNGs and build a 100% valid Windows icon.ico binary.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  try {
    const rootDir = path.resolve(__dirname, '..');
    const assetsDir = path.join(rootDir, 'assets');
    const brandingDir = path.join(assetsDir, 'branding');

    if (!fs.existsSync(brandingDir)) {
      fs.mkdirSync(brandingDir, { recursive: true });
    }

    const svgPath = path.join(assetsDir, 'icon.svg');
    if (!fs.existsSync(svgPath)) {
      console.error('Source icon.svg not found!');
      app.exit(1);
      return;
    }

    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const html = `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;background:transparent;}svg{width:100%;height:100%;display:block;}</style></head><body>${svgContent}</body></html>`;

    const win = new BrowserWindow({
      width: 512,
      height: 512,
      show: false,
      transparent: true,
      frame: false,
      webPreferences: { offscreen: true }
    });

    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    const sizes = [
      { name: 'icon.png', size: 512, targetDir: assetsDir },
      { name: 'icon_512.png', size: 512, targetDir: brandingDir },
      { name: 'icon_256.png', size: 256, targetDir: brandingDir },
      { name: 'icon_128.png', size: 128, targetDir: brandingDir },
      { name: 'icon_64.png', size: 64, targetDir: brandingDir },
      { name: 'icon_48.png', size: 48, targetDir: brandingDir },
      { name: 'icon_32.png', size: 32, targetDir: brandingDir },
      { name: 'icon_16.png', size: 16, targetDir: brandingDir },
      { name: 'tray_icon.png', size: 32, targetDir: brandingDir },
      { name: 'tray_icon_16.png', size: 16, targetDir: brandingDir },
      { name: 'notification_icon.png', size: 64, targetDir: brandingDir },
      { name: 'folder_remote.png', size: 64, targetDir: brandingDir },
      { name: 'folder_local.png', size: 64, targetDir: brandingDir }
    ];

    for (const s of sizes) {
      win.setSize(s.size, s.size);
      await new Promise(r => setTimeout(r, 100));
      const img = await win.webContents.capturePage();
      const pngBuf = img.toPNG();
      const outPath = path.join(s.targetDir, s.name);
      fs.writeFileSync(outPath, pngBuf);
      console.log(`✓ Captured ${s.name} (${s.size}x${s.size}, ${pngBuf.length} bytes)`);
    }

    win.close();

    // Build Master Multi-Resolution Windows icon.ico
    const frameFiles = [
      { name: 'icon_256.png', size: 256 },
      { name: 'icon_128.png', size: 128 },
      { name: 'icon_64.png', size: 64 },
      { name: 'icon_48.png', size: 48 },
      { name: 'icon_32.png', size: 32 },
      { name: 'icon_16.png', size: 16 }
    ];

    const images = frameFiles.map(f => {
      const buf = fs.readFileSync(path.join(brandingDir, f.name));
      return {
        width: f.size >= 256 ? 0 : f.size,
        height: f.size >= 256 ? 0 : f.size,
        size: buf.length,
        buffer: buf
      };
    });

    const headerSize = 6 + (images.length * 16);
    let currentOffset = headerSize;
    const iconDir = Buffer.alloc(headerSize);
    iconDir.writeUInt16LE(0, 0); // Reserved
    iconDir.writeUInt16LE(1, 2); // ICO Type
    iconDir.writeUInt16LE(images.length, 4); // Count

    images.forEach((img, idx) => {
      const off = 6 + (idx * 16);
      iconDir.writeUInt8(img.width, off);
      iconDir.writeUInt8(img.height, off + 1);
      iconDir.writeUInt8(0, off + 2);
      iconDir.writeUInt8(0, off + 3);
      iconDir.writeUInt16LE(1, off + 4);
      iconDir.writeUInt16LE(32, off + 6);
      iconDir.writeUInt32LE(img.size, off + 8);
      iconDir.writeUInt32LE(currentOffset, off + 12);
      currentOffset += img.size;
    });

    const icoBuffer = Buffer.concat([iconDir, ...images.map(img => img.buffer)]);
    const targetIcoPath = path.join(assetsDir, 'icon.ico');
    fs.writeFileSync(targetIcoPath, icoBuffer);
    console.log(`✓ Master Windows icon.ico generated successfully (${icoBuffer.length} bytes)!`);

    console.log('\n🎉 BRANDING FIX COMPLETE!');
    app.exit(0);
  } catch (err) {
    console.error('Branding fix failed:', err);
    app.exit(1);
  }
});
