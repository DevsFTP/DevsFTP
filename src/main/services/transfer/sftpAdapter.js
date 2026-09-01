/**
 * SFTP Protocol Adapter for DevsFTP Core Transfer Engine
 * Normalizes low-level SFTP streams, byte-offset reading/writing, and file stats.
 */

const fs = require('fs');
const path = require('path');
const { normalizePOSIXPath } = require('../pathUtils');
const ThrottleTransform = require('./throttleTransform');

class SFTPAdapter {
  constructor(sftpSession) {
    this.session = sftpSession;
    this.sftp = sftpSession ? sftpSession.sftp : null;
  }

  async stat(remotePath) {
    if (!this.session || !this.session.connected) return null;
    return await this.session.stat(remotePath);
  }

  async mkdir(remotePath) {
    if (!this.session || !this.session.connected) throw new Error('SFTP client disconnected');
    return await this.session.mkdir(remotePath);
  }

  async list(remotePath) {
    if (!this.session || !this.session.connected) return { files: [] };
    return await this.session.list(remotePath);
  }

  /**
   * Streaming Download with Byte Offset Resume Support
   */
  downloadStream(remotePath, localPath, offset = 0, onProgress, options = {}) {
    if (offset === 0) {
      return new Promise((resolve, reject) => {
        if (!this.session || !this.session.connected || !this.sftp) {
          return reject(new Error('SFTP client disconnected'));
        }
        if (options.signal && options.signal.aborted) {
          return reject(new Error('Transfer cancelled by user'));
        }
        const normRemote = normalizePOSIXPath(remotePath);
        this.sftp.stat(normRemote, (statErr, stats) => {
          if (statErr || !stats) {
            return reject(statErr || new Error(`Remote file stat failed for "${normRemote}"`));
          }
          const totalBytes = stats.size || 1;
          this.sftp.fastGet(normRemote, localPath, {
            step: (transferred, chunk) => {
              if (onProgress) {
                onProgress({
                  transferred,
                  total: totalBytes,
                  percentage: Math.min(100, parseFloat(((transferred / totalBytes) * 100).toFixed(1)))
                });
              }
            }
          }, (err) => {
            if (err) reject(err);
            else resolve(true);
          });
          // Fix 3: hook abort signal for the fastGet fast-path
          if (options && options.signal) {
            options.signal.addEventListener('abort', () => {
              try { this.sftp.end(); } catch(e) {}
              reject(new Error('Transfer cancelled'));
            }, { once: true });
          }
        });
      });
    }

    return new Promise((resolve, reject) => {
      if (!this.session || !this.session.connected || !this.sftp) {
        return reject(new Error('SFTP client disconnected'));
      }
      if (options.signal && options.signal.aborted) {
        return reject(new Error('Transfer cancelled by user'));
      }

      const normRemote = normalizePOSIXPath(remotePath);
      this.sftp.stat(normRemote, (statErr, stats) => {
        if (statErr || !stats) return reject(statErr || new Error('Remote file stat failed'));

        const totalBytes = stats.size || 1;
        let validOffset = Math.min(offset, totalBytes);
        if (validOffset < 0) validOffset = 0;

        // Verify local file size matches the offset to prevent corrupt appends (Issue 3.4)
        if (validOffset > 0) {
          try {
            if (fs.existsSync(localPath)) {
              const localSize = fs.statSync(localPath).size;
              if (validOffset > localSize) {
                validOffset = localSize;
              }
            } else {
              validOffset = 0;
            }
          } catch (e) {
            validOffset = 0;
          }
        }

        let bytesRead = validOffset;

        const writeFlags = validOffset > 0 ? 'a' : 'w';
        const writeStream = fs.createWriteStream(localPath, { flags: writeFlags });
        const readStreamOptions = validOffset > 0 ? { start: validOffset } : {};

        const readStream = this.sftp.createReadStream(normRemote, readStreamOptions);

        let isDone = false;
        let progressStream = null;

        const onAbort = () => {
          cleanup(new Error('Transfer cancelled by user'));
        };
        if (options.signal) {
          options.signal.addEventListener('abort', onAbort, { once: true });
        }

        const cleanup = (err) => {
          if (isDone) return;
          isDone = true;
          if (options.signal) {
            try { options.signal.removeEventListener('abort', onAbort); } catch (e) {}
          }
          try { if (progressStream) progressStream.destroy(); } catch (e) {}
          try { if (throttleStream) throttleStream.destroy(); } catch (e) {}
          try { writeStream.destroy(); } catch (e) {}
          try { readStream.destroy(); } catch (e) {}
          if (err) {
            reject(err);
          } else {
            resolve({ transferred: bytesRead, total: totalBytes });
          }
        };

        let throttleStream = null;
        let bodyStream = readStream;

        if (options.speedLimitKBps > 0) {
          throttleStream = new ThrottleTransform(options.speedLimitKBps);
          bodyStream = bodyStream.pipe(throttleStream);
        }

        if (onProgress) {
          const { Transform } = require('stream');
          progressStream = new Transform({
            transform(chunk, encoding, callback) {
              bytesRead += chunk.length;
              onProgress({
                transferred: bytesRead,
                total: totalBytes,
                percentage: Math.min(100, parseFloat(((bytesRead / totalBytes) * 100).toFixed(1)))
              });
              callback(null, chunk);
            }
          });
          bodyStream = bodyStream.pipe(progressStream);
        }

        bodyStream.on('error', (err) => cleanup(err));
        writeStream.on('error', (err) => cleanup(err));

        writeStream.on('finish', () => cleanup(null));
        writeStream.on('close', () => cleanup(null));

        bodyStream.pipe(writeStream);
      });
    });
  }

