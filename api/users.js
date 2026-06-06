/**
 * Users management — Admin only
 * GET  /api/users  — list all users (no password_hash)
 * POST /api/users  — create a new user
 */
const bcrypt    = require('bcryptjs');
const { query } = require('./_lib/mysql');
const { requireRole }            = require('./_lib/auth');
const { setCors, handleOptions } = require('./_lib/cors');

const VALID_ROLES = ['Admin', 'State Head', 'Regional Editor', 'Legal'];

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, ['Admin']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — list users ──────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await query(
        'SELECT id, username, name, role, state, branch, created_at FROM users ORDER BY name ASC'
      );
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — create user ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { username, name, password, role, state, branch } = body;

    if (!username || !name || !password || !role)
      return res.status(422).json({ error: 'username, name, password and role are required' });

    if (!VALID_ROLES.includes(role))
      return res.status(422).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });

    try {
      const password_hash = await bcrypt.hash(password, 10);
      const result = await query(
        'INSERT INTO users (username, name, password_hash, role, state, branch) VALUES (?, ?, ?, ?, ?, ?)',
        [username, name, password_hash, role, state || null, branch || null]
      );
      const [created] = await query(
        'SELECT id, username, name, role, state, branch, created_at FROM users WHERE id = ?',
        [result.insertId]
      );
      return res.status(201).json(created);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ error: 'Username already exists' });
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
