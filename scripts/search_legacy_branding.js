const fs = require('fs');
const path = require('path');

function searchPath(targetPath, pattern) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    for (const f of files) {
      if (f !== 'node_modules' && f !== 'dist' && f !== 'backup_v1_baseline' && f !== '.git') {
        searchPath(path.join(targetPath, f), pattern);
      }
    }
  } else if (stat.isFile()) {
    const content = fs.readFileSync(targetPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(pattern.toLowerCase())) {
        console.log(`${targetPath}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
}

console.log('--- Searching for legacy PulseFTP references ---');
searchPath(path.join(__dirname, '..', 'src'), 'pulseftp');
searchPath(path.join(__dirname, '..', 'README.md'), 'pulseftp');
searchPath(path.join(__dirname, '..', 'ROADMAP.md'), 'pulseftp');
searchPath(path.join(__dirname, '..', 'DESIGN_GUIDELINES.md'), 'pulseftp');
searchPath(path.join(__dirname, '..', 'PROJECT_STATE.md'), 'pulseftp');
console.log('--- Search complete ---');
