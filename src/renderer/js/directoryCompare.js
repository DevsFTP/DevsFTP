/**
 * DevsFTP Directory Comparison Engine
 * Compares active Local Directory files against Remote Directory files
 * and computes visual diff metrics (missing, size mismatch, newer/older)
 * in a side-by-side modal with individual and batch sync controls.
 */

window.DirectoryCompare = {
  active: false,
  diffMap: new Map(), // map filename -> { status, loc, rem }
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
    this.compare();
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
    this.closeCompareSummaryModal();

    // Re-render main file browser tables (removes any comparison badges/classes if left over)
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

    const allNames = Array.from(new Set([...localMap.keys(), ...remoteMap.keys()]));
    allNames.sort(); // Sort alphabetically
    this.summary.total = allNames.length;

    allNames.forEach(key => {
      const loc = localMap.get(key);
      const rem = remoteMap.get(key);
      const name = loc ? loc.name : rem.name;

      let status = 'identical';

      if (loc && !rem) {
        status = 'local_only';
        this.summary.localOnlyCount++;
        this.summary.diffCount++;
      } else if (!loc && rem) {
        status = 'remote_only';
        this.summary.remoteOnlyCount++;
        this.summary.diffCount++;
      } else if (loc && rem) {
        if (loc.isDir || rem.isDir) {
          // Directories with same name are considered identical for comparison simplicity
          status = 'identical';
        } else {
          const locSize = loc.size || 0;
          const remSize = rem.size || 0;
          const locTime = loc.mtime ? new Date(loc.mtime).getTime() : 0;
          const remTime = rem.mtime ? new Date(rem.mtime).getTime() : 0;

          const sizeDiff = locSize !== remSize;
          const timeDiffSeconds = Math.abs(locTime - remTime) / 1000;
          const timeIsSignificant = timeDiffSeconds > 2; // > 2s difference

          if (sizeDiff && timeIsSignificant) {
            if (locTime > remTime) {
              status = 'local_newer';
              this.summary.localNewerCount++;
            } else {
              status = 'remote_newer';
              this.summary.remoteNewerCount++;
            }
            this.summary.diffCount++;
          } else if (sizeDiff) {
            status = 'size_mismatch';
            this.summary.sizeMismatchCount++;
            this.summary.diffCount++;
          } else if (timeIsSignificant) {
            if (locTime > remTime) {
              status = 'local_newer';
              this.summary.localNewerCount++;
            } else {
              status = 'remote_newer';
              this.summary.remoteNewerCount++;
            }
            this.summary.diffCount++;
          }
        }
      }

      this.diffMap.set(name, { status, loc, rem });
    });

    this.active = true;

    // Reset filter dropdown to 'diff_only' when opening modal initially
    const filterSelect = document.getElementById('dir-compare-filter-select');
    if (filterSelect) {
      filterSelect.value = 'diff_only';
    }
    
    this.openCompareSummaryModal('diff_only');
  },

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  },

  formatTime(mtime) {
    if (!mtime) return '';
    const d = new Date(mtime);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  initModalEvents() {
    const btnClose = document.getElementById('btn-dir-compare-modal-close');
    const btnOk = document.getElementById('btn-dir-compare-modal-ok');
    const btnSync = document.getElementById('btn-dir-compare-modal-sync');
    const chkSelectAll = document.getElementById('dir-compare-select-all');
    const filterSelect = document.getElementById('dir-compare-filter-select');

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

    if (filterSelect) {
      filterSelect.onchange = (e) => {
        this.openCompareSummaryModal(e.target.value);
      };
    }
  },

  syncSingle(name, direction) {
    if (!window.FileBrowser) return;

    const baseLocal = window.FileBrowser.localPath.endsWith('\\') ? window.FileBrowser.localPath.slice(0, -1) : window.FileBrowser.localPath;
    const baseRemote = window.FileBrowser.remotePath.endsWith('/') ? window.FileBrowser.remotePath.slice(0, -1) : window.FileBrowser.remotePath;

    const localFile = `${baseLocal}\\${name}`;
    const remoteFile = `${baseRemote}/${name}`;

    if (direction === 'upload') {
      window.FileBrowser.uploadFile(localFile, remoteFile);
      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `⚡ Queued sync upload: "${name}" ➔ remote`);
      }
    } else if (direction === 'download') {
      window.FileBrowser.downloadFile(remoteFile, localFile);
      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `⚡ Queued sync download: remote ➔ "${name}"`);
      }
    }

    // Update status to identical locally
    const item = this.diffMap.get(name);
    if (item) {
      if (item.status !== 'identical') {
        this.summary.diffCount = Math.max(0, this.summary.diffCount - 1);
        if (item.status === 'local_only') this.summary.localOnlyCount = Math.max(0, this.summary.localOnlyCount - 1);
        else if (item.status === 'remote_only') this.summary.remoteOnlyCount = Math.max(0, this.summary.remoteOnlyCount - 1);
        else if (item.status === 'local_newer') this.summary.localNewerCount = Math.max(0, this.summary.localNewerCount - 1);
        else if (item.status === 'remote_newer') this.summary.remoteNewerCount = Math.max(0, this.summary.remoteNewerCount - 1);
        else if (item.status === 'size_mismatch') this.summary.sizeMismatchCount = Math.max(0, this.summary.sizeMismatchCount - 1);
      }
      item.status = 'identical';
    }

    const filterSelect = document.getElementById('dir-compare-filter-select');
    const currentFilter = filterSelect ? filterSelect.value : 'diff_only';
    this.openCompareSummaryModal(currentFilter);

    if (window.TransferQueue && window.TransferQueue.goToTransferQueue) {
      window.TransferQueue.goToTransferQueue();
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
      } else if (status === 'size_mismatch') {
        window.FileBrowser.downloadFile(remoteFile, localFile);
        count++;
      }

      // Mark as identical in memory
      const item = this.diffMap.get(fileName);
      if (item) {
        item.status = 'identical';
      }
    });

    // Recompute counts
    this.summary.diffCount = Math.max(0, this.summary.diffCount - count);
    this.summary.localOnlyCount = 0;
    this.summary.remoteOnlyCount = 0;
    this.summary.localNewerCount = 0;
    this.summary.remoteNewerCount = 0;
    this.summary.sizeMismatchCount = 0;
    this.diffMap.forEach(item => {
      if (item.status === 'local_only') this.summary.localOnlyCount++;
      else if (item.status === 'remote_only') this.summary.remoteOnlyCount++;
      else if (item.status === 'local_newer') this.summary.localNewerCount++;
      else if (item.status === 'remote_newer') this.summary.remoteNewerCount++;
      else if (item.status === 'size_mismatch') this.summary.sizeMismatchCount++;
    });

    if (window.LogViewer) {
      window.LogViewer.addEntry('info', `⚡ Queued ${count} directory sync transfer(s) from modal.`);
    }

    this.closeCompareSummaryModal();

    if (window.TransferQueue && window.TransferQueue.goToTransferQueue) {
      window.TransferQueue.goToTransferQueue();
    }
  },

  closeCompareSummaryModal() {
    const modal = document.getElementById('dir-compare-modal');
    if (modal) modal.classList.remove('active');
  },

  openCompareSummaryModal(mode = 'diff_only') {
    const modal = document.getElementById('dir-compare-modal');
    const title = document.getElementById('dir-compare-modal-title');
    const summaryContainer = document.getElementById('dir-compare-modal-summary');
    const tbody = document.getElementById('dir-compare-modal-tbody');

    if (!modal) return;
    this.initModalEvents();

    if (title) {
      title.textContent = mode === 'diff_only' ? '🔍 Compare Directories — Differences Only' : '🔍 Compare Directories';
    }

    if (summaryContainer) {
      const identicalCount = Math.max(0, this.summary.total - this.summary.diffCount);
      summaryContainer.innerHTML = `
        <span style="color: hsl(var(--text-muted));">Total: <strong>${this.summary.total}</strong></span> |
        <span style="color: #68a063; margin-left: 6px;">Identical: <strong>${identicalCount}</strong></span> |
        <span style="color: #F59E0B; margin-left: 6px;">Differences: <strong>${this.summary.diffCount}</strong></span>
      `;
    }

    if (tbody) {
      tbody.innerHTML = '';
      
      const keys = Array.from(this.diffMap.keys()).sort();
      let rowsRendered = 0;

      keys.forEach(name => {
        const item = this.diffMap.get(name);
        const status = item.status;
        const loc = item.loc;
        const rem = item.rem;

        let show = false;
        if (mode === 'all') show = true;
        else if (mode === 'diff_only' && status !== 'identical') show = true;
        else if (mode === 'local_only' && (status === 'local_only' || status === 'local_newer')) show = true;
        else if (mode === 'remote_only' && (status === 'remote_only' || status === 'remote_newer')) show = true;
        else if (mode === 'mismatches' && (status === 'size_mismatch' || status === 'local_newer' || status === 'remote_newer')) show = true;

        if (!show) return;

        rowsRendered++;
        const tr = document.createElement('tr');
        tr.setAttribute('data-name', name);

        const isDiff = status !== 'identical';
        const chkAttr = isDiff ? 'checked' : '';

        // Left column: Local File Info (Name + date below)
        let localHtml = '';
        let localSizeHtml = '<span class="compare-empty-cell">--</span>';
        if (loc) {
          const icon = loc.isDir ? '📁' : '📄';
          localSizeHtml = loc.isDir ? '--' : this.formatBytes(loc.size);
          localHtml = `
            <div style="display: flex; flex-direction: column; width: 100%; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 8px; width: 100%; overflow: hidden;">
                <span class="file-icon" style="flex-shrink: 0;">${icon}</span>
                <span style="${loc.isDir ? 'font-weight: 600;' : ''} text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1; min-width: 0;" title="${name}">${name}</span>
              </div>
              <div style="font-size: 10px; color: hsl(var(--text-muted)); margin-left: 24px; margin-top: 1px; font-family: var(--font-mono); flex-shrink: 0;">
                ${this.formatTime(loc.mtime)}
              </div>
            </div>
          `;
        } else {
          localHtml = `<span class="compare-empty-cell" style="margin-left: 24px;">--</span>`;
        }

        // Right column: Remote File Info (Name + date below)
        let remoteHtml = '';
        let remoteSizeHtml = '<span class="compare-empty-cell">--</span>';
        if (rem) {
          const icon = rem.isDir ? '📁' : '📄';
          remoteSizeHtml = rem.isDir ? '--' : this.formatBytes(rem.size);
          remoteHtml = `
            <div style="display: flex; flex-direction: column; width: 100%; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 8px; width: 100%; overflow: hidden;">
                <span class="file-icon" style="flex-shrink: 0;">${icon}</span>
                <span style="${rem.isDir ? 'font-weight: 600;' : ''} text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1; min-width: 0;" title="${name}">${name}</span>
              </div>
              <div style="font-size: 10px; color: hsl(var(--text-muted)); margin-left: 24px; margin-top: 1px; font-family: var(--font-mono); flex-shrink: 0;">
                ${this.formatTime(rem.mtime)}
              </div>
            </div>
          `;
        } else {
          remoteHtml = `<span class="compare-empty-cell" style="margin-left: 24px;">--</span>`;
        }

        // Middle column: Action & Status
        let badgeColor = '#94A3B8';
        let badgeBg = 'rgba(100, 116, 139, 0.15)';
        let badgeText = 'Identical';

        if (status === 'local_only') {
          badgeColor = '#34D399';
          badgeBg = 'rgba(16, 185, 129, 0.15)';
          badgeText = 'Local Only';
        } else if (status === 'remote_only') {
          badgeColor = '#38BDF8';
          badgeBg = 'rgba(14, 165, 233, 0.15)';
          badgeText = 'Remote Only';
        } else if (status === 'local_newer') {
          badgeColor = '#34D399';
          badgeBg = 'rgba(16, 185, 129, 0.15)';
          badgeText = 'Local Newer';
        } else if (status === 'remote_newer') {
          badgeColor = '#38BDF8';
          badgeBg = 'rgba(14, 165, 233, 0.15)';
          badgeText = 'Remote Newer';
        } else if (status === 'size_mismatch') {
          badgeColor = '#FBBF24';
          badgeBg = 'rgba(251, 191, 36, 0.15)';
          badgeText = 'Size Mismatch';
        }

        const middleHtml = `
          <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
            <span class="tag-badge" style="background-color: ${badgeBg}; color: ${badgeColor}; font-weight: 600; font-size: 10px; margin: 0; padding: 3px 8px; white-space: nowrap; line-height: 1.2; text-align: center; box-sizing: border-box;">${badgeText}</span>
          </div>
        `;

        tr.innerHTML = `
          <td style="text-align: center; vertical-align: middle; padding: 6px 12px; width: 36px;">
            <input type="checkbox" class="dir-compare-chk" data-name="${name}" data-status="${status}" ${chkAttr} style="cursor: pointer; margin: 0;">
          </td>
          <td class="file-name-cell">${localHtml}</td>
          <td style="font-size: 11px; font-family: var(--font-mono); text-align: left; vertical-align: middle;">${localSizeHtml}</td>
          <td style="text-align: center; vertical-align: middle; padding: 6px 12px;">${middleHtml}</td>
          <td class="file-name-cell">${remoteHtml}</td>
          <td style="font-size: 11px; font-family: var(--font-mono); text-align: left; vertical-align: middle;">${remoteSizeHtml}</td>
        `;

        tbody.appendChild(tr);
      });

      if (rowsRendered === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: hsl(var(--text-muted)); padding: 24px;">No files match the selected filter.</td></tr>`;
      }
    }

    modal.classList.add('active');
  },

  getDiffInfo(filename) {
    return null; // Disable inline fileBrowser row badges entirely for cleaner main UI
  }
};
