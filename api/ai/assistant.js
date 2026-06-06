const { getUser } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

module.exports = function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { q } = req.body || {};
  // AI service integration placeholder
  return res.status(200).json({ answer: `AI service not configured. Query received: "${q}"` });
};
