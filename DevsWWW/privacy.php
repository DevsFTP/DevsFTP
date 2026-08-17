<?php
/**
 * DevsFTP Privacy & Data Handling Policy
 * Copyright (C) 2026 DevsFTP.com
 */

// Global page configuration variables for header.php (100% SEO Compliance)
$page_title = "Privacy & Data Handling Policy — DevsFTP";
$page_desc = "Learn how DevsFTP keeps your credentials safe offline using local PBKDF2 vaults, and read about our voluntary diagnostic reporting data flows.";
$page_keywords = "devsftp privacy, data handling, local vault safety, offline first sftp, bug report diagnostics";
$page_canonical = "https://devsftp.com/privacy.php";
$og_image = "https://devsftp.com/assets/branding/og-image.png";
$active_page = "privacy";

include 'header.php';
?>

<!-- Documentation-style Section for Privacy -->
<section class="docs-section">
  <div class="docs-container">
    
    <!-- Sticky Navigation Sidebar -->
    <aside class="docs-sidebar">
      <nav class="docs-nav" aria-label="Privacy Categories">
        <div class="docs-nav-title">Privacy Policies</div>
        <ul class="docs-nav-list">
          <li><a href="#vault" class="docs-nav-link active">Local Vault Safety</a></li>
          <li><a href="#diagnostics" class="docs-nav-link">Diagnostic Reports</a></li>
          <li><a href="#protocols" class="docs-nav-link">Connection Protocols</a></li>
          <li><a href="#analytics" class="docs-nav-link">Zero Telemetry</a></li>
        </ul>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="docs-content">
      
      <!-- Section: Local Vault Safety -->
      <article id="vault" class="docs-article">
        <h1 class="docs-h1">Local Vault Cryptography</h1>
        <p class="docs-lead">DevsFTP is built as a local-first application. We do not store, synchronize, or transmit your master passwords, server keys, or profile credentials to any cloud systems or external networks.</p>
        
        <h3 style="font-size: 16px; margin: 24px 0 10px 0; color: var(--text-primary);">Vault Specifications</h3>
        <p class="docs-p">All connection profiles are stored on your local disk. When you set a Master Password, the application implements the following security pipeline offline:</p>
        <ul class="docs-ul">
          <li class="docs-li"><strong>Key Derivation</strong>: Derived locally using PBKDF2 with <strong>100,000 iterations</strong>.</li>
          <li class="docs-li"><strong>Encryption Cipher</strong>: Profile configurations and passwords are encrypted using **AES-256-GCM**.</li>
          <li class="docs-li"><strong>Zero Cloud Trust</strong>: There is no password recovery backend. If you lose your Master Password, your profiles cannot be decrypted or recovered.</li>
        </ul>
      </article>

      <!-- Section: Diagnostic Reports -->
      <article id="diagnostics" class="docs-article">
        <h2 class="docs-h2">Diagnostic Reports & Bug Submissions</h2>
        <p class="docs-p">DevsFTP does not upload crash reports or usage logs automatically. Diagnostic data is transmitted **only when you initiate an in-app bug submission**.</p>
        
        <h3 style="font-size: 15px; margin: 16px 0 8px 0; color: var(--text-primary);">What is shared on submission?</h3>
        <p class="docs-p">If you voluntarily submit a bug report from within the Diagnostic Console, the payload sent to our receiver endpoint (`bugs.php`) includes:</p>
        <ul class="docs-ul">
          <li class="docs-li"><strong>App Metrics</strong>: The client version (e.g. `v1.0.0`) and target OS platform (`win32 x64`).</li>
          <li class="docs-li"><strong>Diagnostic Logs</strong>: The text content currently visible in your bottom Protocol Log drawer. **Please review these logs before sending** to ensure you do not include sensitive host info.</li>
          <li class="docs-li"><strong>Anonymization</strong>: Client IP addresses are resolved during the request to block malicious posts, but reports are stored without user profile identifiers.</li>
        </ul>
      </article>

      <!-- Section: Connection Protocols -->
      <article id="protocols" class="docs-article">
        <h2 class="docs-h2">Third-Party Connection Protocols</h2>
        <p class="docs-p">When connecting to remote servers (via SFTP, FTP, FTPS, WebDAV, or Amazon S3), DevsFTP communicates directly with the target server addresses you specify.</p>
        
        <ul class="docs-ul">
          <li class="docs-li"><strong>Direct Traffic</strong>: No intermediary servers, proxies, or cloud gateways intercept your transfers. Traffic travels securely between your computer and the remote host.</li>
          <li class="docs-li"><strong>Host Fingerprints</strong>: SSH host keys (for SFTP and tunneling sessions) are saved locally inside `known_hosts.json`. If a signature changes, a mismatch warning is raised locally without contacting external authorities.</li>
        </ul>
      </article>

      <!-- Section: Zero Telemetry -->
      <article id="analytics" class="docs-article">
        <h2 class="docs-h2">Zero Telemetry & Analytics</h2>
        <p class="docs-p">We believe that a developer's file transfer client is private. DevsFTP is completely free of usage analytics and background tracking:</p>
        
        <ul class="docs-ul">
          <li class="docs-li"><strong>No Google Analytics / Telemetry</strong>: We do not track what features you click, how long you stay logged in, or what profiles you run.</li>
          <li class="docs-li"><strong>No Update Pings</strong>: The client does not download auto-update patches in the background without consent.</li>
          <li class="docs-li"><strong>GPL Compliance</strong>: DevsFTP is licensed under the GPL-3.0. You can inspect, compile, and run the source code yourself to verify its complete offline integrity.</li>
        </ul>
      </article>

    </main>

  </div>
</section>

<!-- Script to dynamically highlight active sidebar section on scroll -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  const sidebarLinks = document.querySelectorAll('.docs-nav-link');
  const articles = document.querySelectorAll('.docs-article');
  
  function updateActiveLink() {
    let currentId = '';
    articles.forEach(article => {
      const rect = article.getBoundingClientRect();
      if (rect.top <= 180) {
        currentId = article.getAttribute('id');
      }
    });

    if (currentId) {
      sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === '#' + currentId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
  }

  window.addEventListener('scroll', updateActiveLink);
  updateActiveLink();
});
</script>

<?php
include 'footer.php';
?>
