/**
 * CRON: Due-Date Reminder Alerts — daily at 9:00 AM IST (UTC 03:30)
 *
 * Queries tasks due in exactly 3 days with status pending or in_progress,
 * then sends a Telegram reminder to each assignee.
 *
 * Usage: call register() once at server startup.
 *   const { register } = require('./api/cron/due-date-alerts');
 *   register();
 */

const cron          = require('node-cron');
const { query }     = require('../_lib/mysql');
const { sendMessage } = require('../_lib/telegram');

async function runDueDateAlerts() {
  console.log('[due-date-alerts] Running due date reminder check...');

  let tasks;
  try {
    tasks = await query(
      `SELECT t.id, t.title, t.due_date, t.status, t.assigned_to_pan, t.assigned_to_name
       FROM tasks t
       WHERE t.due_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
         AND t.status IN ('pending', 'in_progress')`
    );
  } catch (e) {
    console.error('[due-date-alerts] Query failed:', e.message);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log('[due-date-alerts] No tasks due in 3 days.');
    return;
  }

  console.log(`[due-date-alerts] Found ${tasks.length} task(s) due in 3 days.`);

  for (const task of tasks) {
    // Look up assignee's Telegram chat ID from employee master
    let chatId = null;
    try {
      const [emp] = await query(
        `SELECT telegram_chat_id FROM \`user\` WHERE pan_no = ? AND telegram_chat_id IS NOT NULL AND telegram_chat_id != '' LIMIT 1`,
        [task.assigned_to_pan]
      );
      chatId = emp?.telegram_chat_id || null;
    } catch (e) {
      console.error(`[due-date-alerts] Employee lookup failed for ${task.assigned_to_pan}:`, e.message);
    }

    if (!chatId) {
      console.log(`[due-date-alerts] No Telegram for ${task.assigned_to_name} (${task.assigned_to_pan}), skipping.`);
      continue;
    }

    const dueDateFormatted = task.due_date
      ? new Date(task.due_date).toISOString().slice(0, 10)
      : 'N/A';

    const statusLabel = {
      pending:     'Pending',
      in_progress: 'In Progress',
    }[task.status] || task.status;

    const msg =
      `⏰ <b>Due Date Reminder</b>\n\n` +
      `<b>${task.title}</b>\n` +
      `📅 Due: ${dueDateFormatted}\n` +
      `Status: ${statusLabel}\n\n` +
      `3 days left to complete this task.`;

    try {
      await sendMessage(chatId, msg);
      console.log(`[due-date-alerts] Reminder sent to ${task.assigned_to_name} for task #${task.id}`);
    } catch (e) {
      console.error(`[due-date-alerts] Telegram failed for task #${task.id}:`, e.message);
    }
  }
}

/**
 * Register the cron job. Call once at server startup.
 * Schedule: 03:30 UTC = 09:00 IST daily.
 */
function register() {
  cron.schedule('30 3 * * *', async () => {
    try {
      await runDueDateAlerts();
    } catch (e) {
      console.error('[due-date-alerts] Unhandled error:', e.message);
    }
  });
  console.log('[due-date-alerts] Cron registered — daily 09:00 IST (03:30 UTC)');
}

module.exports = { register, runDueDateAlerts };
