/**
 * DevsFTP Session Manager (FR-001 Phase 1)
 * Manages multi-tab workspace sessions, per-session remote path history,
 * file table state, connection state, and workspace identity accent updates.
 */

window.SessionManager = {
  sessions: [],
  activeSessionId: null,
  hasRestored: false,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.tabContainer = document.getElementById('session-tabs-container');
    this.btnNewTab = document.getElementById('btn-new-session-tab');

    if (this.btnNewTab) {
      this.btnNewTab.addEventListener('click', () => {
        if (window.ConnectionDialog) {
          window.ConnectionDialog.openConnectionDialog();
        }
      });
    }

    const btnHeaderNewSession = document.getElementById('btn-header-new-session');
    if (btnHeaderNewSession) {
      btnHeaderNewSession.addEventListener('click', () => {
        if (window.ConnectionDialog) {
          window.ConnectionDialog.openConnectionDialog();
        }
      });
    }

    // Listen for Auto-Reconnect network status updates
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.onReconnectStatus) {
      api.onReconnectStatus((data) => {
        const sess = this.getSession(data.sessionId);
        if (sess) {
          if (data.status === 'reconnecting') {
            sess.connectionState = 'reconnecting';
            sess.reconnectAttempts = data.attempts;
          } else if (data.status === 'connected') {
            sess.connectionState = 'connected';
            sess.reconnectAttempts = 0;
            if (window.FileBrowser && this.activeSessionId === data.sessionId) {
              window.FileBrowser.refreshRemote(sess.remotePath || '/');
            }
          } else if (data.status === 'failed') {
            sess.connectionState = 'disconnected';
            sess.reconnectAttempts = 0;
          }
          this.setActiveSession(this.activeSessionId);
        }
      });
    }

    // Set restore lock guard during initialization to prevent startup renderTabs from wiping storage
    this.isRestoring = true;
    this.createDefaultSession();
    setTimeout(() => {
      this.restoreWorkspaceSessionState();
    }, 150);

    window.addEventListener('beforeunload', () => {
      if (this._saveSessionTimeout) {
        clearTimeout(this._saveSessionTimeout);
        this.saveWorkspaceSessionState();
      }
    });
  },

  createDefaultSession() {
    const defaultProfile = {
      id: 'default',
      name: 'Local Workspace',
      protocol: 'sftp',
      host: 'localhost',
      accentColor: '#F59E0B',
      remotePath: '/',
      localPath: 'C:\\'
    };
    this.createSession(defaultProfile, false);
  },

  createSession(profile, isConnected = false) {
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const defaultLocal = (window.FileBrowser && window.FileBrowser.localPath) ? window.FileBrowser.localPath : 'C:\\';
    const session = {
      sessionId,
      profileId: profile.id || 'default',
      profile: { ...profile },
      connectionState: isConnected ? 'connected' : 'disconnected',
      remotePath: profile.remotePath || '/',
      localPath: profile.localPath || defaultLocal,
      remoteFiles: [],
      accentColor: profile.accentColor || '#F59E0B'
    };

    this.sessions.push(session);
    this.setActiveSession(sessionId);
    return session;
  },

  getActiveSession() {
    return this.sessions.find(s => s.sessionId === this.activeSessionId) || null;
  },

  getSession(sessionId) {
    return this.sessions.find(s => s.sessionId === sessionId) || null;
  },

  updateActiveSessionLocalPath(localPath) {
    const active = this.getActiveSession();
    if (active && localPath) {
      active.localPath = localPath;
      this.saveWorkspaceSessionState();
    }
  },

  setActiveSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return;

    this.activeSessionId = sessionId;

    // 1. Update Profile Identity Accent via window.DevsApp.applyWorkspaceIdentityAccent
    // Only connected sessions update active workspace identity accent; disconnected tabs revert to neutral slate
    if (window.DevsApp) {
      const activeColor = session.connectionState === 'connected' ? session.accentColor : '#7D838C';
      window.DevsApp.applyWorkspaceIdentityAccent(activeColor);
    }

    // 2. Update Profile badge in top header
    const profileDot = document.getElementById('active-profile-dot');
    const profileName = document.getElementById('active-profile-name');
    const profileBadge = document.getElementById('active-profile-badge');

    if (profileBadge) {
      if (session.connectionState === 'connected') {
        profileBadge.style.display = 'inline-flex';
        if (profileDot) profileDot.style.backgroundColor = session.accentColor;
        if (profileName) profileName.textContent = session.profile.name || 'Session';
      } else {
        profileBadge.style.display = 'none';
      }
    }

    // 3. Update Remote Workspace Display & Breadcrumb + Restore Tab Local Directory
    if (window.FileBrowser) {
      window.FileBrowser.setRemoteState(session.remoteFiles, session.remotePath);
      // If we are connected but don't have remoteFiles loaded yet, trigger a refresh! (Issue 3)
      if (session.connectionState === 'connected' && (!session.remoteFiles || session.remoteFiles.length === 0)) {
        window.FileBrowser.refreshRemote(session.remotePath || '/');
      }
      if (session.localPath && window.FileBrowser.localPath !== session.localPath) {
        window.FileBrowser.refreshLocal(session.localPath);
      }
    }

    // Update Transfer Queue display for the active profile (Option A)
    if (window.TransferQueue && window.TransferQueue.render) {
      window.TransferQueue.render();
    }

    // 4. Update status indicator text and drawer tab visibility based on active session protocol
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const remoteTag = document.getElementById('remote-tag');

    const hasSsh = session.connectionState === 'connected' && session.profile && session.profile.protocol === 'sftp';

    const termTab = document.querySelector('.drawer-tab[data-tab="tab-terminal"]');
    if (termTab) {
      termTab.style.display = hasSsh ? '' : 'none';
      if (!hasSsh) {
        const activeTab = document.querySelector('.drawer-tab.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'tab-terminal') {
          const queueTab = document.querySelector('.drawer-tab[data-tab="tab-queue"]');
          if (queueTab) queueTab.click();
        }
      }
    }

    const tunnelsTab = document.querySelector('.drawer-tab[data-tab="tab-tunnels"]');
    if (tunnelsTab) {
      tunnelsTab.style.display = hasSsh ? '' : 'none';
      if (!hasSsh) {
        const activeTab = document.querySelector('.drawer-tab.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'tab-tunnels') {
          const queueTab = document.querySelector('.drawer-tab[data-tab="tab-queue"]');
          if (queueTab) queueTab.click();
        }
      }
    }

    if (session.connectionState === 'connected') {
      if (statusDot) {
        statusDot.className = 'status-indicator online';
        statusDot.style.backgroundColor = '';
      }
      if (statusText) statusText.textContent = `Connected (${session.profile.protocol.toUpperCase()})`;
      if (remoteTag) {
        remoteTag.style.display = 'inline-block';
        remoteTag.textContent = session.profile.protocol.toUpperCase();
      }
    } else if (session.connectionState === 'reconnecting') {
      if (statusDot) {
        statusDot.className = 'status-indicator online';
        statusDot.style.backgroundColor = '#F59E0B';
      }
      if (statusText) statusText.textContent = `🔄 Reconnecting (${session.reconnectAttempts || 1}/5)...`;
      if (remoteTag) {
        remoteTag.style.display = 'inline-block';
        remoteTag.textContent = 'RECONNECTING';
      }
    } else {
      if (statusDot) {
        statusDot.className = 'status-indicator';
        statusDot.style.backgroundColor = '';
      }
      if (statusText) statusText.textContent = 'Disconnected';
      if (remoteTag) remoteTag.style.display = 'none';
    }

    // 5. Render Tab Bar
    this.renderTabs();
  },

  updateActiveSessionRemoteState(remoteFiles, remotePath) {
    const active = this.getActiveSession();
    if (active) {
      active.remoteFiles = remoteFiles || [];
      active.remotePath = remotePath || '/';
    }
  },

  updateSessionConnectionState(sessionId, isConnected, profile = null) {
    const sess = this.sessions.find(s => s.sessionId === sessionId);
    if (sess) {
      sess.connectionState = isConnected ? 'connected' : 'disconnected';
      if (profile) {
        sess.profile = { ...profile };
        sess.profileId = profile.id;
        sess.accentColor = profile.accentColor || '#F59E0B';
      }
      if (sessionId === this.activeSessionId) {
        this.setActiveSession(sessionId);
      } else {
        this.renderTabs();
      }
    }
  },

  updateActiveSessionConnectionState(isConnected, profile = null) {
    this.updateSessionConnectionState(this.activeSessionId, isConnected, profile);
  },

  disconnectActiveSession() {
    const active = this.getActiveSession();
    if (!active) return;

    const getApi = () => window.devsFTP || window.pulseFTP;
    const api = getApi();
    if (api && api.disconnect) {
      api.disconnect(active.sessionId);
    }

    active.connectionState = 'disconnected';
    active.remoteFiles = [];
    this.setActiveSession(active.sessionId);
    if (window.LogViewer) {
      window.LogViewer.addEntry('info', `🔌 Disconnected active session tab [${active.sessionId}] (${active.profile.name || active.profile.host}).`);
    }
  },

  closeSession(sessionId) {
    const index = this.sessions.findIndex(s => s.sessionId === sessionId);
    if (index === -1) return;

    // Disconnect backend SSH/SFTP connection for closed tab
    const getApi = () => window.devsFTP || window.pulseFTP;
    const api = getApi();
    if (api && api.disconnect) {
      api.disconnect(sessionId);
    }

    this.sessions.splice(index, 1);

    if (this.sessions.length === 0) {
      this.createDefaultSession();
    } else if (this.activeSessionId === sessionId) {
      const nextSession = this.sessions[Math.max(0, index - 1)];
      this.setActiveSession(nextSession.sessionId);
    } else {
      this.renderTabs();
    }

    // Immediately update saved workspace session storage (using debounced write)
    this.saveWorkspaceSessionStateDebounced();
  },

  renderTabs() {
    if (!this.tabContainer) return;
    this.tabContainer.innerHTML = '';

    this.sessions.forEach(session => {
      const tab = document.createElement('div');
      tab.className = `session-tab ${session.sessionId === this.activeSessionId ? 'active' : ''}`;
      
      const proto = (session.profile.protocol || 'SFTP').toUpperCase();
      const name = session.profile.name || 'Session';
      const host = session.profile.host || 'localhost';

      tab.innerHTML = `
        <span class="session-tab-dot" style="background-color: ${session.accentColor};"></span>
        <span class="session-tab-proto">${proto}</span>
        <span class="session-tab-title" title="${name} (${host})">${name}</span>
        <button class="session-tab-close" title="Disconnect & Remove Tab">✕</button>
      `;

      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('session-tab-close')) {
          e.stopPropagation();
          this.closeSession(session.sessionId);
        } else {
          this.setActiveSession(session.sessionId);
        }
      });

      this.tabContainer.appendChild(tab);
    });

    this.saveWorkspaceSessionStateDebounced();
  },

  saveWorkspaceSessionStateDebounced() {
    if (this._saveSessionTimeout) clearTimeout(this._saveSessionTimeout);
    this._saveSessionTimeout = setTimeout(() => {
      this.saveWorkspaceSessionState();
    }, 1000);
  },

  saveWorkspaceSessionState() {
    if (this.isRestoring) return; // DO NOT OVERWRITE STORAGE DURING STARTUP RESTORE INITIALIZATION
    try {
      const validSessions = this.sessions.filter(s =>
        s && s.profile && s.profile.host &&
        s.profileId !== 'default' &&
        s.profile.name !== 'Local Workspace'
      );
      if (validSessions.length === 0) {
        localStorage.removeItem('devsftp_workspace_saved_tabs');
        if (window.LogViewer) {
          window.LogViewer.addEntry('info', '[Workspace Save] Cleared persistent saved tabs storage (no active remote tabs).');
        }
        return;
      }

      const savedState = validSessions.map(s => {
        const sanitizedProfile = s.profile ? { ...s.profile } : null;
        if (sanitizedProfile) {
          delete sanitizedProfile.password;
          delete sanitizedProfile.passphrase;
          delete sanitizedProfile.privateKey;
          delete sanitizedProfile.privateKeyPath;
        }
        return {
          profileId: s.profileId || (s.profile ? s.profile.id : null),
          profile: sanitizedProfile,
          remotePath: s.remotePath || (s.profile ? s.profile.remotePath : '/'),
          localPath: s.localPath || (s.profile ? s.profile.localPath : 'C:\\'),
          accentColor: s.accentColor
        };
      });
      const jsonStr = JSON.stringify(savedState);
      localStorage.setItem('devsftp_workspace_saved_tabs', jsonStr);
      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `[Workspace Save] Saved ${validSessions.length} remote session tab(s) to local storage (${jsonStr.length} bytes).`);
      }
    } catch (e) {
      if (window.LogViewer) {
        window.LogViewer.addEntry('error', `[Workspace Save Error] ${e.message}`);
      }
    }
  },

  async restoreWorkspaceSessionState() {
    if (this.hasRestored) {
      console.log('[Workspace Restore] Skip duplicate restore call.');
      return;
    }
    this.hasRestored = true;
    this.isRestoring = true;
    const log = (type, msg) => {
      console.log(`[Workspace Restore] ${msg}`);
      if (window.LogViewer) window.LogViewer.addEntry(type, `[Workspace Restore] ${msg}`);
    };

    const openLauncherIfEmpty = () => {
      setTimeout(() => {
        if (window.ConnectionDialog && window.ConnectionDialog.openConnectionDialog) {
          window.ConnectionDialog.openConnectionDialog();
        }
      }, 350);
    };

    try {
      log('info', 'Phase 1: Initializing Workspace Session Restore engine on startup...');

      const prefRestore = localStorage.getItem('devsftp_pref_restore_tabs');
      const shouldRestore = prefRestore === null || prefRestore === 'true';
      log('info', `Phase 2: Preference 'devsftp_pref_restore_tabs' = "${prefRestore}" (shouldRestore = ${shouldRestore})`);
      
      if (!shouldRestore) {
        log('warning', 'Phase 2: Restore is DISABLED in Preferences (devsftp_pref_restore_tabs is "false"). Session restore skipped.');
        openLauncherIfEmpty();
        return;
      }

      const raw = localStorage.getItem('devsftp_workspace_saved_tabs');
      log('info', `Phase 3: Reading 'devsftp_workspace_saved_tabs' raw storage data = ${raw ? `${raw.length} bytes` : 'NULL/EMPTY'}`);

      if (!raw) {
        log('warning', 'Phase 3: No saved workspace session tabs found in storage. Opening Session Launcher...');
        openLauncherIfEmpty();
        return;
      }

      const savedTabs = JSON.parse(raw);
      log('info', `Phase 4: Parsed saved tabs array containing ${Array.isArray(savedTabs) ? savedTabs.length : 0} tab(s).`);

      if (!Array.isArray(savedTabs) || savedTabs.length === 0) {
        log('warning', 'Phase 4: Saved tabs array is empty. Opening Session Launcher...');
        openLauncherIfEmpty();
        return;
      }

      const getApi = () => window.devsFTP || window.pulseFTP;
      const api = getApi();
      if (!api || !api.profiles || !api.profiles.getAll) {
        log('error', 'Phase 5: IPC API (devsFTP/pulseFTP) not ready. Restore skipped.');
        openLauncherIfEmpty();
        return;
      }

      const allProfiles = await api.profiles.getAll();
      log('info', `Phase 5: Loaded ${Array.isArray(allProfiles) ? allProfiles.length : 0} profile(s) from store.`);

      const validSavedTabs = savedTabs.filter(t => 
        t && t.profile && t.profile.host && 
        t.profile.host !== 'localhost' && 
        t.profileId !== 'default' && 
        t.profile.name !== 'Local Workspace'
      );

      if (validSavedTabs.length === 0) {
        log('warning', 'Phase 5: No remote server tabs to restore. Opening Session Launcher...');
        openLauncherIfEmpty();
        return;
      }

      // Clear existing default session if we have valid remote server tabs to restore
      this.sessions = [];

      for (let i = 0; i < validSavedTabs.length; i++) {
        const tabData = validSavedTabs[i];
        if (!tabData) continue;

        let prof = tabData.profile;
        if ((!prof || !prof.password) && tabData.profileId) {
          const found = allProfiles.find(p => p.id === tabData.profileId);
          if (found) prof = found;
        }

        if (prof && prof.host && prof.host !== 'localhost') {
          log('info', `Phase 6 [Tab ${i + 1}/${validSavedTabs.length}]: Restoring remote server tab "${prof.name || prof.host}" (${prof.username || 'user'}@${prof.host}:${prof.port || 22})...`);
          
          const restoredSess = this.createSession(prof, false);
          if (tabData.remotePath) restoredSess.remotePath = tabData.remotePath;
          if (tabData.localPath) restoredSess.localPath = tabData.localPath;

          if (window.connectToProfileSession) {
            window.connectToProfileSession(prof, restoredSess.sessionId, true, tabData.remotePath, tabData.localPath)
              .then(() => {
                log('info', `Phase 8 [Tab ${i + 1}/${validSavedTabs.length}]: ✓ Connection established cleanly for restored tab [${restoredSess.sessionId}].`);
              })
              .catch((err) => {
                log('error', `Phase 8 [Tab ${i + 1}/${validSavedTabs.length}]: Connection failed for restored tab [${restoredSess.sessionId}]: ${err.message}`);
                this.updateSessionConnectionState(restoredSess.sessionId, false, prof);
              });
          }
        } else {
          log('warning', `Phase 6 [Tab ${i + 1}/${validSavedTabs.length}]: Skipping invalid saved tab data (missing host/profile).`);
        }
      }

      if (this.sessions.length > 0) {
        log('info', `Phase 9: Switching active view to restored session tab [${this.sessions[0].sessionId}].`);
        this.setActiveSession(this.sessions[0].sessionId);
      } else {
        log('warning', 'Phase 9: Creating default empty workspace session & opening Session Launcher...');
        this.createDefaultSession();
        openLauncherIfEmpty();
      }
    } catch (e) {
      log('error', `Workspace Session Restore exception: ${e.message}`);
      if (this.sessions.length === 0) {
        this.createDefaultSession(); // Prevent leaving workspace completely empty (Issue 7.3)
      }
      openLauncherIfEmpty();
    } finally {
      this.isRestoring = false;
    }
  }
};
