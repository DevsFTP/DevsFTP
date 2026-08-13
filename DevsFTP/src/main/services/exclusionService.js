/**
 * DevsFTP — Smart Exclusion Rules & Ignore Filter Engine
 * Manages user-configurable file/directory exclusion patterns, .gitignore parsing,
 * and provides instant matching for TransferEngine and CacheWatcherService.
 */

const fs = require('fs');
const path = require('path');
let app = null;
try {
  const electron = require('electron');
  app = electron.app;
} catch (e) {
  app = null;
}

const DEFAULT_PATTERNS = [
  '.git',
  '.gitignore',
  'node_modules',
  '.env',
  'vendor',
  '.DS_Store',
  'Thumbs.db',
  '*.tmp',
  '*.log',
  '*.bak'
];

class ExclusionService {
  constructor() {
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.devs_userData');
    this.prefsFile = path.join(userDataPath, 'devsftp_exclusion_prefs.json');
    this.prefs = this.loadPrefs();
    this.gitignoreCache = new Map(); // dirPath -> Array of glob regex rules
  }

  loadPrefs() {
    try {
      if (fs.existsSync(this.prefsFile)) {
        const raw = fs.readFileSync(this.prefsFile, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
          honorGitignore: parsed.honorGitignore !== undefined ? Boolean(parsed.honorGitignore) : true,
          patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [...DEFAULT_PATTERNS]
        };
      }
    } catch (e) {}
    return {
      enabled: true,
      honorGitignore: true,
      patterns: [...DEFAULT_PATTERNS]
    };
  }

  savePrefs(newPrefs) {
    try {
      this.prefs = {
        enabled: newPrefs.enabled !== undefined ? Boolean(newPrefs.enabled) : this.prefs.enabled,
        honorGitignore: newPrefs.honorGitignore !== undefined ? Boolean(newPrefs.honorGitignore) : this.prefs.honorGitignore,
        patterns: Array.isArray(newPrefs.patterns) ? newPrefs.patterns : this.prefs.patterns
      };
      fs.writeFileSync(this.prefsFile, JSON.stringify(this.prefs, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save exclusion prefs:', e);
    }
  }

  getPrefs() {
    return { ...this.prefs };
  }

  /**
   * Helper to convert simple wildcards like *.log, .git, node_modules into a RegExp
   */
  _patternToRegex(pattern) {
    let clean = pattern.trim().replace(/\/$/, '');
    if (!clean) return null;
    const escaped = clean
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`(^|[/\\\\])${escaped}([/\\\\]|$)`, 'i');
  }

  /**
   * Checks whether a file or directory path matches any active exclusion rule or .gitignore
   */
  isExcluded(targetPath, isDir = false) {
    if (!this.prefs.enabled || !targetPath) return false;

    const baseName = path.basename(targetPath);
    const normalizedPath = targetPath.replace(/\\/g, '/');

    // 1. Check User Exclusion Patterns
    for (const pat of this.prefs.patterns) {
      if (!pat || !pat.trim()) continue;
      const cleanPat = pat.trim();

      // Exact name match (e.g. .env, .git, node_modules)
      if (cleanPat === baseName || cleanPat === baseName + '/') {
        return true;
      }

      // Regex wildcard match
      const rx = this._patternToRegex(cleanPat);
      if (rx && rx.test(normalizedPath)) {
        return true;
      }
    }

    // 2. Check local .gitignore if enabled
    if (this.prefs.honorGitignore && fs.existsSync(targetPath)) {
      if (this._matchesGitignore(targetPath)) {
        return true;
      }
    }

    return false;
  }

  _matchesGitignore(targetPath) {
    try {
      let currentDir = fs.statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath);
      const root = path.parse(currentDir).root;

      while (currentDir && currentDir !== root) {
        const gitignorePath = path.join(currentDir, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const rules = this._getGitignoreRules(gitignorePath);
          const relPath = path.relative(currentDir, targetPath).replace(/\\/g, '/');
          for (const rx of rules) {
            if (rx.test(relPath) || rx.test('/' + relPath)) {
              return true;
            }
          }
        }
        currentDir = path.dirname(currentDir);
      }
    } catch (e) {}
    return false;
  }

  _getGitignoreRules(gitignorePath) {
    if (this.gitignoreCache.has(gitignorePath)) {
      return this.gitignoreCache.get(gitignorePath);
    }
    const rules = [];
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const rx = this._patternToRegex(line);
        if (rx) rules.push(rx);
      }
    } catch (e) {}
    this.gitignoreCache.set(gitignorePath, rules);
    return rules;
  }
}

module.exports = ExclusionService;
