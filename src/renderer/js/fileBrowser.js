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

  getLocalSeparator() {
    const p = this.localPath || '';
    return (p.includes('\\') || /^[a-zA-Z]:/.test(p)) ? '\\' : '/';
  },

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
  localSortKey: 'name',
  localSortOrder: 'asc',
  remoteSortKey: 'name',
  remoteSortOrder: 'asc',

  getApi() {
    return window.devsFTP || window.pulseFTP;
  },

  async init() {
    this.calculatedDirSizes = new Map();
    this.setupListeners();
    this.updateSortHeaders();
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

  // =========================================================================
  // Bookmarks Management System (Local, Profile & Global Manager Modal)
  // =========================================================================
  getLocalBookmarks() {
    try {
      const data = localStorage.getItem('devsftp_local_bookmarks');
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },

  saveLocalBookmarks(items) {
    localStorage.setItem('devsftp_local_bookmarks', JSON.stringify(items || []));
  },

  getGlobalBookmarks() {
    try {
      const data = localStorage.getItem('devsftp_global_bookmarks');
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },

  saveGlobalBookmarks(items) {
    localStorage.setItem('devsftp_global_bookmarks', JSON.stringify(items || []));
  },

  getProfileBookmarks(profileId) {
    if (!profileId) return [];
    try {
      const data = localStorage.getItem(`devsftp_profile_bookmarks_${profileId}`);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },

  saveProfileBookmarks(profileId, items) {
    if (!profileId) return;
    localStorage.setItem(`devsftp_profile_bookmarks_${profileId}`, JSON.stringify(items || []));
  },

  getProfileBookmarksMap() {
    const map = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('devsftp_profile_bookmarks_')) {
          const profId = key.replace('devsftp_profile_bookmarks_', '');
          const val = localStorage.getItem(key);
          if (val) {
            try { map[profId] = JSON.parse(val); } catch (e) {}
          }
        }
      }
      const legacy = localStorage.getItem('devsftp_profile_bookmarks');
      if (legacy) {
        try { Object.assign(map, JSON.parse(legacy)); } catch (e) {}
      }
    } catch (e) {}
    return map;
  },

  addLocalBookmark(path) {
    if (!path) return;
    const items = this.getLocalBookmarks();
    if (items.some(i => i.path.toLowerCase() === path.toLowerCase())) return;
    const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
    const name = parts[parts.length - 1] || path;
    items.push({ id: 'bm_l_' + Date.now(), name, path, isRemote: false });
    this.saveLocalBookmarks(items);
    this.renderLocalBookmarksDrawer();
    this.renderLocalTable(this.localFiles);
  },

  deleteLocalBookmark(id) {
    let items = this.getLocalBookmarks();
    items = items.filter(i => i.id !== id);
    this.saveLocalBookmarks(items);
    this.renderLocalBookmarksDrawer();
    this.renderLocalTable(this.localFiles);
  },

  addGlobalBookmark(path, isRemote = false, profileId = null) {
    if (!path) return;
    const items = this.getGlobalBookmarks();
    if (items.some(i => i.path.toLowerCase() === path.toLowerCase())) return;
    const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
    const name = parts[parts.length - 1] || path;
    items.push({ id: 'bm_g_' + Date.now(), name, path, isRemote, profileId });
    this.saveGlobalBookmarks(items);
    this.renderGlobalBookmarksModal();
  },

  deleteGlobalBookmark(id) {
    let items = this.getGlobalBookmarks();
    items = items.filter(i => i.id !== id);
    this.saveGlobalBookmarks(items);
    this.renderGlobalBookmarksModal();
  },

  addProfileBookmark(profileId, path) {
    if (!profileId || !path) return;
    const items = this.getProfileBookmarks(profileId);
    if (items.some(i => i.path.toLowerCase() === path.toLowerCase())) return;
    const parts = path.replace(/\/+$/, '').split('/');
    const name = parts[parts.length - 1] || path;
    items.push({ id: 'bm_p_' + Date.now(), name, path, isRemote: true });
    this.saveProfileBookmarks(profileId, items);
    this.renderProfileBookmarksDrawer();
    this.renderRemoteTable(this.remoteFiles);
  },

  deleteProfileBookmark(profileId, id) {
    if (!profileId) return;
    let items = this.getProfileBookmarks(profileId);
    items = items.filter(i => i.id !== id);
    this.saveProfileBookmarks(profileId, items);
    this.renderProfileBookmarksDrawer();
    this.renderRemoteTable(this.remoteFiles);
  },

  renderLocalBookmarksDrawer() {
    const listEl = document.getElementById('local-bookmarks-list');
    if (!listEl) return;
    const items = this.getLocalBookmarks();
    if (items.length === 0) {
      listEl.innerHTML = '<div style="font-size: 11px; color: hsl(var(--text-muted)); text-align: center; padding: 24px;">No local bookmarks saved yet. Click "+ Add Current Folder" to add one.</div>';
      return;
    }
    listEl.innerHTML = items.map(item => `
      <div class="bookmark-item-row" data-path="${item.path.replace(/"/g, '&quot;')}">
        <div class="bookmark-item-info">
          <span class="bookmark-item-name">💻 ${item.name}</span>
          <span class="bookmark-item-path">${item.path}</span>
        </div>
        <button class="bookmark-delete-btn" title="Delete Bookmark" data-id="${item.id}">🗑️</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.bookmark-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-delete-btn')) {
          const id = e.target.closest('.bookmark-delete-btn').getAttribute('data-id');
          this.deleteLocalBookmark(id);
          return;
        }
        const path = row.getAttribute('data-path');
        this.refreshLocal(path);
      });
    });
  },

  renderProfileBookmarksDrawer() {
    const listEl = document.getElementById('profile-bookmarks-list');
    const titleEl = document.getElementById('profile-bookmarks-title');
    if (!listEl) return;

    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    const profile = activeSess ? activeSess.profile : null;
    const profileId = profile ? (profile.id || profile.host) : null;
    const profileName = profile ? (profile.name || profile.host) : 'Server Profile';

    if (titleEl) titleEl.textContent = `🔖 Bookmarks - ${profileName}`;

    if (!profileId) {
      listEl.innerHTML = '<div style="font-size: 11px; color: hsl(var(--text-muted)); text-align: center; padding: 24px;">No active remote server connection. Connect to a profile to view its bookmarks.</div>';
      return;
    }

    const items = this.getProfileBookmarks(profileId);
    if (items.length === 0) {
      listEl.innerHTML = `<div style="font-size: 11px; color: hsl(var(--text-muted)); text-align: center; padding: 24px;">No profile bookmarks saved for ${profileName}. Click "+ Add Current Folder" to add one.</div>`;
      return;
    }

    listEl.innerHTML = items.map(item => `
      <div class="bookmark-item-row" data-path="${item.path.replace(/"/g, '&quot;')}">
        <div class="bookmark-item-info">
          <span class="bookmark-item-name">🌐 ${item.name}</span>
          <span class="bookmark-item-path">${item.path}</span>
        </div>
        <button class="bookmark-delete-btn" title="Delete Bookmark" data-id="${item.id}">🗑️</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.bookmark-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-delete-btn')) {
          const id = e.target.closest('.bookmark-delete-btn').getAttribute('data-id');
          this.deleteProfileBookmark(profileId, id);
          return;
        }
        const path = row.getAttribute('data-path');
        this.refreshRemote(path);
      });
    });
  },

  getProfileDisplayName(profileId) {
    if (!profileId || profileId === 'local') return 'Local System';
    try {
      if (window.SessionManager) {
        const sessions = window.SessionManager.sessions || [];
        for (const s of (sessions.values ? sessions.values() : Object.values(sessions))) {
          if (s.profile && (s.profile.id === profileId || s.profile.host === profileId)) {
            return s.profile.name || s.profile.host || profileId;
          }
        }
      }
      const raw = localStorage.getItem('devsftp_profiles');
      if (raw) {
        const profiles = JSON.parse(raw);
        const found = profiles.find(p => p.id === profileId || p.host === profileId);
        if (found) return found.name || found.host || profileId;
      }
    } catch (e) {}
    return profileId;
  },

  getProfileColor(profileId) {
    if (!profileId || profileId === 'local') return '#38BDF8';
    try {
      if (window.SessionManager) {
        const sessions = window.SessionManager.sessions || [];
        for (const s of (sessions.values ? sessions.values() : Object.values(sessions))) {
          if (s.profile && (s.profile.id === profileId || s.profile.host === profileId)) {
            return s.profile.profileColor || s.profile.color || s.profile.accentColor || '#68a063';
          }
        }
      }
      const raw = localStorage.getItem('devsftp_profiles');
      if (raw) {
        const profiles = JSON.parse(raw);
        const found = profiles.find(p => p.id === profileId || p.host === profileId);
        if (found) return found.profileColor || found.color || found.accentColor || '#68a063';
      }
    } catch (e) {}
    return '#68a063';
  },

  getAllBookmarksCombined() {
    const combined = [];
    
    // 1. Local Bookmarks
    const localItems = this.getLocalBookmarks();
    localItems.forEach(item => {
      combined.push({
        id: item.id,
        source: 'local',
        profileName: 'Local System',
        profileColor: '#38BDF8',
        typeLabel: '💻 Local',
        name: item.name,
        path: item.path,
        isRemote: false
      });
    });

    // 2. Global Bookmarks
    const globalItems = this.getGlobalBookmarks();
    globalItems.forEach(item => {
      const profileName = item.isRemote ? (this.getProfileDisplayName(item.profileId) || 'Remote Server') : 'Local System';
      const profileColor = item.isRemote ? this.getProfileColor(item.profileId) : '#38BDF8';
      combined.push({
        id: item.id,
        source: 'global',
        profileId: item.profileId || (item.isRemote ? 'remote' : 'local'),
        profileName: profileName,
        profileColor: profileColor,
        typeLabel: item.isRemote ? `🌐 ${profileName}` : '💻 Local System',
        name: item.name,
        path: item.path,
        isRemote: !!item.isRemote
      });
    });

    // 3. Profile Bookmarks (scan localStorage keys)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('devsftp_profile_bookmarks_')) {
          const profileId = key.replace('devsftp_profile_bookmarks_', '');
          const profileName = this.getProfileDisplayName(profileId);
          const profileColor = this.getProfileColor(profileId);
          const items = JSON.parse(localStorage.getItem(key) || '[]');
          items.forEach(item => {
            combined.push({
              id: item.id,
              source: 'profile',
              profileId: profileId,
              profileName: profileName,
              profileColor: profileColor,
              typeLabel: `🌐 ${profileName}`,
              name: item.name,
              path: item.path,
              isRemote: true
            });
          });
        }
      }
    } catch (e) {}

    return combined;
  },

  deleteBookmarkFromAnySource(item) {
    if (!item) return;
    if (item.source === 'local') {
      this.deleteLocalBookmark(item.id);
    } else if (item.source === 'global') {
      this.deleteGlobalBookmark(item.id);
    } else if (item.source === 'profile' && item.profileId) {
      this.deleteProfileBookmark(item.profileId, item.id);
    }
  },

  renderLocalBookmarksDrawer() {
    const listEl = document.getElementById('local-bookmarks-list');
    if (!listEl) return;
    const items = this.getLocalBookmarks();
    if (items.length === 0) {
      listEl.innerHTML = '<div style="font-size: 11px; color: hsl(var(--text-muted)); text-align: center; padding: 24px;">No local bookmarks saved yet. Click "+ Add Current Folder" to add one.</div>';
      return;
    }
    listEl.innerHTML = items.map(item => `
      <div class="bookmark-item-row" data-path="${item.path.replace(/"/g, '&quot;')}">
        <div class="bookmark-item-info">
          <span class="bookmark-item-name">📁 ${item.name}</span>
          <span class="bookmark-item-path">${item.path}</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="bookmark-go-btn bookmark-jump-btn" title="Go to Folder" data-path="${item.path.replace(/"/g, '&quot;')}" data-is-remote="false">➡️</button>
          <button class="bookmark-delete-btn" title="Delete Bookmark" data-id="${item.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.bookmark-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-delete-btn')) {
          const id = e.target.closest('.bookmark-delete-btn').getAttribute('data-id');
          this.deleteLocalBookmark(id);
          return;
        }
        if (e.target.closest('.bookmark-jump-btn') || e.target.closest('.bookmark-item-info')) {
          const path = row.getAttribute('data-path');
          this.refreshLocal(path);
          const drawer = document.getElementById('local-bookmarks-drawer');
          if (drawer) drawer.classList.remove('open');
        }
      });
    });
  },

  renderProfileBookmarksDrawer() {
    const listEl = document.getElementById('profile-bookmarks-list');
    const titleEl = document.getElementById('profile-bookmarks-title');
    if (!listEl) return;

    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    const profile = activeSess ? activeSess.profile : null;
    const profileId = profile ? (profile.id || profile.host) : null;
    const profileName = profile ? (profile.name || profile.host) : 'Server Profile';

    if (titleEl) titleEl.textContent = `🔖 Bookmarks - ${profileName}`;

    if (!profileId) {
      listEl.innerHTML = '<div style="font-size: 11px; color: hsl(var(--text-muted)); text-align: center; padding: 24px;">No active remote server connection. Connect to a profile to view its bookmarks.</div>';
      return;
    }

    const items = this.getProfileBookmarks(profileId);
    if (items.length === 0) {
      listEl.innerHTML = `<div style="font-size: 11px; color: hsl(var(--text-muted)); text-align: center; padding: 24px;">No profile bookmarks saved for ${profileName}. Click "+ Add Current Folder" to add one.</div>`;
      return;
    }

    listEl.innerHTML = items.map(item => `
      <div class="bookmark-item-row" data-path="${item.path.replace(/"/g, '&quot;')}">
        <div class="bookmark-item-info">
          <span class="bookmark-item-name">📁 ${item.name}</span>
          <span class="bookmark-item-path">${item.path}</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="bookmark-go-btn bookmark-jump-btn" title="Go to Folder" data-path="${item.path.replace(/"/g, '&quot;')}" data-is-remote="true">➡️</button>
          <button class="bookmark-delete-btn" title="Delete Bookmark" data-id="${item.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.bookmark-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-delete-btn')) {
          const id = e.target.closest('.bookmark-delete-btn').getAttribute('data-id');
          this.deleteProfileBookmark(profileId, id);
          return;
        }
        if (e.target.closest('.bookmark-jump-btn') || e.target.closest('.bookmark-item-info')) {
          const path = row.getAttribute('data-path');
          this.refreshRemote(path);
          const drawer = document.getElementById('profile-bookmarks-drawer');
          if (drawer) drawer.classList.remove('open');
        }
      });
    });
  },

  renderGlobalBookmarksModal() {
    const tbody = document.getElementById('global-bookmarks-modal-tbody');
    const summaryEl = document.getElementById('global-bookmarks-summary');
    const searchInput = document.getElementById('global-bookmarks-search');
    const typeSelect = document.getElementById('global-bookmarks-type-filter');
    const profileSelect = document.getElementById('global-bookmarks-profile-filter');
    if (!tbody) return;

    let items = this.getAllBookmarksCombined();

    // Populate profile filter options dynamically (matching PendingEditsManager L1740-1744)
    if (profileSelect) {
      const currentSelected = profileSelect.value || 'all';
      const profileMap = new Map();
      items.forEach(i => {
        const profId = i.profileId || (i.isRemote ? 'remote' : 'local');
        const profName = i.profileName || (i.isRemote ? 'Remote Server' : 'Local System');
        const profColor = i.profileColor || (i.isRemote ? '#68a063' : null);
        profileMap.set(profId, { name: profName, color: profColor, isRemote: i.isRemote });
      });
      let profileOpts = '<option value="all">All Server Profiles</option>';
      for (const [pId, info] of profileMap.entries()) {
        if (!info.isRemote) {
          profileOpts += `<option value="${pId}" ${currentSelected === pId ? 'selected' : ''}>💻 ${info.name}</option>`;
        } else {
          profileOpts += `<option value="${pId}" ${currentSelected === pId ? 'selected' : ''} style="color: ${info.color || '#68a063'};">● ${info.name}</option>`;
        }
      }
      profileSelect.innerHTML = profileOpts;
    }

    // Apply Filters
    const typeVal = typeSelect ? typeSelect.value : 'all';
    const profileVal = profileSelect ? profileSelect.value : 'all';
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (typeVal === 'local') {
      items = items.filter(i => !i.isRemote);
    } else if (typeVal === 'remote') {
      items = items.filter(i => i.isRemote);
    }

    if (profileVal !== 'all') {
      items = items.filter(i => (i.profileId || (i.isRemote ? 'remote' : 'local')) === profileVal);
    }

    if (query) {
      items = items.filter(i => 
        (i.name && i.name.toLowerCase().includes(query)) ||
        (i.path && i.path.toLowerCase().includes(query)) ||
        (i.profileName && i.profileName.toLowerCase().includes(query))
      );
    }

    if (summaryEl) {
      summaryEl.innerHTML = `Bookmarks: <strong style="color: #F59E0B;">${items.length}</strong>`;
    }

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: hsl(var(--text-muted)); padding: 40px;">No bookmarks found matching current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(item => {
      const icon = item.isDir ? '📁' : (item.path.includes('.') && !item.path.endsWith('/') ? '📄' : '📁');
      const dotColor = item.profileColor || '#68a063';
      const profileCellHtml = item.isRemote 
        ? `<div style="display: flex; align-items: center; gap: 6px;">
             <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
             <span>${item.profileName}</span>
           </div>`
        : `<div style="display: flex; align-items: center; gap: 6px;">
             <span>💻 Local System</span>
           </div>`;

      return `
        <tr class="file-row" style="border-bottom: 1px solid hsl(var(--border-subtle)); font-size: 12px;">
          <td style="text-align: center; vertical-align: middle;">
            <input type="checkbox" class="global-bm-checkbox" data-id="${item.id}" data-source="${item.source}" data-profile-id="${item.profileId || ''}" checked style="margin: 0; cursor: pointer;">
          </td>
          <td style="font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.name.replace(/"/g, '&quot;')}">
            ${icon} ${item.name}
          </td>
          <td style="font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.profileName.replace(/"/g, '&quot;')}">
            ${profileCellHtml}
          </td>
          <td style="font-family: var(--font-mono); font-size: 11px; color: hsl(var(--text-secondary)); vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.path.replace(/"/g, '&quot;')}">${item.path}</td>
          <td style="text-align: center; vertical-align: middle;">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button class="bookmark-go-btn btn-jump-global-bm" title="Go to Folder" data-path="${item.path.replace(/"/g, '&quot;')}" data-is-remote="${item.isRemote}">➡️</button>
              <button class="bookmark-delete-btn btn-delete-any-bm" title="Delete Bookmark" data-id="${item.id}" data-source="${item.source}" data-profile-id="${item.profileId || ''}">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-jump-global-bm').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        const isRemote = btn.getAttribute('data-is-remote') === 'true';
        this.toggleGlobalBookmarksModal(false);
        if (isRemote) {
          this.refreshRemote(path);
        } else {
          this.refreshLocal(path);
        }
      });
    });

    tbody.querySelectorAll('.btn-delete-any-bm').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const source = btn.getAttribute('data-source');
        const profileId = btn.getAttribute('data-profile-id');
        this.deleteBookmarkFromAnySource({ id, source, profileId });
        this.renderGlobalBookmarksModal();
      });
    });
  },

  toggleLocalBookmarksDrawer(openState) {
    const drawer = document.getElementById('local-bookmarks-drawer');
    if (!drawer) return;
    const shouldOpen = openState !== undefined ? openState : !drawer.classList.contains('open');
    drawer.classList.toggle('open', shouldOpen);
    drawer.setAttribute('aria-hidden', (!shouldOpen).toString());
    if (shouldOpen) {
      this.renderLocalBookmarksDrawer();
    }
  },

  toggleProfileBookmarksDrawer(openState) {
    const drawer = document.getElementById('profile-bookmarks-drawer');
    if (!drawer) return;
    const shouldOpen = openState !== undefined ? openState : !drawer.classList.contains('open');
    drawer.classList.toggle('open', shouldOpen);
    drawer.setAttribute('aria-hidden', (!shouldOpen).toString());
    if (shouldOpen) {
      this.renderProfileBookmarksDrawer();
    }
  },

  toggleGlobalBookmarksModal(openState) {
    const modal = document.getElementById('global-bookmarks-modal');
    if (!modal) return;
    const shouldOpen = openState !== undefined ? openState : !modal.classList.contains('active');
    modal.classList.toggle('active', shouldOpen);
    if (shouldOpen) {
      this.renderGlobalBookmarksModal();
    }
  },

  async getSavedProfiles() {
    let profiles = (window.ConnectionDialog && window.ConnectionDialog.profiles && window.ConnectionDialog.profiles.length > 0)
      ? window.ConnectionDialog.profiles
      : [];
    if (profiles.length === 0) {
      const api = this.getApi();
      if (api && api.profiles && api.profiles.getAll) {
        try {
          profiles = await api.profiles.getAll();
          if (window.ConnectionDialog) {
            window.ConnectionDialog.profiles = profiles;
          }
        } catch (e) {}
      }
    }
    return profiles || [];
  },

  async openRemoteTransferModal(sourceItems = [], defaultProfileId = '') {
    const modal = document.getElementById('remote-transfer-modal');
    if (!modal) return;

    const summaryEl = document.getElementById('remote-transfer-source-summary');
    const pathEl = document.getElementById('remote-transfer-source-path');
    const selectEl = document.getElementById('remote-transfer-target-profile');
    const targetPathInput = document.getElementById('remote-transfer-target-path');

    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    const currentProfileId = activeSess && activeSess.profile ? (activeSess.profile.id || activeSess.profile.host) : '';

    if (summaryEl) {
      const itemsCount = (sourceItems && sourceItems.length) ? sourceItems.length : 1;
      summaryEl.textContent = `Source Items: ${itemsCount} selected item(s)`;
    }
    if (pathEl) {
      pathEl.textContent = `From: ${this.remotePath || '/'}`;
    }

    if (selectEl) {
      const profiles = await this.getSavedProfiles();
      let options = '<option value="">Select Destination Server Profile...</option>';
      profiles.forEach(p => {
        const pId = p.id || p.host;
        if (pId !== currentProfileId) {
          const color = p.profileColor || p.color || '#68a063';
          const pName = p.name || p.host;
          const isSel = defaultProfileId === pId ? 'selected' : '';
          options += `<option value="${pId}" ${isSel} style="color: ${color};">● ${pName}</option>`;
        }
      });
      selectEl.innerHTML = options;
    }

    if (targetPathInput && !targetPathInput.value) {
      targetPathInput.value = '/';
    }

    modal.classList.add('active');
  },

  closeRemoteTransferModal() {
    const modal = document.getElementById('remote-transfer-modal');
    if (modal) modal.classList.remove('active');
  },

  async populateRemoteTransferSubmenu() {
    const submenu = document.getElementById('ctx-remote-transfer-submenu');
    if (!submenu) return;

    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    const currentProfileId = activeSess && activeSess.profile ? (activeSess.profile.id || activeSess.profile.host) : '';
    const profiles = await this.getSavedProfiles();

    const otherProfiles = profiles.filter(p => (p.id || p.host) !== currentProfileId);
    if (otherProfiles.length === 0) {
      submenu.innerHTML = '<div class="context-menu-item disabled">No other server profiles</div>';
      return;
    }

    submenu.innerHTML = otherProfiles.map(p => {
      const pId = p.id || p.host;
      const pName = p.name || p.host;
      const color = p.profileColor || p.color || '#68a063';
      return `<div class="context-menu-item ctx-remote-transfer-opt" data-profile-id="${pId}">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; flex-shrink: 0; margin-right: 6px;"></span>
        <span>${pName}</span>
      </div>`;
    }).join('');

    submenu.querySelectorAll('.ctx-remote-transfer-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = opt.getAttribute('data-profile-id');
        this.openRemoteTransferModal(this.selectedRemoteFiles || [], pId);
        const ctxMenu = document.getElementById('context-menu');
        if (ctxMenu) ctxMenu.style.display = 'none';
      });
    });
  },

  setupListeners() {
    // Remote-to-Remote Transfer Modal Controls
    const btnRemoteTransferClose = document.getElementById('btn-remote-transfer-close');
    if (btnRemoteTransferClose) btnRemoteTransferClose.addEventListener('click', () => this.closeRemoteTransferModal());

    const btnRemoteTransferCancel = document.getElementById('btn-remote-transfer-cancel');
    if (btnRemoteTransferCancel) btnRemoteTransferCancel.addEventListener('click', () => this.closeRemoteTransferModal());

    const btnRemoteTransferSubmit = document.getElementById('btn-remote-transfer-submit');
    if (btnRemoteTransferSubmit) {
      btnRemoteTransferSubmit.addEventListener('click', async () => {
        const selectEl = document.getElementById('remote-transfer-target-profile');
        const pathEl = document.getElementById('remote-transfer-target-path');
        const targetProfileId = selectEl ? selectEl.value : '';
        const targetDir = pathEl ? pathEl.value.trim() : '/';

        if (!targetProfileId) {
          alert('Please select a destination server profile.');
          return;
        }

        const items = (this.selectedRemoteFiles && this.selectedRemoteFiles.length > 0)
          ? this.selectedRemoteFiles
          : (this.selectedRemote ? [this.selectedRemote] : []);

        if (items.length === 0) {
          alert('No source remote files selected to transfer.');
          return;
        }

        const profiles = await this.getSavedProfiles();
        const targetProf = profiles.find(p => (p.id || p.host) === targetProfileId);
        const targetName = targetProf ? (targetProf.name || targetProf.host) : targetProfileId;

        const api = this.getApi();
        const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
        const sourceSessionId = activeSess ? activeSess.sessionId : null;
        const sourceProfileId = activeSess && activeSess.profile ? activeSess.profile.id : 'default';

        this.closeRemoteTransferModal();

        if (window.LogViewer) {
          window.LogViewer.addEntry('info', `Starting Remote-to-Remote transfer of ${items.length} item(s) to ${targetName} (${targetDir})...`);
        }

        for (const item of items) {
          const destPath = targetDir.endsWith('/') ? `${targetDir}${item.name}` : `${targetDir}/${item.name}`;
          let taskId = null;
          try {
            if (window.TransferQueue) {
              taskId = window.TransferQueue.addTransfer('remote-to-remote', item.path, destPath, targetProfileId, sourceProfileId);
            }
            if (api && api.remoteToRemoteTransfer) {
              await api.remoteToRemoteTransfer({
                taskId: taskId,
                sourcePath: item.path,
                targetProfileId: targetProfileId,
                targetPath: destPath,
                sourceSessionId: sourceSessionId,
                isDir: item.isDir
              });
              if (window.TransferQueue && taskId) {
                window.TransferQueue.handleProgress({ taskId: taskId, percentage: 100, status: 'Completed' });
              }
            }
          } catch (err) {
            if (window.TransferQueue && taskId) {
              window.TransferQueue.handleProgress({ taskId: taskId, status: 'Failed' });
            }
            console.error(`Remote-to-Remote transfer error for ${item.name}:`, err);
            alert(`Remote transfer failed for ${item.name}: ${err.message}`);
          }
        }
      });
    }
    // Local Controls
    document.getElementById('btn-local-refresh').addEventListener('click', () => this.refreshLocal(this.localPath));
    const btnLocalHome = document.getElementById('btn-local-home');
    if (btnLocalHome) {
      btnLocalHome.addEventListener('click', async () => {
        const api = this.getApi();
        let homePath = 'C:\\';
        if (api && api.localHome) {
          try { homePath = await api.localHome(); } catch (e) {}
        }
        this.refreshLocal(homePath);
      });
    }
    const btnLocalRoot = document.getElementById('btn-local-root');
    if (btnLocalRoot) {
      btnLocalRoot.addEventListener('click', () => {
        const driveMatch = (this.localPath || '').match(/^([a-zA-Z]:)/);
        const rootPath = driveMatch ? `${driveMatch[1]}\\` : 'C:\\';
        this.refreshLocal(rootPath);
      });
    }
    document.getElementById('btn-local-up').addEventListener('click', () => this.localUp());
    document.getElementById('local-path-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.refreshLocal(e.target.value);
    });
    document.getElementById('local-filter').addEventListener('input', (e) => this.filterLocal(e.target.value));

    // Remote Controls
    document.getElementById('btn-remote-refresh').addEventListener('click', () => this.refreshRemote(this.remotePath));
    const btnRemoteHome = document.getElementById('btn-remote-home');
    if (btnRemoteHome) {
      btnRemoteHome.addEventListener('click', () => {
        const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
        const initialPath = (activeSess && activeSess.profile && activeSess.profile.initialPath) ? activeSess.profile.initialPath : '/';
        this.refreshRemote(initialPath || '/');
      });
    }
    const btnRemoteRoot = document.getElementById('btn-remote-root');
    if (btnRemoteRoot) {
      btnRemoteRoot.addEventListener('click', () => {
        this.refreshRemote('/');
      });
    }
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

    // Local Bookmarks Listeners
    const btnLocalBm = document.getElementById('btn-local-bookmarks');
    const btnCloseLocalBm = document.getElementById('btn-close-local-bookmarks');
    const btnAddLocalBm = document.getElementById('btn-add-local-bookmark');

    if (btnLocalBm) btnLocalBm.addEventListener('click', () => this.toggleLocalBookmarksDrawer());
    if (btnCloseLocalBm) btnCloseLocalBm.addEventListener('click', () => this.toggleLocalBookmarksDrawer(false));
    if (btnAddLocalBm) btnAddLocalBm.addEventListener('click', () => this.addLocalBookmark(this.localPath));

    // Global Bookmarks Manager Modal Listeners
    const btnHeaderGlobalBm = document.getElementById('btn-header-global-bookmarks');
    const btnCloseGlobalModalBm = document.getElementById('btn-global-bookmarks-modal-close');
    const btnAddGlobalLocalFolder = document.getElementById('btn-add-global-local-folder');
    const btnAddGlobalRemoteFolder = document.getElementById('btn-add-global-remote-folder');
    const searchGlobalBm = document.getElementById('global-bookmarks-search');

    if (btnHeaderGlobalBm) btnHeaderGlobalBm.addEventListener('click', () => this.toggleGlobalBookmarksModal());
    if (btnCloseGlobalModalBm) btnCloseGlobalModalBm.addEventListener('click', () => this.toggleGlobalBookmarksModal(false));
    if (btnAddGlobalLocalFolder) btnAddGlobalLocalFolder.addEventListener('click', () => this.addGlobalBookmark(this.localPath, false));
    if (btnAddGlobalRemoteFolder) {
      btnAddGlobalRemoteFolder.addEventListener('click', () => {
        const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
        const profileId = activeSess && activeSess.profile ? (activeSess.profile.id || activeSess.profile.host) : null;
        if (this.remotePath && this.remotePath !== '/') {
          this.addGlobalBookmark(this.remotePath, true, profileId);
        } else {
          alert('⚠️ Please select or open a remote directory before bookmarking.');
        }
      });
    }
    if (searchGlobalBm) {
      searchGlobalBm.addEventListener('input', () => this.renderGlobalBookmarksModal());
    }

    // Global Bookmarks Select All & Bulk Delete Listeners
    const selectAllBm = document.getElementById('global-bookmarks-select-all');
    if (selectAllBm) {
      selectAllBm.addEventListener('change', (e) => {
        document.querySelectorAll('.global-bm-checkbox').forEach(cb => cb.checked = e.target.checked);
      });
    }

    const btnDeleteSelectedBm = document.getElementById('btn-global-bookmarks-delete-selected');
    if (btnDeleteSelectedBm) {
      btnDeleteSelectedBm.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.global-bm-checkbox:checked');
        if (checkboxes.length === 0) {
          alert('Please check at least one bookmark to delete.');
          return;
        }
        checkboxes.forEach(cb => {
          const id = cb.getAttribute('data-id');
          const source = cb.getAttribute('data-source');
          const profileId = cb.getAttribute('data-profile-id');
          this.deleteBookmarkFromAnySource({ id, source, profileId });
        });
        this.renderGlobalBookmarksModal();
      });
    }

    const btnCancelGlobalModalBm = document.getElementById('btn-global-bookmarks-cancel');
    if (btnCancelGlobalModalBm) btnCancelGlobalModalBm.addEventListener('click', () => this.toggleGlobalBookmarksModal(false));

    // Profile Bookmarks Toggle & Drawer Listeners
    const btnRemoteBm = document.getElementById('btn-remote-bookmarks');
    const btnCloseProfileBm = document.getElementById('btn-close-profile-bookmarks');
    const btnAddProfileBm = document.getElementById('btn-add-profile-bookmark');

    if (btnRemoteBm) btnRemoteBm.addEventListener('click', () => this.toggleProfileBookmarksDrawer());
    if (btnCloseProfileBm) btnCloseProfileBm.addEventListener('click', () => this.toggleProfileBookmarksDrawer(false));
    if (btnAddProfileBm) {
      btnAddProfileBm.addEventListener('click', () => {
        const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
        const profileId = activeSess && activeSess.profile ? (activeSess.profile.id || activeSess.profile.host) : null;
        if (profileId) {
          this.addProfileBookmark(profileId, this.remotePath);
        } else {
          alert('⚠️ Please connect to a server profile before adding profile bookmarks.');
        }
      });
    }

    // Global click listener to hide context menu
    document.addEventListener('click', (e) => {
      if (e.target.closest('#context-menu')) return;
      this.hideContextMenu();
    });
    
    // Setup Context Menu Action Listeners
    document.getElementById('ctx-open').addEventListener('click', (e) => {
      this.handleContextAction('open');
    });
    document.getElementById('ctx-edit').addEventListener('click', (e) => {
      this.handleContextAction('edit');
    });
    document.getElementById('ctx-download').addEventListener('click', (e) => {
      this.handleContextAction('download');
    });
    document.getElementById('ctx-upload').addEventListener('click', (e) => {
      this.handleContextAction('upload');
    });
    document.getElementById('ctx-copy-path').addEventListener('click', (e) => {
      this.handleContextAction('copy-path');
    });
    document.getElementById('ctx-calculate-size').addEventListener('click', (e) => {
      this.handleContextAction('calculate-size');
    });
    document.getElementById('ctx-chmod').addEventListener('click', (e) => {
      this.handleContextAction('chmod');
    });
    document.getElementById('ctx-bookmark-add').addEventListener('click', (e) => {
      this.handleContextAction('bookmark-add');
    });
    document.getElementById('ctx-bookmark-remove').addEventListener('click', (e) => {
      this.handleContextAction('bookmark-remove');
    });
    document.getElementById('ctx-new-file').addEventListener('click', (e) => {
      this.handleContextAction('new-file');
    });
    document.getElementById('ctx-mkdir').addEventListener('click', (e) => {
      this.handleContextAction('mkdir');
    });
    document.getElementById('ctx-rename').addEventListener('click', (e) => {
      this.handleContextAction('rename');
    });
    document.getElementById('ctx-move').addEventListener('click', (e) => {
      this.handleContextAction('move');
    });
    document.getElementById('ctx-copy-to').addEventListener('click', (e) => {
      this.handleContextAction('copy-to');
    });
    document.getElementById('ctx-duplicate').addEventListener('click', (e) => {
      this.handleContextAction('duplicate');
    });
    document.getElementById('ctx-delete').addEventListener('click', (e) => {
      this.handleContextAction('delete');
    });

    // SSH Commands Submenu Listeners
    document.getElementById('ssh-cmd-compress').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('ssh-compress');
    });
    document.getElementById('ssh-cmd-extract').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('ssh-extract');
    });
    document.getElementById('ssh-cmd-grep').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('ssh-grep');
    });
    document.getElementById('ssh-cmd-find').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('ssh-find');
    });
    document.getElementById('ssh-cmd-du').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('ssh-du');
    });

    document.getElementById('ctx-download-as').addEventListener('click', (e) => {
      this.handleContextAction('download-as');
    });
    document.getElementById('ctx-sort-name').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('sort-name');
    });
    document.getElementById('ctx-sort-size').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('sort-size');
    });
    document.getElementById('ctx-sort-date').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('sort-date');
    });
    document.getElementById('ctx-sort-type').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleContextAction('sort-type');
    });
    document.getElementById('ctx-properties').addEventListener('click', (e) => {
      this.handleContextAction('properties');
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

    // Batch Rename Modal Event Listeners
    const btnBatchRenameClose = document.getElementById('btn-batch-rename-close-icon');
    const btnBatchRenameCancel = document.getElementById('btn-batch-rename-cancel');
    const btnBatchRenameSubmit = document.getElementById('btn-batch-rename-submit');
    const batchRenameMode = document.getElementById('batch-rename-mode');

    if (btnBatchRenameClose) btnBatchRenameClose.addEventListener('click', () => this.closeBatchRenameModal());
    if (btnBatchRenameCancel) btnBatchRenameCancel.addEventListener('click', () => this.closeBatchRenameModal());
    if (btnBatchRenameSubmit) btnBatchRenameSubmit.addEventListener('click', () => this.submitBatchRename());
    if (batchRenameMode) {
      batchRenameMode.addEventListener('change', (e) => {
        const mode = e.target.value;
        document.querySelectorAll('.batch-rename-group').forEach(el => el.style.display = 'none');
        if (mode === 'prefix-suffix') {
          document.getElementById('batch-rename-prefix-suffix-group').style.display = 'block';
        } else if (mode === 'find-replace') {
          document.getElementById('batch-rename-find-replace-group').style.display = 'block';
        } else if (mode === 'sequential') {
          document.getElementById('batch-rename-sequential-group').style.display = 'block';
        }
      });
    }

    // Move/Copy Modal Event Listeners
    const btnMoveClose = document.getElementById('btn-move-modal-close');
    const btnMoveCancel = document.getElementById('btn-move-cancel');
    const btnMoveSubmit = document.getElementById('btn-move-submit');
    const movePathInput = document.getElementById('move-item-path-input');

    if (btnMoveClose) btnMoveClose.addEventListener('click', () => this.closeMoveModal());
    if (btnMoveCancel) btnMoveCancel.addEventListener('click', () => this.closeMoveModal());
    if (btnMoveSubmit) btnMoveSubmit.addEventListener('click', () => this.submitMoveOrCopy());
    if (movePathInput) {
      movePathInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.submitMoveOrCopy();
        if (e.key === 'Escape') this.closeMoveModal();
      });
    }

    // Delete Confirmation Modal Event Listeners
    const btnDelClose = document.getElementById('btn-confirm-delete-close');
    const btnDelCancel = document.getElementById('btn-confirm-delete-cancel');
    const btnDelSubmit = document.getElementById('btn-confirm-delete-submit');

    if (btnDelClose) btnDelClose.addEventListener('click', () => this.closeDeleteConfirmModal());
    if (btnDelCancel) btnDelCancel.addEventListener('click', () => this.closeDeleteConfirmModal());
    if (btnDelSubmit) btnDelSubmit.addEventListener('click', () => this.submitDelete());

    // SSH Prompt Modal Event Listeners
    const btnSshClose = document.getElementById('btn-ssh-prompt-close');
    const btnSshCancel = document.getElementById('btn-ssh-prompt-cancel');
    const btnSshSubmit = document.getElementById('btn-ssh-prompt-submit');
    const sshPromptInput = document.getElementById('ssh-prompt-input');

    if (btnSshClose) btnSshClose.addEventListener('click', () => this.closeSshPromptModal());
    if (btnSshCancel) btnSshCancel.addEventListener('click', () => this.closeSshPromptModal());
    if (btnSshSubmit) btnSshSubmit.addEventListener('click', () => this.submitSshPrompt());
    if (sshPromptInput) {
      sshPromptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.submitSshPrompt();
        if (e.key === 'Escape') this.closeSshPromptModal();
      });
    }

    // Sortable Headers Event Listeners
    document.querySelectorAll('.sortable-header').forEach(th => {
      th.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('col-resizer')) return;
        const pane = th.getAttribute('data-pane');
        const key = th.getAttribute('data-sort-key');
        
        if (pane === 'local') {
          if (this.localSortKey === key) {
            this.localSortOrder = this.localSortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            this.localSortKey = key;
            this.localSortOrder = 'asc';
          }
          this.renderLocalTable(this.localFiles);
        } else {
          if (this.remoteSortKey === key) {
            this.remoteSortOrder = this.remoteSortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            this.remoteSortKey = key;
            this.remoteSortOrder = 'asc';
          }
          this.renderRemoteTable(this.remoteFiles);
        }
        this.updateSortHeaders();
      });
    });

    // Drag & Drop Dual-Pane Listeners
    this.setupDragAndDrop();

    // Initialize Column Resizing
    this.initColumnResizing();

    // Search Drawer Panel Listeners
    const btnCloseSearch = document.getElementById('btn-close-search-tab');
    const btnClearSearch = document.getElementById('btn-clear-search');
    if (btnCloseSearch) {
      btnCloseSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearSearchResults();
        this.hideSearchTab();
      });
    }
    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        this.clearSearchResults();
      });
    }
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

      localPane.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        localPane.classList.remove('dropzone-active');
        if (this.dragSourcePane === 'local') return;

        if (window.FileConflictDialog) window.FileConflictDialog.resetBatch();

        try {
          const raw = e.dataTransfer.getData('application/json');
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.sourcePane === 'remote') {
              if (data.items && data.items.length > 0) {
                await this.downloadBatchItems(data.items);
              } else if (data.path) {
                await this.downloadBatchItems([{ path: data.path, name: data.name }]);
              }
            }
          }
        } catch (err) {
          if (window.LogViewer) window.LogViewer.addEntry('error', `Drop download failed: ${err.message || err}`);
          alert(`Failed to complete drop download: ${err.message || err}`);
        }
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

      remotePane.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        remotePane.classList.remove('dropzone-active');
        if (this.dragSourcePane === 'remote') return;

        if (window.FileConflictDialog) window.FileConflictDialog.resetBatch();

        try {
          // External OS Desktop/Explorer Drag & Drop Files
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(f => f.path).map(f => ({ path: f.path, name: f.name || f.path.replace(/\\/g, '/').split('/').pop(), size: f.size }));
            await this.uploadBatchItems(files);
            return;
          }

          // Internal Pane Drag & Drop
          const raw = e.dataTransfer.getData('application/json');
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.sourcePane === 'local') {
              if (data.items && data.items.length > 0) {
                await this.uploadBatchItems(data.items);
              } else if (data.path) {
                await this.uploadBatchItems([{ path: data.path, name: data.name }]);
              }
            }
          }
        } catch (err) {
          if (window.LogViewer) window.LogViewer.addEntry('error', `Drop upload failed: ${err.message || err}`);
          alert(`Failed to complete drop upload: ${err.message || err}`);
        }
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

  openChmodModal(items) {
    // Accepts a single item or array of items (batch chmod support)
    const itemsArr = Array.isArray(items) ? items : [items];
    if (!itemsArr.length) return;
    this.hideContextMenu();
    this.chmodTargetItems = itemsArr;
    this.chmodTargetItem = itemsArr[0]; // keep for single-item backward compat
    this.chmodTargetPane = 'remote';

    const modal = document.getElementById('chmod-modal');
    const title = document.getElementById('chmod-modal-title');
    const pathVal = document.getElementById('chmod-modal-target-path');
    const presetSelect = document.getElementById('chmod-edit-preset-select');

    if (!modal) return;

    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    if (itemsArr.length === 1) {
      if (title) title.textContent = `🔐 Permissions (CHMOD) - ${itemsArr[0].name}`;
      if (pathVal) {
        pathVal.innerHTML = `<span style="font-family: var(--font-mono); font-size: 11px;">${escapeHtml(itemsArr[0].path)}</span>`;
      }
    } else {
      if (title) title.textContent = `🔐 Permissions (CHMOD) - ${itemsArr.length} items`;
      if (pathVal) {
        const listHtml = `
          <div class="chmod-target-list" style="max-height: 90px; overflow-y: auto; border: 1px solid hsl(var(--border-subtle)); padding: 6px 10px; border-radius: 4px; background-color: rgba(0,0,0,0.15); margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
            ${itemsArr.map(i => `
              <div style="font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <input type="checkbox" class="chmod-target-checkbox" data-path="${escapeHtml(i.path)}" checked style="margin: 0; cursor: pointer;">
                <span>${i.isDir ? '📁' : '📄'}</span>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(i.name)}">${escapeHtml(i.name)}</span>
              </div>
            `).join('')}
          </div>
        `;
        pathVal.innerHTML = listHtml;
      }
    }

    // Seed checkboxes from first item's current permissions
    const initialOctal = this.parsePermissionsToOctal(itemsArr[0].permissions || (itemsArr[0].isDir ? 'rwxr-xr-x' : 'rw-r--r--'));
    if (presetSelect) presetSelect.value = initialOctal;
    this.applyEditChmodPreset(initialOctal);

    modal.classList.add('active');
  },

  closeChmodModal() {
    const modal = document.getElementById('chmod-modal');
    if (modal) modal.classList.remove('active');
    this.restorePaneFocus();
  },

  openBatchRenameModal(items, pane) {
    const itemsArr = Array.isArray(items) ? items : [items];
    if (!itemsArr.length) return;
    this.hideContextMenu();
    this.batchRenameTargetItems = itemsArr;
    this.batchRenameTargetPane = pane || 'remote';

    const modal = document.getElementById('batch-rename-modal');
    const listContainer = document.getElementById('batch-rename-modal-target-list');
    if (!modal) return;

    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    // Render checkbox-based scrollable list of target files
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="batch-rename-target-list" style="max-height: 90px; overflow-y: auto; border: 1px solid hsl(var(--border-subtle)); padding: 6px 10px; border-radius: 4px; background-color: rgba(0,0,0,0.15); margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
          ${itemsArr.map(i => `
            <div style="font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              <input type="checkbox" class="batch-rename-target-checkbox" data-path="${escapeHtml(i.path)}" data-name="${escapeHtml(i.name)}" checked style="margin: 0; cursor: pointer;">
              <span>${i.isDir ? '📁' : '📄'}</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(i.name)}">${escapeHtml(i.name)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Reset input fields
    const prefixInput = document.getElementById('batch-rename-prefix');
    const suffixInput = document.getElementById('batch-rename-suffix');
    const findInput = document.getElementById('batch-rename-find');
    const replaceInput = document.getElementById('batch-rename-replace');
    const baseInput = document.getElementById('batch-rename-base');
    const startInput = document.getElementById('batch-rename-start');
    const modeSelect = document.getElementById('batch-rename-mode');

    if (prefixInput) prefixInput.value = '';
    if (suffixInput) suffixInput.value = '';
    if (findInput) findInput.value = '';
    if (replaceInput) replaceInput.value = '';
    if (baseInput) baseInput.value = '';
    if (startInput) startInput.value = '1';
    if (modeSelect) {
      modeSelect.value = 'prefix-suffix';
      // Trigger change to update group visibility
      modeSelect.dispatchEvent(new Event('change'));
    }

    modal.classList.add('active');
  },

  closeBatchRenameModal() {
    const modal = document.getElementById('batch-rename-modal');
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

  openMoveModal(item, mode, pane) {
    if (!item) return;
    this.hideContextMenu();
    this.moveTargetItem = item;
    this.moveTargetMode = mode; // 'move' or 'copy'
    this.moveTargetPane = pane || 'remote';

    const modal = document.getElementById('move-modal');
    const title = document.getElementById('move-modal-title');
    const pathVal = document.getElementById('move-modal-target-path');
    const pathInput = document.getElementById('move-item-path-input');
    const label = document.getElementById('move-item-path-label');
    const submitBtn = document.getElementById('btn-move-submit');

    if (!modal) return;

    const icon = item.isDir ? '📁' : '📄';
    const typeLabel = item.isDir ? 'Directory' : 'File';
    
    if (mode === 'move') {
      if (title) title.textContent = `📦 Move ${typeLabel}`;
      if (label) label.textContent = 'New Destination Path';
      if (submitBtn) {
        submitBtn.innerHTML = '📦 Move Item';
        submitBtn.className = 'btn btn-primary';
      }
    } else {
      if (title) title.textContent = `📋 Copy ${typeLabel} To...`;
      if (label) label.textContent = 'Copy Destination Path';
      if (submitBtn) {
        submitBtn.innerHTML = '⚡ Copy Item';
        submitBtn.className = 'btn btn-primary';
      }
    }

    if (pathVal) pathVal.textContent = item.path;
    if (pathInput) {
      pathInput.value = item.path;
      pathInput.style.borderColor = '';
    }

    modal.classList.add('active');
    setTimeout(() => {
      if (pathInput) {
        pathInput.focus();
        pathInput.select();
      }
    }, 100);
  },

  closeMoveModal() {
    const modal = document.getElementById('move-modal');
    if (modal) modal.classList.remove('active');
    this.moveTargetItem = null;
    this.restorePaneFocus();
  },

  showSshPromptModal(title, label, placeholder, defaultValue, onSubmit) {
    const modal = document.getElementById('ssh-prompt-modal');
    const titleEl = document.getElementById('ssh-prompt-modal-title');
    const labelEl = document.getElementById('ssh-prompt-label');
    const inputEl = document.getElementById('ssh-prompt-input');

    if (titleEl) titleEl.textContent = title;
    if (labelEl) labelEl.textContent = label;
    if (inputEl) {
      inputEl.placeholder = placeholder;
      inputEl.value = defaultValue || '';
    }

    this.sshPromptSubmitCallback = onSubmit;
    if (modal) modal.classList.add('active');

    setTimeout(() => {
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 100);
  },

  closeSshPromptModal() {
    const modal = document.getElementById('ssh-prompt-modal');
    if (modal) modal.classList.remove('active');
    const inputEl = document.getElementById('ssh-prompt-input');
    if (inputEl) inputEl.value = '';
    this.sshPromptSubmitCallback = null;
    this.restorePaneFocus();
  },

  submitSshPrompt() {
    const inputEl = document.getElementById('ssh-prompt-input');
    const value = inputEl ? inputEl.value.trim() : '';
    if (typeof this.sshPromptSubmitCallback === 'function') {
      this.sshPromptSubmitCallback(value);
    }
    this.closeSshPromptModal();
  },

  async submitMoveOrCopy() {
    if (!this.moveTargetItem) return;
    const pathInput = document.getElementById('move-item-path-input');
    const newPath = pathInput ? pathInput.value.trim() : '';

    if (!newPath) {
      if (pathInput) {
        pathInput.style.borderColor = 'hsl(var(--status-danger))';
        pathInput.focus();
      }
      return;
    }

    if (pathInput) pathInput.style.borderColor = '';
    const item = this.moveTargetItem;
    const mode = this.moveTargetMode || 'move';
    const pane = this.moveTargetPane || 'remote';
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    if (newPath === item.path) {
      this.closeMoveModal();
      return;
    }

    this.closeMoveModal();

    try {
      if (mode === 'move') {
        if (pane === 'remote') {
          await api.remoteRename(item.path, newPath, sessId);
          this.refreshRemote(this.remotePath);
        } else if (pane === 'local') {
          await api.localRename(item.path, newPath);
          this.refreshLocal(this.localPath);
        }
        if (window.LogViewer) {
          window.LogViewer.addEntry('info', `📦 Moved item: ${item.name} -> ${newPath}`);
        }
      } else {
        if (pane === 'remote') {
          if (api.remoteCopy) {
            await api.remoteCopy(item.path, newPath, sessId);
            this.refreshRemote(this.remotePath);
          } else {
            throw new Error('Remote copy is not supported.');
          }
        } else if (pane === 'local') {
          if (api.localCopy) {
            await api.localCopy(item.path, newPath);
            this.refreshLocal(this.localPath);
          } else {
            throw new Error('Local copy is not supported.');
          }
        }
        if (window.LogViewer) {
          window.LogViewer.addEntry('info', `📋 Copied item: ${item.name} -> ${newPath}`);
        }
      }
    } catch (err) {
      const cleanMsg = err && err.message ? err.message : String(err);
      alert(`Failed to ${mode} ${item.name}: ${cleanMsg}`);
      if (pane === 'remote') this.refreshRemote(this.remotePath);
      else this.refreshLocal(this.localPath);
    }
  },

  async duplicateItem(item, pane) {
    if (!item) return;
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;
    
    let newPath = '';
    if (pane === 'remote') {
      const parts = item.path.split('/');
      const fname = parts.pop();
      const dotIdx = fname.lastIndexOf('.');
      const nameOnly = dotIdx > 0 ? fname.substring(0, dotIdx) : fname;
      const ext = dotIdx > 0 ? fname.substring(dotIdx) : '';
      newPath = [...parts, `${nameOnly}_copy${ext}`].join('/');
    } else {
      const sep = this.getLocalSeparator();
      const parts = item.path.split(sep);
      const fname = parts.pop();
      const dotIdx = fname.lastIndexOf('.');
      const nameOnly = dotIdx > 0 ? fname.substring(0, dotIdx) : fname;
      const ext = dotIdx > 0 ? fname.substring(dotIdx) : '';
      newPath = [...parts, `${nameOnly}_copy${ext}`].join(sep);
    }

    try {
      if (pane === 'remote') {
        if (api.remoteCopy) {
          await api.remoteCopy(item.path, newPath, sessId);
          this.refreshRemote(this.remotePath);
        }
      } else {
        if (api.localCopy) {
          await api.localCopy(item.path, newPath);
          this.refreshLocal(this.localPath);
        }
      }
      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `👯 Duplicated item: ${item.name} -> ${newPath}`);
      }
    } catch (err) {
      const cleanMsg = err && err.message ? err.message : String(err);
      alert(`Failed to duplicate ${item.name}: ${cleanMsg}`);
    }
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

  async submitBatchRename() {
    if (!this.batchRenameTargetItems || !this.batchRenameTargetItems.length) return;
    
    // Filter by checked checkboxes in the UI target list
    const checkboxes = document.querySelectorAll('.batch-rename-target-checkbox');
    const checkedItems = [];
    checkboxes.forEach((cb, index) => {
      if (cb.checked) {
        checkedItems.push(this.batchRenameTargetItems[index]);
      }
    });

    if (!checkedItems.length) {
      alert('Please check at least one item to rename.');
      return;
    }

    const mode = document.getElementById('batch-rename-mode').value;
    const pane = this.batchRenameTargetPane || 'remote';
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    this.closeBatchRenameModal();

    const isRemote = pane === 'remote';
    const separator = isRemote ? '/' : '\\';
    const errors = [];
    let seqIndex = 0;

    for (const item of checkedItems) {
      const filename = item.name;
      const lastIndex = item.path.lastIndexOf(separator);
      const parentDir = lastIndex <= 0 ? '' : item.path.substring(0, lastIndex);

      // Split filename and extension
      const dotIndex = filename.lastIndexOf('.');
      let baseName = filename;
      let ext = '';
      if (dotIndex > 0 && !item.isDir) {
        baseName = filename.substring(0, dotIndex);
        ext = filename.substring(dotIndex);
      }

      let newName = filename;

      if (mode === 'prefix-suffix') {
        const prefix = document.getElementById('batch-rename-prefix').value;
        const suffix = document.getElementById('batch-rename-suffix').value;
        newName = `${prefix}${baseName}${suffix}${ext}`;
      } else if (mode === 'find-replace') {
        const findVal = document.getElementById('batch-rename-find').value;
        const replaceVal = document.getElementById('batch-rename-replace').value;
        if (findVal) {
          newName = filename.split(findVal).join(replaceVal);
        }
      } else if (mode === 'sequential') {
        const basePattern = document.getElementById('batch-rename-base').value || 'file_';
        const startNum = parseInt(document.getElementById('batch-rename-start').value || '1', 10);
        const padding = parseInt(document.getElementById('batch-rename-padding').value || '3', 10);
        const currentNum = startNum + seqIndex;
        const paddedNum = String(currentNum).padStart(padding, '0');
        newName = `${basePattern}${paddedNum}${ext}`;
        seqIndex++;
      }

      // Skip renaming if the name hasn't changed
      if (newName === filename) continue;

      const newPath = parentDir ? `${parentDir}${separator}${newName}` : newName;

      try {
        if (isRemote) {
          await api.remoteRename(item.path, newPath, sessId);
        } else {
          if (api.localRename) {
            await api.localRename(item.path, newPath);
          }
        }
      } catch (err) {
        errors.push(`${filename}: ${err.message || err}`);
      }
    }

    if (isRemote) {
      this.refreshRemote(this.remotePath);
    } else {
      this.refreshLocal(this.localPath);
    }

    if (errors.length > 0) {
      alert(`Batch rename completed with errors:\n${errors.join('\n')}`);
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

    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    if (itemList.length === 1) {
      const item = itemList[0];
      const icon = item.isDir ? '📁' : '📄';
      const typeLabel = item.isDir ? 'Directory' : 'File';
      if (title) title.textContent = `🗑 Delete ${typeLabel} (${pane === 'remote' ? 'Remote' : 'Local'})`;
      if (pathVal) {
        pathVal.innerHTML = `<span style="font-family: var(--font-mono); font-size: 11px;">${escapeHtml(item.path)}</span>`;
      }
      if (warningVal) {
        warningVal.textContent = `Are you sure you want to delete ${icon} "${item.name}" from your ${pane} filesystem? This action cannot be undone.`;
      }
    } else {
      if (title) title.textContent = `🗑 Delete ${itemList.length} Items (${pane === 'remote' ? 'Remote' : 'Local'})`;
      if (pathVal) {
        const listHtml = `
          <div class="delete-target-list" style="max-height: 90px; overflow-y: auto; border: 1px solid hsl(var(--border-subtle)); padding: 6px 10px; border-radius: 4px; background-color: rgba(0,0,0,0.15); margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
            ${itemList.map(i => `
              <div style="font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <input type="checkbox" class="delete-target-checkbox" data-path="${escapeHtml(i.path)}" checked style="margin: 0; cursor: pointer;">
                <span>${i.isDir ? '📁' : '📄'}</span>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(i.name)}">${escapeHtml(i.name)}</span>
              </div>
            `).join('')}
          </div>
        `;
        pathVal.innerHTML = listHtml;
      }
      if (warningVal) {
        warningVal.textContent = `Are you sure you want to delete the checked item(s) from your ${pane} filesystem? This action cannot be undone.`;
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
    const rawItems = (this.deleteTargetItems && this.deleteTargetItems.length > 0) ? this.deleteTargetItems : (this.deleteTargetItem ? [this.deleteTargetItem] : []);
    if (rawItems.length === 0) return;

    // Filter by checked checkboxes in the UI target list if multiple items
    const checkboxes = document.querySelectorAll('.delete-target-checkbox');
    const checkedPaths = new Set();
    checkboxes.forEach(cb => {
      if (cb.checked) {
        checkedPaths.add(cb.getAttribute('data-path'));
      }
    });

    const items = checkboxes.length > 0
      ? rawItems.filter(item => checkedPaths.has(item.path))
      : rawItems;

    if (!items.length) {
      alert('Please check at least one item to delete.');
      return;
    }

    const pane = this.deleteTargetPane || 'remote';
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    this.closeDeleteConfirmModal();

    let successCount = 0;
    const errors = [];
    for (const item of items) {
      try {
        if (pane === 'remote') {
          await api.remoteDelete(item.path, item.isDir, sessId);
          successCount++;
        } else if (pane === 'local') {
          if (api.localDelete) {
            await api.localDelete(item.path, item.isDir);
            successCount++;
          }
        }
      } catch (err) {
        errors.push({ item: item.name || item.path, msg: err && err.message ? err.message : String(err) });
      }
    }
    if (successCount > 0 && window.LogViewer) {
      window.LogViewer.addEntry('warning', `🗑 Deleted ${successCount} ${pane} item(s).`);
    }
    if (errors.length > 0) {
      const cleanMsg = errors.map(e => `${e.item}: ${e.msg}`).join('\n');
      this.showErrorModal(
        '⚠️ Delete Failed for Some Item(s)',
        `${errors.length} of ${items.length} item(s) failed`,
        cleanMsg,
        'Please check item permissions, or verify the file/folder is not locked by another process.'
      );
    }
    if (pane === 'remote') this.refreshRemote(this.remotePath);
    else this.refreshLocal(this.localPath);
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
    if (!this.chmodTargetItems || !this.chmodTargetItems.length) return;
    const octalDisplay = document.getElementById('chmod-edit-octal-val');
    const octalStr = octalDisplay ? octalDisplay.textContent.trim() : '0755';
    const mode = parseInt(octalStr, 8);
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    if (isNaN(mode)) return;

    // Filter by checked checkboxes in the UI target list (Fix: selective batch chmod)
    const checkboxes = document.querySelectorAll('.chmod-target-checkbox');
    const checkedPaths = new Set();
    checkboxes.forEach(cb => {
      if (cb.checked) {
        checkedPaths.add(cb.getAttribute('data-path'));
      }
    });

    const itemsToChmod = checkboxes.length > 0
      ? this.chmodTargetItems.filter(item => checkedPaths.has(item.path))
      : this.chmodTargetItems;

    if (!itemsToChmod.length) {
      alert('Please check at least one item to change permissions.');
      return;
    }

    this.closeChmodModal();

    // Apply chmod to checked items
    const errors = [];
    for (const item of itemsToChmod) {
      try {
        await api.remoteChmod(item.path, mode, sessId);
      } catch (err) {
        errors.push(`${item.name}: ${err.message || err}`);
      }
    }

    this.refreshRemote(this.remotePath);

    if (errors.length > 0) {
      alert(`Permissions applied with errors:\n${errors.join('\n')}`);
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
          const sep = this.getLocalSeparator();
          const localFilePath = this.localPath.endsWith(sep) ? `${this.localPath}${name}` : `${this.localPath}${sep}${name}`;
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
          const sep = this.getLocalSeparator();
          const localDirPath = this.localPath.endsWith(sep) ? `${this.localPath}${name}` : `${this.localPath}${sep}${name}`;
          await api.localMkdir(localDirPath);
          this.refreshLocal(this.localPath);
        }
      }
    } catch (err) {
      alert(`Failed to create ${type}: ${err.message || err}`);
    }
  },

  initColumnResizing() {
    const setupTableResizing = (tableId, storageKey) => {
      const table = document.getElementById(tableId);
      if (!table) return;

      const cols = table.querySelectorAll('thead th');
      if (!cols || cols.length === 0) return;

      try {
        const savedWidths = JSON.parse(localStorage.getItem(storageKey));
        if (Array.isArray(savedWidths) && savedWidths.length === cols.length) {
          cols.forEach((col, idx) => {
            if (savedWidths[idx]) col.style.width = savedWidths[idx];
          });
        }
      } catch (e) {}

      cols.forEach((col, idx) => {
        const resizer = col.querySelector('.col-resizer');
        if (!resizer) return;

        const nextCol = cols[idx + 1];
        let startX = 0;
        let startWidth = 0;
        let nextStartWidth = 0;

        const onMouseMove = (e) => {
          const dx = e.clientX - startX;
          if (nextCol) {
            const minW = 35;
            let newWidth = startWidth + dx;
            let newNextWidth = nextStartWidth - dx;

            if (newWidth < minW) {
              newWidth = minW;
              newNextWidth = startWidth + nextStartWidth - minW;
            } else if (newNextWidth < minW) {
              newNextWidth = minW;
              newWidth = startWidth + nextStartWidth - minW;
            }

            col.style.width = `${newWidth}px`;
            nextCol.style.width = `${newNextWidth}px`;
          } else {
            const newWidth = Math.max(40, startWidth + dx);
            col.style.width = `${newWidth}px`;
          }
        };

        const onMouseUp = () => {
          resizer.classList.remove('resizing');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);

          const currentWidths = Array.from(cols).map(c => c.style.width || `${c.offsetWidth}px`);
          try {
            localStorage.setItem(storageKey, JSON.stringify(currentWidths));
          } catch (e) {}
        };

        resizer.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          startX = e.clientX;
          startWidth = col.offsetWidth;
          nextStartWidth = nextCol ? nextCol.offsetWidth : 0;
          resizer.classList.add('resizing');
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      });
    };

    setupTableResizing('local-file-table', 'devsftp_col_widths_local');
    setupTableResizing('remote-file-table', 'devsftp_col_widths_remote');

    const pendingTable = document.querySelector('#pending-edits-modal table');
    if (pendingTable) {
      if (!pendingTable.id) pendingTable.id = 'pending-edits-table';
      setupTableResizing('pending-edits-table', 'devsftp_col_widths_pending');
    }

    const compareTable = document.querySelector('#dir-compare-modal table');
    if (compareTable) {
      if (!compareTable.id) compareTable.id = 'dir-compare-table';
      setupTableResizing('dir-compare-table', 'devsftp_col_widths_compare');
    }
  },

  async loadDrives() {
    const api = this.getApi();
    if (!api) return;
    try {
      const drives = await api.localDrives();
      const select = document.getElementById('local-drive-select');
      if (select && Array.isArray(drives)) {
        select.innerHTML = '';
        drives.forEach(d => {
          const opt = document.createElement('option');
          const val = typeof d === 'object' ? d.path : d;
          const lbl = typeof d === 'object' ? d.label : `${d} Drive`;
          opt.value = val;
          opt.textContent = lbl;
          select.appendChild(opt);
        });
        if (this.localPath) {
          const match = drives.find(d => {
            const val = typeof d === 'object' ? d.path : d;
            return this.localPath.startsWith(val);
          });
          if (match) {
            select.value = typeof match === 'object' ? match.path : match;
          }
        }
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
      const errStr = String(err && err.message ? err.message : err).toLowerCase();
      const isNotFound = errStr.includes('no such file') || errStr.includes('enoent') || errStr.includes('cannot find');
      const isWin = typeof process !== 'undefined' && process.platform === 'win32';
      const defaultHome = isWin ? 'C:\\' : '/';
      if (isNotFound && targetPath && targetPath !== defaultHome) {
        if (window.LogViewer) {
          window.LogViewer.addEntry('warning', `⚠️ Local directory "${targetPath}" no longer exists. Navigating to default home: "${defaultHome}"`);
        }
        this._refreshingLocal = false;
        return this.refreshLocal(defaultHome);
      }
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
      const errStr = String(err && err.message ? err.message : err).toLowerCase();
      const isNotFound = errStr.includes('no such file') || errStr.includes('not found') || errStr.includes('550') || errStr.includes('450') || errStr.includes('enoent');
      if (isNotFound && targetPath && targetPath !== '/') {
        const lastSlash = targetPath.lastIndexOf('/');
        const parentPath = lastSlash <= 0 ? '/' : targetPath.substring(0, lastSlash);
        if (window.LogViewer) {
          window.LogViewer.addEntry('warning', `⚠️ Remote directory "${targetPath}" no longer exists. Falling back to parent: "${parentPath}"`);
        }
        this._refreshingRemote = false;
        return this.refreshRemote(parentPath);
      }
      if (window.LogViewer) window.LogViewer.addEntry('error', `Failed to read remote directory: ${err.message}`);
      this.showErrorModal(
        '⚠️ Remote Directory Read Failed',
        targetPath,
        err.message || 'Could not list remote directory contents.',
        'Please verify server connection status and remote directory permissions.'
      );
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
    const parts = this.localPath.split(/[\\/]/).filter(Boolean);
    if (parts.length > 0) {
      const isWindows = /^[a-zA-Z]:/.test(parts[0]);
      parts.pop();
      if (isWindows) {
        if (parts.length === 0) {
          this.refreshLocal(this.localPath);
        } else if (parts.length === 1) {
          this.refreshLocal(parts[0] + '\\');
        } else {
          this.refreshLocal(parts.join('\\'));
        }
      } else {
        const parentPath = '/' + parts.join('/');
        this.refreshLocal(parentPath === '' ? '/' : parentPath);
      }
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

    const sortedFiles = this.sortFiles(files || [], this.localSortKey, this.localSortOrder);
    sortedFiles.forEach((f) => {
      const tr = document.createElement('tr');
      const isSelected = this.selectedLocalFiles.some(item => item.path === f.path);
      tr.className = `file-row ${f.isDir ? 'is-dir' : ''} ${isSelected ? 'selected' : ''}`;
      tr.setAttribute('data-path', f.path);
      tr.draggable = true;
      const icon = f.isDir ? '📁' : '📄';

      const localBms = this.getLocalBookmarks();
      const isBookmarked = localBms.some(b => b.path.toLowerCase() === f.path.toLowerCase() || b.path.toLowerCase() === f.path.replace(/[\\/]+$/, '').toLowerCase());

      tr.innerHTML = `
        <td class="file-name-cell" title="${f.name.replace(/"/g, '&quot;')}">
          <div class="file-name-wrapper">
            <span class="file-icon">${icon}</span>
            <span class="file-name-text">${f.name}</span>${isBookmarked ? ' <span class="bookmark-star-badge" title="Bookmarked">⭐</span>' : ''}
          </div>
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

    const sortedFiles = this.sortFiles(files || [], this.remoteSortKey, this.remoteSortOrder);
    sortedFiles.forEach((f) => {
      const tr = document.createElement('tr');
      const isSelected = this.selectedRemoteFiles.some(item => item.path === f.path);
      tr.className = `file-row ${f.isDir ? 'is-dir' : ''} ${isSelected ? 'selected' : ''}`;
      tr.setAttribute('data-path', f.path);
      tr.draggable = true;
      const icon = f.isDir ? '📁' : '📄';

      const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
      const profileId = activeSess && activeSess.profile ? (activeSess.profile.id || activeSess.profile.host) : null;
      const profileBms = this.getProfileBookmarks(profileId);
      const isBookmarked = profileBms.some(b => b.path.toLowerCase() === f.path.toLowerCase() || b.path.toLowerCase() === f.path.replace(/\/+$/, '').toLowerCase());

      tr.innerHTML = `
        <td class="file-name-cell" title="${f.name.replace(/"/g, '&quot;')}">
          <div class="file-name-wrapper">
            <span class="file-icon">${icon}</span>
            <span class="file-name-text">${f.name}</span>${isBookmarked ? ' <span class="bookmark-star-badge" title="Bookmarked">⭐</span>' : ''}
          </div>
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
    // Debounce to avoid rebuilding the full DOM table on every keystroke (Fix D5)
    if (this._filterLocalTimer) clearTimeout(this._filterLocalTimer);
    this._filterLocalTimer = setTimeout(() => {
      const lower = term.toLowerCase();
      const filtered = this.localFiles.filter(f => f.name.toLowerCase().includes(lower));
      this.renderLocalTable(filtered);
    }, 150);
  },

  filterRemote(term) {
    // Debounce to avoid rebuilding the full DOM table on every keystroke (Fix D5)
    if (this._filterRemoteTimer) clearTimeout(this._filterRemoteTimer);
    this._filterRemoteTimer = setTimeout(() => {
      const lower = term.toLowerCase();
      const filtered = this.remoteFiles.filter(f => f.name.toLowerCase().includes(lower));
      this.renderRemoteTable(filtered);
    }, 150);
  },

  showContextMenu(x, y, items, pane) {
    const menu = document.getElementById('context-menu');
    this.contextPane = pane;

    const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
    const isSftp = activeSess && activeSess.profile && activeSess.profile.protocol === 'sftp';

    const selectedList = Array.isArray(items) ? items : (items ? [items] : []);
    this.contextItems = selectedList;
    this.contextItem = selectedList[0] || null;

    const ctxOpen = document.getElementById('ctx-open');
    const ctxEdit = document.getElementById('ctx-edit');
    const ctxDownload = document.getElementById('ctx-download');
    const ctxDownloadAs = document.getElementById('ctx-download-as');
    const ctxUpload = document.getElementById('ctx-upload');
    const ctxChmod = document.getElementById('ctx-chmod');
    const ctxRename = document.getElementById('ctx-rename');
    const ctxMove = document.getElementById('ctx-move');
    const ctxCopyTo = document.getElementById('ctx-copy-to');
    const ctxDuplicate = document.getElementById('ctx-duplicate');
    const ctxDelete = document.getElementById('ctx-delete');
    const ctxCopyPath = document.getElementById('ctx-copy-path');
    const ctxCalculateSize = document.getElementById('ctx-calculate-size');
    const ctxGroupSort = document.getElementById('ctx-group-sort');
    const ctxProperties = document.getElementById('ctx-properties');
    const ctxNewFile = document.getElementById('ctx-new-file');
    const ctxMkdir = document.getElementById('ctx-mkdir');
    const ctxSshTools = document.getElementById('ctx-ssh-tools');
    const sshCmdCompress = document.getElementById('ssh-cmd-compress');
    const sshCmdExtract = document.getElementById('ssh-cmd-extract');
    const sshCmdGrep = document.getElementById('ssh-cmd-grep');
    const sshCmdFind = document.getElementById('ssh-cmd-find');
    const sshCmdDu = document.getElementById('ssh-cmd-du');
    const api = window.devsFTP || window.pulseFTP;
    const isLocalWindows = api ? api.isWindows : false;
    const remoteOS = activeSess && activeSess.remoteOS ? activeSess.remoteOS : 'linux';
    const isWin = pane === 'local' ? isLocalWindows : (remoteOS === 'windows');
    const showTools = (pane === 'remote' && isSftp) || (pane === 'local');

    if (ctxSshTools) {
      const labelSpan = ctxSshTools.querySelector('span:first-child');
      if (labelSpan) {
        labelSpan.textContent = pane === 'local' ? '⚡ Local Commands' : '⚡ Remote Commands';
      }
    }

    if (sshCmdCompress) {
      sshCmdCompress.textContent = isWin ? '📦 Compress (.zip)' : '📦 Compress (.tar.gz)';
    }
    if (sshCmdExtract) {
      sshCmdExtract.textContent = isWin ? '📂 Extract (.zip)' : '📂 Extract (.tar.gz)';
    }
    if (sshCmdGrep) {
      sshCmdGrep.style.display = isWin ? 'none' : 'flex';
    }
    if (sshCmdFind) {
      sshCmdFind.style.display = isWin ? 'none' : 'flex';
    }
    if (sshCmdDu) {
      sshCmdDu.style.display = isWin ? 'none' : 'flex';
    }

    if (selectedList.length === 0) {
      if (ctxOpen) ctxOpen.style.display = 'none';
      if (ctxEdit) ctxEdit.style.display = 'none';
      if (ctxDownload) ctxDownload.style.display = 'none';
      if (ctxDownloadAs) ctxDownloadAs.style.display = 'none';
      if (ctxUpload) ctxUpload.style.display = 'none';
      if (ctxChmod) ctxChmod.style.display = 'none';
      if (ctxRename) ctxRename.style.display = 'none';
      if (ctxMove) ctxMove.style.display = 'none';
      if (ctxCopyTo) ctxCopyTo.style.display = 'none';
      if (ctxDuplicate) ctxDuplicate.style.display = 'none';
      if (ctxDelete) ctxDelete.style.display = 'none';
      if (ctxCopyPath) ctxCopyPath.style.display = 'none';
      if (ctxCalculateSize) ctxCalculateSize.style.display = 'none';
      if (ctxSshTools) ctxSshTools.style.display = 'none';
      if (ctxGroupSort) ctxGroupSort.style.display = 'flex';
      if (ctxProperties) ctxProperties.style.display = 'none';
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
      if (ctxDownloadAs) {
        ctxDownloadAs.style.display = pane === 'remote' && !isDir ? 'flex' : 'none';
      }
      if (ctxUpload) {
        ctxUpload.style.display = pane === 'local' ? 'flex' : 'none';
        const label = ctxUpload.querySelector('span:last-child');
        if (label) label.textContent = 'Upload';
      }
      if (ctxChmod) {
        ctxChmod.style.display = pane === 'remote' ? 'flex' : 'none';
        const label = ctxChmod.querySelector('span:last-child');
        if (label) {
          label.textContent = 'Permissions (chmod)';
        } else {
          ctxChmod.textContent = '🔐 Permissions (chmod)';
        }
      }
      if (ctxRename) {
        ctxRename.style.display = 'flex';
        const label = ctxRename.querySelector('span:last-child');
        if (label) {
          label.textContent = 'Rename';
        } else {
          ctxRename.textContent = '✏️ Rename';
        }
      }
      if (ctxMove) ctxMove.style.display = 'flex';
      if (ctxCopyTo) ctxCopyTo.style.display = 'flex';
      if (ctxDuplicate) ctxDuplicate.style.display = 'flex';
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
      if (ctxSshTools) ctxSshTools.style.display = showTools ? 'flex' : 'none';
      if (ctxGroupSort) ctxGroupSort.style.display = 'flex';
      if (ctxProperties) ctxProperties.style.display = 'flex';
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
      if (ctxDownloadAs) {
        ctxDownloadAs.style.display = pane === 'remote' ? 'flex' : 'none';
      }
      if (ctxUpload) {
        ctxUpload.style.display = pane === 'local' ? 'flex' : 'none';
        const label = ctxUpload.querySelector('span:last-child');
        if (label) label.textContent = `Upload (${count} items)`;
      }
      if (ctxChmod) {
        ctxChmod.style.display = pane === 'remote' ? 'flex' : 'none';
        const label = ctxChmod.querySelector('span:last-child');
        if (label) {
          label.textContent = 'Permissions (chmod)';
        } else {
          ctxChmod.textContent = '🔐 Permissions (chmod)';
        }
      }
      if (ctxRename) {
        ctxRename.style.display = 'flex';
        const label = ctxRename.querySelector('span:last-child');
        if (label) {
          label.textContent = 'Rename';
        } else {
          ctxRename.textContent = '✏️ Rename';
        }
      }
      if (ctxMove) ctxMove.style.display = 'none';
      if (ctxCopyTo) ctxCopyTo.style.display = 'none';
      if (ctxDuplicate) ctxDuplicate.style.display = 'none';
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
      if (ctxSshTools) ctxSshTools.style.display = showTools ? 'flex' : 'none';
      if (ctxProperties) ctxProperties.style.display = 'flex';
      if (ctxNewFile) ctxNewFile.style.display = 'flex';
      if (ctxMkdir) ctxMkdir.style.display = 'flex';
    }

    const ctxGroupRemoteTransfer = document.getElementById('ctx-group-remote-transfer');
    if (ctxGroupRemoteTransfer) {
      if (pane === 'remote' && selectedList.length > 0) {
        ctxGroupRemoteTransfer.style.display = 'flex';
        this.populateRemoteTransferSubmenu();
      } else {
        ctxGroupRemoteTransfer.style.display = 'none';
      }
    }

    // Helper to toggle parent group display based on children visibility
    const updateGroupVisibility = (groupId, childIds) => {
      const groupEl = document.getElementById(groupId);
      if (!groupEl) return;
      const anyVisible = childIds.some(id => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
      });
      groupEl.style.display = anyVisible ? 'flex' : 'none';
    };

    updateGroupVisibility('ctx-group-new', ['ctx-new-file', 'ctx-mkdir']);
    updateGroupVisibility('ctx-group-organize', ['ctx-duplicate', 'ctx-copy-to', 'ctx-move']);

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

    if (posX + menuWidth + 170 > viewportWidth) {
      menu.classList.add('submenu-left');
    } else {
      menu.classList.remove('submenu-left');
    }

    // Dynamic Submenu Boundary Detection (Auto-Flip Up & Auto-Flip Left)
    menu.querySelectorAll('.trigger-submenu').forEach(trigger => {
      const submenu = trigger.querySelector('.context-submenu');
      if (!submenu) return;

      submenu.classList.remove('flip-up', 'flip-left');

      trigger.onmouseenter = () => {
        submenu.classList.remove('flip-up', 'flip-left');
        const triggerRect = trigger.getBoundingClientRect();
        const submenuHeight = submenu.offsetHeight || 160;
        const submenuWidth = submenu.offsetWidth || 180;

        if (triggerRect.top + submenuHeight > window.innerHeight - 15) {
          submenu.classList.add('flip-up');
        }
        if (triggerRect.right + submenuWidth > window.innerWidth - 15) {
          submenu.classList.add('flip-left');
        }
      };
    });

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

    if (action === 'bookmark-add') {
      const item = items[0];
      if (item) {
        if (pane === 'local') {
          this.addLocalBookmark(item.path);
        } else {
          const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
          const profileId = activeSess && activeSess.profile ? (activeSess.profile.id || activeSess.profile.host) : null;
          if (profileId) {
            this.addProfileBookmark(profileId, item.path);
          } else {
            this.addGlobalBookmark(item.path, true);
          }
        }
      }
      return;
    }

    if (action === 'bookmark-remove') {
      const item = items[0];
      if (item) {
        if (pane === 'local') {
          const bms = this.getLocalBookmarks();
          const found = bms.find(b => b.path.toLowerCase() === item.path.toLowerCase());
          if (found) this.deleteLocalBookmark(found.id);
        } else {
          const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
          const profileId = activeSess && activeSess.profile ? (activeSess.profile.id || activeSess.profile.host) : null;
          if (profileId) {
            const bms = this.getProfileBookmarks(profileId);
            const found = bms.find(b => b.path.toLowerCase() === item.path.toLowerCase());
            if (found) this.deleteProfileBookmark(profileId, found.id);
          }
        }
      }
      return;
    }

    if (action === 'sort-name') {
      this.sortCurrentPane('name');
      return;
    }
    if (action === 'sort-size') {
      this.sortCurrentPane('size');
      return;
    }
    if (action === 'sort-date') {
      this.sortCurrentPane('modified');
      return;
    }
    if (action === 'sort-type') {
      this.sortCurrentPane('name');
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
      await this.downloadBatchItems(items);
    } else if (action === 'download-as' && pane === 'remote') {
      if (items.length === 1) {
        this.downloadFileAs(items[0]);
      } else {
        this.downloadBatchItems(items);
      }
    } else if (action === 'properties' && items.length > 0) {
      this.showFileProperties(items[0]);
    } else if (action === 'upload' && pane === 'local') {
      await this.uploadBatchItems(items);
    } else if (action === 'edit' && pane === 'remote' && items.length === 1) {
      this.editRemoteFile(items[0].path);
    } else if (action === 'copy-path') {
      const pathsText = items.map(i => i.path).join('\n');
      try {
        navigator.clipboard.writeText(pathsText).then(() => {
          if (window.LogViewer) window.LogViewer.addEntry('info', `Copied ${items.length} path(s) to clipboard.`);
        }).catch(err => {
          if (window.LogViewer) window.LogViewer.addEntry('error', `Clipboard write failed: ${err.message}`);
        });
      } catch (err) {
        if (window.LogViewer) window.LogViewer.addEntry('error', `Failed to copy paths to clipboard: ${err.message}`);
      }
    } else if (action === 'chmod' && pane === 'remote') {
      this.openChmodModal(items);
    } else if (action === 'delete') {
      this.openDeleteConfirmModal(items, pane);
    } else if (action === 'rename') {
      if (items.length === 1) {
        this.openRenameModal(items[0], pane);
      } else if (items.length > 1) {
        this.openBatchRenameModal(items, pane);
      }
    } else if (action === 'move' && items.length === 1) {
      this.openMoveModal(items[0], 'move', pane);
    } else if (action === 'copy-to' && items.length === 1) {
      this.openMoveModal(items[0], 'copy', pane);
    } else if (action === 'duplicate' && items.length === 1) {
      this.duplicateItem(items[0], pane);
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
    } else if (action.startsWith('ssh-')) {
      const item = items[0];
      const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;
      const api = this.getApi();
      if (!api) return;

      const isRemote = pane === 'remote';
      if (isRemote) {
        if (!api.remoteExecCommand) {
          alert('Remote commands require an active SFTP session.');
          return;
        }
      } else {
        if (!api.localExecCommand) {
          alert('Local shell commands are not supported on this platform.');
          return;
        }
      }

      // Convert SFTP path (e.g. /public) to relative SSH path (e.g. ./public)
      const toSshPath = (p) => {
        if (!p) return '.';
        let clean = p.replace(/\\/g, '/');
        if (clean === '/') return '.';
        if (clean.startsWith('/')) {
          return './' + clean.slice(1);
        }
        return './' + clean;
      };

      const activeSess = window.SessionManager ? window.SessionManager.getActiveSession() : null;
      const isLocalWindows = api.isWindows;
      const remoteOS = activeSess && activeSess.remoteOS ? activeSess.remoteOS : 'linux';
      const isWin = isRemote ? (remoteOS === 'windows') : isLocalWindows;

      let parentDir = '';
      let name = '';
      let targetPath = '';

      if (isRemote) {
        const parts = item.path.split('/');
        name = parts.pop() || 'archive';
        const rawParent = parts.join('/') || '/';
        parentDir = toSshPath(rawParent);
        targetPath = toSshPath(item.path);
      } else {
        const sep = isWin ? '\\' : '/';
        const parts = item.path.split(sep);
        name = parts.pop() || 'archive';
        parentDir = parts.join(sep) || (isWin ? 'C:\\' : '/');
        targetPath = item.path;
      }

      const runCmd = async (command) => {
        if (isRemote) {
          return await api.remoteExecCommand(command, sessId);
        } else {
          return await api.localExecCommand(command);
        }
      };

      const refreshView = () => {
        if (isRemote) {
          this.refreshRemote(this.remotePath);
        } else {
          this.refreshLocal(this.localPath);
        }
      };

      if (action === 'ssh-du') {
        const label = isRemote ? 'server' : 'local';
        if (window.LogViewer) window.LogViewer.addEntry('info', `⚡ Running ${label} du (Disk Usage) on: ${item.path}...`);
        try {
          const res = await runCmd(`du -sh "${targetPath.replace(/"/g, '\\"')}"`);
          if (res.code === 0) {
            const out = res.stdout.trim() || res.stderr.trim();
            if (window.LogViewer) window.LogViewer.addEntry('success', `💾 Disk Usage result: ${out}`);
          } else {
            if (window.LogViewer) window.LogViewer.addEntry('error', `du failed (code ${res.code}): ${res.stderr.trim()}`);
          }
        } catch (err) {
          if (window.LogViewer) window.LogViewer.addEntry('error', `du error: ${err.message}`);
        }
      } else if (action === 'ssh-compress') {
        if (isWin) {
          const defaultName = `${name}.zip`;
          this.showSshPromptModal(
            '📦 Compress Folder/File',
            'Output Archive Name (zip):',
            'archive_name.zip',
            defaultName,
            async (archiveName) => {
              if (!archiveName) return;
              if (window.LogViewer) window.LogViewer.addEntry('info', `⚡ Creating zip archive: ${archiveName}...`);
              try {
                const res = await runCmd(`powershell.exe -Command "cd '${parentDir.replace(/'/g, "''")}' ; Compress-Archive -Path '${name.replace(/'/g, "''")}' -DestinationPath '${archiveName.replace(/'/g, "''")}' -Force"`);
                if (res.code === 0) {
                  if (window.LogViewer) window.LogViewer.addEntry('success', `✓ Successfully compressed ${name} to ${archiveName}`);
                  refreshView();
                } else {
                  if (window.LogViewer) window.LogViewer.addEntry('error', `Compression failed (code ${res.code}): ${res.stderr.trim()}`);
                }
              } catch (err) {
                if (window.LogViewer) window.LogViewer.addEntry('error', `Compression error: ${err.message}`);
              }
            }
          );
        } else {
          const defaultName = `${name}.tar.gz`;
          this.showSshPromptModal(
            '📦 Compress Folder/File',
            'Output Archive Name (tar.gz):',
            'archive_name.tar.gz',
            defaultName,
            async (archiveName) => {
              if (!archiveName) return;
              if (window.LogViewer) window.LogViewer.addEntry('info', `⚡ Creating archive: ${archiveName}...`);
              try {
                const res = await runCmd(`cd "${parentDir.replace(/"/g, '\\"')}" && tar -czf "${archiveName.replace(/"/g, '\\"')}" "${name.replace(/"/g, '\\"')}"`);
                if (res.code === 0) {
                  if (window.LogViewer) window.LogViewer.addEntry('success', `✓ Successfully compressed ${name} to ${archiveName}`);
                  refreshView();
                } else {
                  if (window.LogViewer) window.LogViewer.addEntry('error', `Compression failed (code ${res.code}): ${res.stderr.trim()}`);
                }
              } catch (err) {
                if (window.LogViewer) window.LogViewer.addEntry('error', `Compression error: ${err.message}`);
              }
            }
          );
        }
      } else if (action === 'ssh-extract') {
        if (window.LogViewer) window.LogViewer.addEntry('info', `⚡ Extracting archive: ${item.path}...`);
        try {
          let cmd = '';
          if (isWin) {
            cmd = `powershell.exe -Command "cd '${parentDir.replace(/'/g, "''")}' ; Expand-Archive -Path '${name.replace(/'/g, "''")}' -DestinationPath '.' -Force"`;
          } else {
            cmd = `cd "${parentDir.replace(/"/g, '\\"')}" && tar -xzf "${name.replace(/"/g, '\\"')}"`;
            if (name.endsWith('.zip')) {
              cmd = `cd "${parentDir.replace(/"/g, '\\"')}" && unzip -o "${name.replace(/"/g, '\\"')}"`;
            }
          }
          const res = await runCmd(cmd);
          if (res.code === 0) {
            if (window.LogViewer) window.LogViewer.addEntry('success', `✓ Archive extracted successfully in: ${parentDir}`);
            refreshView();
          } else {
            if (window.LogViewer) window.LogViewer.addEntry('error', `Extraction failed (code ${res.code}): ${res.stderr.trim()}`);
          }
        } catch (err) {
          if (window.LogViewer) window.LogViewer.addEntry('error', `Extraction error: ${err.message}`);
        }
      } else if (action === 'ssh-grep') {
        this.showSshPromptModal(
          '🔍 Search text recursively (grep)',
          'Enter text query:',
          'pattern',
          '',
          async (query) => {
            if (!query) return;
            if (window.LogViewer) window.LogViewer.addEntry('info', `⚡ Running grep search for "${query}" inside ${item.path}...`);
            try {
              const res = await runCmd(`grep -rn "${query.replace(/"/g, '\\"')}" "${targetPath.replace(/"/g, '\\"')}"`);
              const lines = (res.stdout.trim() || res.stderr.trim()).split('\n').filter(Boolean);
              const parsed = lines.map(lineStr => {
                const match = lineStr.match(/^((?:[a-zA-Z]:)?[^:]+):(\d+):(.*)$/);
                if (match) {
                  return {
                    path: match[1],
                    line: match[2],
                    text: match[3],
                    isRemote: isRemote
                  };
                }
                return {
                  path: lineStr,
                  line: '',
                  text: '',
                  isRemote: isRemote
                };
              });
              if (window.LogViewer) {
                window.LogViewer.addEntry('success', `✓ Grep search complete. Found ${parsed.length} match(es) for "${query}".`);
              }
              this.displaySearchResults(parsed, query, isRemote);
            } catch (err) {
              if (window.LogViewer) window.LogViewer.addEntry('error', `Grep error: ${err.message}`);
            }
          }
        );
      } else if (action === 'ssh-find') {
        this.showSshPromptModal(
          '🕵️ Find Files recursively',
          'Enter filename pattern (e.g. *.php):',
          '*.php',
          '*',
          async (pattern) => {
            if (!pattern) return;
            if (window.LogViewer) window.LogViewer.addEntry('info', `⚡ Running find for "${pattern}" inside ${item.path}...`);
            try {
              const res = await runCmd(`find "${targetPath.replace(/"/g, '\\"')}" -name "${pattern.replace(/"/g, '\\"')}"`);
              const lines = (res.stdout.trim() || res.stderr.trim()).split('\n').filter(Boolean);
              const parsed = lines.map(lineStr => {
                return {
                  path: lineStr,
                  line: '',
                  text: 'File matches search pattern',
                  isRemote: isRemote
                };
              });
              if (window.LogViewer) {
                window.LogViewer.addEntry('success', `✓ Find complete. Found ${parsed.length} matching file(s) for "${pattern}".`);
              }
              this.displaySearchResults(parsed, pattern, isRemote);
            } catch (err) {
              if (window.LogViewer) window.LogViewer.addEntry('error', `Find error: ${err.message}`);
            }
          }
        );
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
      const sep = this.getLocalSeparator();
      const baseLocal = targetDir.endsWith(sep) ? targetDir.slice(0, -sep.length) : targetDir;
      localDest = `${baseLocal}${sep}${fileName}`;
    }
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    if (window.LogViewer) {
      window.LogViewer.addEntry('info', `📥 Starting download: ${remoteFilePath} -> ${localDest}`);
    }

    let transferOptions = { ...options };
    if (!options.skipConflictCheck && api && api.checkFileConflict) {
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
            const isWindows = localDest.includes('\\') || !localDest.includes('/');
            const separator = isWindows ? '\\' : '/';
            const parts = localDest.split(separator);
            const fname = parts.pop();
            const dotIdx = fname.lastIndexOf('.');
            const nameOnly = dotIdx > 0 ? fname.substring(0, dotIdx) : fname;
            const ext = dotIdx > 0 ? fname.substring(dotIdx) : '';
            let counter = 1;
            let candidate = [...parts, `${nameOnly} (${counter})${ext}`].join(separator);
            if (api.localExists) {
              while (await api.localExists(candidate)) {
                counter++;
                candidate = [...parts, `${nameOnly} (${counter})${ext}`].join(separator);
              }
            }
            localDest = candidate;
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
      } catch (e) {
        if (window.LogViewer) window.LogViewer.addEntry('warning', `Conflict check error for ${localDest}: ${e.message || e}`);
        this.showErrorModal('⚠️ Conflict Check Failed', localDest, e.message || 'Could not verify destination file state.', 'Transfer aborted to prevent unexpected file overwrites.');
        return;
      }
    }

    if (window.TransferQueue) {
      window.TransferQueue.addTransfer('download', remoteFilePath, localDest, options.size || options.totalBytes || 0);
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
    const fileName = localFilePath.replace(/\\/g, '/').split('/').pop();
    let remoteDest = customRemoteDest || `${this.remotePath}/${fileName}`;
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;

    let transferOptions = { ...options };
    if (!options.skipConflictCheck && api && api.checkFileConflict) {
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
            let counter = 1;
            let candidate = [...parts, `${nameOnly} (${counter})${ext}`].join('/');
            if (api.remoteExists) {
              while (await api.remoteExists(candidate, sessId)) {
                counter++;
                candidate = [...parts, `${nameOnly} (${counter})${ext}`].join('/');
              }
            }
            remoteDest = candidate;
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
      } catch (e) {
        if (window.LogViewer) window.LogViewer.addEntry('warning', `Conflict check error for ${remoteDest}: ${e.message || e}`);
        this.showErrorModal('⚠️ Conflict Check Failed', remoteDest, e.message || 'Could not verify destination file state.', 'Transfer aborted to prevent unexpected file overwrites.');
        return;
      }
    }

    if (window.TransferQueue) {
      window.TransferQueue.addTransfer('upload', localFilePath, remoteDest, options.size || options.totalBytes || 0);
    }
    try {
      await api.uploadFile(localFilePath, remoteDest, sessId, transferOptions);
      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `✅ Upload completed: ${remoteDest}`);
      }
      this.refreshRemote(this.remotePath);
    } catch (err) {
      if (window.LogViewer) {
        window.LogViewer.addEntry('error', `❌ Upload failed: ${err.message || err}`);
      }
      this.showErrorModal(
        '⚠️ Upload Error',
        remoteDest,
        err.message || 'An unexpected error occurred during file upload.',
        'Please verify remote permissions and network connection.'
      );
    }
  },

  async openLocalFile(localFilePath) {
    try {
      const api = this.getApi();
      if (window.LogViewer) window.LogViewer.addEntry('info', `Opening local file in default editor: ${localFilePath}`);
      if (api && api.localOpen) {
        await api.localOpen(localFilePath);
      }
    } catch (err) {
      if (window.LogViewer) window.LogViewer.addEntry('error', `Failed to open local file: ${err.message || err}`);
      alert(`Could not open file ${localFilePath}: ${err.message || err}`);
    }
  },

  async editRemoteFile(remoteFilePath) {
    const api = this.getApi();
    const sessId = window.SessionManager ? window.SessionManager.activeSessionId : null;
    try {
      if (api && api.appendDebugLog) api.appendDebugLog(`[TRACE editRemoteFile ENTERED] remote file path: ${remoteFilePath} | sessionId: ${sessId}`);
      console.log('[CHECKPOINT 3] editRemoteFile() called');
      console.log('[CHECKPOINT 4] Arguments passed to api.editRemoteFile:', { remoteFilePath, sessId });
      if (window.LogViewer) window.LogViewer.addEntry('info', `Opening remote file in default editor: ${remoteFilePath}`);
      await api.editRemoteFile(remoteFilePath, sessId);
    } catch (err) {
      if (window.LogViewer) window.LogViewer.addEntry('error', `Edit remote file error: ${err.message}`);
    }
  },

  async uploadBatchItems(items) {
    if (!items || items.length === 0) return;
    if (window.FileConflictDialog) window.FileConflictDialog.resetBatch();
    const batchTargetRemoteDir = this.remotePath;
    for (const item of items) {
      if (window.TransferQueue && window.TransferQueue.isBatchCancelled()) break;
      if (item && item.path) {
        const fileName = item.name || item.path.replace(/\\/g, '/').split('/').pop();
        const customRemoteDest = `${batchTargetRemoteDir}/${fileName}`;
        await this.uploadFile(item.path, customRemoteDest);
      }
    }
  },

  async downloadBatchItems(items) {
    if (!items || items.length === 0) return;
    if (window.FileConflictDialog) window.FileConflictDialog.resetBatch();
    const batchTargetLocalDir = this.localPath;
    for (const item of items) {
      if (window.TransferQueue && window.TransferQueue.isBatchCancelled()) break;
      if (item && item.path) {
        const fileName = item.name || item.path.replace(/\\/g, '/').split('/').pop();
        const isWindows = batchTargetLocalDir && (batchTargetLocalDir.includes('\\') || !batchTargetLocalDir.includes('/'));
        const separator = isWindows ? '\\' : '/';
        const customLocalDest = `${batchTargetLocalDir}${separator}${fileName}`;
        await this.downloadFile(item.path, customLocalDest);
      }
    }
  },

  async handleRemoteDrop(e) {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.items && Array.isArray(data.items)) {
          await this.uploadBatchItems(data.items);
          return;
        } else if (data && data.path) {
          await this.uploadBatchItems([{ path: data.path, name: data.name }]);
          return;
        }
      }
    } catch (err) {}
    if (this.selectedLocalFiles && this.selectedLocalFiles.length > 0) {
      await this.uploadBatchItems(this.selectedLocalFiles);
    } else if (this.selectedLocal) {
      await this.uploadBatchItems([this.selectedLocal]);
    }
  },

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  sortFiles(files, key, order) {
    const sorted = [...files];
    sorted.sort((a, b) => {
      // Directories always go first
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;

      let valA, valB;
      if (key === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (key === 'size') {
        valA = a.isDir ? -1 : (a.size || 0);
        valB = b.isDir ? -1 : (b.size || 0);
      } else if (key === 'modified') {
        valA = a.modifyTime ? new Date(a.modifyTime).getTime() : 0;
        valB = b.modifyTime ? new Date(b.modifyTime).getTime() : 0;
      }

      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  },

  updateSortHeaders() {
    document.querySelectorAll('.sortable-header').forEach(th => {
      const pane = th.getAttribute('data-pane');
      const sortKey = th.getAttribute('data-sort-key');
      const arrow = th.querySelector('.sort-arrow');
      if (!arrow) return;

      const activeKey = pane === 'local' ? this.localSortKey : this.remoteSortKey;
      const activeOrder = pane === 'local' ? this.localSortOrder : this.remoteSortOrder;

      if (sortKey === activeKey) {
        arrow.textContent = activeOrder === 'asc' ? ' ▴' : ' ▾';
        th.classList.add('sorted-active');
      } else {
        arrow.textContent = '';
        th.classList.remove('sorted-active');
      }
    });
  },

  clearSearchResults() {
    const tbody = document.getElementById('search-results-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: hsl(var(--text-muted)); padding: 20px; font-size: 11px;">Perform a "Search Text" or "Find Files" operation to display results.</td></tr>`;
    }
    const badge = document.getElementById('search-badge');
    if (badge) badge.textContent = '0';
    const summary = document.getElementById('search-results-summary');
    if (summary) summary.textContent = 'No active search';
  },

  hideSearchTab() {
    const tabBtn = document.getElementById('drawer-tab-search');
    if (tabBtn) tabBtn.style.display = 'none';

    const activeTab = document.querySelector('.drawer-tab.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'tab-search') {
      const logsTab = document.querySelector('.drawer-tab[data-tab="tab-logs"]');
      if (logsTab) logsTab.click();
    }
  },

  displaySearchResults(results, query, isRemote) {
    const tabBtn = document.getElementById('drawer-tab-search');
    if (tabBtn) tabBtn.style.display = 'flex';

    const badge = document.getElementById('search-badge');
    if (badge) badge.textContent = results.length;

    const summary = document.getElementById('search-results-summary');
    if (summary) {
      summary.textContent = `Found ${results.length} match(es) for "${query}"`;
    }

    const tbody = document.getElementById('search-results-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const renderLimit = 250;
    const itemsToRender = results.slice(0, renderLimit);

    if (itemsToRender.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: hsl(var(--text-muted)); padding: 20px; font-size: 11px;">No matches found.</td></tr>`;
    } else {
      itemsToRender.forEach(item => {
        const tr = document.createElement('tr');
        tr.title = `Double click to open: ${item.path}`;

        tr.innerHTML = `
          <td style="text-align: left; padding: 6px 10px; width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.path}">${item.path}</td>
          <td style="text-align: center; padding: 6px 10px; width: 80px;">${item.line || '-'}</td>
          <td style="text-align: left; padding: 6px 10px; font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.text || ''}">${item.text || ''}</td>
        `;

        tr.addEventListener('dblclick', async () => {
          try {
            const api = this.getApi();
            if (!api) return;

            if (isRemote) {
              if (window.LogViewer) window.LogViewer.addEntry('info', `📥 Opening remote file in default editor: ${item.path}`);
              await api.editRemoteFile(item.path, window.SessionManager ? window.SessionManager.activeSessionId : null);
            } else {
              if (window.LogViewer) window.LogViewer.addEntry('info', `📄 Opening local file in default editor: ${item.path}`);
              await api.localOpen(item.path);
            }
          } catch (err) {
            if (window.LogViewer) window.LogViewer.addEntry('error', `Failed to open search result item: ${err.message}`);
          }
        });

        tbody.appendChild(tr);
      });
    }

    // Switch focus to search results tab
    if (tabBtn) tabBtn.click();
  },

  async downloadFileAs(item) {
    if (!item) return;
    const cleanPath = item.path.replace(/\/+$/, '');
    const fileName = item.name || cleanPath.split('/').pop() || 'downloaded_item';
    const sep = this.getLocalSeparator();
    const defaultLocalPath = `${this.localPath.replace(/[\\/]+$/, '')}${sep}${fileName}`;

    this.showSshPromptModal(
      '📥 Download As...',
      'Enter destination local path & filename:',
      defaultLocalPath,
      '',
      async (destPath) => {
        if (!destPath) return;
        await this.downloadFile(item.path, destPath.trim());
      }
    );
  },

  sortCurrentPane(sortKey) {
    const pane = this.contextPane || 'remote';
    if (pane === 'remote') {
      if (this.remoteSortKey === sortKey) {
        this.remoteSortOrder = this.remoteSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.remoteSortKey = sortKey;
        this.remoteSortOrder = 'asc';
      }
      this.renderRemoteTable(this.remoteFiles);
    } else {
      if (this.localSortKey === sortKey) {
        this.localSortOrder = this.localSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.localSortKey = sortKey;
        this.localSortOrder = 'asc';
      }
      this.renderLocalTable(this.localFiles);
    }
    this.updateSortHeaders();
  },

  showFileProperties(item) {
    if (!item) return;
    const modal = document.getElementById('file-properties-modal');
    if (!modal) return;

    const iconEl = document.getElementById('file-props-icon');
    const nameEl = document.getElementById('file-props-name');
    const typeEl = document.getElementById('file-props-type-badge');
    const pathEl = document.getElementById('file-props-path');
    const sizeEl = document.getElementById('file-props-size');
    const mtimeEl = document.getElementById('file-props-mtime');
    const chmodEl = document.getElementById('file-props-chmod');
    const paneEl = document.getElementById('file-props-pane');
    const closeBtn = document.getElementById('btn-file-props-close');
    const okBtn = document.getElementById('btn-file-props-ok');

    const isRemote = (this.contextPane || 'remote') === 'remote';
    const isDir = item.isDir;

    if (iconEl) iconEl.textContent = isDir ? '📁' : '📄';
    if (nameEl) nameEl.textContent = item.name || item.path.split(/[\\/]/).pop();
    if (typeEl) typeEl.textContent = isDir ? 'Folder / Directory' : 'File';
    if (pathEl) pathEl.textContent = item.path;
    if (sizeEl) sizeEl.textContent = isDir ? (this.calculatedDirSizes.get(item.path) || '--') : this.formatSize(item.size || 0);
    if (mtimeEl) {
      const d = item.mtime || item.modifyTime;
      mtimeEl.textContent = d ? new Date(d).toLocaleString() : '-';
    }
    if (chmodEl) chmodEl.textContent = item.permissions ? `${item.permissions}` : (isRemote ? 'rwxr-xr-x (0755)' : 'N/A (Local)');
    if (paneEl) paneEl.textContent = isRemote ? 'Remote Server' : 'Local System';

    const closeModal = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (okBtn) okBtn.onclick = closeModal;

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('active');
  }
};
