<?php
// cors.php は Content-Type: application/json を設定するため使わず、手動でCORSを設定
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

header('Access-Control-Allow-Origin: '    . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_auth(); // Authorization: Bearer ... または ?token= を受け付ける

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit('Method not allowed');
}

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) {
    http_response_code(400);
    exit('Bad request');
}

$stmt = db()->prepare(
    'SELECT orig_name, stored_name, mime_type, size FROM uploads WHERE id = :id'
);
$stmt->execute([':id' => $id]);
$upload = $stmt->fetch();

if (!$upload) {
    http_response_code(404);
    exit('Not found');
}

$path = UPLOAD_DIR . $upload['stored_name'];
if (!is_file($path)) {
    http_response_code(404);
    exit('File not found');
}

$fileSize = filesize($path);
$mimeType = $upload['mime_type'];
$origName = $upload['orig_name'];

header('Content-Type: ' . $mimeType);
header('Content-Disposition: inline; filename*=UTF-8\'\'' . rawurlencode($origName));
header('Accept-Ranges: bytes');
header('Cache-Control: private, max-age=86400');

$start = 0;
$end   = $fileSize - 1;

if (isset($_SERVER['HTTP_RANGE'])) {
    if (!preg_match('/bytes=(\d+)-(\d*)/', $_SERVER['HTTP_RANGE'], $m)) {
        http_response_code(416);
        header("Content-Range: bytes */$fileSize");
        exit;
    }
    $start = (int)$m[1];
    $end   = ($m[2] !== '') ? (int)$m[2] : $fileSize - 1;
    if ($start > $end || $end >= $fileSize) {
        http_response_code(416);
        header("Content-Range: bytes */$fileSize");
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$fileSize");
} else {
    http_response_code(200);
}

$length = $end - $start + 1;
header("Content-Length: $length");

$fp = fopen($path, 'rb');
fseek($fp, $start);
$remaining = $length;
while (!connection_aborted() && $remaining > 0) {
    $chunk = fread($fp, min(65536, $remaining));
    if ($chunk === false) break;
    echo $chunk;
    $remaining -= strlen($chunk);
    flush();
}
fclose($fp);
