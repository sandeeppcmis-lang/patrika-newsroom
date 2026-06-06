const { query }      = require('./_lib/mysql');
const { requireRole } = require('./_lib/auth');
const { setCors, handleOptions } = require('./_lib/cors');

const ALL_ROLES = ['Admin', 'State Head', 'Regional Editor', 'Legal'];

const MOCK = [
  { id:1, type:'SLA Breach',    severity:'high', message:'Jaipur edition missed PDF deadline by 22 min', edition:'Jaipur', channel:'Production', is_read:0, created_at: new Date().toISOString() },
  { id:2, type:'Legal Hearing', severity:'med',  message:'High-risk case CIV/2025/118 hearing in 3 days', edition:'All', channel:'Legal',      is_read:0, created_at: new Date().toISOString() },
  { id:3, type:'HR Notice',     severity:'low',  message:'Performance review due for 5 reporters',       edition:'All', channel:'HR',         is_read:1, created_at: new Date().toISOString() },
];

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, ALL_ROLES);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — list alerts ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50');
      return res.status(200).json(rows);
    } catch {
      return res.status(200).json(MOCK);
    }
  }

  // ── POST — create alert ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { type, severity, message, edition, channel } = req.body || {};
    if (!message) return res.status(422).json({ error: 'message is required' });
    try {
      const result = await query(
        'INSERT INTO alerts (type, severity, message, edition, channel) VALUES (?, ?, ?, ?, ?)',
        [type || 'General', severity || 'low', message, edition || 'All', channel || null]
      );
      return res.status(201).json({ ok: true, id: result.insertId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PATCH — mark as read ──────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { id } = req.body || {};
    if (!id) return res.status(422).json({ error: 'id is required' });
    try {
      await query('UPDATE alerts SET is_read = 1 WHERE id = ?', [id]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
