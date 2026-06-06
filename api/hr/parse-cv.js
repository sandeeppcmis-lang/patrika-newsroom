/**
 * POST /api/hr/parse-cv
 * Accepts multiple CV files (PDF, DOCX, DOC, TXT, RTF).
 * Returns extracted candidate fields for each file.
 */
const multer  = require('multer');
const path    = require('path');
const { requireRole }            = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }, // 15 MB per file
});

// ── PDF with timeout ──────────────────────────────────────────────────────────
function pdfWithTimeout(buffer, ms = 15000) {
  return Promise.race([
    require('pdf-parse')(buffer),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PDF parse timed out')), ms)
    ),
  ]);
}

// ── Text extraction ────────────────────────────────────────────────────────────
async function extractText(buffer, mimetype, originalname) {
  const ext = path.extname(originalname).toLowerCase();

  // PDF
  if (ext === '.pdf' || mimetype === 'application/pdf') {
    try {
      const data = await pdfWithTimeout(buffer, 15000);
      return data.text || '';
    } catch (e) {
      console.warn('[parse-cv] pdf-parse failed for', originalname, ':', e.message);
      // Fallback: extract readable ASCII from the binary
      return buffer.toString('latin1')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/[ \t]{4,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
    }
  }

  // DOCX
  if (ext === '.docx' || mimetype.includes('wordprocessingml')) {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  // DOC (older Word)
  if (ext === '.doc' || mimetype.includes('msword')) {
    try {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch {
      return buffer.toString('latin1')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/[ \t]{4,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
    }
  }

  // RTF — strip control words
  if (ext === '.rtf' || mimetype === 'application/rtf') {
    return buffer.toString('utf8')
      .replace(/\{[^{}]*\}/g, '')
      .replace(/\\[a-z]+\d*\s?/g, ' ')
      .replace(/[{}\\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Plain text / CSV / anything else
  return buffer.toString('utf8');
}

// ── Field extraction from raw text ────────────────────────────────────────────
function parseCV(text) {
  const lines = text.split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 1);

  const emailM  = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
  const mobileM = text.match(/(?<!\d)(?:\+91[-\s]?)?[6-9]\d{9}(?!\d)/);
  const panM    = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);

  // Name: first meaningful short line
  let name = '';
  for (const line of lines.slice(0, 10)) {
    if (
      line.length >= 3 && line.length <= 60 &&
      !/resume|curriculum|vitae|\bcv\b|address|phone|email|mobile|contact|objective|profile|summary|declaration/i.test(line) &&
      !/^\d/.test(line) &&
      !line.includes('@') &&
      !/\d{5,}/.test(line) &&
      line.split(' ').length <= 6
    ) {
      name = line.replace(/^(name\s*[:\-]|mr\.?|ms\.?|mrs\.?|dr\.?)\s*/i, '').trim();
      break;
    }
  }

  // Father's name
  let fatherName = '';
  const fatherM = text.match(
    /(?:father['']?s?\s*name|f\/o|s\/o)\s*[:\-–]?\s*([A-Za-z][A-Za-z\s.]{2,49})/i
  );
  if (fatherM) fatherName = fatherM[1].trim().split(/\n/)[0].trim();

  // Gender
  let gender = '';
  const genderM = text.match(/\bgender\s*[:\-]?\s*(male|female|other)\b/i)
               || text.match(/\bsex\s*[:\-]?\s*(male|female|other)\b/i)
               || text.match(/\b(female)\b/i)
               || text.match(/\b(male)\b/i);
  if (genderM) {
    const g = genderM[1].toLowerCase();
    gender = g.charAt(0).toUpperCase() + g.slice(1);
  }

  // Qualification
  let qualification = '';
  const qualM = text.match(/(?:qualification|highest\s+qualification|education)\s*[:\-–]?\s*([^\n]{3,80})/i)
             || text.match(/\b(B\.?\s*Tech|M\.?\s*Tech|MBA|BCA|MCA|B\.?\s*Sc|M\.?\s*Sc|B\.?\s*A\b|M\.?\s*A\b|B\.?\s*E\b|M\.?\s*E\b|Ph\.?\s*D|Diploma|B\.?\s*Com|M\.?\s*Com|Graduate|Post[\s-]?Graduate|12th|10th)\b/i);
  if (qualM) qualification = qualM[1]?.trim() || qualM[0]?.trim();

  // Experience
  let experience = '';
  const expM = text.match(/(\d+\.?\d*)\s*\+?\s*years?\s*(?:of\s*)?(?:experience|exp)/i)
             || text.match(/experience\s*[:\-–]?\s*([^\n]{2,50})/i);
  if (expM) experience = (expM[1] ? expM[0] : expM[1])?.trim() || expM[0].trim();

  // Applied For
  let appliedFor = '';
  const postM = text.match(/(?:applied\s*for|position\s*applied|post\s*applied|applying\s*for)\s*[:\-–]?\s*([^\n]{2,60})/i)
             || text.match(/(?:position|post|role|designation)\s*[:\-–]\s*([^\n]{2,60})/i);
  if (postM) appliedFor = postM[1]?.trim() || '';

  return {
    name:          name,
    father_name:   fatherName,
    gender:        gender,
    email:         emailM?.[0]  || '',
    mobile:        mobileM?.[0]?.replace(/\D/g, '').replace(/^91/, '').slice(-10) || '',
    qualification: qualification || '',
    experience:    experience    || '',
    applied_for:   appliedFor    || '',
    pan:           panM?.[0]     || '',
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { authError } = requireRole(req, ['Admin', 'State Head', 'HR']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  upload.array('files', 50)(req, res, async (err) => {
    // Always wrap everything so a response is guaranteed
    try {
      if (err) {
        console.error('[parse-cv] multer error:', err.code, err.message);
        return res.status(400).json({ error: 'Upload error: ' + err.message });
      }

      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ error: 'No files received — select at least one file' });
      }

      const results = [];
      for (const file of files) {
        try {
          const text   = await extractText(file.buffer, file.mimetype, file.originalname);
          const parsed = parseCV(text);
          results.push({ filename: file.originalname, ok: true, ...parsed });
        } catch (e) {
          console.warn('[parse-cv] file error:', file.originalname, e.message);
          results.push({
            filename: file.originalname, ok: false, error: e.message,
            name: '', father_name: '', gender: '', email: '',
            mobile: '', qualification: '', experience: '', applied_for: '', pan: '',
          });
        }
      }

      return res.status(200).json({ ok: true, count: results.length, results });

    } catch (fatal) {
      console.error('[parse-cv] fatal handler error:', fatal);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Server error: ' + fatal.message });
      }
    }
  });
};
