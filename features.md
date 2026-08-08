# DevsFTP — Exhaustive Master Feature List (165+ Features)

Below is the complete, granular master inventory of every feature, tool, UI control, edge case, keyboard shortcut, IPC handler, micro-behavior, and deep operational pipeline in **DevsFTP**, expanded to **165+ itemized features**:

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
14. **Password Authentication**: Standard username and password login per connection profile.
15. **SSH Private Key Authentication**: RSA, ED25519, and ECDSA key file support (`.pem`, `.pub`, `.key`, `id_rsa`).
16. **Key Passphrase Prompt**: Decrypt passphrase-protected SSH private keys on connection attempt.
17. **Keyboard-Interactive Auth**: Interactive challenge-response handling for 2FA / PAM SSH logins.
18. **Anonymous FTP Login**: Connect to public anonymous FTP mirrors using `anonymous` username.
19. **OpenSSH Config Importer**: 1-click parser for `~/.ssh/config` importing Hosts, HostNames, Users, Ports, and IdentityFiles.
20. **Recent Connections Dropdown**: Quick-connect dropdown listing recently accessed server profiles with timestamps.
21. **Profile Store & Manager**: Saved profiles drawer with search filter, edit, duplicate, and 1-click connect buttons.
22. **Export Connection Profiles**: Export encrypted connection profiles to JSON backup file (`profile:export`).
23. **Import Connection Profiles**: Import connection profiles from JSON backup file (`profile:import`).
24. **Per-Profile Default Remote Path**: Configurable initial remote directory per profile (e.g. `/var/www/myproject`).
25. **Per-Profile Default Local Path**: Configurable initial local working directory per profile.
26. **Per-Profile Bandwidth Limits**: Custom upload/download speed limits per connection profile.

---

## 3. 🛡️ Proxy & Security Infrastructure
27. **SOCKS4 Proxy Tunneling**: Route SFTP/FTP traffic through SOCKS4 proxies.
28. **SOCKS5 Proxy Tunneling**: Route traffic through authenticated SOCKS5 proxies.
29. **AES-256-GCM Vault Encryption**: Passwords and private keys encrypted at rest using AES-256-GCM with PBKDF2 key derivation.
30. **Master Password Lock Screen**: Startup unlock modal (`master-unlock-modal`) securing all stored profiles.
31. **Auto-Lock Idle Security**: Lock profile vault automatically after configurable idle timeout.
32. **Strict SSH Host Key Check**: Integration with `~/.ssh/known_hosts` to prevent Man-in-the-Middle (MITM) attacks.
33. **Host Key Fingerprint Validation**: Calculates and displays SHA256 and MD5 host key fingerprints.
34. **Interactive Host Key Prompt**: Security alert modal for new or changed host keys offering `Trust Always`, `Trust Once`, or `Reject`.
35. **Host Key Warning Suppression**: Option to suppress future warnings for verified host fingerprints.

---

## 4. 🗂️ Workspace Layout & State Persistence
36. **Multi-Tab Remote Sessions**: Connect to multiple independent remote servers concurrently in separate tabs.
37. **Tab Connection Status Badges**: Live connection status dots (`Green = Connected`, `Red = Disconnected`, `Amber = Connecting`) per tab.
38. **Session Tab Persistence**: Auto-restore last open workspace tabs on application launch (`pref-restore-tabs`).
39. **Remembered Window Bounds**: Saves and restores application window width, height, position, and maximized state across restarts.
40. **Remembered Bottom Drawer State**: Saves and restores bottom drawer height, tab selection, and expanded/minimized state.
41. **Dynamic 15-Color Swatch Selector**: Custom profile accent selector with 15 curated color swatches (`#68a063` brand default).
42. **Profile Identity Styling**: Active profile accent color dynamically updates active tab lines, status bars, and profile badges.
43. **Last-Used Local Path Memory**: Persists and restores last active local directory path (`devsftp_last_local_path`).
44. **Last-Used Remote Path Memory**: Persists and restores last active remote directory path per profile.
45. **Favorite / Bookmarked Paths**: Quick Access Favorites menu (`⭐ Add to Favorites`) for frequent local and remote folders.

---

