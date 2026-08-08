# DevsFTP — Capability Matrix (155 Implemented Capabilities)

This document presents the functional capability matrix of **DevsFTP**, enumerating all implemented features across protocols, UI components, file operations, queue engines, terminal subsystems, and sync structures.

---

## 1. 🌐 Protocols & Connection Capabilities
1. **SFTP Remote Protocol**: Native SSH File Transfer Protocol implementation via `ssh2`.
2. **FTP Plain Remote Protocol**: Unencrypted File Transfer Protocol via `basic-ftp`.
3. **FTPS Explicit (TLS/SSL)**: FTP over explicit TLS/SSL encryption.
4. **FTPS Implicit (SSL)**: FTP over implicit SSL encryption on dedicated secure ports (e.g. port 990).
5. **Active Mode FTP**: Server-initiated data connections for legacy firewall setups.
6. **Passive Mode FTP**: Client-initiated data connections (PASV) for modern NAT/firewall setups.
7. **Custom Port Selection**: Connect to SFTP/FTP servers running on non-standard ports (e.g. 2222, 2121).
8. **Configurable Connection Timeout**: Set socket connection and response timeout thresholds in milliseconds/seconds.
9. **Keep-Alive Heartbeats**: Periodic SSH/FTP ping packets to prevent idle connection dropouts.
10. **Reconnection Engine & Backoff**: Automatic retry logic with exponential backoff on unexpected socket drops.
11. **Passive-to-Active Fallback**: Automatic protocol fallback option when passive FTP connections are blocked by firewalls.
12. **SSH Password Fallback**: Option to fall back to password authentication if SSH key auth is rejected.
13. **Reconnect UI & Banner Overlay**: Real-time reconnection overlay displaying countdown timer (`Reconnecting in 5s...`) and network drop warning banner.

---

## 2. 🔑 Authentication & Profile Management
14. **Password Authentication**: Username and password login per connection profile.
15. **SSH Private Key Authentication**: RSA, ED25519, and ECDSA key file support (`.pem`, `.pub`, `.key`, `id_rsa`).
16. **Key Passphrase Prompt**: Decrypt passphrase-protected SSH private keys on connection attempt.
17. **Keyboard-Interactive Auth**: Interactive challenge-response handling for 2FA / PAM SSH logins.
18. **Anonymous FTP Login**: Connect to public anonymous FTP mirrors using `anonymous` username.
19. **OpenSSH Config Importer**: 1-click parser for `~/.ssh/config` importing Hosts, HostNames, Users, Ports, and IdentityFiles.
20. **Recent Connections Dropdown**: Quick-connect dropdown listing recently accessed server profiles with timestamps.
21. **Profile Store & Manager**: Saved profiles drawer with search filter, edit, duplicate, and 1-click connect buttons.
22. **Export Connection Profiles**: Export connection profiles to JSON backup file (`profile:export`).
23. **Import Connection Profiles**: Import connection profiles from JSON backup file (`profile:import`).
24. **Per-Profile Default Remote Path**: Configurable initial remote directory per profile (e.g. `/var/www/myproject`).
25. **Per-Profile Default Local Path**: Configurable initial local working directory per profile.
26. **Per-Profile Bandwidth Limits**: Custom upload/download speed limits per connection profile.

---

## 3. 🛡️ Proxy Infrastructure
27. **SOCKS4 Proxy Tunneling**: Route SFTP/FTP traffic through SOCKS4 proxies.
28. **SOCKS5 Proxy Tunneling**: Route traffic through authenticated SOCKS5 proxies.

---

## 4. 🗂️ Workspace Layout & State Persistence
29. **Multi-Tab Remote Sessions**: Connect to multiple independent remote servers concurrently in separate tabs.
30. **Tab Connection Status Badges**: Live connection status dots (`Green = Connected`, `Red = Disconnected`, `Amber = Connecting`) per tab.
31. **Session Tab Persistence**: Auto-restore last open workspace tabs on application launch (`pref-restore-tabs`).
32. **Remembered Window Bounds**: Saves and restores application window width, height, position, and maximized state across restarts.
33. **Remembered Bottom Drawer State**: Saves and restores bottom drawer height, tab selection, and expanded/minimized state.
34. **Dynamic 15-Color Swatch Selector**: Custom profile accent selector with 15 curated color swatches (`#68a063` brand default).
35. **Profile Identity Styling**: Active profile accent color dynamically updates active tab lines, status bars, and profile badges.
36. **Last-Used Local Path Memory**: Persists and restores last active local directory path (`devsftp_last_local_path`).
37. **Last-Used Remote Path Memory**: Persists and restores last active remote directory path per profile.
38. **Favorite / Bookmarked Paths**: Quick Access Favorites menu (`⭐ Add to Favorites`) for frequent local and remote folders.

---

