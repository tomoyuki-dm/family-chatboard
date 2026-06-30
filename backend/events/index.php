<?php
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/db.php';

// SSE用CORS
header('Access-Control-Allow-Origin: '    . ALLOWED_ORIGIN);
header('Access-Control-Allow-Credentials: true');
header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); // nginx対応

ini_set('output_buffering', 'off');
ini_set('zlib.output_compression', false);
if (function_exists('apache_setenv')) {
    apache_setenv('no-gzip', '1');
}

// SSE専用短命トークンで認証（長期JWTをURLに露出させない）
$sse_token = $_GET['st'] ?? '';
if (!$sse_token) {
    echo "event: error\ndata: {\"error\":\"Unauthorized\"}\n\n";
    flush();
    exit;
}

// 期限切れ掃除 & 検証
db()->query("DELETE FROM sse_tokens WHERE expires_at < datetime('now')");
$stmt = db()->prepare(
    "SELECT user_id FROM sse_tokens WHERE token = :t AND expires_at >= datetime('now')"
);
$stmt->execute([':t' => $sse_token]);
$row = $stmt->fetch();

if (!$row) {
    echo "event: error\ndata: {\"error\":\"Token expired or invalid\"}\n\n";
    flush();
    exit;
}

$uid    = (int)$row['user_id'];
$log_id = current_log_id();

// 使い捨て（再接続時は再発行が必要）
db()->prepare('DELETE FROM sse_tokens WHERE token = :t')->execute([':t' => $sse_token]);

// SSE接続時に自分のプレゼンスを即登録（初期presence応答に自分が含まれるようにする）
db()->prepare(
    "INSERT OR REPLACE INTO presence (user_id, last_ping) VALUES (:uid, datetime('now'))"
)->execute([':uid' => $uid]);

set_time_limit(0);

$last_msg_id     = (int)($_GET['last_id'] ?? 0);
$last_read_ts    = date('Y-m-d H:i:s', time() - 2);
$last_deleted_ts = date('Y-m-d H:i:s', time() - 2);
$last_signal_id  = (int)db()->query('SELECT COALESCE(MAX(id), 0) FROM call_signals')->fetchColumn();
$start        = time();
$timeout      = 28;
$tick         = 0;

function sse(string $event, mixed $data): void {
    echo "event: {$event}\ndata: " . json_encode($data) . "\n\n";
    if (ob_get_level() > 0) ob_flush();
    flush();
}

function fetch_presence(): array {
    $rows = db()->query(
        "SELECT user_id FROM presence WHERE last_ping > datetime('now', '-45 seconds')"
    )->fetchAll();
    $map = [];
    foreach ($rows as $r) $map[(int)$r['user_id']] = true;
    return $map;
}

sse('presence', fetch_presence());

while (!connection_aborted() && (time() - $start) < $timeout) {
    // 新着メッセージ（現在のログセッションのみ）
    $stmt = db()->prepare('
        SELECT m.id, m.user_id, u.name AS user_name, m.type, m.body, m.created_at,
               COUNT(CASE WHEN r.user_id != m.user_id THEN 1 END) AS read_count,
               GROUP_CONCAT(CASE WHEN r.user_id != m.user_id THEN r.user_id END) AS read_by
        FROM messages m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN message_reads r ON r.message_id = m.id
        WHERE m.id > :last AND m.log_session_id = :log_id
        GROUP BY m.id
        ORDER BY m.id ASC
    ');
    $stmt->execute([':last' => $last_msg_id, ':log_id' => $log_id]);
    foreach ($stmt->fetchAll() as $m) {
        $m['id']         = (int)$m['id'];
        $m['user_id']    = (int)$m['user_id'];
        $m['read_count'] = (int)$m['read_count'];
        $m['read_by']    = $m['read_by']
            ? array_map('intval', explode(',', $m['read_by']))
            : [];
        sse('message', $m);
        $last_msg_id = max($last_msg_id, $m['id']);
    }

    // 既読更新
    $now = date('Y-m-d H:i:s');
    $stmt2 = db()->prepare('
        SELECT r.message_id,
               COUNT(*) AS read_count,
               GROUP_CONCAT(r.user_id) AS read_by
        FROM message_reads r
        JOIN messages m ON m.id = r.message_id
        WHERE r.read_at >= :since AND r.user_id != m.user_id
        GROUP BY r.message_id
    ');
    $stmt2->execute([':since' => $last_read_ts]);
    foreach ($stmt2->fetchAll() as $rd) {
        sse('read', [
            'message_id' => (int)$rd['message_id'],
            'read_count' => (int)$rd['read_count'],
            'read_by'    => array_map('intval', explode(',', $rd['read_by'])),
        ]);
    }
    $last_read_ts = $now;

    // 削除イベント
    $stmt3 = db()->prepare('SELECT id FROM messages WHERE deleted_at >= :since');
    $stmt3->execute([':since' => $last_deleted_ts]);
    foreach ($stmt3->fetchAll() as $d) {
        sse('deleted', ['message_id' => (int)$d['id']]);
    }
    $last_deleted_ts = $now;

    // 通話シグナル（offer/answer/ice/hangup等）の配信
    $stmt4 = db()->prepare('
        SELECT cs.id, cs.from_user_id, u.name AS from_name, cs.type, cs.payload
        FROM call_signals cs
        JOIN users u ON u.id = cs.from_user_id
        WHERE cs.id > :last AND cs.to_user_id = :uid
        ORDER BY cs.id ASC
    ');
    $stmt4->execute([':last' => $last_signal_id, ':uid' => $uid]);
    foreach ($stmt4->fetchAll() as $cs) {
        sse('call_signal', [
            'from_user_id' => (int)$cs['from_user_id'],
            'from_name'    => $cs['from_name'],
            'type'         => $cs['type'],
            'payload'      => json_decode($cs['payload'], true),
        ]);
        $last_signal_id = max($last_signal_id, (int)$cs['id']);
    }

    $tick++;
    if ($tick % 8 === 0) {
        sse('presence', fetch_presence());
        // ログセッションが切り替わっていたら全クライアントに通知して終了
        if (fetch_current_log_id() !== $log_id) {
            sse('log_switched', []);
            exit;
        }
    }

    sleep(1);
}

// 再接続を指示（フロントエンド側で新しいSSEトークンを取得して再接続）
sse('reconnect', ['last_id' => $last_msg_id]);
