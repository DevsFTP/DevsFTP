# DevsFTP — Engineering Inventory (215+ Technical Items)

This document provides a low-level engineering specification of **DevsFTP**, mapping every IPC handler, service class method, DOM modal dialog, state property, fallback pipeline, and event listener across the codebase.

---

## 1. 🔌 Main Process Services & Modules

### 1.1 `src/main/main.js` (IPC Controller & Bootstrap)
- `createWindow()`: Instantiates main `BrowserWindow` with native frame options, icon paths, and preload script.
- `registerLoggedInvoke(channel, listener)`: Custom IPC invoke wrapper logging start time, parameters, execution duration, and errors.
- `registerLoggedOn(channel, listener)`: Custom IPC event listener wrapper with structured debug logging.
- `writeDebugLog(entry)`: Appends structured JSON log entries to `%AppData%/DevsFTP/devsftp-debug.log`.

#### IPC Channels Handled:
1. `sftp:connect`: Invokes `sftpService.connect(config)`.
2. `sftp:disconnect`: Invokes `sftpService.disconnect(connectionId)`.
3. `sftp:list`: Invokes `sftpService.list(connectionId, remotePath)`.
4. `sftp:mkdir`: Invokes `sftpService.mkdir(connectionId, remotePath)`.
5. `sftp:upload`: Invokes `sftpService.upload(connectionId, localPath, remotePath)`.
6. `sftp:download`: Invokes `sftpService.download(connectionId, remotePath, localPath)`.
7. `sftp:delete`: Invokes `sftpService.delete(connectionId, remotePath)`.
8. `sftp:rename`: Invokes `sftpService.rename(connectionId, oldPath, newPath)`.
9. `sftp:chmod`: Invokes `sftpService.chmod(connectionId, remotePath, mode)`.
10. `ftp:connect`: Invokes `ftpService.connect(config)`.
11. `ftp:disconnect`: Invokes `ftpService.disconnect(connectionId)`.
12. `ftp:list`: Invokes `ftpService.list(connectionId, remotePath)`.
13. `ftp:mkdir`: Invokes `ftpService.mkdir(connectionId, remotePath)`.
14. `ftp:upload`: Invokes `ftpService.upload(connectionId, localPath, remotePath)`.
15. `ftp:download`: Invokes `ftpService.download(connectionId, remotePath, localPath)`.
16. `ftp:delete`: Invokes `ftpService.delete(connectionId, remotePath)`.
17. `ftp:rename`: Invokes `ftpService.rename(connectionId, oldPath, newPath)`.
18. `profiles:get`: Returns all connection profiles from `profileStore`.
19. `profiles:save`: Saves or updates a profile in `profileStore`.
20. `profiles:delete`: Deletes a profile from `profileStore`.
21. `profiles:export`: Exports profile store to JSON file.
22. `profiles:import`: Imports profiles from JSON backup file.
23. `sshConfig:parse`: Parses OpenSSH `~/.ssh/config`.
24. `terminal:init`: Initializes PTY SSH terminal session.
25. `terminal:write`: Pipes input string to active PTY.
26. `terminal:resize`: Resizes PTY terminal dimensions (cols/rows).
27. `terminal:close`: Terminates PTY terminal session.
28. `cacheWatcher:watch`: Starts Chokidar file watcher on local cache file.
29. `cacheWatcher:unwatch`: Stops Chokidar file watcher on local cache file.
30. `cacheWatcher:getWatched`: Returns list of currently watched cache files.
31. `jobs:get`: Returns scheduled sync jobs from `scheduledJobStore`.
32. `jobs:save`: Saves or updates a scheduled sync job.
33. `jobs:delete`: Deletes a scheduled sync job.
34. `jobs:runNow`: Triggers immediate execution of a scheduled sync job.
35. `dialog:openFile`: Spawns native OS file selection dialog.
36. `dialog:openDirectory`: Spawns native OS folder selection dialog.
37. `shell:openExternal`: Opens URL in default system web browser.
38. `shell:openPath`: Launches file with native OS default app association.
39. `updater:check`: Queries update server for software releases.
40. `app:getVersion`: Returns package version string (`1.0.0`).
41. `app:getUserDataPath`: Returns absolute `%AppData%/DevsFTP` path.
42. `app:minimize`: Minimizes application window.
43. `app:maximize`: Toggles window maximize/restore.
44. `app:quit`: Terminates Electron application process.

