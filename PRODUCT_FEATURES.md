# DevsFTP — Product Features (Website & Marketing Showcase)

DevsFTP is a modern, high-performance **Remote Development Workspace** built for developers who need fast SFTP/FTP connectivity, live local IDE editing, embedded terminal access, and automated background sync.

---

## 🌐 Protocols & Connectivity
1. **SFTP (SSH File Transfer Protocol)**: Native high-speed SSH file transfer engine.
2. **FTP & FTPS (TLS/SSL)**: Plain FTP, Explicit FTPS (TLS/SSL), and Implicit FTPS support.
3. **Active & Passive FTP Modes**: PASV and Active mode compatibility for NAT and firewall traversal.
4. **SOCKS4 / SOCKS5 Proxy Tunneling**: Route remote connections through enterprise proxies and jump hosts.
5. **Custom Port Support**: Connect to remote servers running on non-standard ports (e.g. 2222, 2121).
6. **Keep-Alive Heartbeats**: Automatic socket pinging to prevent idle session disconnects.
7. **Smart Reconnection Engine**: Auto-reconnect with exponential backoff on network dropouts.
8. **SSH Private Key Authentication**: RSA, ED25519, and ECDSA key files.
9. **Keyboard-Interactive Auth**: Challenge-response 2FA / PAM SSH login support.
10. **OpenSSH Config Importer**: 1-click import from `~/.ssh/config`.

---

## 🗂️ Workspace & Session Management
11. **Multi-Tab Remote Workspace**: Connect to multiple remote servers simultaneously in separate workspace tabs.
12. **Tab Session Persistence**: Auto-restore open workspace tabs on application launch.
13. **Dynamic 15-Color Swatch Selector**: Personalize workspace accent colors with 15 curated theme swatches.
14. **Profile Identity Styling**: Active profile color updates tab highlights, status bars, and profile badges.
15. **Recent Connections Menu**: Quick-connect dropdown listing recently accessed server profiles.
16. **Saved Profiles Manager**: Profile manager drawer to save, edit, search, and duplicate server profiles.

---

## 📂 Explorer & File Operations
17. **Side-by-Side Dual Pane**: Concurrent local file system and remote server file system view.
18. **Local Drive Dropdown**: Quick selector for Windows drive letters (`C:`, `D:`) and system roots.
19. **Home Folder Shortcuts**: Quick access to `Downloads`, `Documents`, `Desktop`, and `Pictures`.
20. **Interactive Path Breadcrumbs**: Clickable breadcrumbs for instant directory navigation.
21. **Column Sorting**: Sort by Name, Size, Type, or Date Modified (Ascending / Descending).
22. **Multi-Selection Tools**: Select multiple files via `Ctrl+Click`, `Shift+Click`, or `Ctrl+A`.
23. **Hidden Dotfiles Toggle**: Toolbar toggle to show/hide hidden files (`.htaccess`, `.env`, `.gitignore`).
24. **Remote File Permissions (Chmod)**: View and edit POSIX permission bits (`755`, `644`, `777`).
25. **Copy Remote Web URL**: 1-click copy of HTTP/HTTPS web URLs mapping to remote files.
26. **Open Containing Folder**: Open local file locations in native OS File Explorer.

---

## ⚡ Live Edit & IDE Auto-Upload
27. **Edit Remote Files in Local IDE**: Open remote files directly in VS Code, PhpStorm, Sublime Text, or Notepad++.
28. **Chokidar File System Watcher**: Background watcher detects file saves in external local IDEs.
29. **SHA-256 Hash Matching**: Prevents duplicate uploads by verifying file content hashes on save.
30. **Real-Time Auto-Upload on Save**: Edits saved in external IDEs upload to remote servers automatically.
31. **Browser Bypass File Exceptions**: Overrides browser handlers for `.html`, `.svg`, `.xml`, `.json`, and `.php`, routing them directly to code editors.
32. **Per-Extension IDE Mappings**: Map specific file extensions to custom code editor executables.
33. **Watcher Recovery Across Restarts**: Persistent manifests restore watch sessions on app launch.
34. **Recently Edited Files Panel**: Dedicated drawer panel displaying open and recent edit session files.
35. **Local Version Backup Snapshots**: Automatic timestamped `.bak` local backups created before uploading edits.

---

## 🚀 Transfer Queue & Conflict Engine
36. **Asynchronous Transfer Queue**: Non-blocking background queue for multi-file and folder transfers.
37. **Live Progress Bars & Metrics**: Real-time progress percentage, transfer speed (KB/s, MB/s), and ETA timers.
38. **Partial Transfer Resumption**: Resume interrupted uploads/downloads using byte range offsets.
39. **Recursive Folder Crawling**: Asynchronous directory tree crawling for bulk folder syncs.
40. **Conflict Resolution Policies**: Overwrite All, Skip Existing, Overwrite If Newer, or Prompt on Conflict.
41. **Interactive Conflict Dialog**: Side-by-side file size and timestamp comparison modal.
42. **Bandwidth Speed Throttling**: Configurable upload and download speed limits.
43. **Completed Queue History Log**: Dedicated "History" tab displaying past transfer logs.
44. **Visible Queue Retry Badges**: Live `Retry 1/3` counter badges on active transfer rows.

---

## 💻 Integrated SSH Terminal Shell
45. **Embedded Xterm.js Terminal**: Full-featured terminal emulator inside the bottom drawer.
46. **Direct SSH PTY Session**: PTY terminal session piped over active SSH connection.
47. **Terminal Font Customization**: Select Cascadia Code, Consolas, Fira Code, or Monospace fonts and sizes.
48. **Auto-Fit Terminal Addon**: Automatically recalculates terminal dimensions on window resize.

---

## ⚖️ Directory Comparison & Background Sync
49. **Side-by-Side Directory Diff**: Compares active local directory against active remote folder.
50. **Visual Status Badges**: Highlights Local Only, Remote Only, Local Newer, Remote Newer, and Size Mismatches.
51. **One-Click Directory Sync**: `⚡ Sync Selected Files` action automatically queues required transfers.
52. **Cron-Based Background Sync Jobs**: Create automated sync jobs using standard 5-field cron syntax (`*/5 * * * *`).
53. **Background Sync Runner Daemon**: Main process daemon executes scheduled sync jobs in the background.

---

## ⚙️ Preferences & Open-Source Licensing
54. **Dark Mode & Light Mode**: Charcoal Dark Mode and Light Mode visual themes.
55. **Native OS Notifications**: Desktop toast notifications on completed transfers and job alerts.
56. **Diagnostic Log Viewer**: Real-time IPC event logger, transfer engine logs, and error tracebacks.
57. **GNU GPL-3.0 Licensed**: 100% open-source software licensed under GNU General Public License v3.0.
