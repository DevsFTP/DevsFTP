/**
 * DevsFTP — Directory Size Calculation Service
 * Recursively calculates folder sizes for local paths and remote server paths.
 * Runs asynchronously to prevent blocking the Electron main thread.
 */

const fs = require('fs');
const path = require('path');
const { formatFileSize } = require('./pathUtils');

class DirSizeService {
  constructor(ipcWindow) {
    this.ipcWindow = ipcWindow;
    this.runningCalculations = new Set(); // Set of active targetPaths
  }

  /**
   * Main entry point to calculate folder size.
   * If already running for targetPath, returns immediately.
   */
  async calculateSize(targetPath, isRemote, session) {
    if (!targetPath) return;
    
    // Normalize targetPath key
    const pathKey = isRemote ? `remote:${targetPath}` : `local:${path.resolve(targetPath)}`;
    if (this.runningCalculations.has(pathKey)) {
      console.log(`[DirSizeService] Calculation already in progress for: ${pathKey}`);
      return;
    }

    this.runningCalculations.add(pathKey);
    console.log(`[DirSizeService] Starting calculation for: ${pathKey}`);

    try {
      let result;
      if (isRemote) {
        if (!session || !session.connected) {
          throw new Error('Remote session is not connected');
        }
        result = await this._getRemoteSize(session, targetPath);
      } else {
        result = await this._getLocalSize(targetPath);
      }

      const formatted = formatFileSize(result.size);
      console.log(`[DirSizeService] Completed: ${pathKey} -> ${formatted} (${result.fileCount} files)`);

      // Emit IPC event to renderer
      if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
        this.ipcWindow.webContents.send('dir-size:updated', {
          targetPath,
          isRemote,
          totalBytes: result.size,
          formattedSize: formatted,
          fileCount: result.fileCount
        });
      }
    } catch (err) {
      console.error(`[DirSizeService] Error calculating size for ${pathKey}:`, err);
    } finally {
      this.runningCalculations.delete(pathKey);
    }
  }

  /**
   * Recursively traverses local directories
   */
  async _getLocalSize(dirPath, visited = new Set()) {
    const resolvedPath = path.resolve(dirPath);
    if (visited.has(resolvedPath)) return { size: 0, fileCount: 0 };
    visited.add(resolvedPath);

    let size = 0;
    let fileCount = 0;

    try {
      const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(resolvedPath, entry.name);
        
        // Skip symbol links to prevent loops
        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
          const sub = await this._getLocalSize(fullPath, visited);
          size += sub.size;
          fileCount += sub.fileCount;
        } else if (entry.isFile()) {
          try {
            const stats = await fs.promises.stat(fullPath);
            size += stats.size;
            fileCount++;
          } catch (statErr) {}
        }
      }
    } catch (readdirErr) {
      // Return partial size if some subdirectory is unreadable
    }

    return { size, fileCount };
  }

  /**
   * Recursively traverses remote directories via session driver
   */
  async _getRemoteSize(session, remotePath, visited = new Set()) {
    if (visited.has(remotePath)) return { size: 0, fileCount: 0 };
    visited.add(remotePath);

    let size = 0;
    let fileCount = 0;

    try {
      const res = await session.list(remotePath);
      const entries = (res && res.files) ? res.files : [];
      
      for (const entry of entries) {
        // Skip links to prevent circular referencing
        if (entry.type === 'l') continue;

        if (entry.isDir) {
          const sub = await this._getRemoteSize(session, entry.path, visited);
          size += sub.size;
          fileCount += sub.fileCount;
        } else {
          size += entry.size || 0;
          fileCount++;
        }
      }
    } catch (listErr) {
      // Return partial size if folder read fails
    }

    return { size, fileCount };
  }
}

module.exports = DirSizeService;
