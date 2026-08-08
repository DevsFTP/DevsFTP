/**
 * DevsFTP — WebDAV Transfer Adapter
 * Bridges WebDAVService into the TransferEngine adapter pattern,
 * alongside sftpAdapter.js and ftpAdapter.js.
 */

class WebDAVAdapter {
  constructor(webdavService) {
    this.service = webdavService;
  }

  async uploadFile(localPath, remotePath, onProgress) {
    return this.service.uploadFile(localPath, remotePath, onProgress);
  }

  async uploadDir(localDirPath, remoteDestPath, onProgress) {
    return this.service.uploadDir(localDirPath, remoteDestPath, onProgress);
  }

  async downloadFile(remotePath, localPath, onProgress) {
    return this.service.downloadFile(remotePath, localPath, onProgress);
  }

  async downloadDir(remoteDirPath, localDestPath, onProgress) {
    return this.service.downloadDir(remoteDirPath, localDestPath, onProgress);
  }
}

module.exports = WebDAVAdapter;
