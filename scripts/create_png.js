const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// 1x1 Amber PNG base64
const amberPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(amberPngBase64, 'base64');

fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngBuffer);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), pngBuffer);

console.log('Successfully created assets/icon.png and assets/icon.ico');
