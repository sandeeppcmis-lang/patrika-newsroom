/**
 * HR Admin Stats — MySQL only
 * GET /api/hr/admin-stats  — aggregated retirement, age, profile data
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { requireRole }            = require('../_lib/auth');
const { query }                  = require('../_lib/mysql');

const TABLE = process.env.MYSQL_TABLE_EMPLOYEES || 'user';

function calcAge(dob) {
  if (!dob) return null;
  const parts = String(dob).split('-');
  let d;
  if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
  else                        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function retireDate(dob) {
  if (!dob) return null;
  const parts = String(dob).split('-');
  let d;
  if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
  else                        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  if (isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 60);
  return d;
}

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError } = requireRole(req, ['Admin', 'HR', 'Management', 'State Head', 'Regional Editor']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  try {
    const emps = await query(
      `SELECT EMP_CODE, EMPNAME, emp_designation, Story_Type, emp_deptt, Branch, State,
              DOB, DOJ, gross_salary, is_emp_working, Status, pan_no
       FROM \`${TABLE}\` ORDER BY EMPNAME ASC`
    );

    const today   = new Date();
    // Active members only: is_emp_working=1 OR Status='Working'/'Active'
    const working = emps.filter(e => e.is_emp_working == 1 || e.Status === 'Working' || e.Status === 'Active');
    const inactive = emps.filter(e => !(e.is_emp_working == 1 || e.Status === 'Working' || e.Status === 'Active'));

    // Retirement buckets
    const retBuckets = { overdue: [], within1yr: [], yr1to3: [], yr3to5: [], beyond5: [] };
    working.forEach(e => {
      const rd = retireDate(e.DOB);
      if (!rd) return;
      const diffYrs = (rd - today) / (1000 * 60 * 60 * 24 * 365.25);
      const age     = calcAge(e.DOB);
      const item    = { ...e, age, retireOn: rd.toISOString().split('T')[0] };
      if      (diffYrs < 0)  retBuckets.overdue.push(item);
      else if (diffYrs <= 1) retBuckets.within1yr.push(item);
      else if (diffYrs <= 3) retBuckets.yr1to3.push(item);
      else if (diffYrs <= 5) retBuckets.yr3to5.push(item);
      else                   retBuckets.beyond5.push(item);
    });

    // Age distribution
    const ageDist = { '20-29': 0, '30-39': 0, '40-49': 0, '50-59': 0, '60+': 0 };
    working.forEach(e => {
      const a = calcAge(e.DOB);
      if (!a) return;
      if      (a < 30) ageDist['20-29']++;
      else if (a < 40) ageDist['30-39']++;
      else if (a < 50) ageDist['40-49']++;
      else if (a < 60) ageDist['50-59']++;
      else             ageDist['60+']++;
    });

    // Profile-wise count from Story_Type (active members only)
    const profileMap = {};
    working.forEach(e => {
      const p = (e.Story_Type || '').trim() || 'Unknown';
      if (!profileMap[p]) profileMap[p] = { profile: p, available: 0, totalSalary: 0 };
      profileMap[p].available++;
      profileMap[p].totalSalary += Number(e.gross_salary || 0);
    });

    // Fetch sanctioned posts from MySQL
    let sanctioned = [];
    try {
      sanctioned = await query('SELECT * FROM hr_sanctioned_posts');
    } catch (_) { /* table may not exist yet */ }

    const profiles = Object.values(profileMap).map(p => {
      const s = sanctioned.find(sp => sp.profile === p.profile);
      return {
        ...p,
        avgSalary:      p.available ? Math.round(p.totalSalary / p.available) : 0,
        sanctionedCount: s ? s.sanctioned_count : null,
        vacant:          s ? Math.max(0, s.sanctioned_count - p.available) : null,
      };
    }).sort((a, b) => b.available - a.available);

    // Sanctioned-only profiles with 0 available
    sanctioned.forEach(s => {
      if (!profiles.find(p => p.profile === s.profile)) {
        profiles.push({ profile: s.profile, available: 0, avgSalary: s.min_salary || 0, totalSalary: 0, sanctionedCount: s.sanctioned_count, vacant: s.sanctioned_count });
      }
    });

    return res.json({
      totalWorking:  working.length,
      totalInactive: inactive.length,
      total:         emps.length,
      retBuckets,
      ageDist: Object.entries(ageDist).map(([range, count]) => ({ range, count })),
      profiles,
      inactive: inactive.map(e => ({ ...e, age: calcAge(e.DOB) })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
