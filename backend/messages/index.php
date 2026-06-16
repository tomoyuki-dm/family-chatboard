<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/jwt.php';

$claims = require_auth();
$uid    = (int)$claims['sub'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $since = (int)($_GET['since'] ?? 0);
    $limit = min((int)($_GET['limit'] ?? 50), 100);

    $logId = current_log_id();

    // since=0 のときは最新N件を時系列順で返す（サブクエリで最新を取得）
    if ($since === 0) {
        $sql = '
            SELECT m.id, m.user_id, u.name AS user_name, m.type,
               CASE WHEN m.deleted_at IS NULL THEN m.body ELSE \'\' END AS body,
               (m.deleted_at IS NOT NULL) AS deleted, m.created_at,
                   COUNT(CASE WHEN r.user_id != m.user_id THEN 1 END) AS read_count,
                   GROUP_CONCAT(CASE WHEN r.user_id != m.user_id THEN r.user_id END) AS read_by
            FROM (SELECT id FROM messages WHERE log_session_id = :log_id ORDER BY id DESC LIMIT :limit) sub
            JOIN messages m ON m.id = sub.id
            JOIN users u ON u.id = m.user_id
            LEFT JOIN message_reads r ON r.message_id = m.id
            GROUP BY m.id
            ORDER BY m.id ASC
        ';
    } else {
        $sql = '
            SELECT m.id, m.user_id, u.name AS user_name, m.type,
               CASE WHEN m.deleted_at IS NULL THEN m.body ELSE \'\' END AS body,
               (m.deleted_at IS NOT NULL) AS deleted, m.created_at,
                   COUNT(CASE WHEN r.user_id != m.user_id THEN 1 END) AS read_count,
                   GROUP_CONCAT(CASE WHEN r.user_id != m.user_id THEN r.user_id END) AS read_by
            FROM messages m
            JOIN users u ON u.id = m.user_id
            LEFT JOIN message_reads r ON r.message_id = m.id
            WHERE m.id > :since AND m.log_session_id = :log_id
            GROUP BY m.id
            ORDER BY m.id ASC
            LIMIT :limit
        ';
    }

    $stmt = db()->prepare($sql);
    $stmt->bindValue(':log_id', $logId, PDO::PARAM_INT);
    if ($since === 0) {
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    } else {
        $stmt->bindValue(':since', $since, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    }
    $stmt->execute();
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $r['id']         = (int)$r['id'];
        $r['user_id']    = (int)$r['user_id'];
        $r['read_count'] = (int)$r['read_count'];
        $r['deleted']    = (bool)$r['deleted'];
        $r['read_by']    = $r['read_by']
            ? array_map('intval', explode(',', $r['read_by']))
            : [];
    }

    echo json_encode($rows);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input   = json_decode(file_get_contents('php://input'), true) ?? [];
    $msgType = ($input['type'] ?? 'text') === 'file' ? 'file' : 'text';

    if ($msgType === 'file') {
        $p        = $input['body'] ?? [];
        $uploadId = (int)($p['id'] ?? 0);
        if ($uploadId <= 0 || !isset($p['mime'], $p['name'], $p['size'])) {
            http_response_code(400);
            exit(json_encode(['error' => '不正なファイルペイロードです']));
        }
        // アップロードが送信者本人のものか確認
        $chk = db()->prepare('SELECT id FROM uploads WHERE id = :id AND user_id = :uid');
        $chk->execute([':id' => $uploadId, ':uid' => $uid]);
        if (!$chk->fetch()) {
            http_response_code(403);
            exit(json_encode(['error' => 'Forbidden']));
        }
        $bodyStr = json_encode([
            'id'   => $uploadId,
            'mime' => (string)$p['mime'],
            'name' => mb_substr((string)$p['name'], 0, 255),
            'size' => (int)$p['size'],
        ]);
    } else {
        $text = trim((string)($input['body'] ?? ''));
        if ($text === '') {
            http_response_code(400);
            exit(json_encode(['error' => 'メッセージが空です']));
        }
        if (mb_strlen($text) > 1000) {
            http_response_code(400);
            exit(json_encode(['error' => 'メッセージが長すぎます（1000文字以内）']));
        }
        $bodyStr = $text;
    }

    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO messages (user_id, log_session_id, type, body) VALUES (:uid, :log_id, :type, :body)');
    $stmt->execute([':uid' => $uid, ':log_id' => current_log_id(), ':type' => $msgType, ':body' => $bodyStr]);
    $msgId = (int)$pdo->lastInsertId();

    // 送信者は既読にする
    $pdo->prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (:mid, :uid)')
        ->execute([':mid' => $msgId, ':uid' => $uid]);

    $row = $pdo->prepare('
        SELECT m.id, m.user_id, u.name AS user_name, m.type, m.body, m.created_at
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.id = :id
    ');
    $row->execute([':id' => $msgId]);
    $msg = $row->fetch();
    $msg['id']         = (int)$msg['id'];
    $msg['user_id']    = (int)$msg['user_id'];
    $msg['read_count'] = 0;
    $msg['read_by']    = [(int)$uid]; // 自分だけ既読

    echo json_encode($msg);

} elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $msgId = (int)($input['id'] ?? 0);

    if ($msgId <= 0) {
        http_response_code(400);
        exit(json_encode(['error' => 'IDが不正です']));
    }

    $pdo  = db();
    $chk  = $pdo->prepare('SELECT user_id FROM messages WHERE id = :id AND deleted_at IS NULL');
    $chk->execute([':id' => $msgId]);
    $msg = $chk->fetch();

    if (!$msg) {
        http_response_code(404);
        exit(json_encode(['error' => 'メッセージが見つかりません']));
    }
    $isOwner  = (int)$msg['user_id'] === $uid;
    $isParent = ($claims['role'] ?? '') === 'parent';
    $isAdmin  = ($claims['role'] ?? '') === 'admin';
    if (!$isOwner && !$isParent && !$isAdmin) {
        http_response_code(403);
        exit(json_encode(['error' => '削除する権限がありません']));
    }

    $pdo->prepare("UPDATE messages SET deleted_at = datetime('now') WHERE id = :id")
        ->execute([':id' => $msgId]);

    echo json_encode(['ok' => true, 'id' => $msgId]);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
