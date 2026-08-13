/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * App Orchestration and Tabs Manager
 */

window.App = {
  sessions: [], // Array of { id, profileName, accentColor, active }
  activeSessionId: null,

  async init() {
    this.setupListeners();
    
    // Initialize components
    await window.VaultManager.init();
    window.ProfilesManager.init();
    window.TunnelsManager.init();
  },

  setupListeners() {
    // Sidebar Tabs switching
    document.getElementById('tab-profiles').addEventListener('click', () => {
      this.switchSidebarTab('profiles');
    });
    document.getElementById('tab-tunnels').addEventListener('click', () => {
      this.switchSidebarTab('tunnels');
    });

    // Add Tunnel trigger button in footer if clicked Tunnels tab
    document.getElementById('tab-tunnels').addEventListener('click', () => {
      // Toggle footer button context
      const btnNew = document.getElementById('btn-new-profile');
      btnNew.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Tunnel
      `;
      // Temporarily change action of footer new button
      btnNew.onclick = () => window.TunnelsManager.openTunnelDrawer();
    });

    document.getElementById('tab-profiles').addEventListener('click', () => {
      const btnNew = document.getElementById('btn-new-profile');
      btnNew.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Profile
      `;
      btnNew.onclick = null; // restore default
    });

    // Close drawers on backdrop click / button click
    document.getElementById('btn-close-tunnel-drawer').addEventListener('click', () => {
      document.getElementById('tunnel-drawer').classList.remove('active');
    });

    // Listen to terminal output from Main Process
    window.devSSH.terminal.onData((payload) => {
      const { sessionId, data } = payload;
      window.TerminalManager.write(sessionId, data);
    });

    // Handle Host Key verification IPC
    window.devSSH.terminal.onHostKeyVerifyRequest((request) => {
      const { token, host, port, fingerprint } = request;
      
      document.getElementById('host-key-ip').innerText = `${host}:${port}`;
      document.getElementById('host-key-fingerprint').innerText = fingerprint;
      document.getElementById('overlay-host-key').classList.add('active');

      const handleAccept = () => {
        window.devSSH.terminal.respondHostKeyVerify({ token, approved: true });
        document.getElementById('overlay-host-key').classList.remove('active');
        cleanup();
      };

      const handleCancel = () => {
        window.devSSH.terminal.respondHostKeyVerify({ token, approved: false });
        document.getElementById('overlay-host-key').classList.remove('active');
        cleanup();
      };

      const cleanup = () => {
        document.getElementById('btn-host-key-accept').removeEventListener('click', handleAccept);
        document.getElementById('btn-host-key-cancel').removeEventListener('click', handleCancel);
      };

      document.getElementById('btn-host-key-accept').addEventListener('click', handleAccept);
      document.getElementById('btn-host-key-cancel').addEventListener('click', handleCancel);
    });
  },

  switchSidebarTab(tabName) {
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.panel-section').forEach(sect => sect.classList.remove('active'));

    if (tabName === 'profiles') {
      document.getElementById('tab-profiles').classList.add('active');
      document.getElementById('section-profiles').classList.add('active');
    } else {
      document.getElementById('tab-tunnels').classList.add('active');
      document.getElementById('section-tunnels').classList.add('active');
      window.TunnelsManager.updateTunnelList();
    }
  },

  async createNewSession(profile) {
    const sessionId = 'session_' + Date.now();
    const activeColor = profile.accentColor || '#3B82F6';

    const sessionObj = {
      id: sessionId,
      profileName: profile.name,
      accentColor: activeColor
    };

    this.sessions.push(sessionObj);

    // Render Tab
    const tabsContainer = document.getElementById('session-tabs-container');
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.id = `tab-${sessionId}`;
    tabEl.style.setProperty('--profile-accent', activeColor);
    tabEl.innerHTML = `
      <span class="tab-title">${escapeHtml(profile.name)}</span>
      <span class="tab-close" title="Close Session">&times;</span>
    `;

    tabEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) {
        this.closeSession(sessionId);
      } else {
        this.switchSession(sessionId);
      }
    });

    tabsContainer.appendChild(tabEl);

    // Hide Empty state
    document.getElementById('empty-state-view').style.display = 'none';

    // Render Terminal wrapper
    const mainContainer = document.getElementById('terminal-sessions-container');
    const panelEl = document.createElement('div');
    panelEl.className = 'tab-panel';
    panelEl.id = `panel-${sessionId}`;
    panelEl.innerHTML = `
      <div class="terminal-wrapper" id="terminal-container-${sessionId}"></div>
    `;
    mainContainer.appendChild(panelEl);

    // Switch to new session tab
    this.switchSession(sessionId);

    // Initialize xterm PTY inside panel
    const termContainer = document.getElementById(`terminal-container-${sessionId}`);
    const term = window.TerminalManager.createTerminal(sessionId, termContainer, activeColor);
    
    if (term) {
      term.writeln(`\x1b[36mConnecting to ${profile.username}@${profile.host}:${profile.port}...\x1b[0m`);
      
      const res = await window.devSSH.terminal.connect(profile, sessionId);
      if (!res.success) {
        term.writeln(`\r\n\x1b[31mConnection failed: ${res.error}\x1b[0m`);
      }
    }
  },

  switchSession(sessionId) {
    this.activeSessionId = sessionId;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const tab = document.getElementById(`tab-${sessionId}`);
    const panel = document.getElementById(`panel-${sessionId}`);

    if (tab && panel) {
      tab.classList.add('active');
      panel.classList.add('active');
      window.TerminalManager.resize(sessionId);
      window.TerminalManager.focus(sessionId);
    }
  },

  async closeSession(sessionId) {
    // Call disconnect IPC
    await window.devSSH.terminal.disconnect(sessionId);
    
    // Destroy xterm
    window.TerminalManager.destroy(sessionId);

    // Remove tab element and panel element
    const tab = document.getElementById(`tab-${sessionId}`);
    const panel = document.getElementById(`panel-${sessionId}`);
    if (tab) tab.remove();
    if (panel) panel.remove();

    this.sessions = this.sessions.filter(s => s.id !== sessionId);

    if (this.sessions.length > 0) {
      if (this.activeSessionId === sessionId) {
        // Switch to the last remaining session
        const nextSession = this.sessions[this.sessions.length - 1];
        this.switchSession(nextSession.id);
      }
    } else {
      this.activeSessionId = null;
      document.getElementById('empty-state-view').style.display = 'flex';
    }
  }
};

// Start the Application
document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
