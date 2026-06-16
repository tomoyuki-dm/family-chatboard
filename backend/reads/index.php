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

$body       = json_decode(file_get_contents('php://input'), true);
$message_id = (int)($body['message_id'] ?? 0);

if (!$message_id) {
    http_response_code(400);
    exit(json_encode(['error' => 'message_id が必要です']));
}

db()->prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (:mid, :uid)')
    ->execute([':mid' => $message_id, ':uid' => $uid]);

// 送信者を除く既読数を返す
$stmt = db()->prepare('
    SELECT COUNT(*) AS cnt,
           GROUP_CONCAT(r.user_id) AS read_by
    FROM message_reads r
    JOIN messages m ON m.id = r.message_id
    WHERE r.message_id = :mid AND r.user_id != m.user_id
');
$stmt->execute([':mid' => $message_id]);
$row = $stmt->fetch();

echo json_encode([
    'message_id' => $message_id,
    'read_count' => (int)$row['cnt'],
    'read_by'    => $row['read_by']
        ? array_map('intval', explode(',', $row['read_by']))
        : [],
]);
