/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Connection Profiles Manager
 */

window.ProfilesManager = {
  profiles: [],
  selectedColorSwatch: '#3B82F6',

  init() {
    this.setupListeners();
  },

  setupListeners() {
    // Drawer triggers
    const btnNewProfile = document.getElementById('btn-new-profile');
    if (btnNewProfile) {
      btnNewProfile.addEventListener('click', () => this.openProfileDrawer());
    }

    const btnCloseDrawer = document.getElementById('btn-close-profile-drawer');
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => this.closeProfileDrawer());
    }

    // Auth type change
    const authSelect = document.getElementById('field-profile-auth-type');
    if (authSelect) {
      authSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('group-password').style.display = type === 'password' ? 'block' : 'none';
        document.getElementById('group-key').style.display = type === 'key' ? 'block' : 'none';
        document.getElementById('group-passphrase').style.display = type === 'key' ? 'block' : 'none';
      });
    }

    // Browse key file
    const btnBrowseKey = document.getElementById('btn-browse-key-file');
    if (btnBrowseKey) {
      btnBrowseKey.addEventListener('click', async () => {
        const filePath = await window.devSSH.system.selectFile({
          title: 'Select Private Key File',
          filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'PEM Keys', extensions: ['pem', 'key', 'id_rsa'] }
          ]
        });
        if (filePath) {
          document.getElementById('field-profile-key-path').value = filePath;
        }
      });
    }

    // Swatches picker
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        swatches.forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        this.selectedColorSwatch = e.target.dataset.color;
        document.getElementById('field-profile-accent').value = this.selectedColorSwatch;
      });
    });

    // Form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveProfile();
      });
    }

    // Import configurations
    const btnImport = document.getElementById('btn-import-config');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.handleImportSSHConfig());
    }
  },

  async loadList() {
    this.profiles = await window.devSSH.profiles.getAll();
    const container = document.getElementById('profiles-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (this.profiles.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 24px 12px;">
          No profiles saved yet. Click "Add Profile" to configure one.
        </div>
      `;
      return;
    }

    this.profiles.forEach(p => {
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.style.setProperty('--profile-accent', p.accentColor);
      card.dataset.id = p.id;

      card.innerHTML = `
        <div class="profile-name-row">
          <span class="profile-name">${escapeHtml(p.name)}</span>
          <div class="profile-actions">
            <button class="icon-btn edit-btn" title="Edit Profile">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="icon-btn delete-btn delete" title="Delete Profile">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="profile-desc">${escapeHtml(p.username)}@${escapeHtml(p.host)}:${p.port}</div>
      `;

      // Clicks
      card.addEventListener('click', (e) => {
        // Skip connection if clicked action buttons
        if (e.target.closest('.icon-btn')) return;
        this.connectProfile(p.id);
      });

      card.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openProfileDrawer(p.id);
      });

      card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteProfile(p.id);
      });

      container.appendChild(card);
    });
  },

  openProfileDrawer(profileId = null) {
    const drawer = document.getElementById('profile-drawer');
    const form = document.getElementById('profile-form');
    const title = document.getElementById('profile-drawer-title');

    form.reset();
    document.getElementById('field-profile-id').value = '';
    
    // Select default swatch
    this.selectedColorSwatch = '#3B82F6';
    document.getElementById('field-profile-accent').value = '#3B82F6';
    document.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.remove('active');
      if (s.dataset.color === '#3B82F6') s.classList.add('active');
    });

    // Reset password/key inputs views
    document.getElementById('field-profile-auth-type').value = 'password';
    document.getElementById('group-password').style.display = 'block';
    document.getElementById('group-key').style.display = 'none';
    document.getElementById('group-passphrase').style.display = 'none';

    if (profileId) {
      title.innerText = 'Edit Connection Profile';
      const p = this.profiles.find(x => x.id === profileId);
      if (p) {
        document.getElementById('field-profile-id').value = p.id;
        document.getElementById('field-profile-name').value = p.name;
        document.getElementById('field-profile-host').value = p.host;
        document.getElementById('field-profile-port').value = p.port;
        document.getElementById('field-profile-user').value = p.username;
        document.getElementById('field-profile-auth-type').value = p.authType;
        document.getElementById('field-profile-password').value = p.password || '';
        document.getElementById('field-profile-key-path').value = p.privateKeyPath || '';
        document.getElementById('field-profile-passphrase').value = p.passphrase || '';
        
        this.selectedColorSwatch = p.accentColor || '#3B82F6';
        document.getElementById('field-profile-accent').value = this.selectedColorSwatch;
        document.querySelectorAll('.color-swatch').forEach(s => {
          s.classList.remove('active');
          if (s.dataset.color === this.selectedColorSwatch) s.classList.add('active');
        });

        // Trigger view display change
        document.getElementById('group-password').style.display = p.authType === 'password' ? 'block' : 'none';
        document.getElementById('group-key').style.display = p.authType === 'key' ? 'block' : 'none';
        document.getElementById('group-passphrase').style.display = p.authType === 'key' ? 'block' : 'none';
      }
    } else {
      title.innerText = 'Add Connection Profile';
    }

    drawer.classList.add('active');
  },

  closeProfileDrawer() {
    document.getElementById('profile-drawer').classList.remove('active');
  },

  async saveProfile() {
    const id = document.getElementById('field-profile-id').value;
    const profile = {
      name: document.getElementById('field-profile-name').value,
      host: document.getElementById('field-profile-host').value,
      port: parseInt(document.getElementById('field-profile-port').value, 10) || 22,
      username: document.getElementById('field-profile-user').value,
      authType: document.getElementById('field-profile-auth-type').value,
      password: document.getElementById('field-profile-password').value,
      privateKeyPath: document.getElementById('field-profile-key-path').value,
      passphrase: document.getElementById('field-profile-passphrase').value,
      accentColor: document.getElementById('field-profile-accent').value
    };

    if (id) {
      profile.id = id;
    }

    await window.devSSH.profiles.upsert(profile);
    this.closeProfileDrawer();
    await this.loadList();
    this.loadTunnelSelect();
  },

  async deleteProfile(profileId) {
    if (confirm('Are you sure you want to delete this connection profile?')) {
      await window.devSSH.profiles.delete(profileId);
      await this.loadList();
      this.loadTunnelSelect();
    }
  },

  loadTunnelSelect() {
    const select = document.getElementById('field-tunnel-profile-select');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Select SSH Host...</option>';
    this.profiles.forEach(p => {
      select.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.username)}@${escapeHtml(p.host)})</option>`;
    });
  },

  async handleImportSSHConfig() {
    // We let user choose to import the standard configuration
    const defaultPath = '~/.ssh/config';
    if (confirm(`Do you want to search and auto-import host profiles from your OpenSSH config file (${defaultPath})?`)) {
      const result = await window.devSSH.profiles.importSSHConfig();
      if (result.success) {
        alert(`Successfully imported ${result.count} SSH configuration profiles!`);
        await this.loadList();
        this.loadTunnelSelect();
      } else {
        // Allow choosing manually via dialog
        const filePath = await window.devSSH.system.selectFile({
          title: 'Select OpenSSH Config File',
          filters: [{ name: 'Config Files', extensions: ['*'] }]
        });
        if (filePath) {
          const manualResult = await window.devSSH.profiles.importSSHConfig(filePath);
          if (manualResult.success) {
            alert(`Successfully imported ${manualResult.count} profiles!`);
            await this.loadList();
            this.loadTunnelSelect();
          } else {
            alert(`Failed to import config: ${manualResult.error}`);
          }
        }
      }
    }
  },

  connectProfile(profileId) {
    const p = this.profiles.find(x => x.id === profileId);
    if (p && window.App) {
      window.App.createNewSession(p);
    }
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
