<?php
$page_title = "DevsFTP — The FTP & SFTP Client for Windows";
$page_desc = "DevsFTP is a free, open-source FTP and SFTP client for Windows built for developers.";
$page_keywords = "sftp client, ftp client, windows sftp, open source ftp client, built-in ssh terminal, devsftp download";
$active_page = "home";
include 'header.php';
?>

<!-- Page Content -->
<section class="hero-section">
  <div class="hero-container">
    
    <!-- Left Column: Brand Info & Downloads -->
    <div class="hero-info">
      <h1 class="hero-brand">DevsFTP</h1>
      <p class="hero-tagline">
        works with you,<br>
        <span>not against you.</span>
      </p>
      
      <div class="hero-download-links">
        <a href="download/DevsFTP%20Setup%201.0.0.exe" class="download-link primary" title="Download Installer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Installer
        </a>
        <a href="download/DevsFTP%201.0.0.exe" class="download-link secondary" title="Download Standalone Portable executable">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Standalone
        </a>
      </div>
    </div>
    
    <!-- Right Column: Interactive Theme-Switched Screenshot -->
    <div class="hero-visual">
      <div class="screenshot-container">
        <img src="assets/screenshot_dark.webp" alt="DevsFTP Connected Workspace (Dark Theme)" class="app-screenshot screenshot-dark">
        <img src="assets/screenshot_light.webp" alt="DevsFTP Connected Workspace (Light Theme)" class="app-screenshot screenshot-light">
      </div>
    </div>

  </div>
</section>

<!-- Section: Key Features -->
<section class="features-section" id="features">
  <div class="features-container">
    <h2 class="section-title">Why developers choose DevsFTP</h2>
    
    <div class="compare-table-wrapper">
      <table class="compare-table">
        <thead>
          <tr>
            <th>Feature / Capability</th>
            <th class="highlight-col">DevsFTP</th>
            <th>FileZilla</th>
            <th>WinSCP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Supported Protocols</strong></td>
            <td class="highlight-col">FTP, FTPS, SFTP, WebDAV, S3</td>
            <td>FTP, FTPS, SFTP</td>
            <td>FTP, FTPS, SFTP, SCP, WebDAV, S3</td>
          </tr>
          <tr>
            <td><strong>Workspace Identity Accents</strong></td>
            <td class="highlight-col">✅ Dynamic Accents</td>
            <td>❌ No</td>
            <td>❌ No</td>
          </tr>
          <tr>
            <td><strong>Per-Tab Folder Path Memory</strong></td>
            <td class="highlight-col">✅ Saved Per Tab</td>
            <td>❌ No</td>
            <td>❌ No</td>
          </tr>
          <tr>
            <td><strong>Interactive SSH Terminal</strong></td>
            <td class="highlight-col">✅ Built-In</td>
            <td>❌ No</td>
            <td>⚠️ External (PuTTY)</td>
          </tr>
          <tr>
            <td><strong>SSH Tunneling & Port Forwarding</strong></td>
            <td class="highlight-col">✅ Local, Remote, SOCKS5</td>
            <td>❌ No</td>
            <td>✅ Local, SOCKS5</td>
          </tr>
          <tr>
            <td><strong>External Editor Watcher</strong></td>
            <td class="highlight-col">✅ Save-to-Upload</td>
            <td>⚠️ Focus-based</td>
            <td>⚠️ External watch</td>
          </tr>
          <tr>
            <td><strong>Task Scheduler & Sync Automation</strong></td>
            <td class="highlight-col">✅ Built-in Cron</td>
            <td>❌ No</td>
            <td>❌ External scripts</td>
          </tr>
          <tr>
            <td><strong>Local Credential Vault</strong></td>
            <td class="highlight-col">✅ AES-256-GCM</td>
            <td>⚠️ Optional</td>
            <td>⚠️ Optional</td>
          </tr>
          <tr>
            <td><strong>Persistent Workspace State</strong></td>
            <td class="highlight-col">✅ Tabs & Folders</td>
            <td>⚠️ Tabs Only</td>
            <td>⚠️ Partial</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- Screenshot Preview Modal -->
<div id="preview-modal" class="preview-modal" aria-hidden="true" role="dialog" aria-modal="true">
  <div class="preview-card">
    <div class="preview-header">
      <span class="preview-title">Screenshot Preview</span>
      <button id="btn-preview-close" class="preview-close-btn" title="Close Preview">
        ✕ Close
      </button>
    </div>
    <div class="preview-body">
      <img id="preview-img" src="" alt="DevsFTP Workspace Full View" class="preview-image">
    </div>
  </div>
</div>

<?php
include 'footer.php';
?>