## 📂 5. Local File Explorer & Actions
39. **Split Dual-Pane Layout**: Side-by-side local file system and remote server file system view.
40. **Local Drive Dropdown**: Quick selector for Windows drive letters (`C:`, `D:`, etc.) and system roots.
41. **Home Folder Shortcuts**: Instant navigation buttons for `Downloads`, `Documents`, `Desktop`, and `Pictures`.
42. **Clickable Path Breadcrumbs**: Interactive breadcrumb navigation bar for local folders.
43. **Parent Directory Navigation**: `..` parent folder button and double-click navigation.
44. **Path Filter Bar**: Real-time text search filter for local files/folders (`Ctrl+F`).
45. **Column Sorting**: Sort local files by Name, Size, Type, or Date Modified (Ascending / Descending).
46. **Multi-Selection**: Select multiple items via `Ctrl+Click`, `Shift+Click`, or `Ctrl+A`.
47. **File Type Icons**: Visual icons distinguishing folders, code files, images, archives, and documents.
48. **Open Local Location**: Open containing folder in native OS File Explorer (`shell.showItemInFolder`).
49. **Open with Default App**: Launch file using native OS default application association (`shell.openPath`).
50. **Copy Absolute Local Windows Path**: 1-click copy of Windows path (`C:\xampp\htdocs\...`) to clipboard.
51. **Copy Local File URI**: 1-click copy of File URI (`file:///C:/xampp/...`) to clipboard.
52. **Native OS File / Directory Dialogs**: Open native OS file picker (`dialog:openFile`) and folder picker (`dialog:openDirectory`).
53. **Selection Persistence After Refresh**: Remembers and restores file row highlights after reloading directory listings.

---

## ☁️ 6. Remote File Explorer & Actions
54. **Remote Directory Tree Navigation**: Browse remote server directory hierarchy.
55. **Clickable Remote Breadcrumbs**: Interactive breadcrumb path bar for remote directories.
56. **Remote Path Filter Bar**: Real-time text search filter for remote files/folders.
57. **Column Sorting**: Sort remote files by Name, Size, Type, or Date Modified.
58. **Copy Absolute Remote Path**: 1-click copy of absolute remote POSIX filepath (`/var/www/...`) to clipboard.
59. **Copy Remote Web URL**: 1-click copy of HTTP/HTTPS web URL mapping for remote files.
60. **Cache-Busting Directory Refresh**: Reload button and shortcut (`F5` / `Ctrl+R`) to fetch fresh remote listings.
61. **Remote Hidden File Toggle**: Toolbar toggle button to show or hide dotfiles (`.htaccess`, `.env`, `.gitignore`).
62. **Remote File Permissions (Chmod)**: View and modify remote file/folder POSIX permission bits (`755`, `644`, `777`).
63. **Recursive Directory Size Calculation**: Calculate total cumulative size of remote folder trees before transfer (`transfer:calculateDirectorySize`).

---

## 🖱️ 7. Context Menus & Drag-and-Drop UX
64. **Local File Context Menu**: Open, Open with Default App, Open With... Custom App, Edit in Local IDE, Upload, Rename (`F2`), Delete (`Delete`), Create Folder, Create File, Copy Local Path, Open Containing Folder, Properties.
65. **Remote File Context Menu**: Download, Edit in Local IDE, Open With... Custom App, Rename (`F2`), Delete (`Delete`), Create Folder, Create File, Copy Remote Path, Copy Remote URL, Change Permissions (`Chmod`), Refresh (`F5`).
66. **Per-File / Per-Folder "Open With" Overrides**: Dedicated "Open With..." menu item opening a custom application picker modal to override default app handlers.
67. **Queue Context Menu**: Pause Transfer, Resume Transfer, Remove from Queue, Retry Failed, Clear Completed, Change Priority.
68. **Terminal Context Menu**: Copy, Paste, Clear Screen, Select All.
69. **Drag & Drop Local to Remote**: Drag local files directly into remote pane for instant upload.
70. **Drag & Drop Remote to Local**: Drag remote files directly into local pane for instant download.
71. **Drag & Drop to Queue**: Drag items directly onto the transfer queue drawer.
72. **Drag & Drop SSH Key File**: Drag `.pem` or `id_rsa` key files directly into connection modal.
73. **Drag Drop Zone Visual Feedback**: Highlight outline (`drag-over` CSS style) on table rows, parent directory `..`, and queue drawer during drag operations.

---

