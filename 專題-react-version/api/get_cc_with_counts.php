<?php
// 開啟錯誤顯示，方便除錯（之後可移除）
error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../db.php';

$sql = "SELECT category, system_code, system_name, symptom_code, symptom_name, count FROM cc_with_counts";
$result = $conn->query($sql);

if (!$result) {
    http_response_code(500);
    echo json_encode([
        'error' => 'DB query failed',
        'detail' => $conn->error,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

echo json_encode($rows, JSON_UNESCAPED_UNICODE);
