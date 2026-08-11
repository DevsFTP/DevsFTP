/**
 * DevsFTP — Remote Development Workspace
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * DevsFTP Main Process Entry Point
 * Electron App Lifecycle, Secure Window Management, and IPC Routing.
 */

process.on('uncaughtException', (err) => {
  writeDebugLog({
    scope: 'main',
    event: 'uncaughtException',
    level: 'error',
    message: err && err.message ? err.message : 'Uncaught exception',
    error: err
  });
  console.error('Main Process Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  writeDebugLog({
    scope: 'main',
    event: 'unhandledRejection',
    level: 'error',
    message: 'Unhandled promise rejection',
    error: reason
  });
  console.error('Main Process Unhandled Rejection:', reason);
});

const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, Tray, Menu, Notification, nativeTheme } = require('electron');
app.setName('DevsFTP');
if (process.platform === 'win32') {
  app.setAppUserModelId('DevsFTP');
}
let appTray = null;

nativeTheme.on('updated', () => {
  try {
    const updatedIconPath = getAppIconPath();
    if (updatedIconPath && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(updatedIconPath);
    }
    if (updatedIconPath && appTray && !appTray.isDestroyed()) {
      appTray.setImage(updatedIconPath);
    }
  } catch (e) {}
});
const path = require('path');
const fs = require('fs');
const os = require('os');

app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar,FluentScrollbar');

const ProfileStore = require('./services/profileStore');
const KnownHostsStore = require('./services/knownHostsStore');
const SFTPService = require('./services/sftpService');
const FTPService = require('./services/ftpService');
const WebDAVService = require('./services/webdavService');
const SSHTerminalService = require('./services/sshTerminalService');
const CacheWatcherService = require('./services/cacheWatcherService');
const tunnelService = require('./services/tunnelService');
const ScheduledJobStore = require('./services/scheduledJobStore');
const JobRunnerService = require('./services/jobRunnerService');
const TransferEngine = require('./services/transfer/transferEngine');
const { parseSSHConfigFile } = require('./services/sshConfigParser');
const { normalizePOSIXPath } = require('./services/pathUtils');

const ExclusionService = require('./services/exclusionService');

let mainWindow = null;
let profileStore = null;
let knownHostsStore = null;
let scheduledJobStore = null;
let jobRunnerService = null;
let transferEngine = null;
let activeConfig = null;
let sshTerminalService = null;
let cacheWatcherService = null;
let exclusionService = null;

function redactSensitiveText(text) {
  return String(text)
    .replace(/(password|passphrase|secret|token)[:=]\s*\S+/gi, '$1: [REDACTED]')
    .replace(/-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]');
}

function isSafeLocalPath(targetPath) {
  if (!targetPath) return false;
  const resolved = path.resolve(targetPath);
  const lower = resolved.toLowerCase();
  
  // Prevent deleting system or root directories (Issue 13.1)
  if (lower === 'c:\\' || lower === 'c:' || lower === 'd:\\' || lower === 'd:' || resolved === '/') return false;
  if (lower.startsWith('c:\\windows') || lower.startsWith('c:\\program files')) return false;
  
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  if (userHome && lower === path.resolve(userHome).toLowerCase()) return false;
  
  return true;
}

function stringifyDiagnosticValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return redactSensitiveText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) {
    return redactSensitiveText(value.stack || value.message || String(value));
  }
  if (typeof value === 'function') return '[Function]';
  if (typeof value !== 'object') return redactSensitiveText(String(value));
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  try {
    return JSON.stringify(value, (key, nestedValue) => {
      if (nestedValue instanceof Error) {
        return {
          name: nestedValue.name,
          message: nestedValue.message,
          stack: nestedValue.stack
        };
      }
      if (typeof nestedValue === 'string') {
        if (/password|passphrase|secret|token|private key/i.test(key)) {
          return '[REDACTED]';
        }
        return redactSensitiveText(nestedValue);
      }
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        if (seen.has(nestedValue)) return '[Circular]';
        seen.add(nestedValue);
      }
      return nestedValue;
    }, 2);
  } catch (e) {
    return redactSensitiveText(String(value));
  }
}

function formatDiagnosticEntry(entry) {
  if (entry instanceof Error) {
    return redactSensitiveText(entry.stack || entry.message || String(entry));
  }
  if (typeof entry === 'string') {
    return redactSensitiveText(entry);
  }
  if (entry && typeof entry === 'object') {
    const scope = entry.scope || entry.source || 'app';
    const event = entry.event || entry.stage || entry.type || 'log';
    const level = entry.level || 'info';
    const message = entry.message || entry.msg || '';
    const details = entry.details !== undefined ? ` | details=${stringifyDiagnosticValue(entry.details)}` : '';
    const error = entry.error ? ` | error=${stringifyDiagnosticValue(entry.error)}` : '';
    const stack = entry.stack ? ` | stack=${redactSensitiveText(entry.stack)}` : '';
    return `[${scope}] [${event}] [${level}] ${redactSensitiveText(message)}${details}${error}${stack}`.trim();
  }
  return redactSensitiveText(String(entry));
}

function appendDiagnosticLine(line) {
  try {
    const time = new Date().toLocaleTimeString();
    const normalized = String(line).endsWith('\n') ? String(line) : `${line}\n`;
    const formatted = `[${time}] ${normalized}`;
    
    // Attempt writing to working directory (may restrict this - Issue 13.4)
    try {
      const logPath1 = path.join(process.cwd(), 'devsftp-debug.log');
      fs.appendFileSync(logPath1, formatted);
    } catch (e1) {
      console.warn('Failed to write diagnostics to working directory:', e1.message);
    }

    if (app) {
      try {
        const logPath2 = path.join(app.getPath('userData'), 'devsftp-debug.log');
        fs.appendFileSync(logPath2, formatted);
      } catch (e2) {
        // Fallback for crash handler write failures (Issue 14.4)
        console.error('Failed to write diagnostics to AppData directory:', e2.message);
      }
    }
  } catch (e) {}
}

function writeDebugLog(entry) {
  appendDiagnosticLine(formatDiagnosticEntry(entry));
}

function registerLoggedHandle(channel, handler) {
  ipcMain.handle(channel, async (...args) => {
    const ipcArgs = args.slice(1);
    const start = Date.now();
    writeDebugLog({
      scope: 'ipc',
      event: channel,
      level: 'info',
      message: 'request',
      details: ipcArgs
    });
    try {
      const result = await handler(...args);
      writeDebugLog({
        scope: 'ipc',
        event: channel,
        level: 'info',
        message: `success (${Date.now() - start}ms)`,
        details: result
      });
      return result;
    } catch (error) {
      writeDebugLog({
        scope: 'ipc',
        event: channel,
        level: 'error',
        message: `failure (${Date.now() - start}ms)`,
        error
      });
      throw error;
    }
  });
}

