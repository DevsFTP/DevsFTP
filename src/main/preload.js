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
 * Electron Preload Script for DevsFTP
 * Safely bridges Main process IPC capabilities to the Renderer process.
 */

const { contextBridge, ipcRenderer } = require('electron');

const devsFTPApi = {
  // Saved Profiles
  profiles: {
    getAll: () => ipcRenderer.invoke('profiles:get-all'),
    upsert: (profile) => ipcRenderer.invoke('profiles:upsert', profile),
    delete: (id) => ipcRenderer.invoke('profiles:delete', id),
    export: () => ipcRenderer.invoke('profiles:export'),
    import: (jsonString) => ipcRenderer.invoke('profiles:import', jsonString),
    importSSHConfig: (filePath) => ipcRenderer.invoke('profiles:import-ssh-config', filePath),
    master: {
      getStatus: () => ipcRenderer.invoke('profiles:master-status'),
      unlock: (password) => ipcRenderer.invoke('profiles:master-unlock', password),
      enable: (password) => ipcRenderer.invoke('profiles:master-enable', password),
      disable: (password) => ipcRenderer.invoke('profiles:master-disable', password),
      change: (oldPassword, newPassword) => ipcRenderer.invoke('profiles:master-change', oldPassword, newPassword)
    }
  },

  // Connection & File System
  connect: (config, sessionId) => ipcRenderer.invoke('connection:connect', config, sessionId),
  disconnect: (sessionId) => ipcRenderer.invoke('connection:disconnect', sessionId),
  
  // Remote Operations
  remoteList: (remotePath, sessionId) => ipcRenderer.invoke('remote:list', remotePath, sessionId),
  remoteMkdir: (remotePath, sessionId, mode) => ipcRenderer.invoke('remote:mkdir', remotePath, sessionId, mode),
  remoteCreateFile: (remotePath, sessionId, mode) => ipcRenderer.invoke('remote:create-file', remotePath, sessionId, mode),
  remoteDelete: (remotePath, isDir, sessionId) => ipcRenderer.invoke('remote:delete', remotePath, isDir, sessionId),
  remoteChmod: (remotePath, mode, sessionId) => ipcRenderer.invoke('remote:chmod', remotePath, mode, sessionId),
  remoteRename: (oldPath, newPath, sessionId) => ipcRenderer.invoke('remote:rename', oldPath, newPath, sessionId),

  // Local Operations
  localList: (localPath) => ipcRenderer.invoke('local:list', localPath),
  localDrives: () => ipcRenderer.invoke('local:drives'),
  localHome: () => ipcRenderer.invoke('local:home'),
  localOpen: (localPath) => ipcRenderer.invoke('local:open', localPath),
  localCreateFile: (localPath) => ipcRenderer.invoke('local:create-file', localPath),
  localMkdir: (localPath) => ipcRenderer.invoke('local:mkdir', localPath),
  localRename: (oldPath, newPath) => ipcRenderer.invoke('local:rename', oldPath, newPath),
  localDelete: (localPath, isDir) => ipcRenderer.invoke('local:delete', localPath, isDir),
  selectLocalPath: () => ipcRenderer.invoke('dialog:select-local-path'),
  openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
  checkForUpdates: () => ipcRenderer.invoke('system:check-updates'),

  // Transfer Queue & Live Edit
  downloadFile: (remotePath, localPath, sessionId, options = {}) => ipcRenderer.invoke('transfer:download', remotePath, localPath, sessionId, options),
  uploadFile: (localPath, remotePath, sessionId, options = {}) => ipcRenderer.invoke('transfer:upload', localPath, remotePath, sessionId, options),
  getHistory: () => ipcRenderer.invoke('history:get-all'),
  getQueue: () => ipcRenderer.invoke('transfer:get-queue'),
  clearCompletedQueue: () => ipcRenderer.invoke('transfer:clear-completed'),
  removeItemFromQueue: (id) => ipcRenderer.invoke('transfer:remove-item', id),
  saveQueue: (queue) => ipcRenderer.invoke('transfer:save-queue', queue),
  uploadBatchBackground: (items) => ipcRenderer.invoke('transfer:background-upload-batch', items),
  checkFileConflict: (data) => ipcRenderer.invoke('transfer:check-conflict', data),
  appendDebugLog: (msg) => ipcRenderer.send('debug:log-append', msg),
  diagnosticLog: (entry) => ipcRenderer.send('diagnostic:log', entry),
  editRemoteFile: (remotePath, sessionId) => {
    ipcRenderer.send('debug:log-append', `[TRACE PRELOAD remote:edit] remotePath: ${remotePath} | sessionId: ${sessionId}`);
    return ipcRenderer.invoke('remote:edit', remotePath, sessionId);
  },
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  dismissBatch: (items) => ipcRenderer.invoke('cache:dismiss-batch', items),

  // Host Key Verification IPC
  onHostKeyVerifyRequest: (callback) => ipcRenderer.on('ssh:host-key-verify-request', (_event, data) => callback(data)),
  respondHostKeyVerify: (response) => ipcRenderer.send('ssh:host-key-verify-response', response),

  // SSH Terminal IPC
  sshTerminalConnect: (config) => ipcRenderer.invoke('ssh:terminal-connect', config),
  sshTerminalWrite: (data) => ipcRenderer.send('ssh:terminal-write', data),
  sshTerminalResize: (cols, rows) => ipcRenderer.send('ssh:terminal-resize', { cols, rows }),
  onSSHTerminalData: (callback) => ipcRenderer.on('ssh:terminal-data', (_event, data) => callback(data)),

  // SSH Tunneling & Port Forwarding IPC
  tunnels: {
    start: (rule) => ipcRenderer.invoke('tunnel:start', rule),
    stop: (tunnelId) => ipcRenderer.invoke('tunnel:stop', tunnelId),
    delete: (tunnelId) => ipcRenderer.invoke('tunnel:delete', tunnelId),
    list: () => ipcRenderer.invoke('tunnel:list')
  },

  // System Events & Logs
  onLogMessage: (callback) => ipcRenderer.on('log:message', (_event, log) => callback(log)),
  onReconnectStatus: (callback) => ipcRenderer.on('connection:reconnect-status', (_event, data) => callback(data)),
  sendOSNotification: (title, body) => ipcRenderer.send('notification:send', { title, body }),
  onTransferProgress: (callback) => ipcRenderer.on('transfer:progress', (_event, data) => callback(data)),
  onCacheFileSaved: (callback) => ipcRenderer.on('cache:file-saved', (_event, data) => callback(data)),
  onCacheBatchFilesSaved: (callback) => ipcRenderer.on('cache:batch-files-saved', (_event, data) => callback(data)),
  onCacheDebugEvent: (callback) => ipcRenderer.on('cache:debug-event', (_event, data) => callback(data)),
  selectFileOrFolder: (options) => ipcRenderer.invoke('dialog:select-file', options),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:save-file', options),

  // Scheduled Jobs IPC
  jobs: {
    getAll: () => ipcRenderer.invoke('jobs:get-all'),
    upsert: (job) => ipcRenderer.invoke('jobs:upsert', job),
    delete: (id) => ipcRenderer.invoke('jobs:delete', id),
    runNow: (id) => ipcRenderer.invoke('jobs:run-now', id),
    toggle: (id, enabled) => ipcRenderer.invoke('jobs:toggle', id, enabled)
  },
  onJobsUpdated: (callback) => ipcRenderer.on('jobs:updated', (_event, jobs) => callback(jobs))
};

contextBridge.exposeInMainWorld('devsFTP', devsFTPApi);
// Backward compatibility alias to prevent breaking existing baseline calls
contextBridge.exposeInMainWorld('pulseFTP', devsFTPApi);
