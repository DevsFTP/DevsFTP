# What's New in DevsFTP v1.0.1 🚀

Welcome to **DevsFTP v1.0.1**! This release brings major new features, high-performance transfer capabilities, expanded protocol tools, and a comprehensive reliability audit ensuring peak stability.

---

## 🌟 Major New Features

### ⚡ Remote-to-Remote Direct Transfers
- Transfer files **directly between two remote servers** (e.g. SFTP to S3, or FTP to WebDAV) without downloading them to your local hard drive first.
- Automated temporary buffer cleanup and stream piping ensure ultra-fast, zero-clutter server migrations.

### 🔖 Bookmarks & Directory Shortcuts
- Bookmark your most frequently accessed remote paths across any protocol.
- Jump instantly to bookmarked folders from the quick-navigation bar or keyboard shortcuts.

### 📝 Pending Edits Manager & Auto-Sync
- **External Editor Watcher**: Edit remote files in your favorite local IDE (VS Code, Sublime, Notepad++). DevsFTP automatically detects local saves and syncs them back to the remote server.
- **Startup Unsaved Edits Prompt**: On launch, DevsFTP detects unsaved cached edits and prompts you with a selective profile checklist—choose exactly which server profiles to sync or dismiss.

### 📊 Bandwidth Limiter & Live Analytics
- **Dynamic Speed Caps**: Set custom upload and download speed limits on the fly using high-performance stream throttling.
- **Live Transfer Sparklines**: Real-time visual graphs displaying instantaneous transfer speeds, queue progress, and network utilization.

### 🔍 Directory Compare Tool
- **Side-by-Side Visual Diffing**: Compare local directory structures against remote server folders.
- **Color-Coded File States**: Instantly spot missing, newer, older, or modified files between local and remote.
- **One-Click Batch Sync**: Synchronize differing files directly from the comparison view.

### 🖥️ Integrated SSH Terminal & Multi-Protocol Support
- **Embedded Terminal**: Open full SSH terminal sessions directly inside DevsFTP.
- **Multi-Protocol Adapters**: Unified support for **SFTP**, **FTP / FTPS** (Passive & TLS), **WebDAV**, and **Amazon S3**.

---

## 🛡️ Reliability & Stability Improvements

Our comprehensive v1.0.1 reliability audit resolved **43 potential edge cases** across 18 core source files:

- **Fail-Closed Vault Security**: Master password verification fails closed on IPC errors, guaranteeing credential vault security.
- **Unlimited Audio Chimes**: Fixed AudioContext hardware limits to ensure transfer completion chimes play reliably across unlimited transfers.
- **Windows File Lock Recovery**: Added 3-step async retry handling on `.part` file renames to prevent `EBUSY` / `EPERM` permission locks on Windows.
- **SOCKS5 Proxy Hardening**: Added bounds checking and exception handling to prevent socket parser errors during dynamic tunnel forwarding.
- **Stream & Memory Leak Prevention**: Guaranteed cleanup of file descriptors, S3 read streams, and SSH sessions across all error paths.

---

## 🔔 UI & Experience Enhancements

- **Top Menu Shortcuts**: Quick access to `🔔 Notifications` directly from both **Settings** and **Tools** top dropdown menus.
- **Redesigned Batch Upload Modal**: Clean 1:1 layout matching the Delete Confirmation modal with individual profile checkboxes and a single **Close** button.
- **Cross-Platform Release Packages**: Production-ready binaries for **Windows** (`.exe` installer & portable) and **Linux** (`.deb`, `AppImage`, `.tar.gz`).