function registerLoggedOn(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    const start = Date.now();
    writeDebugLog({
      scope: 'ipc',
      event: channel,
      level: 'info',
      message: 'request',
      details: args
    });
    try {
      const result = listener(event, ...args);
      writeDebugLog({
        scope: 'ipc',
        event: channel,
        level: 'info',
        message: `success (${Date.now() - start}ms)`,
        details: result
      });
      return result;
    } catch (error) {
      writeDebugLog({
        scope: 'ipc',
        event: channel,
        level: 'error',
        message: `failure (${Date.now() - start}ms)`,
        error
      });
      throw error;
    }
  });
}

function sanitizeLogMessage(message) {
  if (!message) return '';
  // Redact passwords, tokens, or private key data from log stream
  return String(message)
    .replace(/(password|passphrase|secret|token)[:=]\s*\S+/gi, '$1: [REDACTED]')
    .replace(/-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]');
}

function sendLog(type, message) {
  writeDebugLog({
    scope: 'main',
    event: 'sendLog',
    level: type || 'info',
    message
  });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log:message', {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message: sanitizeLogMessage(message)
    });
  }
}

function createSystemTray() {
  if (appTray) return;
  const resTrayPng = path.join(process.resourcesPath, 'assets/branding/tray_icon.png');
  const asarTrayPng = path.join(__dirname, '../../assets/branding/tray_icon.png');
  
  const trayPath = fs.existsSync(resTrayPng) ? resTrayPng : (fs.existsSync(asarTrayPng) ? asarTrayPng : null);
  if (!trayPath) return;

  try {
    const trayImg = nativeImage.createFromPath(trayPath);
    if (trayImg.isEmpty()) return;
    appTray = new Tray(trayImg);
    appTray.setToolTip('DevsFTP — The SFTP & FTP Client for Windows');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🖥 Open DevsFTP',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: '🔌 Disconnect Active Sessions',
        click: () => {
          for (const [, item] of activeSessions.entries()) {
            if (item && item.session) item.session.disconnect();
          }
          activeSessions.clear();
          sendLog('warning', 'All active sessions disconnected via System Tray.');
        }
      },
      { type: 'separator' },
      {
        label: '❌ Exit DevsFTP',
        click: () => {
          for (const item of activeSessions.values()) {
            if (item && item.session) item.session.disconnect();
          }
          activeSessions.clear();
          app.quit();
        }
      }
    ]);

    appTray.setContextMenu(contextMenu);
    appTray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    console.error('System Tray creation error:', e);
  }
}

function getNotificationIconPath() {
  try {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
    const diskNotifPath = path.join(userDataDir, 'notification_icon.png');
    
    // Check 1: Unpacked resources directory (native OS access)
    const resPng = path.join(process.resourcesPath, 'assets/branding/notification_icon.png');
    // Check 2: App ASAR or local dev directory
    const asarPng = path.join(__dirname, '../../assets/branding/notification_icon.png');
    
    let srcPng = null;
    if (fs.existsSync(resPng)) {
      srcPng = resPng;
    } else if (fs.existsSync(asarPng)) {
      srcPng = asarPng;
    }
    
    if (srcPng) {
      const buf = fs.readFileSync(srcPng);
      fs.writeFileSync(diskNotifPath, buf);
      return diskNotifPath;
    } else if (fs.existsSync(diskNotifPath)) {
      return diskNotifPath;
    }
  } catch (e) {
    console.error('getNotificationIconPath error:', e);
  }
  return undefined;
}

function sendOSNotification(title, body) {
  if (!Notification.isSupported()) return;
  const notifIconPath = getNotificationIconPath();
  try {
    const notif = new Notification({
      title: title || 'DevsFTP',
      body: body || '',
      icon: notifIconPath
    });
    notif.show();
  } catch (e) {
    console.error('Notification error:', e);
  }
}

function getAppIconPath() {
  try {
    const isDark = nativeTheme ? nativeTheme.shouldUseDarkColors : true;
    const iconName = isDark ? 'icon_light.png' : 'icon_dark.png';

    const resPng = path.join(process.resourcesPath, 'assets/branding', iconName);
    if (fs.existsSync(resPng)) return nativeImage.createFromPath(resPng);

    const devPng = path.join(__dirname, '../../assets/branding', iconName);
    if (fs.existsSync(devPng)) return nativeImage.createFromPath(devPng);

    const devIco = path.join(__dirname, '../../assets/icon.ico');
    if (fs.existsSync(devIco)) return nativeImage.createFromPath(devIco);
  } catch (e) {}
  return undefined;
}

function createWindow() {
  writeDebugLog({
    scope: 'main',
    event: 'window creation',
    level: 'info',
    message: 'Creating BrowserWindow',
    details: { width: 1380, height: 880 }
  });
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1020,
    minHeight: 680,
    title: 'DevsFTP — The SFTP & FTP Client for Windows',
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    backgroundColor: '#111315',
    show: false
  });

  mainWindow.setMenuBarVisibility(false);

  const rendererPath = path.join(__dirname, '../renderer/index.html');
  writeDebugLog({
    scope: 'main',
    event: 'window creation',
    level: 'info',
    message: 'Loading renderer',
    details: rendererPath
  });
  mainWindow.loadFile(rendererPath).catch((error) => {
    writeDebugLog({
      scope: 'main',
      event: 'window creation',
      level: 'error',
      message: 'Renderer loadFile failed',
      error
    });
  });

  mainWindow.once('ready-to-show', () => {
    writeDebugLog({
      scope: 'main',
      event: 'window ready-to-show',
      level: 'info',
      message: 'Main window is ready to show'
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Guarantee window visibility fallback if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 600);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    writeDebugLog({
      scope: 'main',
      event: 'renderer did-finish-load',
      level: 'info',
      message: 'Renderer finished loading'
    });
    mainWindow.webContents.send('cache:debug-event', {
      stage: 'INIT',
      msg: '[DEBUG SYSTEM ONLINE]',
      details: { timestamp: new Date().toISOString() }
    });
    setTimeout(() => {
      if (cacheWatcherService && mainWindow && !mainWindow.isDestroyed()) {
        cacheWatcherService.recoverWatchersOnStartup(mainWindow);
      }
    }, 1200);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    writeDebugLog({
      scope: 'main',
      event: 'renderer did-fail-load',
      level: 'error',
      message: errorDescription,
      details: { errorCode, validatedURL, isMainFrame }
    });
  });

  exclusionService = new ExclusionService();
  profileStore = new ProfileStore();
  knownHostsStore = new KnownHostsStore();
  transferEngine = new TransferEngine(mainWindow, sendLog);
  scheduledJobStore = new ScheduledJobStore();
  jobRunnerService = new JobRunnerService(mainWindow, scheduledJobStore, profileStore, sendLog);
  jobRunnerService.start();
  cacheWatcherService = new CacheWatcherService(mainWindow);
  if (transferEngine) transferEngine.cacheWatcherService = cacheWatcherService;
  sshTerminalService = new SSHTerminalService(mainWindow);
}

