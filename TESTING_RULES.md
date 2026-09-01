# Testing Rules — DevsFTP

## Core Testing Policy
Quality and stability must be verified before declaring any task complete. Existing working functionality must never be treated as disposable.

---

## 1. Test Verification Dimensions
Every significant code modification must be tested against:
1. **Requested Functionality**: Direct verification of new feature requirements.
2. **Affected Existing Functionality**: Verify zero regressions in surrounding services (`src/main/services/*`).
3. **Application Startup**: Ensure main process (`src/main/main.js`) initializes without errors.
4. **UI Behavior**: Verify renderer components (`src/renderer/js/*`) render correctly without console exceptions.
5. **Connection & Session Handling**: Verify protocol connections (FTP, SFTP, S3, WebDAV, Tunnels) maintain state.
6. **Transfer Engine**: Verify upload, download, queue, and checksum routines (`src/main/services/transfer/*`).
7. **Error & Recovery**: Verify error handlers (`errorHandler.js`, `main.js` uncaught Exception handlers) capture failures cleanly.

---

## 2. Verified Test Execution Standard
- DevsFTP uses Node.js native test runner configured in `package.json`:
  ```bash
  npm test
  ```
- Executable command: `node --test tests/**/*.test.js`
- Run automated unit/integration tests located in `tests/` whenever modifying core services or utility modules.

---

## 3. Strict Test Preservation
- Do **NOT** delete, skip, or comment out existing tests simply because they fail after a change.
- A test failure indicates a regression or broken contract in code. Always fix the underlying implementation to satisfy test requirements.
- Add new test cases in `tests/` whenever introducing new service methods or complex logic.
