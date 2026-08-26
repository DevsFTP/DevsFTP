# Contributing to DevsFTP

First off, thank you for considering contributing to **DevsFTP**! Open-source contributions from developers like you help make DevsFTP better for everyone.

Website: [DevsFTP.com](https://devsftp.com)

---

## 📜 Code of Conduct

Please be respectful and constructive in all discussions, issues, and code reviews.

---

## 🛠️ How to Contribute

### 1. Reporting Bugs
- Check existing [GitHub Issues](https://github.com/DevsFTP/devsftp/issues) to ensure the bug hasn't already been reported.
- Open a new bug report using the **Bug Report Template**.
- Include your OS version, steps to reproduce, expected vs actual behavior, and relevant logs from `devsftp-debug.log`.

### 2. Suggesting Features
- Open a feature request using the **Feature Request Template**.
- Clearly explain the problem the feature solves and how you envision it working within DevsFTP.

### 3. Submitting Pull Requests (PRs)
1. Fork the repository and create your feature branch from `master`:
   ```bash
   git checkout -b feature/my-amazing-feature
   ```
2. Run automated tests and build verification:
   ```bash
   npm test
   npm run build:win
   ```
3. Ensure all new JavaScript source files include the standard **GNU GPL-3.0 header notice**:
   ```javascript
   /**
    * DevsFTP — Works with you, not against you.
    * Copyright (C) 2026 DevsFTP.com
    *
    * This program is free software: you can redistribute it and/or modify
    * it under the terms of the GNU General Public License as published by
    * the Free Software Foundation, version 3 of the License.
    */
   ```
4. Commit your changes with descriptive commit messages and submit a Pull Request targeting `master`.

---

## 📄 License Notice

By contributing to DevsFTP, you agree that your contributions will be licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
