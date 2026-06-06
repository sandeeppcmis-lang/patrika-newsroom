<?php
namespace App\Controllers;
use App\Core\{Auth, Response, Database};
use App\Services\TelegramService;

class AlertsController {

    public function index(): void {
        // Live alerts from DB; fallback to mock data until DB is seeded.
        try {
            $rows = Database::pdo()
                ->query("SELECT id, type, severity AS sev, message AS text, edition,
                                channel, is_read, DATE_FORMAT(created_at,'%d %b %H:%i') AS time
                         FROM alerts ORDER BY created_at DESC LIMIT 50")
                ->fetchAll();
            if ($rows) { Response::json($rows); return; }
        } catch (\Throwable $e) { /* fall through to mock */ }

        // Mock data — union of all alert types
        Response::json([
            ['id'=>1,'type'=>'Production','sev'=>'high','text'=>'Jaipur edition page 1 not closed till 23:30','time'=>'2m ago','edition'=>'Jaipur'],
            ['id'=>2,'type'=>'Legal','sev'=>'high','text'=>'High-risk hearing CIV/2025/118 in 8 days','time'=>'1h ago','edition'=>'Jaipur'],
            ['id'=>3,'type'=>'HR','sev'=>'med','text'=>'Kavita Rao retiring this month — plan replacement','time'=>'3h ago','edition'=>'All'],
            ['id'=>4,'type'=>'Content','sev'=>'med','text'=>'Fake-news probability high on submitted story #4412','time'=>'4h ago','edition'=>'Jodhpur'],
            ['id'=>5,'type'=>'Calendar','sev'=>'low','text'=>'Tomorrow: Ambedkar Jayanti special edition','time'=>'6h ago','edition'=>'All'],
        ]);
    }

    // ── Telegram ─────────────────────────────────────────────────────────────

    /**
     * POST /alerts/send-telegram
     * Body: { message?: string, chat_id?: string, alert_id?: int, alert?: object }
     *
     * Pass either:
     *   - `message`  — raw text/HTML to send as-is
     *   - `alert`    — full alert object; auto-formatted into a nice Telegram message
     * Optionally override `chat_id` to send to a different chat/group.
     */
    public function sendTelegram(): void {
        Auth::requireAuth();

        $in      = json_decode(file_get_contents('php://input'), true) ?? [];
        $message = trim($in['message'] ?? '');
        $chatId  = trim($in['chat_id']  ?? '');
        $alertId = $in['alert_id']      ?? null;
        $alert   = $in['alert']         ?? null;

        // Auto-format if an alert object is passed instead of a raw message
        $tg = new TelegramService();
        if ($message === '' && $alert) {
            $message = $tg->formatAlert($alert);
        }

        if ($message === '') {
            Response::error('Provide either message text or an alert object', 422);
        }

        $result = $tg->send($message, $chatId);

        // Log attempt in telegram_logs table (non-fatal if table not yet created)
        try {
            $stmt = Database::pdo()->prepare(
                'INSERT INTO telegram_logs (alert_id, message, chat_id, status, telegram_response, sent_at)
                 VALUES (?, ?, ?, ?, ?, NOW())'
            );
            $stmt->execute([
                $alertId,
                $message,
                $chatId ?: $tg->getDefaultChatId(),
                $result['ok'] ? 'sent' : 'failed',
                json_encode($result),
            ]);
        } catch (\Throwable $e) { /* DB logging is optional */ }

        Response::json([
            'ok'         => $result['ok'],
            'message_id' => $result['message_id'] ?? null,
            'error'      => $result['error']       ?? null,
        ]);
    }

    /**
     * GET /alerts/telegram-config
     * Returns Telegram setup status — never exposes the bot token.
     */
    public function telegramConfig(): void {
        Auth::requireAuth();
        $tg = new TelegramService();
        Response::json([
            'configured' => $tg->isConfigured(),
            'chat_id'    => $tg->getDefaultChatId(),
        ]);
    }

    /**
     * GET /alerts/telegram-test
     * Calls Telegram getMe to verify the bot token is valid.
     * Returns bot username on success, or a plain-English error on failure.
     */
    public function testTelegram(): void {
        Auth::requireAuth();
        $tg  = new TelegramService();
        $res = $tg->testConnection();
        Response::json($res);
    }
}
