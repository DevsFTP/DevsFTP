# DevsFTP Reliability / Security Audit

Date: 2026-08-11

Scope: fresh blind audit of the current codebase as it exists right now. This report is based only on the live source in the workspace and does not rely on any prior audit material.

## Findings

### 1) WebDAV sessions are routed through the FTP adapter — [RESOLVED]
- Severity: 🔴 HIGH
- Exact file location:
  - `C:\xampp\htdocs\DevsFTP\src/main/services/transfer/transferEngine.js:163-167`
  - `C:\xampp\htdocs\DevsFTP\src/main/services/transfer/webdavAdapter.js`
- Fix details:
  - Modified `getAdapter(session)` inside `transferEngine.js` to explicitly route by constructor name (`session.constructor.name === 'WebDAVService'`) and added fallback checks for client interfaces.
  - Fully implemented the adapter contract (`stat`, `mkdir`, `list`, `downloadStream`, `uploadStream`) in `webdavAdapter.js` to interface with `WebDAVService` streams.

### 2) Workspace restore is triggered twice on startup — [RESOLVED]
- Severity: 🔴 HIGH
- Exact file location:
  - `C:\xampp\htdocs\DevsFTP\src/renderer/js/sessionManager.js:59-64`
  - `C:\xampp\htdocs\DevsFTP\src/renderer/js/app.js:1152-1154`
- Fix details:
  - Added a `hasRestored` boolean lock-guard flag on the `SessionManager` object.
  - Guarded `restoreWorkspaceSessionState()` to return immediately if `hasRestored` is already true, preventing duplicate initialization runs.

### 3) Restored connects update whichever tab is active, not the session that just connected — [RESOLVED]
- Severity: 🟡 MEDIUM
- Exact file location:
  - `C:\xampp\htdocs\DevsFTP\src/renderer/js/app.js:1101-1110`
  - `C:\xampp\htdocs\DevsFTP\src/renderer/js/sessionManager.js:197-206, 413-438`
- Fix details:
  - Refactored `updateActiveSessionConnectionState` to delegate to a targeted method `updateSessionConnectionState(sessionId, isConnected, profile)`.
  - Updated `connectToProfileSession` in `app.js` to modify background paths directly on the target session's memory representation rather than triggering active file browser UI updates, which are now skipped unless the restored tab matches the active session.
  - Configured `setActiveSession` to dynamically refresh the remote list when a user clicks onto a restored background session tab that has not loaded its remote file tree.

### 4) Cache watcher session ids are overwritten for all watchers of the same profile — [RESOLVED]
- Severity: 🟡 MEDIUM
- Exact file location:
  - `C:\xampp\htdocs\DevsFTP\src/main/services/cacheWatcherService.js:368-374`
- Fix details:
  - Refactored `updateWatcherSessionId(profileId, newSessionId)` to match watchers strictly by `record.sessionId === newSessionId`.
  - If a session connects to a profile, only that session's file watchers update their associated `profileId`, leaving edit cache associations for other open sessions untouched.

### 5) SSH remote-forwarding error handler references `localSocket` before it exists — [RESOLVED]
- Severity: 🟡 MEDIUM
- Exact file location:
  - `C:\xampp\htdocs\DevsFTP\src/main/services/tunnelService.js:218-230`
- Fix details:
  - Declared `let localSocket = null;` before binding the remote stream `'error'` event listener.
  - Wrapped `localSocket.destroy()` in a validation check to avoid ReferenceError / TDZ errors if an early remote error triggers before local socket setup completes.

### 6) Master password config is written non-atomically — [RESOLVED]
- Severity: 🟡 MEDIUM
- Exact file location:
  - `C:\xampp\htdocs\DevsFTP\src/main/services/profileStore.js:51-58`
- Fix details:
  - Upgraded `_saveMasterConfig()` to write configuration details to a temporary file (`master_config.json.tmp`) and then atomically swap the files via `fs.renameSync` on completion, preventing disk write interruptions from corrupting the master password credentials vault.

---

## Summary
- Total findings: 6
- HIGH count: 2 (All Resolved)
- MEDIUM count: 4 (All Resolved)
- LOW count: 0
- Status: 100% Corrected and Tested.


