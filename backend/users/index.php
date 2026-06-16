<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$rows = db()->query('SELECT id, name, role FROM users WHERE banned_at IS NULL ORDER BY id ASC')->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int)$r['id'];
}

echo json_encode($rows);
