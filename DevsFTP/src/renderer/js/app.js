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

  const openUploadPrompt = (data) => {
    if (isUploadPromptSuppressed()) {
      return Promise.resolve(true);
    }

    if (!uploadPromptModal) {
      return Promise.resolve(confirm(`Detected changes saved in ${data.fileName}.\nDo you want to automatically upload changes back to remote server?`));
    }

    return new Promise((resolve) => {
      uploadPromptState.resolve = resolve;

      if (uploadPromptFile) uploadPromptFile.textContent = data.fileName || 'cached file';
      if (uploadPromptRemote) uploadPromptRemote.textContent = data.remotePath || '/';
      if (uploadPromptMessage) {
        uploadPromptMessage.textContent = `A local save was detected for ${data.fileName || 'the cached file'}. Upload the latest changes back to the remote server now?`;
      }
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
      closeUploadPrompt(true);
    });
  }

  if (uploadPromptCancelBtn) {
    uploadPromptCancelBtn.addEventListener('click', () => closeUploadPrompt(false));
  }

  if (uploadPromptCloseBtn) {
    uploadPromptCloseBtn.addEventListener('click', () => closeUploadPrompt(false));
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
        localStorage.removeItem('devsftp_workspace_saved_tabs');
        const msg = document.getElementById('clear-sessions-msg');
        if (msg) {
          msg.style.display = 'inline-block';
          setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }
        if (window.LogViewer) window.LogViewer.addEntry('info', '[Workspace Storage] Saved workspace sessions storage cleared cleanly.');
      });
    }



    // =========================================================================
    // Bug Reporting & Feedback Dialog Controller (devsftp.com/bugs.php)
    // =========================================================================
    const bugReportModal = document.getElementById('bug-report-modal');
    const bugFormView = document.getElementById('bug-report-form-view');
    const bugThankyouView = document.getElementById('bug-report-thankyou-view');
    const bugDescInput = document.getElementById('bug-report-description');
    const bugEmailInput = document.getElementById('bug-report-email');
    const bugIncludeLogsCb = document.getElementById('bug-report-include-logs');
    const btnBugSubmit = document.getElementById('btn-bug-report-submit');

    window.BugReportModal = {
      open() {
        if (!bugReportModal) return;
        if (bugDescInput) {
          bugDescInput.value = '';
          bugDescInput.style.borderColor = '';
        }
        if (bugEmailInput) bugEmailInput.value = '';
        if (bugIncludeLogsCb) bugIncludeLogsCb.checked = true;
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

        const email = bugEmailInput ? bugEmailInput.value.trim() : '';
        const includeLogs = bugIncludeLogsCb ? bugIncludeLogsCb.checked : true;

        const api = window.devsFTP || window.pulseFTP;
        try {
          if (api && api.submitBugReport) {
            await api.submitBugReport({ description: desc, email, includeLogs });
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
      menuHelpDocs.addEventListener('click', () => openWebsite('https://DevsFTP.com/docs/'));
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
      if (resetPrefsModal) { resetPrefsModal.classList.add('active'); resetPrefsModal.setAttribute('aria-hidden', 'false'); }
    });
    if (btnResetPrefsCancel) btnResetPrefsCancel.addEventListener('click', closeResetModal);
    if (btnResetPrefsCancelX) btnResetPrefsCancelX.addEventListener('click', closeResetModal);
    if (btnResetPrefsConfirm) btnResetPrefsConfirm.addEventListener('click', () => {
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

    if (panelConfig.collapsed) {
      drawer.classList.add('collapsed');
      btnToggleDrawer.textContent = '▲ Expand';
    } else {
      drawer.classList.remove('collapsed');
      drawer.style.height = `${panelConfig.height}px`;
      btnToggleDrawer.textContent = '▼ Minimize';
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
  btnToggleDrawer.addEventListener('click', () => toggleActivePanelCollapse());

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

  const toggleTheme = (themeName) => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = themeName || (current === 'dark' ? 'light' : 'dark');
    html.setAttribute('data-theme', next);
    if (themeBtn) themeBtn.textContent = next === 'dark' ? '🌙' : '☀️';

    if (prefTheme && prefTheme.value !== next) {
      prefTheme.value = next;
    }

    try {
      localStorage.setItem('devsftp_pref_theme', next);
    } catch (e) {}

    const activeAccent = html.style.getPropertyValue('--accent-primary-hex') || '#68a063';
    if (window.SSHTerminal) {
      window.SSHTerminal.setTheme(next, activeAccent);
    }

    if (window.LogViewer) window.LogViewer.addEntry('info', `Switched UI theme to ${next} mode.`);
  };

  // Restore saved theme preference on startup
  const savedTheme = localStorage.getItem('devsftp_pref_theme') || 'dark';
  toggleTheme(savedTheme);

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
        notifyBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        notifyBadge.style.color = '#34D399';
      } else {
        notifyBadge.textContent = 'Disabled';
        notifyBadge.style.background = 'rgba(100, 116, 139, 0.2)';
        notifyBadge.style.color = '#94A3B8';
      }
    }

    const autoupdateCb = document.getElementById('pref-autoupdate');
    const autoupdateBadge = document.getElementById('general-autoupdate-badge');
    if (autoupdateCb && autoupdateBadge) {
      if (autoupdateCb.checked) {
        autoupdateBadge.textContent = 'Active';
        autoupdateBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        autoupdateBadge.style.color = '#34D399';
      } else {
        autoupdateBadge.textContent = 'Disabled';
        autoupdateBadge.style.background = 'rgba(100, 116, 139, 0.2)';
        autoupdateBadge.style.color = '#94A3B8';
      }
    }
  };

  const prefNotifyTransfers = document.getElementById('pref-notify-transfers');
  if (prefNotifyTransfers) {
    const stored = localStorage.getItem('devsftp_pref_notify_transfers');
    if (stored !== null) prefNotifyTransfers.checked = (stored === 'true');
    prefNotifyTransfers.addEventListener('change', (e) => {
      localStorage.setItem('devsftp_pref_notify_transfers', e.target.checked ? 'true' : 'false');
      window.updateGeneralBadges();
    });
  }

  const prefNotifyChime = document.getElementById('pref-notify-chime');
  if (prefNotifyChime) {
    const stored = localStorage.getItem('devsftp_pref_notify_chime');
    if (stored !== null) prefNotifyChime.checked = (stored === 'true');
    prefNotifyChime.addEventListener('change', (e) => {
      localStorage.setItem('devsftp_pref_notify_chime', e.target.checked ? 'true' : 'false');
      window.updateGeneralBadges();
    });
  }

  const prefAutoupdate = document.getElementById('pref-autoupdate');
  if (prefAutoupdate) {
    const stored = localStorage.getItem('devsftp_pref_autoupdate');
    if (stored !== null) prefAutoupdate.checked = (stored === 'true');
    prefAutoupdate.addEventListener('change', (e) => {
      localStorage.setItem('devsftp_pref_autoupdate', e.target.checked ? 'true' : 'false');
      window.updateGeneralBadges();
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

  // Direct Settings Top Menu Button (Opens Preferences directly to last used section)
  const menuSettingsBtn = document.getElementById('menu-settings-btn');
  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdowns.forEach(dd => dd.classList.remove('active'));
      window.ConnectionDialog.openPreferences(); // No section passed -> recalls last saved section!
    });
  }

  // Top Menu Actions
  const menuFileNew = document.getElementById('menu-file-new');
  if (menuFileNew) menuFileNew.addEventListener('click', () => window.ConnectionDialog.openPreferences('profiles'));

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

  const btnToolsCacheClear = document.getElementById('btn-tools-cache-clear');
  if (btnToolsCacheClear) {
    btnToolsCacheClear.addEventListener('click', async () => {
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
  }

  const menuToolsExport = document.getElementById('menu-tools-export');
  if (menuToolsExport) {
    menuToolsExport.addEventListener('click', async () => {
      const api = getApi();
      if (api && api.profiles && api.profiles.export) {
        try {
          const jsonString = await api.profiles.export();
          const blob = new Blob([jsonString], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'devsftp-profiles-backup.json';
          a.click();
        } catch (err) {
          console.error('Failed to export profiles:', err);
          alert(`Failed to export profiles: ${err.message}`);
        }
      }
    });
  }

  const menuToolsImport = document.getElementById('menu-tools-import');
  if (menuToolsImport) {
    menuToolsImport.addEventListener('click', async () => {
      const api = getApi();
      if (api && api.selectFileOrFolder) {
        const jsonPath = await api.selectFileOrFolder({
          title: 'Select Exported Profiles JSON File',
          filters: [{ name: 'JSON Files', extensions: ['json'] }],
          properties: ['openFile']
        });
        if (jsonPath) {
          const fileContent = prompt('Paste exported profiles JSON content to import:');
          if (fileContent && api.profiles.import) {
            const ok = await api.profiles.import(fileContent);
            if (ok) {
              alert('Profiles imported successfully!');
              window.ConnectionDialog.renderConnectionProfileList();
            } else {
              alert('Failed to parse profile JSON.');
            }
          }
        }
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
      await api.connect(profile, sessId);

      if (window.SessionManager) {
        window.SessionManager.updateSessionConnectionState(sessId, true, profile);
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
      navigator.clipboard.writeText(text).then(() => {
        const orig = btnCopyDebug.textContent;
        btnCopyDebug.textContent = '✓ Copied!';
        setTimeout(() => { btnCopyDebug.textContent = orig; }, 2000);
      }).catch(() => {});
    });
  }

  const btnClearDebug = document.getElementById('btn-clear-editor-debug');
  if (btnClearDebug) {
    btnClearDebug.addEventListener('click', () => {
      const stream = document.getElementById('editor-debug-stream');
      if (stream) stream.innerHTML = '<div class="log-entry info" style="color: hsl(var(--text-muted));">[CLEARED] Editor Debug stream reset.</div>';
    });
  }

  const api = window.devsFTP || window.pulseFTP;
  if (api && api.onCacheDebugEvent) {
    api.onCacheDebugEvent((data) => {
      if (window.EditorDebug) window.EditorDebug.addEntry(data.stage, data.msg, data.details);
    });
  }

  if (api && api.onCacheFileSaved) {
    api.onCacheFileSaved(async (data) => {
      if (window.EditorDebug) window.EditorDebug.addEntry('STAGE 4', `RENDERER RECEIVED = YES (local save event for ${data.fileName})`, data);
      if (window.LogViewer) window.LogViewer.addEntry('info', `Local save detected for cached file: ${data.fileName}`);
      logDiagnostic('save detected', {
        fileName: data.fileName,
        localPath: data.localPath,
        remotePath: data.remotePath,
        sessionId: data.sessionId
      });
      
      const autouploadElem = document.getElementById('pref-autoupload');
      const autouploadPref = autouploadElem ? autouploadElem.value : 'prompt';
      let shouldUpload = autouploadPref === 'auto' || isUploadPromptSuppressed();
      
      if (!shouldUpload) {
        shouldUpload = await openUploadPrompt(data);
      }

      if (shouldUpload) {
        if (window.EditorDebug) window.EditorDebug.addEntry('STAGE 5', `UPLOAD STARTED = YES (uploading ${data.fileName} to remote server)`, { remotePath: data.remotePath, sessionId: data.sessionId });
        logDiagnostic('upload started', {
          fileName: data.fileName,
          localPath: data.localPath,
          remotePath: data.remotePath,
          sessionId: data.sessionId
        });
        if (window.TransferQueue) {
          window.TransferQueue.addTransfer('upload', data.localPath, data.remotePath);
        }
        try {
          await api.uploadFile(data.localPath, data.remotePath, data.sessionId, { profileId: data.profileId });
          if (window.EditorDebug) window.EditorDebug.addEntry('STAGE 6', `UPLOAD COMPLETE = YES (${data.fileName} updated on remote server)`);
          logDiagnostic('upload completed', {
            fileName: data.fileName,
            localPath: data.localPath,
            remotePath: data.remotePath,
            sessionId: data.sessionId
          });
        } catch (err) {
          logDiagnostic('upload failed', {
            fileName: data.fileName,
            localPath: data.localPath,
            remotePath: data.remotePath,
            sessionId: data.sessionId,
            error: err && err.message ? err.message : String(err),
            stack: err && err.stack ? err.stack : null
          }, 'error');
          throw err;
        }
        if (window.FileBrowser) {
          window.FileBrowser.refreshRemote(window.FileBrowser.remotePath);
        }
      }
    });
  }

  if (api && api.onCacheBatchFilesSaved) {
    api.onCacheBatchFilesSaved((batchItems) => {
      if (!Array.isArray(batchItems) || batchItems.length === 0) return;
      if (window.LogViewer) window.LogViewer.addEntry('info', `Startup recovery: ${batchItems.length} modified file(s) detected.`);

      const modal = document.getElementById('batch-upload-modal');
      const titleEl = document.getElementById('batch-upload-modal-title');
      const summaryEl = document.getElementById('batch-upload-summary');
      const listEl = document.getElementById('batch-modal-file-list');
      const confirmBtn = document.getElementById('btn-batch-modal-confirm');
      const cancelBtn = document.getElementById('btn-batch-modal-cancel');
      const closeBtn = document.getElementById('btn-batch-modal-close');

      if (!modal || !listEl) return;

      if (titleEl) {
        titleEl.textContent = batchItems.length === 1 ? '⚡ Unsaved Remote Edit Detected' : `⚡ ${batchItems.length} Unsaved Remote Edits Detected`;
      }
      if (summaryEl) {
        summaryEl.textContent = batchItems.length === 1
          ? 'The following modified file was saved while DevsFTP was closed. Would you like to sync it back to its remote server in the background?'
          : `The following ${batchItems.length} modified files were saved while DevsFTP was closed. Would you like to sync them back to their remote servers in the background?`;
      }

      listEl.innerHTML = batchItems.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: 4px; font-family: var(--font-ui); font-size: 12px;">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 600; color: hsl(var(--text-primary));">📄 ${item.fileName}</span>
            <span style="font-size: 10px; color: hsl(var(--text-muted)); font-family: var(--font-mono);">${item.remotePath}</span>
          </div>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: hsl(var(--bg-tertiary)); color: hsl(var(--accent-color)); font-weight: 600;">
            🌐 ${item.profileName} (${item.host})
          </span>
        </div>
      `).join('');

      const closeModal = () => {
        modal.classList.remove('active');
        if (api && api.dismissBatch) {
          api.dismissBatch(batchItems);
        }
      };

      if (cancelBtn) cancelBtn.onclick = closeModal;
      if (closeBtn) closeBtn.onclick = closeModal;

      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          closeModal();
          if (window.LogViewer) window.LogViewer.addEntry('info', `Initiating background batch upload for ${batchItems.length} file(s)...`);

          batchItems.forEach(item => {
            if (window.TransferQueue) {
              window.TransferQueue.addTransfer('upload', item.localPath, item.remotePath);
            }
          });

          try {
            const res = await api.uploadBatchBackground({ items: batchItems, forceOverwrite: false });
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
              if (window.LogViewer) window.LogViewer.addEntry('info', `✓ Background upload complete: ${batchItems.length} file(s) synced to remote servers.`);
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

  window.FileConflictDialog = {
    resetBatch() {
      batchConflictAction = null;
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

      return new Promise((resolve) => {
        activeConflictState.resolve = resolve;

        const src = data.localStat || { name: (data.localPath || 'file').split('\\').pop(), size: 0, modifyTime: '-' };
        const dst = data.remoteStat || { name: (data.remotePath || 'file').split('/').pop(), size: 0, modifyTime: '-' };

        if (conflictSrcName) conflictSrcName.textContent = src.name;
        if (conflictSrcSize) conflictSrcSize.textContent = `Size: ${window.FileBrowser ? window.FileBrowser.formatSize(src.size) : src.size + ' B'}`;
        if (conflictSrcMtime) conflictSrcMtime.textContent = `Modified: ${src.modifyTime ? new Date(src.modifyTime).toLocaleString() : '-'}`;

        if (conflictDstName) conflictDstName.textContent = dst.name;
        if (conflictDstSize) conflictDstSize.textContent = `Size: ${window.FileBrowser ? window.FileBrowser.formatSize(dst.size) : dst.size + ' B'}`;
        if (conflictDstMtime) conflictDstMtime.textContent = `Modified: ${dst.modifyTime ? new Date(dst.modifyTime).toLocaleString() : '-'}`;

        if (conflictApplyBatch) conflictApplyBatch.checked = false;

        conflictModal.setAttribute('aria-hidden', 'false');
        conflictModal.classList.add('active');
      });
    }
  };

  const closeConflictModal = (action) => {
    if (!conflictModal) return;
    conflictModal.classList.remove('active');
    conflictModal.setAttribute('aria-hidden', 'true');
    if (conflictApplyBatch && conflictApplyBatch.checked) {
      batchConflictAction = action;
    }
    const resolve = activeConflictState.resolve;
    activeConflictState.resolve = null;
    if (resolve) resolve(action);
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

