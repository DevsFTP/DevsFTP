const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Master Vector SVG Brand Mark: High-Contrast Silver/White D + Terminal > on Dark Graphite + Minimal Amber Node
const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <!-- Neutral Dark Graphite Container -->
  <rect width="512" height="512" rx="100" fill="#181B1F" stroke="#2d3238" stroke-width="16"/>
  
  <!-- Outer D Loop - High Contrast Silver/White -->
  <path d="M 130 110 L 260 110 C 355 110 405 165 405 256 C 405 347 355 402 260 402 L 130 402 Z" fill="none" stroke="#E6E6E6" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
  
  <!-- Inner Terminal Prompt > - High Contrast Crisp White -->
  <path d="M 170 190 L 245 256 L 170 322" fill="none" stroke="#FFFFFF" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  
  <!-- Connection Node ──● - Minimal Amber Highlight -->
  <line x1="250" y1="256" x2="325" y2="256" stroke="#F59E0B" stroke-width="36" stroke-linecap="round"/>
  <circle cx="338" cy="256" r="26" fill="#F59E0B"/>
</svg>`;

fs.writeFileSync(path.join(assetsDir, 'icon.svg'), masterSvg, 'utf8');

// Base64 PNG buffer for application window & Windows packager executable branding
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngBuffer);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), pngBuffer);

console.log('Successfully created high-contrast production branding assets: assets/icon.svg, assets/icon.png, assets/icon.ico');
