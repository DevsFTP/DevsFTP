const fs = require('fs');

// Check CRIT-07: tunnelService stopTunnel on sshClient close
const tunnel = fs.readFileSync('src/main/services/tunnelService.js', 'utf8');
const tLines = tunnel.split('\n');
console.log('=== tunnelService.js: sshClient.on / stopTunnel ===');
tLines.forEach((l, i) => {
  if (l.includes("sshClient.on(") || l.includes("stopTunnel") || l.includes("this.stop")) {
    console.log((i+1) + ': ' + l.trim());
  }
});

// Check HIGH-12: ftpService removeAllListeners
const ftp = fs.readFileSync('src/main/services/ftpService.js', 'utf8');
const fLines = ftp.split('\n');
console.log('\n=== ftpService.js: handleClose / removeListeners / socket ===');
fLines.forEach((l, i) => {
  if (l.includes("handleClose") || l.includes("removeListener") || l.includes("removeAll")) {
    console.log((i+1) + ': ' + l.trim());
  }
});

// Check LOW-09: TB in fileBrowser formatSize
const fb = fs.readFileSync('src/renderer/js/fileBrowser.js', 'utf8');
const fbLines = fb.split('\n');
console.log('\n=== fileBrowser.js: formatSize / TB ===');
fbLines.forEach((l, i) => {
  if (l.includes("formatSize") || l.includes("TB") || l.includes("PB")) {
    console.log((i+1) + ': ' + l.trim());
  }
});
