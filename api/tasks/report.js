/**
 * GET /api/tasks/report?period=weekly|monthly&state=X
 *
 * Returns per-assignee performance stats:
 *   total, completed, cancelled, in_progress, pending,
 *   on_time, overdue, completion_rate, ontime_rate, grade
 *
 * Also returns summary: { total, completed, pending, in_progress }
 *
 * Period:
 *   weekly  — tasks created in last 7 days
 *   monthly — tasks created in current calendar month
 */
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

function grade(completionRate, ontimeRate) {
  if (completionRate >= 85 && ontimeRate >= 80) return 'A';
  if (completionRate >= 70)                     return 'B';
  if (completionRate >= 50)                     return 'C';
  return 'D';
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError, user } = requireRole(req, ['Admin', 'State Head']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const { period = 'weekly', state } = req.query;

  if (!['weekly', 'monthly'].includes(period))
    return res.status(400).json({ error: 'period must be weekly or monthly' });

  // Build WHERE clause for time window
  const conds  = [];
  const params = [];

  if (period === 'weekly') {
    conds.push('created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
  } else {
    conds.push('YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())');
  }

  // State filter — State Head is always restricted to their own state
  const effectiveState = user.role === 'State Head' ? user.state : (state || null);
  if (effectiveState) {
    conds.push('assigned_to_state = ?');
    params.push(effectiveState);
  }

  const where = 'WHERE ' + conds.join(' AND ');

  // Per-assignee aggregation
  const rows = await query(
    `SELECT
       assigned_to_pan,
       assigned_to_name,
       assigned_to_state,
       assigned_to_branch,
       COUNT(*)                                                             AS total,
       SUM(status = 'completed')                                            AS completed,
       SUM(status = 'cancelled')                                            AS cancelled,
       SUM(status = 'in_progress')                                          AS in_progress,
       SUM(status = 'pending')                                              AS pending,
       SUM(status = 'completed' AND due_date IS NOT NULL
           AND completed_at <= due_date)                                    AS on_time,
       SUM(status NOT IN ('completed','cancelled')
           AND due_date IS NOT NULL
           AND due_date < CURDATE())                                        AS overdue
     FROM tasks
     ${where}
     GROUP BY assigned_to_pan, assigned_to_name, assigned_to_state, assigned_to_branch
     ORDER BY assigned_to_state ASC, assigned_to_name ASC`,
    params
  ).catch(() => []);

  // Compute derived metrics per row
  const report = rows.map(r => {
    const total      = Number(r.total)      || 0;
    const completed  = Number(r.completed)  || 0;
    const onTime     = Number(r.on_time)    || 0;

    const completionRate = total > 0
      ? Math.round((completed / total) * 100)
      : 0;

    const ontimeRate = completed > 0
      ? Math.round((onTime / completed) * 100)
      : 0;

    return {
      assigned_to_pan:    r.assigned_to_pan,
      assigned_to_name:   r.assigned_to_name,
      assigned_to_state:  r.assigned_to_state,
      assigned_to_branch: r.assigned_to_branch,
      total,
      completed,
      cancelled:   Number(r.cancelled)   || 0,
      in_progress: Number(r.in_progress) || 0,
      pending:     Number(r.pending)     || 0,
      on_time:     onTime,
      overdue:     Number(r.overdue)     || 0,
      completion_rate: completionRate,
      ontime_rate:     ontimeRate,
      grade: grade(completionRate, ontimeRate),
    };
  });

  // Summary totals across all assignees in the filtered set
  const summary = report.reduce(
    (acc, r) => {
      acc.total       += r.total;
      acc.completed   += r.completed;
      acc.pending     += r.pending;
      acc.in_progress += r.in_progress;
      return acc;
    },
    { total: 0, completed: 0, pending: 0, in_progress: 0 }
  );

  return res.json({ period, state: effectiveState || null, summary, report });
};
