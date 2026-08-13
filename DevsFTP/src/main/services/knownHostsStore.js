/**
 * Known SSH Host Keys Store with AES-256-GCM Encryption
 * Securely persists trusted host key fingerprints in app user data to prevent MITM attacks.
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

class KnownHostsStore {
  constructor() {
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.devs_userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.filePath = path.join(userDataPath, 'known_hosts.json');
    this.encryptionKey = this._getOrCreateMasterKey(userDataPath);
    this.hasLoadError = false;
    this.hosts = this._load();
  }

  _getOrCreateMasterKey(userDataPath) {
    const keyPath = path.join(userDataPath, '.master_key');
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }

  _encrypt(text) {
    if (!text) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  _decrypt(encryptedText) {
    if (!encryptedText) return '';
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) return encryptedText;
      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('Failed to decrypt known_hosts file');
      return '';
    }
  }

  _load() {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const decrypted = this._decrypt(raw);
      if (raw && !decrypted) {
        throw new Error('Decryption failed (empty result)');
      }
      return decrypted ? JSON.parse(decrypted) : {};
    } catch (err) {
      console.error('Error loading known host keys:', err);
      try {
        const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
        fs.writeFileSync(backupPath, fs.readFileSync(this.filePath));
        console.error(`Backed up corrupted known_hosts file to: ${backupPath}`);
      } catch (backupErr) {
        console.error('Failed to create corrupted backup file:', backupErr);
      }
      this.hasLoadError = true;
      return {};
    }
  }

  save() {
    if (this.hasLoadError) {
      console.error('Blocking save of known hosts to prevent data loss due to corrupted file on disk.');
      return;
    }
    try {
      const json = JSON.stringify(this.hosts, null, 2);
      const encrypted = this._encrypt(json);
      const tempPath = this.filePath + '.tmp';
      fs.writeFileSync(tempPath, encrypted, 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error('Failed to save known host keys:', e);
    }
  }

  getHostKey(host, port = 22) {
    const key = `${host}:${port}`;
    return this.hosts[key] || null;
  }

  verifyHostKey(host, port, fingerprint) {
    const existing = this.getHostKey(host, port);
    if (!existing) {
      return { status: 'UNKNOWN', storedFingerprint: null };
    }
    if (existing.fingerprint === fingerprint) {
      return { status: 'MATCH', storedFingerprint: existing.fingerprint };
    }
    return { status: 'CHANGED', storedFingerprint: existing.fingerprint };
  }

  saveHostKey(host, port = 22, fingerprint, algorithm = 'ssh-rsa') {
    const key = `${host}:${port}`;
    this.hosts[key] = {
      host,
      port,
      fingerprint,
      algorithm,
      firstSeen: this.hosts[key] ? this.hosts[key].firstSeen : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.hosts[key];
  }

  clear() {
    this.hosts = {};
    this.save();
  }
}

module.exports = KnownHostsStore;
