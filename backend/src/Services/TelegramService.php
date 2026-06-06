<?php
namespace App\Services;

/**
 * TelegramService — sends messages via Telegram Bot API using cURL.
 * Uses cURL (not file_get_contents) for reliable HTTPS on Windows/XAMPP.
 *
 * Setup:
 *   1. Create a bot with @BotFather → /newbot → copy the token → TELEGRAM_BOT_TOKEN in backend/.env
 *   2. Add your bot to your channel/group, send it a message, then open:
 *        https://api.telegram.org/bot<TOKEN>/getUpdates
 *      Copy the "chat" > "id" value → TELEGRAM_CHAT_ID in backend/.env
 */
class TelegramService {

    private string $token;
    private string $defaultChatId;

    public function __construct() {
        $this->token         = trim(config('TELEGRAM_BOT_TOKEN', '8436701393:AAHS1vibBUFpZRJF6S9unWP9Dtmng4oIt9s'));
        $this->defaultChatId = trim(config('TELEGRAM_CHAT_ID',   '318033418'));
    }

    public function isConfigured(): bool   { return $this->token !== ''; }
    public function getDefaultChatId(): string { return $this->defaultChatId; }

    // ── Core cURL helper ──────────────────────────────────────────────────────

    private function call(string $method, array $params = []): array {
        if (!$this->token) {
            return ['ok' => false, 'error' => 'TELEGRAM_BOT_TOKEN is not set in backend/.env'];
        }

        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'cURL is not enabled in PHP. Enable extension=curl in php.ini and restart Apache.'];
        }

        $url = "https://api.telegram.org/bot{$this->token}/{$method}";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($params),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            // SSL — use bundled CA cert; fall back to no-verify if missing
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CAINFO         => $this->caBundlePath(),
        ]);

        $raw      = curl_exec($ch);
        $curlErr  = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // cURL failed (network error, SSL problem, timeout…)
        if ($raw === false) {
            // Retry without SSL verification (common on local XAMPP setups)
            $raw = $this->callNoSsl($url, $params, $curlErr2);
            if ($raw === false) {
                return ['ok' => false, 'error' => "cURL error: {$curlErr}. If on localhost, check internet connectivity and firewall."];
            }
        }

        $data = json_decode($raw, true);

        if (!is_array($data) || !isset($data['ok'])) {
            return ['ok' => false, 'error' => "Unexpected Telegram response (HTTP {$httpCode}): " . substr($raw, 0, 200)];
        }

        if (!$data['ok']) {
            $code = $data['error_code'] ?? 0;
            $desc = $data['description'] ?? 'Unknown error';
            return ['ok' => false, 'error' => $this->friendlyError($code, $desc), 'raw' => $desc];
        }

        return ['ok' => true, 'result' => $data['result'] ?? []];
    }

    /** Fallback: retry without SSL peer verification (for local dev). */
    private function callNoSsl(string $url, array $params, ?string &$errOut = null): string|false {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($params),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => false,   // skip SSL check for localhost
            CURLOPT_SSL_VERIFYHOST => 0,
        ]);
        $raw    = curl_exec($ch);
        $errOut = curl_error($ch);
        curl_close($ch);
        return $raw;
    }

    /** Try to find a CA bundle on Windows/XAMPP. */
    private function caBundlePath(): string {
        $candidates = [
            'C:/xampp/apache/conf/ssl.crt/server.crt',
            'C:/xampp/php/extras/ssl/cacert.pem',
            'C:/xampp/php/cacert.pem',
            ini_get('curl.cainfo'),
            ini_get('openssl.cafile'),
        ];
        foreach ($candidates as $p) {
            if ($p && is_file($p)) return $p;
        }
        return '';   // let cURL use its default
    }

    // ── Friendly error messages ───────────────────────────────────────────────

    private function friendlyError(int $code, string $desc): string {
        return match (true) {
            $code === 404
                => 'Bot token is invalid (404). Open @BotFather → copy the token again → update TELEGRAM_BOT_TOKEN in backend/.env.',
            $code === 401
                => 'Bot token is unauthorised (401). Re-generate it via @BotFather → /revoke.',
            $code === 400 && str_contains($desc, 'chat not found')
                => 'Chat ID not found (400). Make sure the bot is added to the channel/group and TELEGRAM_CHAT_ID is correct.',
            $code === 400 && str_contains($desc, 'bot was kicked')
                => 'Bot was removed from the chat. Re-add the bot to your channel/group.',
            $code === 400 && str_contains($desc, 'have no rights')
                => 'Bot has no permission to post. Promote it to Admin in your channel.',
            $code === 400 && str_contains($desc, 'parse')
                => 'HTML parse error in the message. The message contains invalid HTML tags.',
            $code === 429
                => 'Telegram rate limit hit (429). Wait a few seconds and try again.',
            $code >= 500
                => "Telegram server error ({$code}). Try again in a few seconds.",
            default
                => "Telegram error {$code}: {$desc}",
        };
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Verify bot token via getMe. Returns bot info on success.
     */
    public function testConnection(): array {
        $res = $this->call('getMe');
        if (!$res['ok']) return $res;
        $bot = $res['result'];
        return [
            'ok'  => true,
            'bot' => [
                'id'         => $bot['id']         ?? null,
                'username'   => '@' . ($bot['username']   ?? ''),
                'first_name' => $bot['first_name'] ?? '',
            ],
        ];
    }

    /**
     * Send a message to Telegram.
     *
     * @param string $message  HTML or plain text
     * @param string $chatId   Overrides TELEGRAM_CHAT_ID if provided
     */
    public function send(string $message, string $chatId = ''): array {
        $chatId = $chatId ?: $this->defaultChatId;

        if (!$this->token) {
            return ['ok' => false, 'error' => 'TELEGRAM_BOT_TOKEN is not set in backend/.env'];
        }
        if (!$chatId) {
            return ['ok' => false, 'error' => 'No Chat ID — set TELEGRAM_CHAT_ID in backend/.env or pass chat_id in the request.'];
        }

        $res = $this->call('sendMessage', [
            'chat_id'    => $chatId,
            'text'       => $message,
            'parse_mode' => 'HTML',
        ]);

        return [
            'ok'         => $res['ok'],
            'message_id' => $res['result']['message_id'] ?? null,
            'error'      => $res['ok'] ? null : ($res['error'] ?? 'Unknown error'),
        ];
    }

    /**
     * Format an alert array into a Telegram HTML message.
     */
    public function formatAlert(array $alert): string {
        $sev     = strtoupper($alert['sev'] ?? $alert['severity'] ?? 'LOW');
        $type    = htmlspecialchars($alert['type']    ?? 'Alert', ENT_QUOTES);
        $text    = htmlspecialchars($alert['text']    ?? $alert['message'] ?? '', ENT_QUOTES);
        $time    = htmlspecialchars($alert['time']    ?? date('d M Y, H:i'), ENT_QUOTES);
        $edition = htmlspecialchars($alert['edition'] ?? '', ENT_QUOTES);

        $sevEmoji = match ($sev) {
            'HIGH'          => '🔴',
            'MED', 'MEDIUM' => '🟡',
            default         => '🟢',
        };

        $lines   = [];
        $lines[] = "<b>{$sevEmoji} Patrika Newsroom — {$type} Alert</b>";
        $lines[] = '';
        $lines[] = $text;
        $lines[] = '';
        if ($edition) $lines[] = "📍 <i>Edition: {$edition}</i>";
        $lines[] = "⏰ <i>{$time}</i>";

        return implode("\n", $lines);
    }
}
