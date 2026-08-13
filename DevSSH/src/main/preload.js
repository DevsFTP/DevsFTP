/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Electron Preload Script for DevSSH
 * Bridges Main process IPC capabilities to the Renderer process.
 */

const { contextBridge, ipcRenderer } = require('electron');

const devSSH = {
  // Profiles Management
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

  // Interactive SSH Terminal PTY
  terminal: {
    connect: (config, sessionId) => ipcRenderer.invoke('ssh:terminal-connect', config, sessionId),
    write: (data, sessionId) => ipcRenderer.send('ssh:terminal-write', data, sessionId),
    resize: (cols, rows, sessionId) => ipcRenderer.send('ssh:terminal-resize', { cols, rows }, sessionId),
    disconnect: (sessionId) => ipcRenderer.invoke('ssh:terminal-disconnect', sessionId),
    onData: (callback) => ipcRenderer.on('ssh:terminal-data', (_event, payload) => callback(payload)),
    onHostKeyVerifyRequest: (callback) => ipcRenderer.on('ssh:host-key-verify-request', (_event, data) => callback(data)),
    respondHostKeyVerify: (response) => ipcRenderer.send('ssh:host-key-verify-response', response)
  },

  // SSH Tunnels & Port Forwarding
  tunnels: {
    start: (rule) => ipcRenderer.invoke('tunnel:start', rule),
    stop: (tunnelId) => ipcRenderer.invoke('tunnel:stop', tunnelId),
    list: () => ipcRenderer.invoke('tunnel:list'),
    onLog: (callback) => ipcRenderer.on('tunnel:log', (_event, payload) => callback(payload))
  },

  // Dialogs & Utility Dialog APIs
  system: {
    selectFile: (options) => ipcRenderer.invoke('dialog:select-file', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options),
    openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
    quit: () => ipcRenderer.send('system:quit')
  }
};

contextBridge.exposeInMainWorld('devSSH', devSSH);
