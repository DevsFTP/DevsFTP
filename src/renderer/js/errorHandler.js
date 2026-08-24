/**
 * Global Uncaught Error & Promise Rejection Handler for DevsFTP Renderer
 * Intercepts runtime exceptions and writes them to the diagnostic log.
 */
const stringifyDiagnosticValue = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  try {
    return JSON.stringify(value, (key, nestedValue) => {
      if (nestedValue instanceof Error) {
        return {
          name: nestedValue.name,
          message: nestedValue.message,
          stack: nestedValue.stack
        };
      }
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        if (seen.has(nestedValue)) return '[Circular]';
        seen.add(nestedValue);
      }
      return nestedValue;
    }, 2);
  } catch (e) {
    return String(value);
  }
};

const getDiagnosticApi = () => window.devsFTP || window.pulseFTP || null;

const emitDiagnostic = (entry) => {
  const api = getDiagnosticApi();
  if (api && api.diagnosticLog) {
    api.diagnosticLog(entry);
    return;
  }
  if (api && api.appendDebugLog) {
    api.appendDebugLog(typeof entry === 'string' ? entry : stringifyDiagnosticValue(entry));
  }
};

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

console.error = (...args) => {
  emitDiagnostic({
    scope: 'renderer',
    event: 'console.error',
    level: 'error',
    message: args.map(stringifyDiagnosticValue).join(' ')
  });
  return originalConsoleError(...args);
};

console.warn = (...args) => {
  emitDiagnostic({
    scope: 'renderer',
    event: 'console.warn',
    level: 'warn',
    message: args.map(stringifyDiagnosticValue).join(' ')
  });
  return originalConsoleWarn(...args);
};

window.onerror = function (message, source, lineno, colno, error) {
  const fileBasename = source ? source.split('/').pop().split('\\').pop() : 'unknown';
  emitDiagnostic({
    scope: 'renderer',
    event: 'window.onerror',
    level: 'error',
    message: String(message),
    details: {
      file: fileBasename,
      line: lineno,
      column: colno,
      stack: error && error.stack ? error.stack : null
    },
    error
  });
  return false;
};

window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason;
  emitDiagnostic({
    scope: 'renderer',
    event: 'unhandledrejection',
    level: 'error',
    message: reason ? (reason.message || String(reason)) : 'Unknown promise rejection',
    details: {
      stack: reason && reason.stack ? reason.stack : null
    },
    error: reason
  });
});

window.addEventListener('error', function (event) {
  if (!event || !event.target) return;
  const target = event.target;
  const tagName = String(target.tagName || '').toUpperCase();
  if (tagName !== 'SCRIPT' && tagName !== 'LINK') return;
  emitDiagnostic({
    scope: 'renderer',
    event: 'failed script loading',
    level: 'error',
    message: `Failed to load ${tagName.toLowerCase()} resource`,
    details: {
      src: target.src || target.href || null
    }
  });
}, true);
