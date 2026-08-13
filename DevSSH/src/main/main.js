/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Main Electron Process
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const ProfileStore = require('./services/profileStore');
const SSHTerminalService = require('./services/sshTerminalService');
const TunnelService = require('./services/tunnelService');
const { parseSSHConfigFile, getDefaultSSHConfigPath } = require('./services/sshConfigParser');

let mainWindow = null;
let profileStore = null;
let tunnelService = null;
const terminalSessions = new Map(); // sessionId -> SSHTerminalService

// Track active host key approvals pending
const pendingHostKeyVerifications = new Map(); // hostKeyToken -> resolveFn

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'DevSSH — High-Performance SSH Terminal',
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    // Disconnect all sessions on exit
    for (const [id, session] of terminalSessions.entries()) {
      session.disconnect();
    }
    terminalSessions.clear();
    
    // Stop all tunnels on exit
    if (tunnelService) {
      for (const t of tunnelService.listTunnels()) {
        tunnelService.stopTunnel(t.id);
      }
    }
    
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  profileStore = new ProfileStore();
  tunnelService = new TunnelService();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- IPC Profiles Handlers ---
ipcMain.handle('profiles:get-all', () => {
  return profileStore.getAll();
});

ipcMain.handle('profiles:upsert', (event, profile) => {
  return profileStore.upsert(profile);
});

ipcMain.handle('profiles:delete', (event, id) => {
  return profileStore.delete(id);
});

ipcMain.handle('profiles:export', () => {
  return profileStore.exportProfiles();
});

ipcMain.handle('profiles:import', (event, jsonString) => {
  return profileStore.importProfiles(jsonString);
});

ipcMain.handle('profiles:import-ssh-config', (event, filePath) => {
  try {
    const profiles = parseSSHConfigFile(filePath);
    profiles.forEach(p => profileStore.upsert(p));
    return { success: true, count: profiles.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('profiles:master-status', () => {
  return profileStore.getMasterStatus();
});

ipcMain.handle('profiles:master-unlock', (event, password) => {
  return profileStore.unlock(password);
});

ipcMain.handle('profiles:master-enable', (event, password) => {
  return profileStore.enableMasterPassword(password);
});

ipcMain.handle('profiles:master-disable', (event, password) => {
  return profileStore.disableMasterPassword(password);
});

ipcMain.handle('profiles:master-change', (event, oldPassword, newPassword) => {
  try {
    return profileStore.changeMasterPassword(oldPassword, newPassword);
  } catch (e) {
    return false;
  }
});

// --- IPC SSH Terminal Handlers ---
ipcMain.handle('ssh:terminal-connect', async (event, config, sessionId) => {
  if (terminalSessions.has(sessionId)) {
    terminalSessions.get(sessionId).disconnect();
  }

  const session = new SSHTerminalService(mainWindow, sessionId);
  terminalSessions.set(sessionId, session);

  // Host Key verification broker
  const verifyHostKey = (data) => {
    return new Promise((resolve) => {
      const token = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      pendingHostKeyVerifications.set(token, resolve);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ssh:host-key-verify-request', {
          token,
          host: data.host,
          port: data.port,
          fingerprint: data.fingerprint
        });
      } else {
        resolve(false);
      }
    });
  };

  try {
    await session.connect(config, verifyHostKey);
    return { success: true };
  } catch (err) {
    terminalSessions.delete(sessionId);
    return { success: false, error: err.message };
  }
});

ipcMain.on('ssh:terminal-write', (event, data, sessionId) => {
  const session = terminalSessions.get(sessionId);
  if (session) {
    session.write(data);
  }
});

ipcMain.on('ssh:terminal-resize', (event, size, sessionId) => {
  const session = terminalSessions.get(sessionId);
  if (session) {
    session.resize(size.cols, size.rows);
  }
});

ipcMain.handle('ssh:terminal-disconnect', (event, sessionId) => {
  const session = terminalSessions.get(sessionId);
  if (session) {
    session.disconnect();
    terminalSessions.delete(sessionId);
  }
  return true;
});

ipcMain.on('ssh:host-key-verify-response', (event, response) => {
  const { token, approved } = response || {};
  const resolve = pendingHostKeyVerifications.get(token);
  if (resolve) {
    resolve(Boolean(approved));
    pendingHostKeyVerifications.delete(token);
  }
});

// --- IPC Tunnel Handlers ---
ipcMain.handle('tunnel:start', async (event, rule) => {
  try {
    const onLog = (type, message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tunnel:log', {
          tunnelId: rule.id,
          type,
          message,
          timestamp: Date.now()
        });
      }
    };
    await tunnelService.startTunnel(rule, onLog);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('tunnel:stop', async (event, tunnelId) => {
  await tunnelService.stopTunnel(tunnelId);
  return { success: true };
});

ipcMain.handle('tunnel:list', () => {
  return tunnelService.listTunnels();
});

// --- IPC System Handlers ---
ipcMain.handle('dialog:select-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    ...options
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('dialog:save-file', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    ...options
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  return result.filePath;
});

ipcMain.handle('system:open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.on('system:quit', () => {
  app.quit();
});
