/**
 * DevsFTP — WebDAV Transfer Adapter
 * Bridges WebDAVService into the TransferEngine adapter pattern,
 * alongside sftpAdapter.js and ftpAdapter.js.
 */

class WebDAVAdapter {
  constructor(webdavService) {
    this.service = webdavService;
  }

  async stat(remotePath) {
    if (!this.service || !this.service.connected) return null;
    return await this.service.stat(remotePath);
  }

  async mkdir(remotePath) {
    if (!this.service || !this.service.connected) throw new Error('WebDAV client disconnected');
    return await this.service.mkdir(remotePath);
  }

  async list(remotePath) {
    if (!this.service || !this.service.connected) return { files: [] };
    return await this.service.list(remotePath);
  }

  async downloadStream(remotePath, localPath, offset = 0, onProgress) {
    if (!this.service || !this.service.connected) throw new Error('WebDAV client disconnected');
    // WebDAV client downloadFile supports progress reporting via readStream in our fixed webdavService.js
    return await this.service.downloadFile(remotePath, localPath, onProgress);
  }

  async uploadStream(localPath, remotePath, offset = 0, onProgress) {
    if (!this.service || !this.service.connected) throw new Error('WebDAV client disconnected');
    return await this.service.uploadFile(localPath, remotePath, onProgress);
  }

  async uploadDir(localDirPath, remoteDestPath, onProgress) {
    if (!this.service || !this.service.connected) throw new Error('WebDAV client disconnected');
    return await this.service.uploadDir(localDirPath, remoteDestPath, onProgress);
  }

  async downloadDir(remoteDirPath, localDestPath, onProgress) {
    if (!this.service || !this.service.connected) throw new Error('WebDAV client disconnected');
    return await this.service.downloadDir(remoteDirPath, localDestPath, onProgress);
  }
}

module.exports = WebDAVAdapter;
