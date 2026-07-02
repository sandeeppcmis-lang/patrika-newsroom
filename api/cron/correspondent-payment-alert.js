/**
 * CRON: Correspondent Payment Alert — runs at 10:00 AM IST on the 3rd of every month.
 *
 * What it does:
 *   1. Finds all active branches where the total amount_paid for the previous
 *      month's correspondent_word_photo records is 0 (payment not yet entered).
 *   2. For each such branch, finds the Rajasthan RE(s) whose telegram_chat_id is set.
 *   3. Sends a Telegram alert to each RE and logs the result to
 *      correspondent_payment_alert_logs for the admin report.
 */

const cron            = require('node-cron');
const { query }       = require('../_lib/mysql');
const { sendMessage } = require('../_lib/telegram');

// ── Ensure log table exists ───────────────────────────────────────────────────

async function ensureLogTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS correspondent_payment_alert_logs (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      re_name    VARCHAR(200) DEFAULT NULL,
      branch     VARCHAR(200) DEFAULT NULL,
      chat_id    VARCHAR(100) DEFAULT NULL,
      month      VARCHAR(50)  DEFAULT NULL,
      status     ENUM('sent','failed') DEFAULT 'failed',
      error_msg  TEXT         DEFAULT NULL,
      triggered_by VARCHAR(20) DEFAULT 'cron',
      sent_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prevMonthLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

// ── Core logic (exported so it can also be triggered manually via an API) ─────

async function run(triggeredBy = 'cron') {
  await ensureLogTable();
  const label = prevMonthLabel();
  console.log(`[correspondent-payment-alert] Running for ${label} (triggered by: ${triggeredBy})`);

  // 1. Branches with zero total payment for the previous month.
  const zeroBranches = await query(`
    SELECT c.branch
    FROM correspondent c
    LEFT JOIN correspondent_word_photo wp
      ON wp.Pan_no = c.pan_no
     AND DATE_FORMAT(wp.from_date, '%Y-%m') =
         DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')
    WHERE c.status = 1
    GROUP BY c.branch
    HAVING COALESCE(SUM(wp.amount_paid), 0) = 0
    ORDER BY c.branch ASC
  `).catch(err => {
    console.error('[correspondent-payment-alert] DB error (branch query):', err.message);
    return [];
  });

  if (!zeroBranches.length) {
    console.log('[correspondent-payment-alert] All branches have payments — no alerts needed.');
    return { sent: 0, failed: 0, skipped: true };
  }

  const branchNames = zeroBranches.map(r => r.branch);
  console.log(`[correspondent-payment-alert] Zero-payment branches: ${branchNames.join(', ')}`);

  // 2. Find Rajasthan REs for those branches who have a Telegram chat ID.
  const placeholders = branchNames.map(() => '?').join(', ');
  const recipients = await query(`
    SELECT EMPNAME, Branch, telegram_chat_id
    FROM \`user\`
    WHERE Story_Type REGEXP '\\\\bRE\\\\b'
      AND State = 'Rajasthan'
      AND Branch IN (${placeholders})
      AND telegram_chat_id IS NOT NULL
      AND telegram_chat_id != ''
      AND (is_emp_working = 1 OR Status IN ('Working', 'Active'))
  `, branchNames).catch(err => {
    console.error('[correspondent-payment-alert] DB error (RE query):', err.message);
    return [];
  });

  if (!recipients.length) {
    console.log('[correspondent-payment-alert] No REs with Telegram IDs found for flagged branches.');
    return { sent: 0, failed: 0, skipped: true };
  }

  // 3. Send one alert per RE and log each result.
  let sent = 0, failed = 0;
  for (const re of recipients) {
    const text =
      `🔔 <b>Correspondent Payment Alert</b>\n\n` +
      `Branch: <b>${re.Branch}</b>\n` +
      `Month: <b>${label}</b>\n\n` +
      `❌ Correspondent payment for your branch is showing <b>₹0</b>.\n\n` +
      `Please update the correspondent payment details at the earliest.\n\n` +
      `— Patrika Newsroom`;

    let status = 'failed', errorMsg = null;
    try {
      await sendMessage(re.telegram_chat_id, text);
      status = 'sent';
      sent++;
      console.log(`[correspondent-payment-alert] Sent to ${re.EMPNAME} (${re.Branch})`);
    } catch (err) {
      errorMsg = err.message;
      failed++;
      console.error(`[correspondent-payment-alert] Failed for ${re.EMPNAME}: ${err.message}`);
    }

    // Log result (non-fatal)
    query(
      `INSERT INTO correspondent_payment_alert_logs
         (re_name, branch, chat_id, month, status, error_msg, triggered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [re.EMPNAME, re.Branch, re.telegram_chat_id, label, status, errorMsg, triggeredBy]
    ).catch(() => {});
  }

  console.log(`[correspondent-payment-alert] Done — sent: ${sent}, failed: ${failed}`);
  return { sent, failed, skipped: false };
}

// ── Cron registration ─────────────────────────────────────────────────────────

function register() {
  // 10:00 AM IST on the 3rd of every month  →  cron: '0 10 3 * *'
  cron.schedule('0 10 3 * *', () => {
    run('cron').catch(err => console.error('[correspondent-payment-alert] Unhandled error:', err));
  }, { timezone: 'Asia/Kolkata' });

  console.log('[correspondent-payment-alert] Cron registered — 10:00 AM IST on 3rd of every month');
}

module.exports = { register, run };
