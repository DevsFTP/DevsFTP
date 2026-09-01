/**
 * SSH Interactive Terminal PTY Service
 * Bridges ssh2 shell stream with xterm.js in renderer process.
 */

const { Client } = require('ssh2');
const fs = require('fs');

class SSHTerminalService {
  constructor(ipcWindow, sessionId) {
    this.ipcWindow = ipcWindow;
    this.sessionId = sessionId;
    this.sshClient = null;
    this.shellStream = null;
    this.connected = false;
  }

  connect(config, verifyHostKeyFn) {
    return new Promise((resolve, reject) => {
      this.sshClient = new Client();
      // Fix 12 (MEDIUM): Track whether the promise has already settled (resolved/rejected)
      // so that a late 'error' event doesn't call reject() on an already-resolved promise.
      let settled = false;

      this.sshClient.on('ready', () => {
        // Request interactive PTY shell
        this.sshClient.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
          if (err) {
            this.connected = false;
            if (!settled) { settled = true; reject(err); }
            return;
          }
          this.shellStream = stream;
          this.connected = true;

          // Stream data from remote shell back to renderer xterm.js
          stream.on('data', (data) => {
            if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
              this.ipcWindow.webContents.send('ssh:terminal-data', {
                sessionId: this.sessionId,
                data: data.toString('utf8')
              });
            }
          });

          stream.on('error', (err) => {
            this.connected = false;
            if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
              this.ipcWindow.webContents.send('ssh:terminal-data', {
                sessionId: this.sessionId,
                data: `\r\n\x1b[31m[SSH Terminal Error: ${err.message || err}]\x1b[0m\r\n`
              });
            }
          });

          stream.on('close', () => {
            this.connected = false;
            if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
              this.ipcWindow.webContents.send('ssh:terminal-data', {
                sessionId: this.sessionId,
                data: '\r\n\x1b[33m[SSH Terminal session closed]\x1b[0m\r\n'
              });
            }
          });

          settled = true;
          resolve(true);
        });
      });

      this.sshClient.on('error', (err) => {
        this.connected = false;
        if (!settled) {
          // Promise not yet resolved — reject it normally
          settled = true;
          reject(err);
        } else {
          // Fix 12 (MEDIUM): Promise already resolved — don't call reject() again.
          // Disconnect cleanly and notify the renderer of the unexpected error instead.
          this.disconnect();
          if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
            this.ipcWindow.webContents.send('ssh:terminal-data', {
              sessionId: this.sessionId,
              data: `\r\n\x1b[31m[SSH Connection Error: ${err.message || err}]\x1b[0m\r\n`
            });
          }
        }
      });

      this.sshClient.on('close', () => {
        if (this.connected) {
          this.connected = false;
          if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
            this.ipcWindow.webContents.send('ssh:terminal-data', {
              sessionId: this.sessionId,
              data: '\r\n\x1b[31m[SSH Transport Connection Closed]\x1b[0m\r\n'
            });
          }
        }
      });

      const connectOpts = {
        host: config.host,
        port: parseInt(config.port || 22, 10),
        username: config.username,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,  // MED-24: 3 missed keepalives = 30s freeze timeout before drop
        readyTimeout: 20000
      };

      if (verifyHostKeyFn) {
        connectOpts.hostHash = 'sha256';
        connectOpts.hostVerifier = (hashedKey, done) => {
          const rawKey = String(hashedKey || '');
          const fingerprint = rawKey.startsWith('SHA256:') ? rawKey : `SHA256:${rawKey}`;
          verifyHostKeyFn({
            host: config.host,
            port: connectOpts.port,
            fingerprint: fingerprint
          }).then((approved) => {
            if (approved) done(true);
            else done(false);
          }).catch(() => done(false));
        };
      }

      if (config.authType === 'key' && config.privateKeyPath) {
        try {
          connectOpts.privateKey = fs.readFileSync(config.privateKeyPath);
          if (config.passphrase) connectOpts.passphrase = config.passphrase;
        } catch (keyErr) {
          return reject(keyErr);
        }
      } else if (config.password) {
        connectOpts.password = config.password;
      }

      this.sshClient.connect(connectOpts);
    });
  }

  write(data) {
    if (this.shellStream && this.connected) {
      try {
        this.shellStream.write(data);
      } catch (e) {
        console.error('Error writing to SSH terminal stream:', e);
      }
    }
  }

  resize(cols, rows) {
    if (this.shellStream && this.connected) {
      try {
        this.shellStream.setWindow(rows, cols, 0, 0);
      } catch (e) {
        console.error('Error resizing SSH terminal window:', e);
      }
    }
  }

  disconnect() {
    if (this.shellStream) {
      try { this.shellStream.end(); } catch (e) {}
    }
    if (this.sshClient) {
      try { this.sshClient.end(); } catch (e) {}
    }
    this.shellStream = null;
    this.sshClient = null;
    this.connected = false;
    this.ipcWindow = null;
  }
}

module.exports = SSHTerminalService;
