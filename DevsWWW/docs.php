<?php
/**
 * DevsFTP Documentation & User Guide
 * Copyright (C) 2026 DevsFTP.com
 */

// Global page configuration variables for header.php (100% SEO Compliance)
$page_title = "DevsFTP Documentation — User Guide & Setup Manual";
$page_desc = "Learn how to configure connection profiles, manage secure local key storage, use the integrated terminal, and schedule background sync tasks in DevsFTP.";
$page_keywords = "devsftp docs, sftp guide, profiles settings, ssh port forwarding, local credential vault, file watcher edit, cron sync scheduler, devsftp hotkeys";
$page_canonical = "https://devsftp.com/docs.php";
$og_image = "https://devsftp.com/assets/branding/og-image.png";
$active_page = "docs";

include 'header.php';
?>

<!-- Documentation Section -->
<section class="docs-section">
  <div class="docs-container">
    
    <!-- Sticky Navigation Sidebar -->
    <aside class="docs-sidebar">
      <nav class="docs-nav" aria-label="Documentation Categories">
        <div class="docs-nav-title">Environment & Setup</div>
        <ul class="docs-nav-list" style="margin-bottom: 24px;">
          <li><a href="#intro" class="docs-nav-link active">Environment Paths</a></li>
          <li><a href="#profiles" class="docs-nav-link">Profiles Settings</a></li>
          <li><a href="#security" class="docs-nav-link">Vault Security</a></li>
        </ul>
        
        <div class="docs-nav-title">Features Guide</div>
        <ul class="docs-nav-list" style="margin-bottom: 24px;">
          <li><a href="#editor" class="docs-nav-link">Editor Integration</a></li>
          <li><a href="#terminal" class="docs-nav-link">Integrated Terminal</a></li>
          <li><a href="#tunneling" class="docs-nav-link">SSH Tunneling</a></li>
          <li><a href="#compare" class="docs-nav-link">Directory Compare</a></li>
          <li><a href="#scheduler" class="docs-nav-link">Sync Automation</a></li>
        </ul>

        <div class="docs-nav-title">System Reference</div>
        <ul class="docs-nav-list">
          <li><a href="#shortcuts" class="docs-nav-link">Keyboard Shortcuts</a></li>
          <li><a href="#troubleshooting" class="docs-nav-link">Troubleshooting & FAQs</a></li>
        </ul>
      </nav>
    </aside>

    <!-- Main Documentation Content -->
    <main class="docs-content">
      
      <!-- Section: Environment Paths -->
      <article id="intro" class="docs-article">
        <h1 class="docs-h1">Environment & System Paths</h1>
        <p class="docs-lead">DevsFTP is a local-first desktop application. All profile configurations, SSH key associations, temporary edits, and sync rules are securely maintained inside your system's local storage paths.</p>
        
        <h3 style="font-size: 16px; margin: 24px 0 10px 0; color: var(--text-primary);">Application Storage Folders</h3>
        <p class="docs-p">By default, client configurations and credentials are saved in the following local directory paths according to how you run the app:</p>
        <ul class="docs-ul">
          <li class="docs-li"><strong>Standard Installer Mode (AppData)</strong>: 
            <br><code class="docs-code-inline">C:\Users\&lt;username&gt;\AppData\Roaming\DevsFTP\</code>
          </li>
          <li class="docs-li"><strong>Portable Standalone Mode</strong>: 
            <br><code class="docs-code-inline">.\.devs_userData\</code> (created inside the directory where the executable runs)
          </li>
        </ul>
      </article>

      <!-- Section: Profiles Schema -->
      <article id="profiles" class="docs-article">
        <h2 class="docs-h2">Connection Profile Settings</h2>
        <p class="docs-p">Connections are saved locally inside the <code class="docs-code-inline">profiles.json</code> configuration file. Each profile utilizes the following settings:</p>
        
        <div class="docs-screenshot-wrapper">
          <img src="assets/docs_connection_dialog_dark.webp" class="app-screenshot screenshot-dark" alt="Connection Profile Dialog (Dark Theme)">
          <img src="assets/docs_connection_dialog_light.webp" class="app-screenshot screenshot-light" alt="Connection Profile Dialog (Light Theme)">
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 20px;">
          <div>
            <strong style="color: var(--accent);">Profile Name</strong>
            <p class="docs-p" style="margin: 4px 0 0 0; padding-left: 12px;">The friendly label displayed inside the client connection dialog.</p>
          </div>
          <div>
            <strong style="color: var(--accent);">Protocol</strong>
            <p class="docs-p" style="margin: 4px 0 0 0; padding-left: 12px;">The protocol type used to connect to your server. Supported options: <code class="docs-code-inline">SFTP</code>, <code class="docs-code-inline">FTP</code>, <code class="docs-code-inline">FTPS (Explicit)</code>, <code class="docs-code-inline">FTPS (Implicit)</code>, <code class="docs-code-inline">WebDAV</code>, and <code class="docs-code-inline">S3</code>.</p>
          </div>
          <div>
            <strong style="color: var(--accent);">Host & Port</strong>
            <p class="docs-p" style="margin: 4px 0 0 0; padding-left: 12px;">The server's IP address or domain name. Ports default to <code class="docs-code-inline">22</code> (SFTP), <code class="docs-code-inline">21</code> (FTP/FTPS), or <code class="docs-code-inline">443</code> (S3/WebDAV SSL).</p>
          </div>
          <div>
            <strong style="color: var(--accent);">Workspace Accent Color</strong>
            <p class="docs-p" style="margin: 4px 0 0 0; padding-left: 12px;">A custom color linked to the profile. When a tab connects, the client dynamically matches primary highlights and indicators to this accent color (e.g. Red for Production, Green for Staging) to prevent deployment errors.</p>
          </div>
          <div>
            <strong style="color: var(--accent);">Workspace Directories</strong>
            <p class="docs-p" style="margin: 4px 0 0 0; padding-left: 12px;">Persistent local and remote paths that automatically restore your active folder paths whenever you reconnect or switch tabs.</p>
          </div>
          <div>
            <strong style="color: var(--accent);">SSH Keys & Passphrases</strong>
            <p class="docs-p" style="margin: 4px 0 0 0; padding-left: 12px;">Allows authentication via private key files (<code class="docs-code-inline">.pem</code>, <code class="docs-code-inline">.ppk</code>, or <code class="docs-code-inline">.id_rsa</code> formats) with optional key passphrases.</p>
          </div>
        </div>
      </article>

      <!-- Section: Vault Cryptography -->
      <article id="security" class="docs-article">
        <h2 class="docs-h2">Local Vault Security</h2>
        <p class="docs-p">DevsFTP protects saved passwords, server credentials, and SSH keys offline using industry-standard cryptography. No information is transmitted to cloud networks or external telemetry endpoints.</p>
        
        <h3 style="font-size: 15px; margin: 16px 0 8px 0; color: var(--text-primary);">How Security Works</h3>
        <ul class="docs-ul">
          <li class="docs-li"><strong>Master Vault Encryption</strong>: When you enable a Master Password, encryption keys are derived locally using PBKDF2 with **100,000 iterations**. Profiles (<code class="docs-code-inline">profiles.json</code>) and host key fingerprints (<code class="docs-code-inline">known_hosts.json</code>) are encrypted using AES-256-GCM.</li>
          <li class="docs-li"><strong>Default Mode</strong>: If a master password is not configured, a unique 32-byte key is automatically generated and saved locally inside the restricted <code class="docs-code-inline">.master_key</code> file to keep data encrypted.</li>
        </ul>
      </article>

      <!-- Section: Editor Watcher Cache -->
      <article id="editor" class="docs-article">
        <h2 class="docs-h2">External Editor Integration</h2>
        <p class="docs-p">You can edit remote files using your local text editor via the following automated flow:</p>
        
        <div class="docs-screenshot-wrapper">
          <img src="assets/docs_main_workspace_dark.webp" class="app-screenshot screenshot-dark" alt="Main Workspace connection tab (Dark Theme)">
          <img src="assets/docs_main_workspace_light.webp" class="app-screenshot screenshot-light" alt="Main Workspace connection tab (Light Theme)">
        </div>

        <ul class="docs-ul">
          <li class="docs-li"><strong>Opening Files</strong>: Double-clicking any file downloads it to a secure, temporary local cache folder under your user profile: 
            <br><code class="docs-code-inline">AppData\Roaming\DevsFTP\edit_cache\...</code>
          </li>
          <li class="docs-li"><strong>Editing</strong>: The client opens the file using your system's default text editor (such as VS Code, Notepad++, or Sublime Text).</li>
          <li class="docs-li"><strong>Auto-Upload Prompt</strong>: DevsFTP monitors the temporary cache file for changes. When you press **Save** in your editor, the client detects the modification and raises an in-app confirmation dialog inside the connection workspace tab to upload the updates back to the remote server.</li>
        </ul>
      </article>

      <!-- Section: SSH Terminal -->
      <article id="terminal" class="docs-article">
        <h2 class="docs-h2">Integrated SSH Terminal</h2>
        <p class="docs-p">DevsFTP opens a secure, interactive shell session directly inside your active connection workspace:</p>
        
        <div class="docs-screenshot-wrapper">
          <img src="assets/docs_ssh_terminal_dark.webp" class="app-screenshot screenshot-dark" alt="Embedded SSH Terminal (Dark Theme)">
          <img src="assets/docs_ssh_terminal_light.webp" class="app-screenshot screenshot-light" alt="Embedded SSH Terminal (Light Theme)">
        </div>

        <ul class="docs-ul">
          <li class="docs-li"><strong>Instant Launch</strong>: Clicking the **Terminal** icon in your active session tab header opens a console panel directly in the workspace.</li>
          <li class="docs-li"><strong>Automatic Authentication</strong>: The terminal reuses credentials from your active connection profile. It automatically logs you in without requiring you to re-enter passwords or private keys.</li>
          <li class="docs-li"><strong>Visual Integration</strong>: The terminal cursor matches the active connection's custom accent color.</li>
        </ul>
      </article>

      <!-- Section: SSH Tunneling -->
      <article id="tunneling" class="docs-article">
        <h2 class="docs-h2">SSH Tunneling & Port Forwarding</h2>
        <p class="docs-p">Tunneling configurations are saved inside <code class="docs-code-inline">tunnels.json</code>. Rules allow you to forward network ports securely through your active SSH connection:</p>
        
        <div class="docs-screenshot-wrapper">
          <img src="assets/docs_ssh_tunnels_dark.webp" class="app-screenshot screenshot-dark" alt="SSH Tunneling Rules (Dark Theme)">
          <img src="assets/docs_ssh_tunnels_light.webp" class="app-screenshot screenshot-light" alt="SSH Tunneling Rules (Light Theme)">
        </div>

        <table class="docs-table">
          <thead>
            <tr>
              <th>Tunnel Type</th>
              <th>Properties</th>
              <th>How it Works</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Local Forwarding</strong></td>
              <td><code class="docs-code-inline">Local Port</code> &rarr; <code class="docs-code-inline">Target Host:Port</code></td>
              <td>Forwards a local port through the SSH client to access a database or service hidden in the remote network.</td>
            </tr>
            <tr>
              <td><strong>Remote Forwarding</strong></td>
              <td><code class="docs-code-inline">Remote Port</code> &rarr; <code class="docs-code-inline">Local Host:Port</code></td>
              <td>Forwards a port on the remote server back to a local development service running on your machine.</td>
            </tr>
            <tr>
              <td><strong>Dynamic SOCKS5</strong></td>
              <td><code class="docs-code-inline">Local Port</code></td>
              <td>Turns your local port into a SOCKS5 proxy server, routing browser or app traffic through the remote connection.</td>
            </tr>
          </tbody>
        </table>
      </article>

      <!-- Section: Directory Comparison -->
      <article id="compare" class="docs-article">
        <h2 class="docs-h2">Directory Compare Color Badges</h2>
        <p class="docs-p">The side-by-side comparison engine matches local and remote directories using size and timestamp evaluations. The status tags are visual-coded as follows:</p>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="background-color: rgba(16, 185, 129, 0.15); color: #34D399; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-family: monospace;">Local Only / Local Newer</span>
            <span style="color: var(--text-secondary); font-size: 13.5px;">Green indicates files present only in the local directory or updated locally.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="background-color: rgba(14, 165, 233, 0.15); color: #38BDF8; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-family: monospace;">Remote Only / Remote Newer</span>
            <span style="color: var(--text-secondary); font-size: 13.5px;">Blue indicates files present only in the remote directory or updated remotely.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="background-color: rgba(16, 185, 129, 0.15); color: #FBBF24; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-family: monospace;">Size Mismatch</span>
            <span style="color: var(--text-secondary); font-size: 13.5px;">Yellow indicates files matching names but possessing different file sizes.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="background-color: rgba(100, 116, 139, 0.15); color: #94A3B8; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-family: monospace;">Identical</span>
            <span style="color: var(--text-secondary); font-size: 13.5px;">Gray indicates identical file sizes and modified dates on both sides.</span>
          </div>
        </div>
      </article>

      <!-- Section: Cron Sync Jobs -->
      <article id="scheduler" class="docs-article">
        <h2 class="docs-h2">Sync Automation (Cron Jobs)</h2>
        <p class="docs-p">Scheduled tasks are saved inside <code class="docs-code-inline">scheduled_jobs.json</code>. DevsFTP schedules background transfer jobs using standard 5-field cron syntax:</p>
        
        <div class="docs-screenshot-wrapper">
          <img src="assets/docs_sync_scheduler_dark.webp" class="app-screenshot screenshot-dark" alt="Sync Automation dialog (Dark Theme)">
          <img src="assets/docs_sync_scheduler_light.webp" class="app-screenshot screenshot-light" alt="Sync Automation dialog (Light Theme)">
        </div>

        <div class="docs-code-block">
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of the Week (0 - 6, Sunday is 0)
│ │ │ └─── Month (1 - 12)
│ │ └───── Day of the Month (1 - 31)
│ └─────── Hour (0 - 23)
└───────── Minute (0 - 59)
        </div>
        <p class="docs-p">Sync tasks support automated uploads, downloads, or full directory sync matches executed in the background.</p>
      </article>

      <!-- Section: Keyboard Shortcuts -->
      <article id="shortcuts" class="docs-article">
        <h2 class="docs-h2">Keyboard Shortcuts</h2>
        <p class="docs-p">The following keyboard hotkeys are registered inside the application's global listeners:</p>
        
        <table class="docs-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Clear Local Edit Cache</td>
              <td><kbd class="docs-kbd">Ctrl</kbd> + <kbd class="docs-kbd">Shift</kbd> + <kbd class="docs-kbd">Del</kbd></td>
            </tr>
            <tr>
              <td>Export Connection Profiles</td>
              <td><kbd class="docs-kbd">Ctrl</kbd> + <kbd class="docs-kbd">Shift</kbd> + <kbd class="docs-kbd">E</kbd></td>
            </tr>
            <tr>
              <td>Import Connection Profiles</td>
              <td><kbd class="docs-kbd">Ctrl</kbd> + <kbd class="docs-kbd">Shift</kbd> + <kbd class="docs-kbd">I</kbd></td>
            </tr>
            <tr>
              <td>Select All Files in Pane</td>
              <td><kbd class="docs-kbd">Ctrl</kbd> + <kbd class="docs-kbd">A</kbd></td>
            </tr>
            <tr>
              <td>Navigate File Tree</td>
              <td><kbd class="docs-kbd">&uarr;</kbd> / <kbd class="docs-kbd">&darr;</kbd> Arrow</td>
            </tr>
            <tr>
              <td>Select Range of Files</td>
              <td><kbd class="docs-kbd">Shift</kbd> + <kbd class="docs-kbd">&uarr;</kbd> / <kbd class="docs-kbd">&darr;</kbd> Arrow</td>
            </tr>
            <tr>
              <td>Open Folder / Trigger File Edit</td>
              <td><kbd class="docs-kbd">Enter</kbd></td>
            </tr>
            <tr>
              <td>Cancel / Close Dialog Modal</td>
              <td><kbd class="docs-kbd">Esc</kbd></td>
            </tr>
          </tbody>
        </table>
      </article>

      <!-- Section: Troubleshooting -->
      <article id="troubleshooting" class="docs-article">
        <h2 class="docs-h2">Troubleshooting & FAQs</h2>
        
        <p class="docs-p" style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">Q: Where can I review connection logs or copy error traces?</p>
        <p class="docs-p">A: DevsFTP streams real-time connection logs directly to the **Protocol Log Console Drawer** located at the bottom of the active workspace window. You can view these logs, copy the contents to your clipboard using the **Copy Logs** button, or clear the display using the **Clear Logs** button.</p>
        
        <p class="docs-p" style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px; margin-top: 20px;">Q: How do I clear or reset stored SSH host key mismatch warnings?</p>
        <p class="docs-p">A: Trusted SSH fingerprint signatures are encrypted inside `known_hosts.json` inside your userData folder (<code class="docs-code-inline">C:\Users\&lt;username&gt;\AppData\Roaming\DevsFTP\known_hosts.json</code>). To reset, close the application and safely delete this file. Re-establishing the connection will trigger a fresh host trust confirmation dialog.</p>

        <p class="docs-p" style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px; margin-top: 20px;">Q: How do I recover lost vault credentials?</p>
        <p class="docs-p">A: Master Password vaults are locally decrypted and operate entirely offline. For security reasons, if you lose your Master Password, there is no recovery mechanism. You must delete the <code class="docs-code-inline">master_config.json</code> and <code class="docs-code-inline">profiles.json</code> files inside your AppData directory to reset the client configuration.</p>
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
