/**
 * Protocol Log Console Viewer Component
 * Renders streaming connection events, protocol commands, and errors.
 */

window.LogViewer = {
  container: null,

  init() {
    this.container = document.getElementById('log-container');
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.onLogMessage) {
      api.onLogMessage((log) => this.addEntry(log.type, log.message, log.timestamp));
    }

    const btnCopyLogs = document.getElementById('btn-copy-logs');
    if (btnCopyLogs) {
      btnCopyLogs.addEventListener('click', () => {
        if (!this.container) return;
        const text = Array.from(this.container.children).map(el => el.textContent).join('\n');
        navigator.clipboard.writeText(text).then(() => {
          const orig = btnCopyLogs.textContent;
          btnCopyLogs.textContent = '✓ Copied!';
          setTimeout(() => { btnCopyLogs.textContent = orig; }, 2000);
        }).catch(() => {});
      });
    }

    const btnClearLogs = document.getElementById('btn-clear-logs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => this.clear());
    }
  },

  addEntry(type, message, timestamp = new Date().toLocaleTimeString()) {
    if (!this.container) return;
    const div = document.createElement('div');
    div.className = `log-entry ${type || 'info'}`;
    div.textContent = `[${timestamp}] ${message}`;
    this.container.appendChild(div);
    this.container.scrollTop = this.container.scrollHeight;
  },

  clear() {
    if (this.container) this.container.innerHTML = '';
  }
};
