/**
 * DevsFTP — Remote Development Workspace
 * Copyright (C) 2026 DevsFTP.com
 *
 * WebDAV Driver Service using the 'webdav' npm package.
 * Supports HTTP and HTTPS WebDAV servers (Nextcloud, ownCloud, Apache WebDAV,
 * IIS WebDAV, Synology NAS, and any RFC 4918-compliant server).
 */

const { createClient, AuthType } = require('webdav');
const fs = require('fs');
const path = require('path');

class WebDAVService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.currentConfig = null;
  }

  /**
   * Connect to a WebDAV server.
   * config.webdavUrl  — Full base URL, e.g. https://myserver.com/remote.php/dav/files/admin/
   * config.username   — WebDAV username
   * config.password   — WebDAV password
   * config.allowSelfSigned — Boolean, allow self-signed SSL certs
   */
  async connect(config, onLog) {
    this.currentConfig = config;

    let url = config.webdavUrl || '';

    if (!url) {
      let host = (config.host || '').trim();
      if (!host) {
        throw new Error('Host / IP Address is required.');
      }

      // If user pasted a full http:// or https:// URL in the Host field
      if (/^https?:\/\//i.test(host)) {
        url = host;
      } else {
        const isHttps = config.port == 443 || String(config.protocol).toLowerCase().includes('https') || config.useSsl;
        const scheme = isHttps ? 'https://' : 'http://';
        const portNum = parseInt(config.port, 10);
        const portStr = (portNum && portNum !== 80 && portNum !== 443) ? `:${portNum}` : '';
        let subpath = (config.webdavPath || config.remotePath || '/').trim();
        if (!subpath.startsWith('/')) subpath = '/' + subpath;

        url = `${scheme}${host}${portStr}${subpath}`;
      }
    }

    // Auto-normalize: prepend http:// if no protocol prefix is present
    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
    }

    // Ensure trailing slash for root-level WebDAV endpoints
    if (!url.endsWith('/')) {
      url = url + '/';
    }

    if (onLog) onLog('info', `Connecting to WebDAV server at ${url}...`);

    const clientOptions = {
      username: config.username || '',
      password: config.password || '',
      authType: AuthType.Auto
    };

    // Allow self-signed SSL certificates if configured
    if (config.allowSelfSigned) {
      const https = require('https');
      clientOptions.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    this.client = createClient(url, clientOptions);
    this.currentUrl = url;

    // Verify connection by listing the root directory
    try {
      await this.client.getDirectoryContents('/');
      this.connected = true;
      if (onLog) onLog('info', `WebDAV Session established successfully to ${url}`);
      return true;
    } catch (err) {
      // If Auto auth negotiation fails, fallback to explicit Digest auth (e.g. XAMPP Digest auth)
      try {
        if (onLog) onLog('info', 'Retrying WebDAV connection with Digest authentication...');
        const digestOptions = { ...clientOptions, authType: AuthType.Digest };
        this.client = createClient(url, digestOptions);
        await this.client.getDirectoryContents('/');
        this.connected = true;
        if (onLog) onLog('info', `WebDAV Session established successfully with Digest auth to ${url}`);
        return true;
      } catch (digestErr) {
        this.connected = false;
        this.client = null;
        if (onLog) onLog('error', `WebDAV Connection failed: ${err.message}`);
        throw new Error(`WebDAV connection failed: ${err.message}`);
      }
    }
  }


  /**
   * Disconnect from WebDAV. WebDAV is stateless HTTP — just clear the client instance.
   */
  disconnect() {
    this.client = null;
    this.connected = false;
    this.currentConfig = null;
  }

  /**
   * List directory contents at remotePath.
   * Returns the same file stat shape as SFTPService.list() and FTPService.list()
   * so renderRemoteTable() works with zero changes.
   */
  async list(remoteDir = '/') {
    if (!this.connected || !this.client) {
      throw new Error('WebDAV client is not connected.');
    }

    const normalizedPath = remoteDir || '/';

    let contents;
    try {
      contents = await this.client.getDirectoryContents(normalizedPath, { deep: false });
    } catch (err) {
      throw new Error(`WebDAV list failed for "${normalizedPath}": ${err.message}`);
    }

    // Filter out the directory itself (WebDAV includes the parent in its PROPFIND response)
    const items = contents
      .filter(item => {
        const itemPath = item.filename.replace(/\\/g, '/').replace(/\/$/, '');
        const normDir = normalizedPath.replace(/\\/g, '/').replace(/\/$/, '');
        return itemPath !== normDir;
      })
      .map(item => {
        const isDir = item.type === 'directory';
        const name = path.posix.basename(item.filename);
        return {
          name,
          path: item.filename,
          type: isDir ? 'd' : '-',
          isDir,
          size: item.size || 0,
          modifyTime: item.lastmod ? new Date(item.lastmod).toISOString() : new Date().toISOString(),
          permissions: isDir ? 'drwxr-xr-x' : '-rw-r--r--',
          mode: null // WebDAV does not expose Unix permission modes
        };
      });

    // Sort directories first, then files alphabetically
    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    return { currentPath: normalizedPath, files: items };
  }

  /**
   * Upload a local file to a remote WebDAV path.
   */
  async uploadFile(localPath, remotePath, onProgress) {
    if (!this.connected || !this.client) {
      throw new Error('WebDAV client is not connected.');
    }

    const totalBytes = fs.statSync(localPath).size || 1;
    let transferred = 0;

    const readStream = fs.createReadStream(localPath);

    // Track progress via stream data events
    readStream.on('data', chunk => {
      transferred += chunk.length;
      if (onProgress) {
        onProgress({
          transferred,
          total: totalBytes,
          percentage: Math.min(100, Math.round((transferred / totalBytes) * 100))
        });
      }
    });

    try {
      await this.client.putFileContents(remotePath, readStream, {
        overwrite: true,
        contentLength: totalBytes
      });
      return true;
    } catch (err) {
      throw new Error(`WebDAV upload failed for "${remotePath}": ${err.message}`);
    }
  }

  /**
   * Recursively upload a local directory to a remote WebDAV path.
   */
  async uploadDir(localDirPath, remoteDestPath, onProgress) {
    if (!this.connected || !this.client) throw new Error('WebDAV client is not connected.');

    try {
      await this.mkdir(remoteDestPath);
    } catch (e) {
      // Directory may already exist — ignore
    }

    const items = fs.readdirSync(localDirPath, { withFileTypes: true });
    for (const item of items) {
      const localItemPath = path.join(localDirPath, item.name);
      const remoteItemPath = `${remoteDestPath.replace(/\/$/, '')}/${item.name}`;
      if (item.isDirectory()) {
        await this.uploadDir(localItemPath, remoteItemPath, onProgress);
      } else {
        await this.uploadFile(localItemPath, remoteItemPath, onProgress);
      }
    }
    return true;
  }

  /**
   * Download a remote WebDAV file to a local path.
   */
  async downloadFile(remotePath, localPath, onProgress) {
    if (!this.connected || !this.client) {
      throw new Error('WebDAV client is not connected.');
    }

    try {
      // Ensure local directory exists
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      // Fetch remote stats to determine total file size for progress updates
      let totalBytes = 1;
      try {
        const stats = await this.client.stat(remotePath);
        totalBytes = stats.size || 1;
      } catch (e) {}

      return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(localPath);
        const readStream = this.client.createReadStream(remotePath); // Stream download (Issue 11.1)

        let bytesRead = 0;
        readStream.on('data', (chunk) => {
          bytesRead += chunk.length;
          if (onProgress) {
            onProgress({
              transferred: bytesRead,
              total: totalBytes,
              percentage: Math.min(100, Math.round((bytesRead / totalBytes) * 100))
            });
          }
        });

        readStream.on('error', (err) => {
          writeStream.destroy();
          reject(err);
        });

        writeStream.on('error', (err) => {
          readStream.destroy();
          reject(err);
        });

        writeStream.on('finish', () => {
          resolve(true);
        });

        readStream.pipe(writeStream);
      });
    } catch (err) {
      throw new Error(`WebDAV download failed for "${remotePath}": ${err.message}`);
    }
  }

  /**
   * Recursively download a remote WebDAV directory to a local path.
   */
  async downloadDir(remoteDirPath, localDestPath, onProgress) {
    if (!this.connected || !this.client) throw new Error('WebDAV client is not connected.');

    if (!fs.existsSync(localDestPath)) {
      fs.mkdirSync(localDestPath, { recursive: true });
    }

    const res = await this.list(remoteDirPath);
    const items = (res && res.files) ? res.files : [];

    for (const item of items) {
      const remoteItemPath = `${remoteDirPath.replace(/\/$/, '')}/${item.name}`;
      const localItemPath = path.join(localDestPath, item.name);
      if (item.isDir) {
        await this.downloadDir(remoteItemPath, localItemPath, onProgress);
      } else {
        await this.downloadFile(remoteItemPath, localItemPath, onProgress);
      }
    }

    return true;
  }

  /**
   * Create a remote directory.
   */
  async mkdir(remotePath) {
    if (!this.connected || !this.client) throw new Error('WebDAV client is not connected.');
    try {
      // Stat path first to avoid swallowing real authorization/creation errors (Issue 11.3)
      try {
        const stat = await this.client.stat(remotePath);
        if (stat && stat.type === 'directory') {
          return true;
        }
      } catch (statErr) {}

      await this.client.createDirectory(remotePath);
      return true;
    } catch (err) {
      throw new Error(`WebDAV mkdir failed for "${remotePath}": ${err.message}`);
    }
  }

  /**
   * Delete a remote file or directory.
   */
  async delete(remotePath, isDirectory = false) {
    if (!this.connected || !this.client) throw new Error('WebDAV client is not connected.');
    try {
      // Support strict servers by supplying Depth header for directory deletes (Issue 11.2)
      const options = isDirectory ? { headers: { 'Depth': 'infinity' } } : {};
      await this.client.deleteFile(remotePath, options);
      return true;
    } catch (err) {
      throw new Error(`WebDAV delete failed for "${remotePath}": ${err.message}`);
    }
  }

  /**
   * Rename or move a remote file or directory.
   */
  async rename(oldPath, newPath) {
    if (!this.connected || !this.client) throw new Error('WebDAV client is not connected.');
    try {
      await this.client.moveFile(oldPath, newPath);
      return true;
    } catch (err) {
      throw new Error(`WebDAV rename failed for "${oldPath}" → "${newPath}": ${err.message}`);
    }
  }

  /**
   * Create an empty file at a remote path.
   */
  async createFile(remotePath) {
    if (!this.connected || !this.client) throw new Error('WebDAV client is not connected.');
    try {
      await this.client.putFileContents(remotePath, '', { overwrite: false });
      return true;
    } catch (err) {
      throw new Error(`WebDAV createFile failed for "${remotePath}": ${err.message}`);
    }
  }

  /**
   * stat() stub — WebDAV does not support Unix chmod.
   * Returns null to gracefully handle chmod calls from the shared IPC layer.
   */
  async stat(remotePath) {
    if (!this.connected || !this.client) return null;
    try {
      const stat = await this.client.stat(remotePath);
      return {
        size: stat.size || 0,
        modifyTime: stat.lastmod ? new Date(stat.lastmod).toISOString() : new Date().toISOString(),
        isDir: stat.type === 'directory'
      };
    } catch (e) {
      return null;
    }
  }
}

module.exports = WebDAVService;
