/**
 * Path Utilities for Cross-Platform File Systems
 * Normalizes Windows local paths and POSIX remote paths cleanly.
 */

const path = require('path');

function normalizePOSIXPath(rawPath) {
  if (!rawPath) return '/';
  // Replace all backslashes with forward slashes
  let normalized = rawPath.replace(/\\/g, '/');
  // Collapse multiple slashes into single slash
  normalized = normalized.replace(/\/+/g, '/');
  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  // Strip trailing slash unless root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function joinPOSIXPath(...parts) {
  const joined = parts.filter(Boolean).join('/');
  return normalizePOSIXPath(joined);
}

function getPOSIXParentPath(remotePath) {
  const normalized = normalizePOSIXPath(remotePath);
  if (normalized === '/') return '/';
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return '/';
  return normalized.slice(0, idx);
}

function formatFileSize(bytes) {
  if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatPermissions(mode) {
  if (mode === undefined || mode === null) return 'rwxr-xr-x (0755)';
  const octal = (mode & 0777).toString(8).padStart(4, '0');
  
  let str = '';
  // User
  str += (mode & 0400) ? 'r' : '-';
  str += (mode & 0200) ? 'w' : '-';
  str += (mode & 0100) ? 'x' : '-';
  // Group
  str += (mode & 0040) ? 'r' : '-';
  str += (mode & 0020) ? 'w' : '-';
  str += (mode & 0010) ? 'x' : '-';
  // Others
  str += (mode & 0004) ? 'r' : '-';
  str += (mode & 0002) ? 'w' : '-';
  str += (mode & 0001) ? 'x' : '-';
  
  return `${str} (${octal})`;
}

module.exports = {
  normalizePOSIXPath,
  joinPOSIXPath,
  getPOSIXParentPath,
  formatFileSize,
  formatPermissions
};
