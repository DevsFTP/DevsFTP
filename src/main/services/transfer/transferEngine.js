/**
 * Unified Core Transfer Engine for DevsFTP
 * Manages protocol adapters, queue persistence, byte offset resume, verification pipeline,
 * and transfer history logging.
 */

const fs = require('fs');
const path = require('path');
const SFTPAdapter = require('./sftpAdapter');
const FTPAdapter = require('./ftpAdapter');

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
    this._saveQueue();
  }

  getQueue() {
    return this.queue;
  }

  upsertQueueTask(task) {
    const idx = this.queue.findIndex(q => q.id === task.id || (q.source === task.source && q.dest === task.dest));
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
    this.queue = this.queue.filter(q => q.id !== id);
    this._saveQueue();
    return this.queue;
  }

  saveQueue(newQueue) {
    if (Array.isArray(newQueue)) {
      this.queue = newQueue;
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
      fs.writeFileSync(this.queueFilePath, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (e) {}
  }

  _loadHistory() {
    if (!fs.existsSync(this.historyFilePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.historyFilePath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _saveHistory() {
    try {
      const trimmed = this.history.slice(-500);
      fs.writeFileSync(this.historyFilePath, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch (e) {}
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
    if (session.sftp) return new SFTPAdapter(session);
    if (session.client) return new FTPAdapter(session);
    return new SFTPAdapter(session);
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

    if (conflict && destStat && srcStat) {
      const srcSize = srcStat.size || 0;
      const destSize = destStat.size || 0;

      if (destSize > 0 && destSize < srcSize) {
        partialTransfer = true;
        resumeOffset = destSize;
        conflictType = 'partial';
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

    // Reuse existing task object in queue if available
    const existingIndex = this.queue.findIndex(q => q.source === task.source && q.dest === task.dest && q.status !== 'Completed');
    let targetTask = task;
    if (existingIndex >= 0) {
      targetTask = this.queue[existingIndex];
    } else {
      this.queue.push(targetTask);
    }

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

    try {
      if (targetTask.type === 'download') {
        await adapter.downloadStream(targetTask.source, targetTask.dest, offset, (progress) => {
          targetTask.bytesTransferred = progress.transferred;
          targetTask.totalBytes = progress.total;
          targetTask.percentage = progress.percentage;
          this.upsertQueueTask(targetTask);
          this.notifyWindow('transfer:progress', { ...progress, remotePath: targetTask.source, localPath: targetTask.dest, type: 'download' });
        });
      } else {
        await adapter.uploadStream(targetTask.source, targetTask.dest, offset, (progress) => {
          targetTask.bytesTransferred = progress.transferred;
          targetTask.totalBytes = progress.total;
          targetTask.percentage = progress.percentage;
          this.upsertQueueTask(targetTask);
          this.notifyWindow('transfer:progress', { ...progress, localPath: targetTask.source, remotePath: targetTask.dest, type: 'upload' });
        });
      }

      // Verification Pipeline Phase 1: Verifying State
      targetTask.status = 'Verifying';
      targetTask.verificationState = 'VerifyingSize';
      this.upsertQueueTask(targetTask);
      this.logFn('info', `🔍 [Verification Pipeline] Verifying transfer completeness for ${targetTask.dest}...`);

      const verifyCheck = await this.checkConflict(targetTask.type, targetTask.type === 'download' ? targetTask.dest : targetTask.source, targetTask.type === 'download' ? targetTask.source : targetTask.dest, session);
      const destStat = targetTask.type === 'download' ? verifyCheck.localStat : verifyCheck.remoteStat;
      const srcStat = targetTask.type === 'download' ? verifyCheck.remoteStat : verifyCheck.localStat;

      if (srcStat && destStat && srcStat.size > 0 && destStat.size !== srcStat.size) {
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
      if (targetTask.status !== 'Cancelled') {
        targetTask.status = 'Waiting to Resume';
        targetTask.speed = '0 KB/s';
        if (!targetTask.resumeOffset && targetTask.bytesTransferred) {
          targetTask.resumeOffset = targetTask.bytesTransferred;
        }
      }
      this.upsertQueueTask(targetTask);
      throw err;
    }
  }
}

module.exports = TransferEngine;
