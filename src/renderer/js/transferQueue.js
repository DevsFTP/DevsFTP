/**
 * Interactive Transfer Queue Component for DevsFTP
 * Manages transfer state machine, progress bars, speed metrics (KB/s, MB/s),
 * active task table with non-strobing row actions (Pause, Resume, Cancel, Retry, Reorder),
 * bulk controls (Pause All, Resume All, Cancel All), and auto-resume of interrupted transfers.
 */

window.TransferQueue = {
  queue: [],
  tbody: null,
  badge: null,
  speedIndicator: null,
  contextItem: null,
  batchNotifyCount: 0,
  batchNotifyTimer: null,
  lastSingleFile: null,
  cancelledIds: new Set(),
  batchCancelled: false,

  async init() {
    this.tbody = document.getElementById('queue-tbody');
    this.badge = document.getElementById('queue-badge');
    this.speedIndicator = document.getElementById('speed-indicator');

    // Toolbar Event Listeners
    const btnClear = document.getElementById('btn-clear-queue');
    const btnPauseAll = document.getElementById('btn-queue-pause-all');
    const btnResumeAll = document.getElementById('btn-queue-resume-all');
    const btnCancelAll = document.getElementById('btn-queue-cancel-all');

    if (btnClear) btnClear.addEventListener('click', () => this.clearCompleted());
    if (btnPauseAll) btnPauseAll.addEventListener('click', () => this.pauseAll());
    if (btnResumeAll) btnResumeAll.addEventListener('click', () => this.resumeAll());
    if (btnCancelAll) btnCancelAll.addEventListener('click', () => this.cancelAll());

    // Context Menu Item Action Listeners
    const qctxPause = document.getElementById('qctx-pause');
    const qctxResume = document.getElementById('qctx-resume');
    const qctxCancel = document.getElementById('qctx-cancel');
    const qctxRetry = document.getElementById('qctx-retry');
    const qctxUp = document.getElementById('qctx-move-up');
    const qctxDown = document.getElementById('qctx-move-down');
    const qctxRemove = document.getElementById('qctx-remove');

    if (qctxPause) qctxPause.addEventListener('click', () => this.handleContextAction('pause'));
    if (qctxResume) qctxResume.addEventListener('click', () => this.handleContextAction('resume'));
    if (qctxCancel) qctxCancel.addEventListener('click', () => this.handleContextAction('cancel'));
    if (qctxRetry) qctxRetry.addEventListener('click', () => this.handleContextAction('retry'));
    if (qctxUp) qctxUp.addEventListener('click', () => this.handleContextAction('move-up'));
    if (qctxDown) qctxDown.addEventListener('click', () => this.handleContextAction('move-down'));
    if (qctxRemove) qctxRemove.addEventListener('click', () => this.handleContextAction('remove'));

    // Global click listener to hide queue context menu
    document.addEventListener('click', (e) => {
      if (e.target.closest('#queue-context-menu')) return;
      const qMenu = document.getElementById('queue-context-menu');
      if (qMenu) qMenu.style.display = 'none';
    });

    // Interrupted Transfer Alert Modal Event Listeners
    const btnIntClose = document.getElementById('btn-interrupted-close');
    const btnIntDismiss = document.getElementById('btn-interrupted-dismiss');
    const btnIntGoto = document.getElementById('btn-interrupted-goto-queue');

    if (btnIntClose) btnIntClose.addEventListener('click', () => this.closeInterruptedModal());
    if (btnIntDismiss) btnIntDismiss.addEventListener('click', () => this.dismissInterrupted());
    if (btnIntGoto) btnIntGoto.addEventListener('click', () => this.goToTransferQueue());

    // Listen to main process streaming transfer progress events
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.onTransferProgress) {
      api.onTransferProgress((data) => this.handleProgress(data));
    }

    await this.loadSavedQueue();
  },

  async loadSavedQueue() {
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.getQueue) {
      try {
        const saved = await api.getQueue();
        if (saved && Array.isArray(saved) && saved.length > 0) {
          this.queue = saved.map(item => ({
            percentage: 0,
            transferred: item.resumeOffset || 0,
            total: item.totalBytes || 1,
            speed: '0 KB/s',
            status: item.status || 'Waiting to Resume',
            startTime: Date.now(),
            lastTransferred: item.resumeOffset || 0,
            lastTime: Date.now(),
            ...item
          }));
          this.render();
          this.checkAndShowInterruptedModal();
        }
      } catch (e) {}
    }
  },

  checkAndShowInterruptedModal() {
    const pending = this.queue.filter(q => q.status === 'Waiting to Resume');
    if (pending.length === 0) return;

    const modal = document.getElementById('interrupted-transfer-modal');
    const msg = document.getElementById('interrupted-modal-msg');
    if (!modal) return;

    if (msg) {
      msg.textContent = `${pending.length} file transfer(s) were interrupted during a previous session. They are currently saved in "Waiting to Resume" state in your Transfer Queue.`;
    }

    modal.classList.add('active');
  },

  closeInterruptedModal() {
    const modal = document.getElementById('interrupted-transfer-modal');
    if (modal) modal.classList.remove('active');
  },

  async dismissInterrupted() {
    const count = this.queue.filter(q => q.status === 'Waiting to Resume').length;
    this.queue = this.queue.filter(q => q.status !== 'Waiting to Resume');
    this.render();
    this.closeInterruptedModal();
    if (count > 0 && window.LogViewer) {
      window.LogViewer.addEntry('warning', `🚫 Dismissed ${count} interrupted transfer task(s).`);
    }
    await this.syncQueue();
  },

  async syncQueue() {
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.saveQueue) {
      try {
        await api.saveQueue(this.queue);
      } catch (e) {}
    }
  },

  goToTransferQueue() {
    this.closeInterruptedModal();
    const tabBtn = document.querySelector('button.drawer-tab[data-tab="tab-queue"]');
    if (tabBtn) tabBtn.click();

    const drawer = document.getElementById('bottom-drawer');
    if (drawer && drawer.classList.contains('collapsed')) {
      drawer.classList.remove('collapsed');
    }
  },

  autoResumeInterrupted() {
    const pending = this.queue.filter(q => q.status === 'Waiting to Resume');
    if (pending.length === 0) return;

    if (window.LogViewer) {
      window.LogViewer.addEntry('info', `⏳ Auto-resuming ${pending.length} interrupted transfer(s) from previous session...`);
    }

    pending.forEach(item => {
      if (window.FileBrowser) {
        if (item.type === 'download') {
          window.FileBrowser.downloadFile(item.source, item.dest, { resume: true, resumeOffset: item.resumeOffset });
        } else if (item.type === 'upload') {
          window.FileBrowser.uploadFile(item.source, item.dest, { resume: true, resumeOffset: item.resumeOffset });
        }
      }
    });
  },

  addTransfer(type, sourcePath, destPath) {
    this.resetCancellationState();
    const existing = this.queue.find(q => q.source === sourcePath && q.dest === destPath && q.status !== 'Completed');
    if (existing) {
      existing.status = 'In Progress';
      this.render();
      return existing.id;
    }
    const id = 'tr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const item = {
      id,
      type, // 'download' or 'upload'
      source: sourcePath,
      dest: destPath,
      percentage: 0,
      transferred: 0,
      total: 1,
      speed: '0 KB/s',
      status: 'In Progress', // 'In Progress' | 'Paused' | 'Queued' | 'Waiting to Resume' | 'Verifying' | 'Completed' | 'Failed' | 'Cancelled'
      startTime: Date.now(),
      lastTransferred: 0,
      lastTime: Date.now()
    };
    this.queue.push(item);
    this.render();
    return id;
  },

  getItem(id) {
    return this.queue.find(q => q.id === id) || null;
  },

  getItemIndex(id) {
    return this.queue.findIndex(q => q.id === id);
  },

  pauseTransfer(id) {
    const item = this.getItem(id);
    if (item && (item.status === 'In Progress' || item.status === 'Queued')) {
      item.status = 'Paused';
      item.speed = '0 KB/s';
      if (window.LogViewer) window.LogViewer.addEntry('warning', `⏸️ Transfer paused: ${item.source}`);
      this.render();
      this.syncQueue();
    }
  },

  resumeTransfer(id) {
    const item = this.getItem(id);
    if (item && (item.status === 'Paused' || item.status === 'Waiting to Resume')) {
      item.status = 'In Progress';
      item.lastTime = Date.now();
      if (window.LogViewer) window.LogViewer.addEntry('info', `▶️ Transfer resumed: ${item.source}`);
      this.render();
      this.syncQueue();
      if (window.FileBrowser) {
        if (item.type === 'download') {
          window.FileBrowser.downloadFile(item.source, item.dest, { resume: true, resumeOffset: item.resumeOffset || item.transferred });
        } else if (item.type === 'upload') {
          window.FileBrowser.uploadFile(item.source, item.dest, { resume: true, resumeOffset: item.resumeOffset || item.transferred });
        }
      }
    }
  },

  cancelTransfer(id) {
    const item = this.getItem(id);
    if (item && item.status !== 'Completed' && item.status !== 'Cancelled') {
      item.status = 'Cancelled';
      item.speed = '0 KB/s';
      this.cancelledIds.add(id);
      if (window.LogViewer) window.LogViewer.addEntry('error', `⏹️ Transfer cancelled: ${item.source}`);
      this.render();
      this.syncQueue();
    }
  },

  retryTransfer(id) {
    const item = this.getItem(id);
    if (item && (item.status === 'Cancelled' || item.status === 'Failed' || item.status === 'Paused' || item.status === 'Waiting to Resume')) {
      item.status = 'In Progress';
      item.speed = '0 KB/s';
      item.lastTime = Date.now();

      if (window.LogViewer) window.LogViewer.addEntry('info', `🔄 Retrying transfer: ${item.source}`);
      this.render();
      this.syncQueue();

      if (window.FileBrowser) {
        if (item.type === 'download') {
          window.FileBrowser.downloadFile(item.source, item.dest, { resume: true, resumeOffset: item.resumeOffset || item.transferred });
        } else if (item.type === 'upload') {
          window.FileBrowser.uploadFile(item.source, item.dest, { resume: true, resumeOffset: item.resumeOffset || item.transferred });
        }
      }
    }
  },

  async removeTransfer(id) {
    const idx = this.getItemIndex(id);
    if (idx !== -1) {
      const item = this.queue.splice(idx, 1)[0];
      this.render();
      const api = window.devsFTP || window.pulseFTP;
      if (api && api.removeItemFromQueue) {
        try {
          await api.removeItemFromQueue(id);
        } catch (e) {}
      } else {
        await this.syncQueue();
      }
      if (item && window.LogViewer) {
        window.LogViewer.addEntry('info', `🗑 Removed transfer item: ${item.source}`);
      }
    }
  },

  async moveUp(id) {
    const idx = this.getItemIndex(id);
    if (idx > 0) {
      const temp = this.queue[idx];
      this.queue[idx] = this.queue[idx - 1];
      this.queue[idx - 1] = temp;
      this.render();
      await this.syncQueue();
    }
  },

  async moveDown(id) {
    const idx = this.getItemIndex(id);
    if (idx !== -1 && idx < this.queue.length - 1) {
      const temp = this.queue[idx];
      this.queue[idx] = this.queue[idx + 1];
      this.queue[idx + 1] = temp;
      this.render();
      await this.syncQueue();
    }
  },

  pauseAll() {
    let count = 0;
    this.queue.forEach(item => {
      if (item.status === 'In Progress' || item.status === 'Queued') {
        item.status = 'Paused';
        item.speed = '0 KB/s';
        count++;
      }
    });
    if (count > 0 && window.LogViewer) window.LogViewer.addEntry('warning', `⏸️ Paused ${count} active transfer(s).`);
    this.render();
    this.syncQueue();
  },

  resumeAll() {
    let count = 0;
    this.queue.forEach(item => {
      if (item.status === 'Paused' || item.status === 'Waiting to Resume') {
        this.resumeTransfer(item.id);
        count++;
      }
    });
    if (count > 0 && window.LogViewer) window.LogViewer.addEntry('info', `▶️ Resumed ${count} paused transfer(s).`);
    this.syncQueue();
  },

  cancelAll() {
    let count = 0;
    this.batchCancelled = true;
    this.queue.forEach(item => {
      if (item.status === 'In Progress' || item.status === 'Paused' || item.status === 'Queued' || item.status === 'Waiting to Resume') {
        item.status = 'Cancelled';
        item.speed = '0 KB/s';
        this.cancelledIds.add(item.id);
        count++;
      }
    });
    if (count > 0 && window.LogViewer) window.LogViewer.addEntry('error', `⏹️ Cancelled ${count} transfer task(s).`);
    this.render();
    this.syncQueue();
  },

  async clearCompleted() {
    this.queue = this.queue.filter(q => q.status === 'In Progress' || q.status === 'Paused' || q.status === 'Queued' || q.status === 'Waiting to Resume');
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.clearCompletedQueue) {
      await api.clearCompletedQueue();
    }
    this.render();
  },

  handleProgress(data) {
    let item = null;
    if (data.taskId) {
      item = this.queue.find(q => q.id === data.taskId);
    }
    if (!item) {
      item = this.queue.find(q => 
        (q.source === data.remotePath || q.source === data.localPath || q.dest === data.localPath || q.dest === data.remotePath) &&
        (q.status === 'In Progress' || q.status === 'Running' || q.status === 'Waiting to Resume')
      );
    }

    if (item) {
      item.status = 'In Progress';
      const now = Date.now();
      const timeDiff = (now - item.lastTime) / 1000;
      if (timeDiff >= 0.5) {
        const bytesDiff = data.transferred - item.lastTransferred;
        const bps = bytesDiff / timeDiff;
        item.speed = this.formatSpeed(bps);
        item.lastTransferred = data.transferred;
        item.lastTime = now;
      }

      item.percentage = data.percentage;
      item.transferred = data.transferred;
      item.total = data.total;

      if (data.percentage >= 100) {
        if (item.status !== 'Completed') {
          item.status = 'Completed';
          item.speed = '0 KB/s';
          this.notifyCompletion(item);
        }
      }

      this.render();
    }
  },

  formatSpeed(bytesPerSec) {
    if (bytesPerSec > 1024 * 1024) {
      return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
    }
    return (bytesPerSec / 1024).toFixed(0) + ' KB/s';
  },

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  },

  getStatusBadge(status) {
    let bg = 'hsl(var(--accent-primary) / 0.2)';
    let fg = 'hsl(var(--accent-primary))';
    let label = status;

    if (status === 'Completed') {
      bg = 'rgba(16, 185, 129, 0.2)';
      fg = '#34D399';
    } else if (status === 'Verifying') {
      bg = 'rgba(14, 165, 233, 0.25)';
      fg = '#38BDF8';
      label = 'Verifying... 🔍';
    } else if (status === 'Waiting to Resume') {
      bg = 'rgba(245, 158, 11, 0.25)';
      fg = '#FBBF24';
      label = 'Waiting to Resume ⏳';
    } else if (status === 'Paused') {
      bg = 'rgba(245, 158, 11, 0.2)';
      fg = '#FBBF24';
    } else if (status === 'Cancelled' || status === 'Failed') {
      bg = 'rgba(239, 68, 68, 0.2)';
      fg = '#FCA5A5';
    } else if (status === 'Queued') {
      bg = 'rgba(100, 116, 139, 0.2)';
      fg = '#94A3B8';
    }

    return `<span class="tag-badge" style="background-color: ${bg}; color: ${fg}; font-weight: 600;">${label}</span>`;
  },

  showContextMenu(x, y, item) {
    this.contextItem = item;
    const menu = document.getElementById('queue-context-menu');
    if (!menu) return;
    menu.style.display = 'block';
    const menuWidth = menu.offsetWidth || 160;
    const menuHeight = menu.offsetHeight || 200;
    const posX = (x + menuWidth > window.innerWidth) ? Math.max(10, window.innerWidth - menuWidth - 10) : x;
    const posY = (y + menuHeight > window.innerHeight) ? Math.max(10, window.innerHeight - menuHeight - 10) : y;
    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
  },

  hideContextMenu() {
    const menu = document.getElementById('queue-context-menu');
    if (menu) menu.style.display = 'none';
  },

  handleContextAction(action) {
    if (!this.contextItem) return;
    const id = this.contextItem.id;
    if (action === 'pause') this.pauseTransfer(id);
    else if (action === 'resume') this.resumeTransfer(id);
    else if (action === 'cancel') this.cancelTransfer(id);
    else if (action === 'retry') this.retryTransfer(id);
    else if (action === 'move-up') this.moveUp(id);
    else if (action === 'move-down') this.moveDown(id);
    else if (action === 'remove') this.removeTransfer(id);
    this.hideContextMenu();
  },

  generateActionButtons(item) {
    if (item.status === 'In Progress' || item.status === 'Queued') {
      return `
        <button class="btn btn-qaction" title="Pause Transfer" onclick="window.TransferQueue.pauseTransfer('${item.id}')" style="padding: 2px 8px; font-size: 10px;">⏸ Pause</button>
        <button class="btn btn-danger btn-qaction" title="Cancel Transfer" onclick="window.TransferQueue.cancelTransfer('${item.id}')" style="padding: 2px 8px; font-size: 10px; margin-left: 4px;">⏹ Cancel</button>
      `;
    } else if (item.status === 'Paused' || item.status === 'Waiting to Resume') {
      return `
        <button class="btn btn-primary btn-qaction" title="Resume Transfer" onclick="window.TransferQueue.resumeTransfer('${item.id}')" style="padding: 2px 8px; font-size: 10px;">▶ Resume</button>
        <button class="btn btn-danger btn-qaction" title="Cancel Transfer" onclick="window.TransferQueue.cancelTransfer('${item.id}')" style="padding: 2px 8px; font-size: 10px; margin-left: 4px;">⏹ Cancel</button>
      `;
    } else if (item.status === 'Cancelled' || item.status === 'Failed') {
      return `
        <button class="btn btn-primary btn-qaction" title="Retry Transfer" onclick="window.TransferQueue.retryTransfer('${item.id}')" style="padding: 2px 8px; font-size: 10px;">🔄 Retry</button>
        <button class="btn btn-danger btn-qaction" title="Delete Transfer" onclick="window.TransferQueue.removeTransfer('${item.id}')" style="padding: 2px 8px; font-size: 10px; margin-left: 4px;">🗑 Delete</button>
      `;
    } else if (item.status === 'Completed') {
      return `
        <button class="btn btn-danger btn-qaction" title="Delete Completed Item" onclick="window.TransferQueue.removeTransfer('${item.id}')" style="padding: 2px 8px; font-size: 10px;">🗑 Delete</button>
      `;
    }
    return '';
  },

  /**
   * Smart Non-Strobing DOM Table Renderer
   */
  render() {
    if (!this.tbody) return;

    const activeCount = this.queue.filter(q => q.status === 'In Progress' || q.status === 'Queued' || q.status === 'Waiting to Resume').length;
    if (this.badge) this.badge.textContent = activeCount;

    if (this.queue.length === 0) {
      this.tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: hsl(var(--text-muted)); padding: 16px;">Queue is empty.</td></tr>';
      if (this.speedIndicator) this.speedIndicator.textContent = '▲ 0 KB/s | ▼ 0 KB/s';
      return;
    }

    // Clear empty row message if present
    const firstRow = this.tbody.querySelector('tr');
    if (firstRow && firstRow.children.length === 1) {
      this.tbody.innerHTML = '';
    }

    // Update bottom status bar total transfer speed metrics
    const totalSpeedBps = this.queue
      .filter(q => q.status === 'In Progress')
      .reduce((sum, item) => {
        if (item.speed.includes('MB/s')) return sum + parseFloat(item.speed) * 1024 * 1024;
        if (item.speed.includes('KB/s')) return sum + parseFloat(item.speed) * 1024;
        return sum;
      }, 0);

    const formattedTotalSpeed = this.formatSpeed(totalSpeedBps);
    if (this.speedIndicator) {
      const isUpload = this.queue.some(q => q.type === 'upload' && q.status === 'In Progress');
      this.speedIndicator.textContent = isUpload ? `▲ ${formattedTotalSpeed} | ▼ 0 KB/s` : `▲ 0 KB/s | ▼ ${formattedTotalSpeed}`;
    }

    const currentItemIds = new Set(this.queue.map(q => q.id));

    // Remove rows no longer in queue
    Array.from(this.tbody.children).forEach(tr => {
      const id = tr.getAttribute('data-id');
      if (id && !currentItemIds.has(id)) {
        tr.remove();
      }
    });

    // Targeted DOM updates per row (prevents action button hover strobing)
    this.queue.forEach(item => {
      let tr = this.tbody.querySelector(`tr[data-id="${item.id}"]`);
      const arrow = item.type === 'download' ? '⬇' : '⬆';

      if (!tr) {
        tr = document.createElement('tr');
        tr.setAttribute('data-id', item.id);
        tr.setAttribute('data-status', item.status);

        tr.innerHTML = `
          <td style="font-weight: 600;">${arrow} ${item.type.toUpperCase()}</td>
          <td style="font-family: var(--font-mono); font-size: 11px;" title="${item.source}">${item.source}</td>
          <td style="font-family: var(--font-mono); font-size: 11px;" title="${item.dest}">${item.dest}</td>
          <td style="width: 140px;">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${item.percentage}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
              <span class="progress-percent" style="font-size: 10px; color: hsl(var(--text-muted));">${item.percentage}%</span>
              ${item.resumeOffset ? `<span style="font-size: 9px; color: var(--accent-primary-hex, #F59E0B); font-family: var(--font-mono);">Resumed ${this.formatBytes(item.resumeOffset)}</span>` : ''}
            </div>
          </td>
          <td class="speed-cell" style="font-family: var(--font-mono); font-size: 11px;">${item.speed}</td>
          <td class="status-cell">${this.getStatusBadge(item.status)}</td>
          <td style="text-align: center; white-space: nowrap;">
            <div class="actions-cell" style="display: flex; gap: 4px; justify-content: center;">
              ${this.generateActionButtons(item)}
            </div>
          </td>
        `;

        tr.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showContextMenu(e.clientX, e.clientY, item);
        });

        this.tbody.appendChild(tr);
      } else {
        // Targeted updates without replacing action buttons DOM
        const fill = tr.querySelector('.progress-bar-fill');
        if (fill) fill.style.width = `${item.percentage}%`;

        const percent = tr.querySelector('.progress-percent');
        if (percent) percent.textContent = `${item.percentage}%`;

        const speedCell = tr.querySelector('.speed-cell');
        if (speedCell) speedCell.textContent = item.speed;

        const statusCell = tr.querySelector('.status-cell');
        if (statusCell) statusCell.innerHTML = this.getStatusBadge(item.status);

        // Update action buttons only if status state changes
        if (tr.getAttribute('data-status') !== item.status) {
          tr.setAttribute('data-status', item.status);
          const actionsCell = tr.querySelector('.actions-cell');
          if (actionsCell) actionsCell.innerHTML = this.generateActionButtons(item);
        }
      }
    });
  },

  isCancelled(id) {
    return this.cancelledIds.has(id);
  },

  isBatchCancelled() {
    return this.batchCancelled;
  },

  resetCancellationState() {
    // Only reset if we don't have any in-progress or queued tasks (Issue 12.2)
    const hasActiveTasks = this.queue.some(q => q.status === 'In Progress' || q.status === 'Running' || q.status === 'Queued');
    if (!hasActiveTasks) {
      this.batchCancelled = false;
      this.cancelledIds.clear();
    }
  },

  notifyCompletion(item) {
    this.batchNotifyCount++;
    this.lastSingleFile = item;

    if (this.batchNotifyTimer) {
      clearTimeout(this.batchNotifyTimer);
    }

    this.batchNotifyTimer = setTimeout(() => {
      this.flushBatchNotification();
    }, 1200);
  },

  flushBatchNotification() {
    const count = this.batchNotifyCount;
    const item = this.lastSingleFile;
    this.batchNotifyCount = 0;
    this.batchNotifyTimer = null;
    this.lastSingleFile = null;

    if (count === 0 || !item) return;

    const notifyPref = localStorage.getItem('devsftp_pref_notify_transfers');
    const chimePref = localStorage.getItem('devsftp_pref_notify_chime');

    const shouldNotify = notifyPref === null || notifyPref === 'true';
    const shouldChime = chimePref === null || chimePref === 'true';

    const fileName = item.source ? item.source.split(/[/\\]/).pop() : 'file';
    const actionText = item.type === 'download' ? 'downloaded' : 'uploaded';

    let title = 'Transfer Complete';
    let body = `Successfully ${actionText} ${fileName}`;

    if (count > 1) {
      title = 'Batch Transfer Complete';
      body = `Successfully transferred ${count} files.`;
    }

    if (shouldNotify) {
      const api = window.devsFTP || window.pulseFTP;
      if (api && api.sendOSNotification) {
        api.sendOSNotification(title, body);
      } else if (typeof Notification !== 'undefined') {
        try {
          if (Notification.permission === 'granted') {
            new Notification(title, { body, silent: !shouldChime });
          }
        } catch (e) {}
      }
    }

    if (shouldChime) {
      this.playChimeSound();
    }
  },

  playChimeSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }
};
