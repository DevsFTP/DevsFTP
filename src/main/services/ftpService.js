/**
 * FTP/FTPS Driver Service using basic-ftp
 * Supports FTP and FTPS (Explicit & Implicit TLS/SSL) with passive transfers.
 */

const ftp = require('basic-ftp');
const fs = require('fs');
const { normalizePOSIXPath, formatPermissions } = require('./pathUtils');

class FTPService {
  constructor() {
    this.client = new ftp.Client();
    this.client.ftp.verbose = false;
    this.connected = false;
    this.currentConfig = null;
    this.onUnexpectedClose = null;
    this._queue = Promise.resolve(); // Rolling promise chain – serializes all socket commands
  }

  /**
   * Serializes all FTP operations through a rolling promise chain to prevent
   * basic-ftp "client is closed" errors caused by concurrent command execution.
   */
  executeSequentially(fn) {
    const next = this._queue.then(() => fn()).catch(err => { throw err; });
    // Swallow errors on the shared chain so one failure doesn't block future ops
    this._queue = next.catch(() => {});
    return next;
  }

  async connect(config, onLog) {
    this.currentConfig = config;
    try {
      if (onLog) onLog('info', `Connecting via FTP/FTPS to ${config.host}:${config.port || 21}...`);

      const options = {
        host: config.host,
        port: parseInt(config.port || 21, 10),
        user: config.username || 'anonymous',
        password: config.password || '',
        secure: config.protocol === 'ftps' || config.protocol === 'ftps-implicit' ? true : false,
        secureOptions: {
          rejectUnauthorized: config.allowSelfSigned ? false : true
        }
      };

      if (config.protocol === 'ftps-implicit') {
        options.secure = 'implicit';
      }

      this.client.ftp.timeout = 30000;
      await this.client.access(options);
      this.connected = true;

      // Monitor control socket connection drops for auto-reconnect support
      if (this.client.ftp && this.client.ftp.socket) {
        const socket = this.client.ftp.socket;
        if (this._handleClose) {
          try { socket.off('close', this._handleClose); } catch (e) {}
        }
        // Fix 5 (MEDIUM): Remove any accumulated 'error' listeners before attaching a new one
        // to prevent listener leaks across reconnect cycles.
        if (this._handleSocketError) {
          try { socket.off('error', this._handleSocketError); } catch (e) {}
        }
        this._handleClose = () => {
          if (this.connected) {
            this.connected = false;
            if (onLog) onLog('warning', 'FTP Control connection closed unexpectedly.');
            if (typeof this.onUnexpectedClose === 'function') {
              const cb = this.onUnexpectedClose;
              this.onUnexpectedClose = null;
              cb();
            }
          }
        };
        this._handleSocketError = () => {
          // Socket error will lead to a close event, handled above
        };
        socket.on('close', this._handleClose);
        socket.on('error', this._handleSocketError);
      }

      if (onLog) onLog('info', 'FTP/FTPS Session established successfully.');
      return true;
    } catch (err) {
      this.connected = false;
      if (onLog) onLog('error', `FTP Connection failed: ${err.message}`);
      throw err;
    }
  }