async function handleHostKeyVerification({ host, port, fingerprint }) {
  if (!knownHostsStore) return true;
  const check = knownHostsStore.verifyHostKey(host, port, fingerprint);
  if (check.status === 'MATCH') {
    return true;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    return new Promise((resolve) => {
      const requestId = 'hk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      
      const onResponse = (_event, response) => {
        if (response && response.requestId === requestId) {
          clearTimeout(timeout);
          ipcMain.removeListener('ssh:host-key-verify-response', onResponse);
          mainWindow.off('closed', cleanupOnWindowReloadOrClose);
          mainWindow.webContents.off('did-start-navigation', cleanupOnWindowReloadOrClose);

          if (response.action === 'trust_always') {
            knownHostsStore.saveHostKey(host, port, fingerprint);
            sendLog('info', `Trusted & encrypted new SSH host key for ${host}:${port}`);
            resolve(true);
          } else if (response.action === 'trust_once') {
            sendLog('info', `Temporarily trusted SSH host key for ${host}:${port}`);
            resolve(true);
          } else {
            sendLog('warning', `SSH Host key verification rejected by user for ${host}:${port}`);
            resolve(false);
          }
        }
      };

      const timeout = setTimeout(() => {
        ipcMain.removeListener('ssh:host-key-verify-response', onResponse);
        mainWindow.off('closed', cleanupOnWindowReloadOrClose);
        mainWindow.webContents.off('did-start-navigation', cleanupOnWindowReloadOrClose);
        sendLog('warning', `Host key verification request timed out for ${host}:${port}`);
        resolve(false);
      }, 60000);

      const cleanupOnWindowReloadOrClose = () => {
        clearTimeout(timeout);
        ipcMain.removeListener('ssh:host-key-verify-response', onResponse);
        resolve(false);
      };

      mainWindow.once('closed', cleanupOnWindowReloadOrClose);
      mainWindow.webContents.once('did-start-navigation', cleanupOnWindowReloadOrClose);

      ipcMain.on('ssh:host-key-verify-response', onResponse);

      mainWindow.webContents.send('ssh:host-key-verify-request', {
        requestId,
        host,
        port,
        fingerprint,
        status: check.status,
        storedFingerprint: check.storedFingerprint
      });
    });
  }
  return false;
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  writeDebugLog({
    scope: 'main',
    event: 'startup',
    level: 'info',
    message: 'Application bootstrap complete'
  });
  app.whenReady().then(() => {
    writeDebugLog({
      scope: 'main',
      event: 'app ready',
      level: 'info',
      message: 'Electron app is ready'
    });

    createWindow();
    createSystemTray();
  });
}

app.on('before-quit', () => {
  writeDebugLog({
    scope: 'main',
    event: 'before-quit',
    level: 'info',
    message: 'Teardown services and timers'
  });

  // 14.1 Graceful Transfer Shutdown
  if (transferEngine && transferEngine.queue) {
    const active = transferEngine.queue.filter(q => q.status === 'Running' || q.status === 'In Progress' || q.status === 'Verifying');
    active.forEach(task => {
      task.status = 'Waiting to Resume';
      task.speed = '0 KB/s';
      if (!task.resumeOffset && task.bytesTransferred) {
        task.resumeOffset = task.bytesTransferred;
      }
    });
    transferEngine._saveQueue();
  }

  // 14.2 Timer Teardowns
  if (jobRunnerService && typeof jobRunnerService.stop === 'function') {
    try {
      jobRunnerService.stop();
    } catch (err) {}
  }

  // 14.3 Tunnel Teardowns
  if (tunnelService && typeof tunnelService.stopAll === 'function') {
    try {
      tunnelService.tunnels.forEach((t, id) => {
        if (t.localServer) {
          try { t.localServer.close(); } catch (err) {}
        }
        if (t.activeSockets) {
          for (const s of t.activeSockets) {
            try { s.destroy(); } catch (err) {}
          }
        }
        if (t.sshClient) {
          try { t.sshClient.end(); } catch (err) {}
        }
      });
    } catch (err) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    for (const item of activeSessions.values()) {
      if (item && item.session) item.session.disconnect();
    }
    activeSessions.clear();
    if (sshTerminalService) sshTerminalService.disconnect();
    app.quit();
  }
});

ipcMain.on('debug:log-append', (_event, msg) => {
  writeDebugLog(msg);
});

ipcMain.on('diagnostic:log', (_event, entry) => {
  writeDebugLog(entry);
});

// Profiles IPC
registerLoggedHandle('profiles:get-all', async () => {
  return profileStore.getAll();
});

registerLoggedHandle('profiles:upsert', async (_event, profile) => {
  return profileStore.upsert(profile);
});

registerLoggedHandle('profiles:delete', async (_event, id) => {
  return profileStore.delete(id);
});

registerLoggedHandle('profiles:export', async () => {
  return profileStore.exportProfiles();
});

registerLoggedHandle('profiles:import', async (_event, jsonString) => {
  const success = profileStore.importProfiles(jsonString);
  if (success) sendLog('info', 'Successfully imported saved profiles.');
  return success;
});

// Master Password Vault IPC
registerLoggedHandle('profiles:master-status', async () => {
  return profileStore.getMasterStatus();
});

registerLoggedHandle('profiles:master-unlock', async (_event, password) => {
  return profileStore.unlock(password);
});

registerLoggedHandle('profiles:master-enable', async (_event, password) => {
  return profileStore.enableMasterPassword(password);
});

registerLoggedHandle('profiles:master-disable', async (_event, password) => {
  return profileStore.disableMasterPassword(password);
});

registerLoggedHandle('profiles:master-change', async (_event, oldPassword, newPassword) => {
  return profileStore.changeMasterPassword(oldPassword, newPassword);
});

registerLoggedHandle('profiles:import-ssh-config', async (_event, customFilePath = null) => {
  try {
    const importedProfiles = parseSSHConfigFile(customFilePath);
    if (!importedProfiles || importedProfiles.length === 0) {
      return { success: true, count: 0, profiles: [] };
    }
    const saved = [];
    for (const p of importedProfiles) {
      const result = await profileStore.upsert(p);
      saved.push(result);
    }
    sendLog('info', `Successfully imported ${saved.length} profile(s) from SSH config.`);
    return { success: true, count: saved.length, profiles: saved };
  } catch (err) {
    sendLog('error', `Failed to import SSH config: ${err.message}`);
    return { success: false, error: err.message, count: 0, profiles: [] };
  }
});

// Scheduled Jobs IPC
registerLoggedHandle('jobs:get-all', async () => {
  return scheduledJobStore ? scheduledJobStore.getAll() : [];
});

registerLoggedHandle('jobs:upsert', async (_event, job) => {
  if (!scheduledJobStore) return null;
  const result = scheduledJobStore.upsert(job);
  if (jobRunnerService) jobRunnerService.notifyWindow();
  return result;
});

