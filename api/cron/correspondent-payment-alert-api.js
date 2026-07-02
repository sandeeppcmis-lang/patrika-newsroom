/**
 * GET  /api/correspondent/payment-alert  — fetch alert log (Admin only)
 * POST /api/correspondent/payment-alert  — manually trigger alert (Admin only)
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');
const { run }                    = require('./correspondent-payment-alert');

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, ['Admin']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — return alert logs ───────────────────────────────────────────────
  if (req.method === 'GET') {
    // Ensure table exists before querying
    await query(`
      CREATE TABLE IF NOT EXISTS correspondent_payment_alert_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        re_name      VARCHAR(200) DEFAULT NULL,
        branch       VARCHAR(200) DEFAULT NULL,
        chat_id      VARCHAR(100) DEFAULT NULL,
        month        VARCHAR(50)  DEFAULT NULL,
        status       ENUM('sent','failed') DEFAULT 'failed',
        error_msg    TEXT         DEFAULT NULL,
        triggered_by VARCHAR(20)  DEFAULT 'cron',
        sent_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    try {
      const logs = await query(
        `SELECT id, re_name, branch, month, status, error_msg, triggered_by,
                DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%s') AS sent_at
         FROM correspondent_payment_alert_logs
         ORDER BY sent_at DESC
         LIMIT 200`
      );
      return res.json({ logs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — manually trigger ───────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const result = await run('manual');
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
