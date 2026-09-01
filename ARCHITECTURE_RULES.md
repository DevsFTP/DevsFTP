# Architecture Rules — DevsFTP

## Verified Core Architecture Overview
DevsFTP is an Electron-based multi-protocol file transfer and remote development client. The application process model is structured into four distinct, verified layers:

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Renderer Layer                           │
│  (src/renderer/index.html, styles/main.css, src/renderer/js/*)  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ ContextBridge IPC (window.devsFTP)
┌────────────────────────────────▼────────────────────────────────┐
│                         Preload Bridge                          │
│                     (src/main/preload.js)                       │
└────────────────────────────────┬────────────────────────────────┘
                                 │ IPC Handlers (ipcMain)
┌────────────────────────────────▼────────────────────────────────┐
│                          Main Process                           │
│                       (src/main/main.js)                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Service Invocation
┌────────────────────────────────▼────────────────────────────────┐
│                        Services Layer                           │
│      (src/main/services/*, src/main/services/transfer/*)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Verified Component & Path Map

### Main Process & IPC Bridge
- **Main Entry**: `src/main/main.js` (IPC handlers, application lifecycle, native menus, window state)
- **Preload Bridge**: `src/main/preload.js` (ContextBridge exposing `window.devsFTP` and legacy alias `window.pulseFTP`)

### Backend Services (`src/main/services/`)
- Protocol Services: `ftpService.js`, `sftpService.js`, `s3Service.js`, `webdavService.js`
- Terminal & Tunnels: `sshTerminalService.js`, `tunnelService.js`, `sshConfigParser.js`
- Stores & Utilities: `profileStore.js`, `knownHostsStore.js`, `scheduledJobStore.js`, `jobRunnerService.js`, `cacheWatcherService.js`, `dirSizeService.js`, `exclusionService.js`, `pathUtils.js`

### Transfer Engine & Adapters (`src/main/services/transfer/`)
- Core Orchestrator: `transferEngine.js`
- Protocol Adapters: `ftpAdapter.js`, `sftpAdapter.js`, `s3Adapter.js`, `webdavAdapter.js`

---

## 2. IPC & Context Safety Boundaries
- **Preload Isolation**: All communication between Renderer and Main process must pass through explicit IPC channels defined in `src/main/preload.js` and registered in `src/main/main.js`.
- Do **NOT** bypass `preload.js` or expose raw Node.js primitives (`require('child_process')`, `fs`, `net`) directly to renderer scripts.
- Preserve existing IPC channel signatures when adding new capabilities.

---

## 3. Subsystem & Dependency Protection
- Core dependencies in `package.json` are architectural choices:
  - Protocol engines: `basic-ftp` (v5.0.5), `ssh2` (v1.16.0), `@aws-sdk/client-s3` (v3.1107.0), `webdav` (v5.7.0), `socks` (v2.8.9)
  - Local File & Terminal: `chokidar` (v3.6.0), `@xterm/xterm` (v5.5.0), `@xterm/addon-fit` (v0.10.0)
- Do **NOT** replace or swap out these core libraries without explicit owner approval.
- Keep helper utilities inside existing service boundaries before creating new modules.
