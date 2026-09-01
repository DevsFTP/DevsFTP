const test = require('node:test');
const assert = require('node:assert');
const ThrottleTransform = require('../src/main/services/transfer/throttleTransform');
const { Readable, Writable } = require('stream');

test('ThrottleTransform creates transform stream cleanly', () => {
  const throttle = new ThrottleTransform(500); // 500 KB/s
  assert.strictEqual(throttle.limitBytesPerSec, 500 * 1024);
});

test('ThrottleTransform passes unthrottled data when limit is 0', (t, done) => {
  const throttle = new ThrottleTransform(0);
  let received = Buffer.alloc(0);

  const src = Readable.from([Buffer.from('hello '), Buffer.from('world')]);
  const dst = new Writable({
    write(chunk, enc, cb) {
      received = Buffer.concat([received, chunk]);
      cb();
    }
  });

  dst.on('finish', () => {
    assert.strictEqual(received.toString(), 'hello world');
    done();
  });

  src.pipe(throttle).pipe(dst);
});