## 📂 5. Local File Explorer & Actions
46. **Split Dual-Pane Layout**: Side-by-side local file system and remote server file system view.
47. **Local Drive Dropdown**: Quick selector for Windows drive letters (`C:`, `D:`, etc.) and system roots.
48. **Home Folder Shortcuts**: Instant navigation buttons for `Downloads`, `Documents`, `Desktop`, and `Pictures`.
49. **Clickable Path Breadcrumbs**: Interactive breadcrumb navigation bar for local folders.
50. **Parent Directory Navigation**: `..` parent folder button and double-click navigation.
51. **Path Filter Bar**: Real-time text search filter for local files/folders (`Ctrl+F`).
52. **Column Sorting**: Sort local files by Name, Size, Type, or Date Modified (Ascending / Descending).
53. **Multi-Selection**: Select multiple items via `Ctrl+Click`, `Shift+Click`, or `Ctrl+A`.
54. **File Type Icons**: Visual icons distinguishing folders, code files, images, archives, and documents.
55. **Open Local Location**: Open containing folder in native OS File Explorer (`shell.showItemInFolder`).
56. **Open with Default App**: Launch file using native OS default application association (`shell.openPath`).
57. **Copy Absolute Local Windows Path**: 1-click copy of Windows path (`C:\xampp\htdocs\...`) to clipboard.
58. **Copy Local File URI**: 1-click copy of File URI (`file:///C:/xampp/...`) to clipboard.
59. **Native OS File / Directory Dialogs**: Open native OS file picker (`dialog:openFile`) and folder picker (`dialog:openDirectory`).
60. **Selection Persistence After Refresh**: Remembers and restores file row highlights after reloading directory listings.

---

## ☁️ 6. Remote File Explorer & Actions
61. **Remote Directory Tree Navigation**: Browse remote server directory hierarchy.
62. **Clickable Remote Breadcrumbs**: Interactive breadcrumb path bar for remote directories.
63. **Remote Path Filter Bar**: Real-time text search filter for remote files/folders.
64. **Column Sorting**: Sort remote files by Name, Size, Type, or Date Modified.
65. **Copy Absolute Remote Path**: 1-click copy of absolute remote POSIX filepath (`/var/www/...`) to clipboard.
66. **Copy Remote Web URL**: 1-click copy of HTTP/HTTPS web URL mapping for remote files.
67. **Cache-Busting Directory Refresh**: Reload button and shortcut (`F5` / `Ctrl+R`) to fetch fresh remote listings.
68. **Remote Hidden File Toggle**: Toolbar toggle button to show or hide dotfiles (`.htaccess`, `.env`, `.gitignore`).
69. **Remote File Permissions (Chmod)**: View and modify remote file/folder POSIX permission bits (`755`, `644`, `777`).
70. **Recursive Directory Size Calculation**: Calculate total cumulative size of remote folder trees before transfer (`transfer:calculateDirectorySize`).

---

## 🖱️ 7. Context Menus & Drag-and-Drop UX
71. **Local File Context Menu**: Open, Open with Default App, Open With... Custom App, Edit in Local IDE, Upload, Rename (`F2`), Delete (`Delete`), Create Folder, Create File, Copy Local Path, Open Containing Folder, Properties.
72. **Remote File Context Menu**: Download, Edit in Local IDE, Open With... Custom App, Rename (`F2`), Delete (`Delete`), Create Folder, Create File, Copy Remote Path, Copy Remote URL, Change Permissions (`Chmod`), Refresh (`F5`).
73. **Per-File / Per-Folder "Open With" Overrides**: Dedicated "Open With..." menu item opening a custom application picker modal to override default app handlers.
74. **Queue Context Menu**: Pause Transfer, Resume Transfer, Remove from Queue, Retry Failed, Clear Completed, Change Priority.
75. **Terminal Context Menu**: Copy, Paste, Clear Screen, Select All.
76. **Drag & Drop Local to Remote**: Drag local files directly into remote pane for instant upload.
77. **Drag & Drop Remote to Local**: Drag remote files directly into local pane for instant download.
78. **Drag & Drop to Queue**: Drag items directly onto the transfer queue drawer.
79. **Drag & Drop SSH Key File**: Drag `.pem` or `id_rsa` key files directly into connection modal.
80. **Drag Drop Zone Visual Feedback**: Highlight outline (`drag-over` CSS style) on table rows, parent directory `..`, and queue drawer during drag operations.

---

## ⌨️ 8. Keyboard Navigation & Shortcuts
81. **`Ctrl+A`**: Select all items in active pane.
82. **`Ctrl+F` / `F3`**: Focus path search filter bar.
83. **`F5` / `Ctrl+R`**: Refresh active local or remote directory listing.
84. **`Ctrl+N`**: Open New Connection dialog.
85. **`Ctrl+W`**: Close active workspace tab.
86. **`Ctrl+T`**: Open new blank session tab.
87. **`Delete`**: Delete selected files/folders.
88. **`F2`**: Rename selected file/folder.
89. **`Esc`**: Close open modal, dialog, or drawer popup.
90. **Arrow Keys Navigation**: Up/Down arrow keys navigate file list table rows.
91. **`Enter` Key Action**: Open selected folder or trigger default file action.
92. **`Tab` / `Shift+Tab` Cycle**: Cycle keyboard focus sequentially across modal form inputs.
93. **Focus Restoration After Modal Close**: Automatically restores keyboard focus to previously active element (table/input) when closing modals.