---

### 1.2 `src/main/services/sftpService.js` (SFTP Client Engine)
45. `Client`: Class instance from `ssh2`.
46. `connect(config)`: Handles SSH handshake, password auth, private key auth, proxy socket setup, and keyboard-interactive prompt callbacks.
47. `disconnect(connId)`: Closes active SSH/SFTP connection streams.
48. `list(connId, path)`: Invokes `sftp.readdir` and formats file stat objects (`name`, `size`, `mtime`, `isDirectory`, `permissions`).
49. `mkdir(connId, path)`: Invokes `sftp.mkdir`.
50. `upload(connId, localPath, remotePath, options)`: Fast stream upload with chunk progress callbacks.
51. `download(connId, remotePath, localPath, options)`: Fast stream download with chunk progress callbacks.
52. `delete(connId, path)`: Deletes file (`sftp.unlink`) or directory (`sftp.rmdir`).
53. `rename(connId, oldPath, newPath)`: Invokes `sftp.rename`.
54. `chmod(connId, path, mode)`: Invokes `sftp.chmod`.

---

### 1.3 `src/main/services/ftpService.js` (FTP/FTPS Client Engine)
55. `Client`: Class instance from `basic-ftp`.
56. `connect(config)`: Connects using Plain FTP, Explicit FTPS, or Implicit FTPS on active or passive mode.
57. `disconnect(connId)`: Closes FTP control socket.
58. `list(connId, path)`: Lists directory contents and returns formatted stat objects.
59. `mkdir(connId, path)`: Invokes `ftp.ensureDir`.
60. `upload(connId, localPath, remotePath)`: Invokes `ftp.uploadFrom`.
61. `download(connId, remotePath, localPath)`: Invokes `ftp.downloadTo`.
62. `delete(connId, path)`: Invokes `ftp.remove` or `ftp.removeDir`.
63. `rename(connId, oldPath, newPath)`: Invokes `ftp.rename`.

---

### 1.4 `src/main/services/cacheWatcherService.js` (Chokidar Watcher)
64. `Chokidar.watch(filePath)`: Instantiates persistent file system watcher.
65. `calculateHash(filePath)`: Returns SHA-256 hex digest of local cache file.
66. `onFileChange(filePath)`: Triggered on save. Compares current hash against cached hash.
67. `autoUpload(filePath)`: Reads `.meta.json` file metadata and triggers background SFTP/FTP upload.
68. `createSnapshotBackup(filePath)`: Creates timestamped `.bak` copy in `%AppData%/DevsFTP/devsftp_edit_cache/backups`.
69. `saveManifest()`: Persists open edit sessions to `%AppData%/DevsFTP/devsftp_edit_cache/manifest.json`.
70. `restoreManifest()`: Restores watched files and rebinds Chokidar listeners on application startup.

---

### 1.5 `src/main/services/scheduledJobStore.js` & `jobRunnerService.js`
71. `ScheduledJobStore._load()`: Loads `%AppData%/DevsFTP/scheduled_jobs.json`.
72. `ScheduledJobStore.upsert(job)`: Inserts or updates job configuration.
73. `ScheduledJobStore.delete(id)`: Removes job from JSON store.
74. `JobRunnerService.start()`: Starts 10-second background schedule polling loop.
75. `JobRunnerService.checkSchedules()`: Compares current time against next run timestamps.
76. `JobRunnerService.executeJob(job)`: Instantiates background SFTP/FTP service, executes directional sync, records log history, and sends native OS notification.

---

## 2. 🎨 Renderer Process Controllers & State Stores