registerLoggedHandle('jobs:delete', async (_event, id) => {
  if (!scheduledJobStore) return false;
  const result = scheduledJobStore.delete(id);
  if (jobRunnerService) jobRunnerService.notifyWindow();
  return result;
});

registerLoggedHandle('jobs:run-now', async (_event, id) => {
  if (jobRunnerService) {
    jobRunnerService.executeJob(id);
    return true;
  }
  return false;
});

registerLoggedHandle('dialog:select-local-path', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Local Path (Directory or File)',
    properties: ['openDirectory', 'openFile']
  });
  return result.canceled ? null : result.filePaths[0];
});



registerLoggedHandle('jobs:toggle', async (_event, id, enabled) => {
  if (!scheduledJobStore) return false;
  const job = scheduledJobStore.getById(id);
  if (job) {
    job.enabled = Boolean(enabled);
    scheduledJobStore.upsert(job);
    if (jobRunnerService) jobRunnerService.notifyWindow();
    return true;
  }
  return false;
});

// SSH Tunneling & Port Forwarding IPC
registerLoggedHandle('tunnel:start', async (_event, rule) => {
  if (!tunnelService) throw new Error('TunnelService not initialized.');
  const onLog = (type, msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:message', { type, message: msg, timestamp: new Date().toLocaleTimeString() });
    }
  };
  return await tunnelService.startTunnel(rule, onLog);
});

registerLoggedHandle('tunnel:stop', async (_event, tunnelId) => {
  if (!tunnelService) return false;
  const onLog = (type, msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:message', { type, message: msg, timestamp: new Date().toLocaleTimeString() });
    }
  };
  return await tunnelService.stopTunnel(tunnelId, onLog);
});

registerLoggedHandle('tunnel:delete', async (_event, tunnelId) => {
  if (!tunnelService) return false;
  const onLog = (type, msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:message', { type, message: msg, timestamp: new Date().toLocaleTimeString() });
    }
  };
  return await tunnelService.deleteTunnel(tunnelId, onLog);
});

registerLoggedHandle('tunnel:list', async () => {
  return tunnelService ? tunnelService.listTunnels() : [];
});

// Connection IPC
const activeSessions = new Map();
const autoReconnectState = new Map(); // sessionId -> { attempts, timer, isReconnecting }

function triggerAutoReconnect(sessionId, config, protocol) {
  if (autoReconnectState.has(sessionId)) {
    const st = autoReconnectState.get(sessionId);
    if (st.isReconnecting) return;
  }

  const backoffDelays = [3000, 6000, 12000, 24000, 45000];
  const state = autoReconnectState.get(sessionId) || { attempts: 0, timer: null, isReconnecting: false };
  state.isReconnecting = true;
  state.attempts++;
  autoReconnectState.set(sessionId, state);

  if (state.attempts > 5) {
    sendLog('error', `[Auto-Reconnect] Max retry attempts (5/5) reached for session [${sessionId}]. Session disconnected.`);
    sendOSNotification('DevsFTP Session Disconnected', `Max reconnect retries reached for ${config ? (config.name || config.host) : sessionId}.`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection:reconnect-status', { sessionId, status: 'failed', attempts: state.attempts });
    }
    autoReconnectState.delete(sessionId);
    return;
  }

  const delay = backoffDelays[state.attempts - 1] || 45000;
  sendLog('warning', `[Auto-Reconnect] Unexpected disconnect on session [${sessionId}]. Reconnecting (Attempt ${state.attempts}/5) in ${delay / 1000}s...`);
  if (state.attempts === 1) {
    sendOSNotification('DevsFTP Network Warning', `Connection lost to ${config ? (config.name || config.host) : 'server'}. Auto-reconnecting in background...`);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('connection:reconnect-status', { sessionId, status: 'reconnecting', attempts: state.attempts, delay });
  }

  state.timer = setTimeout(async () => {
    sendLog('info', `[Auto-Reconnect] Executing reconnect attempt (${state.attempts}/5) for session [${sessionId}]...`);
    try {
      let newSession = null;
      if (protocol === 'sftp') {
        newSession = new SFTPService();
        await newSession.connect(config, (type, msg) => sendLog(type, msg), handleHostKeyVerification);
      } else if (protocol === 'webdav') {
        newSession = new WebDAVService();
        await newSession.connect(config, (type, msg) => sendLog(type, msg));
      } else {
        newSession = new FTPService();
        await newSession.connect(config, (type, msg) => sendLog(type, msg));
      }

      newSession.onUnexpectedClose = () => triggerAutoReconnect(sessionId, config, protocol);

      activeSessions.set(sessionId, { session: newSession, config, protocol });
      autoReconnectState.delete(sessionId);

      sendLog('info', `✓ [Auto-Reconnect] Connection restored cleanly for session [${sessionId}]!`);
      sendOSNotification('DevsFTP Auto-Reconnect', `✓ Session connection restored cleanly to ${config ? (config.name || config.host) : 'server'}!`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('connection:reconnect-status', { sessionId, status: 'connected', attempts: state.attempts });
      }
    } catch (reconnectErr) {
      sendLog('error', `[Auto-Reconnect] Attempt ${state.attempts}/5 failed: ${reconnectErr.message}`);
      state.isReconnecting = false;
      triggerAutoReconnect(sessionId, config, protocol);
    }
  }, delay);
}

registerLoggedOn('notification:send', (_event, { title, body }) => {
  sendOSNotification(title, body);
});

function getActiveSessionInstance(sessionId) {
  if (sessionId) {
    const item = activeSessions.get(sessionId);
    if (item && item.session && item.session.connected) {
      return item.session;
    }
    return null; // Do NOT fall back to other sessions if a specific sessionId was requested but is not connected
  }
  // If no sessionId was provided (fallback to last active session or single connection)
  if (activeSessions.size === 1) {
    const item = activeSessions.values().next().value;
    if (item && item.session && item.session.connected) {
      return item.session;
    }
  }
  return null;
}

function getSessionByProfileId(profileId) {
  for (const [sessId, item] of activeSessions.entries()) {
    if (item && item.config && item.config.id === profileId && item.session && item.session.connected) {
      return { session: item.session, sessionId: sessId };
    }
  }
  return null;
}

