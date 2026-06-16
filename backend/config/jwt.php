<?php
require_once __DIR__ . '/env.php';

function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwt_issue(array $payload): string {
    $header  = b64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = b64url_encode(json_encode(
        array_merge($payload, ['iat' => time(), 'exp' => time() + JWT_TTL])
    ));
    $sig = b64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwt_verify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $p, $s] = $parts;
    $expected = b64url_encode(hash_hmac('sha256', "$h.$p", JWT_SECRET, true));
    if (!hash_equals($expected, $s)) return null;
    $data = json_decode(b64url_decode($p), true);
    if (!is_array($data) || ($data['exp'] ?? 0) < time()) return null;
    return $data;
}

/** リクエストからJWTを検証してclaimsを返す。失敗時は401で終了。 */
function require_auth(): array {
    // 共有ホスティングでは HTTP_AUTHORIZATION が届かない場合があるため複数経路で取得
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? '';

    if (!$header && function_exists('getallheaders')) {
        $all    = getallheaders();
        $header = $all['Authorization'] ?? $all['authorization'] ?? '';
    }

    $token = $header ? (string)preg_replace('/^Bearer\s+/i', '', $header) : '';
    if (!$token) $token = $_GET['token'] ?? '';

    $claims = $token ? jwt_verify($token) : null;
    if (!$claims) {
        http_response_code(401);
        exit(json_encode(['error' => 'Unauthorized']));
    }
    return $claims;
}
