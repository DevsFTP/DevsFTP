const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate SVG Icon for DevsFTP Brand Mark
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#181B1F"/>
      <stop offset="100%" stop-color="#111315"/>
    </linearGradient>
    <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <!-- Background Card -->
  <rect width="512" height="512" rx="96" fill="url(#bgGrad)" stroke="#2d3238" stroke-width="12"/>
  <!-- Inner Terminal Frame -->
  <rect x="56" y="56" width="400" height="400" rx="64" fill="#141619" stroke="rgba(245, 158, 11, 0.2)" stroke-width="8"/>
  <!-- Terminal Prompt >_ Symbol -->
  <path d="M 120 180 L 220 256 L 120 332" fill="none" stroke="url(#amberGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  <line x1="256" y1="332" x2="380" y2="332" stroke="url(#amberGrad)" stroke-width="36" stroke-linecap="round" filter="url(#glow)"/>
</svg>`;

fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svgContent, 'utf8');
console.log('Successfully generated assets/icon.svg');
