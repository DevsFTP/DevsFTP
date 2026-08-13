/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Terminal manager (xterm.js instance wrap)
 */

window.TerminalManager = {
  instances: {}, // sessionId -> { term, fitAddon, container }

  createTerminal(sessionId, container, accentColor) {
    const TerminalClass = window.Terminal || (window.xterm && window.xterm.Terminal);
    const FitAddonClass = window.FitAddon ? window.FitAddon.FitAddon : (window.FitAddonAddon && window.FitAddonAddon.FitAddon);

    if (!TerminalClass) {
      console.error('Xterm library is not loaded.');
      return null;
    }

    const term = new TerminalClass({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: 13,
      convertEol: true,
      theme: {
        background: '#0B0F17',
        foreground: '#F8FAFC',
        cursor: accentColor || '#3B82F6',
        selectionBackground: 'rgba(255, 255, 255, 0.15)'
      }
    });

    let fitAddon = null;
    if (FitAddonClass) {
      fitAddon = new FitAddonClass();
      term.loadAddon(fitAddon);
    }

    term.open(container);
    if (fitAddon) {
      setTimeout(() => {
        try {
          fitAddon.fit();
          window.devSSH.terminal.resize(term.cols, term.rows, sessionId);
        } catch (e) {}
      }, 50);
    }

    // Pipe user keystrokes to IPC
    term.onData((data) => {
      window.devSSH.terminal.write(data, sessionId);
    });

    // Handle focus on click
    container.addEventListener('click', () => {
      term.focus();
    });

    this.instances[sessionId] = { term, fitAddon, container };

    return term;
  },

  write(sessionId, data) {
    const inst = this.instances[sessionId];
    if (inst && inst.term) {
      inst.term.write(data);
    }
  },

  resize(sessionId) {
    const inst = this.instances[sessionId];
    if (inst && inst.fitAddon && inst.term) {
      try {
        inst.fitAddon.fit();
        window.devSSH.terminal.resize(inst.term.cols, inst.term.rows, sessionId);
      } catch (e) {}
    }
  },

  resizeAll() {
    for (const id in this.instances) {
      this.resize(id);
    }
  },

  focus(sessionId) {
    const inst = this.instances[sessionId];
    if (inst && inst.term) {
      try {
        inst.term.focus();
      } catch (e) {}
    }
  },

  destroy(sessionId) {
    const inst = this.instances[sessionId];
    if (inst) {
      try {
        inst.term.dispose();
      } catch (e) {}
      delete this.instances[sessionId];
    }
  }
};

window.addEventListener('resize', () => {
  window.TerminalManager.resizeAll();
});
