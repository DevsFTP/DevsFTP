/**
 * DevsFTP SSH Tunnel Manager UI Controller
 * Manages SSH Port Forwarding rules, modal interactions, active tunnel lists,
 * persistent tunnel rule storage, and real-time traffic statistics.
 */

window.TunnelManager = {
  savedRules: [],
  activeTunnels: [],

  init() {
    this.btnCreateDrawer = document.getElementById('btn-create-tunnel-drawer');
    this.btnRefresh = document.getElementById('btn-tunnels-refresh');
    this.modal = document.getElementById('tunnel-config-modal');
    this.btnCloseModal = document.getElementById('btn-tunnel-modal-close');
    this.btnCancelModal = document.getElementById('btn-tunnel-modal-cancel');
    this.btnSubmitModal = document.getElementById('btn-tunnel-modal-submit');
    this.typeSelect = document.getElementById('tunnel-type-select');

    if (this.btnCreateDrawer) {
      this.btnCreateDrawer.addEventListener('click', () => this.openTunnelModal());
    }

    if (this.btnRefresh) {
      this.btnRefresh.addEventListener('click', () => this.loadTunnels());
    }

    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener('click', () => this.closeTunnelModal());
    }

    if (this.btnCancelModal) {
      this.btnCancelModal.addEventListener('click', () => this.closeTunnelModal());
    }

    if (this.btnSubmitModal) {
      this.btnSubmitModal.addEventListener('click', () => this.submitTunnelConfig());
    }

    const btnDelClose = document.getElementById('btn-delete-tunnel-close');
    const btnDelCancel = document.getElementById('btn-delete-tunnel-cancel');
    const btnDelConfirm = document.getElementById('btn-delete-tunnel-confirm');
    if (btnDelClose) btnDelClose.addEventListener('click', () => this.closeDeleteModal());
    if (btnDelCancel) btnDelCancel.addEventListener('click', () => this.closeDeleteModal());
    if (btnDelConfirm) btnDelConfirm.addEventListener('click', () => this.confirmDeleteTunnel());

    if (this.typeSelect) {
      this.typeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        const targetContainer = document.getElementById('tunnel-remote-target-container');
        if (targetContainer) {
          targetContainer.style.display = type === 'dynamic' ? 'none' : 'grid';
        }
      });
    }

    this.loadSavedRules();

    // Auto-refresh tunnel metrics every 3 seconds
    setInterval(() => {
      if (document.getElementById('tab-tunnels')?.classList.contains('active')) {
        this.loadTunnels();
      }
    }, 3000);

    this.loadTunnels();
  },

  getApi() {
    return window.devsFTP || window.pulseFTP;
  },

  loadSavedRules() {
    try {
      const raw = localStorage.getItem('devsftp_saved_tunnels');
      this.savedRules = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.savedRules)) this.savedRules = [];
    } catch (e) {
      this.savedRules = [];
    }
  },

  saveSavedRules() {
    try {
      localStorage.setItem('devsftp_saved_tunnels', JSON.stringify(this.savedRules));
    } catch (e) {}
  },

  async loadTunnels() {
    const api = this.getApi();
    const tbody = document.getElementById('tunnels-tbody');
    const badge = document.getElementById('tunnels-badge');
    if (!api || !api.tunnels || !tbody) return;

    try {
      this.activeTunnels = await api.tunnels.list();
      this.loadSavedRules();

      // Merge saved rules with active running state
      const mergedList = [];
      const activeMap = new Map();
      this.activeTunnels.forEach(t => activeMap.set(t.id, t));

      // 1. Add all saved rules
      this.savedRules.forEach(rule => {
        const active = activeMap.get(rule.id);
        if (active) {
          mergedList.push(active);
          activeMap.delete(rule.id);
        } else {
          mergedList.push({
            id: rule.id,
            rule,
            status: 'stopped',
            activeConnections: 0,
            bytesRead: 0,
            bytesWritten: 0
          });
        }
      });

      // 2. Add any active un-saved tunnels
      activeMap.forEach(active => {
        mergedList.push(active);
      });

      let activeCount = 0;
      if (mergedList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: hsl(var(--text-muted)); padding: 16px;">No SSH Tunnels configured. Click "+ Add SSH Tunnel Rule" to forward local/remote ports.</td></tr>';
        if (badge) badge.textContent = '0';
        return;
      }

      tbody.innerHTML = '';
      mergedList.forEach((t) => {
        const tr = document.createElement('tr');
        const r = t.rule || {};

        if (t.status === 'active') activeCount++;

        const formatBytes = (bytes) => {
          if (!bytes || bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        };

        const typeLabel = r.type === 'local' 
          ? '<span style="color: #60A5FA; font-weight: 600;">LOCAL</span>'
          : (r.type === 'remote' ? '<span style="color: #F59E0B; font-weight: 600;">REMOTE</span>' : '<span style="color: #A78BFA; font-weight: 600;">SOCKS5</span>');

        const localAddr = `${r.localHost || '127.0.0.1'}:${r.localPort || ''}`;
        const targetAddr = r.type === 'dynamic' ? 'Dynamic Proxy' : `${r.remoteHost || '127.0.0.1'}:${r.remotePort || ''}`;
        const profileName = r.profileConfig ? r.profileConfig.name || r.profileConfig.host : 'SSH Host';

        const statusBadge = t.status === 'active' 
          ? '<span style="background: rgba(16,185,129,0.15); color: #34D399; border: 1px solid #68a063; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700;">● ACTIVE</span>'
          : '<span style="background: rgba(239,68,68,0.15); color: #FCA5A5; border: 1px solid #EF4444; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700;">STOPPED</span>';

        const startStopBtn = t.status === 'active'
          ? `<button class="btn btn-danger btn-stop-tunnel" data-id="${t.id}" style="padding: 2px 8px; font-size: 10px;">⏹ Stop</button>`
          : `<button class="btn btn-primary btn-start-tunnel" data-id="${t.id}" style="padding: 2px 8px; font-size: 10px;">▶ Start</button>`;

        const deleteBtn = `<button class="btn btn-danger btn-delete-tunnel" data-id="${t.id}" style="padding: 2px 8px; font-size: 10px; margin-left: 4px;" title="Delete this tunnel rule">🗑 Delete</button>`;

        tr.innerHTML = `
          <td style="font-weight: 600; color: hsl(var(--text-primary));">${r.name || 'SSH Tunnel'}</td>
          <td>${typeLabel}</td>
          <td style="font-family: var(--font-mono); font-size: 11px;">${localAddr}</td>
          <td style="font-family: var(--font-mono); font-size: 11px; color: hsl(var(--text-muted));">${targetAddr}</td>
          <td>${profileName}</td>
          <td style="font-size: 11px; font-family: var(--font-mono);">In: ${formatBytes(t.bytesRead)} / Out: ${formatBytes(t.bytesWritten)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: center;">${startStopBtn} ${deleteBtn}</td>
        `;

        tbody.appendChild(tr);
      });

      if (badge) badge.textContent = String(activeCount);

      // Attach button events
      tbody.querySelectorAll('.btn-stop-tunnel').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          await api.tunnels.stop(id);
          this.loadTunnels();
        });
      });

      tbody.querySelectorAll('.btn-start-tunnel').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          const found = mergedList.find(t => t.id === id);
          if (found && found.rule) {
            try {
              await api.tunnels.start(found.rule);
              this.loadTunnels();
            } catch (err) {
              if (window.LogViewer) window.LogViewer.addEntry('error', `Failed to start tunnel: ${err.message}`);
              alert(`Failed to start tunnel: ${err.message}`);
            }
          }
        });
      });

      tbody.querySelectorAll('.btn-delete-tunnel').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = e.target.getAttribute('data-id');
          const found = mergedList.find(t => t.id === id);
          this.promptDeleteTunnel(id, found ? (found.rule ? found.rule.name : id) : id);
        });
      });

    } catch (err) {
      console.error('Failed to load SSH tunnels:', err);
    }
  },

  async openTunnelModal() {
    const api = this.getApi();
    const select = document.getElementById('tunnel-profile-select');
    if (!api || !api.profiles || !select || !this.modal) return;

    try {
      const profiles = await api.profiles.getAll();
      const sshProfiles = profiles.filter(p => p && p.protocol === 'sftp');

      select.innerHTML = '';
      if (sshProfiles.length === 0) {
        select.innerHTML = '<option value="">No SSH Profiles available. Create an SFTP profile first.</option>';
      } else {
        sshProfiles.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.name} (${p.username || 'user'}@${p.host}:${p.port || 22})`;
          select.appendChild(opt);
        });
      }

      this.modal.classList.add('active');
    } catch (err) {
      console.error('Failed to prepare tunnel modal profiles:', err);
    }
  },

  closeTunnelModal() {
    if (this.modal) this.modal.classList.remove('active');
  },

  async submitTunnelConfig() {
    const api = this.getApi();
    if (!api || !api.tunnels) return;

    const name = document.getElementById('tunnel-name-input').value.trim() || 'SSH Port Forward';
    const type = document.getElementById('tunnel-type-select').value;
    const profileId = document.getElementById('tunnel-profile-select').value;
    const localHost = document.getElementById('tunnel-local-host').value.trim() || '127.0.0.1';
    const localPort = parseInt(document.getElementById('tunnel-local-port').value, 10) || 9090;
    const remoteHost = document.getElementById('tunnel-remote-host').value.trim() || '127.0.0.1';
    const remotePort = parseInt(document.getElementById('tunnel-remote-port').value, 10) || 80;

    const profiles = await api.profiles.getAll();
    const profileConfig = profiles.find(p => p.id === profileId);

    if (!profileConfig) {
      alert('Please select a valid SSH Profile for tunneling.');
      return;
    }

    const ruleId = `tun_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const rule = {
      id: ruleId,
      name,
      type,
      localHost,
      localPort,
      remoteHost,
      remotePort,
      profileConfig
    };

    // Save rule persistently
    this.savedRules.push(rule);
    this.saveSavedRules();

    try {
      await api.tunnels.start(rule);
      this.closeTunnelModal();
      this.loadTunnels();
    } catch (err) {
      alert(`Tunnel rule saved, but start failed: ${err.message}`);
      this.closeTunnelModal();
      this.loadTunnels();
    }
  },

  promptDeleteTunnel(tunnelId, name) {
    this.pendingDeleteId = tunnelId;
    const modal = document.getElementById('confirm-delete-tunnel-modal');
    const nameEl = document.getElementById('delete-tunnel-modal-name');
    if (nameEl) nameEl.textContent = name || 'SSH Tunnel Rule';
    if (modal) modal.classList.add('active');
  },

  closeDeleteModal() {
    const modal = document.getElementById('confirm-delete-tunnel-modal');
    if (modal) modal.classList.remove('active');
    this.pendingDeleteId = null;
  },

  async confirmDeleteTunnel() {
    if (!this.pendingDeleteId) return;
    const id = this.pendingDeleteId;
    const api = this.getApi();

    try {
      if (api && api.tunnels && api.tunnels.delete) {
        await api.tunnels.delete(id);
      }
    } catch (e) {}

    this.savedRules = this.savedRules.filter(r => r.id !== id);
    this.saveSavedRules();
    this.closeDeleteModal();
    this.loadTunnels();
  }
};
