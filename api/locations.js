/**
 * GET /api/locations
 * Returns distinct states and their branches from the employee table.
 * Used by forms (Legal, HR, etc.) to populate cascading dropdowns.
 */
const { query }      = require('./_lib/mysql');
const { requireRole } = require('./_lib/auth');
const { setCors, handleOptions } = require('./_lib/cors');

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, ['Admin', 'State Head', 'Regional Editor', 'Legal', 'HR', 'Management']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const tbl = process.env.MYSQL_TABLE_EMPLOYEES || 'user';
  try {
    const rows = await query(
      `SELECT DISTINCT State, Branch FROM \`${tbl}\`
       WHERE State IS NOT NULL AND State <> ''
         AND Branch IS NOT NULL AND Branch <> ''
       ORDER BY State ASC, Branch ASC`
    );

    // Build { states: [...], branchesByState: { Rajasthan: [...], ... } }
    const statesSet = new Set();
    const branchesByState = {};
    for (const r of rows) {
      statesSet.add(r.State);
      if (!branchesByState[r.State]) branchesByState[r.State] = [];
      if (!branchesByState[r.State].includes(r.Branch)) {
        branchesByState[r.State].push(r.Branch);
      }
    }

    return res.json({
      states: [...statesSet].sort(),
      branchesByState,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
