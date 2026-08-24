# DevsFTP Roadmap

_Last updated: 2026-08-22_

---

## Planned Features



### Bookmark / Favorite Folders
Quick-access bookmarks for frequently visited remote directories.
- Bookmark current remote directory from toolbar or right-click context menu
- Bookmarks persist per connection profile
- Dropdown or sidebar list to jump to a bookmarked path instantly

### Transfer Bandwidth Throttling
Cap upload and download speed per transfer or globally.
- Optional speed limit input in Transfer Queue settings (KB/s or MB/s)
- Useful on shared hosting where saturating the connection affects live services
- Applies to both SFTP and FTP/WebDAV transfers

### Inline File Quick-Preview
Quickly inspect file contents (images, config files, source code) directly inside the app.
- Press Spacebar or select "Quick Preview" from the context menu to preview the selected file
- Supports image files (.png, .jpg, .gif, .svg, etc.) and text files (up to a configurable size threshold)
- Prevents the friction of having to download and open files in external editors for simple inspections

### ✅ Batch chmod (Multiple Files) — DONE
Select N remote files, right-click → Permissions, applies chmod to all at once.
Errors are collected per-file and reported; success continues regardless.

### ✅ Transfer Queue Drag-to-Reorder — DONE
Reorder queue transfers via HTML5 drag-and-drop. Dragged and clicked items receive visual shade indicators (`.selected-row`, `.dragging`, `.drag-over`) for distinct visual identification.

### ✅ Batch chmod UI Polish (Scrollable Target List) — DONE
Instead of comma-separated filenames on one line in the batch permissions modal, targets are now rendered in a dedicated, HTML-escaped, scrollable list panel. Each target has a checkbox, allowing selective inclusion/exclusion before committing the batch change.

### ✅ Batch / Multi-Rename — DONE
Rename multiple files at once. Supports prefix/suffix attachment (preserving extensions), global find-and-replace, and sequential numbering formats. Target selection lists feature scrollable structures and toggle checkboxes for selective processing.

### ✅ Redesigned Directory Compare Modal — DONE
Replaced the inline file-table colored highlights and bottom status bar with a self-contained, split-pane Directory Comparison modal. Vertically aligns corresponding local/remote files, inserts empty placeholders for missing files, adds individual upload/download sync actions (`➔` and `🠔`), select checkboxes for batch syncing, and filter controls.

---

## Notes
- Standalone SSH Client is a separate sub-project and is NOT tracked here.
- Built-in text editor will NEVER be added.
