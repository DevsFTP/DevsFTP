<?php
/**
 * DevsFTP Bug Reports Directory Dashboard & Admin Reader
 * Endpoint: https://devsftp.com/bugs/
 * Copyright (C) 2026 DevsFTP.com
 */

$bugsDir = __DIR__;

// Handle Toggle Completion Status Action
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'toggle_status') {
    $reportId = basename($_POST['report_id'] ?? '');
    $targetFile = $bugsDir . '/' . $reportId . '.json';
    if (file_exists($targetFile)) {
        $json = file_get_contents($targetFile);
        $reportData = json_decode($json, true);
        if ($reportData) {
            $isComplete = !empty($reportData['completed']) || ($reportData['status'] ?? '') === 'complete';
            $reportData['completed'] = !$isComplete;
            $reportData['status'] = !$isComplete ? 'complete' : 'incomplete';
            file_put_contents($targetFile, json_encode($reportData, JSON_PRETTY_PRINT));
        }
    }
    header('Location: ' . $_SERVER['PHP_SELF'] . (!empty($_GET['filter']) ? '?filter=' . urlencode($_GET['filter']) : ''));
    exit(0);
}

$reports = [];
$openCount = 0;
$completedCount = 0;

if (is_dir($bugsDir)) {
    $files = glob($bugsDir . '/*.json');
    rsort($files);
    foreach ($files as $file) {
        $json = file_get_contents($file);
        $data = json_decode($json, true);
        if ($data) {
            if (empty($data['id'])) {
                $data['id'] = basename($file, '.json');
            }
            $isDone = !empty($data['completed']) || ($data['status'] ?? '') === 'complete';
            $data['status'] = $isDone ? 'complete' : 'incomplete';
            $data['completed'] = $isDone;

            if ($isDone) {
                $completedCount++;
            } else {
                $openCount++;
            }
            $reports[] = $data;
        }
    }
}

$filter = $_GET['filter'] ?? 'all';
$filteredReports = array_filter($reports, function($r) use ($filter) {
    if ($filter === 'open') return !$r['completed'];
    if ($filter === 'completed') return $r['completed'];
    return true;
});
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevsFTP — Bug Reports Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0B0F19;
      --card-bg: #151D2A;
      --border: #27354A;
      --accent: #10B981;
      --warning: #F59E0B;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 32px 20px;
      line-height: 1.5;
    }
    .container { max-width: 1040px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo {
      width: 40px; height: 40px;
      background: rgba(16, 185, 129, 0.15);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: var(--accent); font-weight: 700; font-size: 20px;
    }
    h1 { font-size: 20px; font-weight: 700; }
    .filters {
      display: flex; gap: 10px; margin-bottom: 24px;
    }
    .filter-btn {
      padding: 8px 16px; border-radius: 6px;
      font-size: 13px; font-weight: 600;
      color: var(--text-muted); background: var(--card-bg);
      border: 1px solid var(--border);
      text-decoration: none; transition: all 0.15s ease;
    }
    .filter-btn:hover { border-color: var(--accent); color: var(--text); }
    .filter-btn.active {
      background: rgba(16, 185, 129, 0.15);
      color: #34D399; border-color: var(--accent);
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 16px;
      transition: all 0.2s ease;
    }
    .card.completed {
      opacity: 0.75;
      border-color: rgba(16, 185, 129, 0.3);
    }
    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }
    .report-id { font-family: monospace; font-size: 13px; color: #38BDF8; font-weight: 600; }
    .status-badge {
      padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .badge-open { background: rgba(245, 158, 11, 0.2); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge-completed { background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.4); }
    
    .report-desc { font-size: 14px; margin-bottom: 12px; color: #E2E8F0; white-space: pre-wrap; line-height: 1.6; }
    .meta-row { font-size: 12px; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 14px; }
    
    .card-actions {
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;
    }
    .btn-toggle {
      background: var(--bg); border: 1px solid var(--border);
      color: var(--text); padding: 6px 14px; border-radius: 6px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-toggle:hover { border-color: var(--accent); color: var(--accent); }
    
    details {
      background: #070A10;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 14px;
      margin-top: 10px;
    }
    summary { font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-muted); }
    pre {
      font-family: 'Consolas', monospace;
      font-size: 11px;
      color: #A7F3D0;
      overflow-x: auto;
      margin-top: 10px;
      max-height: 280px;
      overflow-y: auto;
    }
    .empty { text-align: center; color: var(--text-muted); padding: 48px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-logo">🐛</div>
        <div>
          <h1>DevsFTP — Bug Reports Dashboard</h1>
          <p style="font-size: 12px; color: var(--text-muted);">Live Server Archive for devsftp.com/bugs/</p>
        </div>
      </div>
      <div style="font-size: 12px; color: var(--text-muted);">
        Total Logged: <strong><?= count($reports) ?></strong>
      </div>
    </header>

    <div class="filters">
      <a href="?filter=all" class="filter-btn <?= $filter === 'all' ? 'active' : '' ?>">All Reports (<?= count($reports) ?>)</a>
      <a href="?filter=open" class="filter-btn <?= $filter === 'open' ? 'active' : '' ?>">🟠 Open / Incomplete (<?= $openCount ?>)</a>
      <a href="?filter=completed" class="filter-btn <?= $filter === 'completed' ? 'active' : '' ?>">✅ Completed / Fixed (<?= $completedCount ?>)</a>
    </div>

    <?php if (empty($filteredReports)): ?>
      <div class="card empty">
        <h3>No bug reports found</h3>
        <p style="font-size: 13px; margin-top: 6px;">Reports submitted via the DevsFTP app will appear directly in this list.</p>
      </div>
    <?php else: ?>
      <?php foreach ($filteredReports as $r): ?>
        <div class="card <?= $r['completed'] ? 'completed' : '' ?>">
          <div class="card-header">
            <div>
              <span class="report-id"><?= htmlspecialchars($r['id']) ?></span>
              <span style="font-size: 12px; color: var(--text-muted); margin-left: 10px;"><?= htmlspecialchars($r['timestamp']) ?></span>
            </div>
            <span class="status-badge <?= $r['completed'] ? 'badge-completed' : 'badge-open' ?>">
              <?= $r['completed'] ? '✅ Completed' : '🟠 Incomplete' ?>
            </span>
          </div>

          <div class="report-desc"><?= htmlspecialchars($r['description']) ?></div>

          <div class="meta-row">
            <span><strong>App Version:</strong> v<?= htmlspecialchars($r['appVersion'] ?? '1.0.0') ?></span>
            <span><strong>Platform:</strong> <?= htmlspecialchars($r['platform'] ?? 'win32') ?></span>
            <span><strong>User Email:</strong> <?= htmlspecialchars($r['userEmail'] ?? 'Anonymous') ?></span>
            <span><strong>IP:</strong> <?= htmlspecialchars($r['ip'] ?? '127.0.0.1') ?></span>
          </div>

          <details>
            <summary>📋 View Diagnostic Log Trace</summary>
            <pre><?= htmlspecialchars($r['logs'] ?? 'No logs attached') ?></pre>
          </details>

          <div class="card-actions">
            <form method="POST" style="margin: 0;">
              <input type="hidden" name="action" value="toggle_status">
              <input type="hidden" name="report_id" value="<?= htmlspecialchars($r['id']) ?>">
              <button type="submit" class="btn-toggle">
                <?= $r['completed'] ? '↺ Mark as Incomplete' : '✓ Mark as Complete' ?>
              </button>
            </form>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
</body>
</html>
