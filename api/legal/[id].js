const { query }      = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

const EDIT_ROLES = ['Admin', 'Legal'];

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { authError } = requireRole(req, EDIT_ROLES);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const id = parseInt(req.query?.id, 10);
  if (!id) return res.status(422).json({ error: 'Invalid case ID' });

  try {
    await query('DELETE FROM legal_cases WHERE id = ?', [id]);
    return res.status(200).json({ ok: true, deleted_id: id });
  } catch (err) {
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
};
