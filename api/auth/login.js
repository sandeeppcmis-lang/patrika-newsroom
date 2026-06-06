const bcrypt         = require('bcryptjs');
const { query }      = require('../_lib/mysql');
const { issueToken } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

// Map old roles → new roles automatically
const ROLE_MAP = {
  'Admin':        'Admin',
  'Management':   'Admin',
  'Editor':       'State Head',
  'Bureau Chief': 'State Head',
  'HR':           'State Head',
  'Reporter':     'Regional Editor',
  'Legal':        'Legal',
};

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const rows = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    const u = rows[0];
    if (!u) return res.status(401).json({ error: 'Invalid username or password' });

    const passwordOk = await bcrypt.compare(password, u.password_hash);
    if (!passwordOk) return res.status(401).json({ error: 'Invalid username or password' });

    const role = ROLE_MAP[u.role] || u.role;
    const payload = {
      sub:    username,
      role,
      state:  u.state  || null,
      branch: u.branch || null,
    };
    const token = issueToken(payload);
    const user  = {
      name:   u.name,
      role,
      state:  u.state  || null,
      branch: u.branch || null,
      avatar: (u.name?.[0] || 'U').toUpperCase(),
    };
    return res.status(200).json({ token, user });
  } catch (err) {
    console.error('[login] Error:', err.message);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
};
