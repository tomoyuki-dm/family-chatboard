<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

$claims = require_auth();
if (($claims['role'] ?? '') !== 'admin') {
    http_response_code(403);
    exit(json_encode(['error' => '管理者権限が必要です']));
}
$adminUid = (int)$claims['sub'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = db()->query(
        'SELECT id, name, role, banned_at, created_at FROM users ORDER BY id ASC'
    )->fetchAll();
    foreach ($rows as &$r) {
        $r['id']     = (int)$r['id'];
        $r['banned'] = $r['banned_at'] !== null;
    }
    echo json_encode($rows);

} elseif ($method === 'POST') {
    $input  = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $input['action'] ?? 'add';

    if ($action === 'add') {
        $name = trim((string)($input['name'] ?? ''));
        $role = $input['role'] ?? 'child';
        $pin  = trim((string)($input['pin'] ?? ''));

        if ($name === '' || $pin === '') {
            http_response_code(400);
            exit(json_encode(['error' => '名前とPINは必須です']));
        }
        if (!in_array($role, ['parent', 'child', 'admin'], true)) {
            http_response_code(400);
            exit(json_encode(['error' => '無効なロールです']));
        }
        if (!preg_match('/^\d{4,8}$/', $pin)) {
            http_response_code(400);
            exit(json_encode(['error' => 'PINは4〜8桁の数字にしてください']));
        }

        $pdo = db();
        $pdo->prepare('INSERT INTO users (name, role, pin_hash) VALUES (:name, :role, :hash)')
            ->execute([
                ':name' => mb_substr($name, 0, 50),
                ':role' => $role,
                ':hash' => password_hash($pin, PASSWORD_DEFAULT),
            ]);
        echo json_encode(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);

    } elseif ($action === 'ban') {
        $targetId = (int)($input['user_id'] ?? 0);
        if ($targetId === $adminUid) {
            http_response_code(400);
            exit(json_encode(['error' => '自分自身をバンすることはできません']));
        }
        db()->prepare("UPDATE users SET banned_at = datetime('now') WHERE id = :id")
            ->execute([':id' => $targetId]);
        echo json_encode(['ok' => true]);

    } elseif ($action === 'unban') {
        $targetId = (int)($input['user_id'] ?? 0);
        db()->prepare('UPDATE users SET banned_at = NULL WHERE id = :id')
            ->execute([':id' => $targetId]);
        echo json_encode(['ok' => true]);

    } elseif ($action === 'update') {
        $targetId = (int)($input['user_id'] ?? 0);
        $newName  = trim((string)($input['name'] ?? ''));
        $newRole  = $input['role'] ?? '';

        if ($newName === '') {
            http_response_code(400);
            exit(json_encode(['error' => '名前は必須です']));
        }
        if (!in_array($newRole, ['parent', 'child', 'admin'], true)) {
            http_response_code(400);
            exit(json_encode(['error' => '無効なロールです']));
        }
        db()->prepare('UPDATE users SET name = :name, role = :role WHERE id = :id')
            ->execute([':name' => mb_substr($newName, 0, 50), ':role' => $newRole, ':id' => $targetId]);
        echo json_encode(['ok' => true]);

    } else {
        http_response_code(400);
        echo json_encode(['error' => '無効なアクションです']);
    }

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
