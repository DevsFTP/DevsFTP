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

  async downloadStream(remotePath, localPath, offset = 0, onProgress, options = {}) {
    if (!this.session || !this.session.connected) throw new Error('FTP client disconnected');
    const normRemote = normalizePOSIXPath(remotePath);

    let actualOffset = offset;
    this.client.trackProgress(info => {
      if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');
      if (onProgress) {
        // If the bytes transferred in this call exceeds the expected remaining bytes,
        // it means the server did not resume and is sending the file from the beginning.
        const expectedRemaining = info.bytesOverall - actualOffset;
        if (info.bytes > expectedRemaining) {
          actualOffset = 0; // Reset offset to 0 because we are transferring from the start
        }

        const transferred = actualOffset + info.bytes;
        const total = Math.max(info.bytesOverall || 0, transferred);
        const percentage = total > 0 ? Math.min(100, Math.max(0, parseFloat(((transferred / total) * 100).toFixed(1)))) : 0;
        onProgress({
          transferred,
          total,
          percentage
        });
      }
    });

    try {
      if (typeof this.client.executeSequentially === 'function') {
        await this.client.executeSequentially(() => this.client.downloadTo(localPath, normRemote, offset));
      } else {
        await this.client.downloadTo(localPath, normRemote, offset);
      }
      return true;
    } finally {
      this.client.trackProgress(); // Clear progress listener
    }
  }

  async uploadStream(localPath, remotePath, offset = 0, onProgress, options = {}) {
    if (!this.session || !this.session.connected) throw new Error('FTP client disconnected');
    const normRemote = normalizePOSIXPath(remotePath);

    let actualOffset = offset;
    this.client.trackProgress(info => {
      if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');
      if (onProgress) {
        // If the bytes transferred in this call exceeds the expected remaining bytes,
        // it means the server did not resume and is sending the file from the beginning.
        const expectedRemaining = info.bytesOverall - actualOffset;
        if (info.bytes > expectedRemaining) {
          actualOffset = 0; // Reset offset to 0 because we are transferring from the start
        }

        const transferred = actualOffset + info.bytes;
        const total = Math.max(info.bytesOverall || 0, transferred);
        const percentage = total > 0 ? Math.min(100, Math.max(0, parseFloat(((transferred / total) * 100).toFixed(1)))) : 0;
        onProgress({
          transferred,
          total,
          percentage
        });
      }
    });

    try {
      if (typeof this.client.executeSequentially === 'function') {
        await this.client.executeSequentially(() => this.client.uploadFrom(localPath, normRemote, offset));
      } else {
        await this.client.uploadFrom(localPath, normRemote, offset);
      }
      return true;
    } finally {
      this.client.trackProgress();
    }
  }
}

module.exports = FTPAdapter;
