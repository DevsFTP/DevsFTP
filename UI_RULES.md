# UI Rules — DevsFTP

## Verified Renderer & UI Map
DevsFTP uses a vanilla JavaScript renderer architecture structured cleanly around `src/renderer/index.html` and modular scripts:

```text
src/renderer/
├── index.html
├── styles/
│   └── main.css
├── js/
│   ├── app.js               (Renderer initialization & main binding)
│   ├── connectionDialog.js  (Site manager & connection modal)
│   ├── fileBrowser.js       (Dual-pane local & remote file listings)
│   ├── transferQueue.js     (Active & queued file transfers)
│   ├── directoryCompare.js  (File comparison & diff tools)
│   ├── sessionManager.js    (Active tabbed sessions)
│   ├── terminal.js          (Integrated SSH terminal)
│   ├── tunnelManager.js     (Port forwarding & tunnel UI)
│   ├── scheduledJobs.js     (Automation & job scheduler UI)
│   ├── logViewer.js         (Activity & diagnostic logging)
│   └── errorHandler.js      (Client exception UI handler)
└── vendor/
    └── xterm/xterm.css
```

---

## 1. UI Governance & Component Reuse
Before adding or modifying any UI element:
1. Inspect existing UI in `src/renderer/index.html` and the corresponding script in `src/renderer/js/`.
2. Identify the closest existing component pattern (modals in `connectionDialog.js`, table views in `fileBrowser.js`, queue rows in `transferQueue.js`, terminal containers in `terminal.js`).
3. Reuse established HTML structures and CSS classes from `src/renderer/styles/main.css`.
4. Preserve existing spacing, sizing, typography, button styles, dialog overlays, and interaction patterns.

---

## 2. Zero UI Drift Policy
- Do **NOT** invent new visual themes or custom styling paradigms for individual features.
- Do **NOT** introduce third-party UI component frameworks (Bootstrap, React, Vue, Tailwind) into the renderer.
- Do **NOT** alter existing layout structures (dual-pane browser, queue pane, terminal container) while implementing unrelated features.
- Do **NOT** introduce inconsistent controls merely because they are convenient to write.

---

## 3. Asset & Module Conventions
- **Icons**: Use existing SVG/PNG assets from `assets/` and `assets/branding/`.
- **Modals**: Follow modal dialog structures from `connectionDialog.js` and `tunnelManager.js` (including keybindings like Escape to close).
- **Log Routing**: Activity and status entries must route through `logViewer.js` and `errorHandler.js`.
