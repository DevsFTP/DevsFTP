# DevsFTP - Need To Do

_Audit date: 2026-08-22. All items below have been resolved._

---

## Bugs & Reliability

- [DONE] A3 - sftpService.js - downloadDir / uploadDir collect per-file errors and continue.
- [DONE] A4 - sftpService.js - Sync mkdir replaced with async fs.promises equivalents.
- [DONE] A6 - cacheWatcherService.js - findManifests is now async with maxDepth=5 guard.
- [DONE] A7 - jobRunnerService.js - Scheduled jobs pass verifyHostKeyFn using knownHostsStore.
- [DONE] A8 - terminal.js - Resize listener stored by reference and removed on destroy().
- [DONE] A9 - terminal.js - clearSession() removes stale buffers on disconnect. buffers initialized as {} on object, not lazily.
- [DONE] A10 - fileBrowser.js - All 14 [DEBUG MENU] console.log statements removed from context menu handlers.

---

## Security

- [DONE] B2 - jobRunnerService.js - Scheduled jobs verify SSH host keys against knownHostsStore.
- [DONE] B3 - sftpService.js - cp -r uses single-quoted escaped paths.
- [DONE] B4 - cacheWatcherService.js - Debug log no longer written to process.cwd(); userData only.

---

## UX / Feature Gaps

- [DONE] C7 - cacheWatcherService.js - batch IPC delayed 500ms for renderer readiness.
- [DONE] C8 - terminal.js + preload.js - Banner version now reads from app.getVersion() via preload API.
- [NOTE] C9 - transferQueue.js - Drag-to-reorder is a feature enhancement. Moved to roadmap.md.
- [DONE] C10 - jobRunnerService.js - Added inline comment explaining immediate first-run behavior.

---

## Performance

- [DONE] D3 - sftpService.js - Symlink stats throttled to batches of 10.
- [DONE] D4 - cacheWatcherService.js - Startup scan uses async fs.promises.readdir.
- [DONE] D5 - fileBrowser.js - filterLocal / filterRemote debounced at 150ms.

---

All audit items resolved. Remaining open item: C9 (queue drag-to-reorder) tracked in roadmap.md as a planned feature.
