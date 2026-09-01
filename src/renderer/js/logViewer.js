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

    const logsTabBtn = document.querySelector('.drawer-tab[data-tab="tab-logs"]');
    if (logsTabBtn) {
      logsTabBtn.addEventListener('click', () => {
        this.scrollToBottom();
      });
    }

    const btnCopyLogs = document.getElementById('btn-copy-logs');
    if (btnCopyLogs) {
      btnCopyLogs.addEventListener('click', () => {
        if (!this.container) return;
        const text = Array.from(this.container.children).map(el => el.textContent).join('\n');
        if (!text) return;
        const copied = (window.DevsApp && window.DevsApp.copyToClipboard) 
          ? window.DevsApp.copyToClipboard(text)
          : this.copyFallback(text);
        if (copied) {
          const orig = btnCopyLogs.textContent;
          btnCopyLogs.textContent = '✓ Copied!';
          setTimeout(() => { btnCopyLogs.textContent = orig; }, 2000);
        }
      });
    }

    const btnClearLogs = document.getElementById('btn-clear-logs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => this.clear());
    }
  },

  scrollToBottom() {
    if (!this.container) return;
    requestAnimationFrame(() => {
      if (this.container) {
        this.container.scrollTop = this.container.scrollHeight;
      }
    });
  },

  addEntry(type, message, timestamp = new Date().toLocaleTimeString()) {
    if (!this.container) return;
    const div = document.createElement('div');
    div.className = `log-entry ${type || 'info'}`;
    div.textContent = `[${timestamp}] ${message}`;
    this.container.appendChild(div);
    this.scrollToBottom();
  },

  clear() {
    if (this.container) this.container.innerHTML = '';
  },

  copyFallback(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (err) {
      return false;
    }
  }
};