registerLoggedHandle('connection:connect', async (_event, config, sessionId) => {
  const sessId = sessionId || (config ? config._sessionId : null) || 'default';

  if (activeSessions.has(sessId)) {
    const existing = activeSessions.get(sessId);
    if (existing && existing.session) existing.session.disconnect();
    activeSessions.delete(sessId);
  }

  if (autoReconnectState.has(sessId)) {
    const st = autoReconnectState.get(sessId);
    if (st.timer) clearTimeout(st.timer);
    autoReconnectState.delete(sessId);
  }

  activeConfig = config;
  const protocol = config.protocol || 'sftp';
  let session = null;

  if (protocol === 'sftp') {
    session = new SFTPService();
    try {
      await session.connect(config, (type, msg) => sendLog(type, msg), handleHostKeyVerification);
      session.onUnexpectedClose = () => triggerAutoReconnect(sessId, config, protocol);
      activeSessions.set(sessId, { session, config, protocol });
      if (cacheWatcherService) {
        cacheWatcherService.updateWatcherSessionId(config.id, sessId, Array.from(activeSessions.keys()));
      }
      sendLog('info', `SFTP Session established cleanly for tab [${sessId}] to ${config.host}:${config.port || 22}`);
      return { success: true, protocol: 'sftp', sessionId: sessId };
    } catch (err) {
      sendLog('error', `SFTP Connection failed for tab [${sessId}]: ${err.message}`);
      throw err;
    }
  } else if (protocol === 'webdav') {
    session = new WebDAVService();
    try {
      await session.connect(config, (type, msg) => sendLog(type, msg));
      session.onUnexpectedClose = () => triggerAutoReconnect(sessId, config, protocol);
      activeSessions.set(sessId, { session, config, protocol });
      if (cacheWatcherService) {
        cacheWatcherService.updateWatcherSessionId(config.id, sessId, Array.from(activeSessions.keys()));
      }
      sendLog('info', `WebDAV Session established cleanly for tab [${sessId}] to ${config.webdavUrl || config.host}`);
      return { success: true, protocol: 'webdav', sessionId: sessId };
    } catch (err) {
      sendLog('error', `WebDAV Connection failed for tab [${sessId}]: ${err.message}`);
      throw err;
    }
  } else {
    session = new FTPService();
    try {
      await session.connect(config, (type, msg) => sendLog(type, msg));
      session.onUnexpectedClose = () => triggerAutoReconnect(sessId, config, protocol);
      activeSessions.set(sessId, { session, config, protocol });
      if (cacheWatcherService) {
        cacheWatcherService.updateWatcherSessionId(config.id, sessId, Array.from(activeSessions.keys()));
      }
      sendLog('info', `FTP/FTPS Session established cleanly for tab [${sessId}] to ${config.host}:${config.port || 21}`);
      return { success: true, protocol: 'ftp', sessionId: sessId };
    } catch (err) {
      sendLog('error', `FTP Connection failed for tab [${sessId}]: ${err.message}`);
      throw err;
    }
  }

});

registerLoggedHandle('connection:disconnect', async (_event, sessionId) => {
  const sessId = sessionId || 'default';
  if (autoReconnectState.has(sessId)) {
    const st = autoReconnectState.get(sessId);
    if (st.timer) clearTimeout(st.timer);
    autoReconnectState.delete(sessId);
  }
  if (activeSessions.has(sessId)) {
    const item = activeSessions.get(sessId);
    if (item && item.session) item.session.disconnect();
    activeSessions.delete(sessId);
  }
  if (sshTerminalService && activeSessions.size === 0) {
    sshTerminalService.disconnect();
  }
  sendLog('warning', `Remote session [${sessId}] disconnected.`);
  return true;
});

// Remote File Operations
registerLoggedHandle('remote:list', async (_event, remotePath, sessionId) => {
  console.log('[DEBUG MAIN IPC] remote:list received:', { remotePath, sessionId });
  const session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) {
    console.warn('[DEBUG MAIN IPC] remote:list failed: No active session for sessionId:', sessionId);
    throw new Error('No active remote session for tab.');
  }
  return await session.list(remotePath);
});

registerLoggedHandle('remote:mkdir', async (_event, remotePath, sessionId, mode) => {
  console.log('[DEBUG MAIN IPC] remote:mkdir received:', { remotePath, sessionId, mode });
  const session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) throw new Error('Not connected');
  await session.mkdir(remotePath, mode);
  sendLog('info', `Created remote directory: ${remotePath} (mode: ${mode || 'default'})`);
  return true;
});

registerLoggedHandle('remote:delete', async (_event, remotePath, isDir, sessionId) => {
  console.log('[DEBUG MAIN IPC] remote:delete received:', { remotePath, isDir, sessionId });
  const session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) throw new Error('Not connected');
  await session.delete(remotePath, isDir);
  sendLog('info', `Deleted remote item: ${remotePath}`);
  return true;
});

registerLoggedHandle('remote:chmod', async (_event, remotePath, mode, sessionId) => {
  console.log('[DEBUG MAIN IPC] remote:chmod received:', { remotePath, mode, sessionId });
  const session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) throw new Error('Not connected');
  if (session.chmod) {
    await session.chmod(remotePath, mode);
    sendLog('info', `Changed permissions on ${remotePath} to ${mode}`);
    return true;
  }
  throw new Error('chmod is not supported on this protocol.');
});

registerLoggedHandle('remote:rename', async (_event, oldPath, newPath, sessionId) => {
  console.log('[DEBUG MAIN IPC] remote:rename received:', { oldPath, newPath, sessionId });
  const session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) throw new Error('Not connected');
  await session.rename(oldPath, newPath);
  sendLog('info', `Renamed remote item ${oldPath} -> ${newPath}`);
  return true;
});

registerLoggedHandle('remote:create-file', async (_event, remotePath, sessionId, mode) => {
  console.log('[DEBUG MAIN IPC] remote:create-file received:', { remotePath, sessionId, mode });
  const session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) throw new Error('Not connected');
  if (session.createFile) {
    await session.createFile(remotePath, mode);
  } else {
    const tempLocal = path.join(app.getPath('userData'), 'temp_empty.txt');
    fs.writeFileSync(tempLocal, '');
    await session.uploadFile(tempLocal, remotePath, null);
    try { fs.unlinkSync(tempLocal); } catch (e) {}
  }
  sendLog('info', `Created remote file: ${remotePath} (mode: ${mode || 'default'})`);
  return true;
});

// Local File Operations
registerLoggedHandle('local:create-file', async (_event, localPath) => {
  fs.writeFileSync(localPath, '');
  sendLog('info', `Created local file: ${localPath}`);
  return true;
});

registerLoggedHandle('local:mkdir', async (_event, localPath) => {
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }
  sendLog('info', `Created local directory: ${localPath}`);
  return true;
});

registerLoggedHandle('local:rename', async (_event, oldPath, newPath) => {
  fs.renameSync(oldPath, newPath);
  sendLog('info', `Renamed local item ${oldPath} -> ${newPath}`);
  return true;
});

