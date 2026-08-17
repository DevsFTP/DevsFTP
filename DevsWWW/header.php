<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title><?php echo isset($page_title) ? htmlspecialchars($page_title) : "DevsFTP — The FTP & SFTP Client for Windows"; ?></title>
  <meta name="title" content="<?php echo isset($page_title) ? htmlspecialchars($page_title) : "DevsFTP — The FTP & SFTP Client for Windows"; ?>">
  <meta name="description" content="<?php echo isset($page_desc) ? htmlspecialchars($page_desc) : "DevsFTP is a free, open-source FTP and SFTP client for Windows built for developers."; ?>">
  <meta name="keywords" content="<?php echo isset($page_keywords) ? htmlspecialchars($page_keywords) : "sftp client, ftp client, windows sftp, open source ftp, ssh terminal, developer tools, devsftp"; ?>">
  <meta name="robots" content="index, follow">

  <!-- Canonical URL -->
  <link rel="canonical" href="<?php 
    if (isset($page_canonical)) {
      echo htmlspecialchars($page_canonical);
    } else {
      $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
      echo htmlspecialchars($protocol . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
    }
  ?>">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="<?php echo isset($page_canonical) ? htmlspecialchars($page_canonical) : "https://devsftp.com/"; ?>">
  <meta property="og:title" content="<?php echo isset($page_title) ? htmlspecialchars($page_title) : "DevsFTP — The FTP & SFTP Client for Windows"; ?>">
  <meta property="og:description" content="<?php echo isset($page_desc) ? htmlspecialchars($page_desc) : "DevsFTP is a free, open-source FTP and SFTP client for Windows built for developers."; ?>">
  <meta property="og:image" content="<?php echo isset($og_image) ? htmlspecialchars($og_image) : "https://devsftp.com/assets/branding/og-image.png"; ?>">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="<?php echo isset($page_canonical) ? htmlspecialchars($page_canonical) : "https://devsftp.com/"; ?>">
  <meta property="twitter:title" content="<?php echo isset($page_title) ? htmlspecialchars($page_title) : "DevsFTP — The FTP & SFTP Client for Windows"; ?>">
  <meta property="twitter:description" content="<?php echo isset($page_desc) ? htmlspecialchars($page_desc) : "DevsFTP is a free, open-source FTP and SFTP client for Windows built for developers."; ?>">
  <meta property="twitter:image" content="<?php echo isset($og_image) ? htmlspecialchars($og_image) : "https://devsftp.com/assets/branding/og-image.png"; ?>">

  <!-- Prevent theme flash -->
  <script>
    (function(){
      var t = localStorage.getItem('devsftp_site_theme') || 'system';
      var r = t === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : t;
      document.documentElement.setAttribute('data-theme', r);
    })();
  </script>

  <?php
    $root_rel = (basename(dirname($_SERVER['SCRIPT_FILENAME'])) === 'site-build') ? '' : '../';
  ?>
  <link rel="stylesheet" href="<?= $root_rel ?>style.css?v=<?= time() ?>">
</head>
<body>

  <!-- ===================================================================
       HEADER
       =================================================================== -->
  <header id="site-header">
    <div class="header-inner">

      <!-- Logo + Wordmark -->
      <a href="<?= $root_rel ?: './' ?>" class="site-logo" aria-label="DevsFTP Home">
        <svg width="28" height="28" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Connection line -->
          <path d="M150 256H420" stroke="#68a063" stroke-width="22" stroke-linecap="round"/>
          <!-- Remote node dot -->
          <circle cx="450" cy="256" r="22" fill="#68a063"/>
          <!-- D shape -->
          <path d="M150 112 H238 C332 112 386 170 386 256 C386 342 332 400 238 400 H150"
            stroke="currentColor" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <!-- Chevron -->
          <path d="M156 178 L212 256 L156 334"
            stroke="currentColor" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <span class="wordmark">Devs<span>FTP</span></span>
      </a>

      <!-- Primary Nav -->
      <nav class="site-nav" aria-label="Primary">
        <?php $active = isset($active_page) ? $active_page : ''; ?>
        <a href="<?= $root_rel ?>#features" class="<?php echo ($active === 'features') ? 'active' : ''; ?>">Features</a>
        <a href="<?= $root_rel ?>docs.php" class="<?php echo ($active === 'docs') ? 'active' : ''; ?>">Docs</a>
        <a href="<?= $root_rel ?>privacy.php" class="<?php echo ($active === 'privacy') ? 'active' : ''; ?>">Privacy</a>
        <a href="<?= $root_rel ?>issue-tracker/" class="<?php echo ($active === 'issue-tracker') ? 'active' : ''; ?>">Issue Tracker</a>
      </nav>

      <!-- Right Controls -->
      <div class="header-controls">

        <!-- Theme Selector Dropdown -->
        <div class="theme-dropdown" id="theme-dropdown">
          <button id="btn-theme" class="btn-theme" aria-label="Select theme" aria-expanded="false" aria-haspopup="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </button>
          
          <div class="theme-dropdown-content" id="theme-dropdown-content">
            <button data-theme-value="light" class="theme-opt-btn" aria-label="Switch to light theme">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
              <span>Light</span>
            </button>
            <button data-theme-value="dark" class="theme-opt-btn" aria-label="Switch to dark theme">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <span>Dark</span>
            </button>
            <button data-theme-value="system" class="theme-opt-btn" aria-label="Switch to system theme">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              <span>System</span>
            </button>
          </div>
        </div>

        <!-- GitHub -->
        <a href="https://github.com/DevsFTP/DevsFTP" class="btn-github" target="_blank" rel="noopener noreferrer" aria-label="View source on GitHub">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483
              0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466
              -.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832
              .092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688
              -.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0
              0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028
              1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012
              2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
        </a>

      </div>
    </div>
  </header>

  <!-- ===================================================================
       MAIN CONTENT
       =================================================================== -->
  <main id="site-main">