### 2.1 `src/renderer/js/app.js` (Application Controller)
77. `logDiagnostic(scope, data, level)`: Sends diagnostic event to log viewer.
78. `openWebsite()`: Invokes safe external link handler (`shell.openExternal`).
79. `doCheckForUpdates(statusEl)`: Queries release updater endpoint.
80. `updateWorkspaceBadges()`: Updates header theme dots and status line indicators.
81. `FileConflictDialog.resolveConflict(data)`: Handles file transfer conflict dialog decisions.

---

### 2.2 `src/renderer/js/sessionManager.js` (Multi-Tab Manager)
82. `createSessionTab(profileConfig)`: Spawns new workspace session tab element.
83. `switchSessionTab(tabId)`: Activates target session tab and restores file browser state.
84. `closeSessionTab(tabId)`: Closes session tab and prompts if unsaved edit cache files exist.
85. `restoreSavedSessions()`: Restores open session tabs from `localStorage` on startup.

---

### 2.3 `src/renderer/js/fileBrowser.js` (Explorer Controller)
86. `renderLocalTable(files)`: Renders local file list DOM elements with icons, sizes, and timestamps.
87. `renderRemoteTable(files)`: Renders remote file list DOM elements.
88. `navigateLocal(path)`: Navigates local pane to specified directory path.
89. `navigateRemote(path)`: Navigates remote pane to specified directory path.
90. `filterLocalFiles(query)`: Filters local file list by text query.
91. `filterRemoteFiles(query)`: Filters remote file list by text query.
92. `sortLocal(column)`: Toggles local column sorting order.
93. `sortRemote(column)`: Toggles remote column sorting order.
94. `openFileInLocalIDE(remoteFilePath)`: Downloads file to edit cache and launches local IDE pipeline.
95. `uploadFile(localPath, remotePath)`: Queues file upload item in transfer queue.
96. `downloadFile(remotePath, localPath)`: Queues file download item in transfer queue.
97. `showContextMenu(e, type, item)`: Renders custom right-click context menu.

---

### 2.4 `src/renderer/js/transferQueue.js` (Queue Controller)
98. `addUploadJob(localPath, remotePath)`: Adds upload item to queue state.
99. `addDownloadJob(remotePath, localPath)`: Adds download item to queue state.
100. `processQueue()`: Asynchronous queue loop executing concurrent chunk transfers.
101. `updateQueueMetrics()`: Calculates current speed (KB/s), progress bars, and ETA timers.
102. `pauseItem(id)`: Pauses active queue transfer item.
103. `resumeItem(id)`: Resumes paused queue transfer item using byte range offset.
104. `removeItem(id)`: Cancels and removes queue item.
105. `retryFailedItems()`: Re-queues all failed transfer items.
106. `clearCompletedItems()`: Clears completed transfer items from queue drawer.

---

### 2.5 `src/renderer/js/terminal.js` (Xterm.js Shell)
107. `Terminal`: Instance from `@xterm/xterm`.
108. `FitAddon`: Instance from `@xterm/addon-fit`.
109. `initTerminal(containerEl)`: Instantiates terminal emulator and binds data listeners.
110. `writeToTerminal(data)`: Renders output stream data in terminal viewport.
111. `resizeTerminal()`: Invokes `fitAddon.fit()` and notifies main process PTY.

---

### 2.6 `src/renderer/js/directoryCompare.js` (Diff Engine)
112. `toggleCompare()`: Enables or disables directory comparison mode.
113. `compare()`: Compares local file map against remote file map and computes diff badges.
114. `openCompareSummaryModal(mode)`: Renders diff summary dialog.
115. `syncSelectedFiles()`: Queues required uploads/downloads for selected diff items.

---

### 2.7 `src/renderer/js/scheduledJobs.js` (Cron Jobs Manager)
116. `renderJobsList()`: Renders scheduled jobs table rows in manager modal.
117. `openJobFormModal(job)`: Opens create/edit scheduled job form.
118. `saveJobFromForm()`: Validates and saves scheduled job to store via IPC.
119. `runJobNow(jobId)`: Triggers manual background job execution.

---

