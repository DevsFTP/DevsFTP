/**
 * Binary Windows ICO File Generator
 * Packs multiple PNG icon frames (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
 * into a single Windows ICO binary container file (assets/icon.ico).
 */

const fs = require('fs');
const path = require('path');

const brandingDir = path.resolve('assets/branding');
const assetsDir = path.resolve('assets');

const frameFiles = [
  { file: 'icon_256.png', size: 256 },
  { file: 'icon_128.png', size: 128 },
  { file: 'icon_64.png', size: 64 },
  { file: 'icon_48.png', size: 48 },
  { file: 'icon_32.png', size: 32 },
  { file: 'icon_16.png', size: 16 }
];

const images = [];
for (const frame of frameFiles) {
  const p = path.join(brandingDir, frame.file);
  if (fs.existsSync(p)) {
    const buf = fs.readFileSync(p);
    images.push({
      width: frame.size >= 256 ? 0 : frame.size,
      height: frame.size >= 256 ? 0 : frame.size,
      size: buf.length,
      buffer: buf
    });
  }
}

if (images.length === 0) {
  console.error('No PNG frames found in assets/branding!');
  process.exit(1);
}

const headerSize = 6 + (images.length * 16);
let currentOffset = headerSize;

const iconDir = Buffer.alloc(headerSize);

// Write ICONDIR
iconDir.writeUInt16LE(0, 0); // Reserved
iconDir.writeUInt16LE(1, 2); // Type 1 = ICO
iconDir.writeUInt16LE(images.length, 4); // Count

// Write ICONDIRENTRY for each image frame
images.forEach((img, idx) => {
  const entryOffset = 6 + (idx * 16);
  iconDir.writeUInt8(img.width, entryOffset);        // Width (0 = 256)
  iconDir.writeUInt8(img.height, entryOffset + 1);   // Height (0 = 256)
  iconDir.writeUInt8(0, entryOffset + 2);            // Color palette (0)
  iconDir.writeUInt8(0, entryOffset + 3);            // Reserved
  iconDir.writeUInt16LE(1, entryOffset + 4);         // Color planes (1)
  iconDir.writeUInt16LE(32, entryOffset + 6);        // Bits per pixel (32)
  iconDir.writeUInt32LE(img.size, entryOffset + 8);  // Size of image data
  iconDir.writeUInt32LE(currentOffset, entryOffset + 12); // Offset of image data
  currentOffset += img.size;
});

const fileBuffer = Buffer.concat([iconDir, ...images.map(img => img.buffer)]);

const targetIcoPath = path.join(assetsDir, 'icon.ico');
fs.writeFileSync(targetIcoPath, fileBuffer);

console.log(`✓ Master Windows icon.ico generated successfully (${fileBuffer.length} bytes, ${images.length} embedded PNG frames)!`);
