/**
 * GET /api/auth/whoami  — returns the decoded token payload.
 * Useful for debugging auth issues. Delete after confirming login works.
 */
const { getUser }                = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

module.exports = (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'No valid token found', hint: 'Are you logged in?' });
  return res.json({ ok: true, decoded: user });
};
