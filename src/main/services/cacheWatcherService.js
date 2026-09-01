/**
 * Remote File Cache & Live-Edit Watcher Service
 * Manages local temp file caching, launches system default editors via shell.openPath,
 * persists .meta.json sidecar manifests with remote metadata (hostname, remotePath, mtime, permissions, sha256),
 * and watches for file saves using chokidar with automatic startup recovery.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
let app = null;
let shell = null;
try {
  const electron = require('electron');
  app = electron.app;
  shell = electron.shell;
} catch (e) {
  app = null;
  shell = null;
}

function appendDiagnosticLine(line) {
  try {
    const time = new Date().toLocaleTimeString();
    const normalized = String(line).endsWith('\n') ? String(line) : `${line}\n`;
    const formatted = `[${time}] ${normalized}`;
    // Only write to userData — process.cwd() can be a system dir in packaged builds (Fix B4)
    if (app) {
      fs.appendFileSync(path.join(app.getPath('userData'), 'devsftp-debug.log'), formatted);
    }
  } catch (e) {}
}

function logCacheDiagnostic(event, details, level = 'info') {
  const payload = typeof details === 'string' ? details : JSON.stringify(details);
  appendDiagnosticLine(`[cacheWatcherService] [${event}] [${level}] ${payload}`);
}

class CacheWatcherService {
  constructor(ipcWindow) {
    this.ipcWindow = ipcWindow;
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.devs_userData');
    this.cacheDir = path.join(userDataPath, 'devsftp_edit_cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.watchers = new Map(); // localPath -> { watcher, hash, remotePath, profileId, debounceTimer }
  }

  getSystemCodeEditorPath() {
    try {
      const localAppData = process.env.LOCALAPPDATA || '';
      const pf = process.env.ProgramFiles || 'C:\\Program Files';
      const pfx = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const candidates = [
        path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
        path.join(pf, 'Microsoft VS Code', 'Code.exe'),
        path.join(pfx, 'Microsoft VS Code', 'Code.exe'),
        path.join(pf, 'Notepad++', 'notepad++.exe'),
        path.join(pfx, 'Notepad++', 'notepad++.exe'),
        path.join(localAppData, 'Programs', 'Sublime Text', 'sublime_text.exe'),
        path.join(pf, 'Sublime Text 3', 'sublime_text.exe'),
        path.join(pf, 'Sublime Text', 'sublime_text.exe')
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    } catch (e) {}
    return null;
  }

  launchEditor(localPath) {
    if (!localPath) return;
    // Use execFile (not exec) to avoid shell injection from remote-derived paths (Fix B1)
    const { execFile } = require('child_process');
    const ext = path.extname(localPath).toLowerCase();
    const webExts = ['.html', '.htm', '.xhtml', '.phtml', '.shtml', '.svg', '.xml'];

    if (webExts.includes(ext) && process.platform === 'win32') {
      const codeEditorPath = this.getSystemCodeEditorPath();
      if (codeEditorPath && fs.existsSync(codeEditorPath)) {
        execFile(codeEditorPath, [localPath], (err) => {
          // Fix 8 (MEDIUM): shell.openPath() returns a Promise — attach .catch() to prevent
          // an unhandled rejection if the fallback open also fails.
          if (err && shell && shell.openPath) shell.openPath(localPath).catch(() => {});
        });
        return;
      }
    }

    if (shell && shell.openPath) {
      shell.openPath(localPath).then((errMsg) => {
        if (errMsg) {
          logCacheDiagnostic('openPath failed', { localPath, errMsg }, 'error');
        }
      // Fix 7 (HIGH): Catch rejected promise from shell.openPath() and log diagnostically.
      }).catch(err => {
        logCacheDiagnostic && logCacheDiagnostic('openPath error', { err: err.message }, 'error');
      });
    }
  }

  getCachePath(profileId, remotePath) {
    const remoteHash = crypto.createHash('md5').update(remotePath).digest('hex').substring(0, 8);
    const fileName = path.basename(remotePath);
    const dir = path.join(this.cacheDir, profileId || 'default', remoteHash);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, fileName);
  }

  _getFileHash(filePath) {
    try {
      const data = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (e) {
      return null;
    }
  }

  writeManifest(localPath, meta) {
    try {
      const manifestPath = `${localPath}.meta.json`;
      const tempPath = `${manifestPath}.tmp`;
      const existing = this.readManifest(localPath);
      const payload = {
        version: '1.0',
        profileId: meta.profileId || (existing ? existing.profileId : 'default'),
        profileName: meta.profileName || (existing ? existing.profileName : 'Connection'),
        host: meta.host || (existing ? existing.host : 'localhost'),
        remotePath: meta.remotePath || (existing ? existing.remotePath : ''),
        localPath: localPath,
        downloadedAt: (existing && existing.downloadedAt) ? existing.downloadedAt : (meta.downloadedAt || new Date().toISOString()),
        remoteMtime: meta.remoteMtime || (existing ? existing.remoteMtime : null),
        remotePermissions: meta.remotePermissions || (existing ? existing.remotePermissions : '0644'),
        initialSha256: meta.initialSha256 !== undefined ? meta.initialSha256 : ((existing && existing.initialSha256) ? existing.initialSha256 : ''),
        lastSha256: meta.lastSha256 || meta.initialSha256 || (existing ? existing.lastSha256 : '')
      };
      fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tempPath, manifestPath);
      logCacheDiagnostic('manifest written atomically', { manifestPath, remotePath: payload.remotePath });
    } catch (err) {
      console.error('Failed to write cache manifest:', err);
    }
  }

  readManifest(localPath) {
    try {
      const manifestPath = `${localPath}.meta.json`;
      if (fs.existsSync(manifestPath)) {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to read cache manifest:', err);
    }
    return null;
  }

  openAndWatch(localPath, remotePath, profile, sessionId, remoteStats = {}, skipOpenApp = false) {
    const profileId = (profile && profile.id) ? profile.id : (typeof profile === 'string' ? profile : 'default');
    const profileName = profile && profile.name ? profile.name : 'Connection';
    const host = profile && profile.host ? profile.host : 'localhost';

    const color = (profile && (profile.accentColor || profile.color)) ? (profile.accentColor || profile.color) : '#68a063';

    try {
      logCacheDiagnostic('watcher created', { localPath, remotePath, profileId, sessionId, host, skipOpenApp });
    } catch (e) {}

    // 1. Launch in code editor (override browser default for .html / .htm)
    if (!skipOpenApp) {
      this.launchEditor(localPath);
    }

    // 2. Clear old watcher if present
    if (this.watchers.has(localPath)) {
      const old = this.watchers.get(localPath);
      if (old.watcher) old.watcher.close();
      this.watchers.delete(localPath);
    }

    const currentHash = this._getFileHash(localPath);
    const existingMeta = this.readManifest(localPath);
    const initialHash = (existingMeta && existingMeta.initialSha256) ? existingMeta.initialSha256 : currentHash;

    // 3. Write persistent .meta.json sidecar manifest
    this.writeManifest(localPath, {
      profileId,
      profileName,
      host,
      color,
      remotePath,
      downloadedAt: (existingMeta && existingMeta.downloadedAt) ? existingMeta.downloadedAt : new Date().toISOString(),
      remoteMtime: remoteStats.modifyTime || (existingMeta ? existingMeta.remoteMtime : null),
      remotePermissions: remoteStats.permissions || (existingMeta ? existingMeta.remotePermissions : '0644'),
      initialSha256: initialHash,
      lastSha256: currentHash
    });

    // 4. Initialize chokidar watcher
    const watcher = chokidar.watch(localPath, {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    const watcherRecord = {
      watcher,
      hash: currentHash,
      remotePath,
      profileId,
      profileName,
      color,
      sessionId,
      debounceTimer: null
    };

    watcher.on('change', () => {
      logCacheDiagnostic('filesystem event', { event: 'change', localPath, remotePath, profileId, sessionId });
      if (watcherRecord.debounceTimer) clearTimeout(watcherRecord.debounceTimer);

      watcherRecord.debounceTimer = setTimeout(() => {
        const newHash = this._getFileHash(localPath);
        if (newHash && newHash !== watcherRecord.hash) {
          watcherRecord.hash = newHash;

          // Update lastSha256 in .meta.json manifest
          const manifest = this.readManifest(localPath);
          if (manifest) {
            manifest.lastSha256 = newHash;
            this.writeManifest(localPath, manifest);
          }

          logCacheDiagnostic('save detected', { localPath, remotePath, profileId, sessionId });
          // Notify renderer process of local save event
          if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
            this.ipcWindow.webContents.send('cache:file-saved', {
              localPath,
              remotePath,
              profileId,
              profileName: watcherRecord.profileName || (manifest ? manifest.profileName : 'Connection'),
              color: watcherRecord.color || (manifest ? manifest.color : '#68a063'),
              sessionId: watcherRecord.sessionId,
              fileName: path.basename(remotePath)
            });
          }
        }
      }, 500); // 500ms debounce supports editor atomic save file replace procedures safely
    });

    this.watchers.set(localPath, watcherRecord);
  }

  recoverWatchersOnStartup(ipcWindow) {
    if (ipcWindow) this.ipcWindow = ipcWindow;
    logCacheDiagnostic('recoverWatchersOnStartup entered', { cacheDir: this.cacheDir, exists: fs.existsSync(this.cacheDir) });
    if (!fs.existsSync(this.cacheDir)) return;

    // Async recursive manifest finder with depth limit to prevent stack overflow (Fix A6 + D4)
    const findManifests = async (dir, depth = 0) => {
      const MAX_DEPTH = 5;
      if (depth > MAX_DEPTH) return [];
      let results = [];
      try {
        const list = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of list) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const sub = await findManifests(fullPath, depth + 1);
            results = results.concat(sub);
          } else if (entry.isFile() && entry.name.endsWith('.meta.json')) {
            results.push(fullPath);
          }
        }
      } catch (e) {} // silently skip unreadable dirs
      return results;
    };

    findManifests(this.cacheDir).then(manifests => {
      logCacheDiagnostic('recoverWatchersOnStartup manifests found', { count: manifests.length, manifests });
      const modifiedBatch = [];

      manifests.forEach(manifestPath => {
        try {
          const raw = fs.readFileSync(manifestPath, 'utf8');
          const meta = JSON.parse(raw);
          if (meta && meta.localPath && fs.existsSync(meta.localPath)) {
            const currentHash = this._getFileHash(meta.localPath);
            const originalInitialHash = meta.initialSha256;
            const hasChanges = Boolean(currentHash && originalInitialHash && currentHash !== originalInitialHash);

            logCacheDiagnostic('recoverWatchersOnStartup checking file', {
              localPath: meta.localPath,
              remotePath: meta.remotePath,
              currentHash,
              originalInitialHash,
              hasChanges
            });

            // Re-attach chokidar watcher cleanly without popping open editor app
            this.openAndWatch(meta.localPath, meta.remotePath, { id: meta.profileId, name: meta.profileName, host: meta.host }, 'recovered', { modifyTime: meta.remoteMtime, permissions: meta.remotePermissions }, true);

            if (hasChanges) {
              modifiedBatch.push({
                localPath: meta.localPath,
                remotePath: meta.remotePath,
                profileId: meta.profileId,
                profileName: meta.profileName || 'Connection',
                host: meta.host || 'localhost',
                fileName: path.basename(meta.remotePath),
                remoteMtime: meta.remoteMtime || null
              });
            }
          }
        } catch (manifestErr) {
          console.error(`Error processing cache manifest ${manifestPath}:`, manifestErr);
          logCacheDiagnostic('recoverWatchersOnStartup single manifest error', { path: manifestPath, error: manifestErr.message }, 'error');
        }
      });

      if (modifiedBatch.length > 0) {
        logCacheDiagnostic('startup modified files detected -> sending IPC cache:batch-files-saved', { count: modifiedBatch.length, modifiedBatch });
        // Delay IPC by 500ms to ensure the renderer has registered its handlers (Fix C7)
        setTimeout(() => {
          if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
            this.ipcWindow.webContents.send('cache:batch-files-saved', modifiedBatch);
          }
        }, 500);
      }

      // Perform automatic stale cache cleanup (purges un-watched cache older than 7 days)
      this.cleanupStaleCache(7);
    }).catch(err => {
      console.error('Error recovering cache watchers on startup:', err);
      logCacheDiagnostic('recoverWatchersOnStartup error', { error: err.message, stack: err.stack }, 'error');
    });
  }

  cleanupStaleCache(maxAgeDays = 7) {
    if (!fs.existsSync(this.cacheDir)) return;
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    try {
      const subdirs = fs.readdirSync(this.cacheDir, { withFileTypes: true });
      for (const profileFolder of subdirs) {
        if (!profileFolder.isDirectory()) continue;
        const profilePath = path.join(this.cacheDir, profileFolder.name);
        const fileFolders = fs.readdirSync(profilePath, { withFileTypes: true });

        for (const itemDir of fileFolders) {
          if (!itemDir.isDirectory()) continue;
          const itemFolderPath = path.join(profilePath, itemDir.name);
          try {
            const stats = fs.statSync(itemFolderPath);
            let downloadedAtTime = stats.mtimeMs; // Default fallback to folder mtime

            const filesInFolder = fs.readdirSync(itemFolderPath);
            const manifestFile = filesInFolder.find(f => f.endsWith('.meta.json'));
            if (manifestFile) {
              try {
                const manifestPath = path.join(itemFolderPath, manifestFile);
                const rawMeta = fs.readFileSync(manifestPath, 'utf8');
                const meta = JSON.parse(rawMeta);
                if (meta && meta.downloadedAt) {
                  downloadedAtTime = new Date(meta.downloadedAt).getTime();
                }
              } catch (metaErr) {}
            }

            const isStale = (now - downloadedAtTime) > maxAgeMs;

            // Check if any file in this folder is currently being watched
            const isWatched = Array.from(this.watchers.keys()).some(p => p.startsWith(itemFolderPath));

            if (isStale && !isWatched) {
              fs.rmSync(itemFolderPath, { recursive: true, force: true });
              logCacheDiagnostic('cleaned stale edit cache folder', { itemFolderPath, ageDays: Math.round((now - downloadedAtTime) / 86400000) });
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      logCacheDiagnostic('cleanupStaleCache error', { error: err.message }, 'warn');
    }
  }

  updateWatcherSessionId(profileId, newSessionId, activeSessionIds = []) {
    this.watchers.forEach(record => {
      if (record.profileId === profileId) {
        if (record.sessionId === newSessionId) return;
        const isStale = !activeSessionIds.includes(record.sessionId);
        if (isStale) {
          const oldSess = record.sessionId;
          record.sessionId = newSessionId;
          logCacheDiagnostic('watcher session updated (recovered stale session)', { profileId, oldSessionId: oldSess, newSessionId, remotePath: record.remotePath });
        }
      }
    });
  }

  stopWatching(localPath) {
    if (this.watchers.has(localPath)) {
      const record = this.watchers.get(localPath);
      if (record.debounceTimer) clearTimeout(record.debounceTimer);
      if (record.watcher) record.watcher.close();
      this.watchers.delete(localPath);
    }
  }

  stopWatchingBySessionId(sessionId) {
    if (!sessionId) return;
    this.watchers.forEach((record, localPath) => {
      if (record.sessionId === sessionId) {
        this.stopWatching(localPath);
      }
    });
  }

  markUploaded(localPath) {
    if (!localPath || !fs.existsSync(localPath)) return;
    const currentHash = this._getFileHash(localPath);
    const existingMeta = this.readManifest(localPath);
    if (existingMeta && currentHash) {
      this.writeManifest(localPath, {
        ...existingMeta,
        initialSha256: currentHash,
        lastSha256: currentHash
      });
      logCacheDiagnostic('marked file uploaded baseline', { localPath, currentHash });
    }
  }

  dismissBatch(items) {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (item.localPath && fs.existsSync(item.localPath)) {
        const currentHash = this._getFileHash(item.localPath);
        const existingMeta = this.readManifest(item.localPath);
        if (existingMeta && currentHash) {
          this.writeManifest(item.localPath, {
            ...existingMeta,
            initialSha256: currentHash,
            lastSha256: currentHash
          });
          logCacheDiagnostic('dismissed startup batch item baseline', { localPath: item.localPath, currentHash });
        }
        this.stopWatching(item.localPath);
      }
    });
  }

  clearCache() {
    this.watchers.forEach(record => {
      if (record.debounceTimer) clearTimeout(record.debounceTimer);
      if (record.watcher) record.watcher.close();
    });
    this.watchers.clear();
    try {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch (e) {
      console.error('Error clearing cache dir:', e);
    }
  }
}

module.exports = CacheWatcherService;
