/**
 * DevsFTP — Remote Development Workspace
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * Dual-Pane File Manager Component for DevsFTP
 * Controls local Windows filesystem pane and remote server filesystem pane.
 * Features smart screen-boundary aware context menus and selection-aware actions.
 */

window.FileBrowser = {
  localPath: 'C:\\',
  remotePath: '/',
  localFiles: [],
  remoteFiles: [],

  selectedLocal: null,
  selectedRemote: null,
  selectedLocalFiles: [],
  selectedRemoteFiles: [],
  lastSelectedLocalIndex: -1,
  lastSelectedRemoteIndex: -1,
  localAnchorIndex: -1,
  remoteAnchorIndex: -1,
  contextItem: null,
  contextItems: [],
  contextPane: null,
  dragSourcePane: null,

  getApi() {
    return window.devsFTP || window.pulseFTP;
  },

  async init() {
    this.calculatedDirSizes = new Map();
    this.setupListeners();
    this.loadDrives();
    const api = this.getApi();
    let initialPath = 'C:\\';
    if (api && api.localHome) {
      try {
        initialPath = await api.localHome();
      } catch (e) {}
    }
    this.refreshLocal(initialPath);

    if (api && api.onDirSizeUpdated) {
      api.onDirSizeUpdated((data) => {
        if (data && data.targetPath) {
          this.calculatedDirSizes.set(data.targetPath, data.formattedSize);
          if (data.isRemote) {
            this.renderRemoteTable(this.remoteFiles);
          } else {
            this.renderLocalTable(this.localFiles);
          }
        }
      });
    }
  },

  setRemoteState(files, targetPath) {
    this.remoteFiles = files || [];
    this.remotePath = targetPath || '/';
    document.getElementById('remote-path-input').value = this.remotePath;
    this.renderRemoteTable(this.remoteFiles);
  },

  setupListeners() {
    // Local Controls
    document.getElementById('btn-local-refresh').addEventListener('click', () => this.refreshLocal(this.localPath));
    document.getElementById('btn-local-up').addEventListener('click', () => this.localUp());
    document.getElementById('local-path-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.refreshLocal(e.target.value);
    });
    document.getElementById('local-filter').addEventListener('input', (e) => this.filterLocal(e.target.value));

    // Remote Controls
    document.getElementById('btn-remote-refresh').addEventListener('click', () => this.refreshRemote(this.remotePath));
    const btnRemoteDisconnect = document.getElementById('btn-remote-disconnect');
    if (btnRemoteDisconnect) {
      btnRemoteDisconnect.addEventListener('click', () => {
        if (window.SessionManager) {
          window.SessionManager.disconnectActiveSession();
        }
      });
    }
    const btnRemoteReconnect = document.getElementById('btn-remote-reconnect');
    if (btnRemoteReconnect) {
      btnRemoteReconnect.addEventListener('click', () => {
        const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
        if (activeSess && activeSess.connectionState === 'disconnected' && activeSess.profile) {
          if (window.connectToProfileSession) {
            window.connectToProfileSession(activeSess.profile, activeSess.sessionId);
          }
        }
      });
    }
    document.getElementById('btn-remote-up').addEventListener('click', () => this.remoteUp());
    document.getElementById('remote-path-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.refreshRemote(e.target.value);
    });
    document.getElementById('remote-filter').addEventListener('input', (e) => this.filterRemote(e.target.value));

    // Global click listener to hide context menu
    document.addEventListener('click', (e) => {
      if (e.target.closest('#context-menu')) return;
      this.hideContextMenu();
    });
    
    // Setup Context Menu Action Listeners
    document.getElementById('ctx-open').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-open click fired');
      this.handleContextAction('open');
    });
    document.getElementById('ctx-edit').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-edit click fired');
      this.handleContextAction('edit');
    });
    document.getElementById('ctx-download').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-download click fired');
      this.handleContextAction('download');
    });
    document.getElementById('ctx-upload').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-upload click fired');
      this.handleContextAction('upload');
    });
    document.getElementById('ctx-copy-path').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-copy-path click fired');
      this.handleContextAction('copy-path');
    });
    document.getElementById('ctx-calculate-size').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-calculate-size click fired');
      this.handleContextAction('calculate-size');
    });
    document.getElementById('ctx-chmod').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-chmod click fired');
      this.handleContextAction('chmod');
    });
    document.getElementById('ctx-new-file').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-new-file click fired');
      this.handleContextAction('new-file');
    });
    document.getElementById('ctx-mkdir').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-mkdir click fired');
      this.handleContextAction('mkdir');
    });
    document.getElementById('ctx-rename').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-rename click fired');
      this.handleContextAction('rename');
    });
    document.getElementById('ctx-delete').addEventListener('click', (e) => {
      console.log('[DEBUG MENU] #ctx-delete click fired');
      this.handleContextAction('delete');
    });

    // Drive selector
    document.getElementById('local-drive-select').addEventListener('change', (e) => this.refreshLocal(e.target.value));

    // File list table container keyboard shortcuts & right-click background listeners
    const localContainer = document.getElementById('local-file-list-container');
    if (localContainer) {
      localContainer.addEventListener('keydown', (e) => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          if (window.getSelection) window.getSelection().removeAllRanges();
          this.selectedLocalFiles = [...this.localFiles];
          this.selectedLocal = this.selectedLocalFiles[0] || null;
          this.updateLocalRowHighlights();
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (window.getSelection) window.getSelection().removeAllRanges();
          const visibleRows = Array.from(document.querySelectorAll('#local-file-tbody tr.file-row'));
          if (visibleRows.length === 0) return;

          let currentIdx = this.lastSelectedLocalIndex;
          if (currentIdx < 0 || currentIdx >= visibleRows.length) {
            currentIdx = 0;
          }

          const nextIdx = e.key === 'ArrowDown' ? Math.min(visibleRows.length - 1, currentIdx + 1) : Math.max(0, currentIdx - 1);

          if (e.shiftKey) {
            if (this.localAnchorIndex === undefined || this.localAnchorIndex === null || this.localAnchorIndex < 0 || this.localAnchorIndex >= visibleRows.length) {
              this.localAnchorIndex = currentIdx;
            }
            const start = Math.min(this.localAnchorIndex, nextIdx);
            const end = Math.max(this.localAnchorIndex, nextIdx);
            this.selectedLocalFiles = [];
            for (let idx = start; idx <= end; idx++) {
              const rowPath = visibleRows[idx].getAttribute('data-path');
              const fileObj = this.localFiles.find(item => item.path === rowPath);
              if (fileObj && !this.selectedLocalFiles.some(item => item.path === fileObj.path)) {
                this.selectedLocalFiles.push(fileObj);
              }
            }
          } else {
            this.localAnchorIndex = nextIdx;
            const rowPath = visibleRows[nextIdx].getAttribute('data-path');
            const fileObj = this.localFiles.find(item => item.path === rowPath);
            this.selectedLocalFiles = fileObj ? [fileObj] : [];
          }

          this.lastSelectedLocalIndex = nextIdx;
          this.selectedLocal = this.selectedLocalFiles[0] || null;
          this.updateLocalRowHighlights();
          visibleRows[nextIdx].scrollIntoView({ block: 'nearest' });
        }
      });

      localContainer.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('tr.file-row')) {
          e.preventDefault();
          this.selectedLocalFiles = [];
          this.selectedLocal = null;
          this.showContextMenu(e.clientX, e.clientY, null, 'local');
        }
      });
    }

    const remoteContainer = document.getElementById('remote-file-list-container');
    if (remoteContainer) {
      remoteContainer.addEventListener('keydown', (e) => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          if (window.getSelection) window.getSelection().removeAllRanges();
          this.selectedRemoteFiles = [...this.remoteFiles];
          this.selectedRemote = this.selectedRemoteFiles[0] || null;
          this.updateRemoteRowHighlights();
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (window.getSelection) window.getSelection().removeAllRanges();
          const visibleRows = Array.from(document.querySelectorAll('#remote-file-tbody tr.file-row'));
          if (visibleRows.length === 0) return;

          let currentIdx = this.lastSelectedRemoteIndex;
          if (currentIdx < 0 || currentIdx >= visibleRows.length) {
            currentIdx = 0;
          }

          const nextIdx = e.key === 'ArrowDown' ? Math.min(visibleRows.length - 1, currentIdx + 1) : Math.max(0, currentIdx - 1);

          if (e.shiftKey) {
            if (this.remoteAnchorIndex === undefined || this.remoteAnchorIndex === null || this.remoteAnchorIndex < 0 || this.remoteAnchorIndex >= visibleRows.length) {
              this.remoteAnchorIndex = currentIdx;
            }
            const start = Math.min(this.remoteAnchorIndex, nextIdx);
            const end = Math.max(this.remoteAnchorIndex, nextIdx);
            this.selectedRemoteFiles = [];
            for (let idx = start; idx <= end; idx++) {
              const rowPath = visibleRows[idx].getAttribute('data-path');
              const fileObj = this.remoteFiles.find(item => item.path === rowPath);
              if (fileObj && !this.selectedRemoteFiles.some(item => item.path === fileObj.path)) {
                this.selectedRemoteFiles.push(fileObj);
              }
            }
          } else {
            this.remoteAnchorIndex = nextIdx;
            const rowPath = visibleRows[nextIdx].getAttribute('data-path');
            const fileObj = this.remoteFiles.find(item => item.path === rowPath);
            this.selectedRemoteFiles = fileObj ? [fileObj] : [];
          }

          this.lastSelectedRemoteIndex = nextIdx;
          this.selectedRemote = this.selectedRemoteFiles[0] || null;
          this.updateRemoteRowHighlights();
          visibleRows[nextIdx].scrollIntoView({ block: 'nearest' });
        }
      });

      remoteContainer.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('tr.file-row')) {
          e.preventDefault();
          this.selectedRemoteFiles = [];
          this.selectedRemote = null;
          this.showContextMenu(e.clientX, e.clientY, null, 'remote');
        }
      });
    }


    // New Item Creation Modal Listeners
    const btnCancel = document.getElementById('btn-new-item-cancel');
    const btnCancelIcon = document.getElementById('btn-new-item-cancel-icon');
    const btnSubmit = document.getElementById('btn-new-item-submit');
    const presetSelect = document.getElementById('chmod-preset-select');
    const nameInput = document.getElementById('new-item-name-input');

    if (btnCancel) btnCancel.addEventListener('click', () => this.closeNewItemModal());
    if (btnCancelIcon) btnCancelIcon.addEventListener('click', () => this.closeNewItemModal());
    if (btnSubmit) btnSubmit.addEventListener('click', () => this.submitNewItem());
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.submitNewItem();
        if (e.key === 'Escape') this.closeNewItemModal();
      });
    }

    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => this.applyChmodPreset(e.target.value));
    }

    document.querySelectorAll('.chmod-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (presetSelect) presetSelect.value = 'custom';
        this.recalcChmodOctal();
      });
    });

    // Standalone CHMOD Dialog Listeners
    const btnChmodClose = document.getElementById('btn-chmod-close-icon');
    const btnChmodSubmit = document.getElementById('btn-chmod-submit');
    const chmodEditPresetSelect = document.getElementById('chmod-edit-preset-select');

    if (btnChmodClose) btnChmodClose.addEventListener('click', () => this.closeChmodModal());
    if (btnChmodSubmit) btnChmodSubmit.addEventListener('click', () => this.submitChmodPermissions());
    if (chmodEditPresetSelect) {
      chmodEditPresetSelect.addEventListener('change', (e) => this.applyEditChmodPreset(e.target.value));
    }

    document.querySelectorAll('.chmod-edit-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (chmodEditPresetSelect) chmodEditPresetSelect.value = 'custom';
        this.recalcEditChmodOctal();
      });
    });

    // Operation Error Dialog Listeners
    const btnErrorClose = document.getElementById('btn-error-close-icon');
    const btnErrorOk = document.getElementById('btn-error-ok');
    if (btnErrorClose) btnErrorClose.addEventListener('click', () => this.closeErrorModal());
    if (btnErrorOk) btnErrorOk.addEventListener('click', () => this.closeErrorModal());

    // Rename Modal Event Listeners
    const btnRenameClose = document.getElementById('btn-rename-modal-close');
    const btnRenameCancel = document.getElementById('btn-rename-cancel');
    const btnRenameSubmit = document.getElementById('btn-rename-submit');
    const renameNameInput = document.getElementById('rename-item-name-input');

    if (btnRenameClose) btnRenameClose.addEventListener('click', () => this.closeRenameModal());
    if (btnRenameCancel) btnRenameCancel.addEventListener('click', () => this.closeRenameModal());
    if (btnRenameSubmit) btnRenameSubmit.addEventListener('click', () => this.submitRename());
    if (renameNameInput) {
      renameNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.submitRename();
        if (e.key === 'Escape') this.closeRenameModal();
      });
    }

    // Delete Confirmation Modal Event Listeners
    const btnDelClose = document.getElementById('btn-confirm-delete-close');
    const btnDelCancel = document.getElementById('btn-confirm-delete-cancel');
    const btnDelSubmit = document.getElementById('btn-confirm-delete-submit');

    if (btnDelClose) btnDelClose.addEventListener('click', () => this.closeDeleteConfirmModal());
    if (btnDelCancel) btnDelCancel.addEventListener('click', () => this.closeDeleteConfirmModal());
    if (btnDelSubmit) btnDelSubmit.addEventListener('click', () => this.submitDelete());

    // Drag & Drop Dual-Pane Listeners
    this.setupDragAndDrop();
  },

  setupDragAndDrop() {
    const localPane = document.getElementById('local-pane');
    const remotePane = document.getElementById('remote-pane');

    if (localPane) {
      localPane.addEventListener('dragover', (e) => {
        e.preventDefault();
        // Do not highlight if item originated from local pane itself
        if (this.dragSourcePane === 'local') {
          localPane.classList.remove('dropzone-active');
          return;
        }
        localPane.classList.add('dropzone-active');
        localPane.setAttribute('data-drop-hint', `📥 Drop items to download to ${this.localPath}`);
        e.dataTransfer.dropEffect = 'copy';
      });

      localPane.addEventListener('dragleave', (e) => {
        if (!localPane.contains(e.relatedTarget)) {
          localPane.classList.remove('dropzone-active');
        }
      });

      localPane.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        localPane.classList.remove('dropzone-active');
        if (this.dragSourcePane === 'local') return;

        try {
          const raw = e.dataTransfer.getData('application/json');
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.sourcePane === 'remote' && data.path) {
              this.downloadFile(data.path);
            }
          }
        } catch (err) {}
      });
    }

    if (remotePane) {
      remotePane.addEventListener('dragover', (e) => {
        e.preventDefault();
        // Do not highlight if item originated from remote pane itself
        if (this.dragSourcePane === 'remote') {
          remotePane.classList.remove('dropzone-active');
          return;
        }
        remotePane.classList.add('dropzone-active');
        remotePane.setAttribute('data-drop-hint', `📥 Drop items to upload to ${this.remotePath}`);
        e.dataTransfer.dropEffect = 'copy';
      });

      remotePane.addEventListener('dragleave', (e) => {
        if (!remotePane.contains(e.relatedTarget)) {
          remotePane.classList.remove('dropzone-active');
        }
      });

      remotePane.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        remotePane.classList.remove('dropzone-active');
        if (this.dragSourcePane === 'remote') return;

        // External OS Desktop/Explorer Drag & Drop Files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          Array.from(e.dataTransfer.files).forEach(file => {
            if (file.path) {
              this.uploadFile(file.path);
            }
          });
          return;
        }

        // Internal Pane Drag & Drop
        try {
          const raw = e.dataTransfer.getData('application/json');
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.sourcePane === 'local' && data.path) {
              this.uploadFile(data.path);
            }
          }
        } catch (err) {}
      });
    }
  },

  showErrorModal(title, targetPath, causeMessage, recommendationMessage) {
    const modal = document.getElementById('error-modal');
    const titleEl = document.getElementById('error-modal-title');
    const targetEl = document.getElementById('error-modal-target');
    const causeEl = document.getElementById('error-modal-cause');
    const actionEl = document.getElementById('error-modal-action');

    if (!modal) return;

    if (titleEl) titleEl.textContent = title || '⚠️ Operation Error';
    if (targetEl) targetEl.textContent = targetPath || '';
    if (causeEl) causeEl.textContent = causeMessage || 'An unexpected error occurred during the operation.';
    if (actionEl) actionEl.textContent = recommendationMessage || 'Please check permissions or try selecting another directory.';

    modal.classList.add('active');
  },

  restorePaneFocus() {
    const pane = this.renameTargetPane || this.deleteTargetPane || this.newItemTargetPane || this.chmodTargetPane || this.contextPane || 'local';
    const containerId = pane === 'remote' ? 'remote-file-list-container' : 'local-file-list-container';
    const container = document.getElementById(containerId);
    if (container) {
      setTimeout(() => container.focus(), 50);
    }
  },

  closeErrorModal() {
    const modal = document.getElementById('error-modal');
    if (modal) modal.classList.remove('active');
    this.restorePaneFocus();
  },

  openChmodModal(item) {
    if (!item) return;
    this.hideContextMenu();
    this.chmodTargetItem = item;
    this.chmodTargetPane = 'remote';

    const modal = document.getElementById('chmod-modal');
    const title = document.getElementById('chmod-modal-title');
    const pathVal = document.getElementById('chmod-modal-target-path');
    const presetSelect = document.getElementById('chmod-edit-preset-select');

    if (!modal) return;

    if (title) title.textContent = `🔐 Permissions (CHMOD) - ${item.name}`;
    if (pathVal) pathVal.textContent = item.path;

    const initialOctal = this.parsePermissionsToOctal(item.permissions || (item.isDir ? 'rwxr-xr-x' : 'rw-r--r--'));
    
    if (presetSelect) presetSelect.value = initialOctal;
    this.applyEditChmodPreset(initialOctal);

    modal.classList.add('active');
  },

  closeChmodModal() {
    const modal = document.getElementById('chmod-modal');
    if (modal) modal.classList.remove('active');
    this.restorePaneFocus();
  },

  openRenameModal(item, pane) {
    if (!item) return;
    this.hideContextMenu();
    this.renameTargetItem = item;
    this.renameTargetPane = pane || 'remote';

    const modal = document.getElementById('rename-modal');
    const title = document.getElementById('rename-modal-title');
    const pathVal = document.getElementById('rename-modal-target-path');
    const nameInput = document.getElementById('rename-item-name-input');

    if (!modal) return;

    const icon = item.isDir ? '📁' : '📄';
    if (title) title.textContent = `${icon} Rename ${item.isDir ? 'Directory' : 'File'}`;
    if (pathVal) pathVal.textContent = item.path;
    if (nameInput) {
      nameInput.value = item.name;
      nameInput.style.borderColor = '';
    }

    modal.classList.add('active');
    setTimeout(() => {
      if (nameInput) {
        nameInput.focus();
        const dotIdx = item.name.lastIndexOf('.');
        if (!item.isDir && dotIdx > 0) {
          nameInput.setSelectionRange(0, dotIdx);
        } else {
          nameInput.select();
        }
      }
    }, 100);
  },

  closeRenameModal() {
    const modal = document.getElementById('rename-modal');
    if (modal) modal.classList.remove('active');
    this.renameTargetItem = null;
    this.restorePaneFocus();
  },

  async submitRename() {
    if (!this.renameTargetItem) return;
    const nameInput = document.getElementById('rename-item-name-input');
    const cleanName = nameInput ? nameInput.value.trim() : '';

    if (!cleanName) {
      if (nameInput) {
        nameInput.style.borderColor = 'hsl(var(--status-danger))';
        nameInput.focus();
      }
      return;
    }

    if (nameInput) nameInput.style.borderColor = '';
    const item = this.renameTargetItem;
    const pane = this.renameTargetPane || 'remote';
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    if (cleanName === item.name) {
      this.closeRenameModal();
      return;
    }

    this.closeRenameModal();

    try {
      if (pane === 'remote') {
        const lastSlash = item.path.lastIndexOf('/');
        const parentDir = lastSlash <= 0 ? '' : item.path.substring(0, lastSlash);
        const newPath = `${parentDir}/${cleanName}`;
        await api.remoteRename(item.path, newPath, sessId);
        this.refreshRemote(this.remotePath);
      } else if (pane === 'local') {
        const lastBackslash = item.path.lastIndexOf('\\');
        const parentDir = lastBackslash <= 0 ? item.path : item.path.substring(0, lastBackslash);
        const newPath = `${parentDir}\\${cleanName}`;
        if (api.localRename) {
          await api.localRename(item.path, newPath);
          this.refreshLocal(this.localPath);
        }
      }
    } catch (err) {
      const cleanMsg = err && err.message ? err.message : String(err);
      alert(`Failed to rename ${item.name}: ${cleanMsg}`);
    }
  },

  openDeleteConfirmModal(items, pane) {
    const itemList = Array.isArray(items) ? items : (items ? [items] : []);
    if (itemList.length === 0) return;
    this.hideContextMenu();
    this.deleteTargetItems = itemList;
    this.deleteTargetItem = itemList[0];
    this.deleteTargetPane = pane || 'remote';

    const modal = document.getElementById('confirm-delete-modal');
    const title = document.getElementById('confirm-delete-modal-title');
    const pathVal = document.getElementById('confirm-delete-modal-path');
    const warningVal = document.getElementById('confirm-delete-modal-warning');

    if (!modal) return;

    if (itemList.length === 1) {
      const item = itemList[0];
      const icon = item.isDir ? '📁' : '📄';
      const typeLabel = item.isDir ? 'Directory' : 'File';
      if (title) title.textContent = `🗑 Delete ${typeLabel} (${pane === 'remote' ? 'Remote' : 'Local'})`;
      if (pathVal) pathVal.textContent = item.path;
      if (warningVal) {
        warningVal.textContent = `Are you sure you want to delete ${icon} "${item.name}" from your ${pane} filesystem? This action cannot be undone.`;
      }
    } else {
      if (title) title.textContent = `🗑 Delete ${itemList.length} Items (${pane === 'remote' ? 'Remote' : 'Local'})`;
      if (pathVal) pathVal.textContent = `${itemList.length} selected items`;
      const itemNames = itemList.slice(0, 5).map(i => `• ${i.name}`).join('\n');
      const moreText = itemList.length > 5 ? `\n...and ${itemList.length - 5} more.` : '';
      if (warningVal) {
        warningVal.textContent = `Are you sure you want to delete these ${itemList.length} items from your ${pane} filesystem? This action cannot be undone.\n\n${itemNames}${moreText}`;
      }
    }

    modal.classList.add('active');
  },

  closeDeleteConfirmModal() {
    const modal = document.getElementById('confirm-delete-modal');
    if (modal) modal.classList.remove('active');
    this.deleteTargetItem = null;
    this.deleteTargetItems = [];
    this.restorePaneFocus();
  },

  async submitDelete() {
    const items = (this.deleteTargetItems && this.deleteTargetItems.length > 0) ? this.deleteTargetItems : (this.deleteTargetItem ? [this.deleteTargetItem] : []);
    if (items.length === 0) return;
    const pane = this.deleteTargetPane || 'remote';
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    this.closeDeleteConfirmModal();

    let successCount = 0;
    try {
      for (const item of items) {
        if (pane === 'remote') {
          await api.remoteDelete(item.path, item.isDir, sessId);
          successCount++;
        } else if (pane === 'local') {
          if (api.localDelete) {
            await api.localDelete(item.path, item.isDir);
            successCount++;
          }
        }
      }
      if (window.LogViewer) window.LogViewer.addEntry('warning', `🗑 Deleted ${successCount} ${pane} item(s).`);
      if (pane === 'remote') this.refreshRemote(this.remotePath);
      else this.refreshLocal(this.localPath);
    } catch (err) {
      const cleanMsg = err && err.message ? err.message : String(err);
      this.showErrorModal(
        '⚠️ Delete Failed',
        `${items.length} item(s)`,
        cleanMsg,
        'Please check item permissions, or verify the file/folder is not locked by another process.'
      );
      if (pane === 'remote') this.refreshRemote(this.remotePath);
      else this.refreshLocal(this.localPath);
    }
  },

  parsePermissionsToOctal(permStr) {
    if (!permStr) return '0755';
    const str = permStr.replace(/^d/, '').trim();
    if (/^[0-7]{3,4}$/.test(str)) {
      return str.length === 3 ? `0${str}` : str;
    }
    if (str.length >= 9) {
      const calcTriplet = (tri) => {
        let sum = 0;
        if (tri[0] === 'r') sum += 4;
        if (tri[1] === 'w') sum += 2;
        if (tri[2] === 'x' || tri[2] === 's' || tri[2] === 't') sum += 1;
        return sum;
      };
      const owner = calcTriplet(str.substring(0, 3));
      const group = calcTriplet(str.substring(3, 6));
      const others = calcTriplet(str.substring(6, 9));
      return `0${owner}${group}${others}`;
    }
    return '0755';
  },

  recalcEditChmodOctal() {
    const calcDigit = (target) => {
      let sum = 0;
      document.querySelectorAll(`.chmod-edit-cb[data-target="${target}"]`).forEach(cb => {
        if (cb.checked) sum += parseInt(cb.getAttribute('data-val') || '0', 10);
      });
      return sum;
    };

    const owner = calcDigit('owner');
    const group = calcDigit('group');
    const others = calcDigit('others');
    const octalStr = `0${owner}${group}${others}`;

    const octalDisplay = document.getElementById('chmod-edit-octal-val');
    if (octalDisplay) octalDisplay.textContent = octalStr;
  },

  applyEditChmodPreset(preset) {
    if (preset === 'custom') return;
    const map = {
      '0644': { owner: [4, 2], group: [4], others: [4] },
      '0755': { owner: [4, 2, 1], group: [4, 1], others: [4, 1] },
      '0777': { owner: [4, 2, 1], group: [4, 2, 1], others: [4, 2, 1] }
    };

    const config = map[preset] || map['0755'];

    document.querySelectorAll('.chmod-edit-cb').forEach(cb => {
      const target = cb.getAttribute('data-target');
      const val = parseInt(cb.getAttribute('data-val') || '0', 10);
      cb.checked = (config[target] && config[target].includes(val));
    });

    this.recalcEditChmodOctal();
  },

  async submitChmodPermissions() {
    if (!this.chmodTargetItem) return;
    const octalDisplay = document.getElementById('chmod-edit-octal-val');
    const octalStr = octalDisplay ? octalDisplay.textContent.trim() : '0755';
    const mode = parseInt(octalStr, 8);
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    this.closeChmodModal();

    try {
      if (!isNaN(mode)) {
        await api.remoteChmod(this.chmodTargetItem.path, mode, sessId);
        this.refreshRemote(this.remotePath);
      }
    } catch (err) {
      alert(`Failed to change permissions: ${err.message || err}`);
    }
  },

  openNewItemModal(type, pane) {
    this.newItemTargetType = type; // 'file' or 'dir'
    this.newItemTargetPane = pane || 'remote'; // 'remote' or 'local'

    const modal = document.getElementById('new-item-modal');
    const title = document.getElementById('new-item-modal-title');
    const nameInput = document.getElementById('new-item-name-input');
    const presetSelect = document.getElementById('chmod-preset-select');
    const btnSubmit = document.getElementById('btn-new-item-submit');
    const chmodSection = document.getElementById('chmod-section');

    if (!modal) return;

    if (type === 'file') {
      if (title) title.textContent = '📄 Create New File';
      if (nameInput) nameInput.placeholder = 'e.g. index.html';
      if (btnSubmit) btnSubmit.textContent = 'Create File';
      if (presetSelect) presetSelect.value = '0644';
      this.applyChmodPreset('0644');
    } else {
      if (title) title.textContent = '📁 Create New Directory';
      if (nameInput) nameInput.placeholder = 'e.g. assets';
      if (btnSubmit) btnSubmit.textContent = 'Create Directory';
      if (presetSelect) presetSelect.value = '0755';
      this.applyChmodPreset('0755');
    }

    if (chmodSection) {
      chmodSection.style.display = this.newItemTargetPane === 'remote' ? 'block' : 'none';
    }

    if (nameInput) nameInput.value = '';
    modal.classList.add('active');
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
  },

  closeNewItemModal() {
    const modal = document.getElementById('new-item-modal');
    if (modal) modal.classList.remove('active');
  },

  recalcChmodOctal() {
    const calcDigit = (target) => {
      let sum = 0;
      document.querySelectorAll(`.chmod-cb[data-target="${target}"]`).forEach(cb => {
        if (cb.checked) sum += parseInt(cb.getAttribute('data-val') || '0', 10);
      });
      return sum;
    };

    const owner = calcDigit('owner');
    const group = calcDigit('group');
    const others = calcDigit('others');
    const octalStr = `0${owner}${group}${others}`;

    const octalDisplay = document.getElementById('chmod-octal-val');
    if (octalDisplay) octalDisplay.textContent = octalStr;
  },

  applyChmodPreset(preset) {
    if (preset === 'custom') return;
    const map = {
      '0644': { owner: [4, 2], group: [4], others: [4] },
      '0755': { owner: [4, 2, 1], group: [4, 1], others: [4, 1] },
      '0777': { owner: [4, 2, 1], group: [4, 2, 1], others: [4, 2, 1] }
    };

    const config = map[preset] || map['0755'];

    document.querySelectorAll('.chmod-cb').forEach(cb => {
      const target = cb.getAttribute('data-target');
      const val = parseInt(cb.getAttribute('data-val') || '0', 10);
      cb.checked = (config[target] && config[target].includes(val));
    });

    this.recalcChmodOctal();
  },

  async submitNewItem() {
    const nameInput = document.getElementById('new-item-name-input');
    const octalDisplay = document.getElementById('chmod-octal-val');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      if (nameInput) {
        nameInput.style.borderColor = 'hsl(var(--status-danger))';
        nameInput.focus();
      }
      return;
    }

    if (nameInput) nameInput.style.borderColor = '';
    const mode = octalDisplay ? octalDisplay.textContent.trim() : '0755';
    const type = this.newItemTargetType || 'file';
    const pane = this.newItemTargetPane || 'remote';
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    this.closeNewItemModal();

    try {
      if (type === 'file') {
        if (pane === 'remote') {
          const parent = this.remotePath === '/' ? '' : this.remotePath;
          const remoteFilePath = `${parent}/${name}`;
          await api.remoteCreateFile(remoteFilePath, sessId, mode);
          this.refreshRemote(this.remotePath);
        } else {
          const localFilePath = `${this.localPath}\\${name}`;
          await api.localCreateFile(localFilePath);
          this.refreshLocal(this.localPath);
        }
      } else {
        if (pane === 'remote') {
          const parent = this.remotePath === '/' ? '' : this.remotePath;
          const remoteDirPath = `${parent}/${name}`;
          await api.remoteMkdir(remoteDirPath, sessId, mode);
          this.refreshRemote(this.remotePath);
        } else {
          const localDirPath = `${this.localPath}\\${name}`;
          await api.localMkdir(localDirPath);
          this.refreshLocal(this.localPath);
        }
      }
    } catch (err) {
      alert(`Failed to create ${type}: ${err.message || err}`);
    }
  },

  async loadDrives() {
    const api = this.getApi();
    if (!api) return;
    try {
      const drives = await api.localDrives();
      const select = document.getElementById('local-drive-select');
      if (select) {
        select.innerHTML = '';
        drives.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = `${d} Drive`;
          select.appendChild(opt);
        });
      }
    } catch (e) {}
  },

  async refreshLocal(targetPath) {
    if (this._refreshingLocal) {
      console.log('[FileBrowser] refreshLocal already in progress, skipping duplicate call.');
      return;
    }
    this._refreshingLocal = true;
    const api = this.getApi();
    if (!api) {
      this._refreshingLocal = false;
      return;
    }
    try {
      const res = await api.localList(targetPath);
      this.localPath = res.currentPath;
      this.localFiles = res.files;
      document.getElementById('local-path-input').value = this.localPath;
      this.renderLocalTable(this.localFiles);

      if (window.SessionManager) {
        window.SessionManager.updateActiveSessionLocalPath(this.localPath);
      }
      this.triggerAutoCalcLocal();
    } catch (err) {
      if (window.LogViewer) window.LogViewer.addEntry('error', `Failed to read local directory: ${err.message}`);
    } finally {
      this._refreshingLocal = false;
    }
  },

  async refreshRemote(targetPath) {
    if (this._refreshingRemote) {
      console.log('[FileBrowser] refreshRemote already in progress, skipping duplicate call.');
      return;
    }
    this._refreshingRemote = true;
    const api = this.getApi();
    if (!api) {
      this._refreshingRemote = false;
      return;
    }
    try {
      const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;
      const res = await api.remoteList(targetPath, sessId);
      this.remotePath = res.currentPath;
      this.remoteFiles = res.files;
      document.getElementById('remote-path-input').value = this.remotePath;
      this.renderRemoteTable(this.remoteFiles);
      if (window.SessionManager) {
        window.SessionManager.updateActiveSessionRemoteState(this.remoteFiles, this.remotePath);
        window.SessionManager.saveWorkspaceSessionState();
      }
      this.triggerAutoCalcRemote();
    } catch (err) {
      if (window.LogViewer) window.LogViewer.addEntry('error', `Failed to read remote directory: ${err.message}`);
    } finally {
      this._refreshingRemote = false;
    }
  },

  async triggerAutoCalcLocal() {
    const api = this.getApi();
    if (!api || !api.getDirSizePrefs) return;
    try {
      const prefs = await api.getDirSizePrefs();
      if (prefs && prefs.autoCalculate) {
        this.localFiles.forEach(f => {
          if (f.isDir) {
            api.calculateDirSize(f.path, false);
          }
        });
      }
    } catch (e) {}
  },

  async triggerAutoCalcRemote() {
    const api = this.getApi();
    if (!api || !api.getDirSizePrefs) return;
    try {
      const prefs = await api.getDirSizePrefs();
      if (prefs && prefs.autoCalculate) {
        const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;
        this.remoteFiles.forEach(f => {
          if (f.isDir) {
            api.calculateDirSize(f.path, true, sessId);
          }
        });
      }
    } catch (e) {}
  },

  localUp() {
    const parts = this.localPath.split('\\').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      this.refreshLocal(parts.join('\\') + '\\');
    }
  },

  remoteUp() {
    if (this.remotePath === '/') return;
    const idx = this.remotePath.lastIndexOf('/');
    const parent = idx <= 0 ? '/' : this.remotePath.substring(0, idx);
    this.refreshRemote(parent);
  },

  setRemoteState(files, path) {
    this.remoteFiles = files || [];
    this.remotePath = path || '/';
    const input = document.getElementById('remote-path-input');
    if (input) input.value = this.remotePath;

    const btnRemoteDisconnect = document.getElementById('btn-remote-disconnect');
    const btnRemoteReconnect = document.getElementById('btn-remote-reconnect');
    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    const isConnected = activeSess && activeSess.connectionState === 'connected';
    const hasProfile = activeSess && !!activeSess.profile;

    if (btnRemoteDisconnect) {
      btnRemoteDisconnect.style.display = isConnected ? 'inline-block' : 'none';
    }
    if (btnRemoteReconnect) {
      btnRemoteReconnect.style.display = (!isConnected && hasProfile) ? 'inline-block' : 'none';
    }

    this.renderRemoteTable(this.remoteFiles);
  },

  updateLocalRowHighlights() {
    const selectedPaths = new Set(this.selectedLocalFiles.map(item => item.path));
    document.querySelectorAll('#local-file-tbody tr.file-row').forEach(tr => {
      const p = tr.getAttribute('data-path');
      tr.classList.toggle('selected', selectedPaths.has(p));
    });
  },

  updateRemoteRowHighlights() {
    const selectedPaths = new Set(this.selectedRemoteFiles.map(item => item.path));
    document.querySelectorAll('#remote-file-tbody tr.file-row').forEach(tr => {
      const p = tr.getAttribute('data-path');
      tr.classList.toggle('selected', selectedPaths.has(p));
    });
  },

  renderLocalTable(files) {
    const tbody = document.getElementById('local-file-tbody');
    tbody.innerHTML = '';
    this.selectedLocalFiles = this.selectedLocalFiles.filter(item => files && files.some(f => f.path === item.path));

    if (!files || files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: hsl(var(--text-muted)); padding: 24px;">Directory is empty. Right-click to create new files or folders.</td></tr>';
      const emptyRow = tbody.querySelector('tr');
      if (emptyRow) {
        emptyRow.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.selectedLocalFiles = [];
          this.selectedLocal = null;
          this.showContextMenu(e.clientX, e.clientY, null, 'local');
        });
      }
      return;
    }

    files.forEach((f) => {
      const diffInfo = window.DirectoryCompare ? window.DirectoryCompare.getDiffInfo(f.name) : null;
      if (window.DirectoryCompare && window.DirectoryCompare.active && window.DirectoryCompare.filterMode === 'diff_only') {
        if (!diffInfo) return;
      }

      const tr = document.createElement('tr');
      const isSelected = this.selectedLocalFiles.some(item => item.path === f.path);
      tr.className = `file-row ${f.isDir ? 'is-dir' : ''} ${diffInfo ? diffInfo.rowClass : ''} ${isSelected ? 'selected' : ''}`;
      tr.setAttribute('data-path', f.path);
      tr.draggable = true;
      const icon = f.isDir ? '📁' : '📄';

      const badgeHtml = (diffInfo && (diffInfo.side === 'local' || diffInfo.side === 'both')) 
        ? `<span class="diff-badge ${diffInfo.badgeClass}">${diffInfo.badge}</span>` 
        : '';

      tr.innerHTML = `
        <td class="file-name-cell">
          <span class="file-icon">${icon}</span>
          <span>${f.name}</span>
          ${badgeHtml}
        </td>
        <td>${f.isDir ? (this.calculatedDirSizes.get(f.path) || '--') : this.formatSize(f.size)}</td>
        <td>${new Date(f.modifyTime).toLocaleDateString()}</td>
      `;

      tr.addEventListener('dragstart', (e) => {
        this.dragSourcePane = 'local';
        if (!this.selectedLocalFiles.some(item => item.path === f.path)) {
          this.selectedLocalFiles = [f];
          this.selectedLocal = f;
          this.updateLocalRowHighlights();
        }
        e.dataTransfer.setData('application/json', JSON.stringify({
          sourcePane: 'local',
          items: this.selectedLocalFiles.map(item => ({ path: item.path, isDir: item.isDir, name: item.name })),
          path: f.path,
          isDir: f.isDir,
          name: f.name
        }));
        e.dataTransfer.effectAllowed = 'copy';
      });

      tr.addEventListener('dragend', () => {
        this.dragSourcePane = null;
        document.querySelectorAll('.file-pane').forEach(p => p.classList.remove('dropzone-active'));
      });

      tr.addEventListener('click', (e) => {
        if (window.getSelection) window.getSelection().removeAllRanges();
        const visibleRows = Array.from(document.querySelectorAll('#local-file-tbody tr.file-row'));
        const currentIdx = visibleRows.indexOf(tr);

        if (e.shiftKey && this.lastSelectedLocalIndex >= 0 && this.lastSelectedLocalIndex < visibleRows.length) {
          const start = Math.min(this.lastSelectedLocalIndex, currentIdx);
          const end = Math.max(this.lastSelectedLocalIndex, currentIdx);
          if (!e.ctrlKey && !e.metaKey) {
            this.selectedLocalFiles = [];
          }
          for (let idx = start; idx <= end; idx++) {
            const rowPath = visibleRows[idx].getAttribute('data-path');
            const fileObj = files.find(item => item.path === rowPath);
            if (fileObj && !this.selectedLocalFiles.some(item => item.path === fileObj.path)) {
              this.selectedLocalFiles.push(fileObj);
            }
          }
        } else if (e.ctrlKey || e.metaKey) {
          const existingIdx = this.selectedLocalFiles.findIndex(item => item.path === f.path);
          if (existingIdx !== -1) {
            this.selectedLocalFiles.splice(existingIdx, 1);
          } else {
            this.selectedLocalFiles.push(f);
          }
          this.lastSelectedLocalIndex = currentIdx;
          this.localAnchorIndex = currentIdx;
        } else {
          this.selectedLocalFiles = [f];
          this.lastSelectedLocalIndex = currentIdx;
          this.localAnchorIndex = currentIdx;
        }
        this.selectedLocal = this.selectedLocalFiles[0] || null;
        this.updateLocalRowHighlights();
      });

      tr.addEventListener('dblclick', () => {
        if (f.isDir) {
          this.refreshLocal(f.path);
        } else {
          this.openLocalFile(f.path);
        }
      });

      tr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!this.selectedLocalFiles.some(item => item.path === f.path)) {
          this.selectedLocalFiles = [f];
          const visibleRows = Array.from(document.querySelectorAll('#local-file-tbody tr.file-row'));
          this.lastSelectedLocalIndex = visibleRows.indexOf(tr);
          this.selectedLocal = f;
          this.updateLocalRowHighlights();
        }
        this.showContextMenu(e.clientX, e.clientY, this.selectedLocalFiles, 'local');
      });

      tbody.appendChild(tr);
    });
  },

  renderRemoteTable(files) {
    const tbody = document.getElementById('remote-file-tbody');
    tbody.innerHTML = '';
    this.selectedRemoteFiles = this.selectedRemoteFiles.filter(item => files && files.some(f => f.path === item.path));

    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    const isDisconnected = activeSess && activeSess.connectionState === 'disconnected';

    if (isDisconnected) {
      const profileName = activeSess.profile ? (activeSess.profile.name || activeSess.profile.host) : 'Server';

      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 80px 24px; color: hsl(var(--text-secondary));">
            <div style="margin-bottom: 16px;">
              <img src="../../assets/branding/disconnected.png" width="80" height="80" style="display: inline-block; opacity: 0.85; object-fit: contain;" alt="Disconnected">
            </div>
            <div style="font-size: 16px; font-weight: 700; color: hsl(var(--text-primary));">${profileName} Disconnected</div>
          </td>
        </tr>
      `;
      return;
    }

    if (!files || files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: hsl(var(--text-muted)); padding: 24px;">Directory is empty. Right-click to create new files or folders.</td></tr>';
      const emptyRow = tbody.querySelector('tr');
      if (emptyRow) {
        emptyRow.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.selectedRemoteFiles = [];
          this.selectedRemote = null;
          this.showContextMenu(e.clientX, e.clientY, null, 'remote');
        });
      }
      return;
    }

    files.forEach((f) => {
      const diffInfo = window.DirectoryCompare ? window.DirectoryCompare.getDiffInfo(f.name) : null;
      if (window.DirectoryCompare && window.DirectoryCompare.active && window.DirectoryCompare.filterMode === 'diff_only') {
        if (!diffInfo) return;
      }

      const tr = document.createElement('tr');
      const isSelected = this.selectedRemoteFiles.some(item => item.path === f.path);
      tr.className = `file-row ${f.isDir ? 'is-dir' : ''} ${diffInfo ? diffInfo.rowClass : ''} ${isSelected ? 'selected' : ''}`;
      tr.setAttribute('data-path', f.path);
      tr.draggable = true;
      const icon = f.isDir ? '📁' : '📄';

      const badgeHtml = (diffInfo && (diffInfo.side === 'remote' || diffInfo.side === 'both')) 
        ? `<span class="diff-badge ${diffInfo.badgeClass}">${diffInfo.badge}</span>` 
        : '';

      tr.innerHTML = `
        <td class="file-name-cell">
          <span class="file-icon">${icon}</span>
          <span>${f.name}</span>
          ${badgeHtml}
        </td>
        <td>${f.isDir ? (this.calculatedDirSizes.get(f.path) || '--') : this.formatSize(f.size)}</td>
        <td class="permissions-cell">${f.permissions || 'rwxr-xr-x'}</td>
        <td>${new Date(f.modifyTime).toLocaleDateString()}</td>
      `;

      tr.addEventListener('dragstart', (e) => {
        this.dragSourcePane = 'remote';
        if (!this.selectedRemoteFiles.some(item => item.path === f.path)) {
          this.selectedRemoteFiles = [f];
          this.selectedRemote = f;
          this.updateRemoteRowHighlights();
        }
        e.dataTransfer.setData('application/json', JSON.stringify({
          sourcePane: 'remote',
          items: this.selectedRemoteFiles.map(item => ({ path: item.path, isDir: item.isDir, name: item.name })),
          path: f.path,
          isDir: f.isDir,
          name: f.name
        }));
        e.dataTransfer.effectAllowed = 'copy';
      });

      tr.addEventListener('dragend', () => {
        this.dragSourcePane = null;
        document.querySelectorAll('.file-pane').forEach(p => p.classList.remove('dropzone-active'));
      });

      tr.addEventListener('click', (e) => {
        if (window.getSelection) window.getSelection().removeAllRanges();
        const visibleRows = Array.from(document.querySelectorAll('#remote-file-tbody tr.file-row'));
        const currentIdx = visibleRows.indexOf(tr);

        if (e.shiftKey && this.lastSelectedRemoteIndex >= 0 && this.lastSelectedRemoteIndex < visibleRows.length) {
          const start = Math.min(this.lastSelectedRemoteIndex, currentIdx);
          const end = Math.max(this.lastSelectedRemoteIndex, currentIdx);
          if (!e.ctrlKey && !e.metaKey) {
            this.selectedRemoteFiles = [];
          }
          for (let idx = start; idx <= end; idx++) {
            const rowPath = visibleRows[idx].getAttribute('data-path');
            const fileObj = files.find(item => item.path === rowPath);
            if (fileObj && !this.selectedRemoteFiles.some(item => item.path === fileObj.path)) {
              this.selectedRemoteFiles.push(fileObj);
            }
          }
        } else if (e.ctrlKey || e.metaKey) {
          const existingIdx = this.selectedRemoteFiles.findIndex(item => item.path === f.path);
          if (existingIdx !== -1) {
            this.selectedRemoteFiles.splice(existingIdx, 1);
          } else {
            this.selectedRemoteFiles.push(f);
          }
          this.lastSelectedRemoteIndex = currentIdx;
          this.remoteAnchorIndex = currentIdx;
        } else {
          this.selectedRemoteFiles = [f];
          this.lastSelectedRemoteIndex = currentIdx;
          this.remoteAnchorIndex = currentIdx;
        }
        this.selectedRemote = this.selectedRemoteFiles[0] || null;
        this.updateRemoteRowHighlights();
      });

      tr.addEventListener('dblclick', () => {
        const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;
        const api = this.getApi();
        if (api && api.appendDebugLog) api.appendDebugLog(`[TRACE UI EDIT CLICK] DBLCLICK remote file path: ${f.path} | sessionId: ${sessId}`);
        if (f.isDir) {
          this.refreshRemote(f.path);
        } else {
          this.editRemoteFile(f.path);
        }
      });

      tr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!this.selectedRemoteFiles.some(item => item.path === f.path)) {
          this.selectedRemoteFiles = [f];
          const visibleRows = Array.from(document.querySelectorAll('#remote-file-tbody tr.file-row'));
          this.lastSelectedRemoteIndex = visibleRows.indexOf(tr);
          this.selectedRemote = f;
          this.updateRemoteRowHighlights();
        }
        this.showContextMenu(e.clientX, e.clientY, this.selectedRemoteFiles, 'remote');
      });

      tbody.appendChild(tr);
    });
  },

  filterLocal(term) {
    const lower = term.toLowerCase();
    const filtered = this.localFiles.filter(f => f.name.toLowerCase().includes(lower));
    this.renderLocalTable(filtered);
  },

  filterRemote(term) {
    const lower = term.toLowerCase();
    const filtered = this.remoteFiles.filter(f => f.name.toLowerCase().includes(lower));
    this.renderRemoteTable(filtered);
  },

  showContextMenu(x, y, items, pane) {
    const menu = document.getElementById('context-menu');
    this.contextPane = pane;

    const selectedList = Array.isArray(items) ? items : (items ? [items] : []);
    this.contextItems = selectedList;
    this.contextItem = selectedList[0] || null;

    const ctxOpen = document.getElementById('ctx-open');
    const ctxEdit = document.getElementById('ctx-edit');
    const ctxDownload = document.getElementById('ctx-download');
    const ctxUpload = document.getElementById('ctx-upload');
    const ctxChmod = document.getElementById('ctx-chmod');
    const ctxRename = document.getElementById('ctx-rename');
    const ctxDelete = document.getElementById('ctx-delete');
    const ctxCopyPath = document.getElementById('ctx-copy-path');
    const ctxCalculateSize = document.getElementById('ctx-calculate-size');
    const ctxNewFile = document.getElementById('ctx-new-file');
    const ctxMkdir = document.getElementById('ctx-mkdir');

    if (selectedList.length === 0) {
      if (ctxOpen) ctxOpen.style.display = 'none';
      if (ctxEdit) ctxEdit.style.display = 'none';
      if (ctxDownload) ctxDownload.style.display = 'none';
      if (ctxUpload) ctxUpload.style.display = 'none';
      if (ctxChmod) ctxChmod.style.display = 'none';
      if (ctxRename) ctxRename.style.display = 'none';
      if (ctxDelete) ctxDelete.style.display = 'none';
      if (ctxCopyPath) ctxCopyPath.style.display = 'none';
      if (ctxCalculateSize) ctxCalculateSize.style.display = 'none';
      if (ctxNewFile) ctxNewFile.style.display = 'flex';
      if (ctxMkdir) ctxMkdir.style.display = 'flex';
    } else if (selectedList.length === 1) {
      const item = selectedList[0];
      const isDir = item.isDir;
      if (ctxOpen) ctxOpen.style.display = isDir ? 'flex' : 'none';
      if (ctxEdit) ctxEdit.style.display = !isDir ? 'flex' : 'none';
      if (ctxDownload) {
        ctxDownload.style.display = pane === 'remote' ? 'flex' : 'none';
        const label = ctxDownload.querySelector('span:last-child');
        if (label) label.textContent = 'Download';
      }
      if (ctxUpload) {
        ctxUpload.style.display = pane === 'local' ? 'flex' : 'none';
        const label = ctxUpload.querySelector('span:last-child');
        if (label) label.textContent = 'Upload';
      }
      if (ctxChmod) ctxChmod.style.display = pane === 'remote' ? 'flex' : 'none';
      if (ctxRename) ctxRename.style.display = 'flex';
      if (ctxDelete) {
        ctxDelete.style.display = 'flex';
        const label = ctxDelete.querySelector('span:last-child');
        if (label) label.textContent = 'Delete';
      }
      if (ctxCopyPath) {
        ctxCopyPath.style.display = 'flex';
        const label = ctxCopyPath.querySelector('span:last-child');
        if (label) label.textContent = 'Copy Path';
      }
      if (ctxCalculateSize) {
        ctxCalculateSize.style.display = isDir ? 'flex' : 'none';
      }
      if (ctxNewFile) ctxNewFile.style.display = 'flex';
      if (ctxMkdir) ctxMkdir.style.display = 'flex';
    } else {
      const count = selectedList.length;
      if (ctxOpen) ctxOpen.style.display = 'none';
      if (ctxEdit) ctxEdit.style.display = 'none';
      if (ctxDownload) {
        ctxDownload.style.display = pane === 'remote' ? 'flex' : 'none';
        const label = ctxDownload.querySelector('span:last-child');
        if (label) label.textContent = `Download (${count} items)`;
      }
      if (ctxUpload) {
        ctxUpload.style.display = pane === 'local' ? 'flex' : 'none';
        const label = ctxUpload.querySelector('span:last-child');
        if (label) label.textContent = `Upload (${count} items)`;
      }
      if (ctxChmod) ctxChmod.style.display = 'none';
      if (ctxRename) ctxRename.style.display = 'none';
      if (ctxDelete) {
        ctxDelete.style.display = 'flex';
        const label = ctxDelete.querySelector('span:last-child');
        if (label) label.textContent = `Delete (${count} items)`;
      }
      if (ctxCopyPath) {
        ctxCopyPath.style.display = 'flex';
        const label = ctxCopyPath.querySelector('span:last-child');
        if (label) label.textContent = `Copy Paths (${count} items)`;
      }
      if (ctxCalculateSize) ctxCalculateSize.style.display = 'none';
      if (ctxNewFile) ctxNewFile.style.display = 'flex';
      if (ctxMkdir) ctxMkdir.style.display = 'flex';
    }

    menu.style.display = 'block';

    const menuWidth = menu.offsetWidth || 200;
    const menuHeight = menu.offsetHeight || 220;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    if (x + menuWidth > viewportWidth) {
      posX = Math.max(10, viewportWidth - menuWidth - 10);
    }
    if (y + menuHeight > viewportHeight) {
      posY = Math.max(10, viewportHeight - menuHeight - 10);
    }

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
  },

  hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.style.display = 'none';
  },

  async handleContextAction(action) {
    const items = (this.contextItems && this.contextItems.length > 0) ? this.contextItems : (this.contextItem ? [this.contextItem] : []);
    const pane = this.contextPane || 'remote';
    this.hideContextMenu();

    if (action === 'new-file') {
      this.openNewItemModal('file', pane);
      return;
    }

    if (action === 'mkdir') {
      this.openNewItemModal('dir', pane);
      return;
    }

    if (items.length === 0) return;

    if (action === 'open' && items.length === 1) {
      const item = items[0];
      if (item.isDir) {
        if (pane === 'remote') this.refreshRemote(item.path);
        else this.refreshLocal(item.path);
      }
    } else if (action === 'download' && pane === 'remote') {
      for (const item of items) {
        if (window.TransferQueue && window.TransferQueue.isBatchCancelled()) break;
        await this.downloadFile(item.path);
      }
    } else if (action === 'upload' && pane === 'local') {
      for (const item of items) {
        if (window.TransferQueue && window.TransferQueue.isBatchCancelled()) break;
        await this.uploadFile(item.path);
      }
    } else if (action === 'edit' && pane === 'remote' && items.length === 1) {
      this.editRemoteFile(items[0].path);
    } else if (action === 'copy-path') {
      const pathsText = items.map(i => i.path).join('\n');
      navigator.clipboard.writeText(pathsText);
      if (window.LogViewer) window.LogViewer.addEntry('info', `Copied ${items.length} path(s) to clipboard.`);
    } else if (action === 'chmod' && pane === 'remote' && items.length === 1) {
      this.openChmodModal(items[0]);
    } else if (action === 'delete') {
      this.openDeleteConfirmModal(items, pane);
    } else if (action === 'rename' && items.length === 1) {
      this.openRenameModal(items[0], pane);
    } else if (action === 'calculate-size' && items.length === 1) {
      const item = items[0];
      if (item.isDir) {
        const api = this.getApi();
        if (api && api.calculateDirSize) {
          const isRemote = pane === 'remote';
          const sessId = isRemote && window.SessionManager ? window.SessionManager.activeSessionId : null;
          this.calculatedDirSizes.set(item.path, 'Calculating...');
          if (isRemote) {
            this.renderRemoteTable(this.remoteFiles);
          } else {
            this.renderLocalTable(this.localFiles);
          }
          api.calculateDirSize(item.path, isRemote, sessId);
        }
      }
    }
  },

  async downloadFile(remoteFilePath, customLocalDest = null, options = {}) {
    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    if (activeSess && activeSess.connectionState === 'disconnected') {
      alert(`Cannot download file: The remote session "${activeSess.profile ? (activeSess.profile.name || activeSess.profile.host) : 'Server'}" is disconnected. Please reconnect before transferring files.`);
      return;
    }
    if (window.TransferQueue && window.TransferQueue.isBatchCancelled()) return;
    const api = this.getApi();
    const cleanRemotePath = remoteFilePath.replace(/\/+$/, '');
    const fileName = cleanRemotePath.split('/').pop() || 'downloaded_item';
    
    let localDest = customLocalDest;
    if (!localDest) {
      let targetDir = this.localPath;
      if (this.selectedLocal && this.selectedLocal.isDir && this.selectedLocal.path) {
        targetDir = this.selectedLocal.path;
      }
      const baseLocal = targetDir.endsWith('\\') ? targetDir.slice(0, -1) : targetDir;
      localDest = `${baseLocal}\\${fileName}`;
    }
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    if (window.LogViewer) {
      window.LogViewer.addEntry('info', `📥 Starting download: ${remoteFilePath} -> ${localDest}`);
    }

    let transferOptions = { ...options };
    if (api && api.checkFileConflict) {
      try {
        const conflictInfo = await api.checkFileConflict({ type: 'download', localPath: localDest, remotePath: remoteFilePath, sessionId: sessId });
        if (conflictInfo && conflictInfo.conflict) {
          const action = await window.FileConflictDialog.resolveConflict(conflictInfo);
          if (action === 'skip') {
            if (window.LogViewer) window.LogViewer.addEntry('info', `Skipped download for existing file: ${localDest}`);
            return;
          }
          if (action === 'resume') {
            transferOptions.resume = true;
            transferOptions.resumeOffset = conflictInfo.resumeOffset;
          }
          if (action === 'rename') {
            const parts = localDest.split('\\');
            const fname = parts.pop();
            const dotIdx = fname.lastIndexOf('.');
            const nameOnly = dotIdx > 0 ? fname.substring(0, dotIdx) : fname;
            const ext = dotIdx > 0 ? fname.substring(dotIdx) : '';
            localDest = [...parts, `${nameOnly} (1)${ext}`].join('\\');
          }
          if (action === 'newer') {
            const srcTime = conflictInfo.remoteStat ? new Date(conflictInfo.remoteStat.modifyTime).getTime() : 0;
            const dstTime = conflictInfo.localStat ? new Date(conflictInfo.localStat.modifyTime).getTime() : 0;
            if (srcTime <= dstTime) {
              if (window.LogViewer) window.LogViewer.addEntry('info', `Skipped download (existing local file is newer/same age): ${localDest}`);
              return;
            }
          }
        }
      } catch (e) {}
    }

    if (window.TransferQueue) {
      window.TransferQueue.addTransfer('download', remoteFilePath, localDest);
    }

    try {
      await api.downloadFile(remoteFilePath, localDest, sessId, transferOptions);
      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `✅ Download completed: ${localDest}`);
      }
      await this.refreshLocal(this.localPath);
      this.selectLocalItemByName(fileName);
    } catch (err) {
      if (window.LogViewer) {
        window.LogViewer.addEntry('error', `❌ Download failed: ${err.message || err}`);
      }

      const errStr = String(err.message || err || '').toLowerCase();
      const isEperm = errStr.includes('eperm') || errStr.includes('permission') || errStr.includes('operation not permitted') || errStr.includes('access is denied');

      if (isEperm) {
        this.showErrorModal(
          '⚠️ Operation Error',
          localDest,
          "Windows prevents applications from writing directly to system root 'C:\\' without Administrator rights.",
          "Please navigate your left file manager to a writable directory (e.g. Downloads or project folder) or launch DevsFTP using 'Run as Administrator'."
        );
      } else {
        this.showErrorModal(
          '⚠️ Operation Error',
          localDest,
          err.message || 'An unexpected error occurred during file transfer.',
          'Please verify destination permissions and network connection.'
        );
      }
    }
  },

  selectLocalItemByName(name) {
    const rows = Array.from(document.querySelectorAll('#local-file-list tr'));
    const targetRow = rows.find(r => r.textContent.includes(name));
    if (targetRow) {
      rows.forEach(r => r.classList.remove('selected'));
      targetRow.classList.add('selected');
      targetRow.scrollIntoView({ block: 'nearest' });
    }
  },

  async uploadFile(localFilePath, customRemoteDest = null, options = {}) {
    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    if (activeSess && activeSess.connectionState === 'disconnected') {
      alert(`Cannot upload file: The remote session "${activeSess.profile ? (activeSess.profile.name || activeSess.profile.host) : 'Server'}" is disconnected. Please reconnect before transferring files.`);
      return;
    }
    if (window.TransferQueue && window.TransferQueue.isBatchCancelled()) return;
    const api = this.getApi();
    const fileName = localFilePath.split('\\').pop();
    let remoteDest = customRemoteDest || `${this.remotePath}/${fileName}`;
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    let transferOptions = { ...options };
    if (api && api.checkFileConflict) {
      try {
        const conflictInfo = await api.checkFileConflict({ type: 'upload', localPath: localFilePath, remotePath: remoteDest, sessionId: sessId });
        if (conflictInfo && conflictInfo.conflict) {
          const action = await window.FileConflictDialog.resolveConflict(conflictInfo);
          if (action === 'skip') {
            if (window.LogViewer) window.LogViewer.addEntry('info', `Skipped upload for existing file: ${remoteDest}`);
            return;
          }
          if (action === 'resume') {
            transferOptions.resume = true;
            transferOptions.resumeOffset = conflictInfo.resumeOffset;
          }
          if (action === 'rename') {
            const parts = remoteDest.split('/');
            const fname = parts.pop();
            const dotIdx = fname.lastIndexOf('.');
            const nameOnly = dotIdx > 0 ? fname.substring(0, dotIdx) : fname;
            const ext = dotIdx > 0 ? fname.substring(dotIdx) : '';
            remoteDest = [...parts, `${nameOnly} (1)${ext}`].join('/');
          }
          if (action === 'newer') {
            const srcTime = conflictInfo.localStat ? new Date(conflictInfo.localStat.modifyTime).getTime() : 0;
            const dstTime = conflictInfo.remoteStat ? new Date(conflictInfo.remoteStat.modifyTime).getTime() : 0;
            if (srcTime <= dstTime) {
              if (window.LogViewer) window.LogViewer.addEntry('info', `Skipped upload (existing remote file is newer/same age): ${remoteDest}`);
              return;
            }
          }
        }
      } catch (e) {}
    }

    if (window.TransferQueue) {
      window.TransferQueue.addTransfer('upload', localFilePath, remoteDest);
    }
    await api.uploadFile(localFilePath, remoteDest, sessId, transferOptions);
    this.refreshRemote(this.remotePath);
  },

  async openLocalFile(localFilePath) {
    const api = this.getApi();
    if (window.LogViewer) window.LogViewer.addEntry('info', `Opening local file in default editor: ${localFilePath}`);
    if (api && api.localOpen) {
      await api.localOpen(localFilePath);
    }
  },

  async editRemoteFile(remoteFilePath) {
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;
    if (api && api.appendDebugLog) api.appendDebugLog(`[TRACE editRemoteFile ENTERED] remote file path: ${remoteFilePath} | sessionId: ${sessId}`);
    console.log('[CHECKPOINT 3] editRemoteFile() called');
    console.log('[CHECKPOINT 4] Arguments passed to api.editRemoteFile:', { remoteFilePath, sessId });
    if (window.LogViewer) window.LogViewer.addEntry('info', `Opening remote file in default editor: ${remoteFilePath}`);
    await api.editRemoteFile(remoteFilePath, sessId);
  },

  async handleRemoteDrop(e) {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            await this.uploadFile(item.path);
          }
          return;
        } else if (data && data.path) {
          await this.uploadFile(data.path);
          return;
        }
      }
    } catch (err) {}
    if (this.selectedLocalFiles && this.selectedLocalFiles.length > 0) {
      for (const item of this.selectedLocalFiles) {
        await this.uploadFile(item.path);
      }
    } else if (this.selectedLocal) {
      await this.uploadFile(this.selectedLocal.path);
    }
  },

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
};
