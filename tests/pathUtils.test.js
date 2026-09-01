const test = require('node:test');
const assert = require('node:assert');
const { normalizePOSIXPath, formatPermissions, formatFileSize } = require('../src/main/services/pathUtils');

test('normalizePOSIXPath normalizes Windows drive letters and POSIX paths', () => {
  assert.strictEqual(normalizePOSIXPath('C:\\Users\\test\\file.txt'), '/C:/Users/test/file.txt');
  assert.strictEqual(normalizePOSIXPath('/home/user//docs/'), '/home/user/docs');
  assert.strictEqual(normalizePOSIXPath('rel/path/'), '/rel/path');
});

test('formatPermissions formats octal modes to rwxrwxrwx (octal) strings', () => {
  assert.strictEqual(formatPermissions(0o755), 'rwxr-xr-x (0755)');
  assert.strictEqual(formatPermissions(0o644), 'rw-r--r-- (0644)');
  assert.strictEqual(formatPermissions(null), 'rwxr-xr-x (0755)');
});

test('formatFileSize formats byte numbers to human-readable strings', () => {
  assert.strictEqual(formatFileSize(0), '0 B');
  assert.strictEqual(formatFileSize(1024), '1 KB');
  assert.strictEqual(formatFileSize(1048576), '1 MB');
});
