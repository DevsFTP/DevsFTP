/**
 * SFTP Driver Service using ssh2
 * Provides robust connection handling, directory readdir, chunked streaming file transfers,
 * and permissions management.
 */

const { Client } = require('ssh2');
const { SocksClient } = require('socks');
const fs = require('fs');
const path = require('path');
const { normalizePOSIXPath, formatPermissions } = require('./pathUtils');

class SFTPService {
  constructor() {
    this.sshClient = null;
    this.sftp = null;
    this.connected = false;
    this.currentConfig = null;
    this.isManualDisconnect = false;
    this.onUnexpectedClose = null;
  }

  connect(config, onLog, verifyHostKeyFn) {
    return new Promise((resolve, reject) => {
      this.sshClient = new Client();
      this.currentConfig = config;
      this.isManualDisconnect = false;

      this.sshClient.on('ready', () => {
        if (onLog) onLog('info', 'SSH Connection established. Requesting SFTP subsystem...');
        this.sshClient.sftp((err, sftp) => {
          if (err) {
            this.connected = false;
            if (onLog) onLog('error', `SFTP Subsystem failed: ${err.message}`);
            return reject(err);
          }
          this.sftp = sftp;
          this.connected = true;
          if (onLog) onLog('info', 'SFTP Session active and ready.');
          resolve(true);
        });
      });

      this.sshClient.on('error', (err) => {
        this.connected = false;
        if (onLog) onLog('error', `SSH Connection error: ${err.message}`);
        reject(err);
      });

      this.sshClient.on('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        if (onLog) onLog('warning', 'SSH Connection closed.');
        if (wasConnected && !this.isManualDisconnect && typeof this.onUnexpectedClose === 'function') {
          this.onUnexpectedClose();
        }
      });

      const connectOpts = {
        host: config.host,
        port: parseInt(config.port || 22, 10),
        username: config.username,
        keepaliveInterval: 10000,
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
            if (approved) {
              if (onLog) onLog('info', `Host key accepted for ${config.host}:${connectOpts.port}`);
              done(true);
            } else {
              if (onLog) onLog('error', `Host key rejected for ${config.host}:${connectOpts.port}`);
              done(false);
            }
          }).catch((err) => {
            if (onLog) onLog('error', `Host key verification error: ${err.message}`);
            done(false);
          });
        };
      }

      if (config.authType === 'key' && config.privateKeyPath) {
        try {
          connectOpts.privateKey = fs.readFileSync(config.privateKeyPath);
          if (config.passphrase) connectOpts.passphrase = config.passphrase;
        } catch (keyErr) {
          return reject(new Error(`Failed to read SSH private key file: ${keyErr.message}`));
        }
      } else {
        connectOpts.password = config.password || '';
      }

      const proxyType = config.proxyType ? String(config.proxyType).toLowerCase() : 'none';
      if (proxyType === 'bastion' && config.proxyHost) {
        if (onLog) onLog('info', `Connecting to SSH Bastion Host (Jump Box) at ${config.proxyHost}:${config.proxyPort || 22}...`);
        const bastionClient = new Client();

        const bastionOpts = {
          host: config.proxyHost,
          port: parseInt(config.proxyPort || 22, 10),
          username: config.proxyUsername || config.username,
          keepaliveInterval: 10000,
          readyTimeout: 20000
        };

        if (config.authType === 'key' && config.privateKeyPath) {
          try {
            bastionOpts.privateKey = fs.readFileSync(config.privateKeyPath);
            if (config.passphrase || config.proxyPassword) bastionOpts.passphrase = config.passphrase || config.proxyPassword;
          } catch (e) {}
        } else if (config.proxyPassword || config.password) {
          bastionOpts.password = config.proxyPassword || config.password;
        }

        bastionClient.on('ready', () => {
          if (onLog) onLog('info', `Bastion Host connected cleanly. Creating ProxyJump tunnel stream to ${config.host}:${connectOpts.port}...`);
          bastionClient.forwardOut('127.0.0.1', 0, config.host, connectOpts.port, (err, stream) => {
            if (err) {
              bastionClient.end();
              if (onLog) onLog('error', `Bastion ProxyJump forwardOut failed: ${err.message}`);
              return reject(err);
            }
            connectOpts.sock = stream;
            if (onLog) onLog('info', `ProxyJump stream established. Initiating SSH session to target host ${config.host}...`);
            this.sshClient.connect(connectOpts);
          });
        });

        bastionClient.on('error', (err) => {
          if (onLog) onLog('error', `Bastion Host connection error: ${err.message}`);
          reject(err);
        });

        bastionClient.connect(bastionOpts);
      } else if (proxyType !== 'none' && (proxyType === 'socks5' || proxyType === 'socks4') && config.proxyHost) {
        const type = proxyType === 'socks4' ? 4 : 5;
        const proxyOptions = {
          proxy: {
            host: config.proxyHost,
            port: parseInt(config.proxyPort || 1080, 10),
            type: type
          },
          command: 'connect',
          destination: {
            host: config.host,
            port: connectOpts.port
          }
        };

        if (config.proxyUsername) {
          proxyOptions.proxy.userId = config.proxyUsername;
          if (config.proxyPassword) proxyOptions.proxy.password = config.proxyPassword;
        }

        if (onLog) onLog('info', `Connecting through ${proxyType.toUpperCase()} Proxy at ${config.proxyHost}:${proxyOptions.proxy.port}...`);

        SocksClient.createConnection(proxyOptions, (err, info) => {
          if (err) {
            if (onLog) onLog('error', `SOCKS Proxy connection failed: ${err.message}`);
            return reject(err);
          }
          connectOpts.sock = info.socket;
          if (onLog) onLog('info', `SOCKS Proxy tunnel established. Initiating SSH session to ${config.host}...`);
          this.sshClient.connect(connectOpts);
        });
      } else {
        if (onLog) onLog('info', `Connecting via SFTP to ${config.username}@${config.host}:${connectOpts.port}...`);
        this.sshClient.connect(connectOpts);
      }
    });
  }

  stat(remotePath) {
    return new Promise((resolve) => {
      if (!this.connected || !this.sftp) return resolve(null);
      this.sftp.stat(normalizePOSIXPath(remotePath), (err, stats) => {
        if (err || !stats) return resolve(null);
        resolve({
          size: stats.size || 0,
          modifyTime: stats.mtime ? new Date(stats.mtime * 1000).toISOString() : new Date().toISOString(),
          isDir: (stats.mode & 0o040000) === 0o040000
        });
      });
    });
  }

  list(remoteDir = '/') {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) {
        return reject(new Error('SFTP client is not connected.'));
      }

      const normalizedPath = normalizePOSIXPath(remoteDir);
      this.sftp.readdir(normalizedPath, (err, list) => {
        if (err) return reject(err);

        const items = list.map(item => {
          const isDir = (item.attrs.mode & 0o040000) === 0o040000 || item.longname.startsWith('d');
          const isLink = (item.attrs.mode & 0o120000) === 0o120000 || item.longname.startsWith('l');
          const type = isDir ? 'd' : (isLink ? 'l' : '-');
          
          return {
            name: item.filename,
            path: normalizePOSIXPath(`${normalizedPath}/${item.filename}`),
            type: type,
            isDir: isDir,
            size: item.attrs.size || 0,
            modifyTime: item.attrs.mtime ? new Date(item.attrs.mtime * 1000).toISOString() : new Date().toISOString(),
            permissions: formatPermissions(item.attrs.mode),
            mode: item.attrs.mode
          };
        });

        // Sort directories first, then files alphabetically
        items.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });

        resolve({ currentPath: normalizedPath, files: items });
      });
    });
  }

  downloadFile(remotePath, localPath, onProgress) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) {
        return reject(new Error('SFTP client is not connected.'));
      }

      this.sftp.stat(remotePath, (statErr, stats) => {
        if (statErr) return reject(statErr);
        const totalBytes = stats.size || 1;
        let transferred = 0;

        const options = {
          step: (total, chunk, totalSize) => {
            transferred = total;
            if (onProgress) {
              onProgress({
                transferred,
                total: totalBytes,
                percentage: Math.min(100, Math.round((transferred / totalBytes) * 100))
              });
            }
          }
        };

        this.sftp.fastGet(remotePath, localPath, options, (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    });
  }

  async downloadDir(remoteDirPath, localDestPath, onProgress) {
    if (!this.connected || !this.sftp) throw new Error('SFTP client is not connected.');
    const normRemote = normalizePOSIXPath(remoteDirPath);

    if (!fs.existsSync(localDestPath)) {
      fs.mkdirSync(localDestPath, { recursive: true });
    }

    const res = await this.list(normRemote);
    const items = (res && res.files) ? res.files : [];
    for (const item of items) {
      const remoteItemPath = `${normRemote === '/' ? '' : normRemote}/${item.name}`;
      const localItemPath = path.join(localDestPath, item.name);

      if (item.isDir) {
        await this.downloadDir(remoteItemPath, localItemPath, onProgress);
      } else {
        await this.downloadFile(remoteItemPath, localItemPath, onProgress);
      }
    }
    return true;
  }

  uploadFile(localPath, remotePath, onProgress) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) {
        return reject(new Error('SFTP client is not connected.'));
      }

      fs.stat(localPath, (statErr, stats) => {
        if (statErr) return reject(statErr);
        const totalBytes = stats.size || 1;
        let transferred = 0;

        const options = {
          step: (total, chunk, totalSize) => {
            transferred = total;
            if (onProgress) {
              onProgress({
                transferred,
                total: totalBytes,
                percentage: Math.min(100, Math.round((transferred / totalBytes) * 100))
              });
            }
          }
        };

        this.sftp.fastPut(localPath, remotePath, options, (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    });
  }

  async uploadDir(localDirPath, remoteDestDirPath, onProgress) {
    if (!this.connected || !this.sftp) throw new Error('SFTP client is not connected.');
    const normRemote = normalizePOSIXPath(remoteDestDirPath);

    try {
      await this.mkdir(normRemote);
    } catch (e) {}

    const items = fs.readdirSync(localDirPath, { withFileTypes: true });

    for (const item of items) {
      const localItemPath = path.join(localDirPath, item.name);
      const remoteItemPath = `${normRemote === '/' ? '' : normRemote}/${item.name}`;

      if (item.isDirectory()) {
        await this.uploadDir(localItemPath, remoteItemPath, onProgress);
      } else {
        await this.uploadFile(localItemPath, remoteItemPath, onProgress);
      }
    }
    return true;
  }

  createFile(remotePath, mode = null) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      const normPath = normalizePOSIXPath(remotePath);
      this.sftp.open(normPath, 'w', (err, handle) => {
        if (err) return reject(err);
        this.sftp.close(handle, (closeErr) => {
          if (closeErr) return reject(closeErr);
          if (mode) {
            const octal = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            if (!isNaN(octal)) {
              return this.sftp.chmod(normPath, octal, () => resolve(true));
            }
          }
          resolve(true);
        });
      });
    });
  }

  mkdir(remotePath, mode = null) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      const normPath = normalizePOSIXPath(remotePath);
      this.sftp.mkdir(normPath, (err) => {
        if (err) return reject(err);
        if (mode) {
          const octal = typeof mode === 'string' ? parseInt(mode, 8) : mode;
          if (!isNaN(octal)) {
            return this.sftp.chmod(normPath, octal, () => resolve(true));
          }
        }
        resolve(true);
      });
    });
  }

  async delete(remotePath, isDirectory = false) {
    if (!this.connected || !this.sftp) throw new Error('SFTP client is not connected.');
    const normPath = normalizePOSIXPath(remotePath);

    if (isDirectory) {
      let res = null;
      try {
        res = await this.list(normPath);
      } catch (e) {}

      const items = (res && res.files) ? res.files : [];
      for (const item of items) {
        const itemPath = `${normPath === '/' ? '' : normPath}/${item.name}`;
        if (item.isDir) {
          await this.delete(itemPath, true);
        } else {
          await new Promise((resolve, reject) => {
            this.sftp.unlink(itemPath, (err) => {
              if (err) return reject(err);
              resolve(true);
            });
          });
        }
      }

      return new Promise((resolve, reject) => {
        this.sftp.rmdir(normPath, (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        this.sftp.unlink(normPath, (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    }
  }

  chmod(remotePath, mode) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      this.sftp.chmod(normalizePOSIXPath(remotePath), mode, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  rename(oldPath, newPath) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      this.sftp.rename(normalizePOSIXPath(oldPath), normalizePOSIXPath(newPath), (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  disconnect() {
    this.isManualDisconnect = true;
    if (this.sshClient) {
      try {
        this.sshClient.end();
      } catch (e) {}
    }
    this.sshClient = null;
    this.sftp = null;
    this.connected = false;
  }
}

module.exports = SFTPService;
