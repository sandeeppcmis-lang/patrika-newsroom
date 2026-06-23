/**
 * GET    /api/task-groups/:id              — get group + members
 * PATCH  /api/task-groups/:id              — update name/description/type
 * DELETE /api/task-groups/:id              — delete group and its members
 * POST   /api/task-groups/:id?action=add_members    — add members by pan_no array
 * POST   /api/task-groups/:id?action=remove_member  — remove a member by pan_no
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
  if (!id) return res.status(400).json({ error: 'Group ID required' });

  const [group] = await query(
    'SELECT * FROM task_groups WHERE id = ?', [id]
  ).catch(() => []);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  // ── GET — return group + members ──────────────────────────────────────────
  if (req.method === 'GET') {
    const members = await query(
      `SELECT * FROM task_group_members WHERE group_id = ? ORDER BY emp_name ASC`,
      [id]
    ).catch(() => []);

    return res.json({ group: { ...group, members } });
  }

  // ── PATCH — update group fields ───────────────────────────────────────────
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { name, description, type } = body;

    const sets   = [];
    const params = [];

    if (name        !== undefined) { sets.push('name = ?');        params.push(name.trim()); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (type        !== undefined) { sets.push('type = ?');        params.push(type); }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(id);
    try {
      await query(`UPDATE task_groups SET ${sets.join(', ')} WHERE id = ?`, params);
    } catch (e) {
      if (e.message.includes('1062') || e.message.includes('Duplicate entry')) {
        return res.status(409).json({ error: 'A group with this name already exists' });
      }
      return res.status(500).json({ error: 'Update failed: ' + e.message });
    }

    const [updated] = await query('SELECT * FROM task_groups WHERE id = ?', [id]).catch(() => []);
    return res.json({ ok: true, group: updated });
  }

  // ── DELETE — remove group and all members ─────────────────────────────────
  if (req.method === 'DELETE') {
    await query('DELETE FROM task_group_members WHERE group_id = ?', [id]).catch(() => {});
    await query('DELETE FROM task_groups WHERE id = ?', [id]);
    return res.json({ ok: true });
  }

  // ── POST — member management actions ─────────────────────────────────────
  if (req.method === 'POST') {
    const action = req.query.action;
    const body   = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    // action=add_members  body: { pan_nos: ['pan1', 'pan2', ...] }
    if (action === 'add_members') {
      const { pan_nos } = body;
      if (!Array.isArray(pan_nos) || pan_nos.length === 0)
        return res.status(400).json({ error: 'pan_nos array is required' });

      const added   = [];
      const skipped = [];
      const errors  = [];

      for (const pan of pan_nos) {
        if (!pan) continue;

        const [emp] = await query(
          `SELECT pan_no, EMPNAME, telegram_chat_id, State, Branch
           FROM \`user\` WHERE pan_no = ? LIMIT 1`,
          [pan]
        ).catch(() => []);

        if (!emp) {
          errors.push(pan);
          continue;
        }

        try {
          await query(
            `INSERT INTO task_group_members
               (group_id, pan_no, emp_name, telegram_chat_id, state, branch)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, emp.pan_no, emp.EMPNAME || '', emp.telegram_chat_id || null,
             emp.State || '', emp.Branch || '']
          );
          added.push(emp.pan_no);
        } catch (e) {
          // Duplicate key — member already in group
          if (e.message.includes('1062') || e.message.includes('Duplicate entry')) {
            skipped.push(emp.pan_no);
          } else {
            errors.push(pan);
          }
        }
      }

      return res.json({ ok: true, added, skipped, errors });
    }

    // action=remove_member  body: { pan_no }
    if (action === 'remove_member') {
      const { pan_no } = body;
      if (!pan_no) return res.status(400).json({ error: 'pan_no is required' });

      await query(
        'DELETE FROM task_group_members WHERE group_id = ? AND pan_no = ?',
        [id, pan_no]
      );
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action. Use add_members or remove_member' });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
