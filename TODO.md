# DevsFTP Project TODO & Roadmap

## 🛠️ Feature Roadmap Items

### 1. Adapter Test Suite Expansion (`tests/`)
- Add automated unit tests under `tests/` for FTP (`ftpAdapter`), WebDAV (`webdavAdapter`), and S3 (`s3Adapter`) protocol adapters.

---

## ✅ Completed Roadmap Items
- [x] **Transfer Queue Speed Limiter & Max Concurrency Controls (`throttleTransform.js`)** — Stream rate-limiter throttling, max concurrency queue loop, dual UI controls (Drawer & Preferences), and bi-directional sync.
- [x] **File Exclusion Rules (`exclusionService.js`)** — Custom glob pattern exclusions and `.gitignore` parsing.
- [x] **SSH Config Importer (`sshConfigParser.js`)** — Import host rules and SSH keys directly from `~/.ssh/config`.
