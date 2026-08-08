/**
 * DevsFTP Full Branding Asset Generator
 * Uses Electron's nativeImage SVG rasterizer to generate pixel-perfect PNG assets
 * across all required OS resolutions: Taskbar, System Tray, Desktop Shortcut,
 * Windows Toast Notifications, and Remote/Local Folder icons.
 */

const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  try {
    const assetsDir = path.join(__dirname, '../assets');
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

    console.log('Rasterizing icon.svg with Electron nativeImage engine...');
    const baseImg = nativeImage.createFromPath(svgPath);

    const sizes = [
      { name: 'icon.png', size: 512, dest: assetsDir },
      { name: 'icon_512.png', size: 512, dest: brandingDir },
      { name: 'icon_256.png', size: 256, dest: brandingDir },
      { name: 'icon_128.png', size: 128, dest: brandingDir },
      { name: 'icon_64.png', size: 64, dest: brandingDir },
      { name: 'icon_48.png', size: 48, dest: brandingDir },
      { name: 'icon_32.png', size: 32, dest: brandingDir },
      { name: 'icon_16.png', size: 16, dest: brandingDir },
      { name: 'tray_icon.png', size: 32, dest: brandingDir },
      { name: 'tray_icon_16.png', size: 16, dest: brandingDir },
      { name: 'notification_icon.png', size: 64, dest: brandingDir },
      { name: 'installerHeader.png', size: 150, dest: assetsDir },
      { name: 'installerSidebar.png', size: 164, dest: assetsDir }
    ];

    sizes.forEach(item => {
      const resized = baseImg.resize({ width: item.size, height: item.size, quality: 'best' });
      const pngBuffer = resized.toPNG();
      const outPath = path.join(item.dest, item.name);
      fs.writeFileSync(outPath, pngBuffer);
      console.log(`✓ Generated ${item.name} (${item.size}x${item.size}) -> ${outPath}`);
    });

    console.log('\n🎉 ALL BRANDING ASSETS GENERATED SUCCESSFULLY!');
    app.exit(0);
  } catch (err) {
    console.error('Failed to generate branding assets:', err);
    app.exit(1);
  }
});
