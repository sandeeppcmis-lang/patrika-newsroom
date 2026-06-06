/**
 * HR Employees — MySQL only
 * GET  /api/hr/employees   — list employees (role-scoped automatically)
 * POST /api/hr/employees   — upsert an employee record
 *
 * Role scoping:
 *   Admin / HR / Management → all employees (optional ?state= / ?branch= filter)
 *   State Head              → only employees in user.state
 *   Regional Editor         → only employees in user.state + user.branch
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

const VIEW_ROLES = ['Admin', 'Management', 'HR', 'State Head', 'Regional Editor'];
const EDIT_ROLES = ['Admin', 'HR', 'State Head'];
const TABLE      = process.env.MYSQL_TABLE_EMPLOYEES || 'user';

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { authError, user } = requireRole(req, VIEW_ROLES);
    if (authError) return res.status(authError.status).json({ error: authError.message });

    const where  = [];
    const params = [];

    // ── Mandatory role-based scope ──────────────────────────────────────
    if (user.role === 'State Head' && user.state) {
      where.push('State = ?');
      params.push(user.state);

    } else if (user.role === 'Regional Editor') {
      if (user.state)  { where.push('State = ?');  params.push(user.state);  }
      if (user.branch) { where.push('Branch = ?'); params.push(user.branch); }

    } else {
      // Admin / HR / Management — honour optional query-param filters
      const { state, branch } = req.query;
      if (state  && state  !== 'All') { where.push('State = ?');  params.push(state);  }
      if (branch && branch !== 'All') { where.push('Branch = ?'); params.push(branch); }
    }

    const sql = `SELECT * FROM \`${TABLE}\``
      + (where.length ? ' WHERE ' + where.join(' AND ') : '')
      + ' ORDER BY EMPNAME ASC';

    try {
      const rows = await query(sql, params);
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — upsert employee ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { authError } = requireRole(req, EDIT_ROLES);
    if (authError) return res.status(authError.status).json({ error: authError.message });

    const emp = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!emp.EMP_CODE) return res.status(422).json({ error: 'EMP_CODE is required' });

    const cols   = Object.keys(emp);
    const vals   = Object.values(emp);
    const setCls = cols.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const colList = cols.map(c => `\`${c}\``).join(', ');

    const sql = `INSERT INTO \`${TABLE}\` (${colList}) VALUES (${placeholders})
                 ON DUPLICATE KEY UPDATE ${setCls}`;
    try {
      await query(sql, vals);
      return res.json({ ok: true, employee: emp });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
