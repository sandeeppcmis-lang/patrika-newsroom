/**
 * GET  /api/production/weekly-appreciation
 *   Returns preview of which branches / editions would receive appreciation
 *   for a given week. Useful for admin review before Monday.
 *   Query params:
 *     endDate  YYYY-MM-DD  (default: last Sunday)
 *
 * POST /api/production/weekly-appreciation
 *   Manually triggers the appreciation Telegram messages.
 *   Body: { endDate?: 'YYYY-MM-DD' }
 */

const { requireRole }            = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');
const { runWeeklyAppreciation }  = require('../cron/weekly-appreciation');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const { authError } = requireRole(req, ['Admin', 'State Head']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // ── GET — preview which branches / editions qualify ────────────────────────
  if (req.method === 'GET') {
    const endDate = req.query.endDate || null;
    try {
      // Re-use the same logic — skipped flag won't fire because GET just previews
      const { fetchOnTimeByBranch, previousWeekRange } = require('../cron/weekly-appreciation');
      // Note: we call internal helpers via the exported runWeeklyAppreciation in dry-run mode
      // Simpler: just return the result of runWeeklyAppreciation in dry mode
      // Actually we expose byBranch via a separate helper below
      const result = await previewAppreciation(endDate);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — send now ────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const endDate = req.body?.endDate || null;
    try {
      const result = await runWeeklyAppreciation(endDate);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// ── Preview helper (dry run — no Telegram send) ───────────────────────────────
const { query }       = require('../_lib/mysql');
const HIDDEN_EDITIONS = ['nt jaipur city', 'nt jaipur dak'];
const isHidden = name  => HIDDEN_EDITIONS.includes((name || '').toLowerCase().trim());

function pickReleaseTime(allTimesStr, schedMs) {
  if (!allTimesStr) return null;
  const parts = String(allTimesStr).split('|').map(s => s.trim()).filter(Boolean);
  for (const t of parts) {
    const ms = new Date(t).getTime();
    if (isNaN(ms)) continue;
    if (Math.round((ms - schedMs) / 60000) < 240) return { ms, time: t };
  }
  const last = parts[parts.length - 1];
  return last ? { ms: new Date(last).getTime(), time: last } : null;
}

function fmtDelay(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs  = Math.abs(Math.round(minutes));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const RELEASES_SQL = (tbl, region) => `
  SELECT
    DATE_FORMAT(STR_TO_DATE(LEFT(input_file, 8), '%d%m%Y'), '%Y-%m-%d')  AS pub_date,
    UPPER(SUBSTRING_INDEX(SUBSTRING_INDEX(input_file, '-', 2), '-', -1)) AS code,
    MAX(date_time_pdf)                                                    AS release_time,
    GROUP_CONCAT(DISTINCT date_time_pdf ORDER BY date_time_pdf DESC SEPARATOR '|')
                                                                          AS all_release_times,
    '${region}'                                                           AS region
  FROM \`${tbl}\`
  WHERE input_file REGEXP '^[0-9]{8}-'
    AND date_time_pdf IS NOT NULL
    AND STR_TO_DATE(LEFT(input_file, 8), '%d%m%Y') BETWEEN ? AND ?
  GROUP BY pub_date, code
`;

async function previewAppreciation(endDateOverride) {
  let end;
  if (endDateOverride) {
    end = new Date(endDateOverride + 'T12:00:00');
  } else {
    end = new Date();
    end.setDate(end.getDate() - 1);
  }
  const start    = new Date(end);
  start.setDate(start.getDate() - 6);
  const startDate = start.toISOString().slice(0, 10);
  const endDate   = end.toISOString().slice(0, 10);

  const [rajRows, mpcgRows] = await Promise.all([
    query(RELEASES_SQL('gmg_raj',  'RAJ'),  [startDate, endDate]).catch(() => []),
    query(RELEASES_SQL('gmg_mpcg', 'MPCG'), [startDate, endDate]).catch(() => []),
  ]);
  const releases = [...rajRows, ...mpcgRows];

  const schedRows = await query(
    `SELECT UPPER(file_name) AS code, state, unit, edition_name, schedule_time
     FROM page_schedule_time`
  );
  const schedMap = {};
  schedRows.forEach(s => { schedMap[s.code] = s; });

  const editionAcc = {};
  releases.forEach(r => {
    const sched = schedMap[r.code];
    if (!sched) return;
    if (isHidden(sched.edition_name)) return;

    const pubDateStr = r.pub_date instanceof Date
      ? r.pub_date.toISOString().slice(0, 10)
      : String(r.pub_date).slice(0, 10);

    const [sh, sm]  = (sched.schedule_time || '00:00:00').split(':').map(Number);
    const schedDate = new Date(pubDateStr);
    if (sh >= 12) schedDate.setDate(schedDate.getDate() - 1);
    schedDate.setHours(sh, sm, 0, 0);
    const schedMs = schedDate.getTime();

    const maxMs   = new Date(r.release_time).getTime();
    let releaseMs = maxMs;
    if (Math.round((maxMs - schedMs) / 60000) >= 240) {
      const best = pickReleaseTime(r.all_release_times, schedMs);
      if (best && best.ms !== maxMs) releaseMs = best.ms;
    }

    const delay_minutes = Math.min(Math.round((releaseMs - schedMs) / 60000), 239);

    if (!editionAcc[r.code]) {
      editionAcc[r.code] = {
        edition_name: sched.edition_name || r.code,
        unit:         sched.unit         || r.code,
        state:        sched.state        || '',
        delays:       [],
      };
    }
    editionAcc[r.code].delays.push(delay_minutes);
  });

  const byBranch = {};
  Object.values(editionAcc).forEach(ed => {
    if (!ed.delays.length) return;
    const avg = Math.round(ed.delays.reduce((a, b) => a + b, 0) / ed.delays.length);
    if (avg > 0) return;

    if (!byBranch[ed.unit]) {
      byBranch[ed.unit] = { unit: ed.unit, state: ed.state, editions: [] };
    }
    byBranch[ed.unit].editions.push({
      edition_name: ed.edition_name,
      avg_delay:    avg,
      avg_hhmm:     fmtDelay(avg),
      data_days:    ed.delays.length,
    });
  });

  Object.values(byBranch).forEach(b => {
    b.editions.sort((a, c) => a.avg_delay - c.avg_delay);
  });

  return {
    startDate,
    endDate,
    branches: Object.values(byBranch).sort((a, b) => a.unit.localeCompare(b.unit)),
    total_branches: Object.keys(byBranch).length,
    total_editions: Object.values(byBranch).reduce((s, b) => s + b.editions.length, 0),
  };
}
