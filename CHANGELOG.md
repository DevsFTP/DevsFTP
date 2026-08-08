# Changelog

All notable changes to **DevsFTP** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-08-01

### Added
- **Multi-Protocol Driver Support**: Full SFTP (SSH2) and FTP/FTPS (Explicit & Implicit TLS/SSL) connection drivers.
- **Multi-Session Tabbed Workspace**: Concurrent multi-server tab management with workspace tab state auto-restoration on launch.
- **Live Remote File Edit & Cache Watcher**: Isolated file caching, system default editor launching (`shell.openPath`), chokidar file save watching with SHA-256 hash detection, orphan watcher recovery, and automatic 7-day TTL garbage collection.
- **Autonomous Scheduled Tasks Daemon**: Background Job Runner Service (`jobRunnerService.js`) with frequency options (App Startup, Interval 1m-24h, Daily at target time), direction-aware path pickers (`📂 Browse OS...`, `📍 Active Local`, `📍 Active Remote`), real-time path validation, Windows Toast notifications, and theme-aware Delete Job modal (`#delete-job-modal`).
- **Interactive SSH Terminal**: Embedded `xterm.js` terminal connected to active server profiles.
- **Visual Directory Comparison**: Side-by-side local vs remote diff tool (`directoryCompare.js`) with color-coded status badges and 1-click sync actions.
- **Master Password Vault**: AES-256-GCM encrypted credential vault with master password unlock modal.
- **OpenSSH Config Import**: 1-click auto-discovery and import of `~/.ssh/config` profiles.
- **Profile Export/Import**: Full JSON profile backup and restoration.
- **Windows AppUserModelID Branding**: Registered `DevsFTP` app identity for native Windows Action Center Toast notifications.
- **Debounced Batch Transfer Notifications**: 1.2-second debounced notification aggregator for multi-file batch transfers to prevent notification storms.
- **Real-Time Stream Cancellation**: Stream abort cancellation engine for instant `Cancel All` response.
- **License**: Released under the **GNU General Public License v3.0 (GPL-3.0)** with source file header notices (`DevsFTP.com`).
