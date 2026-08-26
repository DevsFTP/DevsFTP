# DevsFTP — Works with you, not against you.

DevsFTP is a secure, offline-first multi-protocol file transfer client and remote workspace designed for developers.

## Features
* **Multi-Protocol Support:** Connect and manage files securely via **FTP**, **FTPS (Explicit/Implicit)**, **SFTP**, and **Amazon S3**.
* **Local-First Cryptography:** All profile credentials, passwords, and SSH keys are stored and encrypted locally using **AES-256-GCM** with **PBKDF2-SHA256 (800,000 rounds)** vault protection. No master passwords or configurations ever leave your machine.
* **Modern Workspace:** A fast, responsive desktop client built on Electron, designed to make remote file management seamless and distraction-free.
* **GPG Signed Releases:** Official releases are signed with GPG keys for verified security and integrity.

## Setup & Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run dev
   ```

3. Build distributions:
   * Windows: `npm run build:win`
   * Linux: `npm run build:linux`

## License
DevsFTP is free and open-source software licensed under the **GNU General Public License v3.0**.