  /**
   * Streaming Upload with Byte Offset Resume Support
   */
  uploadStream(localPath, remotePath, offset = 0, onProgress, options = {}) {
    if (offset === 0) {
      return new Promise((resolve, reject) => {
        if (!this.session || !this.session.connected || !this.sftp) {
          return reject(new Error('SFTP client disconnected'));
        }
        if (options.signal && options.signal.aborted) {
          return reject(new Error('Transfer cancelled by user'));
        }
        const normRemote = normalizePOSIXPath(remotePath);
        fs.stat(localPath, (statErr, stats) => {
          if (statErr || !stats) {
            return reject(statErr || new Error(`Local file stat failed for "${localPath}"`));
          }
          const totalBytes = stats.size || 1;
          this.sftp.fastPut(localPath, normRemote, {
            step: (transferred, chunk) => {
              if (onProgress) {
                onProgress({
                  transferred,
                  total: totalBytes,
                  percentage: Math.min(100, parseFloat(((transferred / totalBytes) * 100).toFixed(1)))
                });
              }
            }
          }, (err) => {
            if (err) {
              if (err && (err.message === 'Failure' || err.code === 4 || String(err.message).includes('Failure'))) {
                this.sftp.stat(normRemote, (statErr, remoteStats) => {
                  if (!statErr && remoteStats && remoteStats.size === totalBytes) {
                    return resolve(true);
                  }
                  reject(err);
                });
              } else {
                reject(err);
              }
            } else {
              resolve(true);
            }
          });
          // Fix 3: hook abort signal for the fastPut fast-path
          if (options && options.signal) {
            options.signal.addEventListener('abort', () => {
              try { this.sftp.end(); } catch(e) {}
              reject(new Error('Transfer cancelled'));
            }, { once: true });
          }
        });
      });
    }

    return new Promise((resolve, reject) => {
      if (!this.session || !this.session.connected || !this.sftp) {
        return reject(new Error('SFTP client disconnected'));
      }
      if (options.signal && options.signal.aborted) {
        return reject(new Error('Transfer cancelled by user'));
      }

      const normRemote = normalizePOSIXPath(remotePath);
      fs.stat(localPath, (statErr, stats) => {
        if (statErr || !stats) return reject(statErr || new Error('Local file stat failed'));

        const totalBytes = stats.size || 1;
        let validOffset = Math.min(offset, totalBytes);
        if (validOffset < 0) validOffset = 0;

        const startUpload = () => {
          let bytesSent = validOffset;

          const readStreamOptions = validOffset > 0 ? { start: validOffset } : {};
          const readStream = fs.createReadStream(localPath, readStreamOptions);

          const writeStreamOptions = validOffset > 0 ? { flags: 'a' } : { flags: 'w' };
          const writeStream = this.sftp.createWriteStream(normRemote, writeStreamOptions);

          let isDone = false;
          let progressStream = null;

          const onAbort = () => {
            cleanup(new Error('Transfer cancelled by user'));
          };
          if (options.signal) {
            options.signal.addEventListener('abort', onAbort, { once: true });
          }

          const cleanup = (err) => {
            if (isDone) return;
            isDone = true;
            if (options.signal) {
              try { options.signal.removeEventListener('abort', onAbort); } catch (e) {}
            }
            try { if (progressStream) progressStream.destroy(); } catch (e) {}
            try { if (throttleStream) throttleStream.destroy(); } catch (e) {}
            try { writeStream.destroy(); } catch (e) {}
            try { readStream.destroy(); } catch (e) {}
            if (err) {
              reject(err);
            } else {
              resolve({ transferred: bytesSent, total: totalBytes });
            }
          };

          let throttleStream = null;
          let bodyStream = readStream;

          if (options.speedLimitKBps > 0) {
            throttleStream = new ThrottleTransform(options.speedLimitKBps);
            bodyStream = bodyStream.pipe(throttleStream);
          }

          if (onProgress) {
            const { Transform } = require('stream');
            progressStream = new Transform({
              transform(chunk, encoding, callback) {
                bytesSent += chunk.length;
                onProgress({
                  transferred: bytesSent,
                  total: totalBytes,
                  percentage: Math.min(100, parseFloat(((bytesSent / totalBytes) * 100).toFixed(1)))
                });
                callback(null, chunk);
              }
            });
            bodyStream = bodyStream.pipe(progressStream);
          }

          bodyStream.on('error', (err) => cleanup(err));
          writeStream.on('error', (err) => cleanup(err));

          writeStream.on('finish', () => cleanup(null));
          writeStream.on('close', () => cleanup(null));

          bodyStream.pipe(writeStream);
        };

        if (validOffset > 0) {
          this.sftp.stat(normRemote, (remoteStatErr, remoteStats) => {
            if (!remoteStatErr && remoteStats) {
              const remoteSize = remoteStats.size || 0;
              if (validOffset > remoteSize) {
                validOffset = remoteSize;
              }
            } else {
              validOffset = 0;
            }
            startUpload();
          });
        } else {
          startUpload();
        }
      });
    });
  }
}

module.exports = SFTPAdapter;
