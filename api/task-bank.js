/**
 * GET  /api/task-bank     — list all task bank templates
 * POST /api/task-bank     — create a new template (Admin / State Head)
 */
const { query }       = require('./_lib/mysql');
const { requireRole } = require('./_lib/auth');
const { setCors, handleOptions } = require('./_lib/cors');

let tableReady = false;

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS task_bank (
      id              INT          AUTO_INCREMENT PRIMARY KEY,
      title           VARCHAR(255) NOT NULL,
      description     TEXT,
      category        VARCHAR(100) DEFAULT 'Other',
      priority        ENUM('high','medium','low') DEFAULT 'medium',
      created_by      VARCHAR(100),
      created_by_name VARCHAR(255),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  if (!tableReady) {
    try { await ensureTable(); tableReady = true; }
    catch (e) { return res.status(500).json({ error: 'DB setup: ' + e.message }); }
  }

  // ── GET — list all templates ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const { category, search } = req.query;
    const conds = [], params = [];
    if (category && category !== 'all') { conds.push('category = ?'); params.push(category); }
    if (search) { conds.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const rows = await query(
      `SELECT * FROM task_bank ${where} ORDER BY category ASC, title ASC`, params
    ).catch(() => []);
    return res.json({ templates: rows });
  }

  // ── POST — create template ────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (user.role === 'Regional Editor')
      return res.status(403).json({ error: 'Regional Editors cannot create task bank entries' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { title, description, category, priority } = body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const [creator] = await query(
      'SELECT name FROM users WHERE username = ? LIMIT 1', [user.sub]
    ).catch(() => []);
    const creatorName = creator?.name || user.sub;

    const result = await query(
      `INSERT INTO task_bank (title, description, category, priority, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title.trim(), description || '', category || 'Other', priority || 'medium', user.sub, creatorName]
    );
    const [created] = await query('SELECT * FROM task_bank WHERE id = ?', [result.insertId]).catch(() => []);
    return res.status(201).json({ ok: true, template: created });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