registerLoggedHandle('local:delete', async (_event, localPath) => {
  if (!isSafeLocalPath(localPath)) {
    throw new Error(`Permission denied: Deletion path '${localPath}' is outside safe boundaries.`);
  }
  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }
  sendLog('info', `Deleted local item: ${localPath}`);
  return true;
});
registerLoggedHandle('local:list', async (_event, targetPath) => {
  const localDir = targetPath || process.env.USERPROFILE || 'C:\\';
  const files = fs.readdirSync(localDir, { withFileTypes: true });

  const items = files.map(f => {
    const fullPath = path.join(localDir, f.name);
    let size = 0;
    let mtime = new Date().toISOString();
    try {
      const stat = fs.statSync(fullPath);
      size = stat.size;
      mtime = stat.mtime.toISOString();
    } catch (e) {}

    return {
      name: f.name,
      path: fullPath,
      isDir: f.isDirectory(),
      size: size,
      modifyTime: mtime
    };
  });

  items.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  return { currentPath: localDir, files: items };
});

registerLoggedHandle('local:drives', async () => {
  const drives = ['C:\\'];
  ['D', 'E', 'F', 'G', 'H', 'Z'].forEach(letter => {
    const p = `${letter}:\\`;
    if (fs.existsSync(p)) drives.push(p);
  });
  return drives;
});

registerLoggedHandle('local:home', async () => {
  const userHome = os.homedir();
  const downloads = path.join(userHome, 'Downloads');
  return fs.existsSync(downloads) ? downloads : userHome;
});

registerLoggedHandle('local:open', async (_event, localPath) => {
  if (localPath) {
    const normalized = path.normalize(localPath);
    const ext = path.extname(normalized).toLowerCase();
    const webExts = ['.html', '.htm', '.xhtml', '.phtml', '.shtml', '.svg', '.xml'];

    if (webExts.includes(ext) && process.platform === 'win32') {
      const codeEditorPath = cacheWatcherService ? cacheWatcherService.getSystemCodeEditorPath() : null;
      if (codeEditorPath && fs.existsSync(codeEditorPath)) {
        const { execFile } = require('child_process'); // Avoid shell injection (Issue 13.2)
        sendLog('info', `Opening local code file in system code editor (${path.basename(codeEditorPath)}): ${normalized}`);
        execFile(codeEditorPath, [normalized]);
        return true;
      }
    }

    if (shell) {
      sendLog('info', `Opening local file in default system application: ${normalized}`);
      return await shell.openPath(normalized);
    }
  }
  return false;
});

// Transfer Operations & Unified Transfer Engine IPC

registerLoggedHandle('transfer:download', async (_event, remotePath, localPath, sessionId, options = {}) => {
  let session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) {
    if (options && options.profileId) {
      const match = getSessionByProfileId(options.profileId);
      if (match) {
        session = match.session;
        sessionId = match.sessionId;
      }
    }
  }
  if (!session || !session.connected) throw new Error('Not connected');

  const sessionItem = sessionId ? activeSessions.get(sessionId) : null;
  const profile = sessionItem ? sessionItem.config : activeConfig;
  const profileId = profile ? profile.id : 'temp';
  
  sendLog('info', `Starting download via Transfer Engine: ${remotePath} -> ${localPath}`);

  const task = {
    id: 'tr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    type: 'download',
    source: remotePath,
    dest: localPath,
    profileId: profileId,
    sessionId: sessionId
  };
  return await transferEngine.executeTransfer(task, session, options);
});

registerLoggedHandle('transfer:upload', async (_event, localPath, remotePath, sessionId, options = {}) => {
  let session = getActiveSessionInstance(sessionId);
  if (!session || !session.connected) {
    if (options && options.profileId) {
      const match = getSessionByProfileId(options.profileId);
      if (match) {
        session = match.session;
        sessionId = match.sessionId;
      }
    }
  }
  if (!session || !session.connected) throw new Error('Not connected');

  const sessionItem = sessionId ? activeSessions.get(sessionId) : null;
  const profile = sessionItem ? sessionItem.config : activeConfig;
  const profileId = profile ? profile.id : 'temp';

  sendLog('info', `Starting upload via Transfer Engine: ${localPath} -> ${remotePath}`);

  const task = {
    id: 'tr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    type: 'upload',
    source: localPath,
    dest: remotePath,
    profileId: profileId,
    sessionId: sessionId
  };
  const result = await transferEngine.executeTransfer(task, session, options);
  if (cacheWatcherService) {
    cacheWatcherService.markUploaded(localPath);
  }
  return result;
});

registerLoggedHandle('history:get-all', async () => {
  return transferEngine ? transferEngine.history : [];
});

registerLoggedHandle('transfer:get-queue', async () => {
  return transferEngine ? transferEngine.getQueue() : [];
});

registerLoggedHandle('transfer:clear-completed', async () => {
  return transferEngine ? transferEngine.clearCompletedQueue() : [];
});

registerLoggedHandle('transfer:remove-item', async (_event, id) => {
  return transferEngine ? transferEngine.removeQueueItem(id) : [];
});

registerLoggedHandle('transfer:save-queue', async (_event, queue) => {
  return transferEngine ? transferEngine.saveQueue(queue) : [];
});

// Developer Remote Edit Workflow
registerLoggedHandle('remote:edit', async (_event, remotePath, sessionId) => {
  writeDebugLog(`[TRACE MAIN remote:edit ENTERED] remotePath: ${remotePath} | sessionId: ${sessionId}`);
  writeDebugLog({
    scope: 'workflow',
    event: 'remote:edit requested',
    level: 'info',
    message: 'Remote edit request received',
    details: { remotePath, sessionId }
  });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('cache:debug-event', {
      stage: 'STAGE 1',
      msg: '[REMOTE EDIT ENTERED]',
      details: { remotePath, sessionId }
    });
  }
  console.log('[CHECKPOINT 7] Main process ipcMain.handle("remote:edit") entered');
  console.log('[CHECKPOINT 8] Main process sessionId value:', sessionId);
  const session = getActiveSessionInstance(sessionId);
  console.log('[CHECKPOINT 9] getActiveSessionInstance() result:', session ? `[Connected: ${session.connected}]` : null);

  if (!session || !session.connected) throw new Error('Not connected');

  const sessionItem = sessionId ? activeSessions.get(sessionId) : null;
  const profile = sessionItem ? sessionItem.config : activeConfig;
  const profileId = profile ? profile.id : 'temp';

  const localCachePath = cacheWatcherService.getCachePath(profileId, remotePath);
  console.log('[CHECKPOINT 12] Temporary cache file path:', localCachePath);

  // If the file is already being watched/edited, do not download it again! (Issue 2.6)
  if (cacheWatcherService && cacheWatcherService.watchers.has(localCachePath)) {
    sendLog('info', `File ${path.basename(remotePath)} is already open for editing. Re-focusing.`);
    cacheWatcherService.launchEditor(localCachePath);
    return { localPath: localCachePath };
  }

  console.log('[CHECKPOINT 10] Download started for editing:', { remotePath, localCachePath });
  writeDebugLog({
    scope: 'workflow',
    event: 'remote file download',
    level: 'info',
    message: 'Downloading remote file for editing',
    details: { remotePath, localCachePath, sessionId }
  });
  sendLog('info', `Caching remote file for editing: ${remotePath}`);
  await session.downloadFile(remotePath, localCachePath, null);
  console.log('[CHECKPOINT 11] Download completed for editing:', localCachePath);
  writeDebugLog({
    scope: 'workflow',
    event: 'cache file created',
    level: 'info',
    message: 'Cached editor file created',
    details: { remotePath, localCachePath, sessionId }
  });
  
  let remoteStats = {};
  if (session.stat) {
    try {
      remoteStats = await session.stat(remotePath);
    } catch (e) {}
  }
  
  cacheWatcherService.openAndWatch(localCachePath, remotePath, profile || profileId, sessionId, remoteStats);
  sendLog('info', `Opened ${path.basename(remotePath)} in default editor with live sync.`);
  return { localPath: localCachePath };
});

