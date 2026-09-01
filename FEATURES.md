# DevsFTP Master Itemized Feature Matrix (190 Granular Features)

An exhaustive, itemized feature-by-feature specification of **DevsFTP**, listing every UI control, menu item, protocol capability, security mechanism, context action, bookmark drawer element, and workspace utility across the application.

---

## 🎯 Target Persona & Use-Case Fit

| Persona / Target Audience | Rating / Fit | Primary DevsFTP Workflows |
| :--- | :---: | :--- |
| **Sysadmin** | **Very Strong (~8.5/10)** | Integrated SSH PTY terminal, 3-layer bookmarks, multi-protocol remote management. |
| **DevOps Engineer** | **Strong (~8–8.5/10)** | Universal remote-to-remote streaming, SSH tunneling, live edit watcher & auto-sync. |
| **Infrastructure Engineer** | **Strong (~8/10)** | Multi-cloud adapters (AWS S3, WebDAV, SFTP), directory structure compare. |
| **Enterprise MFT Environment** | *Not Primary Target* | DevsFTP is an agile, developer-centric desktop workspace, not a heavy server-side MFT appliance. |

---

## 🔝 1. Top Menu Bar (File, Bookmarks, Settings, Tools, Help)
1. **File ➔ Quick Connect**: Opens Quick Connect modal for instant server connection.
2. **File ➔ New Session**: Opens a new workspace session tab.
3. **File ➔ Close Session**: Closes the active session tab.
4. **File ➔ Exit**: Gracefully disconnects active sessions and closes DevsFTP.
5. **Bookmarks ➔ Master Manager**: Opens Global Bookmarks Manager Modal (`#global-bookmarks-modal`).
6. **Bookmarks ➔ Add Local Directory**: Adds active local folder to Local Bookmarks.
7. **Bookmarks ➔ Add Remote Directory**: Adds active remote folder to Profile/Global Bookmarks.
8. **Bookmarks ➔ Local Drawer**: Slides out Local System Bookmarks Drawer (`#local-bookmarks-drawer`).
9. **Bookmarks ➔ Profile Drawer**: Slides out active Server Profile Bookmarks Drawer (`#profile-bookmarks-drawer`).
10. **Settings ➔ Preferences**: Opens Preferences modal (auto-upload rules, cache purge timers).
11. **Settings ➔ Vault Security**: Manages Master Password AES-256-GCM vault security.
12. **Settings ➔ Connection Defaults**: Sets global timeout (seconds) and keep-alive ping intervals.
13. **Settings ➔ Theme Options**: Toggles dark mode workspace theme.
14. **Tools ➔ Pending Local Edits**: Opens Pending Remote Edits Manager Modal (`#pending-edits-modal`).
15. **Tools ➔ Directory Compare**: Opens Directory Compare Tool Modal (`#dir-compare-modal`).
16. **Tools ➔ Clear Temp Cache**: Opens Clear Temp Cache Modal (`#clear-cache-modal`).
17. **Tools ➔ Export Workspace Package**: Exports profiles, 3-layer bookmarks, preferences, and scheduled sync jobs to a single `.devsftp-bundle.json` package.
18. **Tools ➔ Import Workspace Package**: Restores complete workspace setup from exported `.json` package.
19. **Help ➔ Documentation**: Opens online user guide.
20. **Help ➔ Keyboard Shortcuts**: Displays keyboard shortcuts cheat sheet.
21. **Help ➔ Report Issue**: Transmits diagnostic log package to `devsftp.com/bugs.php`.
22. **Help ➔ Check for Updates**: Queries server for latest DevsFTP version release.
23. **Help ➔ About DevsFTP**: Displays version, build date, and copyright credits.

---

