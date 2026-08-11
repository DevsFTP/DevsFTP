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
You don't need to configure a local workspace directory for every single profile. Start at `C:\`, navigate to wherever you actually work, and DevsFTP remembers where you left off. When you return to a session tab, DevsFTP puts you right back there.

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

## ✨ Exhaustive Technical Feature Inventory

DevsFTP combines essential file management with smart capabilities designed for developer productivity:

### 🌐 Protocols & Connection Drivers
- **SFTP (SSH File Transfer Protocol)**: Full SFTP driver supporting password and RSA/ED25519 private key authentication.
- **FTP & FTPS**: Explicit and Implicit TLS/SSL encrypted FTP connection support.
- **WebDAV**: RFC 4918-compliant WebDAV driver for Nextcloud, ownCloud, Apache WebDAV, Synology NAS, and custom WebDAV endpoints.
- **Anti-Disconnect Keepalives**: Proactive keepalives prevent idle session disconnects, backed by automatic background reconnect.

### 🎨 Session Tabs & Profile Branding
- **Profile Accent Colors**: Assign custom identity accent colors to server profiles for instant visual identification across session tabs.
- **Per-Tab Automatic Local Directory Path Memory**: Remembers local directory navigation per tab (`session.localPath`) and restores your exact local folder location when switching tabs or restarting.
- **Multi-Session Tabbed Client**: Open multiple server connections simultaneously in tabbed views.
- **Session Tab Restoration Engine**: Automatically restores active tabs, working remote subfolders, and local paths upon app launch.
- **OpenSSH Config Auto-Import**: Auto-discovers and imports server profiles directly from system `~/.ssh/config`.
- **Profile Import & Export**: 1-click JSON backup and restoration for connection profiles.

### 🌓 Dynamic Theme-Respecting Assets & Windows 11 UI
- **Dynamic OS Theme-Respecting Icons**: Automatically switches between `icon_light.png` (bright mark for Dark OS themes) and `icon_dark.png` (dark mark for Light OS themes) via Electron `nativeTheme` listener.
- **Modern Windows 11 Interface**: Smooth CSS HSL color tokens, dark mode layout, glassmorphism design, and responsive panels.

### 📝 Live Remote File Editing & Synchronization
- **System Default Editor Integration**: Edit remote files in your preferred system editor (VS Code, Notepad++, Sublime Text, PhpStorm).
- **Automated Cache Watcher Service**: Downloads files to an isolated edit cache (`%AppData%\DevsFTP\devsftp_edit_cache`), watches for local saves via SHA-256 hash comparison, and automatically re-uploads modified files.
- **Auto-Upload Save Detection**: Notifies you when a local edit has changes, presenting clear choices (Skip, Rename, Overwrite if newer, Overwrite).
- **Orphan Watcher Recovery & 7-Day TTL Garbage Collection**: Re-attaches edit watchers on app startup after crashes and automatically purges un-watched cache files older than 7 days.

### 🖥️ SSH Terminal & Network Tunnels
- **Embedded Interactive SSH Terminal**: Powered by `xterm.js` with full terminal colors, PTY resize handling, and 1-click launch pre-authenticated with your active SSH profile.
- **SSH Port Forwarding Tunnels**: Configure local (L2R) and remote (R2L) port forwarding rules directly inside the panel drawer.

### ⏰ Background Scheduled Tasks Engine
- **Background Job Runner Daemon**: Schedule recurring background syncs, backups, and file transfers (on startup, recurring intervals 1m to 24h, or daily target time).
- **Direction-Aware Path Pickers**: Native Windows File Explorer folder/file selector (`📂 Browse OS...`) and 1-click active tab auto-fill (`📍 Active Local`, `📍 Active Remote`).
- **Orientation Validation & Toast Notifications**: Prevents path orientation mistakes (e.g. Windows paths in remote Linux fields) and sends native Windows OS Toast Notifications on job completion or failure.

### 🔍 Directory Inspection & Transfer Engine
- **Visual Directory Comparison**: Side-by-side local vs remote diff tool (`directoryCompare.js`) with color-coded status badges (New Local, New Remote, Modified) and 1-click sync actions.
- **Unix CHMOD Permission Matrix**: Interactive numeric and checkbox matrix for Owner, Group, and Others permission bits.
- **Multi-Threaded Transfer Queue**: Queued file transfer engine with 1.2-second debounced notification aggregator for multi-file transfers.
- **Instant Stream Cancellation**: Stream abort cancellation engine for instant `Cancel All` response.

### 🔒 Master Password Vault & Security
- **AES-256-GCM Vault**: Encrypts stored connection passwords, passphrases, and SSH keys at rest using AES-256-GCM with PBKDF2 (100,000 iterations) key derivation and startup unlock screen.
- **Strict SSH Host Key Fingerprint Verification**: Checks SSH public key fingerprints (SHA256 & MD5) against persistent `known_hosts` to prevent Man-in-the-Middle (MitM) attacks.
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
├── assets/                  # Icons and branding assets (icon_light.png, icon_dark.png, icon.ico)
├── scripts/                 # Clean build & Win32 PE metadata injection script (build_clean_exe.js)
├── src/
│   ├── main/                # Main Process (IPC handlers, SFTP/FTP/WebDAV services, Job Runner, Cache Watcher)
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

Copyright (C) 2026 [DevsFTP.com](https://devsftp.com). All rights reserved.
