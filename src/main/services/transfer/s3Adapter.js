/**
 * DevsFTP — S3 Transfer Adapter
 * Bridges S3Service into the TransferEngine adapter pattern.
 */

class S3Adapter {
  constructor(s3Service) {
    this.service = s3Service;
  }

  async stat(remotePath) {
    if (!this.service || !this.service.connected) return null;
    const key = this.service._pathToKey(remotePath);
    if (!key) {
      // Root bucket
      return { isDir: true, size: 0, modifyTime: new Date().toISOString() };
    }
    try {
      const { HeadObjectCommand } = require('@aws-sdk/client-s3');
      const response = await this.service.client.send(new HeadObjectCommand({
        Bucket: this.service.bucket,
        Key: key
      }));
      return {
        isDir: false,
        size: response.ContentLength || 0,
        modifyTime: response.LastModified ? response.LastModified.toISOString() : new Date().toISOString()
      };
    } catch (err) {
      // If head object fails, check if it exists as a virtual directory prefix
      try {
        const listRes = await this.service.list(remotePath);
        const files = listRes ? (listRes.files || listRes) : [];
        if (files && files.length > 0) {
          return { isDir: true, size: 0, modifyTime: new Date().toISOString() };
        }
      } catch (e) {}
      return null;
    }
  }

  async mkdir(remotePath) {
    if (!this.service || !this.service.connected) throw new Error('S3 client disconnected');
    return await this.service.mkdir(remotePath);
  }

  async list(remotePath) {
    if (!this.service || !this.service.connected) return { files: [] };
    return await this.service.list(remotePath);
  }

  async downloadStream(remotePath, localPath, offset = 0, onProgress, options = {}) {
    if (!this.service || !this.service.connected) throw new Error('S3 client disconnected');
    if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');
    
    let totalBytes = 0;
    try {
      const remoteStat = await this.stat(remotePath);
      totalBytes = remoteStat ? (remoteStat.size || 0) : 0;
    } catch(e) {}

    const adapterProgress = (progress) => {
      if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');
      if (onProgress) {
        if (typeof progress === 'object' && progress !== null) {
          onProgress(progress);
        } else {
          const transferred = (progress || 0) + offset;
          const total = Math.max(totalBytes, transferred);
          const percentage = total > 0 ? Math.min(100, parseFloat(((transferred / total) * 100).toFixed(1))) : 0;
          onProgress({
            transferred,
            total,
            percentage
          });
        }
      }
    };
    return await this.service.downloadFile(remotePath, localPath, adapterProgress, offset);
  }

  async uploadStream(localPath, remotePath, offset = 0, onProgress, options = {}) {
    if (!this.service || !this.service.connected) throw new Error('S3 client disconnected');
    if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');

    const fs = require('fs');
    let totalBytes = 0;
    try {
      if (fs.existsSync(localPath)) totalBytes = fs.statSync(localPath).size || 0;
    } catch(e) {}

    const adapterProgress = (progress) => {
      if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');
      if (onProgress) {
        if (typeof progress === 'object' && progress !== null) {
          onProgress(progress);
        } else {
          const transferred = (progress || 0) + offset;
          const total = Math.max(totalBytes, transferred);
          const percentage = total > 0 ? Math.min(100, parseFloat(((transferred / total) * 100).toFixed(1))) : 0;
          onProgress({
            transferred,
            total,
            percentage
          });
        }
      }
    };
    return await this.service.uploadFile(localPath, remotePath, adapterProgress);
  }
}

module.exports = S3Adapter;
