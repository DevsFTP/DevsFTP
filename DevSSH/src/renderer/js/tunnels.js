/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Tunnel & Port Forwarding UI Handler
 */

window.TunnelsManager = {
  activePollInterval: null,
  tunnelLogs: {},

  init() {
    this.setupListeners();
    this.startPolling();
  },

  setupListeners() {
    // Show/hide remote fields on tunnel type change
    const typeSelect = document.getElementById('field-tunnel-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const remoteGroup = document.getElementById('group-tunnel-remote');
        const localHostGroup = document.getElementById('field-group-local-host');
        const localPortLabel = document.getElementById('label-tunnel-local-port');

        if (val === 'dynamic') {
          remoteGroup.style.display = 'none';
          localHostGroup.style.display = 'block';
          localPortLabel.innerText = 'Local SOCKS5 Port';
        } else {
          remoteGroup.style.display = 'flex';
          localHostGroup.style.display = 'block';
          localPortLabel.innerText = val === 'remote' ? 'Local Target Port' : 'Local Listen Port';
        }
      });
    }

    // Tunnel Form submit
    const tunnelForm = document.getElementById('tunnel-form');
    if (tunnelForm) {
      tunnelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.startTunnel();
      });
    }

    // Close buttons
    const btnClose = document.getElementById('btn-close-tunnel-drawer');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeTunnelDrawer());
    }

    // Capture logs from IPC
    window.devSSH.tunnels.onLog((logPayload) => {
      const { tunnelId, type, message } = logPayload;
      if (!this.tunnelLogs[tunnelId]) {
        this.tunnelLogs[tunnelId] = [];
      }
      const timestamp = new Date().toLocaleTimeString();
      this.tunnelLogs[tunnelId].push(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
      
      // Limit logs size
      if (this.tunnelLogs[tunnelId].length > 100) {
        this.tunnelLogs[tunnelId].shift();
      }

      // If active log area is displayed, update it
      const activeLogBox = document.getElementById(`logbox-${tunnelId}`);
      if (activeLogBox) {
        activeLogBox.innerText = this.tunnelLogs[tunnelId].join('\n');
        activeLogBox.scrollTop = activeLogBox.scrollHeight;
      }
    });
  },

  openTunnelDrawer() {
    if (window.ProfilesManager.profiles.length === 0) {
      alert('Please create at least one SSH profile first to use as a tunnel gateway.');
      return;
    }
    window.ProfilesManager.loadTunnelSelect();
    document.getElementById('tunnel-drawer').classList.add('active');
  },

  closeTunnelDrawer() {
    document.getElementById('tunnel-drawer').classList.remove('active');
  },

  async startTunnel() {
    const profileId = document.getElementById('field-tunnel-profile-select').value;
    const profileConfig = window.ProfilesManager.profiles.find(p => p.id === profileId);

    if (!profileConfig) {
      alert('Select a valid SSH profile.');
      return;
    }

    const type = document.getElementById('field-tunnel-type').value;
    const rule = {
      id: 'tun_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: document.getElementById('field-tunnel-name').value,
      type: type,
      localHost: document.getElementById('field-tunnel-local-host').value || '127.0.0.1',
      localPort: parseInt(document.getElementById('field-tunnel-local-port').value, 10),
      remoteHost: type === 'dynamic' ? '' : document.getElementById('field-tunnel-remote-host').value,
      remotePort: type === 'dynamic' ? 0 : parseInt(document.getElementById('field-tunnel-remote-port').value, 10),
      profileConfig: profileConfig
    };

    // Pre-initialize empty logs
    this.tunnelLogs[rule.id] = [`Initializing tunnel gateway...`];

    this.closeTunnelDrawer();
    this.updateTunnelList(); // Render immediately in connecting state

    const result = await window.devSSH.tunnels.start(rule);
    if (!result.success) {
      alert(`Tunnel failed to start: ${result.error}`);
    }
    this.updateTunnelList();
  },

  async stopTunnel(tunnelId) {
    await window.devSSH.tunnels.stop(tunnelId);
    this.updateTunnelList();
  },

  async updateTunnelList() {
    const container = document.getElementById('tunnels-list-container');
    if (!container) return;

    const tunnels = await window.devSSH.tunnels.list();

    if (tunnels.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 24px 12px;">
          No active tunnels. Click "Add Tunnel" rule when connecting.
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    tunnels.forEach(t => {
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.style.setProperty('--profile-accent', t.status === 'active' ? 'var(--status-success)' : 'var(--border-color)');

      const typeLabel = t.rule.type.toUpperCase();
      const gatewayDesc = `${t.rule.profileConfig.username || 'user'}@${t.rule.profileConfig.host}`;
      
      let directionText = '';
      if (t.rule.type === 'local') {
        directionText = `Local ${t.rule.localHost}:${t.rule.localPort} &rarr; Remote ${t.rule.remoteHost}:${t.rule.remotePort}`;
      } else if (t.rule.type === 'remote') {
        directionText = `Remote Port ${t.rule.remotePort} &rarr; Local ${t.rule.localHost}:${t.rule.localPort}`;
      } else {
        directionText = `SOCKS5 Dynamic Proxy on ${t.rule.localHost}:${t.rule.localPort}`;
      }

      const formattedBytesRead = formatBytes(t.bytesRead);
      const formattedBytesWritten = formatBytes(t.bytesWritten);

      card.innerHTML = `
        <div class="profile-name-row" style="margin-bottom: 2px;">
          <span class="profile-name" style="font-size: 12px;">${escapeHtml(t.rule.name)}</span>
          <span class="tunnel-badge ${t.status}">${t.status}</span>
        </div>
        <div class="profile-desc" style="font-size: 10px; margin-bottom: 4px; color: var(--text-secondary);">${directionText}</div>
        <div class="profile-desc" style="font-size: 9px; margin-bottom: 8px;">Gateway: ${escapeHtml(gatewayDesc)}</div>
        
        <div class="tunnel-stats-row">
          <span>Conn: ${t.activeConnections}</span>
          <span>Rx: ${formattedBytesRead} | Tx: ${formattedBytesWritten}</span>
        </div>
        
        <div class="tunnel-log-box" id="logbox-${t.id}" style="display: none;">
          ${(this.tunnelLogs[t.id] || []).join('\n')}
        </div>

        <div class="profile-actions" style="margin-top: 8px; opacity: 1; display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn btn-view-logs" style="padding: 3px 6px; font-size: 10px;" data-id="${t.id}">
            Logs
          </button>
          <button class="btn btn-stop-tunnel primary" style="padding: 3px 6px; font-size: 10px; background: var(--status-danger); border-color: var(--status-danger);" data-id="${t.id}">
            Stop
          </button>
        </div>
      `;

      // Event handlers inside card
      card.querySelector('.btn-view-logs').addEventListener('click', (e) => {
        e.stopPropagation();
        const logBox = document.getElementById(`logbox-${t.id}`);
        if (logBox) {
          const isHidden = logBox.style.display === 'none';
          logBox.style.display = isHidden ? 'block' : 'none';
          if (isHidden) {
            logBox.scrollTop = logBox.scrollHeight;
          }
        }
      });

      card.querySelector('.btn-stop-tunnel').addEventListener('click', (e) => {
        e.stopPropagation();
        this.stopTunnel(t.id);
      });

      container.appendChild(card);
    });
  },

  startPolling() {
    if (this.activePollInterval) clearInterval(this.activePollInterval);
    this.activePollInterval = setInterval(() => {
      // Check if sidebar section for tunnels is active to conserve resources
      const tunnelsSection = document.getElementById('section-tunnels');
      if (tunnelsSection && tunnelsSection.classList.contains('active')) {
        this.updateTunnelList();
      }
    }, 2000);
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
