/**
 * HR Candidates by ID — MySQL only
 * PATCH  /api/hr/candidates/:id  — update status / notes
 * DELETE /api/hr/candidates/:id  — delete candidate
 */
const { setCors, handleOptions } = require('../../_lib/cors');
const { requireRole }            = require('../../_lib/auth');
const { query }                  = require('../../_lib/mysql');

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'HR', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  if (!['Admin', 'HR'].includes(user.role))
    return res.status(403).json({ error: 'Forbidden' });

  const { id } = req.query;

  // ── PATCH ─────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const cols = Object.keys(body).filter(k => k !== 'id');
    if (!cols.length) return res.status(422).json({ error: 'Nothing to update' });

    const setClause = cols.map(c => `\`${c}\` = ?`).join(', ');
    const vals = [...cols.map(c => body[c]), id];

    try {
      await query(`UPDATE hr_candidates SET ${setClause}, updated_at = NOW() WHERE id = ?`, vals);
      const [row] = await query('SELECT * FROM hr_candidates WHERE id = ?', [id]);
      return res.json(row || {});
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM hr_candidates WHERE id = ?', [id]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
