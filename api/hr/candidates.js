/**
 * HR Recruitment Candidates — MySQL only
 * GET  /api/hr/candidates          — list candidates
 * POST /api/hr/candidates          — add candidate
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'HR', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { status } = req.query;
    let sql = 'SELECT * FROM hr_candidates';
    const params = [];
    if (status && status !== 'all') { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';

    try {
      const rows = await query(sql, params);
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — add candidate ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    // Allow Admin and State Head to add candidates too (CV upload)
    if (!['Admin', 'HR', 'State Head'].includes(user.role))
      return res.status(403).json({ error: 'Forbidden' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!body.name) return res.status(422).json({ error: 'name is required' });

    // Whitelist only actual DB columns — strip frontend-only fields
    const ALLOWED = new Set([
      'name', 'father_name', 'email', 'mobile', 'address',
      'qualification', 'experience', 'aadhar', 'pan', 'gender',
      'applied_for', 'status', 'notes',
    ]);
    const cleaned = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED.has(k)) cleaned[k] = v;
    }
    // Normalise status capitalisation
    if (cleaned.status) {
      cleaned.status = cleaned.status.charAt(0).toUpperCase() + cleaned.status.slice(1).toLowerCase();
      if (!['Pending','Eligible','Not Eligible'].includes(cleaned.status)) cleaned.status = 'Pending';
    } else {
      cleaned.status = 'Pending';
    }

    const cols         = Object.keys(cleaned);
    const vals         = cols.map(c => cleaned[c]);
    const colList      = cols.map(c => `\`${c}\``).join(', ');
    const placeholders = cols.map(() => '?').join(', ');

    try {
      const result = await query(
        `INSERT INTO hr_candidates (${colList}) VALUES (${placeholders})`,
        vals
      );
      const [newRow] = await query('SELECT * FROM hr_candidates WHERE id = ?', [result.insertId]);
      return res.status(201).json(newRow);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
