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
        const list = await this.service.list(remotePath);
        if (list && list.length > 0) {
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
    if (!this.service || !this.service.connected) return [];
    return await this.service.list(remotePath);
  }

  async downloadStream(remotePath, localPath, offset = 0, onProgress) {
    if (!this.service || !this.service.connected) throw new Error('S3 client disconnected');
    return await this.service.downloadFile(remotePath, localPath, onProgress);
  }

  async uploadStream(localPath, remotePath, offset = 0, onProgress) {
    if (!this.service || !this.service.connected) throw new Error('S3 client disconnected');
    return await this.service.uploadFile(localPath, remotePath, onProgress);
  }
}

module.exports = S3Adapter;