  async list(remoteDir = '/') {
    if (!this.connected) throw new Error('FTP client is not connected.');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP client is not connected.');
      const normalizedPath = normalizePOSIXPath(remoteDir);

      // Use CWD + parameterless LIST for maximum compatibility with chrooted
      // and virtual-directory FTP servers (RFC 959). Passing a path argument
      // to LIST/MLSD fails with 550 Access Denied on many servers.
      await this.client.cd(normalizedPath);
      const list = await this.client.list();

      const items = list.map(item => {
        const isDir = item.isDirectory;
        const isLink = item.isSymbolicLink;
        const type = isDir ? 'd' : (isLink ? 'l' : '-');

        // Robust modification time parsing with year fallback (Issue 9.4)
        let modifyTimeDate = new Date();
        if (item.modifiedAt instanceof Date && !isNaN(item.modifiedAt)) {
          modifyTimeDate = item.modifiedAt;
        } else if (item.rawModifiedAt) {
          modifyTimeDate = new Date(item.rawModifiedAt);
          if (!isNaN(modifyTimeDate)) {
            const now = new Date();
            if (modifyTimeDate.getTime() - now.getTime() > 86400000) {
              modifyTimeDate.setFullYear(now.getFullYear() - 1);
            }
          } else {
            modifyTimeDate = new Date();
          }
        }

        return {
          name: item.name,
          path: normalizePOSIXPath(`${normalizedPath}/${item.name}`),
          type: type,
          isDir: isDir,
          size: item.size || 0,
          modifyTime: modifyTimeDate.toISOString(),
          permissions: formatPermissions(item.rights ? item.rights.user : null),
          mode: item.rights
        };
      });

      items.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });

      return { currentPath: normalizedPath, files: items };
    });
  }

  async downloadFile(remotePath, localPath, onProgress) {
    if (!this.connected) throw new Error('FTP client is not connected.');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP client is not connected.');
      this.client.trackProgress(info => {
        if (onProgress) {
          onProgress({
            transferred: info.bytes,
            total: info.bytesOverall || info.bytes,
            percentage: info.bytesOverall ? Math.min(100, Math.round((info.bytes / info.bytesOverall) * 100)) : 50
          });
        }
      });
      try {
        await this.client.downloadTo(localPath, remotePath);
      } finally {
        this.client.trackProgress(); // clear tracker in finally block (Issue 9.2)
      }
      return true;
    });
  }

  async uploadFile(localPath, remotePath, onProgress) {
    if (!this.connected) throw new Error('FTP client is not connected.');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP client is not connected.');
      this.client.trackProgress(info => {
        if (onProgress) {
          onProgress({
            transferred: info.bytes,
            total: info.bytesOverall || info.bytes,
            percentage: info.bytesOverall ? Math.min(100, Math.round((info.bytes / info.bytesOverall) * 100)) : 50
          });
        }
      });
      try {
        await this.client.uploadFrom(localPath, remotePath);
      } finally {
        this.client.trackProgress(); // clear tracker in finally block (Issue 9.2)
      }
      return true;
    });
  }

  async uploadDir(localDirPath, remoteDestDirPath, onProgress) {
    if (!this.connected) throw new Error('FTP client is not connected.');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP client is not connected.');
      const normRemote = normalizePOSIXPath(remoteDestDirPath);
      await this.client.uploadFromDir(localDirPath, normRemote);
      return true;
    });
  }

  async mkdir(remotePath) {
    if (!this.connected) throw new Error('FTP not connected');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP not connected');
      await this.client.ensureDir(normalizePOSIXPath(remotePath));
      return true;
    });
  }

  async delete(remotePath, isDirectory = false) {
    if (!this.connected) throw new Error('FTP not connected');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP not connected');
      const normPath = normalizePOSIXPath(remotePath);
      if (isDirectory) {
        await this.client.removeDir(normPath);
      } else {
        await this.client.remove(normPath);
      }
      return true;
    });
  }

  async rename(oldPath, newPath) {
    if (!this.connected) throw new Error('FTP not connected');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP not connected');
      await this.client.rename(normalizePOSIXPath(oldPath), normalizePOSIXPath(newPath));
      return true;
    });
  }

  async stat(remotePath) {
    if (!this.connected) return null;
    try {
      const norm = normalizePOSIXPath(remotePath);
      const idx = norm.lastIndexOf('/');
      const parent = idx <= 0 ? '/' : norm.substring(0, idx);
      const name = norm.substring(idx + 1);
      const res = await this.list(parent);
      const file = (res && res.files) ? res.files.find(f => f.name === name) : null;
      if (file) {
        return { size: file.size, modifyTime: file.modifyTime, isDir: file.isDir };
      }
    } catch (e) {}
    return null;
  }

  async downloadDir(remoteDirPath, localDestPath, onProgress) {
    if (!this.connected) throw new Error('FTP client is not connected.');
    return this.executeSequentially(async () => {
      if (!this.connected) throw new Error('FTP client is not connected.');
      const normRemote = normalizePOSIXPath(remoteDirPath);
      if (!fs.existsSync(localDestPath)) {
        fs.mkdirSync(localDestPath, { recursive: true });
      }
      // Fix 6 (LOW): basic-ftp's downloadToDir does not expose a per-transfer progress
      // callback at the directory level, so onProgress cannot be forwarded here.
      // Use downloadFile() with its onProgress parameter for individual file progress tracking.
      await this.client.downloadToDir(localDestPath, normRemote);
      return true;
    });
  }

  disconnect() {
    this.connected = false;
    if (this.client) {
      try {
        this.client.close();
      } catch (e) {}
    }
  }
}

module.exports = FTPService;
