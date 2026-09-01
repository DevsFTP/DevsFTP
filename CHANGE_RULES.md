# Change & Git Rules — DevsFTP

## 1. File and Code Scope Control
- Only modify files directly necessary to accomplish the requested task.
- If additional files must be changed due to a real dependency, understand and justify that relationship first.
- Do **NOT** modify nearby or unrelated files simply because they could be improved.

---

## 2. No Unrelated Refactoring
While working on a task, do **NOT** engage in opportunistic:
- Code cleanup or reformatting
- Subsystem modernization or rewriting
- Symbol or variable renaming across unrelated files
- Dependency replacement or version bumps
- Directory restructuring or file moving
- UI redesign or layout adjustment

Keep changes focused strictly on the assigned objective.

---

## 3. Explicit Approval Boundaries
Autonomous implementation is expected for ordinary bug fixes and feature steps inside established patterns. However, the following are **major decisions requiring explicit owner approval**:
- Replacing a major subsystem (FTP engine, SFTP transfer logic, S3 client, WebDAV adapter)
- Removing established features or user settings
- Changing the application's core architecture or IPC contract in `src/main/preload.js`
- Replacing major dependencies (`ssh2`, `basic-ftp`, `@aws-sdk/client-s3`, `webdav`, `electron`)
- Introducing major new architectural layers

---

## 4. Regression Governance
- A newly implemented feature that breaks existing functionality is a **regression**.
- Do **NOT** resolve a regression by weakening, removing, or rewriting existing working code.
- Always correct the new implementation to work harmoniously with existing behavior.

---

## 5. Git Governance & Remote Safety
Git is part of normal development workflow. Local development operations are permitted:
- Inspecting `git status`, `git log`, `git diff`
- Working on local branches and local commits when instructed

### MANDATORY GIT BOUNDARY:
```text
PUSH = OWNER ONLY
```
- **THE PROJECT OWNER IS THE ONLY PERSON AUTHORIZED TO PUSH TO REMOTES.**
- Do **NOT** push automatically under any circumstances.
- Do **NOT** force-push (`git push --force`).
- Do **NOT** delete remote branches or alter remote repository configuration.
- Stop and wait for explicit owner instructions before any push operation.
