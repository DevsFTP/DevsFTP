/**
 * Integrated SSH Terminal Component
 * Powered by Xterm.js with auto-fit addon and IPC PTY shell bridge.
 * Supports dynamic live theme and profile identity accent color updates.
 */

window.SSHTerminal = {
  term: null,
  fitAddon: null,
  container: null,
  initialized: false,

  init() {
    this.container = document.getElementById('terminal-container');
    if (!this.container) return;

    // Check Xterm global availability
    const TerminalClass = window.Terminal || (window.xterm && window.xterm.Terminal);
    const FitAddonClass = window.FitAddon ? window.FitAddon.FitAddon : (window.FitAddonAddon && window.FitAddonAddon.FitAddon);

    if (!TerminalClass) {
      console.warn('Xterm library not available globally yet.');
      return;
    }

    this.term = new TerminalClass({
      cursorBlink: true,
      cursorStyle: 'block',
      cursorInactiveStyle: 'block',
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: 13,
      convertEol: true,
      theme: {
        background: '#111315',
        foreground: '#E6E6E6',
        cursor: '#10B981',
        selectionBackground: 'rgba(255, 255, 255, 0.2)'
      }
    });

    if (FitAddonClass) {
      this.fitAddon = new FitAddonClass();
      this.term.loadAddon(this.fitAddon);
    }

    this.term.open(this.container);
    if (this.fitAddon) this.fitAddon.fit();

    // Ensure cursor is visible & spacebar is handled properly
    this.term.attachCustomKeyEventHandler((e) => {
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        if (e.type === 'keydown') {
          if (this.term && document.activeElement !== this.term.textarea) {
            this.term.focus();
          }
        }
      }
      return true;
    });

    // Add click listeners to focus terminal immediately on click
    if (this.container) {
      this.container.addEventListener('click', () => this.focus());
    }
    const tabTerminal = document.getElementById('tab-terminal');
    if (tabTerminal) {
      tabTerminal.addEventListener('click', () => this.focus());
    }

    // Listen to user keyboard input in terminal -> send to Main IPC
    this.term.onData((data) => {
      const api = window.devsFTP || window.pulseFTP;
      const sessId = window.SessionManager ? window.SessionManager.activeSessionId : 'default';
      if (api && api.sshTerminalWrite) {
        api.sshTerminalWrite(data, sessId);
      }
    });

    // Listen to remote PTY data from Main IPC -> write to Xterm
    const api = window.devsFTP || window.pulseFTP;
    if (api && api.onSSHTerminalData) {
      api.onSSHTerminalData((payload) => {
        const { sessionId, data } = payload || {};
        if (!sessionId) return;

        if (!this.buffers) this.buffers = {};
        if (!this.buffers[sessionId]) this.buffers[sessionId] = '';
        this.buffers[sessionId] += data;

        const activeSessId = window.SessionManager ? window.SessionManager.activeSessionId : 'default';
        if (sessionId === activeSessId && this.term) {
          this.term.write(data);
        }
      });
    }

    // Auto resize listener
    window.addEventListener('resize', () => this.resize());
    this.initialized = true;

    this.term.writeln('\x1b[36mDevsFTP Embedded SSH Terminal ready.\x1b[0m');
    this.term.writeln('Connect to an SFTP profile to initialize shell PTY session.\r\n');
    this.focus();
  },

  focus() {
    if (this.term) {
      try {
        this.term.focus();
      } catch (e) {}
    }
  },

  setTheme(themeMode, accentHex) {
    if (!this.term) return;
    const isLight = themeMode === 'light';
    const bg = isLight ? '#ffffff' : '#111315';
    const fg = isLight ? '#0f172a' : '#E6E6E6';
    const cursor = accentHex || '#10B981';
    const selection = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)';

    this.term.options.theme = {
      background: bg,
      foreground: fg,
      cursor: cursor,
      selectionBackground: selection
    };
  },

  resize() {
    if (this.fitAddon) {
      try {
        this.fitAddon.fit();
        const api = window.devsFTP || window.pulseFTP;
        const sessId = window.SessionManager ? window.SessionManager.activeSessionId : 'default';
        if (api && api.sshTerminalResize && this.term) {
          api.sshTerminalResize(this.term.cols, this.term.rows, sessId);
        }
      } catch (e) {}
    }
  },

  switchSession(sessionId) {
    if (!this.term) return;
    this.term.clear();
    if (!this.buffers) this.buffers = {};
    const buffer = this.buffers[sessionId] || '\x1b[36mDevsFTP SSH Session Terminal\x1b[0m\r\n';
    this.term.write(buffer);
    this.resize();
  },

  clear() {
    if (this.term) this.term.clear();
  },

  updateOptions(opts = {}) {
    if (!this.term) return;
    if (opts.fontFamily !== undefined) this.term.options.fontFamily = opts.fontFamily;
    if (opts.fontSize !== undefined) this.term.options.fontSize = parseInt(opts.fontSize, 10) || 13;
    if (opts.cursorStyle !== undefined) {
      this.term.options.cursorStyle = opts.cursorStyle;
      this.term.options.cursorInactiveStyle = opts.cursorStyle;
    }
    if (opts.cursorBlink !== undefined) this.term.options.cursorBlink = Boolean(opts.cursorBlink);
    if (opts.scrollback !== undefined) this.term.options.scrollback = parseInt(opts.scrollback, 10) || 5000;
    this.resize();
  }
};
