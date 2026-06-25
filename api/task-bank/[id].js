/**
 * GET    /api/task-bank/:id  — get single template
 * PATCH  /api/task-bank/:id  — update template
 * DELETE /api/task-bank/:id  — delete template
 */
const { query }       = require('../_lib/mysql');
const { requireRole } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError, user } = requireRole(req, ['Admin', 'State Head']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Template ID required' });

  const [tmpl] = await query('SELECT * FROM task_bank WHERE id = ?', [id]).catch(() => []);
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });

  if (req.method === 'GET') return res.json({ template: tmpl });

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { title, description, category, priority } = body;
    const sets = [], params = [];
    if (title       !== undefined) { sets.push('title = ?');       params.push(title.trim()); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (category    !== undefined) { sets.push('category = ?');    params.push(category); }
    if (priority    !== undefined) { sets.push('priority = ?');    params.push(priority); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(id);
    await query(`UPDATE task_bank SET ${sets.join(', ')} WHERE id = ?`, params);
    const [updated] = await query('SELECT * FROM task_bank WHERE id = ?', [id]).catch(() => []);
    return res.json({ ok: true, template: updated });
  }

  if (req.method === 'DELETE') {
    await query('DELETE FROM task_bank WHERE id = ?', [id]);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
