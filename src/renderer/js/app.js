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
 * DevsFTP Renderer Application Controller
 * Manages app lifecycle, theme engine, Workspace Identity Accent System,
 * unified single-window preferences, status bar, and independent drawer panel layout.
 */

// Global App Controller Namespace
window.DevsApp = {
  hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
        case gNorm: h = (bNorm - rNorm) / d + 2; break;
        case bNorm: h = (rNorm - gNorm) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  },

  hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  },

  applyWorkspaceIdentityAccent(colorHex) {
    if (!colorHex || !/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
      colorHex = '#68a063';
    }

    const hsl = this.hexToHsl(colorHex);
    const hoverL = Math.max(0, hsl.l - 6);
    const hoverHex = this.hslToHex(hsl.h, hsl.s, hoverL);
    const root = document.documentElement;

    root.style.setProperty('--accent-primary-hex', colorHex);
    root.style.setProperty('--accent-hover-hex', hoverHex);

    root.style.setProperty('--accent-primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    root.style.setProperty('--accent-hover', `${hsl.h} ${hsl.s}% ${hoverL}%`);
    root.style.setProperty('--bg-selected', `hsl(${hsl.h}, ${hsl.s}%, 18%)`);

    // Update terminal colors live
    const currentTheme = root.getAttribute('data-theme') || 'dark';
    if (window.SSHTerminal) {
      window.SSHTerminal.setTheme(currentTheme, colorHex);
    }
  },

  copyToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (err) {
      console.error('Clipboard copy error:', err);
      return false;
    }
  },

  async exportWorkspacePackage() {
    const api = window.devsFTP || window.pulseFTP;
    try {
      let profiles = [];
      if (api && api.profiles && api.profiles.getAll) {
        try { profiles = await api.profiles.getAll(); } catch (e) {}
      }
      
      const localBm = (window.FileBrowser && typeof window.FileBrowser.getLocalBookmarks === 'function') ? window.FileBrowser.getLocalBookmarks() : [];
      const globalBm = (window.FileBrowser && typeof window.FileBrowser.getGlobalBookmarks === 'function') ? window.FileBrowser.getGlobalBookmarks() : [];
      const profileBm = (window.FileBrowser && typeof window.FileBrowser.getProfileBookmarksMap === 'function') ? window.FileBrowser.getProfileBookmarksMap() : {};

      const preferences = {
        theme: localStorage.getItem('devsftp_pref_theme') || 'system',
        autoupload: localStorage.getItem('devsftp_pref_autoupload') || 'prompt',
        conflictPolicy: localStorage.getItem('devsftp_pref_conflict_policy') || 'prompt',
        notifyTransfers: localStorage.getItem('devsftp_pref_notify_transfers') !== 'false',
        notifyChime: localStorage.getItem('devsftp_pref_notify_chime') !== 'false',
        autoupdate: localStorage.getItem('devsftp_pref_autoupdate') !== 'false',
        termFont: localStorage.getItem('devsftp_pref_term_font') || 'Cascadia Code, Consolas, monospace',
        termFontSize: localStorage.getItem('devsftp_pref_term_fontsize') || 13,
        termCursorStyle: localStorage.getItem('devsftp_pref_term_cursor_style') || 'block',
        termCursorBlink: localStorage.getItem('devsftp_pref_term_cursor_blink') !== 'false',
        termScrollback: localStorage.getItem('devsftp_pref_term_scrollback') || 5000,
        transferSettings: localStorage.getItem('devsftp_transfer_settings') || null
      };

      let scheduledJobs = [];
      if (api && api.jobs && api.jobs.getAll) {
        try { scheduledJobs = await api.jobs.getAll(); } catch (e) {}
      }

      const bundle = {
        devsftpVersion: '1.0.1',
        exportedAt: new Date().toISOString(),
        profiles: profiles || [],
        bookmarks: {
          local: localBm || [],
          profile: profileBm || {},
          global: globalBm || []
        },
        preferences,
        scheduledJobs: scheduledJobs || []
      };

      const jsonString = JSON.stringify(bundle, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `devsftp-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();

      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `📦 Exported Unified Workspace Package (${profiles.length} profile(s), ${globalBm.length + localBm.length} bookmark(s), preferences, scheduled jobs).`);
      }
    } catch (err) {
      console.error('Failed to export workspace package:', err);
      alert(`Failed to export workspace package: ${err.message}`);
    }
  },

  async importWorkspacePackage(jsonContent = null) {
    const api = window.devsFTP || window.pulseFTP;
    if (!jsonContent) {
      jsonContent = prompt('Paste your DevsFTP Workspace Package JSON content to import:');
      if (!jsonContent) return;
    }

    try {
      const bundle = JSON.parse(jsonContent);
      let countProfiles = 0;
      let countBookmarks = 0;
      let countJobs = 0;

      // 1. Import Profiles
      if (bundle.profiles && Array.isArray(bundle.profiles)) {
        if (api && api.profiles && api.profiles.upsert) {
          for (const p of bundle.profiles) {
            await api.profiles.upsert(p);
            countProfiles++;
          }
        }
      } else if (Array.isArray(bundle)) {
        if (api && api.profiles && api.profiles.import) {
          await api.profiles.import(JSON.stringify(bundle));
          countProfiles = bundle.length;
        }
      }

      // 2. Import Bookmarks
      if (bundle.bookmarks) {
        if (bundle.bookmarks.local && Array.isArray(bundle.bookmarks.local)) {
          const existingLocal = window.FileBrowser ? window.FileBrowser.getLocalBookmarks() : [];
          const merged = Array.from(new Set([...existingLocal, ...bundle.bookmarks.local]));
          localStorage.setItem('devsftp_local_bookmarks', JSON.stringify(merged));
          countBookmarks += bundle.bookmarks.local.length;
        }
        if (bundle.bookmarks.profile && typeof bundle.bookmarks.profile === 'object') {
          const existingMap = window.FileBrowser ? window.FileBrowser.getProfileBookmarksMap() : {};
          Object.assign(existingMap, bundle.bookmarks.profile);
          localStorage.setItem('devsftp_profile_bookmarks', JSON.stringify(existingMap));
        }
        if (bundle.bookmarks.global && Array.isArray(bundle.bookmarks.global)) {
          const existingGlobal = window.FileBrowser ? window.FileBrowser.getGlobalBookmarks() : [];
          const mergedGlobal = [...existingGlobal];
          bundle.bookmarks.global.forEach(g => {
            if (!mergedGlobal.some(x => x.path === g.path && x.profileId === g.profileId)) {
              mergedGlobal.push(g);
              countBookmarks++;
            }
          });
          localStorage.setItem('devsftp_global_bookmarks', JSON.stringify(mergedGlobal));
        }
      }

      // 3. Import Preferences
      if (bundle.preferences && typeof bundle.preferences === 'object') {
        const prefs = bundle.preferences;
        if (prefs.theme) localStorage.setItem('devsftp_pref_theme', prefs.theme);
        if (prefs.autoupload) localStorage.setItem('devsftp_pref_autoupload', prefs.autoupload);
        if (prefs.conflictPolicy) localStorage.setItem('devsftp_pref_conflict_policy', prefs.conflictPolicy);
        if (prefs.notifyTransfers !== undefined) localStorage.setItem('devsftp_pref_notify_transfers', prefs.notifyTransfers);
        if (prefs.notifyChime !== undefined) localStorage.setItem('devsftp_pref_notify_chime', prefs.notifyChime);
        if (prefs.autoupdate !== undefined) localStorage.setItem('devsftp_pref_autoupdate', prefs.autoupdate);
        if (prefs.termFont) localStorage.setItem('devsftp_pref_term_font', prefs.termFont);
        if (prefs.termFontSize) localStorage.setItem('devsftp_pref_term_fontsize', prefs.termFontSize);
        if (prefs.termCursorStyle) localStorage.setItem('devsftp_pref_term_cursor_style', prefs.termCursorStyle);
        if (prefs.termCursorBlink !== undefined) localStorage.setItem('devsftp_pref_term_cursor_blink', prefs.termCursorBlink);
        if (prefs.termScrollback) localStorage.setItem('devsftp_pref_term_scrollback', prefs.termScrollback);
        if (prefs.transferSettings) localStorage.setItem('devsftp_transfer_settings', typeof prefs.transferSettings === 'string' ? prefs.transferSettings : JSON.stringify(prefs.transferSettings));
      }

      // 4. Import Scheduled Jobs
      if (bundle.scheduledJobs && Array.isArray(bundle.scheduledJobs)) {
        if (api && api.jobs && api.jobs.upsert) {
          for (const job of bundle.scheduledJobs) {
            await api.jobs.upsert(job);
            countJobs++;
          }
        }
      }

      alert(`✓ Workspace Package imported cleanly!\n• Profiles: ${countProfiles}\n• Bookmarks: ${countBookmarks}\n• Scheduled Jobs: ${countJobs}`);
      if (window.LogViewer) {
        window.LogViewer.addEntry('info', `📥 Imported Unified Workspace Package (${countProfiles} profiles, ${countBookmarks} bookmarks, ${countJobs} jobs).`);
      }

      if (window.ConnectionDialog && window.ConnectionDialog.loadProfiles) {
        window.ConnectionDialog.loadProfiles();
      }
      if (window.FileBrowser && window.FileBrowser.renderGlobalBookmarksModal) {
        window.FileBrowser.renderGlobalBookmarksModal();
      }
    } catch (err) {
      console.error('Failed to import workspace package:', err);
      alert(`Failed to import workspace package: ${err.message}`);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const getApi = () => window.devsFTP || window.pulseFTP;
  const logDiagnostic = (event, details = null, level = 'info') => {
    const api = getApi();
    const entry = {
      scope: 'renderer',
      event,
      level,
      details
    };
    if (api && api.diagnosticLog) {
      api.diagnosticLog(entry);
    } else if (api && api.appendDebugLog) {
      api.appendDebugLog(`[renderer][${level}][${event}] ${details ? JSON.stringify(details) : ''}`);
    }
  };

  // About DevsFTP Website & Updates Controller
  const openWebsite = (url = 'https://devsftp.com') => {
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.openExternal) {
      api.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const updateModal = document.getElementById('update-modal');
  const updateModalCloseBtn = document.getElementById('btn-update-modal-close');
  const updateModalDismissBtn = document.getElementById('btn-update-modal-dismiss');
  const updateModalDownloadBtn = document.getElementById('btn-update-modal-download');
  const updateModalTitle = document.getElementById('update-modal-version-title');
  const updateModalCurrentVer = document.getElementById('update-modal-current-ver');
  const updateModalLatestVer = document.getElementById('update-modal-latest-ver');
  const updateModalNotes = document.getElementById('update-modal-release-notes');
  const topUpdateBtn = document.getElementById('btn-top-update-available');
  let cachedUpdateData = null;

  window.UpdateModal = {
    open(data) {
      if (!updateModal || !data) return;
      cachedUpdateData = data;
      if (updateModalTitle) updateModalTitle.textContent = `DevsFTP v${data.latestVersion} Available!`;
      if (updateModalCurrentVer) updateModalCurrentVer.textContent = `v${data.currentVersion || '1.0.0'}`;
      if (updateModalLatestVer) updateModalLatestVer.textContent = `v${data.latestVersion}`;
      if (updateModalNotes) updateModalNotes.textContent = data.releaseNotes || 'New release available on devsftp.com.';
      updateModal.setAttribute('aria-hidden', 'false');
      updateModal.classList.add('active');
    },
    close() {
      if (!updateModal) return;
      updateModal.classList.remove('active');
      updateModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (updateModalCloseBtn) updateModalCloseBtn.addEventListener('click', () => window.UpdateModal.close());
  if (updateModalDismissBtn) updateModalDismissBtn.addEventListener('click', () => window.UpdateModal.close());
  if (updateModalDownloadBtn) {
    updateModalDownloadBtn.addEventListener('click', () => {
      window.UpdateModal.close();
      openWebsite(cachedUpdateData ? (cachedUpdateData.downloadUrl || 'https://devsftp.com/download/') : 'https://devsftp.com/download/');
    });
  }

  if (topUpdateBtn) {
    topUpdateBtn.addEventListener('click', () => {
      if (cachedUpdateData) window.UpdateModal.open(cachedUpdateData);
    });
  }

  const doCheckForUpdates = async (statusEl, isUserInitiated = true) => {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#F59E0B';
      statusEl.textContent = '⏳ Checking server for updates (devsftp.com/version.json)...';
    }
    try {
      const api = window.devsFTP || window.pulseFTP;
      const res = api && api.checkForUpdates ? await api.checkForUpdates() : null;
      if (res && res.updateAvailable) {
        cachedUpdateData = res;
        if (topUpdateBtn) topUpdateBtn.style.display = 'inline-block';
        if (statusEl) {
          statusEl.style.color = '#68a063';
          statusEl.innerHTML = `🎉 Update available: DevsFTP v${res.latestVersion}! <a href="#" class="link-download-update-action" style="color: #38BDF8; text-decoration: underline;">View Update Details</a>`;
          const link = statusEl.querySelector('.link-download-update-action');
          if (link) link.onclick = (e) => { e.preventDefault(); window.UpdateModal.open(res); };
        }
        if (isUserInitiated) {
          window.UpdateModal.open(res);
        }
      } else {
        if (topUpdateBtn) topUpdateBtn.style.display = 'none';
        if (statusEl) {
          statusEl.style.color = '#34D399';
          statusEl.textContent = `✓ You are running the latest version of DevsFTP (${res ? 'v' + res.currentVersion : 'v1.0.0'}).`;
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.style.color = '#FCA5A5';
        statusEl.textContent = '⚠️ Unable to connect to update server (devsftp.com).';
      }
    }
  };

  const uploadPromptStorageKey = 'devsftp_live_edit_upload_prompt_disabled';
  const uploadPromptModal = document.getElementById('upload-save-modal');
  const uploadPromptFile = document.getElementById('upload-save-modal-file');
  const uploadPromptRemote = document.getElementById('upload-save-modal-remote');
  const uploadPromptMessage = document.getElementById('upload-save-modal-message');
  const uploadPromptCheckbox = document.getElementById('upload-save-modal-dont-show-again');
  const uploadPromptConfirmBtn = document.getElementById('btn-upload-save-confirm');
  const uploadPromptCancelBtn = document.getElementById('btn-upload-save-cancel');
  const uploadPromptCloseBtn = document.getElementById('btn-upload-save-close');
  const uploadPromptState = { resolve: null };

  const isUploadPromptSuppressed = () => {
    try {
      return localStorage.getItem(uploadPromptStorageKey) === 'true';
    } catch (e) {
      return false;
    }
  };

  const setUploadPromptSuppressed = (value) => {
    try {
      if (value) {
        localStorage.setItem(uploadPromptStorageKey, 'true');
      } else {
        localStorage.removeItem(uploadPromptStorageKey);
      }
    } catch (e) {}
  };

  const closeUploadPrompt = (result) => {
    if (!uploadPromptModal) return;
    uploadPromptModal.classList.remove('active');
    uploadPromptModal.setAttribute('aria-hidden', 'true');
    const resolve = uploadPromptState.resolve;
    uploadPromptState.resolve = null;
    if (resolve) resolve(result);
  };

  const uploadPromptDiscardBtn = document.getElementById('btn-upload-save-discard');
  const uploadPromptProfile = document.getElementById('upload-save-modal-profile');

  const openUploadPrompt = (data) => {
    if (isUploadPromptSuppressed()) {
      return Promise.resolve('upload');
    }

    if (!uploadPromptModal) {
      return Promise.resolve(confirm(`Detected changes saved in ${data.fileName}.\nDo you want to automatically upload changes back to remote server?`) ? 'upload' : 'queue');
    }

    return new Promise((resolve) => {
      uploadPromptState.resolve = resolve;

      if (uploadPromptFile) uploadPromptFile.textContent = data.fileName || 'cached file';
      if (uploadPromptRemote) uploadPromptRemote.textContent = data.remotePath || '/';
      if (uploadPromptProfile) uploadPromptProfile.textContent = data.profileName || data.profileId || 'Connection';
      if (uploadPromptCheckbox) uploadPromptCheckbox.checked = false;

      uploadPromptModal.setAttribute('aria-hidden', 'false');
      uploadPromptModal.classList.add('active');
    });
  };

  if (uploadPromptConfirmBtn) {
    uploadPromptConfirmBtn.addEventListener('click', () => {
      if (uploadPromptCheckbox && uploadPromptCheckbox.checked) {
        setUploadPromptSuppressed(true);
      }
      closeUploadPrompt('upload');
    });
  }

  if (uploadPromptCancelBtn) {
    uploadPromptCancelBtn.addEventListener('click', () => closeUploadPrompt('queue'));
  }

  if (uploadPromptDiscardBtn) {
    uploadPromptDiscardBtn.addEventListener('click', () => closeUploadPrompt('discard'));
  }

  if (uploadPromptCloseBtn) {
    uploadPromptCloseBtn.addEventListener('click', () => closeUploadPrompt('queue'));
  }

  if (uploadPromptModal) {
    uploadPromptModal.addEventListener('click', (event) => {
      if (event.target === uploadPromptModal) {
        closeUploadPrompt(false);
      }
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (uploadPromptModal && uploadPromptModal.classList.contains('active')) {
        closeUploadPrompt(false);
      }
      const clearCacheModal = document.getElementById('clear-cache-modal');
      if (clearCacheModal && clearCacheModal.classList.contains('active')) {
        clearCacheModal.classList.remove('active');
      }
      const shortcutsModal = document.getElementById('shortcuts-modal');
      if (shortcutsModal && shortcutsModal.classList.contains('active')) {
        shortcutsModal.classList.remove('active');
        shortcutsModal.setAttribute('aria-hidden', 'true');
      }
    }
    if (event.ctrlKey && event.shiftKey && (event.key === 'Delete' || event.key === 'Del')) {
      event.preventDefault();
      if (window.openClearCacheModal) {
        window.openClearCacheModal();
      }
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      const menuToolsExport = document.getElementById('menu-tools-export');
      if (menuToolsExport) menuToolsExport.click();
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      const menuToolsImport = document.getElementById('menu-tools-import');
      if (menuToolsImport) menuToolsImport.click();
    }
  });

  window.UploadPromptDialog = {
    show: openUploadPrompt,
    hide: () => closeUploadPrompt(false),
    isSuppressed: isUploadPromptSuppressed,
    setSuppressed: setUploadPromptSuppressed
  };

  try {
    logDiagnostic('startup', { phase: 'DOMContentLoaded' });

    // Master Password Top-Layer Gate.
    // startNormalApp() is the ONLY entry point for all app logic.
    // It runs only after master password is confirmed, or immediately if disabled.
    let isAppStarted = false;
    const startNormalApp = () => {
      if (isAppStarted) return;
      isAppStarted = true;

      // Initialize Subcomponents
      window.LogViewer.init();
      window.TransferQueue.init();
      window.SSHTerminal.init();
      window.FileBrowser.init();
      window.ConnectionDialog.init();
      if (window.ScheduledJobs) window.ScheduledJobs.init();
      if (window.TunnelManager) window.TunnelManager.init();

      // Check for update availability on startup
      try {
        const autoCheckPref = localStorage.getItem('devsftp_pref_auto_check_updates') !== 'false';
        if (autoCheckPref) {
          setTimeout(() => {
            doCheckForUpdates(null, false);
          }, 1500);
        }
      } catch (e) {}

      // Start session manager and workspace restore
      window.SessionManager.init();

      window.updateWorkspaceBadges = () => {
        const tabsCb = document.getElementById('pref-restore-tabs');
        const tabsBadge = document.getElementById('restore-tabs-badge');
        if (tabsCb && tabsBadge) {
          if (tabsCb.checked) {
            tabsBadge.textContent = 'Active';
            tabsBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            tabsBadge.style.color = '#34D399';
          } else {
            tabsBadge.textContent = 'Disabled';
            tabsBadge.style.background = 'rgba(100, 116, 139, 0.2)';
            tabsBadge.style.color = '#94A3B8';
          }
        }

        const drawerCb = document.getElementById('pref-restore-bottom-drawer');
        const drawerBadge = document.getElementById('restore-drawer-badge');
        if (drawerCb && drawerBadge) {
          if (drawerCb.checked) {
            drawerBadge.textContent = 'Active';
            drawerBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            drawerBadge.style.color = '#34D399';
          } else {
            drawerBadge.textContent = 'Disabled';
            drawerBadge.style.background = 'rgba(100, 116, 139, 0.2)';
            drawerBadge.style.color = '#94A3B8';
          }
        }
      }; // end updateWorkspaceBadges

      const prefRestoreTabs = document.getElementById('pref-restore-tabs');
    if (prefRestoreTabs) {
      const stored = localStorage.getItem('devsftp_pref_restore_tabs');
      prefRestoreTabs.checked = (stored === 'true');
      prefRestoreTabs.addEventListener('change', (e) => {
        localStorage.setItem('devsftp_pref_restore_tabs', e.target.checked ? 'true' : 'false');
        window.updateWorkspaceBadges();
      });
    }

    const prefRestoreDrawer = document.getElementById('pref-restore-bottom-drawer');
    if (prefRestoreDrawer) {
      prefRestoreDrawer.addEventListener('change', () => window.updateWorkspaceBadges());
    }

    window.updateWorkspaceBadges();

    const btnClearSavedSessions = document.getElementById('btn-clear-saved-sessions');
    if (btnClearSavedSessions) {
      btnClearSavedSessions.addEventListener('click', () => {
        window.verifyMasterPasswordIfEnabled(() => {
          localStorage.removeItem('devsftp_workspace_saved_tabs');
          const msg = document.getElementById('clear-sessions-msg');
          if (msg) {
            msg.style.display = 'inline-block';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
          }
          if (window.LogViewer) window.LogViewer.addEntry('info', '[Workspace Storage] Saved workspace sessions storage cleared cleanly.');
        });
      });
    }



    // =========================================================================
    // Bug Reporting & Feedback Dialog Controller (devsftp.com/bugs.php)
    // =========================================================================
    const bugReportModal = document.getElementById('bug-report-modal');
    const bugFormView = document.getElementById('bug-report-form-view');
    const bugThankyouView = document.getElementById('bug-report-thankyou-view');
    const bugDescInput = document.getElementById('bug-report-description');
    const btnBugSubmit = document.getElementById('btn-bug-report-submit');

    window.BugReportModal = {
      open() {
        if (!bugReportModal) return;
        if (bugDescInput) {
          bugDescInput.value = '';
          bugDescInput.style.borderColor = '';
        }
        if (bugFormView) bugFormView.style.display = 'block';
        if (bugThankyouView) bugThankyouView.style.display = 'none';
        if (btnBugSubmit) {
          btnBugSubmit.disabled = false;
          btnBugSubmit.textContent = '🚀 Submit Report';
        }
        bugReportModal.setAttribute('aria-hidden', 'false');
        bugReportModal.classList.add('active');
      },
      close() {
        if (!bugReportModal) return;
        bugReportModal.classList.remove('active');
        bugReportModal.setAttribute('aria-hidden', 'true');
      }
    };

    const btnBugClose = document.getElementById('btn-bug-report-close');
    if (btnBugClose) btnBugClose.addEventListener('click', () => window.BugReportModal.close());

    const btnBugDone = document.getElementById('btn-bug-report-done');
    if (btnBugDone) btnBugDone.addEventListener('click', () => window.BugReportModal.close());

    const btnBugVisit = document.getElementById('btn-bug-report-visit');
    if (btnBugVisit) btnBugVisit.addEventListener('click', () => openWebsite('https://devsftp.com'));

    const btnBugWebLink = document.getElementById('btn-bug-report-web-link');
    if (btnBugWebLink) btnBugWebLink.addEventListener('click', () => openWebsite('https://devsftp.com/issue-tracker/'));

    const btnBugExportLog = document.getElementById('btn-bug-report-export-log');
    if (btnBugExportLog) {
      btnBugExportLog.addEventListener('click', async () => {
        const api = window.devsFTP || window.pulseFTP;
        if (api && api.exportDiagnostics) {
          try {
            const res = await api.exportDiagnostics();
            if (res && res.filePath) {
              if (window.LogViewer) window.LogViewer.addEntry('info', `📄 Diagnostic log package saved to Downloads: ${res.filePath}`);
              alert(`Diagnostic package saved to your Downloads folder:\n${res.filePath}`);
            }
          } catch (err) {
            console.error('Failed to export diagnostics:', err);
            alert(`Failed to export diagnostics: ${err.message}`);
          }
        }
      });
    }

    if (btnBugSubmit) {
      btnBugSubmit.addEventListener('click', async () => {
        const desc = bugDescInput ? bugDescInput.value.trim() : '';
        if (!desc) {
          if (bugDescInput) {
            bugDescInput.style.borderColor = 'hsl(var(--status-danger))';
            bugDescInput.focus();
          }
          return;
        }

        btnBugSubmit.disabled = true;
        btnBugSubmit.textContent = '⏳ Transmitting to devsftp.com/bugs.php...';

        const api = window.devsFTP || window.pulseFTP;
        try {
          if (api && api.submitBugReport) {
            await api.submitBugReport({ description: desc, includeLogs: true });
          }
          if (bugFormView) bugFormView.style.display = 'none';
          if (bugThankyouView) bugThankyouView.style.display = 'block';
        } catch (err) {
          console.error('Failed to submit bug report:', err);
          alert(`Failed to submit bug report: ${err.message}`);
          btnBugSubmit.disabled = false;
          btnBugSubmit.textContent = '🚀 Submit Report';
        }
      });
    }

    // Top Navigation Menu Items Wiring
    const menuHelpIssue = document.getElementById('menu-help-issue');
    if (menuHelpIssue) {
      menuHelpIssue.addEventListener('click', () => window.BugReportModal.open());
    }

    const menuHelpUpdate = document.getElementById('menu-help-update');
    if (menuHelpUpdate) {
      menuHelpUpdate.addEventListener('click', () => {
        const aboutModal = document.getElementById('about-modal');
        if (aboutModal) {
          aboutModal.setAttribute('aria-hidden', 'false');
          aboutModal.classList.add('active');
        }
        doCheckForUpdates(updateMsgTab);
      });
    }

    const menuHelpDocs = document.getElementById('menu-help-docs');
    if (menuHelpDocs) {
      menuHelpDocs.addEventListener('click', () => openWebsite('https://devsftp.com/documents/'));
    }

    // Keyboard Shortcuts Modal wiring
    const menuHelpShortcuts = document.getElementById('menu-help-shortcuts');
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const btnShortcutsClose = document.getElementById('btn-shortcuts-close');
    const btnShortcutsCloseX = document.getElementById('btn-shortcuts-close-x');

    const closeShortcutsModal = () => {
      if (shortcutsModal) {
        shortcutsModal.classList.remove('active');
        shortcutsModal.setAttribute('aria-hidden', 'true');
      }
    };

    if (menuHelpShortcuts) {
      menuHelpShortcuts.addEventListener('click', () => {
        if (shortcutsModal) {
          shortcutsModal.classList.add('active');
          shortcutsModal.setAttribute('aria-hidden', 'false');
        }
      });
    }
    if (btnShortcutsClose) btnShortcutsClose.addEventListener('click', closeShortcutsModal);
    if (btnShortcutsCloseX) btnShortcutsCloseX.addEventListener('click', closeShortcutsModal);

    const btnVisitWebsite = document.getElementById('btn-about-visit-website');
    const btnVisitWebsiteTab = document.getElementById('btn-about-tab-visit-website');
    const linkAboutTabWebsite = document.getElementById('about-tab-website-link');

    if (btnVisitWebsite) btnVisitWebsite.addEventListener('click', () => openWebsite('https://devsftp.com'));
    if (btnVisitWebsiteTab) btnVisitWebsiteTab.addEventListener('click', () => openWebsite('https://devsftp.com'));
    if (linkAboutTabWebsite) linkAboutTabWebsite.addEventListener('click', (e) => { e.preventDefault(); openWebsite('https://devsftp.com'); });

    const btnCheckUpdates = document.getElementById('btn-about-check-updates');
    const updateMsg = document.getElementById('update-status-msg');

    const btnCheckUpdatesTab = document.getElementById('btn-about-tab-check-updates');
    const updateMsgTab = document.getElementById('about-tab-update-status');

    if (btnCheckUpdates) btnCheckUpdates.addEventListener('click', () => doCheckForUpdates(updateMsg, true));
    if (btnCheckUpdatesTab) btnCheckUpdatesTab.addEventListener('click', () => doCheckForUpdates(updateMsgTab, true));

    // Reset Preferences button
    const btnResetPrefs = document.getElementById('btn-reset-preferences');
    const resetPrefsModal = document.getElementById('reset-prefs-modal');
    const btnResetPrefsConfirm = document.getElementById('btn-reset-prefs-confirm');
    const btnResetPrefsCancel = document.getElementById('btn-reset-prefs-cancel');
    const btnResetPrefsCancelX = document.getElementById('btn-reset-prefs-cancel-x');

    const closeResetModal = () => {
      if (resetPrefsModal) { resetPrefsModal.classList.remove('active'); resetPrefsModal.setAttribute('aria-hidden', 'true'); }
    };

    if (btnResetPrefs) btnResetPrefs.addEventListener('click', () => {
      window.verifyMasterPasswordIfEnabled(() => {
        if (resetPrefsModal) { resetPrefsModal.classList.add('active'); resetPrefsModal.setAttribute('aria-hidden', 'false'); }
      });
    });
    if (btnResetPrefsCancel) btnResetPrefsCancel.addEventListener('click', closeResetModal);
    if (btnResetPrefsCancelX) btnResetPrefsCancelX.addEventListener('click', closeResetModal);
    if (btnResetPrefsConfirm) btnResetPrefsConfirm.addEventListener('click', () => {
      window.verifyMasterPasswordIfEnabled(() => {
        const prefKeys = [
          'devsftp_pref_theme',
          'devsftp_pref_restore_tabs',
          'devsftp_pref_auto_check_updates',
          'devsftp_pref_autoupdate',
          'devsftp_pref_notify_transfers',
          'devsftp_pref_notify_chime',
          'devsftp_pref_term_font',
          'devsftp_pref_term_fontsize',
          'devsftp_pref_term_cursor_style',
          'devsftp_pref_term_cursor_blink',
          'devsftp_pref_term_scrollback',
          'devsftp_workspace_panel_prefs',
          'devsftp_live_edit_upload_prompt_disabled',
          'devsftp_preferences_last_section'
        ];
        prefKeys.forEach(k => localStorage.removeItem(k));
        closeResetModal();
        window.location.reload();
      });
    });

    const prefAutoCheck = document.getElementById('pref-auto-check-updates');
    if (prefAutoCheck) {
      prefAutoCheck.checked = localStorage.getItem('devsftp_pref_auto_check_updates') !== 'false';
      prefAutoCheck.addEventListener('change', (e) => {
        localStorage.setItem('devsftp_pref_auto_check_updates', e.target.checked ? 'true' : 'false');
      });
    }

    // Exclusion Rules Preference Wiring
    const exApi = getApi();
    if (exApi && exApi.getExclusionPrefs) {
      exApi.getExclusionPrefs().then(prefs => {
        if (!prefs) return;
        const cbEnabled = document.getElementById('pref-exclusion-enabled');
        const cbGitignore = document.getElementById('pref-exclusion-gitignore');
        const txtPatterns = document.getElementById('pref-exclusion-patterns');
        if (cbEnabled) cbEnabled.checked = Boolean(prefs.enabled);
        if (cbGitignore) cbGitignore.checked = Boolean(prefs.honorGitignore);
        if (txtPatterns && Array.isArray(prefs.patterns)) {
          txtPatterns.value = prefs.patterns.join('\n');
        }
      }).catch(e => {});
    }

    const btnSaveExclusion = document.getElementById('btn-save-exclusion-rules');
    if (btnSaveExclusion) {
      btnSaveExclusion.addEventListener('click', async () => {
        const cbEnabled = document.getElementById('pref-exclusion-enabled');
        const cbGitignore = document.getElementById('pref-exclusion-gitignore');
        const txtPatterns = document.getElementById('pref-exclusion-patterns');
        const msg = document.getElementById('exclusion-save-msg');

        const rawPatterns = txtPatterns ? txtPatterns.value : '';
        const patterns = rawPatterns.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

        const newPrefs = {
          enabled: cbEnabled ? cbEnabled.checked : true,
          honorGitignore: cbGitignore ? cbGitignore.checked : true,
          patterns
        };

        if (exApi && exApi.saveExclusionPrefs) {
          try {
            await exApi.saveExclusionPrefs(newPrefs);
            if (msg) {
              msg.style.display = 'block';
              setTimeout(() => { msg.style.display = 'none'; }, 3000);
            }
          } catch (err) {
            console.error('Failed to save exclusion rules:', err);
            alert(`Failed to save exclusion rules: ${err.message}`);
          }
        }
      });
    }

    // Directory Size Calculator Preference Wiring
    const prefAutoCalcDir = document.getElementById('pref-auto-calculate-dir-size');
    if (prefAutoCalcDir && exApi && exApi.getDirSizePrefs) {
      exApi.getDirSizePrefs().then(prefs => {
        if (prefs) {
          prefAutoCalcDir.checked = Boolean(prefs.autoCalculate);
        }
      }).catch(() => {});

      prefAutoCalcDir.addEventListener('change', async (e) => {
        if (exApi.saveDirSizePrefs) {
          try {
            await exApi.saveDirSizePrefs({ autoCalculate: e.target.checked });
          } catch (err) {
            console.error('Failed to save directory size calculation preferences:', err);
          }
        }
      });
    }

    const btnDirCompare = document.getElementById('btn-dir-compare');
    if (btnDirCompare) {
      btnDirCompare.addEventListener('click', () => {
        if (window.DirectoryCompare) {
          window.DirectoryCompare.toggleCompare();
        }
      });
    }

  // =========================================================================
  // 1. Workspace Panel Independent Sizing & Layout Persistence Store
  // =========================================================================
  const DEFAULT_PANEL_PREFS = {
    activeTab: 'tab-terminal',
    panels: {
      'tab-terminal':  { height: 200, collapsed: false },
      'tab-tunnels':   { height: 200, collapsed: false },
      'tab-queue':     { height: 200, collapsed: false },
      'tab-schedules': { height: 200, collapsed: false },
      'tab-logs':      { height: 200, collapsed: false }
    }
  };

  const getWorkspacePrefs = () => {
    try {
      const raw = localStorage.getItem('devsftp_workspace_panel_prefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          activeTab: parsed.activeTab || 'tab-terminal',
          panels: {
            ...DEFAULT_PANEL_PREFS.panels,
            ...(parsed.panels || {})
          }
        };
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_PANEL_PREFS));
  };

  const saveWorkspacePrefs = (prefs) => {
    try {
      localStorage.setItem('devsftp_workspace_panel_prefs', JSON.stringify(prefs));
    } catch (e) {}
  };

  const applyPanelLayout = (tabId) => {
    const prefs = getWorkspacePrefs();
    prefs.activeTab = tabId;
    const panelConfig = prefs.panels[tabId] || { height: 220, collapsed: false };

    document.querySelectorAll('.drawer-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.drawer-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    const drawer = document.getElementById('bottom-drawer');
    const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
    const btnHeaderToggleDrawer = document.getElementById('btn-header-toggle-drawer');

    if (panelConfig.collapsed) {
      drawer.classList.add('collapsed');
      btnToggleDrawer.textContent = '▲ Expand';
      if (btnHeaderToggleDrawer) btnHeaderToggleDrawer.classList.remove('active');
    } else {
      drawer.classList.remove('collapsed');
      drawer.style.height = `${panelConfig.height}px`;
      btnToggleDrawer.textContent = '▼ Minimize';
      if (btnHeaderToggleDrawer) btnHeaderToggleDrawer.classList.add('active');
    }

    saveWorkspacePrefs(prefs);

    if (tabId === 'tab-terminal' && window.SSHTerminal) {
      window.SSHTerminal.resize();
      window.SSHTerminal.focus();
    }
  };

  const toggleActivePanelCollapse = () => {
    const prefs = getWorkspacePrefs();
    const currentTab = prefs.activeTab;
    const panelConfig = prefs.panels[currentTab] || { height: 220, collapsed: false };

    panelConfig.collapsed = !panelConfig.collapsed;
    prefs.panels[currentTab] = panelConfig;
    saveWorkspacePrefs(prefs);

    applyPanelLayout(currentTab);
  };

  const initialPrefs = getWorkspacePrefs();
  applyPanelLayout(initialPrefs.activeTab);

  const tabs = document.querySelectorAll('.drawer-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      applyPanelLayout(targetTab);
    });
  });

  const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
  if (btnToggleDrawer) btnToggleDrawer.addEventListener('click', () => toggleActivePanelCollapse());

  // Top Header Action Toolbar Slide-Out Collapsible Controller
  const btnHeaderToggleToolbar = document.getElementById('btn-header-toggle-toolbar');
  const toolbarSlidingContent = document.getElementById('toolbar-sliding-content');

  const setHeaderToolbarState = (isCollapsed) => {
    if (!toolbarSlidingContent || !btnHeaderToggleToolbar) return;
    if (isCollapsed) {
      toolbarSlidingContent.classList.add('collapsed');
      btnHeaderToggleToolbar.classList.remove('active');
      localStorage.setItem('devsftp_header_toolbar_collapsed', 'true');
    } else {
      toolbarSlidingContent.classList.remove('collapsed');
      btnHeaderToggleToolbar.classList.add('active');
      localStorage.setItem('devsftp_header_toolbar_collapsed', 'false');
    }
  };

  const savedToolbarState = localStorage.getItem('devsftp_header_toolbar_collapsed');
  const isSavedCollapsed = savedToolbarState !== null ? (savedToolbarState === 'true') : true;
  setHeaderToolbarState(isSavedCollapsed);

  if (btnHeaderToggleToolbar) {
    btnHeaderToggleToolbar.addEventListener('click', () => {
      const currentlyCollapsed = toolbarSlidingContent ? toolbarSlidingContent.classList.contains('collapsed') : false;
      setHeaderToolbarState(!currentlyCollapsed);
      btnHeaderToggleToolbar.blur();
    });
  }

  // Clear sticky focus state on mouse release/leave for clean accent color resetting
  ['mouseup', 'mouseleave', 'mouseout'].forEach(evtType => {
    document.addEventListener(evtType, (e) => {
      const btn = e.target.closest('button');
      if (btn) btn.blur();
    });
  });

  window.updateHeaderDrawerBadges = function(queueCount, tunnelsCount) {
    const queueBadge = document.getElementById('header-badge-queue');
    const tunnelsBadge = document.getElementById('header-badge-tunnels');
    const group = document.getElementById('header-drawer-badge-group');

    let hasAny = false;
    if (queueBadge) {
      if (typeof queueCount === 'number' && queueCount > 0) {
        queueBadge.textContent = `⚡${queueCount}`;
        queueBadge.style.display = 'inline-block';
        hasAny = true;
      } else {
        queueBadge.style.display = 'none';
      }
    }
    if (tunnelsBadge) {
      if (typeof tunnelsCount === 'number' && tunnelsCount > 0) {
        tunnelsBadge.textContent = `🔀${tunnelsCount}`;
        tunnelsBadge.style.display = 'inline-block';
        hasAny = true;
      } else {
        tunnelsBadge.style.display = 'none';
      }
    }
    if (group) {
      group.style.display = hasAny ? 'inline-flex' : 'none';
    }
  };

  // Keyboard shortcut Ctrl+J / Ctrl+` for drawer toggle
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'j' || e.key === 'J' || e.key === '`')) {
      e.preventDefault();
      toggleActivePanelCollapse();
    }
  });

  const splitter = document.getElementById('workspace-splitter');
  const drawer = document.getElementById('bottom-drawer');
  let isDragging = false;

  splitter.addEventListener('mousedown', (e) => {
    isDragging = true;
    splitter.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const windowHeight = window.innerHeight;
    const newDrawerHeight = windowHeight - e.clientY - 24;

    if (newDrawerHeight >= 80 && newDrawerHeight <= windowHeight - 180) {
      const prefs = getWorkspacePrefs();
      const currentTab = prefs.activeTab;

      drawer.classList.remove('collapsed');
      drawer.style.height = `${newDrawerHeight}px`;

      if (!prefs.panels[currentTab]) prefs.panels[currentTab] = {};
      prefs.panels[currentTab].height = newDrawerHeight;
      prefs.panels[currentTab].collapsed = false;

      document.getElementById('btn-toggle-drawer').textContent = '▼ Minimize';
      saveWorkspacePrefs(prefs);

      if (currentTab === 'tab-terminal' && window.SSHTerminal) {
        window.SSHTerminal.resize();
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      splitter.classList.remove('dragging');
      document.body.style.cursor = 'default';
    }
  });

  splitter.addEventListener('dblclick', () => toggleActivePanelCollapse());

  // =========================================================================
  // 2. Setup Theme Engine & Unified Preferences Sidebar
  // =========================================================================
  const themeBtn = document.getElementById('theme-toggle');
  const prefTheme = document.getElementById('pref-theme');

  const getSystemTheme = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const toggleTheme = (themeName) => {
    const html = document.documentElement;
    let targetSetting = themeName;

    if (!targetSetting) {
      const currentSetting = localStorage.getItem('devsftp_pref_theme') || 'system';
      if (currentSetting === 'system') targetSetting = 'dark';
      else if (currentSetting === 'dark') targetSetting = 'light';
      else targetSetting = 'system';
    }

    try {
      localStorage.setItem('devsftp_pref_theme', targetSetting);
    } catch (e) {}

    const effectiveTheme = targetSetting === 'system' ? getSystemTheme() : targetSetting;
    html.setAttribute('data-theme', effectiveTheme);

    if (themeBtn) {
      if (targetSetting === 'system') themeBtn.textContent = '💻';
      else themeBtn.textContent = effectiveTheme === 'dark' ? '🌙' : '☀️';
      themeBtn.title = `Theme: ${targetSetting.toUpperCase()} (Click to toggle System/Dark/Light)`;
    }

    if (prefTheme && prefTheme.value !== targetSetting) {
      prefTheme.value = targetSetting;
    }

    const activeAccent = html.style.getPropertyValue('--accent-primary-hex') || '#68a063';
    if (window.SSHTerminal) {
      window.SSHTerminal.setTheme(effectiveTheme, activeAccent);
    }

    if (window.LogViewer) window.LogViewer.addEntry('info', `Switched UI theme to ${targetSetting} mode (${effectiveTheme}).`);
  };

  // Restore saved theme preference on startup (defaults to 'system')
  const savedTheme = localStorage.getItem('devsftp_pref_theme') || 'system';
  toggleTheme(savedTheme);

  // Listen to OS System Theme changes live
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const current = localStorage.getItem('devsftp_pref_theme') || 'system';
      if (current === 'system') {
        toggleTheme('system');
      }
    });
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => toggleTheme());
  }

  if (prefTheme) {
    prefTheme.value = savedTheme;
    prefTheme.addEventListener('change', (e) => {
      toggleTheme(e.target.value);
    });
  }

  // General Settings Persistence & Dynamic Badges
  window.updateGeneralBadges = () => {
    const notifyTransfers = document.getElementById('pref-notify-transfers');
    const notifyChime = document.getElementById('pref-notify-chime');
    const notifyBadge = document.getElementById('general-notify-badge');
    if (notifyBadge) {
      const isAnyActive = (notifyTransfers && notifyTransfers.checked) || (notifyChime && notifyChime.checked);
      if (isAnyActive) {
        notifyBadge.textContent = 'Active';
        notifyBadge.className = 'tag-badge badge-active';
      } else {
        notifyBadge.textContent = 'Disabled';
        notifyBadge.className = 'tag-badge badge-disabled';
      }
    }

    const autoupdateCb = document.getElementById('pref-autoupdate');
    const autoupdateBadge = document.getElementById('general-autoupdate-badge');
    if (autoupdateCb && autoupdateBadge) {
      if (autoupdateCb.checked) {
        autoupdateBadge.textContent = 'Active';
        autoupdateBadge.className = 'tag-badge badge-active';
      } else {
        autoupdateBadge.textContent = 'Disabled';
        autoupdateBadge.className = 'tag-badge badge-disabled';
      }
    }
  };

  const prefAutoupdate = document.getElementById('pref-autoupdate');
  if (prefAutoupdate) {
    const stored = localStorage.getItem('devsftp_pref_autoupdate');
    if (stored !== null) prefAutoupdate.checked = (stored === 'true');
    prefAutoupdate.addEventListener('change', (e) => {
      localStorage.setItem('devsftp_pref_autoupdate', e.target.checked ? 'true' : 'false');
    });
  }

  // =========================================================================
  // Notifications Settings Persistence & Master Controls
  // =========================================================================
  const NOTIF_KEYS = [
    { id: 'pref-notify-tray', key: 'devsftp_pref_notify_tray' },
    { id: 'pref-notify-file-save', key: 'devsftp_pref_notify_file_save' },
    { id: 'pref-notify-transfers', key: 'devsftp_pref_notify_transfers' },
    { id: 'pref-notify-jobs', key: 'devsftp_pref_notify_jobs' },
    { id: 'pref-notify-reconnect', key: 'devsftp_pref_notify_reconnect' },
    { id: 'pref-notify-chime', key: 'devsftp_pref_notify_chime' }
  ];

  window.shouldSendNotification = (categoryKey) => {
    const keyMap = {
      'tray': 'devsftp_pref_notify_tray',
      'file-save': 'devsftp_pref_notify_file_save',
      'transfers': 'devsftp_pref_notify_transfers',
      'jobs': 'devsftp_pref_notify_jobs',
      'reconnect': 'devsftp_pref_notify_reconnect',
      'chime': 'devsftp_pref_notify_chime'
    };
    const storageKey = keyMap[categoryKey];
    if (!storageKey) return true;
    const val = localStorage.getItem(storageKey);
    return val === null || val === 'true';
  };

  window.updateNotificationBadges = () => {
    const masterBadge = document.getElementById('notif-master-badge');
    let enabledCount = 0;
    NOTIF_KEYS.forEach(item => {
      const el = document.getElementById(item.id);
      if (el && el.checked) enabledCount++;
    });

    if (masterBadge) {
      if (enabledCount > 0) {
        masterBadge.textContent = 'Active';
        masterBadge.className = 'tag-badge badge-active';
      } else {
        masterBadge.textContent = 'Disabled';
        masterBadge.className = 'tag-badge badge-disabled';
      }
    }
  };

  NOTIF_KEYS.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      const stored = localStorage.getItem(item.key);
      if (stored !== null) el.checked = (stored === 'true');
      el.addEventListener('change', (e) => {
        localStorage.setItem(item.key, e.target.checked ? 'true' : 'false');
        window.updateNotificationBadges();
      });
    }
  });

  const btnNotifEnableAll = document.getElementById('btn-notif-enable-all');
  if (btnNotifEnableAll) {
    btnNotifEnableAll.addEventListener('click', () => {
      NOTIF_KEYS.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
          el.checked = true;
          localStorage.setItem(item.key, 'true');
        }
      });
      window.updateNotificationBadges();
      if (window.LogViewer) window.LogViewer.addEntry('info', 'Enabled all native OS notifications & audio chimes.');
    });
  }

  const btnNotifDisableAll = document.getElementById('btn-notif-disable-all');
  if (btnNotifDisableAll) {
    btnNotifDisableAll.addEventListener('click', () => {
      NOTIF_KEYS.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
          el.checked = false;
          localStorage.setItem(item.key, 'false');
        }
      });
      window.updateNotificationBadges();
      if (window.LogViewer) window.LogViewer.addEntry('info', 'Muted all native OS notifications & audio chimes.');
    });
  }

  window.updateNotificationBadges();

  const prefCloseBehavior = document.getElementById('pref-close-behavior');
  const closeBadge = document.getElementById('close-behavior-badge');
  const updateCloseBadge = (behavior) => {
    if (!closeBadge) return;
    if (behavior === 'tray') {
      closeBadge.textContent = 'System Tray';
      closeBadge.className = 'tag-badge badge-active';
    } else {
      closeBadge.textContent = 'Exit';
      closeBadge.className = 'tag-badge badge-disabled';
    }
  };

  if (prefCloseBehavior) {
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.getCloseBehavior) {
      api.getCloseBehavior().then(behavior => {
        const effectiveBehavior = behavior || 'tray';
        prefCloseBehavior.value = effectiveBehavior;
        updateCloseBadge(effectiveBehavior);
      }).catch(() => {});
    }
    prefCloseBehavior.addEventListener('change', (e) => {
      const behavior = e.target.value;
      if (api && api.saveCloseBehavior) {
        api.saveCloseBehavior(behavior);
      }
      updateCloseBadge(behavior);
    });
  }

  window.updateGeneralBadges();

  // SSH Terminal Settings Persistence & Live Updates
  const applyTerminalPrefs = () => {
    const font = document.getElementById('pref-term-font') ? document.getElementById('pref-term-font').value : 'Cascadia Code, Consolas, monospace';
    const fontsize = document.getElementById('pref-term-fontsize') ? document.getElementById('pref-term-fontsize').value : 13;
    const cursorStyle = document.getElementById('pref-term-cursor-style') ? document.getElementById('pref-term-cursor-style').value : 'block';
    const cursorBlink = document.getElementById('pref-term-cursor-blink') ? document.getElementById('pref-term-cursor-blink').checked : true;
    const scrollback = document.getElementById('pref-term-scrollback') ? document.getElementById('pref-term-scrollback').value : 5000;

    localStorage.setItem('devsftp_pref_term_font', font);
    localStorage.setItem('devsftp_pref_term_fontsize', fontsize);
    localStorage.setItem('devsftp_pref_term_cursor_style', cursorStyle);
    localStorage.setItem('devsftp_pref_term_cursor_blink', cursorBlink ? 'true' : 'false');
    localStorage.setItem('devsftp_pref_term_scrollback', scrollback);

    if (window.SSHTerminal && window.SSHTerminal.updateOptions) {
      window.SSHTerminal.updateOptions({
        fontFamily: font,
        fontSize: fontsize,
        cursorStyle: cursorStyle,
        cursorBlink: cursorBlink,
        scrollback: scrollback
      });
    }
  };

  // Restore terminal settings on startup
  const savedTermFont = localStorage.getItem('devsftp_pref_term_font');
  const savedTermSize = localStorage.getItem('devsftp_pref_term_fontsize');
  const savedTermStyle = localStorage.getItem('devsftp_pref_term_cursor_style');
  const savedTermBlink = localStorage.getItem('devsftp_pref_term_cursor_blink');
  const savedTermScroll = localStorage.getItem('devsftp_pref_term_scrollback');

  const termFontEl = document.getElementById('pref-term-font');
  const termSizeEl = document.getElementById('pref-term-fontsize');
  const termStyleEl = document.getElementById('pref-term-cursor-style');
  const termBlinkEl = document.getElementById('pref-term-cursor-blink');
  const termScrollEl = document.getElementById('pref-term-scrollback');

  if (termFontEl && savedTermFont) termFontEl.value = savedTermFont;
  if (termSizeEl && savedTermSize) termSizeEl.value = savedTermSize;
  if (termStyleEl && savedTermStyle) termStyleEl.value = savedTermStyle;
  if (termBlinkEl && savedTermBlink !== null) termBlinkEl.checked = (savedTermBlink === 'true');
  if (termScrollEl && savedTermScroll) termScrollEl.value = savedTermScroll;

  [termFontEl, termSizeEl, termStyleEl, termBlinkEl, termScrollEl].forEach(el => {
    if (el) {
      el.addEventListener('change', applyTerminalPrefs);
      el.addEventListener('input', applyTerminalPrefs);
    }
  });

  setTimeout(() => applyTerminalPrefs(), 500);

  // Unified Preferences Modal Sidebar Navigation
  const prefNavButtons = document.querySelectorAll('.pref-nav-btn');
  prefNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.getAttribute('data-section');
      window.ConnectionDialog.openPreferences(section);
    });
  });

  const btnOpenPref = document.getElementById('btn-open-preferences');
  if (btnOpenPref) {
    btnOpenPref.addEventListener('click', () => {
      window.ConnectionDialog.openPreferences();
    });
  }

  // =========================================================================
  // 3. Setup Top Menu Bar Dropdowns & Actions
  // =========================================================================
  const dropdowns = document.querySelectorAll('.menu-item-dropdown');
  dropdowns.forEach(dd => {
    const btn = dd.querySelector('.menu-item-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdowns.forEach(other => {
          if (other !== dd) other.classList.remove('active');
        });
        dd.classList.toggle('active');
      });
    }
  });

  document.addEventListener('click', () => {
    dropdowns.forEach(dd => dd.classList.remove('active'));
  });

  // Top Navigation Settings Dropdown Menu Actions
  const settingActions = [
    { id: 'menu-settings-general', section: 'general' },
    { id: 'menu-settings-notifications', section: 'notifications' },
    { id: 'menu-settings-workspace', section: 'workspace' },
    { id: 'menu-settings-terminal', section: 'terminal' },
    { id: 'menu-settings-transfers', section: 'transfers' },
    { id: 'menu-settings-security', section: 'security' }
  ];

  settingActions.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', () => {
        dropdowns.forEach(dd => dd.classList.remove('active'));
        if (window.ConnectionDialog) {
          window.ConnectionDialog.openPreferences(item.section);
        }
      });
    }
  });

  // Top Menu Actions
  const menuFileNew = document.getElementById('menu-file-new');
  if (menuFileNew) menuFileNew.addEventListener('click', () => window.ConnectionDialog.openConnectionDialog());

  const menuFileDisc = document.getElementById('menu-file-disconnect');
  if (menuFileDisc) menuFileDisc.addEventListener('click', () => disconnectSession());

  const menuFileExit = document.getElementById('menu-file-exit');
  if (menuFileExit) menuFileExit.addEventListener('click', () => window.close());

  window.updateTransfersBadges = () => {
    const conflictSelect = document.getElementById('pref-conflict-policy');
    const conflictBadge = document.getElementById('conflict-policy-badge');
    if (conflictSelect && conflictBadge) {
      const val = conflictSelect.value;
      if (val === 'skip') {
        conflictBadge.textContent = 'Disabled';
        conflictBadge.style.background = 'rgba(100, 116, 139, 0.2)';
        conflictBadge.style.color = '#94A3B8';
      } else {
        conflictBadge.textContent = 'Active';
        conflictBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        conflictBadge.style.color = '#34D399';
      }
    }

    const autouploadSelect = document.getElementById('pref-autoupload');
    const autouploadBadge = document.getElementById('autoupload-policy-badge');
    if (autouploadSelect && autouploadBadge) {
      autouploadBadge.textContent = 'Active';
      autouploadBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      autouploadBadge.style.color = '#34D399';
    }
  };

  const conflictPrefElem = document.getElementById('pref-conflict-policy');
  if (conflictPrefElem) {
    conflictPrefElem.addEventListener('change', () => window.updateTransfersBadges());
  }

  const autouploadPrefElem = document.getElementById('pref-autoupload');
  if (autouploadPrefElem) {
    autouploadPrefElem.addEventListener('change', (e) => {
      if (e.target.value === 'prompt') {
        setUploadPromptSuppressed(false);
      }
      window.updateTransfersBadges();
    });
  }

  window.updateTransfersBadges();

  const closeClearCacheModal = () => {
    const modal = document.getElementById('clear-cache-modal');
    if (modal) modal.classList.remove('active');
  };

  window.openClearCacheModal = () => {
    const modal = document.getElementById('clear-cache-modal');
    if (modal) {
      modal.classList.add('active');
      const chkFiles = document.getElementById('chk-clear-remote-files');
      const chkSessions = document.getElementById('chk-clear-sessions');
      const chkLogs = document.getElementById('chk-clear-logs');
      if (chkFiles) chkFiles.checked = true;
      if (chkSessions) chkSessions.checked = false;
      if (chkLogs) chkLogs.checked = false;
      const successMsg = document.getElementById('clear-cache-modal-success');
      if (successMsg) successMsg.style.display = 'none';
    }
  };

  const menuToolsCache = document.getElementById('menu-tools-cache');
  if (menuToolsCache) {
    menuToolsCache.addEventListener('click', () => {
      window.openClearCacheModal();
    });
  }

  const btnClearCacheClose = document.getElementById('btn-clear-cache-modal-close');
  const btnClearCacheCancel = document.getElementById('btn-clear-cache-modal-cancel');
  if (btnClearCacheClose) btnClearCacheClose.addEventListener('click', closeClearCacheModal);
  if (btnClearCacheCancel) btnClearCacheCancel.addEventListener('click', closeClearCacheModal);

  const btnClearCacheSubmit = document.getElementById('btn-clear-cache-modal-submit');
  if (btnClearCacheSubmit) {
    btnClearCacheSubmit.addEventListener('click', async () => {
      const chkFiles = document.getElementById('chk-clear-remote-files');
      const chkSessions = document.getElementById('chk-clear-sessions');
      const chkLogs = document.getElementById('chk-clear-logs');

      let hasClearedAny = false;

      // 1. Clear Files
      if (chkFiles && chkFiles.checked) {
        const api = getApi();
        if (api && api.clearCache) {
          try {
            await api.clearCache();
            hasClearedAny = true;
            if (window.LogViewer) window.LogViewer.addEntry('info', '[Cache Modal] Local remote-file cache cleared cleanly.');
          } catch (err) {
            console.error('Failed to clear remote files cache:', err);
          }
        }
      }

      // 2. Clear Sessions
      if (chkSessions && chkSessions.checked) {
        localStorage.removeItem('devsftp_workspace_saved_tabs');
        hasClearedAny = true;
        if (window.LogViewer) window.LogViewer.addEntry('info', '[Cache Modal] Saved workspace sessions storage cleared.');
      }

      // 3. Clear Logs
      if (chkLogs && chkLogs.checked) {
        if (window.LogViewer && window.LogViewer.clear) {
          window.LogViewer.clear();
          hasClearedAny = true;
        }
      }

      if (hasClearedAny) {
        const successMsg = document.getElementById('clear-cache-modal-success');
        if (successMsg) {
          successMsg.style.display = 'block';
          setTimeout(() => {
            successMsg.style.display = 'none';
            closeClearCacheModal();
          }, 1500);
        } else {
          closeClearCacheModal();
        }
      } else {
        closeClearCacheModal();
      }
    });
  }

  // Master Password Verification Helper for Destructive Cleanup Actions
  window.verifyMasterPasswordIfEnabled = async function(onSuccess, promptMsgText) {
    const api = getApi();
    if (!api || !api.profiles || !api.profiles.master) {
      if (typeof onSuccess === 'function') onSuccess();
      return;
    }

    try {
      const status = await api.profiles.master.getStatus();
      if (!status || !status.enabled) {
        if (typeof onSuccess === 'function') onSuccess();
        return;
      }

      const modal = document.getElementById('master-auth-modal');
      const pwdInput = document.getElementById('master-auth-password');
      const errDiv = document.getElementById('master-auth-error');
      const msgEl = document.getElementById('master-auth-prompt-msg');
      const btnSubmit = document.getElementById('btn-master-auth-submit');
      const btnCancel = document.getElementById('btn-master-auth-cancel');
      const btnClose = document.getElementById('btn-master-auth-close');

      if (!modal) {
        if (typeof onSuccess === 'function') onSuccess();
        return;
      }

      if (msgEl) {
        msgEl.textContent = promptMsgText || 'Master Password Vault is active. Enter your Master Password to authorize this action:';
      }
      if (pwdInput) {
        pwdInput.value = '';
        pwdInput.style.borderColor = '';
      }
      if (errDiv) {
        errDiv.style.display = 'none';
      }

      const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
      };

      const attemptAuthorize = async () => {
        const pwd = pwdInput ? pwdInput.value.trim() : '';
        if (!pwd) {
          if (errDiv) {
            errDiv.style.display = 'block';
            errDiv.textContent = '⚠️ Master Password cannot be empty.';
          }
          if (pwdInput) pwdInput.focus();
          return;
        }

        try {
          const ok = await api.profiles.master.unlock(pwd);
          if (ok) {
            closeModal();
            if (window.LogViewer) window.LogViewer.addEntry('info', '🔓 Master Password verified successfully.');
            if (typeof onSuccess === 'function') onSuccess();
          } else {
            if (errDiv) {
              errDiv.style.display = 'block';
              errDiv.textContent = '⚠️ Incorrect Master Password. Access denied.';
            }
            if (pwdInput) {
              pwdInput.style.borderColor = '#F87171';
              pwdInput.select();
            }
          }
        } catch (err) {
          if (errDiv) {
            errDiv.style.display = 'block';
            errDiv.textContent = `⚠️ Verification error: ${err.message || err}`;
          }
        }
      };

      if (btnSubmit) btnSubmit.onclick = attemptAuthorize;
      if (btnCancel) btnCancel.onclick = closeModal;
      if (btnClose) btnClose.onclick = closeModal;
      if (pwdInput) {
        pwdInput.onkeydown = (e) => {
          if (e.key === 'Enter') attemptAuthorize();
        };
      }

      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('active');
      if (pwdInput) setTimeout(() => pwdInput.focus(), 100);
    } catch (err) {
      // Fail CLOSED — do NOT grant access on IPC error
      console.error('Master password verification IPC error:', err && err.message);
    }
  };



  const btnToolsCacheClear = document.getElementById('btn-tools-cache-clear');
  if (btnToolsCacheClear) {
    btnToolsCacheClear.addEventListener('click', () => {
      window.verifyMasterPasswordIfEnabled(async () => {
        const api = getApi();
        if (api && api.clearCache) {
          try {
            await api.clearCache();
            const msg = document.getElementById('clear-cache-msg');
            if (msg) {
              msg.style.display = 'inline-block';
              setTimeout(() => { msg.style.display = 'none'; }, 3000);
            }
            if (window.LogViewer) window.LogViewer.addEntry('info', '[Cache Clean] Local remote-file cache cleared cleanly.');
          } catch (err) {
            console.error('Failed to clear cache:', err);
            alert(`Failed to clear cache: ${err.message}`);
          }
        }
      });
    });
  }

  const handleExportBundle = () => {
    if (window.DevsApp && window.DevsApp.exportWorkspacePackage) {
      window.DevsApp.exportWorkspacePackage();
    }
  };

  const handleImportBundle = () => {
    if (window.DevsApp && window.DevsApp.importWorkspacePackage) {
      window.DevsApp.importWorkspacePackage();
    }
  };

  const menuToolsExportBundle = document.getElementById('menu-tools-export-bundle');
  if (menuToolsExportBundle) menuToolsExportBundle.addEventListener('click', handleExportBundle);

  const menuToolsImportBundle = document.getElementById('menu-tools-import-bundle');
  if (menuToolsImportBundle) menuToolsImportBundle.addEventListener('click', handleImportBundle);

  const btnSettingsExportBundle = document.getElementById('btn-settings-export-bundle');
  if (btnSettingsExportBundle) btnSettingsExportBundle.addEventListener('click', handleExportBundle);

  const btnSettingsImportBundle = document.getElementById('btn-settings-import-bundle');
  if (btnSettingsImportBundle) btnSettingsImportBundle.addEventListener('click', handleImportBundle);

  const menuToolsNotifications = document.getElementById('menu-tools-notifications');
  if (menuToolsNotifications) {
    menuToolsNotifications.addEventListener('click', () => {
      if (window.ConnectionDialog) {
        window.ConnectionDialog.openPreferences('notifications');
      }
    });
  }

  const menuToolsPendingEdits = document.getElementById('menu-tools-pending-edits');
  if (menuToolsPendingEdits) {
    menuToolsPendingEdits.addEventListener('click', () => {
      if (window.PendingEditsManager && window.PendingEditsManager.openModal) {
        window.PendingEditsManager.openModal();
      }
    });
  }

  const menuToolsDirCompare = document.getElementById('menu-tools-dir-compare');
  if (menuToolsDirCompare) {
    menuToolsDirCompare.addEventListener('click', () => {
      if (window.DirectoryCompare && window.DirectoryCompare.toggle) {
        window.DirectoryCompare.toggle();
      }
    });
  }

  const menuToolsBookmarksManager = document.getElementById('menu-tools-bookmarks-manager');
  if (menuToolsBookmarksManager) {
    menuToolsBookmarksManager.addEventListener('click', () => {
      if (window.FileBrowser) {
        window.FileBrowser.renderGlobalBookmarksModal();
      }
    });
  }

  const menuHelpAbout = document.getElementById('menu-help-about');
  if (menuHelpAbout) {
    menuHelpAbout.addEventListener('click', () => {
      window.ConnectionDialog.openPreferences('about');
    });
  }



  // =========================================================================
  // 4. Session Connection Execution & Disconnect Management
  // =========================================================================
  const btnQuickConnect = document.getElementById('btn-header-new-session');
  const btnDisconnect = document.getElementById('btn-disconnect');

  window.connectToProfileSession = async (profile, targetSessionId, isAutoRestore = false, targetRemotePath = null, targetLocalPath = null) => {
    const api = window.devsFTP || window.pulseFTP;
    if (!profile || !api) return;

    try {
      const sessId = targetSessionId || (window.SessionManager ? window.SessionManager.activeSessionId : 'default');
      const connRes = await api.connect(profile, sessId);

      if (window.SessionManager) {
        window.SessionManager.updateSessionConnectionState(sessId, true, profile);
        const sessionObj = window.SessionManager.getSession(sessId);
        if (sessionObj && connRes) {
          sessionObj.remoteOS = connRes.remoteOS || 'linux';
        }
      }

      const initialRemotePath = targetRemotePath || profile.remotePath || '/';
      const initialLocalPath = targetLocalPath || profile.localPath || 'C:\\';

      const targetSess = window.SessionManager ? window.SessionManager.sessions.find(s => s.sessionId === sessId) : null;
      if (targetSess) {
        targetSess.remotePath = initialRemotePath;
        targetSess.localPath = initialLocalPath;
      }

      if (!window.SessionManager || sessId === window.SessionManager.activeSessionId) {
        await window.FileBrowser.refreshRemote(initialRemotePath);
        await window.FileBrowser.refreshLocal(initialLocalPath);
      }

      if (profile.protocol === 'sftp') {
        try {
          await api.sshTerminalConnect(profile, sessId);
        } catch (termErr) {
          if (window.LogViewer) window.LogViewer.addEntry('warning', `SSH Terminal PTY open note: ${termErr.message}`);
        }
      }

      // Show/hide SSH Terminal and SSH Tunnels tabs based on protocol
      // SFTP: show all tabs, default to SSH Terminal
      // FTP/WebDAV/S3: hide SSH Terminal + SSH Tunnels, default to Transfers
      const isSFTP = profile.protocol === 'sftp';

      const termTab = document.querySelector('.drawer-tab[data-tab="tab-terminal"]');
      const tunnelsTab = document.querySelector('.drawer-tab[data-tab="tab-tunnels"]');

      if (termTab) termTab.style.display = isSFTP ? '' : 'none';
      if (tunnelsTab) tunnelsTab.style.display = isSFTP ? '' : 'none';

      if (isSFTP) {
        // Default to SSH Terminal for SFTP connections
        const sshTab = document.querySelector('.drawer-tab[data-tab="tab-terminal"]');
        if (sshTab) sshTab.click();
      } else {
        // Default to Transfers for all other protocols
        const queueTab = document.querySelector('.drawer-tab[data-tab="tab-queue"]');
        if (queueTab) queueTab.click();
      }

    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (window.LogViewer) window.LogViewer.addEntry('error', `Connection error: ${msg}`);
      
      const errorModal = document.getElementById('connection-error-modal');
      const errorBody = document.getElementById('conn-error-modal-body');
      const errorDetails = document.getElementById('conn-error-host-details');
      
      if (errorModal && errorBody) {
        errorBody.textContent = msg;
        if (errorDetails) {
          const proto = profile.protocol ? profile.protocol.toUpperCase() : 'SFTP';
          errorDetails.textContent = `${proto}://` + (profile.host || '127.0.0.1') + (profile.port ? `:${profile.port}` : '');
        }
        errorModal.classList.add('active');
        errorModal.setAttribute('aria-hidden', 'false');
        
        const dismiss = () => {
          errorModal.classList.remove('active');
          errorModal.setAttribute('aria-hidden', 'true');
          // Close the failed session tab now that user acknowledged the error
          if (window.SessionManager && targetSessionId) {
            window.SessionManager.closeSession(targetSessionId);
          }
        };
        
        const btnOk = document.getElementById('btn-conn-error-ok');
        const btnClose = document.getElementById('btn-conn-error-close');
        if (btnOk) btnOk.onclick = dismiss;
        if (btnClose) btnClose.onclick = dismiss;
      } else {
        alert(`Connection failed: ${msg}`);
      }
      
      throw err;
    }
  };


  const disconnectSession = async () => {
    const api = window.devsFTP || window.pulseFTP;
    const activeSessId = window.SessionManager ? window.SessionManager.activeSessionId : 'default';
    try {
      await api.disconnect(activeSessId);
    } catch (err) {
      console.error('Error during disconnect:', err);
    }

    if (window.SessionManager) {
      window.SessionManager.updateActiveSessionConnectionState(false);
    }

    document.getElementById('status-dot').className = 'status-indicator';
    document.getElementById('status-text').textContent = 'Disconnected';
    document.getElementById('remote-tag').style.display = 'none';
    if (btnQuickConnect) btnQuickConnect.style.display = 'inline-flex';
    if (btnDisconnect) btnDisconnect.style.display = 'none';

    document.getElementById('remote-file-tbody').innerHTML = '<tr><td colspan="4" style="text-align: center; color: hsl(var(--text-muted)); padding: 24px;">Select a profile and click Connect.</td></tr>';
  };

  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => disconnectSession());
  }

  // =========================================================================
  // 5. Editor Debug Console & Cache Save Listener
  // =========================================================================
  window.EditorDebug = {
    addEntry(stage, msg, details) {
      const stream = document.getElementById('editor-debug-stream');
      if (!stream) return;
      const time = new Date().toLocaleTimeString();
      const div = document.createElement('div');
      div.className = 'log-entry info';
      div.style.marginBottom = '4px';
      
      let color = '#38BDF8';
      if (stage && stage.includes('ERROR')) color = '#F87171';
      if (stage && stage.includes('STAGE 4')) color = '#A855F7';
      if (stage && stage.includes('STAGE 5') || stage && stage.includes('STAGE 6')) color = '#22C55E';

      const detailStr = details ? ` | ${typeof details === 'object' ? JSON.stringify(details) : details}` : '';
      div.innerHTML = `<span style="color: #64748B;">[${time}]</span> <span style="color: ${color}; font-weight:700;">[${stage}]</span> <span>${msg}</span><span style="color:#94A3B8;">${detailStr}</span>`;
      stream.appendChild(div);
      stream.scrollTop = stream.scrollHeight;
    }
  };

  const btnCopyDebug = document.getElementById('btn-copy-editor-debug');
  if (btnCopyDebug) {
    btnCopyDebug.addEventListener('click', () => {
      const stream = document.getElementById('editor-debug-stream');
      if (!stream) return;
      const text = Array.from(stream.children).map(el => el.textContent).join('\n');
      if (!text) return;
      const copied = window.DevsApp ? window.DevsApp.copyToClipboard(text) : false;
      if (copied) {
        const orig = btnCopyDebug.textContent;
        btnCopyDebug.textContent = '✓ Copied!';
        setTimeout(() => { btnCopyDebug.textContent = orig; }, 2000);
      }
    });
  }

  const btnClearDebug = document.getElementById('btn-clear-editor-debug');
  if (btnClearDebug) {
    btnClearDebug.addEventListener('click', () => {
      const stream = document.getElementById('editor-debug-stream');
      if (stream) stream.innerHTML = '<div class="log-entry info" style="color: hsl(var(--text-muted));">[CLEARED] Editor Debug stream reset.</div>';
    });
  }

  // =========================================================================
  // Pending Local Edits Manager & Queue Controller
  // =========================================================================
  window.PendingEditsManager = {
    items: new Map(),

    add(data) {
      if (!data || !data.localPath) return;
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      this.items.set(data.localPath, {
        ...data,
        savedAt: data.savedAt || now.toISOString(),
        modifiedAt: dateStr
      });
      this.updateUI();
    },

    remove(localPath) {
      if (this.items.has(localPath)) {
        this.items.delete(localPath);
        this.updateUI();
      }
    },

    clear() {
      this.items.clear();
      this.updateUI();
    },

    getAll() {
      return Array.from(this.items.values());
    },

    updateUI() {
      const badge = document.getElementById('pending-edits-count-badge');
      const count = this.items.size;
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
      }
    },

    async openModal() {
      const modal = document.getElementById('pending-edits-modal');
      const titleEl = document.getElementById('pending-edits-modal-title');
      const tbodyEl = document.getElementById('pending-edits-tbody');
      const summaryEl = document.getElementById('pending-edits-summary');
      const profileFilterEl = document.getElementById('pending-edits-profile-filter');
      const dateFilterEl = document.getElementById('pending-edits-filter-select');

      if (!modal || !tbodyEl) return;

      // Lookup profile definitions from connection profiles store
      const api = window.devsFTP || window.pulseFTP;
      const savedProfilesMap = new Map();
      if (api && api.profiles && api.profiles.getAll) {
        try {
          const allProfs = await api.profiles.getAll();
          if (Array.isArray(allProfs)) {
            allProfs.forEach(p => savedProfilesMap.set(p.id, p));
          }
        } catch (e) {}
      }

      // Auto-purge stale items older than 7 days to protect system performance (Issue safety guard)
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      for (const [pathKey, item] of this.items.entries()) {
        const itemTime = item.timestamp || (item.savedAt ? new Date(item.savedAt).getTime() : 0);
        if (itemTime > 0 && (now - itemTime > SEVEN_DAYS_MS)) {
          this.items.delete(pathKey);
        }
      }
      this.updateUI();

      let list = this.getAll();

      // Enrich items with real Profile Name and Accent Color
      list.forEach(item => {
        const pId = item.profileId || 'default';
        const matched = savedProfilesMap.get(pId);
        if (matched) {
          item.profileName = matched.name;
          item.profileColor = matched.accentColor || matched.color || '#68a063';
        } else if (!item.profileName || item.profileName === item.host || item.profileName === 'Connection') {
          item.profileName = (pId === 'default' ? 'Local Workspace' : 'Server Profile');
          item.profileColor = item.color || '#68a063';
        }
      });

      // Populate Profile Filter options (Format: Profile Name)
      if (profileFilterEl) {
        const currentSelected = profileFilterEl.value || 'all';
        const profilesMap = new Map();
        list.forEach(item => {
          const profId = item.profileId || 'default';
          const profName = item.profileName || 'Server Profile';
          const color = item.profileColor || item.color || '#68a063';
          profilesMap.set(profId, { name: profName, color });
        });

        let profileOptions = '<option value="all">All Server Profiles</option>';
        for (const [pId, info] of profilesMap.entries()) {
          profileOptions += `<option value="${pId}" ${currentSelected === pId ? 'selected' : ''}>● ${info.name}</option>`;
        }
        profileFilterEl.innerHTML = profileOptions;

        profileFilterEl.onchange = () => this.openModal();
      }

      if (dateFilterEl) {
        dateFilterEl.onchange = () => this.openModal();
      }

      // Apply Filters
      const selectedProfile = profileFilterEl ? profileFilterEl.value : 'all';
      const selectedDate = dateFilterEl ? dateFilterEl.value : 'all';

      if (selectedProfile && selectedProfile !== 'all') {
        list = list.filter(item => (item.profileId || 'default') === selectedProfile);
      }
      if (selectedDate === 'modified_today') {
        const todayStr = new Date().toDateString();
        list = list.filter(item => item.savedAt && new Date(item.savedAt).toDateString() === todayStr);
      }

      if (titleEl) titleEl.textContent = `✏️ Pending Remote Edits Manager (${list.length})`;

      if (summaryEl) {
        summaryEl.innerHTML = `
          <span style="color: hsl(var(--text-muted));">Pending Files: <strong style="color: #F59E0B;">${list.length}</strong></span> |
          <span style="color: #34D399; margin-left: 6px;">Auto-Purge: <strong>7 Days</strong></span>
        `;
      }

      if (list.length === 0) {
        tbodyEl.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 30px; color: hsl(var(--text-muted)); font-size: 12px;">
              ✓ No pending local file edits matching current filter. All edited files are in sync with remote servers.
            </td>
          </tr>
        `;
      } else {
        const escapeHtml = (str) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        tbodyEl.innerHTML = list.map(item => {
          const accentColor = item.profileColor || item.color || '#68a063';
          const profileName = item.profileName || item.profileId || 'Default Server';
          const formatDateVal = (val) => {
            if (!val) return 'Today';
            const d = new Date(val);
            if (isNaN(d.getTime())) return val;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          };
          const modifiedDateStr = item.modifiedAt || formatDateVal(item.savedAt || item.timestamp);
          return `
            <tr style="border-bottom: 1px solid hsl(var(--border-subtle)); font-size: 12px;">
              <td style="text-align: center; vertical-align: middle;">
                <input type="checkbox" class="pending-edit-cb" data-path="${escapeHtml(item.localPath)}" checked style="margin: 0; cursor: pointer;">
              </td>
              <td style="font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.localPath)}">
                📄 ${escapeHtml(item.fileName || item.localPath)}
              </td>
              <td style="font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(profileName)}">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${accentColor}; flex-shrink: 0;"></span>
                  <span>${escapeHtml(profileName)}</span>
                </div>
              </td>
              <td style="font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: hsl(var(--text-secondary));" title="${escapeHtml(item.remotePath)}">
                ${escapeHtml(item.remotePath)}
              </td>
              <td style="text-align: center; vertical-align: middle; font-size: 11px; color: hsl(var(--text-muted)); font-family: var(--font-mono);">
                ${escapeHtml(modifiedDateStr)}
              </td>
            </tr>
          `;
        }).join('');

        const selectAllCb = document.getElementById('pending-edits-select-all');
        if (selectAllCb) {
          selectAllCb.checked = true;
          selectAllCb.onchange = (e) => {
            tbodyEl.querySelectorAll('.pending-edit-cb').forEach(cb => { cb.checked = e.target.checked; });
          };
        }
      }

      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('active');
    },

    async uploadItemWithOverwriteProtection(item) {
      if (!item) return;
      const api = window.devsFTP || window.pulseFTP;
      if (!api) return;

      if (window.LogViewer) window.LogViewer.addEntry('info', `Uploading pending edited file: ${item.fileName}`);
      if (window.TransferQueue) {
        window.TransferQueue.addTransfer('upload', item.localPath, item.remotePath);
      }

      try {
        // Enforce strict overwrite protection (skipConflictCheck is NOT set)
        await api.uploadFile(item.localPath, item.remotePath, item.sessionId, { profileId: item.profileId });
        this.remove(item.localPath);
        if (window.LogViewer) window.LogViewer.addEntry('info', `✓ Upload complete for pending edit: ${item.fileName}`);
        if (window.FileBrowser) window.FileBrowser.refreshRemote(window.FileBrowser.remotePath);
        this.openModal();
      } catch (err) {
        if (window.LogViewer) window.LogViewer.addEntry('error', `Upload error for pending file ${item.fileName}: ${err.message}`);
      }
    },

    async discardItem(item) {
      if (!item) return;
      const api = window.devsFTP || window.pulseFTP;
      if (api && api.dismissBatch) {
        await api.dismissBatch([item]);
      }
      this.remove(item.localPath);
      if (window.LogViewer) window.LogViewer.addEntry('info', `Discarded local edits for: ${item.fileName}`);
      this.openModal();
    },

    async syncAll() {
      const tbodyEl = document.getElementById('pending-edits-tbody');
      const checkedPaths = new Set();
      if (tbodyEl) {
        tbodyEl.querySelectorAll('.pending-edit-cb:checked').forEach(cb => checkedPaths.add(cb.getAttribute('data-path')));
      }
      const list = this.getAll().filter(item => checkedPaths.size === 0 || checkedPaths.has(item.localPath));
      if (list.length === 0) return;
      for (const item of list) {
        await this.uploadItemWithOverwriteProtection(item);
      }
    },

    async discardAll() {
      const tbodyEl = document.getElementById('pending-edits-tbody');
      const checkedPaths = new Set();
      if (tbodyEl) {
        tbodyEl.querySelectorAll('.pending-edit-cb:checked').forEach(cb => checkedPaths.add(cb.getAttribute('data-path')));
      }
      const list = this.getAll().filter(item => checkedPaths.size === 0 || checkedPaths.has(item.localPath));
      if (list.length === 0) return;
      const api = window.devsFTP || window.pulseFTP;
      if (api && api.dismissBatch) {
        await api.dismissBatch(list);
      }
      list.forEach(item => this.remove(item.localPath));
      if (window.LogViewer) window.LogViewer.addEntry('info', `Discarded ${list.length} pending local file edit(s).`);
      this.openModal();
    }
  };

  // Wire Pending Edits Toolbar & Modal Buttons
  const btnPendingEdits = document.getElementById('btn-pending-edits');
  if (btnPendingEdits) {
    btnPendingEdits.addEventListener('click', () => {
      if (window.PendingEditsManager) {
        window.PendingEditsManager.openModal();
      }
    });
  }

  // Wire Directory Compare Toolbar Button
  const btnDirCompareHeader = document.getElementById('btn-dir-compare');
  if (btnDirCompareHeader) {
    btnDirCompareHeader.addEventListener('click', () => {
      if (window.DirectoryCompare) {
        window.DirectoryCompare.compare();
      }
    });
  }



  const btnPendingClose = document.getElementById('btn-pending-edits-close');
  const btnPendingCancel = document.getElementById('btn-pending-edits-cancel');
  const modalPending = document.getElementById('pending-edits-modal');

  const closePendingModal = () => {
    if (modalPending) {
      modalPending.classList.remove('active');
      modalPending.setAttribute('aria-hidden', 'true');
    }
  };

  if (btnPendingClose) btnPendingClose.addEventListener('click', closePendingModal);
  if (btnPendingCancel) btnPendingCancel.addEventListener('click', closePendingModal);

  const btnPendingSyncAll = document.getElementById('btn-pending-edits-sync-all');
  if (btnPendingSyncAll) {
    btnPendingSyncAll.addEventListener('click', async () => {
      await window.PendingEditsManager.syncAll();
    });
  }

  const btnPendingDiscardAll = document.getElementById('btn-pending-edits-discard-all');
  if (btnPendingDiscardAll) {
    btnPendingDiscardAll.addEventListener('click', async () => {
      await window.PendingEditsManager.discardAll();
    });
  }

  const api = getApi();
  if (api && api.onCacheDebugEvent) {
    api.onCacheDebugEvent((data) => {
      if (window.EditorDebug) window.EditorDebug.addEntry(data.stage, data.msg, data.details);
    });
  }

  if (api && api.onCacheFileSaved) {
    api.onCacheFileSaved(async (data) => {
      try {
        if (window.EditorDebug) window.EditorDebug.addEntry('STAGE 4', `RENDERER RECEIVED = YES (local save event for ${data.fileName})`, data);
        if (window.LogViewer) window.LogViewer.addEntry('info', `Local save detected for cached file: ${data.fileName}`);
        logDiagnostic('save detected', {
          fileName: data.fileName,
          localPath: data.localPath,
          remotePath: data.remotePath,
          sessionId: data.sessionId
        });

        // Send Native OS Desktop Notification on File Save Detection
        if (window.shouldSendNotification && window.shouldSendNotification('file-save')) {
          if (api && api.sendOSNotification) {
            api.sendOSNotification('✏️ File Edit Saved', `${data.fileName} was saved in external editor and queued for sync.`);
          }
        }

        // Always register in PendingEditsManager
        window.PendingEditsManager.add(data);
        
        const autouploadElem = document.getElementById('pref-autoupload');
        const autouploadPref = autouploadElem ? autouploadElem.value : 'prompt';
        let action = (autouploadPref === 'auto' || isUploadPromptSuppressed()) ? 'upload' : 'prompt';
        
        if (action === 'prompt') {
          action = await openUploadPrompt(data);
        }

        if (action === 'upload') {
          await window.PendingEditsManager.uploadItemWithOverwriteProtection(data);
        } else if (action === 'discard') {
          await window.PendingEditsManager.discardItem(data);
        } else {
          if (window.LogViewer) window.LogViewer.addEntry('info', `Saved ${data.fileName} to Pending Local Edits queue.`);
        }
      } catch (err) {
        if (window.LogViewer) window.LogViewer.addEntry('error', `Cache file saved handler error: ${err.message}`);
      }
    });
  }

  if (api && api.onCacheBatchFilesSaved) {
    api.onCacheBatchFilesSaved((batchItems) => {
      if (!Array.isArray(batchItems) || batchItems.length === 0) return;
      if (window.LogViewer) window.LogViewer.addEntry('info', `Startup recovery: ${batchItems.length} modified file(s) detected.`);

      // Add recovered items to PendingEditsManager
      batchItems.forEach(item => window.PendingEditsManager.add(item));

      const modal = document.getElementById('batch-upload-modal');
      const titleEl = document.getElementById('batch-upload-modal-title');
      const summaryEl = document.getElementById('batch-upload-summary');
      const listEl = document.getElementById('batch-modal-file-list');
      const confirmBtn = document.getElementById('btn-batch-modal-confirm');
      const cancelBtn = document.getElementById('btn-batch-modal-cancel');
      const closeBtn = document.getElementById('btn-batch-modal-close');
      const openGlobalBtn = document.getElementById('btn-batch-modal-open-global');

      if (!modal || !listEl) return;

      const escapeHtml = (str) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      if (titleEl) {
        titleEl.textContent = '⚡ Unsaved Remote Edits';
      }
      if (summaryEl) {
        summaryEl.textContent = batchItems.length === 1
          ? 'You have 1 pending file edit in the sync queue.'
          : `You have ${batchItems.length} pending file edits in the sync queue.`;
      }

      // Group items per server profile with file count and profile accent dot (matching global modal)
      const profilesMap = new Map();
      batchItems.forEach(item => {
        const key = item.profileName || item.profileId || 'Default Server';
        if (!profilesMap.has(key)) {
          const accentColor = item.profileColor || item.color || '#68a063';
          profilesMap.set(key, { name: key, accentColor, count: 0 });
        }
        profilesMap.get(key).count += 1;
      });

      listEl.innerHTML = Array.from(profilesMap.values()).map(info => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: hsl(var(--bg-primary)); border: 1px solid hsl(var(--border-subtle)); border-radius: 6px; font-family: var(--font-ui); font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" class="batch-profile-cb" data-profile-name="${escapeHtml(info.name)}" checked style="margin: 0; cursor: pointer;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${info.accentColor}; flex-shrink: 0;"></span>
            <span style="font-weight: 600; color: hsl(var(--text-primary));">${escapeHtml(info.name)}</span>
          </div>
          <span class="tag-badge badge-active">${info.count} ${info.count === 1 ? 'file' : 'files'}</span>
        </div>
      `).join('');

      // Ignore / Close handler simply hides modal (DOES NOT DISCARD PENDING EDITS)
      const hideModal = () => {
        modal.classList.remove('active');
      };

      if (cancelBtn) cancelBtn.onclick = hideModal;
      if (closeBtn) closeBtn.onclick = hideModal;

      if (openGlobalBtn) {
        openGlobalBtn.onclick = () => {
          hideModal();
          if (window.PendingEditsManager && window.PendingEditsManager.openModal) {
            window.PendingEditsManager.openModal();
          }
        };
      }

      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          hideModal();
          const checkedProfiles = new Set(
            Array.from(listEl.querySelectorAll('.batch-profile-cb:checked')).map(cb => cb.getAttribute('data-profile-name'))
          );
          const itemsToUpload = batchItems.filter(item => {
            const key = item.profileName || item.profileId || 'Default Server';
            return checkedProfiles.has(key);
          });
          if (itemsToUpload.length === 0) return;

          if (window.LogViewer) window.LogViewer.addEntry('info', `Initiating background batch upload for ${itemsToUpload.length} file(s)...`);

          itemsToUpload.forEach(item => {
            if (window.TransferQueue) {
              window.TransferQueue.addTransfer('upload', item.localPath, item.remotePath);
            }
          });

          try {
            const res = await api.uploadBatchBackground({ items: itemsToUpload, forceOverwrite: false });
            if (res && res.conflicts && res.conflicts.length > 0) {
              const names = res.conflicts.map(c => c.fileName).join(', ');
              if (window.LogViewer) window.LogViewer.addEntry('warning', `⚠️ Remote conflict detected for: ${names}`);
              const forceConfirm = confirm(`⚠️ Remote Conflict Detected!\n\nThe following file(s) on the server were modified after you downloaded them:\n• ${names}\n\nDo you want to FORCE OVERWRITE the remote server files?`);
              if (forceConfirm) {
                await api.uploadBatchBackground({ items: res.conflicts, forceOverwrite: true });
                if (window.LogViewer) window.LogViewer.addEntry('info', `✓ Force overwrite complete for conflicted file(s).`);
              } else {
                if (window.LogViewer) window.LogViewer.addEntry('info', `Skipped conflicted file(s): ${names}`);
              }
            } else {
              if (window.LogViewer) window.LogViewer.addEntry('info', `✓ Background upload complete: ${itemsToUpload.length} file(s) synced to remote servers.`);
            }
            if (window.FileBrowser) {
              window.FileBrowser.refreshRemote(window.FileBrowser.remotePath);
            }
          } catch (err) {
            if (window.LogViewer) window.LogViewer.addEntry('error', `Background upload error: ${err.message}`);
          }
        };
      }

      modal.classList.add('active');
    });
  }

  // =========================================================================
  // Host Key Verification Dialog Controller
  // =========================================================================
  const hostKeyModal = document.getElementById('host-key-modal');
  const hostKeyValHost = document.getElementById('host-key-val-host');
  const hostKeyValEndpoint = document.getElementById('host-key-val-endpoint');
  const hostKeyValFingerprint = document.getElementById('host-key-val-fingerprint');
  const hostKeyValStored = document.getElementById('host-key-val-stored');
  const hostKeyStoredContainer = document.getElementById('host-key-stored-container');
  const hostKeyWarningAlert = document.getElementById('host-key-warning-alert');

  let activeHostKeyRequest = null;

  const closeHostKeyModal = (action) => {
    if (!hostKeyModal) return;
    hostKeyModal.classList.remove('active');
    hostKeyModal.setAttribute('aria-hidden', 'true');
    if (activeHostKeyRequest) {
      if (api && api.respondHostKeyVerify) {
        api.respondHostKeyVerify({
          requestId: activeHostKeyRequest.requestId,
          action: action || 'reject'
        });
      }
      activeHostKeyRequest = null;
    }
  };

  if (api && api.onHostKeyVerifyRequest) {
    api.onHostKeyVerifyRequest((data) => {
      activeHostKeyRequest = data;
      if (hostKeyValHost) hostKeyValHost.textContent = data.host || 'host';
      if (hostKeyValEndpoint) hostKeyValEndpoint.textContent = `${data.host}:${data.port || 22}`;
      if (hostKeyValFingerprint) hostKeyValFingerprint.textContent = data.fingerprint || '';
      
      if (data.status === 'CHANGED') {
        if (hostKeyWarningAlert) hostKeyWarningAlert.style.display = 'block';
        if (hostKeyStoredContainer) hostKeyStoredContainer.style.display = 'block';
        if (hostKeyValStored) hostKeyValStored.textContent = data.storedFingerprint || '';
      } else {
        if (hostKeyWarningAlert) hostKeyWarningAlert.style.display = 'none';
        if (hostKeyStoredContainer) hostKeyStoredContainer.style.display = 'none';
      }

      if (hostKeyModal) {
        hostKeyModal.setAttribute('aria-hidden', 'false');
        hostKeyModal.classList.add('active');
      }
    });
  }

  const btnHostKeySave = document.getElementById('btn-host-key-trust-save');
  if (btnHostKeySave) btnHostKeySave.addEventListener('click', () => closeHostKeyModal('trust_always'));
  const btnHostKeyOnce = document.getElementById('btn-host-key-trust-once');
  if (btnHostKeyOnce) btnHostKeyOnce.addEventListener('click', () => closeHostKeyModal('trust_once'));
  const btnHostKeyReject = document.getElementById('btn-host-key-reject');
  if (btnHostKeyReject) btnHostKeyReject.addEventListener('click', () => closeHostKeyModal('reject'));
  const btnHostKeyClose = document.getElementById('btn-host-key-close');
  if (btnHostKeyClose) btnHostKeyClose.addEventListener('click', () => closeHostKeyModal('reject'));

  // =========================================================================
  // File Overwrite Conflict Resolution Dialog Controller
  // =========================================================================
  const conflictModal = document.getElementById('file-conflict-modal');
  const conflictSrcName = document.getElementById('conflict-src-name');
  const conflictSrcSize = document.getElementById('conflict-src-size');
  const conflictSrcMtime = document.getElementById('conflict-src-mtime');
  const conflictDstName = document.getElementById('conflict-dst-name');
  const conflictDstSize = document.getElementById('conflict-dst-size');
  const conflictDstMtime = document.getElementById('conflict-dst-mtime');
  const conflictApplyBatch = document.getElementById('conflict-apply-batch');

  let activeConflictState = { resolve: null };
  let batchConflictAction = null;
  let conflictQueue = [];

  const updateConflictModalBatchState = () => {
    const totalCount = 1 + conflictQueue.length;
    const titleEl = document.getElementById('conflict-modal-title');
    const subTitleEl = document.getElementById('conflict-modal-subtitle');
    const overwriteBtn = document.getElementById('btn-conflict-overwrite');
    const skipBtn = document.getElementById('btn-conflict-skip');

    if (totalCount > 1) {
      if (titleEl) titleEl.textContent = `⚠️ File Overwrite Conflict (1 of ${totalCount} files)`;
      if (subTitleEl) subTitleEl.textContent = `Multiple files in this transfer already exist. Choose how to resolve:`;
      if (conflictApplyBatch && conflictApplyBatch.dataset.userToggled !== 'true') {
        conflictApplyBatch.checked = true;
      }
    } else {
      if (titleEl) titleEl.textContent = `⚠️ File Overwrite Conflict`;
      if (subTitleEl) subTitleEl.textContent = `The destination file already exists. Choose how to resolve this conflict:`;
    }

    if (conflictApplyBatch && conflictApplyBatch.checked && totalCount > 1) {
      if (overwriteBtn) overwriteBtn.textContent = `⚡ Overwrite All (${totalCount})`;
      if (skipBtn) skipBtn.textContent = `⏭️ Skip All (${totalCount})`;
    } else {
      if (overwriteBtn) overwriteBtn.textContent = `⚡ Overwrite`;
      if (skipBtn) skipBtn.textContent = `⏭️ Skip File`;
    }
  };

  const showConflictData = (data) => {
    const src = data.localStat || { name: (data.localPath || 'file').replace(/\\/g, '/').split('/').pop(), size: 0, modifyTime: '-' };
    const dst = data.remoteStat || { name: (data.remotePath || 'file').split('/').pop(), size: 0, modifyTime: '-' };

    if (conflictSrcName) conflictSrcName.textContent = src.name;
    if (conflictSrcSize) conflictSrcSize.textContent = `Size: ${window.FileBrowser ? window.FileBrowser.formatSize(src.size) : src.size + ' B'}`;
    if (conflictSrcMtime) conflictSrcMtime.textContent = `Modified: ${src.modifyTime ? new Date(src.modifyTime).toLocaleString() : '-'}`;

    if (conflictDstName) conflictDstName.textContent = dst.name;
    if (conflictDstSize) conflictDstSize.textContent = `Size: ${window.FileBrowser ? window.FileBrowser.formatSize(dst.size) : dst.size + ' B'}`;
    if (conflictDstMtime) conflictDstMtime.textContent = `Modified: ${dst.modifyTime ? new Date(dst.modifyTime).toLocaleString() : '-'}`;

    updateConflictModalBatchState();

    if (conflictModal) {
      conflictModal.setAttribute('aria-hidden', 'false');
      conflictModal.classList.add('active');
    }
  };

  if (conflictApplyBatch) {
    conflictApplyBatch.addEventListener('change', () => {
      conflictApplyBatch.dataset.userToggled = 'true';
      updateConflictModalBatchState();
    });
  }

  window.FileConflictDialog = {
    resetBatch() {
      batchConflictAction = null;
      conflictQueue = [];
      if (conflictApplyBatch) {
        delete conflictApplyBatch.dataset.userToggled;
        conflictApplyBatch.checked = false;
      }
    },
    async resolveConflict(data) {
      if (data && data.partialTransfer === true) {
        if (window.LogViewer) window.LogViewer.addEntry('info', `⏩ Partial transfer detected (${window.FileBrowser ? window.FileBrowser.formatSize(data.resumeOffset) : data.resumeOffset + ' B'}). Resuming automatically.`);
        return 'resume';
      }

      const prefElem = document.getElementById('pref-conflict-policy');
      const policy = prefElem ? prefElem.value : 'prompt';

      if (policy === 'overwrite') return 'overwrite';
      if (policy === 'skip') return 'skip';
      if (policy === 'newer') {
        const srcTime = data.localStat ? new Date(data.localStat.modifyTime).getTime() : 0;
        const dstTime = data.remoteStat ? new Date(data.remoteStat.modifyTime).getTime() : 0;
        const localIsNewer = data.isLocalNewer !== undefined ? data.isLocalNewer : (srcTime - dstTime > 2000);
        const remoteIsNewer = data.isRemoteNewer !== undefined ? data.isRemoteNewer : (dstTime - srcTime > 2000);

        if (localIsNewer) {
          return 'overwrite';
        } else if (remoteIsNewer) {
          if (window.LogViewer) {
            window.LogViewer.addEntry('warning', `⚠️ Remote server file is newer (${new Date(dstTime).toLocaleString()}) than local file (${new Date(srcTime).toLocaleString()}). Prompting for conflict decision.`);
          }
          // Fall through to show Conflict Modal prompt below
        } else {
          // Same timestamp / within 2s tolerance
          return 'overwrite';
        }
      }

      if (batchConflictAction) {
        return batchConflictAction;
      }

      if (!conflictModal) return 'overwrite';

      if (activeConflictState.resolve !== null) {
        return new Promise((resolve) => {
          conflictQueue.push({ data, resolve });
          updateConflictModalBatchState();
        });
      }

      return new Promise((resolve) => {
        activeConflictState.resolve = resolve;
        showConflictData(data);
      });
    }
  };

  const closeConflictModal = (action) => {
    if (!conflictModal) return;
    if (conflictApplyBatch && conflictApplyBatch.checked) {
      batchConflictAction = action;
    }
    const resolve = activeConflictState.resolve;
    activeConflictState.resolve = null;
    if (resolve) resolve(action);

    if (conflictQueue.length > 0) {
      const next = conflictQueue.shift();
      if (batchConflictAction) {
        next.resolve(batchConflictAction);
        while (conflictQueue.length > 0) {
          const item = conflictQueue.shift();
          item.resolve(batchConflictAction);
        }
        conflictModal.classList.remove('active');
        conflictModal.setAttribute('aria-hidden', 'true');
      } else {
        activeConflictState.resolve = next.resolve;
        showConflictData(next.data);
      }
    } else {
      conflictModal.classList.remove('active');
      conflictModal.setAttribute('aria-hidden', 'true');
    }
  };

  const btnConflictOverwrite = document.getElementById('btn-conflict-overwrite');
  if (btnConflictOverwrite) btnConflictOverwrite.addEventListener('click', () => closeConflictModal('overwrite'));
  const btnConflictNewer = document.getElementById('btn-conflict-newer');
  if (btnConflictNewer) btnConflictNewer.addEventListener('click', () => closeConflictModal('newer'));
  const btnConflictSkip = document.getElementById('btn-conflict-skip');
  if (btnConflictSkip) btnConflictSkip.addEventListener('click', () => closeConflictModal('skip'));
  const btnConflictRename = document.getElementById('btn-conflict-rename');
  if (btnConflictRename) btnConflictRename.addEventListener('click', () => closeConflictModal('rename'));
  const btnConflictClose = document.getElementById('btn-conflict-close');
  if (btnConflictClose) btnConflictClose.addEventListener('click', () => closeConflictModal('skip'));

    }; // END startNormalApp()

    // Master Password Startup Gate
    // ONLY this runs on startup when master password is enabled.
    // startNormalApp() fires ONLY after password is confirmed, or immediately if disabled.
    const checkMasterUnlock = async () => {
      const api = getApi();
      if (api && api.profiles && api.profiles.master) {
        try {
          const status = await api.profiles.master.getStatus();
          if (status && status.enabled && !status.unlocked) {
            const unlockModal = document.getElementById('master-unlock-modal');
            const pwdInput = document.getElementById('master-unlock-password');
            const submitBtn = document.getElementById('btn-master-unlock-submit');
            const errDiv = document.getElementById('master-unlock-error');

            if (unlockModal) unlockModal.classList.add('active');
            if (pwdInput) {
              pwdInput.value = '';
              pwdInput.style.borderColor = '';
              setTimeout(() => pwdInput.focus(), 100);
            }

            const lockoutDiv = document.getElementById('master-unlock-lockout');
            const exitBtn = document.getElementById('btn-master-lockout-exit');
            const MAX_ATTEMPTS = 3;
            let failedAttempts = 0;

            const attemptUnlock = async () => {
              const pwd = pwdInput ? pwdInput.value : '';
              if (!pwd) return;
              try {
                const ok = await api.profiles.master.unlock(pwd);
                if (ok) {
                  if (unlockModal) unlockModal.classList.remove('active');
                  if (errDiv) errDiv.style.display = 'none';
                  if (lockoutDiv) lockoutDiv.style.display = 'none';
                  startNormalApp();
                  if (window.ConnectionDialog) window.ConnectionDialog.renderConnectionProfileList();
                  if (window.LogViewer) window.LogViewer.addEntry('info', '🔓 Master Password vault unlocked.');
                } else {
                  failedAttempts++;
                  const remaining = MAX_ATTEMPTS - failedAttempts;

                  if (failedAttempts >= MAX_ATTEMPTS) {
                    // Lockout: disable input, show message, swap buttons
                    if (pwdInput) { pwdInput.disabled = true; pwdInput.style.borderColor = 'hsl(var(--status-danger))'; }
                    if (submitBtn) { submitBtn.style.display = 'none'; }
                    if (errDiv) errDiv.style.display = 'none';
                    if (lockoutDiv) lockoutDiv.style.display = 'block';
                    if (exitBtn) {
                      exitBtn.style.display = 'block';
                      exitBtn.onclick = () => {
                        const api2 = getApi();
                        if (api2 && api2.quit) { api2.quit(); } else { window.close(); }
                      };
                    }
                  } else {
                    // Show remaining attempts
                    if (errDiv) {
                      errDiv.style.display = 'block';
                      errDiv.textContent = `⚠️ Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`;
                    }
                    if (pwdInput) {
                      pwdInput.style.borderColor = 'hsl(var(--status-danger))';
                      pwdInput.select();
                    }
                  }
                }
              } catch (err) {
                console.error('Master password unlock IPC call failed:', err);
                if (errDiv) {
                  errDiv.style.display = 'block';
                  errDiv.textContent = `⚠️ Unlock system error: ${err.message || err}`;
                }
              }
            };

            if (submitBtn) submitBtn.onclick = attemptUnlock;
            if (pwdInput) {
              pwdInput.onkeydown = (e) => {
                if (e.key === 'Enter') attemptUnlock();
              };
            }
            return; // HALT: nothing starts until password confirmed
          }
        } catch (e) {}
      }
      startNormalApp(); // no master password — start immediately
    };

    checkMasterUnlock();

    logDiagnostic('startup', { phase: 'init-complete' });
  } catch (err) {
    logDiagnostic('renderer initialization failures', {
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : null
    }, 'error');
    throw err;
  }
});