registerLoggedHandle('cache:clear', async () => {
  if (cacheWatcherService) {
    cacheWatcherService.clearCache();
    sendLog('info', 'Local remote-file cache directory cleared.');
    return true;
  }
  return false;
});

registerLoggedHandle('cache:dismiss-batch', async (_event, items) => {
  if (cacheWatcherService) {
    cacheWatcherService.dismissBatch(items);
    sendLog('info', 'Dismissed baseline for startup cached file set.');
    return true;
  }
  return false;
});

registerLoggedHandle('transfer:background-upload-batch', async (_event, payload) => {
  const items = Array.isArray(payload) ? payload : (payload ? payload.items : []);
  const forceOverwrite = payload && typeof payload === 'object' && !Array.isArray(payload) ? Boolean(payload.forceOverwrite) : false;

  if (!Array.isArray(items) || items.length === 0) return { success: true, count: 0, conflicts: [] };
  sendLog('info', `Starting silent background upload batch for ${items.length} file(s) (forceOverwrite=${forceOverwrite})...`);

  const groups = {};
  items.forEach(item => {
    const pId = item.profileId || 'default';
    if (!groups[pId]) groups[pId] = [];
    groups[pId].push(item);
  });

  const profiles = await profileStore.getAll();
  const conflicts = [];
  let uploadedCount = 0;

  for (const [pId, groupItems] of Object.entries(groups)) {
    const profile = profiles.find(p => p.id === pId) || activeConfig;
    if (!profile) {
      sendLog('error', `Cannot find server profile for ID [${pId}] to upload background files.`);
      continue;
    }

    const Driver = (profile.protocol === 'ftp' || profile.protocol === 'ftps') ? FTPService : SFTPService;
    const bgDriver = new Driver();

    try {
      sendLog('info', `Opening silent background connection to ${profile.name} (${profile.host})...`);
      await bgDriver.connect(profile, (lvl, msg) => sendLog(lvl, `[BG ${profile.name}] ${msg}`), handleHostKeyVerification);

      for (const item of groupItems) {
        let isConflict = false;
        let serverMtime = null;

        if (!forceOverwrite && bgDriver.stat && item.remoteMtime) {
          try {
            const rstat = await bgDriver.stat(item.remotePath);
            if (rstat && rstat.modifyTime) {
              serverMtime = rstat.modifyTime;
              const remoteTime = new Date(rstat.modifyTime).getTime();
              const initialTime = new Date(item.remoteMtime).getTime();
              if (remoteTime > initialTime + 3000) {
                isConflict = true;
                sendLog('warning', `⚠️ Remote conflict detected for ${item.fileName} on ${profile.name}: Server file updated at ${rstat.modifyTime} (baseline: ${item.remoteMtime})`);
              }
            }
          } catch (statErr) {}
        }

        if (isConflict) {
          conflicts.push({ ...item, serverMtime });
        } else {
          sendLog('info', `Background uploading ${item.fileName} -> ${item.remotePath} on ${profile.name}...`);
          await bgDriver.uploadFile(item.localPath, item.remotePath, null);
          uploadedCount++;
          if (cacheWatcherService) {
            cacheWatcherService.markUploaded(item.localPath);
          }
          sendLog('info', `✓ Background upload successful for ${item.fileName} on ${profile.name}.`);
        }
      }
    } catch (err) {
      sendLog('error', `Background upload failed for profile [${profile.name}]: ${err.message}`);
    } finally {
      if (bgDriver.disconnect) {
        try { await bgDriver.disconnect(); } catch (e) {}
      }
    }
  }

  return { success: true, count: uploadedCount, conflicts };
});

// Transfer Conflict Check IPC
registerLoggedHandle('transfer:check-conflict', async (_event, { type, localPath, remotePath, sessionId }) => {
  let localStat = null;
  let remoteStat = null;

  if (localPath) {
    try {
      if (fs.existsSync(localPath)) {
        const st = fs.statSync(localPath);
        localStat = {
          name: path.basename(localPath),
          size: st.size,
          modifyTime: st.mtime.toISOString(),
          isDir: st.isDirectory()
        };
      }
    } catch (e) {}
  }

  if (remotePath) {
    const session = getActiveSessionInstance(sessionId);
    if (session && session.stat) {
      try {
        const rst = await session.stat(remotePath);
        if (rst) {
          remoteStat = {
            name: remotePath.split('/').pop(),
            size: rst.size,
            modifyTime: rst.modifyTime,
            isDir: rst.isDir
          };
        }
      } catch (e) {}
    }
  }

  const targetExists = type === 'download' ? !!localStat : !!remoteStat;

  return {
    conflict: targetExists,
    localStat,
    remoteStat,
    localPath,
    remotePath
  };
});

// SSH Terminal IPC
registerLoggedHandle('ssh:terminal-connect', async (_event, config) => {
  if (sshTerminalService) sshTerminalService.disconnect();
  sshTerminalService = new SSHTerminalService(mainWindow);
  await sshTerminalService.connect(config || activeConfig, handleHostKeyVerification);
  sendLog('info', 'SSH Terminal session initiated.');
  return true;
});

registerLoggedOn('ssh:terminal-write', (_event, data) => {
  if (sshTerminalService) sshTerminalService.write(data);
});

registerLoggedOn('ssh:terminal-resize', (_event, { cols, rows }) => {
  if (sshTerminalService) sshTerminalService.resize(cols, rows);
});

// File Dialog Pickers
registerLoggedHandle('dialog:select-file', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

registerLoggedHandle('dialog:save-file', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  if (!result.canceled && result.filePath) {
    return result.filePath;
  }
  return null;
});

// =========================================================================
// System Utilities: Update Awareness & Server Bug Reporter (DevsFTP.com)
// =========================================================================

registerLoggedHandle('system:open-external', async (_event, url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url); // Robust protocol parsing (Issue 13.3)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      await shell.openExternal(url);
      return true;
    }
  } catch (e) {}
  return false;
});

