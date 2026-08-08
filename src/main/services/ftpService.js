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

      await this.client.access(options);
      this.connected = true;
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
    const normalizedPath = normalizePOSIXPath(remoteDir);
    await this.client.cd(normalizedPath);
    const list = await this.client.list();

    const items = list.map(item => {
      const isDir = item.isDirectory;
      const isLink = item.isSymbolicLink;
      const type = isDir ? 'd' : (isLink ? 'l' : '-');

      return {
        name: item.name,
        path: normalizePOSIXPath(`${normalizedPath}/${item.name}`),
        type: type,
        isDir: isDir,
        size: item.size || 0,
        modifyTime: item.rawModifiedAt ? new Date(item.rawModifiedAt).toISOString() : new Date().toISOString(),
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
  }

  async downloadFile(remotePath, localPath, onProgress) {
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

    await this.client.downloadTo(localPath, remotePath);
    this.client.trackProgress(); // clear tracker
    return true;
  }

  async uploadFile(localPath, remotePath, onProgress) {
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

    await this.client.uploadFrom(localPath, remotePath);
    this.client.trackProgress(); // clear tracker
    return true;
  }

  async uploadDir(localDirPath, remoteDestDirPath, onProgress) {
    if (!this.connected) throw new Error('FTP client is not connected.');
    const normRemote = normalizePOSIXPath(remoteDestDirPath);
    await this.client.uploadFromDir(localDirPath, normRemote);
    return true;
  }

  async mkdir(remotePath) {
    if (!this.connected) throw new Error('FTP not connected');
    await this.client.ensureDir(normalizePOSIXPath(remotePath));
    return true;
  }

  async delete(remotePath, isDirectory = false) {
    if (!this.connected) throw new Error('FTP not connected');
    const normPath = normalizePOSIXPath(remotePath);
    if (isDirectory) {
      await this.client.removeDir(normPath);
    } else {
      await this.client.remove(normPath);
    }
    return true;
  }

  async rename(oldPath, newPath) {
    if (!this.connected) throw new Error('FTP not connected');
    await this.client.rename(normalizePOSIXPath(oldPath), normalizePOSIXPath(newPath));
    return true;
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
    const normRemote = normalizePOSIXPath(remoteDirPath);
    if (!fs.existsSync(localDestPath)) {
      fs.mkdirSync(localDestPath, { recursive: true });
    }
    await this.client.downloadToDir(localDestPath, normRemote);
    return true;
  }

  disconnect() {
    if (this.client) {
      try {
        this.client.close();
      } catch (e) {}
    }
    this.connected = false;
  }
}

module.exports = FTPService;
