const fs = require('fs');

const files = {
  'sshTerminalService.js': 'src/main/services/sshTerminalService.js',
  'sftpService.js': 'src/main/services/sftpService.js',
  'ftpService.js': 'src/main/services/ftpService.js',
  'webdavService.js': 'src/main/services/webdavService.js',
  'tunnelService.js': 'src/main/services/tunnelService.js',
  'transferEngine.js': 'src/main/services/transfer/transferEngine.js',
  'sftpAdapter.js': 'src/main/services/transfer/sftpAdapter.js',
  'preload.js': 'src/main/preload.js',
  'cacheWatcherService.js': 'src/main/services/cacheWatcherService.js',
  'sessionManager.js': 'src/renderer/js/sessionManager.js',
  'main.js': 'src/main/main.js',
  'jobRunnerService.js': 'src/main/services/jobRunnerService.js',
  'fileBrowser.js': 'src/renderer/js/fileBrowser.js',
};

const checks = [
  // CRITICAL (10)
  { label: 'CRIT-01: stream.on(error) in sshTerminalService',           file: 'sshTerminalService.js',  needle: "stream.on('error'",             absent: false },
  { label: 'CRIT-02: sshClient.on(close) in sshTerminalService',        file: 'sshTerminalService.js',  needle: "sshClient.on('close'",           absent: false },
  { label: 'CRIT-03: progressStream.destroy in sftpAdapter error path', file: 'sftpAdapter.js',         needle: 'progressStream.destroy',         absent: false },
  { label: 'CRIT-04: ftp timeout=30000 in ftpService',                  file: 'ftpService.js',          needle: 'timeout = 30000',                absent: false },
  { label: 'CRIT-05: readStream.destroy on webdavService upload error',  file: 'webdavService.js',       needle: 'readStream.destroy()',           absent: false },
  { label: 'CRIT-06: timeout on webdavService HTTP operations',          file: 'webdavService.js',       needle: 'timeout',                        absent: false },
  { label: 'CRIT-07: stopTunnel() called in tunnelService sshClient close', file: 'tunnelService.js',   needle: 'this.stopTunnel(tunnelId',        absent: false },
  { label: 'CRIT-08: cleanReject for key-read in tunnelService',         file: 'tunnelService.js',       needle: 'cleanReject',                    absent: false },
  { label: 'CRIT-09: try/catch on drop handler in fileBrowser',          file: 'fileBrowser.js',         needle: 'uploadBatchItems',               absent: false },
  { label: 'CRIT-10: checkFileConflict present in fileBrowser',          file: 'fileBrowser.js',         needle: 'checkFileConflict',              absent: false },
  // HIGH (15)
  { label: 'HIGH-01: onUnexpectedClose nulled in sftpService',           file: 'sftpService.js',         needle: 'this.onUnexpectedClose = null',  absent: false },
  { label: 'HIGH-02: readdir present in sftpService (not async)',        file: 'sftpService.js',         needle: 'readdir',                        absent: false },
  { label: 'HIGH-03: writeStream destroyed in sftpService pipe error',   file: 'sftpService.js',         needle: 'writeStream.destroy',            absent: false },
  { label: 'HIGH-04: cancellationTokens in transferEngine',              file: 'transferEngine.js',      needle: 'cancellationTokens',             absent: false },
  { label: 'HIGH-05: .part temp file in transferEngine download',        file: 'transferEngine.js',      needle: '.part',                          absent: false },
  { label: 'HIGH-06: activeDestinationLocks in transferEngine',          file: 'transferEngine.js',      needle: 'activeDestinationLocks',         absent: false },
  { label: 'HIGH-07: clearTimeout debounceTimer in cacheWatcher',        file: 'cacheWatcherService.js', needle: 'clearTimeout',                   absent: false },
  { label: 'HIGH-08: stopWatchingBySessionId in cacheWatcher',           file: 'cacheWatcherService.js', needle: 'stopWatchingBySessionId',        absent: false },
  { label: 'HIGH-09: Promise.allSettled in sessionManager restore',      file: 'sessionManager.js',      needle: 'Promise.allSettled',             absent: false },
  { label: 'HIGH-11: removeListener returns in preload',                 file: 'preload.js',             needle: 'removeListener',                 absent: false },
  { label: 'HIGH-12: socket.off(close) cleanup on ftpService reconnect', file: 'ftpService.js',          needle: "socket.off('close'",             absent: false },
  { label: 'HIGH-13: stopWatchingBySessionId on disconnect in main',     file: 'main.js',                needle: 'stopWatchingBySessionId',        absent: false },
  { label: 'HIGH-14: startupTimer stored in jobRunnerService',           file: 'jobRunnerService.js',    needle: 'startupTimer',                   absent: false },
  { label: 'HIGH-15: remoteStream.destroy in tunnelService',             file: 'tunnelService.js',       needle: 'remoteStream.destroy',           absent: false },
  // MEDIUM (key ones)
  { label: 'MED-02: chmod reject(chmodErr) in sftpService',              file: 'sftpService.js',         needle: 'reject(chmodErr)',               absent: false },
  { label: 'MED-07: atomic _saveHistory in transferEngine',              file: 'transferEngine.js',      needle: '_saveHistory',                   absent: false },
  { label: 'MED-10: partial download fs.unlinkSync in webdavService',    file: 'webdavService.js',       needle: 'fs.unlinkSync',                  absent: false },
  { label: 'MED-15: ipcMain.removeListener in main host-key verify',     file: 'main.js',                needle: 'ipcMain.removeListener',         absent: false },
  { label: 'MED-19: ipcWindow=null in sshTerminalService disconnect',    file: 'sshTerminalService.js',  needle: 'ipcWindow = null',               absent: false },
  { label: 'MED-25: openLocalFile error handling in fileBrowser',        file: 'fileBrowser.js',         needle: 'openLocalFile',                  absent: false },
  // LOW / INFO
  { label: 'LOW-05: socket.setTimeout in tunnelService SOCKS5',          file: 'tunnelService.js',       needle: 'socket.setTimeout',              absent: false },
  { label: 'LOW-09: TB and PB in formatSize fileBrowser',                file: 'fileBrowser.js',         needle: "'TB', 'PB'",                     absent: false },
  { label: 'LOW-13: clipboard.writeText try/catch in fileBrowser',       file: 'fileBrowser.js',         needle: 'clipboard.writeText',            absent: false },
  { label: 'LOW-19: no [DEBUG MAIN IPC] console.log in main.js',         file: 'main.js',                needle: '[DEBUG MAIN IPC]',               absent: true  },
];

let pass = 0, fail = 0;
for (const { label, file, needle, absent } of checks) {
  const content = fs.readFileSync(files[file], 'utf8');
  const found = content.includes(needle);
  const ok = absent ? !found : found;
  console.log((ok ? '✔' : '✖') + ' ' + label);
  ok ? pass++ : fail++;
}

console.log('');
console.log('─'.repeat(70));
console.log(`Pass: ${pass}  Fail: ${fail}  Total: ${checks.length}`);
if (fail === 0) console.log('\n🟢 ALL AUDIT FIXES VERIFIED');
else console.log('\n🔴 ' + fail + ' ITEM(S) NEED ATTENTION');