registerLoggedHandle('system:check-updates', async () => {
  const currentVersion = app.getVersion() || '1.0.0';
  const updateUrl = 'https://devsftp.com/version.json';
  const githubApiUrl = 'https://api.github.com/repos/DevsFTP/DevsFTP/releases/latest';

  const fetchJson = (url) => new Promise((resolve) => {
    const https = require('https');
    const http = require('http');
    const driver = url.startsWith('https') ? https : http;
    const req = driver.get(url, { headers: { 'User-Agent': `DevsFTP/${currentVersion}` } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return resolve(null);
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(6000, () => { req.destroy(); resolve(null); });
  });

  try {
    let data = await fetchJson(updateUrl);
    if (!data) {
      data = await fetchJson(githubApiUrl);
      if (data && data.tag_name) {
        data = {
          version: data.tag_name.replace(/^v/, ''),
          releaseNotes: data.body || 'New production release available on DevsFTP.com',
          downloadUrl: data.html_url || 'https://devsftp.com/download/'
        };
      }
    }

    if (!data) {
      const localDevsWWWVer = path.join(app.getAppPath(), 'DevsWWW', 'version.json');
      const localRootVer = path.join(process.cwd(), 'DevsWWW', 'version.json');
      const targetLocalFile = fs.existsSync(localDevsWWWVer) ? localDevsWWWVer : (fs.existsSync(localRootVer) ? localRootVer : null);
      if (targetLocalFile) {
        try {
          data = JSON.parse(fs.readFileSync(targetLocalFile, 'utf8'));
        } catch (e) {}
      }
    }

    if (data && data.version) {
      const latestVersion = data.version.replace(/^v/, '');
      const semverCompare = (v1, v2) => {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
          const n1 = p1[i] || 0, n2 = p2[i] || 0;
          if (n1 > n2) return 1;
          if (n1 < n2) return -1;
        }
        return 0;
      };

      const updateAvailable = semverCompare(latestVersion, currentVersion) > 0;
      return {
        updateAvailable,
        currentVersion,
        latestVersion,
        downloadUrl: data.downloadUrl || 'https://devsftp.com/download/',
        releaseNotes: data.releaseNotes || `DevsFTP v${latestVersion} is now available for download.`
      };
    }
  } catch (err) {
    writeDebugLog(`[Update Check Error] ${err.message}`);
  }

  return {
    updateAvailable: false,
    currentVersion,
    latestVersion: currentVersion,
    downloadUrl: 'https://devsftp.com/download/',
    releaseNotes: 'You are running the latest version of DevsFTP.'
  };
});

registerLoggedHandle('system:submit-bug-report', async (_event, payload) => {
  const currentVersion = app.getVersion() || '1.0.0';
  const bugsEndpoint = 'https://devsftp.com/bugs.php';
  const logPath = path.join(app.getPath('userData'), 'devsftp-debug.log');

  let rawLogs = '';
  if (fs.existsSync(logPath)) {
    try {
      rawLogs = fs.readFileSync(logPath, 'utf8').slice(-60000); // Last 60KB
    } catch (e) {}
  }

  const sanitizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/(password|passphrase|secret|key|token)["']?\s*[:=]\s*["']?[^"'\s,]+/gi, '$1: [REDACTED]')
      .replace(/-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g, '[PRIVATE KEY REDACTED]');
  };

  const reportData = {
    version: currentVersion,
    platform: `${process.platform} (${process.arch})`,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    timestamp: new Date().toISOString(),
    userEmail: payload ? (payload.email || 'Anonymous') : 'Anonymous',
    description: payload ? (payload.description || 'No description provided') : 'No description provided',
    logs: payload && payload.includeLogs ? sanitizeText(rawLogs) : 'Logs excluded by user',
    status: 'incomplete',
    completed: false,
    complete: false
  };

  const postJson = (url, bodyObj) => new Promise((resolve) => {
    const https = require('https');
    const http = require('http');
    const driver = url.startsWith('https') ? https : http;
    const postData = JSON.stringify(bodyObj);

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': `DevsFTP-App/${currentVersion}`
      }
    };

    const req = driver.request(options, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: resBody });
      });
    });

    req.on('error', (err) => resolve({ statusCode: 500, error: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ statusCode: 408, error: 'Timeout' }); });
    req.write(postData);
    req.end();
  });

  try {
    sendLog('info', `Submitting bug report & diagnostic log package to ${bugsEndpoint}...`);
    const res = await postJson(bugsEndpoint, reportData);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      sendLog('info', '✓ Bug report transmitted cleanly to devsftp.com/bugs.php');
      return { success: true, message: 'Report submitted successfully' };
    } else {
      writeDebugLog(`[Bug Report Submit Warn] Server returned status ${res.statusCode}: ${res.error || res.body}`);
    }
  } catch (err) {
    writeDebugLog(`[Bug Report Submit Error] ${err.message}`);
  }

  return { success: true, fallback: true, message: 'Report prepared' };
});

registerLoggedHandle('system:export-diagnostics', async () => {
  const currentVersion = app.getVersion() || '1.0.0';
  const logPath = path.join(app.getPath('userData'), 'devsftp-debug.log');
  
  let header = `========================================================\n`;
  header += `DevsFTP Diagnostic Log Package\n`;
  header += `Website: https://devsftp.com\n`;
  header += `Report Issues: https://devsftp.com/bugs/\n`;
  header += `========================================================\n`;
  header += `App Version: v${currentVersion}\n`;
  header += `OS Platform: ${process.platform} (${process.arch})\n`;
  header += `Electron Version: ${process.versions.electron}\n`;
  header += `Node Version: ${process.versions.node}\n`;
  header += `Timestamp: ${new Date().toISOString()}\n`;
  header += `========================================================\n\n`;

  let logData = 'No debug trace log found.';
  if (fs.existsSync(logPath)) {
    try {
      logData = fs.readFileSync(logPath, 'utf8').slice(-80000);
    } catch (e) {
      logData = `Failed to read debug log: ${e.message}`;
    }
  }

  const userHome = os.homedir();
  const downloadsDir = fs.existsSync(path.join(userHome, 'Downloads')) ? path.join(userHome, 'Downloads') : userHome;
  const fileName = `DevsFTP-Diagnostic-${Date.now()}.txt`;
  const fullPath = path.join(downloadsDir, fileName);

  fs.writeFileSync(fullPath, header + logData, 'utf8');
  sendLog('info', `Diagnostic log package exported: ${fullPath}`);
  return { success: true, filePath: fullPath };
});

registerLoggedHandle('system:get-exclusion-prefs', async () => {
  return exclusionService ? exclusionService.getPrefs() : { enabled: true, honorGitignore: true, patterns: ['.git', '.gitignore', 'node_modules', '.env', 'vendor', '.DS_Store', 'Thumbs.db', '*.tmp', '*.log', '*.bak'] };
});

registerLoggedHandle('system:save-exclusion-prefs', async (_event, prefs) => {
  if (exclusionService) {
    exclusionService.savePrefs(prefs);
    sendLog('info', 'Smart exclusion rules and ignore preferences saved cleanly.');
    return { success: true };
  }
  return { success: false };
});
