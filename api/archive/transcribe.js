/**
 * POST /api/archive/:id/transcribe
 * Transcribes a video/audio file to Hindi text using OpenAI Whisper.
 * Requires OPENAI_API_KEY in .env
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'OPENAI_API_KEY not configured. Add it to .env to enable transcription.',
    });
  }

  const rows = await query('SELECT * FROM archive_files WHERE id = ?', [id]).catch(() => []);
  if (!rows.length) return res.status(404).json({ error: 'File not found' });
  const file = rows[0];

  if (file.file_type !== 'video' && file.file_type !== 'audio') {
    return res.status(400).json({ error: 'Only video and audio files can be transcribed' });
  }

  const filePath = path.join(UPLOAD_DIR, file.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  // Mark as pending immediately
  await query("UPDATE archive_files SET transcript_status = 'pending' WHERE id = ?", [id]);
  res.json({ ok: true, message: 'Transcription started…' });

  // Run transcription in background
  (async () => {
    try {
      const FormData = require('form-data');
      const fetch    = require('node-fetch');

      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), {
        filename: file.original_name,
        contentType: file.mime_type,
      });
      form.append('model', 'whisper-1');
      form.append('language', 'hi');
      form.append('response_format', 'verbose_json');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
        body:    form,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        throw new Error(`Whisper API error: ${errText}`);
      }

      const data = await whisperRes.json();
      const transcript = data.text || '';

      // Generate a short Hindi summary using GPT-4o-mini
      let summary = '';
      try {
        const sumRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a Hindi news editor. Summarize the transcript in 3-4 sentences in Hindi. Focus on key newsworthy points.',
              },
              { role: 'user', content: transcript.slice(0, 4000) },
            ],
            max_tokens: 300,
          }),
        });
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          summary = sumData.choices?.[0]?.message?.content || '';
        }
      } catch (_) { /* summary is optional */ }

      await query(
        "UPDATE archive_files SET transcript_status='done', transcript_text=?, transcript_summary=? WHERE id=?",
        [transcript, summary, id]
      );
    } catch (err) {
      console.error('[archive/transcribe]', err.message);
      await query(
        "UPDATE archive_files SET transcript_status='failed' WHERE id=?",
        [id]
      ).catch(() => {});
    }
  })();
};
