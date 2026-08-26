# Privacy & Data Handling Policy — DevsFTP

DevsFTP is built as a local-first application. We do not store, synchronize, or transmit your master passwords, server keys, or profile credentials to any cloud systems or external networks.

---

## 1. Local Vault Cryptography
All connection profiles are stored on your local disk. When you set a Master Password, the application implements the following security pipeline offline:
* **Key Derivation**: Derived locally using PBKDF2 with **800,000 iterations**.
* **Encryption Cipher**: Profile configurations and passwords are encrypted using **AES-256-GCM**.
* **Zero Cloud Trust**: There is no password recovery backend. If you lose your Master Password, your profiles cannot be decrypted or recovered.

## 2. Diagnostic Reports & Bug Submissions
DevsFTP does not upload crash reports or usage logs automatically. Diagnostic data is transmitted **only when you initiate an in-app bug submission**.

If you voluntarily submit a bug report from within the Diagnostic Console, the payload sent to our receiver endpoint (`bugs.php`) includes:
* **App Metrics**: The client version (e.g. `v1.0.0`) and target OS platform (`win32 x64`).
* **Diagnostic Logs**: The text content currently visible in your bottom Protocol Log drawer.
* **Anonymization**: Client IP addresses are resolved during the request to block malicious posts, but reports are stored without user profile identifiers.

## 3. Third-Party Connection Protocols
When connecting to remote servers (via SFTP, FTP, FTPS, WebDAV, or Amazon S3), DevsFTP communicates directly with the target server addresses you specify.
* **Direct Traffic**: No intermediary servers, proxies, or cloud gateways intercept your transfers. Traffic travels securely between your computer and the remote host.
* **Host Fingerprints**: SSH host keys (for SFTP and tunneling sessions) are saved locally inside `known_hosts.json`. If a signature changes, a mismatch warning is raised locally without contacting external authorities.

## 4. Zero Telemetry & Analytics
We believe that a developer's file transfer client is private. DevsFTP is completely free of usage analytics and background tracking:
* **No Google Analytics / Telemetry**: We do not track what features you click, how long you stay logged in, or what profiles you run.
* **No Update Pings**: The client does not download auto-update patches in the background without consent.
* **GPL Compliance**: DevsFTP is licensed under the GPL-3.0. You can inspect, compile, and run the source code yourself to verify its complete offline integrity.
