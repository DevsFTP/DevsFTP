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

  async downloadStream(remotePath, localPath, offset = 0, onProgress, options = {}) {
    if (!this.service || !this.service.connected) throw new Error('WebDAV client disconnected');
    // NOTE: WebDAV byte-range resume (offset > 0) is not supported by the underlying webdavService.downloadFile.
    // A full re-download will occur. Log a warning so the operator is aware.
    if (offset > 0) {
      console.warn(`[WebDAVAdapter] downloadStream called with offset=${offset}, but WebDAV does not support byte-range resume. Downloading from start.`);
    }
    // Wrap onProgress to check cancellation signal on each progress tick
    const wrappedProgress = onProgress ? (progress) => {
      if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');
      onProgress(progress);
    } : undefined;
    // WebDAV client downloadFile supports progress reporting via readStream in our fixed webdavService.js
    return await this.service.downloadFile(remotePath, localPath, wrappedProgress);
  }

  async uploadStream(localPath, remotePath, offset = 0, onProgress, options = {}) {
    if (!this.service || !this.service.connected) throw new Error('WebDAV client disconnected');
    // NOTE: WebDAV byte-range resume (offset > 0) is not supported by the underlying webdavService.uploadFile.
    // A full re-upload will occur. Log a warning so the operator is aware.
    if (offset > 0) {
      console.warn(`[WebDAVAdapter] uploadStream called with offset=${offset}, but WebDAV does not support byte-range resume. Uploading from start.`);
    }
    // Wrap onProgress to check cancellation signal on each progress tick
    const wrappedProgress = onProgress ? (progress) => {
      if (options.signal && options.signal.aborted) throw new Error('Transfer cancelled');
      onProgress(progress);
    } : undefined;
    return await this.service.uploadFile(localPath, remotePath, wrappedProgress);
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
