<?php
namespace App\Core;

// Minimal dependency-free HS256 JWT. For production consider firebase/php-jwt.
class Auth {
    private static function b64(string $d): string {
        return rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
    }
    private static function b64d(string $d): string {
        return base64_decode(strtr($d, '-_', '+/'));
    }
    public static function issue(array $payload, int $ttl = 86400): string {
        $secret = config('JWT_SECRET', 'dev-secret');
        $header  = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['iat'] = time();
        $payload['exp'] = time() + $ttl;
        $body = self::b64(json_encode($payload));
        $sig  = self::b64(hash_hmac('sha256', "$header.$body", $secret, true));
        return "$header.$body.$sig";
    }
    public static function verify(?string $token): ?array {
        if (!$token) return null;
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$h, $b, $s] = $parts;
        $secret = config('JWT_SECRET', 'dev-secret');
        $expected = self::b64(hash_hmac('sha256', "$h.$b", $secret, true));
        if (!hash_equals($expected, $s)) return null;
        $payload = json_decode(self::b64d($b), true);
        if (($payload['exp'] ?? 0) < time()) return null;
        return $payload;
    }
    public static function user(): ?array {
        $hdr = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        // Last-resort fallback for hosts that expose headers only via Apache.
        if ($hdr === '' && function_exists('apache_request_headers')) {
            $h = apache_request_headers();
            $hdr = $h['Authorization'] ?? ($h['authorization'] ?? '');
        }
        if (preg_match('/Bearer\s+(.+)/', $hdr, $m)) return self::verify($m[1]);
        return null;
    }
    public static function requireAuth(): array {
        $u = self::user();
        if (!$u) Response::error('Unauthorized', 401);
        return $u;
    }

    /**
     * Require authentication AND one of the allowed roles.
     * Returns 401 if unauthenticated, 403 if role is not permitted.
     */
    public static function requireRole(array $roles): array {
        $u = self::requireAuth();
        if (!in_array($u['role'] ?? '', $roles, true)) {
            Response::error('Forbidden: insufficient role', 403);
        }
        return $u;
    }
}
