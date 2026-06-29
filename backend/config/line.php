<?php
require_once __DIR__ . '/db.php';

// 子どもからのテキスト投稿のみLINEへpush通知する（ベストエフォート、失敗しても投稿自体は成立させる）
function line_notify_on_message(string $role, string $msgType, string $userName, string $text): void {
    if ($role !== 'child' || $msgType !== 'text') {
        return;
    }
    if (get_setting('line_notify_enabled') !== '1') {
        return;
    }
    $token = get_setting('line_channel_access_token');
    $to    = get_setting('line_to_user_id');
    if ($token === '' || $to === '') {
        return;
    }

    $payload = json_encode([
        'to'       => $to,
        'messages' => [[
            'type' => 'text',
            'text' => "{$userName}さんの投稿:\n{$text}",
        ]],
    ]);

    try {
        $ch = curl_init('https://api.line.me/v2/bot/message/push');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $token,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
        ]);
        curl_exec($ch);
        curl_close($ch);
    } catch (\Throwable $e) {
        error_log('LINE notify failed: ' . $e->getMessage());
    }
}
