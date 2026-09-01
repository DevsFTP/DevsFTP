/**
 * Unified Core Transfer Engine for DevsFTP
 * Manages protocol adapters, queue persistence, byte offset resume, verification pipeline,
 * and transfer history logging.
 */

const fs = require('fs');
const path = require('path');
const SFTPAdapter = require('./sftpAdapter');
const FTPAdapter = require('./ftpAdapter');
const WebDAVAdapter = require('./webdavAdapter');
const S3Adapter = require('./s3Adapter');

let app = null;
try {
  app = require('electron').app;
} catch (e) {
  app = null;
}

class TransferEngine {
  constructor(ipcWindow, logFn) {
    this.ipcWindow = ipcWindow;
    this.logFn = logFn || console.log;
    this.cacheWatcherService = null;

    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.devs_userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.queueFilePath = path.join(userDataPath, 'transfer_queue.json');
    this.historyFilePath = path.join(userDataPath, 'transfer_history.json');

    this.queue = this._loadQueue();
    this.history = this._loadHistory();

    this.activeDestinationLocks = new Set();
    this.cancellationTokens = new Map();

    // Mark any interrupted running tasks from previous session as 'Waiting to Resume'
    this.queue.forEach(item => {
      if (item.status === 'Running' || item.status === 'In Progress') {
        item.status = 'Waiting to Resume';
        item.speed = '0 KB/s';
        if (!item.resumeOffset && item.bytesTransferred) {
          item.resumeOffset = item.bytesTransferred;
        }
      }
    });

    this.maxConcurrency = 3;
    this.speedLimitKBps = 0;

    this._saveQueue();
  }

  setOptions(opts = {}) {
    if (opts.maxConcurrency !== undefined) {
      this.maxConcurrency = Math.max(1, parseInt(opts.maxConcurrency, 10) || 3);
    }
    if (opts.speedLimitKBps !== undefined) {
      this.speedLimitKBps = Math.max(0, parseInt(opts.speedLimitKBps, 10) || 0);
    }
    if (this.logFn) {
      const speedTxt = this.speedLimitKBps > 0 ? `${this.speedLimitKBps} KB/s` : 'Unlimited';
      this.logFn('info', `⚙️ [TransferEngine] Settings updated: Max Concurrency: ${this.maxConcurrency} | Speed Limit: ${speedTxt}`);
    }
  }

  cancelTransfer(taskId) {
    const task = this.queue.find(q => q.id === taskId);
    if (task) {
      task.status = 'Cancelled';
      this.upsertQueueTask(task);
    }
    if (this.cancellationTokens.has(taskId)) {
      const controller = this.cancellationTokens.get(taskId);
      try { controller.abort(); } catch (e) {}
      this.cancellationTokens.delete(taskId);
    }
  }

  getQueue() {
    return this.queue;
  }

  upsertQueueTask(task) {
    const idx = this.queue.findIndex(q => q.id === task.id || (q.source === task.source && q.dest === task.dest && q.profileId === task.profileId));
    if (idx >= 0) {
      this.queue[idx] = { ...this.queue[idx], ...task };
    } else {
      this.queue.push(task);
    }
    this._saveQueue();
  }

  clearCompletedQueue() {
    this.queue = this.queue.filter(q => q.status !== 'Completed');
    this._saveQueue();
    return this.queue;
  }

  removeQueueItem(id) {
    this.cancelTransfer(id);
    this.queue = this.queue.filter(q => q.id !== id);
    this._saveQueue();
    return this.queue;
  }

  saveQueue(newQueue) {
    if (Array.isArray(newQueue)) {
      // Merge queue to prevent out-of-sync overwrites (Issue 12.1)
      this.queue = newQueue.map(rendererTask => {
        const mainTask = this.queue.find(q => q.id === rendererTask.id);
        if (mainTask) {
          if (mainTask.status === 'Completed' || mainTask.status === 'Failed' || mainTask.status === 'Running' || mainTask.status === 'Verifying') {
            return {
              ...rendererTask,
              status: mainTask.status,
              percentage: mainTask.percentage,
              bytesTransferred: mainTask.bytesTransferred,
              totalBytes: mainTask.totalBytes,
              verificationState: mainTask.verificationState
            };
          }
        }
        return rendererTask;
      });
      this._saveQueue();
    }
    return this.queue;
  }

