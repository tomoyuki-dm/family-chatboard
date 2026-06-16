<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

$claims = require_auth();
if (($claims['role'] ?? '') !== 'admin') {
    http_response_code(403);
    exit(json_encode(['error' => '管理者権限が必要です']));
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = db()->query(
        'SELECT id, name, is_current, created_at FROM log_sessions ORDER BY id DESC'
    )->fetchAll();
    foreach ($rows as &$r) {
        $r['id']         = (int)$r['id'];
        $r['is_current'] = (bool)$r['is_current'];
    }
    echo json_encode($rows);

} elseif ($method === 'POST') {
    $input  = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $input['action'] ?? '';

    if ($action === 'new') {
        $pdo    = db();
        $today  = date('Ymd');
        $stmt   = $pdo->prepare("SELECT COUNT(*) FROM log_sessions WHERE name LIKE :prefix");
        $stmt->execute([':prefix' => $today . '-%']);
        $seq    = (int)$stmt->fetchColumn() + 1;
        $name   = $today . '-' . str_pad($seq, 3, '0', STR_PAD_LEFT);

        $pdo->exec('UPDATE log_sessions SET is_current = 0');
        $pdo->prepare("INSERT INTO log_sessions (name, is_current) VALUES (:name, 1)")
            ->execute([':name' => $name]);

        echo json_encode(['ok' => true, 'name' => $name, 'id' => (int)$pdo->lastInsertId()]);

    } elseif ($action === 'switch') {
        $targetId = (int)($input['log_id'] ?? 0);
        if ($targetId <= 0) {
            http_response_code(400);
            exit(json_encode(['error' => '無効なログIDです']));
        }
        $pdo = db();
        $pdo->exec('UPDATE log_sessions SET is_current = 0');
        $pdo->prepare('UPDATE log_sessions SET is_current = 1 WHERE id = :id')
            ->execute([':id' => $targetId]);
        echo json_encode(['ok' => true]);

    } else {
        http_response_code(400);
        echo json_encode(['error' => '無効なアクションです']);
    }

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
