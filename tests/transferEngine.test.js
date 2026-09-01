const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const TransferEngine = require('../src/main/services/transfer/transferEngine');

test('TransferEngine initializes queue and history storage', () => {
  const engine = new TransferEngine(null, () => {});
  assert.ok(Array.isArray(engine.getQueue()));
  assert.ok(Array.isArray(engine.history));
});

test('TransferEngine upserts queue task cleanly', () => {
  const engine = new TransferEngine(null, () => {});
  const task = {
    id: 'test_task_1',
    type: 'upload',
    source: '/local/file.txt',
    dest: '/remote/file.txt',
    profileId: 'p1',
    status: 'Queued'
  };

  engine.upsertQueueTask(task);
  const queue = engine.getQueue();
  const found = queue.find(q => q.id === 'test_task_1');
  assert.ok(found);
  assert.strictEqual(found.dest, '/remote/file.txt');

  // Clean up test task
  engine.removeQueueItem('test_task_1');
});

test('TransferEngine cancels active transfer via cancelTransfer token', () => {
  const engine = new TransferEngine(null, () => {});
  const task = {
    id: 'cancel_test_task',
    type: 'download',
    source: '/remote/big.bin',
    dest: '/local/big.bin',
    profileId: 'p1',
    status: 'Running'
  };

  engine.upsertQueueTask(task);
  const controller = new AbortController();
  engine.cancellationTokens.set('cancel_test_task', controller);

  assert.strictEqual(controller.signal.aborted, false);
  engine.cancelTransfer('cancel_test_task');
  assert.strictEqual(controller.signal.aborted, true);

  const found = engine.getQueue().find(q => q.id === 'cancel_test_task');
  assert.strictEqual(found.status, 'Cancelled');

  // Clean up
  engine.removeQueueItem('cancel_test_task');
});
