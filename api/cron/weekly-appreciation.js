/**
 * CRON: Weekly Appreciation Alert — every Monday 9:00 AM IST.
 *
 * Checks the previous Mon–Sun window. For every edition whose
 * avg delay over those 7 days is <= 0 (on-time or early), sends a
 * Telegram appreciation message to the branch's Desk Head & RE.
 *
 * Manual trigger: POST /api/production/weekly-appreciation
 *   Body: { endDate?: 'YYYY-MM-DD' }  (defaults to last Sunday)
 */

const cron            = require('node-cron');
const { query }       = require('../_lib/mysql');
const { sendMessage } = require('../_lib/telegram');

// ── Hidden editions (same list as production.js / weekly-trend.js) ────────────
const HIDDEN_EDITIONS = ['nt jaipur city', 'nt jaipur dak'];
const isHidden = name => HIDDEN_EDITIONS.includes((name || '').toLowerCase().trim());

// ── Release SQL — identical to weekly-trend.js ────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function fmtDateIndia(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// Returns previous Mon-Sun window.
// When called on Monday: endDate = yesterday (Sunday), startDate = 6 days earlier (Monday).
// If endDateOverride is given, that date is used as Sunday.
function previousWeekRange(endDateOverride) {
  let end;
  if (endDateOverride) {
    end = new Date(endDateOverride + 'T12:00:00');
  } else {
    end = new Date();
    end.setDate(end.getDate() - 1); // yesterday = Sunday when run on Monday
  }
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // 7-day window, Mon to Sun
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate:   end.toISOString().slice(0, 10),
  };
}

// ── Core: compute avg delay per edition, group on-time ones by branch ─────────
async function fetchOnTimeByBranch(startDate, endDate) {
  const [rajRows, mpcgRows] = await Promise.all([
    query(RELEASES_SQL('gmg_raj',  'RAJ'),  [startDate, endDate]).catch(() => []),
    query(RELEASES_SQL('gmg_mpcg', 'MPCG'), [startDate, endDate]).catch(() => []),
  ]);
  const releases = [...rajRows, ...mpcgRows];
  if (!releases.length) return {};

  const schedRows = await query(
    `SELECT UPPER(file_name) AS code, state, unit, edition_name, schedule_time
     FROM page_schedule_time`
  );
  const schedMap = {};
  schedRows.forEach(s => { schedMap[s.code] = s; });

  // Accumulate per-edition delay values across all days in the window
  const editionAcc = {}; // code -> { meta, delays[] }

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

  // Filter editions whose avg_delay <= 0, then group by branch
  const byBranch = {};
  Object.values(editionAcc).forEach(ed => {
    if (!ed.delays.length) return;
    const avg = Math.round(ed.delays.reduce((a, b) => a + b, 0) / ed.delays.length);
    if (avg > 0) return; // late on average — skip

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

  // Sort each branch's editions: most-early first
  Object.values(byBranch).forEach(b => {
    b.editions.sort((a, c) => a.avg_delay - c.avg_delay);
  });

  return byBranch;
}

// ── Fetch Telegram recipients (Desk Head + RE) for a branch ──────────────────
async function getRecipients(branch) {
  return query(
    `SELECT EMPNAME, Story_Type, Branch, State, telegram_chat_id
     FROM \`user\`
     WHERE Branch = ?
       AND telegram_chat_id IS NOT NULL AND telegram_chat_id != ''
       AND (is_emp_working = 1 OR Status IN ('Working','Active'))
       AND Story_Type IN ('Desk Head', 'RE')`,
    [branch]
  ).catch(() => []);
}

// ── Build Telegram appreciation message ───────────────────────────────────────
function buildMessage(branch, state, editions, startDate, endDate) {
  const weekStr = `${fmtDateIndia(startDate)} - ${fmtDateIndia(endDate)}`;
  const lines   = [];

  lines.push('🏆 <b>Weekly Excellence Report</b>');
  lines.push(`📍 Branch: <b>${branch}</b>  |  ${state}`);
  lines.push(`📅 Week: ${weekStr}`);
  lines.push('');
  lines.push(`✅ <b>On-Time Editions (${editions.length}):</b>`);

  editions.forEach(e => {
    const tag = e.avg_delay < 0
      ? `avg <b>${e.avg_hhmm}</b>  🚀 Early`
      : `avg <b>On Time</b>  ✅`;
    lines.push(`📰 ${e.edition_name}  —  ${tag}  (${e.data_days} days)`);
  });

  lines.push('');
  lines.push('⭐ <b>Congratulations!</b>');
  lines.push('Your on-time delivery this week reflects great commitment and teamwork. 👏');
  lines.push('Keep up the excellent work!');
  lines.push('');
  lines.push('<i>Weekly Excellence Report  ·  Patrika Newsroom  ·  Monday 9:00 AM</i>');

  return lines.join('\n');
}

// ── Main job function ─────────────────────────────────────────────────────────
async function runWeeklyAppreciation(endDateOverride) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[weekly-appreciation] TELEGRAM_BOT_TOKEN not set — skipping');
    return { skipped: true, reason: 'no token' };
  }

  const { startDate, endDate } = previousWeekRange(endDateOverride || null);
  console.log(`[weekly-appreciation] Checking week ${startDate} to ${endDate}`);

  let byBranch;
  try {
    byBranch = await fetchOnTimeByBranch(startDate, endDate);
  } catch (err) {
    console.error('[weekly-appreciation] DB error:', err.message);
    return { error: err.message };
  }

  const goodBranches = Object.values(byBranch);
  const results = {
    startDate,
    endDate,
    sent:         [],
    failed:       [],
    noRecipients: [],
    noOnTime:     goodBranches.length === 0,
  };

  if (!goodBranches.length) {
    console.log('[weekly-appreciation] No on-time editions found for this week');
    return results;
  }

  console.log(`[weekly-appreciation] ${goodBranches.length} branches with on-time editions`);

  for (const b of goodBranches) {
    const recipients = await getRecipients(b.unit);
    if (!recipients.length) {
      results.noRecipients.push(b.unit);
      console.log(`[weekly-appreciation] ${b.unit} — no Telegram recipients configured`);
      continue;
    }

    const text = buildMessage(b.unit, b.state, b.editions, startDate, endDate);

    for (const person of recipients) {
      try {
        const tgRes = await sendMessage(person.telegram_chat_id, text);
        if (tgRes.ok) {
          console.log(`[weekly-appreciation] OK sent to ${person.EMPNAME} (${b.unit})`);
          results.sent.push({
            branch:  b.unit,
            name:    person.EMPNAME,
            chat_id: person.telegram_chat_id,
          });
        } else {
          throw new Error(tgRes.description || 'Telegram error');
        }
      } catch (err) {
        console.error(`[weekly-appreciation] FAIL ${person.EMPNAME} (${b.unit}): ${err.message}`);
        results.failed.push({ branch: b.unit, name: person.EMPNAME, error: err.message });
      }
    }
  }

  return results;
}

// ── Register cron — every Monday 9:00 AM IST ─────────────────────────────────
function register() {
  // '0 9 * * 1' = 09:00 on Monday in Asia/Kolkata
  cron.schedule('0 9 * * 1', async () => {
    console.log('[weekly-appreciation] Monday 9:00 AM — sending weekly appreciation…');
    try {
      const res = await runWeeklyAppreciation();
      console.log('[weekly-appreciation] Done:', JSON.stringify(res));
    } catch (err) {
      console.error('[weekly-appreciation] Cron error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[weekly-appreciation] Scheduled: every Monday 9:00 AM IST');
}

module.exports = { register, runWeeklyAppreciation };
