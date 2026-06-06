const { getUser } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

module.exports = function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const token  = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID   || '';
  return res.status(200).json({ configured: !!(token && chatId), chat_id: chatId });
};
