/**
 * GET  /api/tasks/comments?task_id=X — list comments for a task
 * POST /api/tasks/comments            — add a comment (with optional status update)
 */
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');
const { sendMessage } = require('../_lib/telegram');

const VALID_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'];

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — list comments for a task ────────────────────────────────────────
  if (req.method === 'GET') {
    const { task_id } = req.query;
    if (!task_id) return res.status(400).json({ error: 'task_id query param is required' });

    const comments = await query(
      `SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC`,
      [task_id]
    ).catch(() => []);

    return res.json({ comments });
  }

  // ── POST — add comment ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { task_id, comment, status_update } = body;

    if (!task_id)        return res.status(400).json({ error: 'task_id is required' });
    if (!comment?.trim()) return res.status(400).json({ error: 'comment is required' });

    // Verify task exists
    const [task] = await query('SELECT * FROM tasks WHERE id = ?', [task_id]).catch(() => []);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Fetch commenter display name
    const [commenterUser] = await query(
      'SELECT name FROM users WHERE username = ? LIMIT 1', [user.sub]
    ).catch(() => []);
    const commenterName = commenterUser?.name || user.sub || 'Unknown';

    // Validate and apply status update if provided
    let appliedStatus = '';
    if (status_update) {
      if (!VALID_STATUS.includes(status_update))
        return res.status(400).json({ error: 'Invalid status_update value' });

      const statusSets = ['status = ?', status_update === 'completed' ? 'completed_at = NOW()' : 'completed_at = NULL'];
      await query(
        `UPDATE tasks SET ${statusSets.join(', ')} WHERE id = ?`,
        [status_update, task_id]
      ).catch(e => console.error('[comments] Status update failed:', e.message));

      appliedStatus = status_update;
    }

    // Insert comment
    const result = await query(
      `INSERT INTO task_comments (task_id, commenter_pan, commenter_name, comment, status_update)
       VALUES (?, ?, ?, ?, ?)`,
      [task_id, user.sub, commenterName, comment.trim(), appliedStatus]
    );

    const [inserted] = await query(
      'SELECT * FROM task_comments WHERE id = ?', [result.insertId]
    ).catch(() => []);

    // Notify assigner via Telegram when assignee comments
    // (i.e. commenter is NOT the task creator / assigner)
    if (task.assigned_by_telegram && user.sub !== task.assigned_by) {
      const statusEmoji = { completed: '✅', in_progress: '🔄', pending: '⏸', cancelled: '❌' };
      const statusLabel = { completed: 'Completed', in_progress: 'In Progress', pending: 'Pending', cancelled: 'Cancelled' };

      let msg = `💬 <b>New Comment on Task</b>\n\n` +
        `<b>${task.title}</b>\n` +
        `👤 By: ${commenterName}\n\n` +
        `${comment.trim()}`;

      if (appliedStatus) {
        const emoji = statusEmoji[appliedStatus] || '📋';
        const label = statusLabel[appliedStatus] || appliedStatus;
        msg += `\n\n${emoji} Status updated to: <b>${label}</b>`;
      }

      sendMessage(task.assigned_by_telegram, msg)
        .catch(e => console.error('[comments] Telegram notify assigner failed:', e.message));
    }

    return res.status(201).json({ ok: true, comment: inserted });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
