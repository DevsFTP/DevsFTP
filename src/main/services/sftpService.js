/**
 * SFTP Driver Service using ssh2
 * Provides robust connection handling, directory readdir, chunked streaming file transfers,
 * and permissions management.
 */

const { Client } = require('ssh2');
const { SocksClient } = require('socks');
const fs = require('fs');
const path = require('path');
const { normalizePOSIXPath, formatPermissions } = require('./pathUtils');

class SFTPService {
  constructor() {
    this.sshClient = null;
    this.sftp = null;
    this.connected = false;
    this.currentConfig = null;
    this.isManualDisconnect = false;
    this.onUnexpectedClose = null;
    this.bastionClient = null;
  }

  connect(config, onLog, verifyHostKeyFn) {
    return new Promise((resolve, reject) => {
      this.sshClient = new Client();
      this.currentConfig = config;
      this.isManualDisconnect = false;

      this.sshClient.on('ready', () => {
        if (onLog) onLog('info', 'SSH Connection established. Requesting SFTP subsystem...');
        this.sshClient.sftp((err, sftp) => {
          if (err) {
            this.connected = false;
            if (onLog) onLog('error', `SFTP Subsystem failed: ${err.message}`);
            return reject(err);
          }
          this.sftp = sftp;
          this.connected = true;
          if (onLog) onLog('info', 'SFTP Session active and ready.');
          
          this.sftp.realpath('.', (realErr, absPath) => {
            let remoteOS = 'linux';
            if (realErr) {
              if (onLog) onLog('warning', `realpath('.') check failed (${realErr.message}). Defaulting remote OS to LINUX.`);
            } else if (absPath) {
              const clean = absPath.replace(/\\/g, '/');
              if (/^[a-zA-Z]:/i.test(clean) || /^\/[a-zA-Z]:/i.test(clean)) {
                remoteOS = 'windows';
              }
            }
            this.remoteOS = remoteOS;
            if (onLog) onLog('info', `Detected remote server OS: ${remoteOS.toUpperCase()}`);
            resolve(true);
          });
        });
      });

      this.sshClient.on('error', (err) => {
        const wasConnected = this.connected;
        this.connected = false;
        if (this.bastionClient) {
          try { this.bastionClient.end(); } catch (e) {}
          this.bastionClient = null;
        }
        if (onLog) onLog('error', `SSH Connection error: ${err.message}`);
        
        if (wasConnected) {
          // Trigger unexpected close instead of rejecting the settled promise (Issue 10.1)
          if (!this.isManualDisconnect && typeof this.onUnexpectedClose === 'function') {
            const cb = this.onUnexpectedClose;
            this.onUnexpectedClose = null;
            cb();
          }
        } else {
          reject(err);
        }
      });

      this.sshClient.on('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        if (this.bastionClient) {
          try { this.bastionClient.end(); } catch (e) {}
          this.bastionClient = null;
        }
        if (onLog) onLog('warning', 'SSH Connection closed.');
        if (wasConnected && !this.isManualDisconnect && typeof this.onUnexpectedClose === 'function') {
          const cb = this.onUnexpectedClose;
          this.onUnexpectedClose = null;
          cb();
        }
      });

      const connectOpts = {
        host: config.host,
        port: parseInt(config.port || 22, 10),
        username: config.username,
        keepaliveInterval: 10000,
        readyTimeout: 20000
      };

      if (verifyHostKeyFn) {
        connectOpts.hostHash = 'sha256';
        connectOpts.hostVerifier = (hashedKey, done) => {
          const rawKey = String(hashedKey || '');
          const fingerprint = rawKey.startsWith('SHA256:') ? rawKey : `SHA256:${rawKey}`;
          verifyHostKeyFn({
            host: config.host,
            port: connectOpts.port,
            fingerprint: fingerprint
          }).then((approved) => {
            if (approved) {
              if (onLog) onLog('info', `Host key accepted for ${config.host}:${connectOpts.port}`);
              done(true);
            } else {
              if (onLog) onLog('error', `Host key rejected for ${config.host}:${connectOpts.port}`);
              done(false);
            }
          }).catch((err) => {
            if (onLog) onLog('error', `Host key verification error: ${err.message}`);
            done(false);
          });
        };
      }

      if (config.authType === 'key' && config.privateKeyPath) {
        try {
          connectOpts.privateKey = fs.readFileSync(config.privateKeyPath);
          if (config.passphrase) connectOpts.passphrase = config.passphrase;
        } catch (keyErr) {
          return reject(new Error(`Failed to read SSH private key file: ${keyErr.message}`));
        }
      } else {
        connectOpts.password = config.password || '';
        connectOpts.tryKeyboard = true;
        this.sshClient.on('keyboard-interactive', (_name, _instructions, _instructionsLang, _prompts, finish) => {
          finish([config.password || '']);
        });
      }

      const proxyType = config.proxyType ? String(config.proxyType).toLowerCase() : 'none';
      if (proxyType === 'bastion' && config.proxyHost) {
        if (onLog) onLog('info', `Connecting to SSH Bastion Host (Jump Box) at ${config.proxyHost}:${config.proxyPort || 22}...`);
        const bastionClient = new Client();

        const bastionOpts = {
          host: config.proxyHost,
          port: parseInt(config.proxyPort || 22, 10),
          username: config.proxyUsername || config.username,
          keepaliveInterval: 10000,
          readyTimeout: 20000
        };

        if (config.authType === 'key' && config.privateKeyPath) {
          try {
            bastionOpts.privateKey = fs.readFileSync(config.privateKeyPath);
            if (config.passphrase || config.proxyPassword) bastionOpts.passphrase = config.passphrase || config.proxyPassword;
          } catch (e) {
            // Reject immediately with a clear message (Fix A1)
            return reject(new Error(`Failed to read SSH private key for bastion host: ${e.message}`));
          }
        } else if (config.proxyPassword || config.password) {
          bastionOpts.password = config.proxyPassword || config.password;
        }

        bastionClient.on('ready', () => {
          if (onLog) onLog('info', `Bastion Host connected cleanly. Creating ProxyJump tunnel stream to ${config.host}:${connectOpts.port}...`);
          bastionClient.forwardOut('127.0.0.1', 0, config.host, connectOpts.port, (err, stream) => {
            if (err) {
              bastionClient.end();
              this.bastionClient = null;
              if (onLog) onLog('error', `Bastion ProxyJump forwardOut failed: ${err.message}`);
              return reject(err);
            }
            connectOpts.sock = stream;
            if (onLog) onLog('info', `ProxyJump stream established. Initiating SSH session to target host ${config.host}...`);
            this.sshClient.connect(connectOpts);
          });
        });

        bastionClient.on('error', (err) => {
          if (onLog) onLog('error', `Bastion Host connection error: ${err.message}`);
          this.bastionClient = null;
          reject(err);
        });

        this.bastionClient = bastionClient;
        bastionClient.connect(bastionOpts);
      } else if (proxyType !== 'none' && (proxyType === 'socks5' || proxyType === 'socks4') && config.proxyHost) {
        const type = proxyType === 'socks4' ? 4 : 5;
        const proxyOptions = {
          proxy: {
            host: config.proxyHost,
            port: parseInt(config.proxyPort || 1080, 10),
            type: type
          },
          command: 'connect',
          destination: {
            host: config.host,
            port: connectOpts.port
          }
        };

        if (config.proxyUsername) {
          proxyOptions.proxy.userId = config.proxyUsername;
          if (config.proxyPassword) proxyOptions.proxy.password = config.proxyPassword;
        }

        if (onLog) onLog('info', `Connecting through ${proxyType.toUpperCase()} Proxy at ${config.proxyHost}:${proxyOptions.proxy.port}...`);

        SocksClient.createConnection(proxyOptions, (err, info) => {
          if (err) {
            if (onLog) onLog('error', `SOCKS Proxy connection failed: ${err.message}`);
            return reject(err);
          }
          connectOpts.sock = info.socket;
          if (onLog) onLog('info', `SOCKS Proxy tunnel established. Initiating SSH session to ${config.host}...`);
          this.sshClient.connect(connectOpts);
        });
      } else {
        if (onLog) onLog('info', `Connecting via SFTP to ${config.username}@${config.host}:${connectOpts.port}...`);
        this.sshClient.connect(connectOpts);
      }
    });
  }

  stat(remotePath) {
    return new Promise((resolve) => {
      if (!this.connected || !this.sftp) return resolve(null);
      this.sftp.stat(normalizePOSIXPath(remotePath), (err, stats) => {
        if (err || !stats) return resolve(null);
        resolve({
          size: stats.size || 0,
          modifyTime: stats.mtime ? new Date(stats.mtime * 1000).toISOString() : new Date().toISOString(),
          isDir: (stats.mode & 0o040000) === 0o040000
        });
      });
    });
  }

  list(remoteDir = '/') {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) {
        return reject(new Error('SFTP client is not connected.'));
      }

      const normalizedPath = normalizePOSIXPath(remoteDir);
      this.sftp.readdir(normalizedPath, async (err, list) => {
        if (err) return reject(err);

        try {
          // Build entries — symlinks need a follow-up stat to resolve target type (D3)
          const regularEntries = [];
          const symlinkEntries = [];

          for (const item of list) {
            // Fix 1 (HIGH): Guard against malformed SFTP entries missing attrs or longname
            if (!item.attrs || !item.longname) continue;

            const isDir = (item.attrs.mode & 0o040000) === 0o040000 || item.longname.startsWith('d');
            const isLink = (item.attrs.mode & 0o120000) === 0o120000 || item.longname.startsWith('l');
            const type = isDir ? 'd' : (isLink ? 'l' : '-');

            const entry = {
              name: item.filename,
              path: normalizePOSIXPath(`${normalizedPath}/${item.filename}`),
              type: type,
              isDir: isDir,
              size: item.attrs.size || 0,
              modifyTime: item.attrs.mtime ? new Date(item.attrs.mtime * 1000).toISOString() : new Date().toISOString(),
              permissions: formatPermissions(item.attrs.mode),
              mode: item.attrs.mode
            };

            if (isLink) {
              symlinkEntries.push(entry);
            } else {
              regularEntries.push(entry);
            }
          }

          // Resolve symlink target types with throttled concurrency (max 10) (Fix D3)
          const SYMLINK_CONCURRENCY = 10;
          const resolvedLinks = [];
          for (let i = 0; i < symlinkEntries.length; i += SYMLINK_CONCURRENCY) {
            const batch = symlinkEntries.slice(i, i + SYMLINK_CONCURRENCY);
            const batchResults = await Promise.all(batch.map(entry =>
              new Promise((resResolve) => {
                this.sftp.stat(entry.path, (statErr, stats) => {
                  if (!statErr && stats) {
                    entry.isDir = (stats.mode & 0o040000) === 0o040000;
                    if (entry.isDir) entry.type = 'd';
                  }
                  resResolve(entry);
                });
              })
            ));
            resolvedLinks.push(...batchResults);
          }

          const items = [...regularEntries, ...resolvedLinks];

          // Sort directories first, then files alphabetically
          items.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
          });

          resolve({ currentPath: normalizedPath, files: items });
        } catch (cbErr) {
          reject(cbErr);
        }
      });
    });
  }

  downloadFile(remotePath, localPath, onProgress) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) {
        return reject(new Error('SFTP client is not connected.'));
      }

      this.sftp.stat(remotePath, (statErr, stats) => {
        if (statErr) return reject(statErr);
        const totalBytes = stats.size || 1;
        let transferred = 0;

        const options = {
          step: (total, chunk, totalSize) => {
            transferred = total;
            if (onProgress) {
              onProgress({
                transferred,
                total: totalBytes,
                percentage: Math.min(100, Math.round((transferred / totalBytes) * 100))
              });
            }
          }
        };

        this.sftp.fastGet(remotePath, localPath, options, (err) => {
          if (err) {
            try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (e) {}
            return reject(err);
          }
          resolve(true);
        });
      });
    });
  }

  async downloadDir(remoteDirPath, localDestPath, onProgress) {
    if (!this.connected || !this.sftp) throw new Error('SFTP client is not connected.');
    const normRemote = normalizePOSIXPath(remoteDirPath);

    // Use async fs to avoid blocking the event loop (Fix A4/D2)
    try { await fs.promises.access(localDestPath); } catch {
      await fs.promises.mkdir(localDestPath, { recursive: true });
    }

    const res = await this.list(normRemote);
    const items = (res && res.files) ? res.files : [];
    // Collect per-file errors and continue — don't abort on a single failure (Fix A3)
    const errors = [];
    for (const item of items) {
      const remoteItemPath = `${normRemote === '/' ? '' : normRemote}/${item.name}`;
      const localItemPath = path.join(localDestPath, item.name);
      try {
        if (item.isDir) {
          await this.downloadDir(remoteItemPath, localItemPath, onProgress);
        } else {
          await this.downloadFile(remoteItemPath, localItemPath, onProgress);
        }
      } catch (itemErr) {
        errors.push({ path: remoteItemPath, error: itemErr.message });
      }
    }
    if (errors.length > 0) {
      return { success: true, partial: true, errors };
    }
    return { success: true, partial: false, errors: [] };
  }

  uploadFile(localPath, remotePath, onProgress) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) {
        return reject(new Error('SFTP client is not connected.'));
      }

      fs.stat(localPath, (statErr, stats) => {
        if (statErr) return reject(statErr);
        const totalBytes = stats.size || 1;
        let transferred = 0;

        const options = {
          step: (total, chunk, totalSize) => {
            transferred = total;
            if (onProgress) {
              onProgress({
                transferred,
                total: totalBytes,
                percentage: Math.min(100, Math.round((transferred / totalBytes) * 100))
              });
            }
          }
        };

        this.sftp.fastPut(localPath, remotePath, options, (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    });
  }

  async uploadDir(localDirPath, remoteDestDirPath, onProgress) {
    if (!this.connected || !this.sftp) throw new Error('SFTP client is not connected.');
    const normRemote = normalizePOSIXPath(remoteDestDirPath);

    try {
      await this.mkdir(normRemote);
    } catch (e) {
      // Fix 4 (LOW): Only swallow "already exists" failures.
      // SFTP error code 4 (SSH_FX_FAILURE) is what most servers return for mkdir-on-existing-dir.
      if (e && e.code !== 4 && !String(e.message || '').includes('exist')) throw e;
    }

    // Use async readdir to avoid blocking the event loop (Fix A2/D1)
    const items = await fs.promises.readdir(localDirPath, { withFileTypes: true });

    // Collect per-file errors and continue — don't abort on a single failure (Fix A3)
    const errors = [];
    for (const item of items) {
      const localItemPath = path.join(localDirPath, item.name);
      const remoteItemPath = `${normRemote === '/' ? '' : normRemote}/${item.name}`;
      try {
        if (item.isDirectory()) {
          await this.uploadDir(localItemPath, remoteItemPath, onProgress);
        } else {
          await this.uploadFile(localItemPath, remoteItemPath, onProgress);
        }
      } catch (itemErr) {
        errors.push({ path: localItemPath, error: itemErr.message });
      }
    }
    if (errors.length > 0) {
      return { success: true, partial: true, errors };
    }
    return { success: true, partial: false, errors: [] };
  }

  createFile(remotePath, mode = null) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      const normPath = normalizePOSIXPath(remotePath);
      this.sftp.open(normPath, 'w', (err, handle) => {
        if (err) return reject(err);
        this.sftp.close(handle, (closeErr) => {
          if (closeErr) return reject(closeErr);
          if (mode) {
            const octal = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            if (!isNaN(octal)) {
              return this.sftp.chmod(normPath, octal, (chmodErr) => {
                if (chmodErr) return reject(chmodErr);
                resolve(true);
              });
            }
          }
          resolve(true);
        });
      });
    });
  }

  mkdir(remotePath, mode = null) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      const normPath = normalizePOSIXPath(remotePath);
      this.sftp.mkdir(normPath, (err) => {
        if (err) return reject(err);
        if (mode) {
          const octal = typeof mode === 'string' ? parseInt(mode, 8) : mode;
          if (!isNaN(octal)) {
            return this.sftp.chmod(normPath, octal, (chmodErr) => {
              if (chmodErr) return reject(chmodErr);
              resolve(true);
            });
          }
        }
        resolve(true);
      });
    });
  }

  async delete(remotePath, isDirectory = false) {
    if (!this.connected || !this.sftp) throw new Error('SFTP client is not connected.');
    const normPath = normalizePOSIXPath(remotePath);

    if (isDirectory) {
      let res = null;
      try {
        res = await this.list(normPath);
      } catch (e) {
        // Fix 2 (MEDIUM): Listing failed — continue deletion with empty children list.
        // This is correct behaviour: we still attempt rmdir on the directory itself.
        // Do NOT rethrow; log a diagnostic warning instead.
        if (this.log) this.log('warn', `delete(): could not list "${normPath}" before deletion (${e.message}). Proceeding with empty children.`);
      }

      const items = (res && res.files) ? res.files : [];
      for (const item of items) {
        const itemPath = `${normPath === '/' ? '' : normPath}/${item.name}`;
        if (item.isDir) {
          await this.delete(itemPath, true);
        } else {
          await new Promise((resolve, reject) => {
            this.sftp.unlink(itemPath, (err) => {
              if (err) return reject(err);
              resolve(true);
            });
          });
        }
      }

      return new Promise((resolve, reject) => {
        this.sftp.rmdir(normPath, (err) => {
          if (err) {
            // Retry directory deletion once in case of non-atomic file additions (Issue 10.2)
            (async () => {
              const retryRes = await this.list(normPath);
              const retryItems = (retryRes && retryRes.files) ? retryRes.files : [];
              for (const item of retryItems) {
                const itemPath = `${normPath === '/' ? '' : normPath}/${item.name}`;
                await this.delete(itemPath, item.isDir);
              }
              return new Promise((rRes, rRej) => {
                this.sftp.rmdir(normPath, (retryErr) => {
                  if (retryErr) return rRej(retryErr);
                  rRes(true);
                });
              });
            })().then(() => resolve(true)).catch(() => reject(err));
          } else {
            resolve(true);
          }
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        this.sftp.unlink(normPath, (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    }
  }

  chmod(remotePath, mode) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      this.sftp.chmod(normalizePOSIXPath(remotePath), mode, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  rename(oldPath, newPath) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      this.sftp.rename(normalizePOSIXPath(oldPath), normalizePOSIXPath(newPath), (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  copy(srcPath, destPath) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sftp) return reject(new Error('SFTP not connected'));
      
      const cleanSrc = normalizePOSIXPath(srcPath);
      const cleanDest = normalizePOSIXPath(destPath);

      // Attempt fast server-side SSH cp -r first
      if (this.sshClient) {
        let settled = false;

        // Escape single quotes inside paths then wrap in single quotes (Fix B3)
        // Single-quoted shell args are immune to $(), backticks, and other injections
        const escapedSrc = cleanSrc.replace(/'/g, "'\\''");
        const escapedDest = cleanDest.replace(/'/g, "'\\''");

        // Fix 3 (LOW): Helper that only attempts stream copy if SFTP session is still alive.
        const safeStreamCopy = () => {
          if (!this.sftp) {
            reject(new Error('copy(): SFTP session disconnected before stream fallback could run.'));
            return;
          }
          this._copyViaStream(cleanSrc, cleanDest).then(resolve).catch(reject);
        };

        // Timeout after 3 seconds: fallback to streaming if command hangs
        const execTimeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            safeStreamCopy();
          }
        }, 3000);

        this.sshClient.exec(`cp -r '${escapedSrc}' '${escapedDest}'`, (err, stream) => {
          if (err) {
            clearTimeout(execTimeout);
            if (!settled) {
              settled = true;
              safeStreamCopy();
            }
            return;
          }
          
          // Drain stdout to prevent buffering hangs
          stream.on('data', () => {});
          
          // Drain stderr
          if (stream.stderr) {
            stream.stderr.on('data', () => {});
            stream.stderr.on('error', () => {});
          }

          stream.on('error', () => {
            clearTimeout(execTimeout);
            if (!settled) {
              settled = true;
              safeStreamCopy();
            }
          });

          stream.on('close', (code) => {
            clearTimeout(execTimeout);
            if (!settled) {
              settled = true;
              if (code === 0) {
                resolve(true);
              } else {
                safeStreamCopy();
              }
            }
          });
        });
      } else {
        // Fix 3 (LOW): Guard stream copy when no sshClient (sftp-only path)
        if (!this.sftp) {
          return reject(new Error('copy(): SFTP session is not connected.'));
        }
        this._copyViaStream(cleanSrc, cleanDest).then(resolve).catch(reject);
      }
    });
  }

  _copyViaStream(src, dest) {
    return new Promise((resolve, reject) => {
      this.sftp.stat(src, (err, stats) => {
        if (err) return reject(err);
        
        try {
          const isDir = stats && (typeof stats.isDirectory === 'function' ? stats.isDirectory() : ((stats.mode & 0o170000) === 0o040000));
          if (isDir) {
            this._copyDirViaStream(src, dest).then(resolve).catch(reject);
          } else {
            this._copyFileViaStream(src, dest).then(resolve).catch(reject);
          }
        } catch (statErr) {
          reject(statErr);
        }
      });
    });
  }

  _copyFileViaStream(src, dest) {
    return new Promise((resolve, reject) => {
      const readStream = this.sftp.createReadStream(src);
      const writeStream = this.sftp.createWriteStream(dest);

      let isDone = false;
      const cleanup = (err) => {
        if (isDone) return;
        isDone = true;
        try { readStream.unpipe(writeStream); } catch (e) {}
        try { readStream.destroy(); } catch (e) {}
        try { writeStream.destroy(); } catch (e) {}
        if (err) reject(err);
        else resolve(true);
      };

      readStream.on('error', (err) => cleanup(err));
      writeStream.on('error', (err) => cleanup(err));
      writeStream.on('close', () => cleanup(null));
      writeStream.on('finish', () => cleanup(null));

      readStream.pipe(writeStream);
    });
  }

  async _copyDirViaStream(src, dest) {
    await new Promise((resolve, reject) => {
      this.sftp.mkdir(dest, (err) => {
        if (err && err.code !== 4) return reject(err); 
        resolve(true);
      });
    });

    const items = await new Promise((resolve, reject) => {
      this.sftp.readdir(src, (err, list) => {
        if (err) return reject(err);
        resolve(list);
      });
    });

    for (const item of items) {
      const itemSrc = `${src}/${item.filename}`;
      const itemDest = `${dest}/${item.filename}`;
      await this._copyViaStream(itemSrc, itemDest);
    }
    return true;
  }

  execCommand(cmdString) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.sshClient) {
        return reject(new Error('SSH/SFTP session is not connected or does not support shell command execution.'));
      }
      
      this.sshClient.exec(cmdString, (err, stream) => {
        if (err) return reject(err);
        
        let stdout = '';
        let stderr = '';
        
        stream.on('data', (data) => {
          stdout += data.toString();
        });
        
        if (stream.stderr) {
          stream.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        }
        
        stream.on('close', (code) => {
          resolve({
            code,
            stdout,
            stderr
          });
        });

        stream.on('error', (streamErr) => {
          reject(streamErr);
        });
      });
    });
  }

  disconnect() {
    this.isManualDisconnect = true;
    if (this.sshClient) {
      try {
        this.sshClient.end();
      } catch (e) {}
    }
    if (this.bastionClient) {
      try {
        this.bastionClient.end();
      } catch (e) {}
      this.bastionClient = null;
    }
    this.sshClient = null;
    this.sftp = null;
    this.connected = false;
  }
}

module.exports = SFTPService;
