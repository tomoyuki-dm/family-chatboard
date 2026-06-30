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

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$toId  = (int)($input['to_user_id'] ?? 0);
$type  = (string)($input['type'] ?? '');

$allowedTypes = ['offer', 'answer', 'ice', 'hangup', 'reject', 'busy'];
if ($toId <= 0 || !in_array($type, $allowedTypes, true)) {
    http_response_code(400);
    exit(json_encode(['error' => '不正なシグナルです']));
}

$pdo = db();

$chk = $pdo->prepare('SELECT id FROM users WHERE id = :id AND banned_at IS NULL');
$chk->execute([':id' => $toId]);
if (!$chk->fetch()) {
    http_response_code(404);
    exit(json_encode(['error' => '宛先ユーザーが見つかりません']));
}

// 古いシグナルを掃除（5分以上前のものは不要）
$pdo->exec("DELETE FROM call_signals WHERE created_at < datetime('now', '-5 minutes')");

$payload = json_encode($input['payload'] ?? null);
$pdo->prepare(
    'INSERT INTO call_signals (from_user_id, to_user_id, type, payload) VALUES (:from, :to, :type, :payload)'
)->execute([':from' => $uid, ':to' => $toId, ':type' => $type, ':payload' => $payload]);

echo json_encode(['ok' => true]);
