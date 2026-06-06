/**
 * HR Training & Induction — MySQL only
 * GET  /api/hr/training   — list all training records
 * POST /api/hr/training   — upsert a training record (unique: emp_code + training_type)
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'HR', 'Management', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { training_type, status } = req.query;
    const where = [];
    const params = [];
    if (training_type) { where.push('training_type = ?'); params.push(training_type); }
    if (status)        { where.push('status = ?');        params.push(status); }

    const sql = 'SELECT * FROM hr_training'
      + (where.length ? ' WHERE ' + where.join(' AND ') : '')
      + ' ORDER BY emp_name ASC';

    try {
      return res.json(await query(sql, params));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — upsert training record ─────────────────────────────────────────
  if (req.method === 'POST') {
    if (!['Admin', 'HR', 'State Head', 'Regional Editor'].includes(user.role))
      return res.status(403).json({ error: 'Forbidden' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!body.emp_code || !body.training_type)
      return res.status(422).json({ error: 'emp_code and training_type are required' });

    const { emp_code, emp_name, training_type, training_name, status, completed_date, notes } = body;

    try {
      await query(
        `INSERT INTO hr_training
           (emp_code, emp_name, training_type, training_name, status, completed_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           emp_name       = VALUES(emp_name),
           training_name  = VALUES(training_name),
           status         = VALUES(status),
           completed_date = VALUES(completed_date),
           notes          = VALUES(notes),
           updated_at     = NOW()`,
        [emp_code, emp_name || null, training_type, training_name || null,
         status || 'required', completed_date || null, notes || null]
      );
      const [row] = await query(
        'SELECT * FROM hr_training WHERE emp_code = ? AND training_type = ?',
        [emp_code, training_type]
      );
      return res.status(201).json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
