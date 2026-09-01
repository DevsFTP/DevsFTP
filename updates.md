# DevsFTP Update Log (08/24/2026 – 08/31/2026)

## 🌟 Feature Additions

### ⚡ Remote-to-Remote Direct Server Transfers
- Transfer files directly between two remote servers (e.g. SFTP ➔ S3, or FTP ➔ WebDAV) without downloading them to your local computer first.
- Automated stream piping and temporary buffer cleanup in background tasks.

### 📝 Pending Edits Watcher & Selective Startup Sync
- **External IDE Watcher**: Automatically detects when you save a remote file in VS Code, Sublime, or Notepad++ and syncs it back to the remote server.
- **Selective Startup Sync**: Redesigned `#batch-upload-modal` with individual profile checkboxes to choose which site profiles to sync on app launch.

### 📊 Bandwidth Limiter & Live Speed Sparklines
- **Dynamic Speed Caps**: Custom upload and download speed limits using high-performance stream throttling (`throttleTransform.js`).
- **Live Speed Sparklines**: Real-time visual graphs displaying instantaneous transfer speeds in the queue.

### 🔖 Bookmarks & Directory Shortcuts
- Bookmark remote paths across SFTP, FTP, WebDAV, and S3 protocols for 1-click navigation.

---

## 🛡️ Bug Fix Breakdown (43 Bugs Fixed Across 18 Files)

### Critical Severity (2 Fixes)
1. **Master Password Vault Fail-Closed Fix**: Changed credential vault verification (`verifyMasterPasswordIfEnabled`) so IPC failures deny access (fail-closed) instead of granting access.
2. **SOCKS5 Parser Bounds Check**: Added buffer bounds checks to `tunnelService.js` to prevent socket out-of-bounds crashes during SSH dynamic forwarding.

### High Severity (15 Fixes)
1. **AudioContext Exhaustion Leak**: Converted sound chime player in `transferQueue.js` to a singleton to prevent exceeding the browser's 6-AudioContext hardware limit.
2. **Windows File Lock Recovery**: Added 3-step async retry on `.part` file renames in `transferEngine.js` to prevent `EBUSY`/`EPERM` permission locks on Windows.
3. **Stream Error Scoping**: Fixed `readStream` scoping in `s3Service.js` and `webdavService.js` so error paths clean up file handles.
4. **Temp File Leaks**: Moved `r2r_temp_*` remote-to-remote temporary file cleanup to a `finally` block in `main.js`.
5. **Adapter Cancellation**: Wired `AbortController` cancellation signals across SFTP, FTP, WebDAV, and S3 adapters.

### Medium & Low Severity (26 Fixes)
- Fixed `URIError` on malformed WebDAV filenames.
- Added null guards on `batchTargetLocalDir` and `item.speed` undefined checks.
- Added missing error callbacks on `execFile` calls.
- Resolved chokidar watcher leaks and job runner type checks.

---

## 🔔 UI & Experience Enhancements

- **Top Menu Shortcuts**: Added `🔔 Notifications` directly to **Settings** and **Tools** top dropdown menus.
- **Cross-Platform Release Packages**: Production-ready binaries generated for **Windows** (`.exe` installer & portable) and **Linux** (`.deb`, `AppImage`, `.tar.gz`).
