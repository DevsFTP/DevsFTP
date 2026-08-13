/**
 * Connection Profile Store with AES-256-GCM Encryption & Optional PBKDF2 Master Password Vault
 * Persists saved connection settings securely in app user data.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let app = null;
try {
  app = require('electron').app;
} catch (e) {
  app = null;
}

class ProfileStore {
  constructor() {
    this.userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.devs_userData');
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }

    this.filePath = path.join(this.userDataPath, 'profiles.json');
    this.masterConfigPath = path.join(this.userDataPath, 'master_config.json');

    this.masterConfig = this._loadMasterConfig();
    this.isUnlocked = false;

    this.hasLoadError = false;

    if (this.masterConfig && this.masterConfig.enabled) {
      // Master Password is ON: Require explicit unlock before decrypting profiles
      this.encryptionKey = null;
      this.profiles = [];
    } else {
      // Default Mode: Auto-generated local key
      this.encryptionKey = this._getOrCreateAutoKey(this.userDataPath);
      this.isUnlocked = true;
      this.profiles = this._load();
    }
  }

  _loadMasterConfig() {
    if (!fs.existsSync(this.masterConfigPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.masterConfigPath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  _saveMasterConfig() {
    try {
      if (this.masterConfig) {
        const tempPath = `${this.masterConfigPath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(this.masterConfig, null, 2), 'utf8');
        fs.renameSync(tempPath, this.masterConfigPath);
      } else if (fs.existsSync(this.masterConfigPath)) {
        fs.unlinkSync(this.masterConfigPath);
      }
    } catch (e) {}
  }

  _getOrCreateAutoKey(userDataPath) {
    const keyPath = path.join(userDataPath, '.master_key');
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }

  _deriveKey(password, saltHex) {
    const salt = Buffer.from(saltHex, 'hex');
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  _encryptWithKey(text, key) {
    if (!text || !key) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  _decryptWithKey(encryptedText, key) {
    if (!encryptedText || !key) return '';
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        return encryptedText.includes(':') ? '' : encryptedText; // Legacy unencrypted fallback (Issue 5.3)
      }
      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      return '';
    }
  }

  _encrypt(text) {
    return this._encryptWithKey(text, this.encryptionKey);
  }

  _decrypt(encryptedText) {
    return this._decryptWithKey(encryptedText, this.encryptionKey);
  }

  _load() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      return data.map(p => ({
        accentColor: '#10B981',
        remotePath: '/',
        localPath: 'C:\\',
        ...p,
        password: this._decrypt(p.password),
        passphrase: this._decrypt(p.passphrase)
      }));
    } catch (err) {
      console.error('Error loading connection profiles:', err);
      try {
        const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
        fs.writeFileSync(backupPath, fs.readFileSync(this.filePath));
        console.error(`Backed up corrupted profiles file to: ${backupPath}`);
      } catch (backupErr) {
        console.error('Failed to create corrupted backup file:', backupErr);
      }
      this.hasLoadError = true;
      return [];
    }
  }

  save() {
    if (!this.isUnlocked || !this.encryptionKey) return;
    if (this.hasLoadError) {
      console.error('Blocking save of connection profiles to prevent data loss due to corrupted profiles on disk.');
      return;
    }
    const serialized = this.profiles.map(p => ({
      ...p,
      password: this._encrypt(p.password),
      passphrase: this._encrypt(p.passphrase)
    }));
    const tempPath = this.filePath + '.tmp';
    try {
      fs.writeFileSync(tempPath, JSON.stringify(serialized, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error('Error writing profiles file:', e);
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e2) {}
      throw e;
    }
  }

  // --- Master Password Public API ---

  getMasterStatus() {
    return {
      enabled: Boolean(this.masterConfig && this.masterConfig.enabled),
      unlocked: this.isUnlocked
    };
  }

  unlock(password) {
    if (!this.masterConfig || !this.masterConfig.enabled) {
      this.isUnlocked = true;
      return true;
    }

    try {
      const key = this._deriveKey(password, this.masterConfig.salt);
      const verifierResult = this._decryptWithKey(this.masterConfig.verifier, key);

      if (verifierResult === 'DEVFTP_MASTER_VERIFIER') {
        this.encryptionKey = key;
        this.isUnlocked = true;
        this.profiles = this._load();
        return true;
      }
    } catch (e) {
      console.error('Master key verification/derivation failed:', e);
    }

    return false;
  }

  enableMasterPassword(password) {
    if (!this.isUnlocked) throw new Error('Vault is locked. Unlock before enabling/migrating Master Password.'); // Prevent deleting store (Issue 5.5)
    if (!password) throw new Error('Password cannot be empty');

    const salt = crypto.randomBytes(16).toString('hex');
    const newKey = this._deriveKey(password, salt);
    const verifier = this._encryptWithKey('DEVFTP_MASTER_VERIFIER', newKey);

    // Re-encrypt profiles from old key to new master key
    const currentProfiles = this.isUnlocked ? this.profiles : [];
    this.encryptionKey = newKey;
    this.profiles = currentProfiles;

    this.masterConfig = {
      enabled: true,
      salt,
      verifier
    };

    this._saveMasterConfig();
    this.isUnlocked = true;
    this.save();
    return true;
  }

  disableMasterPassword(currentPassword) {
    if (this.masterConfig && this.masterConfig.enabled) {
      if (!this.unlock(currentPassword)) {
        throw new Error('Incorrect Master Password');
      }
    }

    const autoKey = this._getOrCreateAutoKey(this.userDataPath);
    const currentProfiles = [...this.profiles];

    this.masterConfig = null;
    this._saveMasterConfig();

    this.encryptionKey = autoKey;
    this.profiles = currentProfiles;
    this.isUnlocked = true;
    this.save();
    return true;
  }

  changeMasterPassword(oldPassword, newPassword) {
    if (!newPassword) throw new Error('New Master Password cannot be empty');
    if (!this.unlock(oldPassword)) {
      throw new Error('Incorrect current Master Password');
    }
    return this.enableMasterPassword(newPassword);
  }

  getAll() {
    if (!this.isUnlocked) return [];
    return this.profiles;
  }

  getById(id) {
    if (!this.isUnlocked) return null;
    return this.profiles.find(p => p.id === id);
  }

  upsert(profile) {
    if (!this.isUnlocked) throw new Error('Vault is locked. Enter Master Password first.');
    if (!profile.id) {
      profile.id = 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
    const idx = this.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      const existing = this.profiles[idx];
      const updated = { ...existing, ...profile };
      
      // Preserve existing credentials on import if incoming ones are blank/empty (Issue 5.4)
      if (!profile.password && existing.password) {
        updated.password = existing.password;
      }
      if (!profile.passphrase && existing.passphrase) {
        updated.passphrase = existing.passphrase;
      }
      if (!profile.privateKey && existing.privateKey) {
        updated.privateKey = existing.privateKey;
      }
      
      this.profiles[idx] = updated;
    } else {
      this.profiles.push(profile);
    }
    this.save();
    return profile;
  }

  delete(id) {
    if (!this.isUnlocked) throw new Error('Vault is locked.');
    this.profiles = this.profiles.filter(p => p.id !== id);
    this.save();
    return true;
  }

  exportProfiles() {
    if (!this.isUnlocked) return '[]';
    return JSON.stringify(this.profiles.map(p => ({
      ...p,
      password: '',
      passphrase: ''
    })), null, 2);
  }

  importProfiles(jsonString) {
    if (!this.isUnlocked) return false;
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        imported.forEach(p => this.upsert(p));
        return true;
      }
    } catch (e) {}
    return false;
  }
}

module.exports = ProfileStore;