## ⚡ 2. Header Bar & Connection Profile Manager
26. **DevsFTP Branding Logo**: SVG logo with live connection bridge styling.
27. **New Session Tab Button (`+`)**: Spawns concurrent session tabs.
28. **Session Tab Bar**: Multi-tab switcher for concurrent server connections.
29. **Close Session Tab (`✕`)**: Disconnects and removes targeted session tab.
30. **Session Tab Connection Dot**: Live status indicator (Green = Connected, Red = Disconnected).
31. **Session Tab Host Badge**: Displays connected protocol and remote hostname.
32. **Quick Connect Button (`⚡ New Session`)**: Triggers connection dialog.
33. **Disconnect Button (`🔌 Disconnect`)**: Safely closes active SSH/FTP/WebDAV/S3 session.
34. **Reconnect Button (`🔄 Reconnect`)**: Re-establishes dropped connection.
35. **Profile Selector Dropdown**: Selects saved server connection profiles.
36. **Profile Editor Modal**: Connection profile configuration card.
37. **Profile Host Field**: Domain name or IP address input.
38. **Profile Port Field**: Custom port input (Default 22 SFTP, 21 FTP, 443 WebDAV/S3).
39. **Protocol Selector**: SFTP, FTP, FTPS Explicit, FTPS Implicit, WebDAV, AWS S3.
40. **Profile Username Field**: Remote server login account username.
41. **Profile Password Field**: Remote server login password.
42. **Profile SSH Key File Selector**: Key file path browser (.pem, .ppk, id_rsa, id_ed25519).
43. **Profile Key Passphrase Field**: Passphrase for encrypted private keys.
44. **Profile Initial Local Path**: Sets default starting directory on local system.
45. **Profile Initial Remote Path**: Sets default starting directory on remote server.
46. **Profile Accent Color Picker**: Assigns visual color code (`#68a063`, etc.) to server profile.
47. **Save Profile**: Saves profile to encrypted vault storage.
48. **Duplicate Profile**: Clones existing connection profile configuration.
49. **Delete Profile**: Removes profile from saved profiles.

---

