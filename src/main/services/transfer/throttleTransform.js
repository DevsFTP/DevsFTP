/**
 * DevsFTP — Remote Development Workspace
 * Copyright (C) 2026 DevsFTP.com
 *
 * ThrottleTransform Stream for DevsFTP Core Transfer Engine
 * Enforces bandwidth rate limiting (KB/s) on readable/writable streams using backpressure.
 */

const { Transform } = require('stream');

class ThrottleTransform extends Transform {
  constructor(limitKBps = 0) {
    super();
    this.limitBytesPerSec = limitKBps > 0 ? limitKBps * 1024 : 0;
    this.windowMs = 100; // 100ms time slice
    this.bytesWrittenInWindow = 0;
    this.lastWindowReset = Date.now();
  }

  setLimitKBps(limitKBps) {
    this.limitBytesPerSec = limitKBps > 0 ? limitKBps * 1024 : 0;
  }

  _transform(chunk, encoding, callback) {
    if (!this.limitBytesPerSec || this.limitBytesPerSec <= 0) {
      return callback(null, chunk);
    }

    const now = Date.now();
    const elapsed = now - this.lastWindowReset;

    if (elapsed >= this.windowMs) {
      this.bytesWrittenInWindow = 0;
      this.lastWindowReset = now;
    }

    const maxBytesPerWindow = (this.limitBytesPerSec * (this.windowMs / 1000));
    this.bytesWrittenInWindow += chunk.length;

    if (this.bytesWrittenInWindow > maxBytesPerWindow) {
      const excess = this.bytesWrittenInWindow - maxBytesPerWindow;
      const delayMs = Math.ceil((excess / this.limitBytesPerSec) * 1000);
      setTimeout(() => {
        this.bytesWrittenInWindow = chunk.length;
        this.lastWindowReset = Date.now();
        callback(null, chunk);
      }, Math.max(10, delayMs));
    } else {
      callback(null, chunk);
    }
  }
}

module.exports = ThrottleTransform;
