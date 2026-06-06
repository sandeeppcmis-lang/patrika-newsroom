import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import {
  CheckCircle2, AlertTriangle, Clock, TrendingUp, Download,
  RefreshCw, Loader2, ChevronLeft, ChevronRight, AlarmClock,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { PageHeader, SectionCard, Badge } from '../components/UI.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

function fmtTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtSched(t) {
  if (!t) return '—';
  return t.slice(0, 5); // "22:30"
}

function delayColor(status) {
  if (status === 'ontime') return '#10b981';
  if (status === 'warn')   return '#C9A227';
  return '#d71920';
}

function StatusBadge({ status }) {
  const tone  = status === 'ontime' ? 'active' : status === 'warn' ? 'med' : 'high';
  const label = status === 'ontime' ? 'On Time' : status === 'warn' ? 'Warn' : 'Late';
  return <Badge tone={tone}>{label}</Badge>;
}

// Summary tile
function Tile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <span className="inline-flex rounded-lg p-2 mt-0.5" style={{ background: color + '20', color }}>
        <Icon size={18} />
      </span>
      <div>
        <div className="text-2xl font-bold" style={{ fontFamily: 'Georgia,serif' }}>{value}</div>
        <div className="text-xs font-medium">{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// Custom bar tooltip
function DelayTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border p-3 text-xs shadow-lg" style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 200 }}>
      <div className="font-bold mb-1">{d.edition_name}</div>
      <div style={{ color: 'var(--muted)' }}>{d.unit} {d.district ? `· ${d.district}` : ''}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span style={{ color: 'var(--muted)' }}>Scheduled</span><span className="font-mono">{fmtSched(d.schedule_time)}</span>
        <span style={{ color: 'var(--muted)' }}>Released</span><span className="font-mono">{fmtTime(d.release_time)}</span>
        <span style={{ color: 'var(--muted)' }}>Delay</span>
        <span className="font-bold" style={{ color: delayColor(d.status) }}>{d.delay_hhmm}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Production() {
  const { t } = useApp();
  const [date,    setDate]    = useState(today());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [region,  setRegion]  = useState('ALL'); // ALL | RAJ | MPCG
  const [search,  setSearch]  = useState('');

  const load = (d) => {
    setLoading(true);
    api.production(d)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(date); }, [date]);

  const shiftDate = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(d.toISOString().slice(0, 10));
  };

  // Filter by region + search
  const editions = useMemo(() => {
    if (!data?.editions) return [];
    return data.editions.filter(e => {
      if (region !== 'ALL' && e.region !== region) return false;
      if (search) {
        const q = search.toLowerCase();
        return (e.edition_name || '').toLowerCase().includes(q) ||
               (e.unit         || '').toLowerCase().includes(q) ||
               (e.district     || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, region, search]);

  // For chart — top 30 by delay (most delayed first), sort ascending for display
  const chartData = useMemo(() =>
    [...editions]
      .sort((a, b) => b.delay_minutes - a.delay_minutes)
      .slice(0, 40)
      .reverse(),
  [editions]);

  // Region-filtered summary
  const summary = useMemo(() => {
    const total    = editions.length;
    const onTime   = editions.filter(e => e.status === 'ontime').length;
    const delayed  = editions.filter(e => e.status !== 'ontime').length;
    const delays   = editions.map(e => e.delay_minutes).filter(d => d > 0);
    const avgDelay = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
    const maxDelay = delays.length ? Math.max(...delays) : 0;
    const fmt = (m) => {
      const h = Math.floor(m / 60), mn = m % 60;
      return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
    };
    return { total, onTime, delayed, avgDelay: fmt(avgDelay), maxDelay: fmt(maxDelay) };
  }, [editions]);

  const downloadExcel = () => {
    const rows = editions.map(e => ({
      'Edition':      e.edition_name,
      'Type':         e.edition_type,
      'Unit':         e.unit,
      'District':     e.district,
      'State/Region': e.region,
      'Scheduled':    fmtSched(e.schedule_time),
      'Released':     fmtTime(e.release_time),
      'Delay (hh:mm)': e.delay_hhmm,
      'Status':       e.status === 'ontime' ? 'On Time' : e.status === 'warn' ? 'Warning' : 'Late',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production');
    XLSX.writeFile(wb, `production_${date}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        title={t('nav.production')}
        subtitle="Branch-wise edition release · schedule vs actual · delay monitoring"
      />

      {/* ── Date nav + region filter ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Date stepper */}
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDate(-1)} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
          <input
            type="date" value={date} max={today()}
            onChange={e => setDate(e.target.value)}
            className="input py-1.5 text-sm font-semibold"
          />
          <button onClick={() => shiftDate(1)} className="btn-ghost p-1.5" disabled={date >= today()}><ChevronRight size={16} /></button>
        </div>

        {/* Region tabs */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {[['ALL','All'], ['RAJ','Rajasthan'], ['MPCG','MP / CG']].map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setRegion(val)}
              className="px-3 py-1.5 text-sm font-medium transition"
              style={{
                background: region === val ? 'var(--brand)' : 'var(--surface)',
                color:      region === val ? '#fff' : 'var(--text)',
              }}
            >{lbl}</button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text" placeholder="Search edition / unit…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="input py-1.5 text-sm flex-1 min-w-[160px]"
        />

        <button onClick={() => load(date)} className="btn-ghost p-1.5" title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={downloadExcel} className="btn-ghost flex items-center gap-1.5 text-sm" disabled={!editions.length}>
          <Download size={14} /> Excel
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2" style={{ color: 'var(--muted)' }}>
          <Loader2 size={20} className="animate-spin" /> Loading production data…
        </div>
      ) : !editions.length ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2" style={{ color: 'var(--muted)' }}>
          <AlarmClock size={32} />
          <p className="text-sm">No edition data found for <strong>{date}</strong></p>
          <p className="text-xs">Try selecting a different date or check that GMG files were uploaded.</p>
        </div>
      ) : (
        <>
          {/* ── Summary tiles ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 mb-5">
            <Tile icon={TrendingUp}   label="Total Editions" value={summary.total}    color="#3b82f6" />
            <Tile icon={CheckCircle2} label="On Time"        value={summary.onTime}   color="#10b981" sub={`${Math.round(summary.onTime/summary.total*100)}%`} />
            <Tile icon={AlertTriangle}label="Delayed"        value={summary.delayed}  color="#d71920" sub={`${Math.round(summary.delayed/summary.total*100)}%`} />
            <Tile icon={Clock}        label="Avg Delay"      value={summary.avgDelay} color="#C9A227" sub="hh:mm" />
            <Tile icon={AlarmClock}   label="Max Delay"      value={summary.maxDelay} color="#8b5cf6" sub="hh:mm" />
          </div>

          {/* ── Delay bar chart ───────────────────────────────────────────── */}
          <SectionCard title={`Edition Delay (hh:mm) — ${chartData.length} editions`} className="mb-5">
            <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 22)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 60, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number" stroke="var(--muted)" fontSize={11}
                  tickFormatter={v => {
                    const abs = Math.abs(v), h = Math.floor(abs/60), m = abs%60;
                    return `${v<0?'-':''}${h}:${String(m).padStart(2,'0')}`;
                  }}
                />
                <YAxis
                  type="category" dataKey="unit" width={90}
                  stroke="var(--muted)" fontSize={10} tick={{ fontSize: 10 }}
                />
                <Tooltip content={<DelayTooltip />} />
                <ReferenceLine x={0} stroke="var(--border)" strokeWidth={2} />
                <Bar dataKey="delay_minutes" radius={[0, 4, 4, 0]} barSize={16}
                  label={{ position: 'right', fontSize: 10, formatter: (v) => {
                    const abs = Math.abs(v), h = Math.floor(abs/60), m = abs%60;
                    return v === 0 ? '' : `${v<0?'-':''}${h}:${String(m).padStart(2,'0')}`;
                  }}}
                >
                  {chartData.map((e, i) => (
                    <Cell key={i} fill={delayColor(e.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#10b981' }} />On Time (≤ 0 min)</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#C9A227' }} />Warning (1–30 min)</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#d71920' }} />Late (&gt; 30 min)</span>
            </div>
          </SectionCard>

          {/* ── Detail table ──────────────────────────────────────────────── */}
          <SectionCard title={`Edition Details (${editions.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: 'var(--muted)' }}>
                    <th className="p-2">Edition</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Unit</th>
                    <th className="p-2">District</th>
                    <th className="p-2">Region</th>
                    <th className="p-2 text-center">Scheduled</th>
                    <th className="p-2 text-center">Released</th>
                    <th className="p-2 text-center">Delay</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {editions.map((e, i) => (
                    <tr key={i}
                      className="border-t hover:bg-black/5 dark:hover:bg-white/5 transition"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="p-2 font-semibold whitespace-nowrap text-xs">{e.edition_name}</td>
                      <td className="p-2 text-xs" style={{ color: 'var(--muted)' }}>{e.edition_type}</td>
                      <td className="p-2 text-xs">{e.unit}</td>
                      <td className="p-2 text-xs">{e.district}</td>
                      <td className="p-2 text-xs">
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{ background: e.region === 'RAJ' ? '#3b82f620' : '#8b5cf620',
                                   color:      e.region === 'RAJ' ? '#3b82f6'   : '#8b5cf6' }}>
                          {e.region}
                        </span>
                      </td>
                      <td className="p-2 text-center font-mono text-xs">{fmtSched(e.schedule_time)}</td>
                      <td className="p-2 text-center font-mono text-xs">{fmtTime(e.release_time)}</td>
                      <td className="p-2 text-center">
                        <span className="font-bold font-mono text-xs"
                          style={{ color: delayColor(e.status) }}>
                          {e.delay_hhmm}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