## 3. 🖼️ DOM Modal Dialogs & UI Overlays (120 – 150)
120. `#connection-modal`: Quick connect and profile management dialog.
121. `#preferences-modal`: Application preferences modal (6 section tabs).
122. `#upload-save-modal`: Live edit cache upload prompt dialog (`Upload Saved Changes?`).
123. `#file-conflict-modal`: Transfer file overwrite conflict resolution dialog.
124. `#delete-confirm-modal`: Bulk item deletion confirmation dialog.
125. `#chmod-modal`: Remote POSIX file permissions (Chmod) editor dialog.
126. `#mkdir-modal`: Create directory modal dialog.
127. `#touch-modal`: Create empty file modal dialog.
128. `#rename-modal`: File/folder rename modal dialog.
129. `#dir-compare-modal`: Directory comparison results and sync modal.
130. `#scheduled-jobs-modal`: Scheduled background sync jobs manager modal.
131. `#open-with-modal`: Custom application launcher modal ("Open With...").
132. `#reconnect-overlay`: Network drop reconnection overlay banner with countdown.
133. `#toast-container`: Floating in-app toast notifications container.

---

## 4. ⌨️ Keyboard Shortcuts & Events (151 – 170)
151. `Ctrl+A`: Select all files in active pane.
152. `Ctrl+F` / `F3`: Focus search filter bar.
153. `F5` / `Ctrl+R`: Refresh active directory listing.
154. `Ctrl+N`: Open New Connection dialog.
155. `Ctrl+W`: Close active session tab.
156. `Ctrl+T`: Open new session tab.
157. `Delete`: Delete selected items.
158. `F2`: Rename selected item.
159. `Esc`: Close open modal, dialog, or drawer.
160. `Up` / `Down` Arrows: Navigate table rows.
161. `Enter`: Open selected directory or execute file action.
162. `Tab` / `Shift+Tab`: Cycle modal input focus.
163. `Spacebar`: Toggle checkbox selection.

---

## 5. ⚙️ Preferences & State Keys (171 – 200)
171. `devsftp_pref_theme`: Visual mode (`dark` / `light`).
172. `devsftp_pref_restore_tabs`: Restore open workspace tabs on launch.
173. `devsftp_pref_restore_bottom_drawer`: Restore bottom drawer state on launch.
174. `devsftp_pref_notify_transfers`: Desktop notifications for queue completion.
175. `devsftp_pref_notify_chime`: Sound chime alerts on completion.
176. `devsftp_pref_conflict_policy`: Conflict resolution policy (`prompt`, `overwrite`, `skip`, `newer`).
177. `devsftp_pref_auto_upload_always`: Suppress upload prompt and upload automatically on save.
178. `devsftp_pref_suppress_delete_confirm`: Suppress bulk delete confirmation dialog.
179. `devsftp_window_bounds`: Window dimensions and coordinates (`width`, `height`, `x`, `y`, `maximized`).
180. `devsftp_drawer_height`: Bottom drawer height in pixels.

---

## 6. 📜 Open-Source Suite & Build Packaging (201 – 250+)
201. GNU GPL-3.0 License headers across all source files.
202. `LICENSE` file in root directory.
203. `README.md` project documentation.
204. `SECURITY.md` security policy document.
205. `CONTRIBUTING.md` developer contribution guidelines.
206. `CHANGELOG.md` version release history.
207. `.github/ISSUE_TEMPLATE/bug_report.md`: GitHub issue template.
208. `.github/ISSUE_TEMPLATE/feature_request.md`: GitHub feature request template.
209. `.github/PULL_REQUEST_TEMPLATE.md`: GitHub pull request template.
210. Multi-resolution `icon.ico` Windows binary icon.
211. Transparent 512x512 PNG `icon.png` raster icon.
212. NSIS setup wizard header graphics (`installerHeader.png`).
213. NSIS setup wizard sidebar graphics (`installerSidebar.png`).
214. Clean `electron-builder` configuration (`"signAndEditExecutable": false`).
215. ASAR packager script (`scratch/pack_clean_asar.js`) bundling all 8,802 runtime dependency files (`ssh2`, `basic-ftp`, `xterm`, `chokidar`, `socks`).
