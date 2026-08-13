/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Master Password Vault Handler
 */

window.VaultManager = {
  isLocked: true,
  hasMasterPassword: false,

  async init() {
    this.setupListeners();
    await this.checkStatus();
  },

  setupListeners() {
    const unlockForm = document.getElementById('vault-unlock-form');
    if (unlockForm) {
      unlockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passField = document.getElementById('field-unlock-password');
        const errDiv = document.getElementById('vault-unlock-error');
        if (!passField) return;

        errDiv.style.display = 'none';
        const success = await window.devSSH.profiles.master.unlock(passField.value);
        if (success) {
          passField.value = '';
          this.isLocked = false;
          document.getElementById('overlay-vault-lock').classList.remove('active');
          // Trigger profiles list load
          if (window.ProfilesManager) {
            window.ProfilesManager.loadList();
            window.ProfilesManager.loadTunnelSelect();
          }
        } else {
          errDiv.style.display = 'block';
        }
      });
    }

    const settingsBtn = document.getElementById('btn-settings-vault');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettingsModal());
    }

    const settingsClose = document.getElementById('btn-close-vault-settings');
    if (settingsClose) {
      settingsClose.addEventListener('click', () => {
        document.getElementById('overlay-vault-settings').classList.remove('active');
      });
    }

    const settingsForm = document.getElementById('vault-settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveSettings();
      });
    }
  },

  async checkStatus() {
    const status = await window.devSSH.profiles.master.getStatus();
    this.hasMasterPassword = status.enabled;
    this.isLocked = !status.unlocked;

    if (this.isLocked) {
      document.getElementById('overlay-vault-lock').classList.add('active');
      document.getElementById('field-unlock-password').focus();
    } else {
      document.getElementById('overlay-vault-lock').classList.remove('active');
      if (window.ProfilesManager) {
        window.ProfilesManager.loadList();
        window.ProfilesManager.loadTunnelSelect();
      }
    }
  },

  showSettingsModal() {
    const descBox = document.getElementById('vault-settings-desc-box');
    const currentPassGroup = document.getElementById('vault-form-current-pass');
    const newPassGroup = document.getElementById('vault-form-new-pass');
    const confirmPassGroup = document.getElementById('vault-form-confirm-pass');
    const errDiv = document.getElementById('vault-settings-error');

    errDiv.style.display = 'none';
    document.getElementById('field-vault-current-pass').value = '';
    document.getElementById('field-vault-new-pass').value = '';
    document.getElementById('field-vault-confirm-pass').value = '';

    if (this.hasMasterPassword) {
      descBox.innerHTML = `
        <p class="modal-desc">Your credential vault is currently secured with a Master Password.</p>
        <p class="modal-desc" style="color: var(--text-muted); font-size: 12px; margin-top: -12px; margin-bottom: 12px;">
          To disable protection or change your password, fill in the fields below. To disable, leave the "New Password" fields empty.
        </p>
      `;
      currentPassGroup.style.display = 'block';
      newPassGroup.style.display = 'block';
      confirmPassGroup.style.display = 'block';
    } else {
      descBox.innerHTML = `
        <p class="modal-desc">Secure your saved host profiles and SSH key passphrases with AES-256 vault encryption.</p>
      `;
      currentPassGroup.style.display = 'none';
      newPassGroup.style.display = 'block';
      confirmPassGroup.style.display = 'block';
    }

    document.getElementById('overlay-vault-settings').classList.add('active');
  },

  async handleSaveSettings() {
    const currentPass = document.getElementById('field-vault-current-pass').value;
    const newPass = document.getElementById('field-vault-new-pass').value;
    const confirmPass = document.getElementById('field-vault-confirm-pass').value;
    const errDiv = document.getElementById('vault-settings-error');

    errDiv.style.display = 'none';

    if (this.hasMasterPassword) {
      if (!currentPass) {
        errDiv.innerText = 'Current password is required.';
        errDiv.style.display = 'block';
        return;
      }

      if (!newPass) {
        // Disable vault
        try {
          const success = await window.devSSH.profiles.master.disable(currentPass);
          if (success) {
            this.hasMasterPassword = false;
            document.getElementById('overlay-vault-settings').classList.remove('active');
            alert('Master Password has been disabled. Credentials are now stored with a local key.');
          } else {
            errDiv.innerText = 'Incorrect current password.';
            errDiv.style.display = 'block';
          }
        } catch (e) {
          errDiv.innerText = e.message;
          errDiv.style.display = 'block';
        }
      } else {
        // Change password
        if (newPass !== confirmPass) {
          errDiv.innerText = 'New passwords do not match.';
          errDiv.style.display = 'block';
          return;
        }
        try {
          const success = await window.devSSH.profiles.master.change(currentPass, newPass);
          if (success) {
            document.getElementById('overlay-vault-settings').classList.remove('active');
            alert('Master Password has been changed successfully.');
          } else {
            errDiv.innerText = 'Incorrect current password.';
            errDiv.style.display = 'block';
          }
        } catch (e) {
          errDiv.innerText = e.message;
          errDiv.style.display = 'block';
        }
      }
    } else {
      // Enable vault
      if (!newPass) {
        errDiv.innerText = 'New password cannot be empty.';
        errDiv.style.display = 'block';
        return;
      }
      if (newPass !== confirmPass) {
        errDiv.innerText = 'Passwords do not match.';
        errDiv.style.display = 'block';
        return;
      }
      try {
        const success = await window.devSSH.profiles.master.enable(newPass);
        if (success) {
          this.hasMasterPassword = true;
          document.getElementById('overlay-vault-settings').classList.remove('active');
          alert('Master Password vault is now enabled.');
        } else {
          errDiv.innerText = 'Failed to enable vault.';
          errDiv.style.display = 'block';
        }
      } catch (e) {
        errDiv.innerText = e.message;
        errDiv.style.display = 'block';
      }
    }
  }
};
