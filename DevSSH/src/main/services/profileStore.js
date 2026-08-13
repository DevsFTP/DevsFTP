/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Connection Profile Store with AES-256-GCM Encryption & PBKDF2 Master Password
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
    this.userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.devssh_userData');
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }

    this.filePath = path.join(this.userDataPath, 'profiles.json');
    this.masterConfigPath = path.join(this.userDataPath, 'master_config.json');

    this.masterConfig = this._loadMasterConfig();
    this.isUnlocked = false;
    this.hasLoadError = false;

    if (this.masterConfig && this.masterConfig.enabled) {
      this.encryptionKey = null;
      this.profiles = [];
    } else {
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
        fs.writeFileSync(this.masterConfigPath, JSON.stringify(this.masterConfig, null, 2), 'utf8');
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
      if (parts.length !== 3) return '';
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
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      return data.map(p => ({
        accentColor: '#3B82F6',
        ...p,
        password: this._decrypt(p.password),
        passphrase: this._decrypt(p.passphrase)
      }));
    } catch (err) {
      console.error('Error loading profiles:', err);
      this.hasLoadError = true;
      return [];
    }
  }

  save() {
    if (!this.isUnlocked || !this.encryptionKey) return;
    if (this.hasLoadError) return;
    const serialized = this.profiles.map(p => ({
      ...p,
      password: this._encrypt(p.password),
      passphrase: this._encrypt(p.passphrase)
    }));
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(serialized, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving profiles:', e);
    }
  }

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
      if (verifierResult === 'DEVSSH_MASTER_VERIFIER') {
        this.encryptionKey = key;
        this.isUnlocked = true;
        this.profiles = this._load();
        return true;
      }
    } catch (e) {
      console.error('Master password unlock failed:', e);
    }
    return false;
  }

  enableMasterPassword(password) {
    if (!this.isUnlocked) throw new Error('Unlock vault first.');
    if (!password) throw new Error('Password cannot be empty');

    const salt = crypto.randomBytes(16).toString('hex');
    const newKey = this._deriveKey(password, salt);
    const verifier = this._encryptWithKey('DEVSSH_MASTER_VERIFIER', newKey);

    const currentProfiles = [...this.profiles];
    this.encryptionKey = newKey;
    this.profiles = currentProfiles;
    this.masterConfig = { enabled: true, salt, verifier };

    this._saveMasterConfig();
    this.isUnlocked = true;
    this.save();
    return true;
  }

  disableMasterPassword(password) {
    if (this.masterConfig && this.masterConfig.enabled) {
      if (!this.unlock(password)) throw new Error('Incorrect password');
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
    if (!this.unlock(oldPassword)) throw new Error('Incorrect password');
    return this.enableMasterPassword(newPassword);
  }

  getAll() {
    if (!this.isUnlocked) return [];
    return this.profiles;
  }

  upsert(profile) {
    if (!this.isUnlocked) throw new Error('Vault is locked.');
    if (!profile.id) {
      profile.id = 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
    const idx = this.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      const existing = this.profiles[idx];
      const updated = { ...existing, ...profile };
      if (!profile.password && existing.password) updated.password = existing.password;
      if (!profile.passphrase && existing.passphrase) updated.passphrase = existing.passphrase;
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