  _loadQueue() {
    if (!fs.existsSync(this.queueFilePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.queueFilePath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _saveQueue() {
    try {
      const tempPath = this.queueFilePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.queue, null, 2), 'utf8');
      fs.renameSync(tempPath, this.queueFilePath);
    } catch (e) {
      this.logFn('error', `[TransferEngine] Failed to write transfer queue file: ${e.message}`);
    }
  }

  _loadHistory() {
    if (!fs.existsSync(this.historyFilePath)) return [];
    try {
      const raw = fs.readFileSync(this.historyFilePath, 'utf8');
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        return loaded.slice(-500); // Trim on load to keep memory footprint bounded (Issue 3.8)
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  _saveHistory() {
    try {
      const trimmed = this.history.slice(-500);
      const tempPath = this.historyFilePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(trimmed, null, 2), 'utf8');
      fs.renameSync(tempPath, this.historyFilePath);
    } catch (e) {
      this.logFn('error', `[TransferEngine] Failed to write transfer history file: ${e.message}`);
    }
  }

  logHistory(task, status, errorMsg = null) {
    const entry = {
      id: task.id,
      type: task.type,
      source: task.source,
      dest: task.dest,
      status,
      bytesTransferred: task.bytesTransferred || task.totalBytes || 0,
      totalBytes: task.totalBytes || 0,
      resumeOffset: task.resumeOffset || 0,
      startedAt: task.startedAt,
      finishedAt: new Date().toISOString(),
      error: errorMsg
    };
    this.history.push(entry);
    this._saveHistory();
  }

  notifyWindow(channel, data) {
    if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
      this.ipcWindow.webContents.send(channel, data);
    }
  }

  getAdapter(session) {
    if (!session) return null;
    const name = session.constructor.name;
    if (name === 'SFTPService') return new SFTPAdapter(session);
    if (name === 'FTPService') return new FTPAdapter(session);
    if (name === 'WebDAVService') return new WebDAVAdapter(session);
    if (name === 'S3Service') return new S3Adapter(session);
    
    // Fallback checks
    if (session.sftp) return new SFTPAdapter(session);
    if (session.client && typeof session.client.getFileContents === 'function') return new WebDAVAdapter(session);
    if (session.client) return new FTPAdapter(session);
    
    throw new Error(`Unsupported protocol service: ${name}`);
  }

  /**
   * Smart Conflict & Partial Detection
   */
  async checkConflict(type, localPath, remotePath, session) {
    const adapter = this.getAdapter(session);
    let localStat = null;
    let remoteStat = null;

    try {
      if (fs.existsSync(localPath)) {
        const st = fs.statSync(localPath);
        localStat = { size: st.size, modifyTime: st.mtime.toISOString(), isDir: st.isDirectory() };
      }
    } catch (e) {}

    try {
      if (adapter && adapter.stat) {
        remoteStat = await adapter.stat(remotePath);
      }
    } catch (e) {}

    const srcStat = type === 'download' ? remoteStat : localStat;
    const destStat = type === 'download' ? localStat : remoteStat;

    const conflict = Boolean(srcStat && destStat);
    let partialTransfer = false;
    let resumeOffset = 0;
    let conflictType = 'exist';
    let isLocalNewer = false;
    let isRemoteNewer = false;

    if (conflict && destStat && srcStat) {
      const srcSize = srcStat.size || 0;
      const destSize = destStat.size || 0;

      // Parse mtimes
      const localTime = localStat && localStat.modifyTime ? new Date(localStat.modifyTime).getTime() : 0;
      const remoteTime = remoteStat && remoteStat.modifyTime ? new Date(remoteStat.modifyTime).getTime() : 0;

      if (localTime > 0 && remoteTime > 0) {
        // 2-second tolerance for filesystem timestamp resolution
        if (localTime - remoteTime > 2000) {
          isLocalNewer = true;
        } else if (remoteTime - localTime > 2000) {
          isRemoteNewer = true;
        }
      }

      if (destSize > 0 && destSize < srcSize) {
        partialTransfer = true;
        resumeOffset = destSize;
        conflictType = 'partial';
      } else if (isRemoteNewer) {
        conflictType = 'remote_newer';
      } else if (isLocalNewer) {
        conflictType = 'local_newer';
      } else if (destSize === srcSize) {
        conflictType = 'same_size';
      } else if (destSize > srcSize) {
        conflictType = 'larger';
      }
    }

    return {
      conflict,
      partialTransfer,
      resumeOffset,
      conflictType,
      isLocalNewer,
      isRemoteNewer,
      localStat,
      remoteStat
    };
  }

  /**
   * Main Transfer Execution with Resume Engine & Verification Pipeline
   */
  async executeTransfer(task, session, options = {}) {
    const adapter = this.getAdapter(session);
    if (!adapter) throw new Error('No valid protocol adapter available');
    if (options.speedLimitKBps === undefined && this.speedLimitKBps > 0) {
      options.speedLimitKBps = this.speedLimitKBps;
    }

    const lockKey = `${task.dest}`;
    if (this.activeDestinationLocks.has(lockKey)) {
      throw new Error(`A transfer to destination "${task.dest}" is already in progress.`);
    }
    this.activeDestinationLocks.add(lockKey);

    // Reuse existing task object in queue if available (Issue 3.3)
    const existingIndex = this.queue.findIndex(q => q.source === task.source && q.dest === task.dest && q.profileId === task.profileId && q.status !== 'Completed');
    let targetTask = task;
    if (existingIndex >= 0) {
      targetTask = this.queue[existingIndex];
    } else {
      this.queue.push(targetTask);
    }

    const abortController = new AbortController();
    this.cancellationTokens.set(targetTask.id, abortController);
    options.signal = abortController.signal;

    const startedAt = new Date().toISOString();
    targetTask.startedAt = startedAt;
    targetTask.status = 'Running';

    let offset = options.resumeOffset || targetTask.resumeOffset || 0;
    if (options.resume && !offset) {
      const check = await this.checkConflict(targetTask.type, targetTask.type === 'download' ? targetTask.dest : targetTask.source, targetTask.type === 'download' ? targetTask.source : targetTask.dest, session);
      if (check.partialTransfer) {
        offset = check.resumeOffset;
      }
    }

    targetTask.resumeOffset = offset;
    if (offset > 0 && targetTask.totalBytes > 0) {
      targetTask.percentage = parseFloat(((offset / targetTask.totalBytes) * 100).toFixed(1));
    }
    this.upsertQueueTask(targetTask);

    this.logFn('info', `[TransferEngine] ${targetTask.type.toUpperCase()} ${targetTask.source} -> ${targetTask.dest} (Resume Offset: ${offset} B, Start %: ${targetTask.percentage || 0}%)`);

    let isDirectory = false;
    let workingLocalDest = targetTask.dest;

    try {
      // Determine if source is directory (Issue 3.1 & 3.2 integration)
      if (targetTask.type === 'download') {
        if (session.stat) {
          try {
            const stat = await session.stat(targetTask.source);
            isDirectory = stat ? Boolean(stat.isDir || stat.isDirectory) : false;
          } catch (e) {}
        }
      } else {
        try {
          if (fs.existsSync(targetTask.source)) {
            isDirectory = fs.statSync(targetTask.source).isDirectory();
          }
        } catch (e) {}
      }

      if (isDirectory) {
        if (targetTask.type === 'download') {
          if (typeof session.downloadDir === 'function') {
            await session.downloadDir(targetTask.source, targetTask.dest, (progress) => {
              targetTask.bytesTransferred = progress.transferred;
              targetTask.totalBytes = progress.total;
              targetTask.percentage = progress.percentage;
              this.upsertQueueTask(targetTask);
              this.notifyWindow('transfer:progress', { ...progress, taskId: targetTask.id, remotePath: targetTask.source, localPath: targetTask.dest, type: 'download' });
            });
          } else {
            throw new Error('Directory download not supported by this protocol.');
          }
        } else {
          if (typeof session.uploadDir === 'function') {
            await session.uploadDir(targetTask.source, targetTask.dest, (progress) => {
              targetTask.bytesTransferred = progress.transferred;
              targetTask.totalBytes = progress.total;
              targetTask.percentage = progress.percentage;
              this.upsertQueueTask(targetTask);
              this.notifyWindow('transfer:progress', { ...progress, taskId: targetTask.id, localPath: targetTask.source, remotePath: targetTask.dest, type: 'upload' });
            });
          } else {
            throw new Error('Directory upload not supported by this protocol.');
          }
        }

        // Directories skip size verification checks — use NotApplicable, not Verified
        targetTask.status = 'Completed';
        targetTask.verificationState = 'NotApplicable';
        targetTask.percentage = 100;
        this.upsertQueueTask(targetTask);
        this.logHistory(targetTask, 'Success');
        this.logFn('info', `✅ [TransferEngine] Directory transfer complete: ${targetTask.dest}`);
        return true;
      }

      // Single file transfer stream logic — use .part temp file for local downloads & remote uploads (HIGH-05)
      if (targetTask.type === 'download') {
        workingLocalDest = targetTask.dest + '.part';

        // Fix 2: Register abort listener early so stalled adapters (no progress callbacks) are also signalled
        let earlyAbortReject = null;
        const earlyAbortPromise = new Promise((_, rej) => { earlyAbortReject = rej; });
        const onEarlyAbort = () => earlyAbortReject(new Error('Transfer cancelled by user'));
        if (options.signal) {
          if (options.signal.aborted) {
            throw new Error('Transfer cancelled by user');
          }
          options.signal.addEventListener('abort', onEarlyAbort, { once: true });
        }

        try {
          await Promise.race([
            adapter.downloadStream(targetTask.source, workingLocalDest, offset, (progress) => {
              if (options.signal && options.signal.aborted) {
                throw new Error('Transfer cancelled by user');
              }
              targetTask.bytesTransferred = progress.transferred;
              targetTask.totalBytes = progress.total;
              targetTask.percentage = progress.percentage;
              this.upsertQueueTask(targetTask);
              this.notifyWindow('transfer:progress', { ...progress, taskId: targetTask.id, remotePath: targetTask.source, localPath: targetTask.dest, type: 'download' });
            }, options),
            earlyAbortPromise
          ]);
        } finally {
          if (options.signal) {
            try { options.signal.removeEventListener('abort', onEarlyAbort); } catch (e) {}
          }
        }

        // Fix 1: Rename .part temp file to final destination with retry (handles EBUSY/EPERM on Windows)
        if (fs.existsSync(workingLocalDest)) {
          let renamed = false;
          for (let attempt = 0; attempt < 3 && !renamed; attempt++) {
            try {
              if (attempt > 0) await new Promise(r => setTimeout(r, 500));
              fs.renameSync(workingLocalDest, targetTask.dest);
              renamed = true;
            } catch (renameErr) {
              if (attempt === 2) throw renameErr;
            }
          }
          workingLocalDest = targetTask.dest;
        }
      } else {
        const workingRemoteDest = targetTask.dest + '.part';
        let uploadSuccess = false;

        // Fix 2: Register abort listener early so stalled adapters (no progress callbacks) are also signalled
        let earlyUploadAbortReject = null;
        const earlyUploadAbortPromise = new Promise((_, rej) => { earlyUploadAbortReject = rej; });
        const onEarlyUploadAbort = () => earlyUploadAbortReject(new Error('Transfer cancelled by user'));
        if (options.signal) {
          if (options.signal.aborted) {
            throw new Error('Transfer cancelled by user');
          }
          options.signal.addEventListener('abort', onEarlyUploadAbort, { once: true });
        }

        try {
          await Promise.race([
            adapter.uploadStream(targetTask.source, workingRemoteDest, offset, (progress) => {
              if (options.signal && options.signal.aborted) {
                throw new Error('Transfer cancelled by user');
              }
              targetTask.bytesTransferred = progress.transferred;
              targetTask.totalBytes = progress.total;
              targetTask.percentage = progress.percentage;
              this.upsertQueueTask(targetTask);
              this.notifyWindow('transfer:progress', { ...progress, taskId: targetTask.id, localPath: targetTask.source, remotePath: targetTask.dest, type: 'upload' });
            }, options),
            earlyUploadAbortPromise
          ]);
          // Atomic remote rename on upload stream completion
          if (session.rename) {
            await session.rename(workingRemoteDest, targetTask.dest);
          }
          uploadSuccess = true;
        } finally {
          if (options.signal) {
            try { options.signal.removeEventListener('abort', onEarlyUploadAbort); } catch (e) {}
          }
          if (!uploadSuccess && session.delete) {
            try { await session.delete(workingRemoteDest, false); } catch (e) {}
          }
        }
      }


      // Verification Pipeline Phase 1: Verifying State
      targetTask.status = 'Verifying';
      targetTask.verificationState = 'VerifyingSize';
      this.upsertQueueTask(targetTask);
      this.logFn('info', `🔍 [Verification Pipeline] Verifying transfer completeness for ${targetTask.dest}...`);

      const verifyCheck = await this.checkConflict(targetTask.type, targetTask.type === 'download' ? targetTask.dest : targetTask.source, targetTask.type === 'download' ? targetTask.source : targetTask.dest, session);
      const destStat = targetTask.type === 'download' ? verifyCheck.localStat : verifyCheck.remoteStat;
      const srcStat = targetTask.type === 'download' ? verifyCheck.remoteStat : verifyCheck.localStat;

      // Fail verification if we can't obtain stats for both sides due to connection drops (Issue 3.6)
      if (!srcStat || !destStat) {
        targetTask.status = 'Failed';
        targetTask.verificationState = 'VerificationFailed';
        this.upsertQueueTask(targetTask);
        this.logHistory(targetTask, 'Failed', `Verification failed: could not stat source or destination files.`);
        throw new Error(`Verification failed: could not stat source or destination files.`);
      }

      if (srcStat.size > 0 && destStat.size !== srcStat.size) {
        targetTask.status = 'Failed';
        targetTask.verificationState = 'Mismatch';
        this.upsertQueueTask(targetTask);
        this.logHistory(targetTask, 'Failed', `Size mismatch after transfer: Expected ${srcStat.size} B, got ${destStat.size} B`);
        throw new Error(`Size verification mismatch: expected ${srcStat.size} bytes, got ${destStat.size} bytes.`);
      }

      targetTask.status = 'Completed';
      targetTask.verificationState = 'Verified';
      targetTask.percentage = 100;
      this.upsertQueueTask(targetTask);
      this.logHistory(targetTask, 'Success');
      if (targetTask.type === 'upload' && this.cacheWatcherService) {
        this.cacheWatcherService.markUploaded(targetTask.source);
      }
      this.logFn('info', `✅ [TransferEngine] Verified & Completed: ${targetTask.dest}`);
      return true;

    } catch (err) {
      // Clean up orphaned .part temp file on download failure/cancellation
      if (targetTask.type === 'download' && workingLocalDest.endsWith('.part') && fs.existsSync(workingLocalDest)) {
        try { fs.unlinkSync(workingLocalDest); } catch (e) {}
      }
      // Preserve terminal states: Cancelled and Failed must not be overwritten
      if (targetTask.status !== 'Cancelled' && targetTask.status !== 'Failed') {
        targetTask.status = 'Waiting to Resume';
        targetTask.speed = '0 KB/s';
        if (!targetTask.resumeOffset && targetTask.bytesTransferred) {
          targetTask.resumeOffset = targetTask.bytesTransferred;
        }
      }
      this.upsertQueueTask(targetTask);
      throw err;
    } finally {
      this.activeDestinationLocks.delete(lockKey);
      this.cancellationTokens.delete(targetTask.id);
    }
  }
}

module.exports = TransferEngine;
