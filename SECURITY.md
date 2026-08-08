<!-- DevsFTP — The SFTP & FTP Client for Windows -->
# Security Policy & Cryptographic Architecture

## Supported Versions

Security updates are actively provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## 🔒 Security Features & Cryptographic Architecture

DevsFTP incorporates robust security controls and cryptographic protections:

### 1. Master Password Vault (AES-256-GCM)
- **Encryption Standard**: All stored connection passwords, private keys, and passphrases are encrypted at rest using **AES-256-GCM (Galois/Counter Mode)** with 16-byte authentication tags.
- **Key Derivation**: Master Key derivation uses **PBKDF2** with 100,000 iterations and a unique 16-byte random salt per vault.
- **Master Lock Screen**: Startup unlock modal (`master-unlock-modal`) prevents unauthorized access to connection credentials.
- **Auto-Lock Idle Security**: Vault automatically locks credentials after a configurable inactivity timeout.

### 2. Strict SSH Host Key Fingerprint Verification
- **Known Hosts Integration**: Intersects with `~/.ssh/known_hosts` via `knownHostsStore.js`.
- **Fingerprint Algorithms**: Calculates and verifies **SHA256** and **MD5** public key fingerprints.
- **Security Warning Alerts**: Raises an interactive alert modal on new or changed server host keys, offering `Trust Always`, `Trust Once`, or `Reject`.
- **MITM Prevention**: Prevents Man-In-The-Middle attacks by rejecting unverified connection handshakes.

### 3. Encrypted Profile Export & Import
- **Encrypted Backups**: Allows exporting saved connection profiles (`profile:export`) and importing profiles (`profile:import`) via encrypted `.json` backup files.

### 4. Isolated Live-Edit Cache & Purge Daemon
- **Isolated Storage**: Live-edit temporary file caches are isolated strictly inside user AppData (`%AppData%\DevsFTP\devsftp_edit_cache`).
- **Garbage Collection Daemon**: Automated background daemon automatically purges stale temporary cache files.

---

## 🐛 Reporting a Vulnerability

If you discover a security vulnerability or cryptographic flaw within DevsFTP, please **do not open a public GitHub issue**.

Instead, please report security concerns directly to our security team:

- **Email**: [security@devsftp.com](mailto:security@devsftp.com)
- **Website**: [DevsFTP.com Security](https://devsftp.com)

Please include:
- A detailed summary of the vulnerability.
- Steps to reproduce or proof-of-concept code.
- Impact assessment.

We acknowledge receipt of security reports within **24 hours** and aim to release patches promptly.
