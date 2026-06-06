const https  = require('https');
const { getUser } = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

module.exports = function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token) return res.status(200).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' });

  const options = { hostname: 'api.telegram.org', path: `/bot${token}/getMe`, method: 'GET' };
  const tReq = https.request(options, (tRes) => {
    let data = '';
    tRes.on('data', d => data += d);
    tRes.on('end', () => {
      try {
        const j = JSON.parse(data);
        if (j.ok) return res.status(200).json({ ok: true, bot: { username: j.result.username, first_name: j.result.first_name } });
        return res.status(200).json({ ok: false, error: j.description });
      } catch { return res.status(200).json({ ok: false, error: 'Invalid response' }); }
    });
  });
  tReq.on('error', (e) => res.status(200).json({ ok: false, error: e.message }));
  tReq.end();
};
