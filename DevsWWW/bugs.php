<?php
/**
 * DevsFTP Bug Report & Diagnostic Receiver
 * Endpoint: https://devsftp.com/bugs.php
 * Copyright (C) 2026 DevsFTP.com
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit(0);
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON payload']);
    exit(0);
}

$bugsDir = __DIR__ . '/bugs';
if (!is_dir($bugsDir)) {
    mkdir($bugsDir, 0755, true);
}

$reportId = 'bug_' . time() . '_' . substr(md5(uniqid()), 0, 6);

$report = [
    'id' => $reportId,
    'timestamp' => date('Y-m-d H:i:s T'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
    'appVersion' => filter_var($data['version'] ?? '1.0.0', FILTER_SANITIZE_SPECIAL_CHARS),
    'platform' => filter_var($data['platform'] ?? 'win32', FILTER_SANITIZE_SPECIAL_CHARS),
    'userEmail' => filter_var($data['userEmail'] ?? 'Anonymous', FILTER_SANITIZE_EMAIL),
    'description' => filter_var($data['description'] ?? 'No description provided', FILTER_SANITIZE_SPECIAL_CHARS),
    'logs' => $data['logs'] ?? 'No logs provided',
    'status' => 'incomplete',
    'completed' => false
];

$filePath = $bugsDir . '/' . $reportId . '.json';
$saved = file_put_contents($filePath, json_encode($report, JSON_PRETTY_PRINT));

if ($saved !== false) {
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => 'Bug report received and logged successfully',
        'reportId' => $reportId
    ]);
} else {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to store report on server']);
}
