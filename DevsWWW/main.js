/* =========================================================================
   DevsFTP Site — Main JS
   ========================================================================= */

(function () {
  'use strict';

  /* ── Theme System ─────────────────────────────────────────────────────── */
  // Themes: 'system' → 'light' → 'dark' → 'system' ...
  const STORAGE_KEY = 'devsftp_site_theme';
  const THEMES      = ['system', 'light', 'dark'];

  const getSystemTheme = () =>
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

  const getSaved = () => localStorage.getItem(STORAGE_KEY) || 'system';

  function applyTheme(pref) {
    const resolved = pref === 'system' ? getSystemTheme() : pref;
    document.documentElement.setAttribute('data-theme', resolved);
    updateThemeIcon(pref);
    
    // Highlight the active option in the dropdown
    const optBtns = document.querySelectorAll('.theme-opt-btn');
    optBtns.forEach((btn) => {
      if (btn.getAttribute('data-theme-value') === pref) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updateThemeIcon(pref) {
    const btn = document.getElementById('btn-theme');
    if (!btn) return;

    const icons = {
      system: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>`,
      light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>`,
      dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>`
    };

    btn.innerHTML = icons[pref] || icons.system;
  }

  /* ── Init ─────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Apply saved or system theme immediately
    applyTheme(getSaved());

    // Theme selector dropdown logic
    const themeDropdown = document.getElementById('theme-dropdown');
    const btnTheme = document.getElementById('btn-theme');
    const optBtns = document.querySelectorAll('.theme-opt-btn');

    if (btnTheme && themeDropdown) {
      btnTheme.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle('active');
        const expanded = themeDropdown.classList.contains('active');
        btnTheme.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
    }

    optBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const themeVal = btn.getAttribute('data-theme-value');
        localStorage.setItem(STORAGE_KEY, themeVal);
        applyTheme(themeVal);
        if (themeDropdown) {
          themeDropdown.classList.remove('active');
          if (btnTheme) btnTheme.setAttribute('aria-expanded', 'false');
        }
      });
    });

    document.addEventListener('click', () => {
      if (themeDropdown && themeDropdown.classList.contains('active')) {
        themeDropdown.classList.remove('active');
        if (btnTheme) btnTheme.setAttribute('aria-expanded', 'false');
      }
    });
    // Screenshot Preview Modal logic
    const previewModal = document.getElementById('preview-modal');
    const previewImg = document.getElementById('preview-img');
    const btnPreviewClose = document.getElementById('btn-preview-close');
    const screenshotContainers = document.querySelectorAll('.screenshot-container');

    const openPreview = (src) => {
      if (previewModal && previewImg) {
        previewImg.src = src;
        previewModal.classList.add('active');
        previewModal.setAttribute('aria-hidden', 'false');
      }
    };

    const closePreview = () => {
      if (previewModal) {
        previewModal.classList.remove('active');
        previewModal.setAttribute('aria-hidden', 'true');
      }
    };

    screenshotContainers.forEach((container) => {
      container.addEventListener('click', (e) => {
        e.stopPropagation();
        let activeSrc = '';
        const imgs = container.querySelectorAll('img');
        imgs.forEach((img) => {
          if (window.getComputedStyle(img).display !== 'none') {
            activeSrc = img.getAttribute('src');
          }
        });
        if (activeSrc) {
          openPreview(activeSrc);
        }
      });
    });

    if (btnPreviewClose) {
      btnPreviewClose.addEventListener('click', closePreview);
    }

    if (previewModal) {
      previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
          closePreview();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePreview();
      }
    });
    // Watch for OS preference changes when on 'system'
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      if (getSaved() === 'system') applyTheme('system');
    });

    // Mark active nav link
    const links = document.querySelectorAll('.site-nav a');
    links.forEach(function (a) {
      if (a.getAttribute('href') === window.location.pathname ||
          window.location.pathname.startsWith(a.getAttribute('href')) && a.getAttribute('href') !== '/') {
        a.classList.add('active');
      }
    });
  });

})();
