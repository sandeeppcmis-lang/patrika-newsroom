/**
 * GET    /api/archive/:id   — full record including transcript
 * PATCH  /api/archive/:id   — update title/category/tags/description/edition
 * DELETE /api/archive/:id   — delete file + DB record
 */
const path = require('path');
const fs   = require('fs');
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'archive');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req,
    ['Admin', 'State Head', 'Regional Editor', 'HR', 'Management', 'Legal']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await query('SELECT * FROM archive_files WHERE id = ?', [id]).catch(() => []);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ file: rows[0] });
  }

  // ── PATCH ────────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { title, category, state, branch, edition, tags, description } = req.body;
    const set = []; const params = [];
    if (title       !== undefined) { set.push('title = ?');       params.push(title); }
    if (category    !== undefined) { set.push('category = ?');    params.push(category); }
    if (state       !== undefined) { set.push('state = ?');       params.push(state); }
    if (branch      !== undefined) { set.push('branch = ?');      params.push(branch); }
    if (edition     !== undefined) { set.push('edition = ?');     params.push(edition); }
    if (tags        !== undefined) { set.push('tags = ?');        params.push(tags); }
    if (description !== undefined) { set.push('description = ?'); params.push(description); }
    if (!set.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(id);
    await query(`UPDATE archive_files SET ${set.join(', ')} WHERE id = ?`, params);
    const rows = await query('SELECT * FROM archive_files WHERE id = ?', [id]);
    return res.json({ file: rows[0] });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    const rows = await query('SELECT filename FROM archive_files WHERE id = ?', [id]).catch(() => []);
    if (rows.length) {
      const filePath = path.join(UPLOAD_DIR, rows[0].filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query('DELETE FROM archive_files WHERE id = ?', [id]);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
