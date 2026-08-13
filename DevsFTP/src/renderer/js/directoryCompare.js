/**
 * DevsFTP Directory Comparison Engine
 * Compares active Local Directory files against Remote Directory files
 * and computes visual diff metrics (missing, size mismatch, newer/older).
 */

window.DirectoryCompare = {
  active: false,
  filterMode: 'all', // 'all' | 'diff_only'
  diffMap: new Map(), // map filename -> { status, badge, class, sizeDiff, mtimeDiff }
  summary: {
    total: 0,
    diffCount: 0,
    localOnlyCount: 0,
    remoteOnlyCount: 0,
    sizeMismatchCount: 0,
    localNewerCount: 0,
    remoteNewerCount: 0
  },

  toggleCompare() {
    if (this.active) {
      this.clear();
    } else {
      this.compare();
    }
  },

  clear() {
    this.active = false;
    this.diffMap.clear();
    this.summary = {
      total: 0,
      diffCount: 0,
      localOnlyCount: 0,
      remoteOnlyCount: 0,
      sizeMismatchCount: 0,
      localNewerCount: 0,
      remoteNewerCount: 0
    };

    const bar = document.getElementById('dir-compare-bar');
    if (bar) bar.style.display = 'none';

    const btn = document.getElementById('btn-dir-compare');
    if (btn) {
      btn.classList.remove('active');
      btn.style.background = '';
    }

    if (window.FileBrowser) {
      window.FileBrowser.renderLocalTable(window.FileBrowser.localFiles);
      window.FileBrowser.renderRemoteTable(window.FileBrowser.remoteFiles);
    }
  },

  compare() {
    if (!window.FileBrowser) return;

    const localFiles = window.FileBrowser.localFiles || [];
    const remoteFiles = window.FileBrowser.remoteFiles || [];

    this.diffMap.clear();
    this.summary = {
      total: 0,
      diffCount: 0,
      localOnlyCount: 0,
      remoteOnlyCount: 0,
      sizeMismatchCount: 0,
      localNewerCount: 0,
      remoteNewerCount: 0
    };

    const localMap = new Map();
    const remoteMap = new Map();

    localFiles.forEach(f => {
      if (f.name === '..' || f.name === '.') return;
      localMap.set(f.name.toLowerCase(), f);
    });

    remoteFiles.forEach(f => {
      if (f.name === '..' || f.name === '.') return;
      remoteMap.set(f.name.toLowerCase(), f);
    });

    const allNames = new Set([...localMap.keys(), ...remoteMap.keys()]);
    this.summary.total = allNames.size;

    allNames.forEach(key => {
      const loc = localMap.get(key);
      const rem = remoteMap.get(key);

      const name = (loc ? loc.name : rem.name);

      if (loc && !rem) {
        this.diffMap.set(name, {
          status: 'local_only',
          badge: 'Local Only',
          badgeClass: 'badge-local-only',
          rowClass: 'diff-row-local-only',
          side: 'local'
        });
        this.summary.localOnlyCount++;
        this.summary.diffCount++;
      } else if (!loc && rem) {
        this.diffMap.set(name, {
          status: 'remote_only',
          badge: 'Remote Only',
          badgeClass: 'badge-remote-only',
          rowClass: 'diff-row-remote-only',
          side: 'remote'
        });
        this.summary.remoteOnlyCount++;
        this.summary.diffCount++;
      } else if (loc && rem) {
        // Both exist - compare files (skip directories comparison for size)
        if (!loc.isDirectory && !rem.isDirectory) {
          const locSize = loc.size || 0;
          const remSize = rem.size || 0;
          const locTime = loc.mtime ? new Date(loc.mtime).getTime() : 0;
          const remTime = rem.mtime ? new Date(rem.mtime).getTime() : 0;

          const sizeDiff = locSize !== remSize;
          const timeDiffSeconds = Math.abs(locTime - remTime) / 1000;
          const timeIsSignificant = timeDiffSeconds > 2; // > 2s difference

          if (sizeDiff && timeIsSignificant) {
            if (locTime > remTime) {
              this.diffMap.set(name, {
                status: 'local_newer',
                badge: 'Local Newer',
                badgeClass: 'badge-local-newer',
                rowClass: 'diff-row-local-newer',
                side: 'both'
              });
              this.summary.localNewerCount++;
            } else {
              this.diffMap.set(name, {
                status: 'remote_newer',
                badge: 'Remote Newer',
                badgeClass: 'badge-remote-newer',
                rowClass: 'diff-row-remote-newer',
                side: 'both'
              });
              this.summary.remoteNewerCount++;
            }
            this.summary.diffCount++;
          } else if (sizeDiff) {
            this.diffMap.set(name, {
              status: 'size_mismatch',
              badge: 'Size Mismatch',
              badgeClass: 'badge-size-mismatch',
              rowClass: 'diff-row-mismatch',
              side: 'both'
            });
            this.summary.sizeMismatchCount++;
            this.summary.diffCount++;
          } else if (timeIsSignificant) {
            if (locTime > remTime) {
              this.diffMap.set(name, {
                status: 'local_newer',
                badge: 'Local Newer',
                badgeClass: 'badge-local-newer',
                rowClass: 'diff-row-local-newer',
                side: 'both'
              });
              this.summary.localNewerCount++;
            } else {
              this.diffMap.set(name, {
                status: 'remote_newer',
                badge: 'Remote Newer',
                badgeClass: 'badge-remote-newer',
                rowClass: 'diff-row-remote-newer',
                side: 'both'
              });
              this.summary.remoteNewerCount++;
            }
            this.summary.diffCount++;
          }
        }
      }
    });

    this.active = true;
    this.updateBar();

    const btn = document.getElementById('btn-dir-compare');
    if (btn) {
      btn.classList.add('active');
      btn.style.background = 'rgba(245, 158, 11, 0.2)';
    }

    if (window.FileBrowser) {
      window.FileBrowser.renderLocalTable(window.FileBrowser.localFiles);
      window.FileBrowser.renderRemoteTable(window.FileBrowser.remoteFiles);
    }
  },

  updateBar() {
    let bar = document.getElementById('dir-compare-bar');
    if (!bar) return;

    bar.style.display = 'flex';
    const textEl = document.getElementById('dir-compare-text');
    if (textEl) {
      if (this.summary.diffCount === 0) {
        textEl.innerHTML = `<strong style="color: #10B981;">✓ Identical Directories!</strong> No file size or timestamp differences detected.`;
      } else {
        textEl.innerHTML = `<strong style="color: #F59E0B;">🔍 ${this.summary.diffCount} Difference(s) Found:</strong> ` +
          `<span style="color: #34D399; margin-left: 6px;">Local Only/Newer: ${this.summary.localOnlyCount + this.summary.localNewerCount}</span> | ` +
          `<span style="color: #60A5FA; margin-left: 6px;">Remote Only/Newer: ${this.summary.remoteOnlyCount + this.summary.remoteNewerCount}</span> | ` +
          `<span style="color: #FBBF24; margin-left: 6px;">Size Mismatches: ${this.summary.sizeMismatchCount}</span>`;
      }
    }
  },

  initModalEvents() {
    const btnClose = document.getElementById('btn-dir-compare-modal-close');
    const btnOk = document.getElementById('btn-dir-compare-modal-ok');
    const btnSync = document.getElementById('btn-dir-compare-modal-sync');
    const chkSelectAll = document.getElementById('dir-compare-select-all');

    if (btnClose) btnClose.onclick = () => this.closeCompareSummaryModal();
    if (btnOk) btnOk.onclick = () => this.closeCompareSummaryModal();
    if (btnSync) btnSync.onclick = () => this.syncSelectedFiles();

    if (chkSelectAll) {
      chkSelectAll.onchange = (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.dir-compare-chk').forEach(chk => {
          chk.checked = checked;
        });
      };
    }
  },

  syncSelectedFiles() {
    const selectedRows = document.querySelectorAll('.dir-compare-chk:checked');
    if (selectedRows.length === 0) {
      this.closeCompareSummaryModal();
      return;
    }

    let count = 0;
    selectedRows.forEach(chk => {
      const fileName = chk.getAttribute('data-name');
      const status = chk.getAttribute('data-status');
      if (!fileName || !window.FileBrowser) return;

      const baseLocal = window.FileBrowser.localPath.endsWith('\\') ? window.FileBrowser.localPath.slice(0, -1) : window.FileBrowser.localPath;
      const baseRemote = window.FileBrowser.remotePath.endsWith('/') ? window.FileBrowser.remotePath.slice(0, -1) : window.FileBrowser.remotePath;

      const localFile = `${baseLocal}\\${fileName}`;
      const remoteFile = `${baseRemote}/${fileName}`;

      if (status === 'local_only' || status === 'local_newer') {
        window.FileBrowser.uploadFile(localFile, remoteFile);
        count++;
      } else if (status === 'remote_only' || status === 'remote_newer') {
        window.FileBrowser.downloadFile(remoteFile, localFile);
        count++;
      } else {
        window.FileBrowser.downloadFile(remoteFile, localFile);
        count++;
      }
    });

    if (window.LogViewer) {
      window.LogViewer.addEntry('info', `⚡ Queued ${count} directory sync transfer(s) from modal.`);
    }

    this.closeCompareSummaryModal();

    if (window.TransferQueue && window.TransferQueue.goToTransferQueue) {
      window.TransferQueue.goToTransferQueue();
    }
  },

  setFilter(mode) {
    this.filterMode = mode;
    document.querySelectorAll('.diff-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === mode);
    });
    if (window.FileBrowser) {
      window.FileBrowser.renderLocalTable(window.FileBrowser.localFiles);
      window.FileBrowser.renderRemoteTable(window.FileBrowser.remoteFiles);
    }
    this.openCompareSummaryModal(mode);
  },

  closeCompareSummaryModal() {
    const modal = document.getElementById('dir-compare-modal');
    if (modal) modal.classList.remove('active');
  },

  openCompareSummaryModal(mode = 'all') {
    const modal = document.getElementById('dir-compare-modal');
    const title = document.getElementById('dir-compare-modal-title');
    const summaryContainer = document.getElementById('dir-compare-modal-summary');
    const tbody = document.getElementById('dir-compare-modal-tbody');

    if (!modal) return;
    this.initModalEvents();

    if (mode === 'diff_only') {
      if (title) title.textContent = '🔍 Directory Comparison — Differences Only';
    } else {
      if (title) title.textContent = '🔍 Directory Comparison — All Files Summary';
    }

    if (summaryContainer) {
      const identicalCount = Math.max(0, this.summary.total - this.summary.diffCount);
      summaryContainer.innerHTML = `
        <div class="detail-item" style="padding: 10px 12px; text-align: center;">
          <span class="detail-label">Total Compared</span>
          <span class="detail-value" style="font-size: 16px; font-weight: 700; color: hsl(var(--text-primary));">${this.summary.total}</span>
        </div>
        <div class="detail-item" style="padding: 10px 12px; text-align: center;">
          <span class="detail-label">Differences</span>
          <span class="detail-value" style="font-size: 16px; font-weight: 700; color: #F59E0B;">${this.summary.diffCount}</span>
        </div>
        <div class="detail-item" style="padding: 10px 12px; text-align: center;">
          <span class="detail-label">Identical</span>
          <span class="detail-value" style="font-size: 16px; font-weight: 700; color: #10B981;">${identicalCount}</span>
        </div>
      `;
    }

    if (tbody) {
      tbody.innerHTML = '';
      const itemsToDisplay = [];

      this.diffMap.forEach((info, name) => {
        if (mode === 'diff_only' && !info) return;
        itemsToDisplay.push({ name, ...info });
      });

      if (itemsToDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: hsl(var(--text-muted)); padding: 20px;">No ${mode === 'diff_only' ? 'differing' : ''} files found. Directories are identical.</td></tr>`;
      } else {
        itemsToDisplay.forEach(item => {
          const tr = document.createElement('tr');
          let bg = 'rgba(100, 116, 139, 0.15)';
          let fg = '#94A3B8';

          if (item.status === 'local_only' || item.status === 'local_newer') {
            bg = 'rgba(16, 185, 129, 0.15)';
            fg = '#34D399';
          } else if (item.status === 'remote_only' || item.status === 'remote_newer') {
            bg = 'rgba(14, 165, 233, 0.15)';
            fg = '#38BDF8';
          } else if (item.status === 'size_mismatch') {
            bg = 'rgba(245, 158, 11, 0.15)';
            fg = '#FBBF24';
          }

          const isDiff = item.status && item.status !== 'identical';
          const chkAttr = isDiff ? 'checked' : '';

          tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="dir-compare-chk" data-name="${item.name}" data-status="${item.status || ''}" ${chkAttr}></td>
            <td style="font-weight: 600; font-family: var(--font-mono); font-size: 11px;">${item.name}</td>
            <td><span class="tag-badge" style="background-color: ${bg}; color: ${fg}; font-weight: 600;">${item.badge || 'Identical'}</span></td>
            <td style="font-size: 11px; font-family: var(--font-mono);">${item.side === 'remote' ? '-' : 'Present'}</td>
            <td style="font-size: 11px; font-family: var(--font-mono);">${item.side === 'local' ? '-' : 'Present'}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    modal.classList.add('active');
  },

  getDiffInfo(filename) {
    if (!this.active) return null;
    return this.diffMap.get(filename) || null;
  }
};
