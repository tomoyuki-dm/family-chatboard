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
    echo json_encode([
        'enabled'             => get_setting('line_notify_enabled') === '1',
        'channel_access_token'=> get_setting('line_channel_access_token'),
        'to_user_id'          => get_setting('line_to_user_id'),
    ]);

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    set_setting('line_notify_enabled', !empty($input['enabled']) ? '1' : '0');
    set_setting('line_channel_access_token', trim((string)($input['channel_access_token'] ?? '')));
    set_setting('line_to_user_id', trim((string)($input['to_user_id'] ?? '')));

    echo json_encode(['ok' => true]);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
