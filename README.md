# DevsFTP

### An FTP client that works with you, not against you.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Electron Version](https://img.shields.io/badge/Electron-v34.2-47848F?logo=electron)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)
[![Version](https://img.shields.io/badge/Version-1.0.0-emerald)](#)

DevsFTP is a developer-focused FTP/SFTP client built around the way developers actually work with remote files.

It doesn't ask you to redesign your workflow, configure complicated development environments, or change the tools you rely on. Connect to a server, work with your files, and let DevsFTP handle the small things that normally get in the way.

**Connect. Work. DevsFTP remembers.**

Website: [DevsFTP.com](https://devsftp.com)

---

## 💡 Why It Feels Different

Most FTP clients force you to adapt your workflow around the tool. DevsFTP takes the opposite approach: **We don't change your workflow. We help you move faster.**

### 📍 Pick up right where you left off
You don't need to configure a local workspace directory for every single profile. Start at `C:\`, navigate to wherever you actually work, and DevsFTP remembers where you left off. When you return to a session, DevsFTP puts you right back there.

### 🛠️ Work with the applications you already use
Whether you are opening a remote script in VS Code, Notepad++, or Sublime Text, or opening a remote asset in your operating system's default viewer, DevsFTP respects the application associations registered on your machine. You already have the tools—DevsFTP simply works with them.

### ⚡ Don't forget to upload
When a remote file has been edited and saved locally, DevsFTP recognizes that your saved changes haven't been uploaded yet and helps you finish the job. You remain in complete control with clear options:
- **Skip**
- **Rename**
- **Overwrite if newer**
- **Overwrite**

DevsFTP notices the work you already did and helps you finish it.

### 🖥️ SSH when you want it
SSH is an available capability for connections that support it. If a server connection supports SSH, an interactive terminal is ready in a click. If a connection doesn't support SSH, DevsFTP keeps out of the way.

### 🔀 Tunnels when you need them
Local and remote SSH port forwarding tunnels are ready when useful for your environment—available when needed, without cluttering normal file transfers.

### ⏰ Scheduled work when you want it
Automate background server syncs or backup tasks on your schedule. They are there when you want them, without becoming a mandatory part of your daily routine.

---

> **DevsFTP doesn't ask you to configure your workflow around the FTP client.**
> 
> **It learns useful things from what you already do and gets out of the way.**

---

## ✨ Key Features & Capabilities

DevsFTP combines essential file management with smart capabilities designed for developer productivity:

### ⚡ Multi-Protocol & Tabbed Sessions
- **SFTP, FTP, FTPS & WebDAV Support**: Connect securely via SSH File Transfer Protocol (SFTP), FTP/FTPS (Explicit & Implicit TLS/SSL), or WebDAV.
- **Concurrent Multi-Session Tabs**: Manage multiple server connections simultaneously across independent tabs with custom identity accent colors.
- **Session Tab Restoration Engine**: Automatically saves active tabs, working remote subfolders, and local paths, restoring your exact workspace upon relaunch.
- **Keepalive & Auto-Reconnect**: Proactive keepalives prevent session drops during long idle periods, backed by automatic background reconnect.

### 📝 Live Remote File Editing & Auto-Sync
- **Local Editor Integration**: Edit remote files directly in your preferred system editor (VS Code, Notepad++, Sublime Text, PhpStorm).
- **Automated Cache Watcher Service**: Downloads files to an isolated edit cache, watches for local saves, and automatically re-uploads modified files to the remote server.
- **Orphan Watcher Recovery**: Re-attaches watchers on app startup after unexpected shutdowns, with automatic 7-day cache cleanup.

### ⏰ Automated Scheduled Tasks
- **Background Job Runner Daemon**: Schedule recurring background syncs, backups, and file transfers (on startup, recurring intervals, or daily).
- **Direction-Aware Path Pickers**: Native Windows File Explorer folder selector (`📂 Browse OS...`) and 1-click active tab auto-fill (`📍 Active Local`, `📍 Active Remote`).
- **Native OS Toast Notifications**: Native Windows notifications on task completion or failure.

### 🖥️ SSH Terminal & Port Forwarding
- **xterm.js Terminal**: Interactive SSH terminal embedded directly inside DevsFTP, pre-authenticated with your active session.
- **SSH Tunnels Manager**: Configure local (L2R) and remote (R2L) port forwarding rules directly inside the panel drawer.

### 🔍 Visual Directory Comparison & Permissions
- **Side-by-Side Diff Grid**: Color-coded comparison showing New Local (Green), New Remote (Blue), and Modified files (Yellow) with 1-click sync.
- **Unix CHMOD Permission Matrix**: Interactive numeric and checkbox matrix for Owner, Group, and Others permission bits.

### 🔒 Master Password Vault & Security Architecture
- **AES-256-GCM Vault**: Encrypts stored connection passwords, passphrases, and SSH keys at rest using AES-256-GCM with PBKDF2 (100,000 iterations) key derivation.
- **Host Key Verification**: Strict SSH fingerprint checking against persistent `known_hosts` to prevent Man-in-the-Middle (MitM) attacks.
- **OpenSSH Config Auto-Import**: 1-click auto-discovery and profile import from system `~/.ssh/config`.
- **Zero Telemetry**: No user tracking, zero analytics, total privacy.

---

## 🛠️ Installation & Setup

### System Requirements
- **Operating System**: Windows 10 / 11 (x64)
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Development Setup

```bash
# Clone repository
git clone https://github.com/DevsFTP/DevsFTP.git
cd DevsFTP

# Install dependencies
npm install

# Launch application in development mode
npm start
```

### Packaging & Executable Build

```bash
# Build standalone Windows executable & setup installer
npm run build:win
```

The output executables will be generated under `dist/win-unpacked/DevsFTP.exe` and `dist/DevsFTP Setup 1.0.0.exe`.

---

## 📁 Repository Structure

```
DevsFTP/
├── assets/                  # Icons and branding assets
├── src/
│   ├── main/                # Main Process (IPC handlers, SFTP/FTP services, Job Runner, Cache Watcher)
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── services/
│   └── renderer/            # Renderer Process (UI Layout, Theme Engine, Tab Manager, Modals)
│       ├── index.html
│       ├── styles/
│       └── js/
├── LICENSE                  # GNU General Public License v3.0 (GPL-3.0)
├── package.json
└── README.md
```

---

## 📄 License

DevsFTP is open-source software licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE](LICENSE) file for details.

Copyright (C) 2026 [DevsFTP.com](https://devsftp.com). All rights reserved.
