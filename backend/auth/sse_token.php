<?php
/**
 * SSE専用の短命トークンを発行する。
 * 長期JWTをSSEのURLに直接使うとサーバログに記録されるため、
 * 90秒間有効な使い捨てトークンに切り替える。
 */
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$claims = require_auth();
$uid    = (int)$claims['sub'];

// 期限切れトークンを掃除
db()->query("DELETE FROM sse_tokens WHERE expires_at < datetime('now')");

// 新しい短命トークンを発行
$token     = bin2hex(random_bytes(32)); // 64文字の乱数
$expiresAt = date('Y-m-d H:i:s', time() + SSE_TOKEN_TTL);

db()->prepare('INSERT INTO sse_tokens (token, user_id, expires_at) VALUES (:t, :uid, :exp)')
    ->execute([':t' => $token, ':uid' => $uid, ':exp' => $expiresAt]);

echo json_encode(['sse_token' => $token]);
