const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

if (fs.existsSync(distDir)) {
  console.log('Purging old build cache in dist directory...');
  try {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log('✔ Cleaned dist directory successfully.');
  } catch (err) {
    console.error('Error cleaning dist directory:', err);
  }
}
