/**
 * POST /api/auth/setup
 * One-time admin creation. Only works when users table is empty.
 * DELETE THIS FILE after the first admin user is created.
 */
const bcrypt    = require('bcryptjs');
const { query } = require('../_lib/mysql');
const { setCors, handleOptions } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rows = await query('SELECT COUNT(*) AS cnt FROM users');
    if (rows[0].cnt > 0)
      return res.status(403).json({ error: 'Setup already done — users exist. Delete this file from the server.' });

    const { username = 'admin', name = 'Administrator', password = 'Admin@1234' } = req.body || {};
    const hash = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, name, hash, 'Admin']
    );
    return res.status(201).json({ ok: true, message: `Admin user '${username}' created. DELETE this file now!` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
