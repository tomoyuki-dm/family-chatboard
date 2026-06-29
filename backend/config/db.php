<?php
require_once __DIR__ . '/env.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $path = SQLITE_PATH;
        $dir  = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec(file_get_contents(__DIR__ . '/../schema.sqlite.sql'));
        // マイグレーション: 既存DBへのカラム追加（既存時は無視）
        try { $pdo->exec('ALTER TABLE users ADD COLUMN banned_at TEXT NULL DEFAULT NULL'); } catch (\PDOException $e) {}
        try { $pdo->exec('ALTER TABLE messages ADD COLUMN log_session_id INTEGER NOT NULL DEFAULT 1'); } catch (\PDOException $e) {}
        // 初期ログセッションがなければ作成（既存メッセージは DEFAULT 1 で session id=1 に属する）
        if ((int)$pdo->query('SELECT COUNT(*) FROM log_sessions')->fetchColumn() === 0) {
            $name = date('Ymd') . '-001';
            $pdo->prepare("INSERT INTO log_sessions (name, is_current) VALUES (:name, 1)")
                ->execute([':name' => $name]);
        }
    }
    return $pdo;
}

function current_log_id(): int {
    static $id = null;
    if ($id === null) {
        $row = db()->query('SELECT id FROM log_sessions WHERE is_current = 1 LIMIT 1')->fetch();
        $id  = $row ? (int)$row['id'] : 1;
    }
    return $id;
}

// SSEループ内でキャッシュなしに毎回確認するための関数
function fetch_current_log_id(): int {
    $row = db()->query('SELECT id FROM log_sessions WHERE is_current = 1 LIMIT 1')->fetch();
    return $row ? (int)$row['id'] : 1;
}

function get_setting(string $key, string $default = ''): string {
    $stmt = db()->prepare('SELECT value FROM app_settings WHERE key = :key');
    $stmt->execute([':key' => $key]);
    $row = $stmt->fetch();
    return $row ? (string)$row['value'] : $default;
}

function set_setting(string $key, string $value): void {
    db()->prepare('INSERT INTO app_settings (key, value) VALUES (:key, :value)
                    ON CONFLICT(key) DO UPDATE SET value = :value2')
        ->execute([':key' => $key, ':value' => $value, ':value2' => $value]);
}
