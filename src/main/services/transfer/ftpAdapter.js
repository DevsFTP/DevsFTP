/**
 * FTP/FTPS Protocol Adapter for DevsFTP Core Transfer Engine
 * Normalizes basic-ftp operations, startAt byte offset resume, and file stats.
 */

const fs = require('fs');
const { normalizePOSIXPath } = require('../pathUtils');

class FTPAdapter {
  constructor(ftpSession) {
    this.session = ftpSession;
    this.client = ftpSession ? ftpSession.client : null;
  }

  async stat(remotePath) {
    if (!this.session || !this.session.connected) return null;
    return await this.session.stat(remotePath);
  }

  async mkdir(remotePath) {
    if (!this.session || !this.session.connected) throw new Error('FTP client disconnected');
    return await this.session.mkdir(remotePath);
  }

  async list(remotePath) {
    if (!this.session || !this.session.connected) return { files: [] };
    return await this.session.list(remotePath);
  }

  async downloadStream(remotePath, localPath, offset = 0, onProgress) {
    if (!this.session || !this.session.connected) throw new Error('FTP client disconnected');
    const normRemote = normalizePOSIXPath(remotePath);

    this.client.trackProgress(info => {
      if (onProgress) {
        const transferred = offset + info.bytes;
        const total = offset + (info.bytesOverall || info.bytes);
        onProgress({
          transferred,
          total,
          percentage: Math.min(100, parseFloat(((transferred / total) * 100).toFixed(1)))
        });
      }
    });

    try {
      await this.client.downloadTo(localPath, normRemote, offset);
      return true;
    } finally {
      this.client.trackProgress(); // Clear progress listener
    }
  }

  async uploadStream(localPath, remotePath, offset = 0, onProgress) {
    if (!this.session || !this.session.connected) throw new Error('FTP client disconnected');
    const normRemote = normalizePOSIXPath(remotePath);

    this.client.trackProgress(info => {
      if (onProgress) {
        const transferred = offset + info.bytes;
        const total = offset + (info.bytesOverall || info.bytes);
        onProgress({
          transferred,
          total,
          percentage: Math.min(100, parseFloat(((transferred / total) * 100).toFixed(1)))
        });
      }
    });

    try {
      await this.client.uploadFrom(localPath, normRemote, offset);
      return true;
    } finally {
      this.client.trackProgress();
    }
  }
}

module.exports = FTPAdapter;
