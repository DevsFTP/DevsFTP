/**
 * DevsFTP Unified Session Launcher & Profile Manager Component
 * Handles unified profile CRUD, accent color swatch selection, duplication, deletion,
 * inline form editing, and session connections within a single streamlined dialog.
 */

window.ConnectionDialog = {
  modal: null,
  connModal: null,
  activeProfileId: null,
  activeAccentColor: '#68a063',
  selectedConnectionProfile: null,

  getApi() {
    return window.devsFTP || window.pulseFTP;
  },

  init() {
    this.modal = document.getElementById('preferences-modal');
    this.connModal = document.getElementById('connection-modal');

    // Preferences Close Button
    const btnPrefClose = document.getElementById('btn-pref-close');
    if (btnPrefClose) btnPrefClose.addEventListener('click', () => this.close());

    // Preferences Navigation Tabs
    document.querySelectorAll('.pref-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.getAttribute('data-section');
        this.openPreferences(sec);
      });
    });

    // Connection Dialog Bindings
    const btnConnClose = document.getElementById('btn-conn-close');
    if (btnConnClose) btnConnClose.addEventListener('click', () => this.closeConnectionDialog());

    const btnConnNew = document.getElementById('btn-conn-new-profile');
    if (btnConnNew) btnConnNew.addEventListener('click', () => this.openNewProfile());

    const btnImportSSH = document.getElementById('btn-import-ssh-config');
    if (btnImportSSH) btnImportSSH.addEventListener('click', () => this.importSSHConfig());

    const btnConnConnect = document.getElementById('btn-conn-connect');
    if (btnConnConnect) btnConnConnect.addEventListener('click', () => this.connectSelectedProfileToTab());

    // Master Password Security Controls
    const btnMasterEnable = document.getElementById('btn-master-enable');
    const btnMasterChange = document.getElementById('btn-master-change');
    const btnMasterDisable = document.getElementById('btn-master-disable');
    const btnMasterCfgClose = document.getElementById('btn-master-config-close');
    const btnMasterCfgCancel = document.getElementById('btn-master-config-cancel');
    const btnMasterCfgSubmit = document.getElementById('btn-master-config-submit');

    if (btnMasterEnable) btnMasterEnable.addEventListener('click', () => this.openMasterConfigModal('enable'));
    if (btnMasterChange) btnMasterChange.addEventListener('click', () => this.openMasterConfigModal('change'));
    if (btnMasterDisable) btnMasterDisable.addEventListener('click', () => this.openMasterConfigModal('disable'));

    if (btnMasterCfgClose) btnMasterCfgClose.addEventListener('click', () => this.closeMasterConfigModal());
    if (btnMasterCfgCancel) btnMasterCfgCancel.addEventListener('click', () => this.closeMasterConfigModal());
    if (btnMasterCfgSubmit) btnMasterCfgSubmit.addEventListener('click', () => this.submitMasterConfig());

    // Profile Toolbar Actions
    const btnProfDel = document.getElementById('btn-prof-del');
    if (btnProfDel) btnProfDel.addEventListener('click', () => this.deleteCurrentProfile());

    const btnProfSave = document.getElementById('btn-prof-save');
    if (btnProfSave) btnProfSave.addEventListener('click', () => this.saveCurrentProfile());

    // Delete Confirmation Modal Bindings
    const btnDelClose = document.getElementById('btn-delete-modal-close');
    const btnDelCancel = document.getElementById('btn-delete-modal-cancel');
    const btnDelConfirm = document.getElementById('btn-delete-modal-confirm');
    if (btnDelClose) btnDelClose.addEventListener('click', () => this.closeDeleteModal());
    if (btnDelCancel) btnDelCancel.addEventListener('click', () => this.closeDeleteModal());
    if (btnDelConfirm) btnDelConfirm.addEventListener('click', () => this.confirmDeleteCurrentProfile());
    // Import Modal Event Bindings
    const btnImpClose = document.getElementById('btn-import-modal-close');
    const btnImpOk = document.getElementById('btn-import-modal-ok');
    if (btnImpClose) btnImpClose.addEventListener('click', () => this.closeImportModal());
    if (btnImpOk) btnImpOk.addEventListener('click', () => this.closeImportModal());

    // Swatch Palette Selectors
    const swatches = document.querySelectorAll('.swatch-btn');
    swatches.forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-color');
        this.setIdentityColor(hex);
      });
    });

    // Custom HEX Input Field
    const hexInput = document.getElementById('prof-hex-input');
    if (hexInput) {
      hexInput.addEventListener('input', (e) => {
        let hex = e.target.value.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          this.setIdentityColor(hex, false);
        }
      });
    }

    // Auto suggest default ports on protocol change
    const profProto = document.getElementById('prof-protocol');
    if (profProto) {
      profProto.addEventListener('change', (e) => {
        const proto = e.target.value;
        const portField = document.getElementById('prof-port');
        const hostGroup = document.getElementById('group-host');
        const portGroup = document.getElementById('group-port');
        const webdavPathGroup = document.getElementById('group-webdav-path');
        const authGroup = document.getElementById('prof-authtype');
        const keyOption = authGroup ? authGroup.querySelector('option[value="key"]') : null;

        const s3Group = document.getElementById('group-s3-settings');

        if (hostGroup) hostGroup.style.display = proto === 's3' ? 'none' : '';
        if (portGroup) portGroup.style.display = proto === 's3' ? 'none' : '';
        if (s3Group) s3Group.style.display = proto === 's3' ? 'flex' : 'none';

        this.updateFormLabels(proto);

        if (proto === 'sftp') {
          portField.value = '22';
          if (webdavPathGroup) webdavPathGroup.style.display = 'none';
          if (keyOption) keyOption.style.display = '';
        } else if (proto === 'ftp' || proto === 'ftps') {
          portField.value = '21';
          if (webdavPathGroup) webdavPathGroup.style.display = 'none';
          if (keyOption) keyOption.style.display = 'none';
          if (authGroup && authGroup.value === 'key') authGroup.value = 'password';
        } else if (proto === 'webdav') {
          portField.value = '80';
          if (webdavPathGroup) webdavPathGroup.style.display = '';
          if (keyOption) keyOption.style.display = 'none';
          if (authGroup && authGroup.value === 'key') authGroup.value = 'password';
        } else if (proto === 's3') {
          if (webdavPathGroup) webdavPathGroup.style.display = 'none';
          if (keyOption) keyOption.style.display = 'none';
          if (authGroup && authGroup.value === 'key') authGroup.value = 'password';
        }
      });
    }

    const profAuth = document.getElementById('prof-authtype');
    if (profAuth) {
      profAuth.addEventListener('change', (e) => {
        const type = e.target.value;
        const groupPass = document.getElementById('group-password');
        const groupKey = document.getElementById('group-key');
        if (groupPass) groupPass.style.display = type === 'password' ? 'flex' : 'none';
        if (groupKey) groupKey.style.display = type === 'key' ? 'flex' : 'none';
      });
    }

    const btnBrowseKey = document.getElementById('btn-browse-key');
    if (btnBrowseKey) {
      btnBrowseKey.addEventListener('click', async () => {
        const api = this.getApi();
        if (api && api.selectFileOrFolder) {
          const filePath = await api.selectFileOrFolder({
            title: 'Select SSH Private Key File (.pem, .ppk, id_rsa)',
            filters: [
              { name: 'SSH Key Files', extensions: ['pem', 'ppk', 'pub', 'key', '*'] }
            ],
            properties: ['openFile']
          });
          if (filePath) {
            document.getElementById('prof-keypath').value = filePath;
          }
        }
      });
    }
  },

  setIdentityColor(hexColor, updateHexInput = true) {
    this.activeAccentColor = hexColor;
    if (updateHexInput) {
      const hexEl = document.getElementById('prof-hex-input');
      if (hexEl) hexEl.value = hexColor;
    }
    const dot = document.getElementById('prof-hex-dot');
    if (dot) dot.style.backgroundColor = hexColor;

    document.querySelectorAll('.swatch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-color').toUpperCase() === hexColor.toUpperCase());
    });
  },

  openConnectionDialog() {
    this.connModal = document.getElementById('connection-modal');
    if (!this.connModal) return;
    this.connModal.classList.add('active');
    this.renderConnectionProfileList();
  },

  closeConnectionDialog() {
    this.connModal = document.getElementById('connection-modal');
    if (this.connModal) {
      this.connModal.classList.remove('active');
    }
  },

  async renderConnectionProfileList() {
    const api = this.getApi();
    const container = document.getElementById('conn-profile-list');
    if (!api || !container) return;

    try {
      const profiles = await api.profiles.getAll();
      container.innerHTML = '';

      // Update quick connect profile select dropdown in header
      const select = document.getElementById('profile-select');
      if (select) {
        select.innerHTML = '<option value="">-- Select Saved Connection --</option>';
        profiles.forEach(p => {
          const label = `${p.name} (${p.protocol.toUpperCase()}://${p.host}:${p.port || (p.protocol === 'sftp' ? 22 : 21)})`;
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `● ${label}`;
          select.appendChild(opt);
        });
      }

      if (profiles.length === 0) {
        container.innerHTML = '<div style="padding: 12px; color: hsl(var(--text-muted)); font-size: 11px; text-align: center;">No saved profiles. Click ➕ New to create one.</div>';
        this.openNewProfile();
        return;
      }

      profiles.forEach(p => {
        const item = document.createElement('div');
        item.className = `profile-card-item ${p.id === this.activeProfileId ? 'selected' : ''}`;
        const hex = p.accentColor || '#68a063';
        const proto = (p.protocol || 'sftp').toUpperCase();

        item.innerHTML = `
          <span class="profile-dot" style="background-color: ${hex}; width: 10px; height: 10px;"></span>
          <div class="profile-card-info">
            <span class="profile-card-name">${p.name}</span>
            <span class="profile-card-sub">${proto} • ${p.protocol === 'webdav' ? (p.webdavUrl || p.host || '') : p.host}</span>
          </div>
        `;

        item.addEventListener('click', () => {
          document.querySelectorAll('.profile-card-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          this.loadProfileIntoEditor(p);
        });

        item.addEventListener('dblclick', () => {
          this.loadProfileIntoEditor(p);
          this.connectSelectedProfileToTab();
        });

        container.appendChild(item);
      });

      if (!this.activeProfileId && profiles.length > 0) {
        const firstCard = container.querySelector('.profile-card-item');
        if (firstCard) firstCard.click();
      }
    } catch (err) {
      console.error('Failed to load profiles for connection dialog:', err);
    }
  },

  loadProfileIntoEditor(profile) {
    if (!profile) return;
    this.selectedConnectionProfile = profile;
    this.activeProfileId = profile.id;

    const titleEl = document.getElementById('conn-editor-title');
    if (titleEl) titleEl.textContent = `Edit Profile: ${profile.name}`;

    document.getElementById('prof-name').value = profile.name || '';
    document.getElementById('prof-protocol').value = profile.protocol || 'sftp';
    document.getElementById('prof-host').value = profile.host || '';
    document.getElementById('prof-port').value = profile.port || (profile.protocol === 'sftp' ? 22 : 21);
    document.getElementById('prof-username').value = profile.username || '';
    document.getElementById('prof-authtype').value = profile.authType || 'password';
    document.getElementById('prof-password').value = profile.password || '';
    document.getElementById('prof-keypath').value = profile.privateKeyPath || '';

    // WebDAV Path field
    const webdavPathEl = document.getElementById('prof-webdav-path');
    if (webdavPathEl) webdavPathEl.value = profile.webdavPath || profile.webdavUrl || '';

    // S3 Fields
    const s3BucketEl = document.getElementById('prof-s3-bucket');
    const s3RegionEl = document.getElementById('prof-s3-region');
    if (s3BucketEl) s3BucketEl.value = profile.s3Bucket || '';
    if (s3RegionEl) s3RegionEl.value = profile.s3Region || 'us-east-1';

    // Let updateFormLabels manage standard grid visibility rules

    const pTypeEl = document.getElementById('prof-proxy-type');
    const pHostEl = document.getElementById('prof-proxy-host');
    const pPortEl = document.getElementById('prof-proxy-port');
    const pUserEl = document.getElementById('prof-proxy-user');
    const pPassEl = document.getElementById('prof-proxy-pass');
    if (pTypeEl) pTypeEl.value = profile.proxyType || 'none';
    if (pHostEl) pHostEl.value = profile.proxyHost || '';
    if (pPortEl) pPortEl.value = profile.proxyPort || 1080;
    if (pUserEl) pUserEl.value = profile.proxyUsername || '';
    if (pPassEl) pPassEl.value = profile.proxyPassword || '';

    const isKey = profile.authType === 'key';
    const groupPass = document.getElementById('group-password');
    const groupKey = document.getElementById('group-key');
    if (groupPass) groupPass.style.display = isKey ? 'none' : 'flex';
    if (groupKey) groupKey.style.display = isKey ? 'flex' : 'none';

    this.setIdentityColor(profile.accentColor || '#68a063');

    this.updateFormLabels(profile.protocol || 'sftp');

    const btnConnect = document.getElementById('btn-conn-connect');
    if (btnConnect) btnConnect.disabled = false;
  },

  openNewProfile() {
    this.activeProfileId = null;
    this.selectedConnectionProfile = null;

    document.querySelectorAll('.profile-card-item').forEach(el => el.classList.remove('selected'));

    const titleEl = document.getElementById('conn-editor-title');
    if (titleEl) titleEl.textContent = 'Create New Connection Profile';

    document.getElementById('prof-name').value = 'New Connection';
    document.getElementById('prof-protocol').value = 'sftp';
    document.getElementById('prof-host').value = '';
    document.getElementById('prof-port').value = '22';
    document.getElementById('prof-username').value = '';
    document.getElementById('prof-authtype').value = 'password';
    document.getElementById('prof-password').value = '';
    document.getElementById('prof-keypath').value = '';
    const webdavPathNew = document.getElementById('prof-webdav-path');
    if (webdavPathNew) webdavPathNew.value = '';

    // Reset S3 field values

    const s3BucketEl = document.getElementById('prof-s3-bucket');
    const s3RegionEl = document.getElementById('prof-s3-region');
    if (s3BucketEl) s3BucketEl.value = '';
    if (s3RegionEl) s3RegionEl.value = 'us-east-1';

    const pTypeEl = document.getElementById('prof-proxy-type');
    const pHostEl = document.getElementById('prof-proxy-host');
    const pPortEl = document.getElementById('prof-proxy-port');
    const pUserEl = document.getElementById('prof-proxy-user');
    const pPassEl = document.getElementById('prof-proxy-pass');
    if (pTypeEl) pTypeEl.value = 'none';
    if (pHostEl) pHostEl.value = '';
    if (pPortEl) pPortEl.value = '1080';
    if (pUserEl) pUserEl.value = '';
    if (pPassEl) pPassEl.value = '';

    const groupPass = document.getElementById('group-password');
    const groupKey = document.getElementById('group-key');
    if (groupPass) groupPass.style.display = 'flex';
    if (groupKey) groupKey.style.display = 'none';

    this.setIdentityColor('#68a063');

    this.updateFormLabels('sftp');

    const btnConnect = document.getElementById('btn-conn-connect');
    if (btnConnect) btnConnect.disabled = false;
  },

  updateFormLabels(proto) {
    const lblHost = document.getElementById('lbl-prof-host');
    const txtHost = document.getElementById('prof-host');
    const groupPort = document.getElementById('group-port');

    const lblUser = document.getElementById('lbl-prof-username');
    const txtUser = document.getElementById('prof-username');
    const groupAuth = document.getElementById('group-authtype');
    const groupBucket = document.getElementById('group-s3-bucket');

    const lblPass = document.getElementById('lbl-prof-password');
    const txtPass = document.getElementById('prof-password');
    const groupRegion = document.getElementById('group-s3-region');
    const groupWebdavPath = document.getElementById('group-webdav-path');

    if (proto === 's3') {
      if (lblHost) lblHost.textContent = 'S3 Endpoint URL (Optional)';
      if (txtHost) txtHost.placeholder = 'https://nyc3.digitaloceanspaces.com (Default: AWS)';
      if (groupPort) groupPort.style.display = 'none';
      if (groupBucket) groupBucket.style.display = '';

      if (lblUser) lblUser.textContent = 'Access Key ID';
      if (txtUser) txtUser.placeholder = 'AKIAIOSFODNN7EXAMPLE';
      if (groupAuth) groupAuth.style.display = 'none';
      if (groupWebdavPath) groupWebdavPath.style.display = 'none';
      if (groupRegion) groupRegion.style.display = '';

      if (lblPass) lblPass.textContent = 'Secret Access Key';
      if (txtPass) txtPass.placeholder = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    } else {
      if (lblHost) lblHost.textContent = 'Host / IP Address';
      if (txtHost) txtHost.placeholder = 'appvark.com or 192.168.1.100';
      if (groupPort) groupPort.style.display = '';
      if (groupBucket) groupBucket.style.display = 'none';

      if (lblUser) lblUser.textContent = 'Username';
      if (txtUser) txtUser.placeholder = 'root or ubuntu';

      if (proto === 'webdav') {
        if (groupAuth) groupAuth.style.display = 'none';
        if (groupWebdavPath) groupWebdavPath.style.display = '';
      } else {
        if (groupAuth) groupAuth.style.display = '';
        if (groupWebdavPath) groupWebdavPath.style.display = 'none';
      }
      if (groupRegion) groupRegion.style.display = 'none';

      if (lblPass) lblPass.textContent = 'Password';
      if (txtPass) txtPass.placeholder = '••••••••';
    }
  },

  async saveCurrentProfile() {
    const api = this.getApi();
    if (!api) return;

    const currentProtocol = document.getElementById('prof-protocol').value;
    const portVal = parseInt(document.getElementById('prof-port').value, 10);
    const defaultPort = currentProtocol === 'webdav' ? 80 : (currentProtocol === 'ftp' || currentProtocol === 'ftps' ? 21 : 22);
    const validPort = isNaN(portVal) || portVal <= 0 || portVal > 65535 ? defaultPort : portVal;

    const pTypeEl = document.getElementById('prof-proxy-type');
    const pHostEl = document.getElementById('prof-proxy-host');
    const pPortEl = document.getElementById('prof-proxy-port');
    const pUserEl = document.getElementById('prof-proxy-user');
    const pPassEl = document.getElementById('prof-proxy-pass');

    const domPass = document.getElementById('prof-password').value;
    const finalPassword = (domPass !== '') 
      ? domPass 
      : (this.selectedConnectionProfile ? (this.selectedConnectionProfile.password || '') : '');

    const hostVal = document.getElementById('prof-host').value.trim();
    const webdavPathVal = document.getElementById('prof-webdav-path') ? document.getElementById('prof-webdav-path').value.trim() : '';
    const s3BucketVal = document.getElementById('prof-s3-bucket') ? document.getElementById('prof-s3-bucket').value.trim() : '';
    const s3RegionVal = document.getElementById('prof-s3-region') ? document.getElementById('prof-s3-region').value.trim() : 'us-east-1';

    const profile = {
      id: this.activeProfileId,
      name: document.getElementById('prof-name').value.trim() || 'Un-named Connection',
      protocol: currentProtocol,
      host: hostVal,
      port: validPort,
      username: document.getElementById('prof-username').value.trim(),
      authType: document.getElementById('prof-authtype').value,
      password: finalPassword,
      privateKeyPath: document.getElementById('prof-keypath').value,
      webdavPath: webdavPathVal,
      s3Bucket: s3BucketVal,
      s3Region: s3RegionVal,
      accentColor: this.activeAccentColor || '#F59E0B',
      remotePath: (this.selectedConnectionProfile && this.selectedConnectionProfile.remotePath) || '/',
      localPath: (this.selectedConnectionProfile && this.selectedConnectionProfile.localPath) || 'C:\\',
      proxyType: pTypeEl ? pTypeEl.value : 'none',
      proxyHost: pHostEl ? pHostEl.value.trim() : '',
      proxyPort: pPortEl ? (parseInt(pPortEl.value, 10) || 1080) : 1080,
      proxyUsername: pUserEl ? pUserEl.value.trim() : '',
      proxyPassword: pPassEl ? pPassEl.value : ''
    };

    if (profile.protocol !== 's3' && !profile.host) {
      alert('Please specify a Host / IP address.');
      return;
    }
    if (profile.protocol === 's3' && !profile.s3Bucket) {
      alert('Please specify an S3 Bucket Name.');
      return;
    }

    try {
      const saved = await api.profiles.upsert(profile);
      this.activeProfileId = saved.id;
      this.selectedConnectionProfile = saved;

      await this.renderConnectionProfileList();
      this.loadProfileIntoEditor(saved);

      // Apply color live if selected
      if (window.DevsApp) {
        window.DevsApp.applyWorkspaceIdentityAccent(saved.accentColor);
      }

      if (window.LogViewer) window.LogViewer.addEntry('info', `Saved connection profile '${profile.name}' with workspace color ${profile.accentColor}.`);
    } catch (err) {
      console.error('Failed to save connection profile:', err);
      alert(`Failed to save profile: ${err.message}`);
    }
  },

  deleteCurrentProfile() {
    if (!this.activeProfileId) {
      this.openNewProfile();
      return;
    }
    const profName = document.getElementById('prof-name').value || 'Un-named Connection';
    const modal = document.getElementById('delete-modal');
    const nameEl = document.getElementById('delete-modal-profile-name');
    if (nameEl) nameEl.textContent = profName;
    if (modal) modal.classList.add('active');
  },

  closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.remove('active');
  },

  async confirmDeleteCurrentProfile() {
    if (!this.activeProfileId) return;
    const api = this.getApi();
    try {
      await api.profiles.delete(this.activeProfileId);
      this.activeProfileId = null;
      this.closeDeleteModal();
      await this.renderConnectionProfileList();
    } catch (err) {
      console.error('Failed to delete connection profile:', err);
      alert(`Failed to delete connection profile: ${err.message}`);
    }
  },

  showImportDialog(title, headline, message, isError = false) {
    const modal = document.getElementById('import-error-modal');
    const titleEl = document.getElementById('import-modal-title');
    const headlineEl = document.getElementById('import-modal-headline');
    const bodyEl = document.getElementById('import-modal-body');
    const iconEl = document.getElementById('import-modal-icon');
    const badgeEl = document.getElementById('import-modal-badge');

    if (titleEl) titleEl.textContent = title || '📥 Import Notification';
    if (headlineEl) headlineEl.textContent = headline || (isError ? 'Import Error' : 'Import Successful');
    if (bodyEl) bodyEl.textContent = message || '';

    if (badgeEl) {
      if (isError) {
        badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
        badgeEl.style.border = '1px solid #EF4444';
        badgeEl.style.color = '#FCA5A5';
        badgeEl.textContent = 'ERROR';
      } else {
        badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
        badgeEl.style.border = '1px solid #10B981';
        badgeEl.style.color = '#6EE7B7';
        badgeEl.textContent = 'SUCCESS';
      }
    }
    if (iconEl) iconEl.textContent = isError ? '⚠️' : '✓';

    if (modal) modal.classList.add('active');
  },

  closeImportModal() {
    const modal = document.getElementById('import-error-modal');
    if (modal) modal.classList.remove('active');
  },

  async importSSHConfig() {
    const api = this.getApi();
    if (!api || !api.profiles || !api.profiles.importSSHConfig) return;
    try {
      let result = await api.profiles.importSSHConfig();

      // If default ~/.ssh/config was not found, offer native File Picker fallback
      if (result && !result.success && result.error && result.error.includes('file not found')) {
        if (api.selectFileOrFolder) {
          const files = await api.selectFileOrFolder({
            title: 'Select SSH Config File',
            properties: ['openFile']
          });
          if (files && files.length > 0) {
            result = await api.profiles.importSSHConfig(files[0]);
          } else {
            return; // User cancelled file picker
          }
        }
      }

      if (result && result.success) {
        if (result.count > 0) {
          if (window.LogViewer) window.LogViewer.addEntry('info', `✓ Imported ${result.count} profile(s) from SSH config.`);
          this.showImportDialog('📥 SSH Config Import', 'Import Successful', `Successfully imported ${result.count} profile(s) from SSH config!`, false);
          await this.renderConnectionProfileList();
        } else {
          this.showImportDialog('📥 SSH Config Import', 'No Hosts Found', 'No valid SSH host blocks were found in the selected SSH config file.', true);
        }
      } else if (result && result.error) {
        const cleanMsg = result.error.replace(/^Error invoking remote method '[^']+':\s*/, '');
        if (window.LogViewer) window.LogViewer.addEntry('error', `SSH Config Import error: ${cleanMsg}`);
        this.showImportDialog('📥 SSH Config Import Error', 'Failed to Import SSH Config', cleanMsg, true);
      }
    } catch (err) {
      const cleanMsg = err.message ? err.message.replace(/^Error invoking remote method '[^']+':\s*/, '') : String(err);
      if (window.LogViewer) window.LogViewer.addEntry('error', `SSH Config Import error: ${cleanMsg}`);
      this.showImportDialog('📥 SSH Config Import Error', 'Failed to Import SSH Config', cleanMsg, true);
    }
  },

  async connectSelectedProfileToTab() {
    let profile = this.selectedConnectionProfile;

    const currentProtocol = document.getElementById('prof-protocol').value;
    const hostVal = document.getElementById('prof-host').value.trim();
    const webdavPathVal = document.getElementById('prof-webdav-path') ? document.getElementById('prof-webdav-path').value.trim() : '';

    if (hostVal) {
      const portVal = parseInt(document.getElementById('prof-port').value, 10);
      const validPort = isNaN(portVal) || portVal <= 0 || portVal > 65535 ? (currentProtocol === 'webdav' ? 80 : 22) : portVal;

      const pTypeEl = document.getElementById('prof-proxy-type');
      const pHostEl = document.getElementById('prof-proxy-host');
      const pPortEl = document.getElementById('prof-proxy-port');
      const pUserEl = document.getElementById('prof-proxy-user');
      const pPassEl = document.getElementById('prof-proxy-pass');

      const domPass = document.getElementById('prof-password').value;
      const finalPassword = (domPass !== '') 
        ? domPass 
        : (this.selectedConnectionProfile ? (this.selectedConnectionProfile.password || '') : '');

      profile = {
        id: this.activeProfileId || (this.selectedConnectionProfile ? this.selectedConnectionProfile.id : null),
        name: document.getElementById('prof-name').value.trim() || 'Connection Session',
        protocol: currentProtocol,
        host: hostVal,
        port: validPort,
        username: document.getElementById('prof-username').value.trim(),
        authType: document.getElementById('prof-authtype').value,
        password: finalPassword,
        privateKeyPath: document.getElementById('prof-keypath').value,
        webdavPath: webdavPathVal,
        accentColor: this.activeAccentColor || '#68a063',
        remotePath: (this.selectedConnectionProfile && this.selectedConnectionProfile.remotePath) || '/',
        localPath: (this.selectedConnectionProfile && this.selectedConnectionProfile.localPath) || 'C:\\',
        proxyType: pTypeEl ? pTypeEl.value : 'none',
        proxyHost: pHostEl ? pHostEl.value.trim() : '',
        proxyPort: pPortEl ? (parseInt(pPortEl.value, 10) || 1080) : 1080,
        proxyUsername: pUserEl ? pUserEl.value.trim() : '',
        proxyPassword: pPassEl ? pPassEl.value : ''
      };

      const api = this.getApi();
      if (api && api.profiles && api.profiles.upsert) {
        try {
          profile = await api.profiles.upsert(profile);
        } catch (err) {
          console.error('Failed to save profile before connection:', err);
          alert(`Failed to save profile settings: ${err.message}`);
          return;
        }
      }
    } else if (this.selectedConnectionProfile) {
      profile = this.selectedConnectionProfile;
    }

    // Validate
    if (!profile || !profile.host) {
      alert('Please specify a Host / IP address before connecting.');
      return;
    }

    if (!profile.username || profile.username.trim() === '') {
      alert('Please specify a Username before connecting.');
      return;
    }

    this.closeConnectionDialog();

    if (window.SessionManager) {
      // Guard: if this profile already has a live connected session, switch to it instead of opening a duplicate
      const existingSession = window.SessionManager.sessions.find(
        s => s.profileId === profile.id && s.connectionState === 'connected'
      );
      if (existingSession) {
        window.SessionManager.setActiveSession(existingSession.sessionId);
        if (window.LogViewer) {
          window.LogViewer.addEntry('info', `Already connected to "${profile.name || profile.host}" — switched to existing session tab.`);
        }
        return;
      }

      let activeSession = window.SessionManager.getActiveSession();
      if (!activeSession || activeSession.connectionState === 'connected') {
        activeSession = window.SessionManager.createSession(profile, false);
      } else {
        activeSession.profile = { ...profile };
        activeSession.profileId = profile.id;
        activeSession.accentColor = profile.accentColor || '#68a063';
        window.SessionManager.setActiveSession(activeSession.sessionId);
      }
      if (window.connectToProfileSession) {
        try {
          await window.connectToProfileSession(profile, activeSession.sessionId);
        } catch (err) {
          console.error('Failed to initiate connection session:', err);
          if (window.LogViewer) {
            window.LogViewer.addEntry('error', `Failed to start connection to ${profile.name || profile.host}: ${err.message || err}`);
          }
        }
      }
    }
  },

  openPreferences(section = 'general') {
    let targetSection = section;
    if (targetSection === 'profiles' || targetSection === 'appearance') targetSection = 'general';

    try {
      localStorage.setItem('devsftp_preferences_last_section', targetSection);
    } catch (e) {}

    document.querySelectorAll('.pref-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-section') === targetSection);
    });

    document.querySelectorAll('.pref-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `pref-section-${targetSection}`);
    });

    if (targetSection === 'general' && window.updateGeneralBadges) {
      window.updateGeneralBadges();
    }
    if (targetSection === 'security') {
      this.updateMasterSecurityUI();
    }
    if (targetSection === 'transfers' && window.updateTransfersBadges) {
      window.updateTransfersBadges();
    }
    if (targetSection === 'workspace' && window.updateWorkspaceBadges) {
      window.updateWorkspaceBadges();
    }
    if (targetSection === 'terminal' && window.updateTerminalBadges) {
      window.updateTerminalBadges();
    }

    if (this.modal) this.modal.classList.add('active');
  },

  async updateMasterSecurityUI() {
    const api = this.getApi();
    if (!api || !api.profiles || !api.profiles.master) return;

    try {
      const status = await api.profiles.master.getStatus();
      const title = document.getElementById('master-status-title');
      const desc = document.getElementById('master-status-desc');
      const badge = document.getElementById('master-status-badge');
      const btnEnable = document.getElementById('btn-master-enable');
      const btnChange = document.getElementById('btn-master-change');
      const btnDisable = document.getElementById('btn-master-disable');

      if (status && status.enabled) {
        if (title) title.textContent = 'Master Password Protection: Enabled';
        if (desc) desc.textContent = 'Saved profile credentials are encrypted with your secret Master Password (PBKDF2-SHA256).';
        if (badge) {
          badge.textContent = 'Active';
          badge.style.background = 'rgba(16, 185, 129, 0.2)';
          badge.style.color = '#34D399';
        }
        if (btnEnable) btnEnable.style.display = 'none';
        if (btnChange) btnChange.style.display = 'inline-block';
        if (btnDisable) btnDisable.style.display = 'inline-block';
      } else {
        if (title) title.textContent = 'Master Password Protection: Disabled';
        if (desc) desc.textContent = 'Saved profile credentials are currently protected by local key auto-encryption.';
        if (badge) {
          badge.textContent = 'Disabled';
          badge.style.background = 'rgba(100, 116, 139, 0.2)';
          badge.style.color = '#94A3B8';
        }
        if (btnEnable) btnEnable.style.display = 'inline-block';
        if (btnChange) btnChange.style.display = 'none';
        if (btnDisable) btnDisable.style.display = 'none';
      }
    } catch (e) {}
  },

  openMasterConfigModal(mode) {
    this.masterConfigMode = mode; // 'enable', 'change', 'disable'
    const modal = document.getElementById('master-config-modal');
    const title = document.getElementById('master-config-title');
    const enableModeDiv = document.getElementById('master-config-mode-enable');
    const authModeDiv = document.getElementById('master-config-mode-auth');
    const errDiv = document.getElementById('master-config-error');
    const authDesc = document.getElementById('master-config-auth-desc');

    if (!modal) return;
    if (errDiv) errDiv.style.display = 'none';

    const newPass = document.getElementById('master-cfg-new-pass');
    const confirmPass = document.getElementById('master-cfg-confirm-pass');
    const currentPass = document.getElementById('master-cfg-current-pass');

    if (newPass) newPass.value = '';
    if (confirmPass) confirmPass.value = '';
    if (currentPass) currentPass.value = '';

    if (mode === 'enable') {
      if (title) title.textContent = '🔒 Enable Master Password';
      if (enableModeDiv) enableModeDiv.style.display = 'block';
      if (authModeDiv) authModeDiv.style.display = 'none';
      setTimeout(() => { if (newPass) newPass.focus(); }, 100);
    } else if (mode === 'disable') {
      if (title) title.textContent = '🔓 Disable Master Password';
      if (enableModeDiv) enableModeDiv.style.display = 'none';
      if (authModeDiv) authModeDiv.style.display = 'block';
      if (authDesc) authDesc.textContent = 'Enter your current Master Password to disable protection and convert profiles back to local auto-key encryption.';
      setTimeout(() => { if (currentPass) currentPass.focus(); }, 100);
    } else if (mode === 'change') {
      if (title) title.textContent = '🔑 Change Master Password';
      if (enableModeDiv) enableModeDiv.style.display = 'block';
      if (authModeDiv) authModeDiv.style.display = 'block';
      if (authDesc) authDesc.textContent = 'Enter your current Master Password below to confirm this change.';
      setTimeout(() => { if (currentPass) currentPass.focus(); }, 100);
    }

    modal.classList.add('active');
  },

  closeMasterConfigModal() {
    const modal = document.getElementById('master-config-modal');
    if (modal) modal.classList.remove('active');
  },

  async submitMasterConfig() {
    const api = this.getApi();
    if (!api || !api.profiles || !api.profiles.master) return;

    const mode = this.masterConfigMode;
    const newPass = document.getElementById('master-cfg-new-pass') ? document.getElementById('master-cfg-new-pass').value : '';
    const confirmPass = document.getElementById('master-cfg-confirm-pass') ? document.getElementById('master-cfg-confirm-pass').value : '';
    const currentPass = document.getElementById('master-cfg-current-pass') ? document.getElementById('master-cfg-current-pass').value : '';
    const errDiv = document.getElementById('master-config-error');

    if (errDiv) errDiv.style.display = 'none';

    try {
      if (mode === 'enable') {
        if (!newPass) {
          if (errDiv) { errDiv.textContent = '⚠️ Password cannot be empty.'; errDiv.style.display = 'block'; }
          return;
        }
        if (newPass !== confirmPass) {
          if (errDiv) { errDiv.textContent = '⚠️ Passwords do not match.'; errDiv.style.display = 'block'; }
          return;
        }
        await api.profiles.master.enable(newPass);
        this.closeMasterConfigModal();
        this.updateMasterSecurityUI();
        if (window.LogViewer) window.LogViewer.addEntry('info', '🔒 Master Password Protection enabled successfully.');
      } else if (mode === 'disable') {
        if (!currentPass) {
          if (errDiv) { errDiv.textContent = '⚠️ Please enter your current Master Password.'; errDiv.style.display = 'block'; }
          return;
        }
        await api.profiles.master.disable(currentPass);
        this.closeMasterConfigModal();
        this.updateMasterSecurityUI();
        if (window.LogViewer) window.LogViewer.addEntry('warning', '🔓 Master Password Protection disabled.');
      } else if (mode === 'change') {
        if (!currentPass) {
          if (errDiv) { errDiv.textContent = '⚠️ Please enter your current Master Password.'; errDiv.style.display = 'block'; }
          return;
        }
        if (!newPass) {
          if (errDiv) { errDiv.textContent = '⚠️ New password cannot be empty.'; errDiv.style.display = 'block'; }
          return;
        }
        if (newPass !== confirmPass) {
          if (errDiv) { errDiv.textContent = '⚠️ New passwords do not match.'; errDiv.style.display = 'block'; }
          return;
        }
        await api.profiles.master.change(currentPass, newPass);
        this.closeMasterConfigModal();
        this.updateMasterSecurityUI();
        if (window.LogViewer) window.LogViewer.addEntry('info', '🔑 Master Password changed successfully.');
      }
    } catch (err) {
      if (errDiv) {
        errDiv.textContent = `⚠️ ${err.message || err}`;
        errDiv.style.display = 'block';
      }
    }
  },

  openNew() {
    this.openConnectionDialog();
    this.openNewProfile();
  },

  close() {
    if (this.modal) this.modal.classList.remove('active');
  }
};
