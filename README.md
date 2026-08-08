# DevsFTP — The SFTP & FTP Client for Windows

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Electron Version](https://img.shields.io/badge/Electron-v34.2-47848F?logo=electron)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)
[![Version](https://img.shields.io/badge/Version-1.0.0-emerald)](#)

> **The SFTP & FTP client for Windows that works with you, instead of against you.**

**DevsFTP** is a fast, reliable SFTP, FTP, FTPS, and WebDAV client built specifically for Windows. Instead of fighting session disconnects, forced browser launches, or clunky upload steps, DevsFTP works seamlessly alongside your workflow with **smart code editor live sync, persistent anti-disconnect keepalives, integrated SSH terminal, and automated job scheduling**.

Website: [DevsFTP.com](https://devsftp.com)

---

## ✨ Key Features & Highlights

### ⚡ Multi-Protocol & Tabbed Workspaces
- **SFTP, FTP & FTPS Support**: Connect securely via SSH File Transfer Protocol (SFTP) or FTP/FTPS (Explicit & Implicit TLS/SSL).
- **Concurrent Multi-Session Workspace**: Open multiple server connections simultaneously across independent workspace tabs with custom accent colors.
- **Session Tab Restoration Engine**: Automatically saves active tabs, working remote subfolders, and local paths, restoring your entire workspace upon relaunch.

### 📝 Live Remote File Editing & Auto-Sync
- **Seamless Local Editor Integration**: Edit remote files in your favorite system editor (VS Code, Notepad++, Sublime Text, PhpStorm).
- **Automated Cache Watcher Service**: Downloads files to an isolated edit cache, watches for local saves via SHA-256 hash comparison, and automatically re-uploads modified files to the remote server instantly.
- **Orphan Watcher Recovery & 7-Day TTL Garbage Collection**: Re-attaches watchers on app startup after crashes, while automatically purging un-watched cache files older than 7 days.

### ⏰ Autonomous Scheduled Tasks Engine
- **Background Job Runner Daemon**: Runs automated background syncs, backups, and file transfers on schedule.
- **Flexible Frequencies**: Run on app startup, recurring intervals (1 min to 24 hrs), or daily target time.
- **Direction-Aware Path Pickers**: Native Windows File Explorer folder/file selector (`📂 Browse OS...`) and 1-click active tab auto-fill (`📍 Active Local`, `📍 Active Remote`).
- **Real-Time Validation & Toast Notifications**: Prevents path orientation mistakes (e.g. Windows paths in remote Linux fields) and sends native Windows OS Toast Notifications on job completion or failure.

### 🖥️ Embedded Interactive SSH Terminal
- **xterm.js Integration**: Full interactive SSH terminal embedded directly inside DevsFTP.
- **1-Click Launch**: Launches terminal sessions pre-authenticated with your active connection profile.

### 🔍 Visual Directory Comparison & CHMOD Permissions
- **Side-by-Side Diff Grid**: Color-coded comparison showing New Local (Green), New Remote (Blue), and Modified files (Yellow) with 1-click sync buttons.
- **Unix CHMOD Permission Matrix**: Interactive numeric and checkbox matrix for Owner, Group, and Others permission bits.

### 🔒 Master Password Vault & Security
- **AES-256-GCM Vault**: Encrypts stored passwords and SSH key passphrases securely.
- **Host Key Verification**: Strict SSH fingerprint checking against persistent `known_hosts.json` to protect against Man-in-the-Middle (MitM) attacks.
- **OpenSSH Config Auto-Import**: 1-click auto-discovery and profile creation from system `~/.ssh/config`.

---

## 🛠️ Installation & Building

### System Requirements
- **Operating System**: Windows 10 / 11 (x64)
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Development Setup

```bash
# Clone repository
git clone https://github.com/DevsFTP/devsftp.git
cd devsftp

# Install dependencies
npm install

# Launch application in development mode
npm start
```

### Packaging & Executable Build

```bash
# Build standalone Windows unpackaged executable directory
npm run build:win
```

The output binary will be generated under `dist/win-unpacked/DevsFTP.exe`.

---

## 📁 Repository Structure

```
DevsFTP/
├── assets/                  # Icons and branding assets
├── src/
│   ├── main/                # Main Process (Electron IPC, SFTP/FTP drivers, Job Runner, Cache Watcher)
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── services/
│   └── renderer/            # Renderer Process (UI Layout, Theme Engine, Tab Manager, Modals)
│       ├── index.html
│       ├── css/
│       └── js/
├── LICENSE                  # GNU General Public License v3.0 (GPL-3.0)
├── package.json
└── README.md
```

---

## 📄 License

DevsFTP is open-source software licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE](LICENSE) file for details.

Copyright (C) 2026 [DevsFTP.com](https://devsftp.com)