## ⌨️ 8. Keyboard Navigation & Shortcuts
74. **`Ctrl+A`**: Select all items in active pane.
75. **`Ctrl+F` / `F3`**: Focus path search filter bar.
76. **`F5` / `Ctrl+R`**: Refresh active local or remote directory listing.
77. **`Ctrl+N`**: Open New Connection dialog.
78. **`Ctrl+W`**: Close active workspace tab.
79. **`Ctrl+T`**: Open new blank session tab.
80. **`Delete`**: Delete selected files/folders.
81. **`F2`**: Rename selected file/folder.
82. **`Esc`**: Close open modal, dialog, or drawer popup.
83. **Arrow Keys Navigation**: Up/Down arrow keys navigate file list table rows.
84. **`Enter` Key Action**: Open selected folder or trigger default file action.
85. **`Tab` / `Shift+Tab` Cycle**: Cycle keyboard focus sequentially across modal form inputs.
86. **Focus Restoration After Modal Close**: Automatically restores keyboard focus to previously active element (table/input) when closing modals.

---

## ⚡ 9. Live Edit, IDE Pipeline & Cache Watcher
87. **Edit Remote File in Local IDE**: Open remote files directly in local editor (VS Code, PhpStorm, Sublime Text, Notepad++).
88. **Editor Fallback Pipeline**:
    - **Step 1**: Launch user-configured custom IDE path (`code.cmd`, `phpstorm.exe`).
    - **Step 2**: If no custom path is set, launch native OS default registered app (`shell.openPath`).
    - **Step 3**: If OS default fails, fall back to built-in read-only preview modal.
89. **Browser Bypass File Exceptions**: Overrides default Windows browser handlers for `.html`, `.svg`, `.xml`, `.json`, and `.php` files, routing them directly to code editors instead of web browsers.
90. **Configurable Extension IDE Mappings**: Set specific IDE executable paths per file extension (`.php`, `.js`, `.py`, `.json`, `.css`, `.html`, `.sh`, `.yml`).
91. **Local Cache System**: Temporary local cache directory (`%AppData%/DevsFTP/devsftp_edit_cache`) preserving path structure.
92. **Chokidar File System Watcher**: Real-time background file watcher monitoring open cache files.
93. **SHA-256 Hash Matching**: Calculates file hashes on save to detect genuine edits and prevent unnecessary uploads.
94. **Real-Time Auto-Upload on Save**: Saving changes in external IDE automatically uploads modified files to remote server.
95. **Watcher Lifecycle Management**: Watcher daemon remains active in main process when switching workspace tabs; unbinds watcher on explicit file close.
96. **Persistent Watcher Recovery**: `.meta.json` manifests recover open watch files across application restarts so unclosed file edits resume sync watching.
97. **Recently Edited Files Panel**: Dedicated list (`devsftp_recent_edits`) in the cache watcher drawer displaying open and recent edit session files.
98. **Local File Version Snapshots & Backups**: Automatically creates timestamped `.bak` local snapshot backup copies in `%AppData%/DevsFTP/devsftp_edit_cache/backups` prior to uploading edits.
99. **Live Edit Upload Confirmation Modal**: Optional prompt (`Upload Saved Changes?`) with "Always Upload Automatically on Save" checkbox setting remembered in preferences (`pref-auto-upload-always`).

---

## 🚀 10. Asynchronous Queue & Conflict Engine
100. **Asynchronous Transfer Queue**: Non-blocking background queue for multi-file and directory uploads/downloads.
101. **Live Progress Bars**: Percentage progress indicators per item and overall queue.
102. **Transfer Speed Meter**: Real-time transfer speed calculation in KB/s and MB/s.
103. **ETA Countdown Timer**: Estimated time remaining calculation per file and total queue.
104. **Item Status Tracking**: States: `Queued`, `Transferring`, `Completed`, `Failed`, `Paused`.
105. **Queue Management Controls**: Start All, Pause All, Clear Completed, and Remove Queue Item buttons.
106. **Completed Transfer History Log View**: Dedicated "History" tab in the Transfer Queue drawer displaying completed and failed transfer logs with timestamp filter.
107. **Visible Queue Retry Badges**: Visible `Retry 1/3`, `Retry 2/3` counter badges rendered directly on transfer queue item rows.
108. **Partial Transfer Resumption**: Resumes interrupted uploads/downloads using byte range offsets (`REST` for FTP, `offset` for SFTP).
109. **Recursive Folder Crawling**: Asynchronous directory tree crawling for bulk folder transfers.
110. **Chunk Level Retry Logic**: Automatic retry (up to 3 attempts) for failed transfer chunks before failing item.
111. **Bandwidth Speed Throttling**: Configure maximum upload/download speed limits (`transfer:setSpeedLimit`).
112. **Conflict Resolution Policy**: Policy selector (`Prompt`, `Overwrite All`, `Skip Existing`, `Overwrite If Newer`).
113. **Interactive Conflict Dialog**: Side-by-side comparison modal displaying source vs destination file sizes, timestamps, and batch apply toggles.
114. **Batch Apply Conflict Toggle**: "Remember decision for remaining files" checkbox in file conflict dialog.

---