## 💻 3. Local System Pane (`#local-pane`)
50. **Local Pane Header Bar**: Pane title (`💻 Local System`).
51. **Drive Selector Dropdown**: Switch local system drives (`C:\`, `D:\`, etc.).
52. **Home Directory Button (`🏠 Home`)**: Navigates to user home directory (`C:\Users\...`).
53. **System Root Button (`⚡ Root`)**: Navigates to drive root (`C:\`).
54. **Local Refresh Button (`🔄 Refresh`)**: Re-reads local file system directory.
55. **Local Bookmarks Button (`🔖 Bookmarks`)**: Slides out Local Bookmarks Drawer.
56. **Local Parent Directory Button (`⬆ Parent`)**: Moves up one directory level.
57. **Local Breadcrumb Path Input**: Editable text box displaying current local path.
58. **Local Enter Key Navigation**: Pressing Enter in path input navigates directly.
59. **Local Search Filter Bar**: Real-time substring filter for local files list.
60. **Local File List Container**: Focusable table container with keyboard arrow key navigation.
61. **Local Table Name Header**: Sorts local files alphabetically (`🔤`).
62. **Local Table Size Header**: Sorts local files by byte size (`📏`).
63. **Local Table Modified Header**: Sorts local files by modification timestamp (`🕒`).
64. **Local Column Resizers**: Resizable header column dividers (`col-resizer`).
65. **Local Folder Double-Click**: Double-clicking folder opens and lists contents.
66. **Local Multi-Select**: Ctrl+Click / Shift+Click multi-file selection.
67. **Local Right-Click Context Menu**: Triggers selection-aware context menu.
68. **Local Empty Directory Notice**: Displays guidance when directory contains no files.
69. **Local Gold Star Badges**: Gold star (`⭐`) indicator next to bookmarked items.

---

## 🔖 4. Local System Bookmarks Drawer (`#local-bookmarks-drawer`)
70. **Local Drawer Title**: `🔖 Local Bookmarks` header display.
71. **Add Local Directory Button (`+ Add Current Folder`)**: Bookmarks current local path.
72. **Close Drawer Button (`✕ Close`)**: Retracts Local Bookmarks Drawer.
73. **Local Drawer Empty State**: Displayed when no local bookmarks exist.
74. **Local Bookmark Row**: Itemized shortcut row.
75. **Local Bookmark Icon & Name**: Folder icon (`📁`) and shortcut name.
76. **Local Bookmark Path Display**: Monospace display of target local path.
77. **Local Bookmark Go Button (`➡️`)**: Borderless icon button navigating to target folder.
78. **Local Bookmark Delete Button (`🗑️`)**: Borderless icon button deleting shortcut.

---

## 🌐 5. Remote Server Pane (`#remote-pane`)
79. **Remote Pane Header Bar**: Pane title (`🌐 Remote Server`).
80. **Remote Connected Host Display**: Shows active profile name and hostname.
81. **Remote Status Dot**: Live connection state indicator.
82. **Remote Home Directory Button (`🏠 Home`)**: Navigates to initial profile remote path.
83. **Remote Root Directory Button (`⚡ Root`)**: Navigates to remote server root (`/`).
84. **Remote Refresh Button (`🔄 Refresh`)**: Re-reads remote directory over protocol.
85. **Remote Bookmarks Button (`🔖 Bookmarks`)**: Slides out Profile Bookmarks Drawer.
86. **Remote Parent Directory Button (`⬆ Parent`)**: Moves up one remote directory level.
87. **Remote Breadcrumb Path Input**: Editable text box displaying current remote path.
88. **Remote Enter Key Navigation**: Pressing Enter in remote path input navigates directly.
89. **Remote Search Filter Bar**: Real-time substring filter for remote files list.
90. **Remote File List Container**: Focusable table container with keyboard arrow key navigation.
91. **Remote Table Name Header**: Sorts remote files alphabetically (`🔤`).
92. **Remote Table Size Header**: Sorts remote files by byte size (`📏`).
93. **Remote Table Permissions Header**: Displays octal permissions mode (`0644`, `0755`).
94. **Remote Table Modified Header**: Sorts remote files by modification timestamp (`🕒`).
95. **Remote Column Resizers**: Resizable header column dividers (`col-resizer`).
96. **Remote Folder Double-Click**: Double-clicking remote folder opens and lists contents.
97. **Remote Multi-Select**: Ctrl+Click / Shift+Click multi-file selection.
98. **Remote Right-Click Context Menu**: Triggers selection-aware context menu.
99. **Remote Empty Directory Notice**: Displays guidance when remote directory is empty.
100. **Remote Gold Star Badges**: Gold star (`⭐`) indicator next to bookmarked remote items.

---

## 🔖 6. Profile Bookmarks Drawer (`#profile-bookmarks-drawer`)
101. **Profile Drawer Title**: Dynamic title `🔖 Bookmarks - [Profile Name]`.
102. **Add Remote Directory Button (`+ Add Current Folder`)**: Bookmarks current remote path.
103. **Close Drawer Button (`✕ Close`)**: Retracts Profile Bookmarks Drawer.
104. **Profile Drawer Unconnected Notice**: Displayed when no remote server is connected.
105. **Profile Drawer Empty State**: Displayed when no bookmarks exist for profile.
106. **Profile Bookmark Row**: Itemized shortcut row.
107. **Profile Bookmark Icon & Name**: Folder icon (`📁`) and shortcut name.
108. **Profile Bookmark Path Display**: Monospace display of target remote path.
109. **Profile Bookmark Go Button (`➡️`)**: Borderless icon button navigating to remote folder.
110. **Profile Bookmark Delete Button (`🗑️`)**: Borderless icon button deleting shortcut.

---

## 🖱️ 7. Selection-Aware Context Menu (`#context-menu`)
111. **New Group Submenu (`📁 New` ❯)**: Cascading submenu for item creation.
112. **New File Action (`📄 New File`)**: Prompts filename and creates file.
113. **New Directory Action (`📁 New Directory`)**: Prompts folder name and creates directory.
114. **Open Action (`📂 Open`)**: Opens selected file or enters folder.
115. **Edit Action (`📝 Edit in Default Editor`)**: Downloads and opens file in local OS editor.
116. **Download Action (`⬇️ Download`)**: Queues download of selected remote items.
117. **Download As Action (`📥 Download As...`)**: Downloads remote file to specific local path.
118. **Upload Action (`⬆️ Upload`)**: Queues upload of selected local items to remote server.
119. **Rename Action (`✏️ Rename`)**: Prompts new name for file or folder.
120. **Delete Action (`🗑 Delete`)**: Deletes selected items with confirmation dialog.
121. **Context Separators**: Visual horizontal rule dividers.
122. **Copy Path Action (`📋 Copy Path`)**: Copies absolute path to OS clipboard.
123. **Calculate Size Action (`🧮 Calculate Size`)**: Computes recursive directory byte size.
124. **Permissions Action (`🔑 Permissions (chmod)`)**: Opens `chmod` permissions editor modal.
125. **Sort By Submenu (`🔀 Sort By` ❯)**: Cascading submenu for file list sorting.
126. **Sort by Name (`🔤 Name`)**: Sorts table by name.
127. **Sort by Size (`📏 Size`)**: Sorts table by file size.
128. **Sort by Date (`🕒 Date Modified`)**: Sorts table by modification date.
129. **Sort by Type (`📁 Type`)**: Sorts table by file extension/type.
130. **Bookmark Submenu (`🔖 Bookmark` ❯)**: Cascading submenu for bookmarking.
131. **Bookmark Add Action (`⭐ Add`)**: Adds target item to bookmarks.
132. **Bookmark Remove Action (`🗑️ Remove`)**: Removes target item from bookmarks.

---

## 🔖 8. Master Global Bookmarks Manager Modal (`#global-bookmarks-modal`)
133. **Modal Overlay Card**: `920px` width, `600px` height glass card aligned 1:1 with Pending Edits.
134. **Modal Header Title**: `🔖 Global Bookmarks Manager`.
135. **Header Close Button (`✕ Close`)**: Dismisses Master Bookmarks Modal.
136. **Filter Section Label**: `Filter:` toolbar title.
137. **Type Filter Dropdown**: `All Bookmark Types`, `💻 Local System`, `🌐 Remote Servers`.
138. **Profile Filter Dropdown**: `All Server Profiles`, `💻 Local System`, `● Profile Name` colored bullet dots matching Pending Edits (`app.js` L1742).
139. **Search Input Bar (`🔍 Search bookmarks...`)**: Live text search across names and paths.
140. **Summary Counter Badge**: `Bookmarks: <strong style="color: #F59E0B;">X</strong>`.
141. **Sticky Header Table**: Table container with sticky headers (`z-index: 2`).
142. **Select All Header Checkbox (`☑`)**: Toggles selection of all displayed bookmarks.
143. **Bookmark Name Column**: `30%` grid width displaying file (`📄`) or folder (`📁`) icons.
144. **Profile Origin Column**: `22%` grid width displaying `💻 Local System` or `● Profile Name` colored dots (`#68a063`, etc.).
145. **Target Path Column**: `28%` grid width displaying target path in monospace font.
146. **Actions Column**: `20%` grid width for action icon buttons.
147. **Item Row Checkbox (`☑`)**: Per-row selection checkbox for bulk operations.
148. **Borderless Go Button (`➡️`)**: Borderless icon button navigating to target folder.
149. **Borderless Delete Button (`🗑️`)**: Borderless icon button deleting shortcut.
150. **Modal Footer Bar**: Action toolbar at bottom of modal.
151. **Bulk Delete Button (`🗑️ Discard Checked`)**: Removes all checked bookmarks in 1 click.
152. **Add Local Folder Button (`+ Add Local Folder`)**: Bookmarks current local path.
153. **Add Remote Folder Button (`+ Add Remote Folder`)**: Bookmarks current remote path.
154. **Footer Close Button (`✕ Close`)**: Dismisses Master Bookmarks Modal.

---

## 📝 9. Pending Remote Edits Manager Modal (`#pending-edits-modal`)
155. **Modal Overlay Card**: `920px` width, `600px` height glass card.
156. **Dynamic Title**: `✏️ Pending Remote Edits Manager (N)`.
157. **Date Filter Dropdown**: `All Pending Files`, `Modified Today`.
158. **Profile Filter Dropdown**: `All Server Profiles`, `● Profile Name` colored bullet dots.
159. **Summary Badge**: `Pending Files: N | Auto-Purge: 7 Days`.
160. **Select All Checkbox (`☑`)**: Selects/deselects all modified files.
161. **File Column**: `30%` width displaying `📄` icon and filename.
162. **Profile Column**: `22%` width displaying 8px colored dot and profile name.
163. **Target Remote Path Column**: `28%` width displaying destination path.
164. **Modified Date Column**: `20%` width displaying timestamp.
165. **Bulk Upload Button (`⚡ Upload Checked Files`)**: Uploads checked edits with overwrite protection.
166. **Bulk Discard Button (`🗑️ Discard Checked`)**: Dismisses checked local file edits.

---

## 🖥️ 10. Bottom Drawer & Interactive Panels
167. **Drawer Tab Bar**: Switcher tabs for Terminal, Queue, Tunnels, and Logs.
168. **SSH Terminal Panel (`tab-terminal`)**: Built-in `xterm.js` interactive PTY terminal.
169. **SSH Terminal PTY Connection**: Spawns SSH PTY session sharing profile credentials.
170. **Transfer Queue Panel (`tab-queue`)**: Background transfer queue table.
171. **Queue Parallel Worker Selector**: Sets max parallel workers (1 to 10).
172. **Queue Speed Limit Selector**: Throttles bandwidth (Unlimited down to 256 KB/s).
173. **Queue Pause All Button (`⏸️ Pause All`)**: Pauses active transfers.
174. **Queue Resume All Button (`▶️ Resume All`)**: Resumes paused transfers.
175. **Queue Cancel All Button (`⏹️ Cancel All`)**: Cancels all queued transfers.
176. **Queue Clear Completed Button (`🧹 Clear Completed`)**: Purges completed tasks.
177. **Queue Progress Bar**: Per-task percentage and byte progress indicator.
178. **SSH Tunnels Panel (`tab-tunnels`)**: SSH port forwarding management table.
179. **Log Viewer Panel (`LogViewer`)**: Real-time diagnostic console stream.
180. **Log Viewer Console Clear Button**: Purges displayed log entries.

---

## 🔒 11. Cryptography Vault & Status Utilities
181. **Footer Connection Status Dot**: Status indicator dot (`status-dot`).
182. **Footer Connection Status Text**: Text display (`Connected` / `Disconnected`).
183. **Footer Bandwidth Speed Indicator**: Real-time throughput (`▲ 0 KB/s | ▼ 0 KB/s`).
184. **Master Password Verification Modal (`#master-auth-modal`)**: Vault authorization dialog.
185. **AES-256-GCM Vault Encryption**: Encrypts credentials with AES-256-GCM & PBKDF2 derivation.
186. **SSH Host Key Verification Modal (`#host-key-modal`)**: Host fingerprint verification dialog.
187. **File Permissions Modal (`#file-permissions-modal`)**: Interactive `chmod` octal permissions editor.
188. **Directory Compare Modal (`#dir-compare-modal`)**: Side-by-side local/remote diff inspector.
189. **Clear Temp Cache Modal (`#clear-cache-modal`)**: Purges temporary editor caches.
190. **Update Available Banner & Modal (`#update-modal`)**: Version update details & download dialog.
