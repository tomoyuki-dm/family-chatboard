<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

$claims = require_auth();
$uid    = (int)$claims['sub'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['file']['error'] ?? -1;
    $msg = match($errCode) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'ファイルサイズが上限を超えています',
        UPLOAD_ERR_NO_FILE                         => 'ファイルが選択されていません',
        default                                    => 'アップロードエラー (code: ' . $errCode . ')',
    };
    http_response_code(400);
    exit(json_encode(['error' => $msg]));
}

$file = $_FILES['file'];

if ($file['size'] > MAX_UPLOAD_BYTES) {
    http_response_code(413);
    exit(json_encode(['error' => 'ファイルサイズが上限（100MB）を超えています']));
}

// ブラウザ申告値ではなく実際のファイル内容からMIME判定
$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);

const ALLOWED_MIME = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg',
    'application/pdf',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
];

if (!in_array($mimeType, ALLOWED_MIME, true)) {
    http_response_code(415);
    exit(json_encode(['error' => '対応していないファイル形式です（' . $mimeType . '）']));
}

if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0750, true);
}

$origName   = mb_substr(basename($file['name']), 0, 255);
$ext        = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
$ext        = preg_replace('/[^a-z0-9]/', '', $ext);
$storedName = bin2hex(random_bytes(16)) . ($ext ? ".$ext" : '');
$destPath   = UPLOAD_DIR . $storedName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    exit(json_encode(['error' => 'ファイル保存に失敗しました']));
}

$pdo  = db();
$stmt = $pdo->prepare(
    'INSERT INTO uploads (user_id, orig_name, stored_name, mime_type, size)
     VALUES (:uid, :orig, :stored, :mime, :size)'
);
$stmt->execute([
    ':uid'    => $uid,
    ':orig'   => $origName,
    ':stored' => $storedName,
    ':mime'   => $mimeType,
    ':size'   => $file['size'],
]);

echo json_encode([
    'id'        => (int)$pdo->lastInsertId(),
    'orig_name' => $origName,
    'mime_type' => $mimeType,
    'size'      => $file['size'],
]);
