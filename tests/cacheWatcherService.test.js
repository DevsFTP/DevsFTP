const test = require('node:test');
const assert = require('node:assert');
const CacheWatcherService = require('../src/main/services/cacheWatcherService');

test('CacheWatcherService stopWatching clears pending debounceTimer', () => {
  const watcher = new CacheWatcherService();
  const testPath = 'C:\\temp\\fake_file.txt';

  let timerFired = false;
  const mockTimer = setTimeout(() => { timerFired = true; }, 5000);

  watcher.watchers.set(testPath, {
    watcher: { close: () => {} },
    debounceTimer: mockTimer,
    profileId: 'prof1',
    sessionId: 'sess1'
  });

  watcher.stopWatching(testPath);
  assert.strictEqual(watcher.watchers.has(testPath), false);

  // Clear mock timer just in case
  clearTimeout(mockTimer);
});

test('CacheWatcherService stopWatchingBySessionId tears down session watchers', () => {
  const watcher = new CacheWatcherService();
  const fileA = 'C:\\temp\\fileA.txt';
  const fileB = 'C:\\temp\\fileB.txt';

  watcher.watchers.set(fileA, { watcher: { close: () => {} }, sessionId: 'sess_drop' });
  watcher.watchers.set(fileB, { watcher: { close: () => {} }, sessionId: 'sess_keep' });

  watcher.stopWatchingBySessionId('sess_drop');
  assert.strictEqual(watcher.watchers.has(fileA), false);
  assert.strictEqual(watcher.watchers.has(fileB), true);
});
