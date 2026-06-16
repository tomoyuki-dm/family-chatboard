<?php
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $count = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
    echo json_encode(['needed' => $count === 0]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $count = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count > 0) {
        http_response_code(403);
        exit(json_encode(['error' => '既にセットアップ済みです']));
    }

    $input   = json_decode(file_get_contents('php://input'), true);
    $members = $input['members'] ?? [];

    if (empty($members)) {
        http_response_code(400);
        exit(json_encode(['error' => 'メンバーが必要です']));
    }

    $stmt = db()->prepare(
        'INSERT INTO users (name, role, pin_hash) VALUES (:name, :role, :hash)'
    );

    foreach ($members as $m) {
        $name = trim((string)($m['name'] ?? ''));
        $validRoles = ['parent', 'child', 'admin'];
        $role = in_array($m['role'] ?? '', $validRoles, true) ? $m['role'] : 'child';
        $pin  = trim((string)($m['pin']  ?? ''));

        if ($name === '' || $pin === '') {
            http_response_code(400);
            exit(json_encode(['error' => '名前とPINは必須です']));
        }
        if (!preg_match('/^\d{4,8}$/', $pin)) {
            http_response_code(400);
            exit(json_encode(['error' => 'PINは4〜8桁の数字にしてください']));
        }

        $stmt->execute([
            ':name' => mb_substr($name, 0, 50),
            ':role' => $role,
            ':hash' => password_hash($pin, PASSWORD_DEFAULT),
        ]);
    }

    echo json_encode(['ok' => true]);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