## 💻 11. Integrated SSH Terminal Subsystem
115. **Embedded Xterm.js Shell**: Full-featured terminal emulator inside the bottom drawer.
116. **Direct PTY Stream Piped**: Interactive PTY terminal shell piped over active SSH connection.
117. **Terminal Font Family**: Select Cascadia Code, Consolas, Fira Code, or Monospace fonts.
118. **Terminal Font Size Controls**: Adjust font size in pixels.
119. **Terminal Auto-Fit Addon**: Automatically recalculates columns/rows on window or drawer resize (`@xterm/addon-fit`).
120. **Drawer Minimize / Maximize**: Toggle terminal drawer size between minimized, custom height, and maximized.

---

## ⚖️ 12. Directory Comparison Engine
121. **Side-by-Side Local vs Remote Diff**: Compares active local folder against active remote folder.
122. **Visual Status Badges**: Classifies files into `Local Only`, `Remote Only`, `Local Newer`, `Remote Newer`, `Size Mismatch`, and `Identical`.
123. **Filter View Toggling**: Toggle display between `All Files` and `Differences Only`.
124. **Interactive Diff Summary Modal**: Modal displaying total files compared, total differences count, and identical count.
125. **One-Click Bulk Sync Action**: `⚡ Sync Selected Files` button automatically queues required uploads or downloads in the Transfer Queue.

---

## ⏱️ 13. Cron-Based Background Sync Jobs
126. **Persistent Job Store**: Save automated sync jobs in `%AppData%/DevsFTP/scheduled_jobs.json`.
127. **5-Field Cron Support**: Standard 5-field cron syntax (`*/5 * * * *`).
128. **Preset Frequency Options**: On App Startup, Interval (Minutes), Daily at Exact Time, One-Shot Timestamp.
129. **Background Job Runner Daemon**: Main process background service checking schedules every 10 seconds.
130. **Execution Log History**: Log history recording execution timestamps, statuses (`Success`, `Failed`), and error outputs.
131. **Manual Job Controls**: "Run Now" button to execute any job on demand, and "Run All Active" button.

---

## 📊 14. Status Bar & UI Indicators
132. **Connection Indicator Dot**: Live status badge (`Green = Connected`, `Red = Disconnected`, `Amber = Connecting`).
133. **Selection & Size Summary Text**: Footer detail text displaying selected item count and total byte size (e.g. `3 items selected (42.5 MB)`).
134. **IPC Latency Indicator**: Status bar latency readout (e.g. `Connected (12ms)`).
135. **Transfer Queue Summary Bar**: Footer indicator displaying active transfer count, total speed (KB/s), and total remaining bytes.
136. **Status Bar Notification Text**: Real-time status text line displaying latest system actions or operation results.

---

## ⚙️ 15. Preferences, Notifications & Diagnostics
137. **Visual Mode Palette**: Charcoal Dark Mode and Light Mode themes.
138. **Native OS Notifications**: Desktop toast notifications on completed transfers or background job alerts.
139. **Audio Chime Alerts**: Customizable sound chime alerts on operation completion.
140. **Diagnostic Log Viewer**: Real-time IPC event logger, transfer engine logs, and error tracebacks.
141. **Log Actions**: Clear Log, Save Log to File, and Search Log text filter.
142. **Software Update Checker**: Automatic release update checker querying remote update endpoint (`updater:check`).
143. **Open External Web Links**: Safe IPC handler for opening external web links in default system browser (`shell:openExternal`).
144. **App Version & Path Queries**: Query app version (`app:getVersion`), executable path, and AppData directory (`app:getUserDataPath`).
145. **Custom Window Controls**: Window minimize, maximize/restore, and quit controls (`app:minimize`, `app:maximize`, `app:quit`).
146. **"Don't Show Again" Preference Suppressions**: Suppress delete confirmation dialog (`pref-suppress-delete-confirm`).

---

## ⚠️ 16. Empty-State Messages & Error Handling
147. **Empty Directory Placeholder**: Rendered empty-state graphic and message (`📁 Empty Directory — No files found`).
148. **Search Filter Empty State**: Placeholder when search filter yields zero results (`🔍 No items match your search filter`).
149. **Permission Denied Error Handling**: User alert banner for access denial (`🔒 Permission Denied EACCES/EPERM`).
150. **Timeout & Network Error Handling**: Banner for connection timeouts (`⚠️ Connection Timed Out ETIMEDOUT`).

---

## 📜 17. Open-Source Suite & Assets
151. **GNU GPL-3.0 License Coverage**: Full GPL-3.0 license headers across all source files, `LICENSE` document, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `.github/` templates.
152. **Transparent Vector Branding & Installers**: Multi-resolution `icon.ico`, 512x512 transparent PNG `icon.png`, SVG vector logo, and custom NSIS setup wizard graphics (`installerHeader.png`, `installerSidebar.png`).
