/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * SSH Config Parser Service
 * Parses ~/.ssh/config files to import hosts.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function expandHomePath(filepath) {
  if (!filepath) return '';
  const trimmed = filepath.trim().replace(/^["']|["']$/g, '');
  if (trimmed.startsWith('~/') || trimmed === '~') {
    return path.join(os.homedir(), trimmed.slice(1));
  }
  return trimmed;
}

function parseSSHConfigText(configText) {
  if (!configText || typeof configText !== 'string') return [];

  const lines = configText.split(/\r?\n/);
  const profiles = [];
  let currentBlock = null;

  const saveCurrentBlock = () => {
    if (!currentBlock || !currentBlock.aliases || currentBlock.aliases.length === 0) return;

    currentBlock.aliases.forEach(alias => {
      if (alias.includes('*') || alias.includes('?')) return;

      const targetHost = currentBlock.hostName || alias;
      const keyPath = currentBlock.identityFile ? expandHomePath(currentBlock.identityFile) : '';
      const profileId = `prof_ssh_${crypto.createHash('md5').update(`${alias}_${targetHost}`).digest('hex').substring(0, 8)}`;

      profiles.push({
        id: profileId,
        name: alias,
        host: targetHost,
        port: parseInt(currentBlock.port || 22, 10),
        username: currentBlock.user || '',
        authType: keyPath ? 'key' : 'password',
        password: '',
        privateKeyPath: keyPath,
        passphrase: '',
        accentColor: '#3B82F6'
      });
    });
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = trimmed.match(/^([A-Za-z0-9_]+)[\s=]+(.+)$/);
    if (!match) return;

    const key = match[1].toLowerCase();
    const value = match[2].trim().replace(/^["']|["']$/g, '');

    if (key === 'host') {
      saveCurrentBlock();
      const aliases = value.split(/\s+/).filter(a => a.length > 0);
      currentBlock = {
        aliases,
        hostName: '',
        user: '',
        port: '22',
        identityFile: ''
      };
    } else if (currentBlock) {
      if (key === 'hostname') {
        currentBlock.hostName = value;
      } else if (key === 'user') {
        currentBlock.user = value;
      } else if (key === 'port') {
        currentBlock.port = value;
      } else if (key === 'identityfile') {
        if (!currentBlock.identityFile) {
          currentBlock.identityFile = value;
        }
      }
    }
  });

  saveCurrentBlock();
  return profiles;
}

function getDefaultSSHConfigPath() {
  const userHome = os.homedir();
  const defaultPath = path.join(userHome, '.ssh', 'config');
  if (fs.existsSync(defaultPath)) return defaultPath;

  const sysPath = process.platform === 'win32' ? 'C:\\ProgramData\\ssh\\ssh_config' : '/etc/ssh/ssh_config';
  if (fs.existsSync(sysPath)) return sysPath;

  return defaultPath;
}

function parseSSHConfigFile(filePath = null) {
  const targetPath = filePath || getDefaultSSHConfigPath();
  if (!fs.existsSync(targetPath)) {
    throw new Error(`SSH config file not found at ${targetPath}`);
  }
  const content = fs.readFileSync(targetPath, 'utf8');
  return parseSSHConfigText(content);
}

module.exports = {
  parseSSHConfigText,
  parseSSHConfigFile,
  getDefaultSSHConfigPath
};
