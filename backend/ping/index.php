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

db()->prepare(
    "INSERT OR REPLACE INTO presence (user_id, last_ping) VALUES (:uid, datetime('now'))"
)->execute([':uid' => $uid]);

echo json_encode(['ok' => true]);