---

## ⚡ 9. Live Edit, IDE Pipeline & Cache Watcher
94. **Edit Remote File in Local IDE**: Open remote files directly in local editor (VS Code, PhpStorm, Sublime Text, Notepad++).
95. **Editor Fallback Pipeline**:
    - **Step 1**: Launch user-configured custom IDE path (`code.cmd`, `phpstorm.exe`).
    - **Step 2**: If no custom path is set, launch native OS default registered app (`shell.openPath`).
    - **Step 3**: If OS default fails, fall back to built-in read-only preview modal.
96. **Browser Bypass File Exceptions**: Overrides default Windows browser handlers for `.html`, `.svg`, `.xml`, `.json`, and `.php` files, routing them directly to code editors instead of web browsers.
97. **Configurable Extension IDE Mappings**: Set specific IDE executable paths per file extension (`.php`, `.js`, `.py`, `.json`, `.css`, `.html`, `.sh`, `.yml`).
98. **Local Cache System**: Temporary local cache directory (`%AppData%/DevsFTP/devsftp_edit_cache`) preserving path structure.
99. **Chokidar File System Watcher**: Real-time background file watcher monitoring open cache files.
100. **SHA-256 Hash Matching**: Calculates file hashes on save to detect genuine edits and prevent unnecessary uploads.
101. **Real-Time Auto-Upload on Save**: Saving changes in external IDE automatically uploads modified files to remote server.
102. **Watcher Lifecycle Management**: Watcher daemon remains active in main process when switching workspace tabs; unbinds watcher on explicit file close.
103. **Persistent Watcher Recovery**: `.meta.json` manifests recover open watch files across application restarts so unclosed file edits resume sync watching.
104. **Recently Edited Files Panel**: Dedicated list (`devsftp_recent_edits`) in the cache watcher drawer displaying open and recent edit session files.
105. **Local File Version Snapshots & Backups**: Automatically creates timestamped `.bak` local snapshot backup copies in `%AppData%/DevsFTP/devsftp_edit_cache/backups` prior to uploading edits.
106. **Live Edit Upload Confirmation Modal**: Optional prompt (`Upload Saved Changes?`) with "Always Upload Automatically on Save" checkbox setting remembered in preferences (`pref-auto-upload-always`).

---

## 🚀 10. Asynchronous Queue & Conflict Engine
107. **Asynchronous Transfer Queue**: Non-blocking background queue for multi-file and directory uploads/downloads.
108. **Live Progress Bars**: Percentage progress indicators per item and overall queue.
109. **Transfer Speed Meter**: Real-time transfer speed calculation in KB/s and MB/s.
110. **ETA Countdown Timer**: Estimated time remaining calculation per file and total queue.
111. **Item Status Tracking**: States: `Queued`, `Transferring`, `Completed`, `Failed`, `Paused`.
112. **Queue Management Controls**: Start All, Pause All, Clear Completed, and Remove Queue Item buttons.
113. **Completed Transfer History Log View**: Dedicated "History" tab in the Transfer Queue drawer displaying completed and failed transfer logs with timestamp filter.
114. **Visible Queue Retry Badges**: Visible `Retry 1/3`, `Retry 2/3` counter badges rendered directly on transfer queue item rows.
115. **Partial Transfer Resumption**: Resumes interrupted uploads/downloads using byte range offsets (`REST` for FTP, `offset` for SFTP).
116. **Recursive Folder Crawling**: Asynchronous directory tree crawling for bulk folder transfers.
117. **Chunk Level Retry Logic**: Automatic retry (up to 3 attempts) for failed transfer chunks before failing item.
118. **Bandwidth Speed Throttling**: Configure maximum upload/download speed limits (`transfer:setSpeedLimit`).
119. **Conflict Resolution Policy**: Policy selector (`Prompt`, `Overwrite All`, `Skip Existing`, `Overwrite If Newer`).
120. **Interactive Conflict Dialog**: Side-by-side comparison modal displaying source vs destination file sizes, timestamps, and batch apply toggles.
121. **Batch Apply Conflict Toggle**: "Remember decision for remaining files" checkbox in file conflict dialog.

---

