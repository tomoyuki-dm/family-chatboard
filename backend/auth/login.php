<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// --- レート制限チェック ---
$since = date('Y-m-d H:i:s', time() - LOGIN_LOCKOUT_SEC);
$stmt = db()->prepare('
    SELECT COUNT(*) FROM login_attempts
    WHERE ip = :ip AND attempted_at > :since
');
$stmt->execute([':ip' => $ip, ':since' => $since]);
if ((int)$stmt->fetchColumn() >= LOGIN_MAX_ATTEMPTS) {
    http_response_code(429);
    exit(json_encode(['error' => 'しばらく待ってから再試行してください']));
}

$body = json_decode(file_get_contents('php://input'), true);
$pin  = trim((string)($body['pin'] ?? ''));

if ($pin === '') {
    http_response_code(400);
    exit(json_encode(['error' => 'PINが必要です']));
}

$users   = db()->query('SELECT * FROM users')->fetchAll();
$matched = null;
foreach ($users as $u) {
    if (password_verify($pin, $u['pin_hash'])) {
        $matched = $u;
        break;
    }
}

if ($matched && $matched['banned_at'] !== null) {
    usleep(300000);
    http_response_code(403);
    exit(json_encode(['error' => 'このアカウントは利用停止中です']));
}

if (!$matched) {
    // 失敗を記録
    db()->prepare('INSERT INTO login_attempts (ip) VALUES (:ip)')
        ->execute([':ip' => $ip]);
    usleep(300000); // タイミング攻撃対策
    http_response_code(401);
    exit(json_encode(['error' => 'PINが違います']));
}

// 成功時: この IP の失敗記録を削除
db()->prepare('DELETE FROM login_attempts WHERE ip = :ip')
    ->execute([':ip' => $ip]);

$token = jwt_issue([
    'sub'  => (int)$matched['id'],
    'name' => $matched['name'],
    'role' => $matched['role'],
]);

echo json_encode([
    'token' => $token,
    'user'  => [
        'id'   => (int)$matched['id'],
        'name' => $matched['name'],
        'role' => $matched['role'],
    ],
]);