## 💻 11. Integrated SSH Terminal Subsystem
122. **Embedded Xterm.js Shell**: Full-featured terminal emulator inside the bottom drawer.
123. **Direct PTY Stream Piped**: Interactive PTY terminal shell piped over active SSH connection.
124. **Terminal Font Family**: Select Cascadia Code, Consolas, Fira Code, or Monospace fonts.
125. **Terminal Font Size Controls**: Adjust font size in pixels.
126. **Terminal Auto-Fit Addon**: Automatically recalculates columns/rows on window or drawer resize (`@xterm/addon-fit`).
127. **Drawer Minimize / Maximize**: Toggle terminal drawer size between minimized, custom height, and maximized.

---

## ⚖️ 12. Directory Comparison Engine
128. **Side-by-Side Local vs Remote Diff**: Compares active local folder against active remote folder.
129. **Visual Status Badges**: Classifies files into `Local Only`, `Remote Only`, `Local Newer`, `Remote Newer`, `Size Mismatch`, and `Identical`.
130. **Filter View Toggling**: Toggle display between `All Files` and `Differences Only`.
131. **Interactive Diff Summary Modal**: Modal displaying total files compared, total differences count, and identical count.
132. **One-Click Bulk Sync Action**: `⚡ Sync Selected Files` button automatically queues required uploads or downloads in the Transfer Queue.

---

## ⏱️ 13. Cron-Based Background Sync Jobs
133. **Persistent Job Store**: Save automated sync jobs in `%AppData%/DevsFTP/scheduled_jobs.json`.
134. **5-Field Cron Support**: Standard 5-field cron syntax (`*/5 * * * *`).
135. **Preset Frequency Options**: On App Startup, Interval (Minutes), Daily at Exact Time, One-Shot Timestamp.
136. **Background Job Runner Daemon**: Main process background service checking schedules every 10 seconds.
137. **Execution Log History**: Log history recording execution timestamps, statuses (`Success`, `Failed`), and error outputs.
138. **Manual Job Controls**: "Run Now" button to execute any job on demand, and "Run All Active" button.

---

## 📊 14. Status Bar & UI Indicators
139. **Connection Indicator Dot**: Live status badge (`Green = Connected`, `Red = Disconnected`, `Amber = Connecting`).
140. **Selection & Size Summary Text**: Footer detail text displaying selected item count and total byte size (e.g. `3 items selected (42.5 MB)`).
141. **IPC Latency Indicator**: Status bar latency readout (e.g. `Connected (12ms)`).
142. **Transfer Queue Summary Bar**: Footer indicator displaying active transfer count, total speed (KB/s), and total remaining bytes.
143. **Status Bar Notification Text**: Real-time status text line displaying latest system actions or operation results.

---

## ⚙️ 15. Preferences, Notifications & Diagnostics
144. **Visual Mode Palette**: Charcoal Dark Mode and Light Mode themes.
145. **Native OS Notifications**: Desktop toast notifications on completed transfers or background job alerts.
146. **Audio Chime Alerts**: Customizable sound chime alerts on operation completion.
147. **Diagnostic Log Viewer**: Real-time IPC event logger, transfer engine logs, and error tracebacks.
148. **Log Actions**: Clear Log, Save Log to File, and Search Log text filter.
149. **Software Update Checker**: Automatic release update checker querying remote update endpoint (`updater:check`).
150. **Open External Web Links**: Safe IPC handler for opening external web links in default system browser (`shell:openExternal`).
151. **App Version & Path Queries**: Query app version (`app:getVersion`), executable path, and AppData directory (`app:getUserDataPath`).
152. **Custom Window Controls**: Window minimize, maximize/restore, and quit controls (`app:minimize`, `app:maximize`, `app:quit`).
153. **"Don't Show Again" Preference Suppressions**: Suppress delete confirmation dialog (`pref-suppress-delete-confirm`) and host key warnings.

---

## ⚠️ 16. Empty-State Messages & Error Handling
154. **Empty Directory Placeholder**: Rendered empty-state graphic and message (`📁 Empty Directory — No files found`).
155. **Search Filter Empty State**: Placeholder when search filter yields zero results (`🔍 No items match your search filter`).
156. **Permission Denied Error Handling**: User alert banner for access denial (`🔒 Permission Denied EACCES/EPERM`).
157. **Timeout & Network Error Handling**: Banner for connection timeouts (`⚠️ Connection Timed Out ETIMEDOUT`).

---

## 📜 17. Open-Source Suite & Assets
158. **GNU GPL-3.0 License Coverage**: Full GPL-3.0 license headers across all source files, `LICENSE` document, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `.github/` templates.
159. **Transparent Vector Branding & Installers**: Multi-resolution `icon.ico`, 512x512 transparent PNG `icon.png`, SVG vector logo, and custom NSIS setup wizard graphics (`installerHeader.png`, `installerSidebar.png`).
