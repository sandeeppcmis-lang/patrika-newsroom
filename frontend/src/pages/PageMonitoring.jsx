import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Newspaper, CheckSquare, MapPin, TrendingUp, Camera, AlertTriangle,
  Loader2, RefreshCw, ChevronLeft, ChevronRight, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { PageHeader, SectionCard, Badge } from '../components/UI.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const today     = () => new Date().toISOString().slice(0, 10);
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };

const CHART_COLORS = ['#d71920','#C9A227','#3b82f6','#10b981','#8b5cf6','#f97316','#06b6d4','#ec4899','#84cc16','#a78bfa'];

const SEV_COLORS = { high: '#d71920', medium: '#C9A227', low: '#10b981' };

const MARKER_COLORS = {
  'Reporting':          '#3b82f6',
  'Coverage':           '#10b981',
  'Meeting':            '#C9A227',
  'Event':              '#f97316',
  'Special Reporting':  '#8b5cf6',
};
function markerColor(remark) {
  for (const [key, col] of Object.entries(MARKER_COLORS)) {
    if ((remark || '').toLowerCase().includes(key.toLowerCase())) return col;
  }
  return '#6b7280';
}

// ── Tile ──────────────────────────────────────────────────────────────────────
function Tile({ icon: Icon, label, value, sub, color = '#3b82f6' }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <span className="inline-flex rounded-lg p-2 mt-0.5" style={{ background: color + '20', color }}>
        <Icon size={18} />
      </span>
      <div>
        <div className="text-2xl font-bold" style={{ fontFamily: 'Georgia,serif' }}>{value ?? '—'}</div>
        <div className="text-xs font-medium">{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',       icon: TrendingUp  },
  { id: 'news',      label: 'News Categories', icon: Newspaper   },
  { id: 'qc',        label: 'QC Review',       icon: CheckSquare },
  { id: 'visits',    label: 'Field Visits',    icon: MapPin      },
];

// ── OverviewTab ───────────────────────────────────────────────────────────────
function OverviewTab({ data }) {
  const { news, qc, visits } = data;
  const ns = news.summary;
  const qs = qc.summary;
  const vs = visits.summary;

  // Top 5 categories for mini-pie
  const topCats = [...news.categories].slice(0, 6);

  return (
    <div className="space-y-5">
      {/* News KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>News Published</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile icon={Newspaper}     label="Reporters"  value={ns.reporters} color="#3b82f6" />
          <Tile icon={TrendingUp}    label="Stories"    value={ns.stories}   color="#10b981" />
          <Tile icon={TrendingUp}    label="Words"      value={ns.words?.toLocaleString()} color="#8b5cf6" />
          <Tile icon={Camera}        label="Photos"     value={ns.photos}    color="#C9A227" />
          <Tile icon={Newspaper}     label="Exclusive"  value={ns.exclusive} color="#d71920" />
        </div>
      </div>

      {/* QC KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>QC Mistakes</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile icon={CheckSquare}   label="Checks Done"   value={qs.total}    color="#3b82f6" />
          <Tile icon={AlertTriangle} label="Total Mistakes" value={qs.mistakes} color="#d71920" />
          <Tile icon={AlertTriangle} label="High Severity"  value={qs.high}    color="#d71920" sub="High" />
          <Tile icon={AlertTriangle} label="Medium"         value={qs.medium}  color="#C9A227" sub="Medium" />
        </div>
      </div>

      {/* Visit KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Field Visits</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Tile icon={MapPin} label="Total Visits"    value={vs.total}    color="#10b981" />
          <Tile icon={MapPin} label="With GPS Location" value={vs.with_loc} color="#3b82f6" />
          <Tile icon={MapPin} label="Location Coverage" value={vs.total ? `${Math.round(vs.with_loc/vs.total*100)}%` : '—'} color="#8b5cf6" />
        </div>
      </div>

      {/* 7-day trend + category mini */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="7-Day Story Trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={news.trend} margin={{ left: -10, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickFormatter={d => d.slice(5)} />
              <YAxis stroke="var(--muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="stories"   stroke="#3b82f6" strokeWidth={2} dot={false} name="Stories" />
              <Line type="monotone" dataKey="exclusive" stroke="#d71920" strokeWidth={2} dot={false} name="Exclusive" />
              <Line type="monotone" dataKey="photos"    stroke="#C9A227" strokeWidth={1.5} dot={false} name="Photos" />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Top News Categories (Today)">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={topCats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {topCats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

// ── NewsTab ───────────────────────────────────────────────────────────────────
function NewsTab({ data }) {
  const { news } = data;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Category-wise Count (Today)">
          {news.categories.length === 0
            ? <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>No data for selected date.</p>
            : <ResponsiveContainer width="100%" height={Math.max(260, news.categories.length * 28)}>
                <BarChart data={news.categories} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted)" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} stroke="var(--muted)" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  <Bar dataKey="value" radius={[0,4,4,0]} barSize={14} label={{ position: 'right', fontSize: 10 }}>
                    {news.categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </SectionCard>

        <SectionCard title="Category Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={news.categories.slice(0,8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => percent > 0.04 ? `${(percent*100).toFixed(0)}%` : ''} labelLine={false} fontSize={10}>
                {news.categories.slice(0,8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard title="7-Day Stacked Story Trend">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={news.trend} margin={{ left: -10, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickFormatter={d => d.slice(5)} />
            <YAxis stroke="var(--muted)" fontSize={11} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="routine"     stackId="a" fill="#3b82f6" name="Routine" />
            <Bar dataKey="exclusive"   stackId="a" fill="#d71920" name="Exclusive" />
            <Bar dataKey="human_angle" stackId="a" fill="#10b981" name="Human Angle" />
            <Bar dataKey="datastory"   stackId="a" fill="#C9A227" name="Data Story" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* 7-day raw table */}
      <SectionCard title="7-Day Summary Table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--muted)' }}>
                <th className="p-2">Date</th>
                <th className="p-2 text-right">Stories</th>
                <th className="p-2 text-right">Words</th>
                <th className="p-2 text-right">Photos</th>
                <th className="p-2 text-right">Exclusive</th>
                <th className="p-2 text-right">Human Angle</th>
                <th className="p-2 text-right">Data Story</th>
              </tr>
            </thead>
            <tbody>
              {[...news.trend].reverse().map((r, i) => (
                <tr key={i} className="border-t hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
                  <td className="p-2 font-mono text-xs">{r.date}</td>
                  <td className="p-2 text-right font-semibold">{r.stories}</td>
                  <td className="p-2 text-right">{r.words?.toLocaleString()}</td>
                  <td className="p-2 text-right">{r.photos}</td>
                  <td className="p-2 text-right">{r.exclusive}</td>
                  <td className="p-2 text-right">{r.human_angle}</td>
                  <td className="p-2 text-right">{r.datastory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── QCTab ─────────────────────────────────────────────────────────────────────
function QCTab({ data }) {
  const { qc } = data;
  const [expanded, setExpanded] = useState(null);

  const sevData = ['high','medium','low']
    .filter(s => qc.summary[s] > 0)
    .map(s => ({ name: s.charAt(0).toUpperCase()+s.slice(1), value: qc.summary[s], color: SEV_COLORS[s] }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Severity breakdown */}
        <SectionCard title="Mistake Severity Distribution">
          {sevData.length === 0
            ? <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>No QC data for selected date.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                    {sevData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
          }
        </SectionCard>

        {/* By category */}
        <SectionCard title="QC Mistakes by Category">
          {qc.by_category.length === 0
            ? <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>No category data.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <BarChart data={qc.by_category.slice(0,8)} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted)" fontSize={11} />
                  <YAxis type="category" dataKey="category" width={90} stroke="var(--muted)" fontSize={9} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  <Bar dataKey="mistakes" fill="#d71920" radius={[0,4,4,0]} barSize={12}
                    label={{ position: 'right', fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
          }
        </SectionCard>
      </div>

      {/* Recent mistakes (7-day) */}
      <SectionCard title={`Recent QC Records (last 7 days · ${qc.recent.length} records)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ color: 'var(--muted)' }}>
                <th className="p-2">Date</th>
                <th className="p-2">Category</th>
                <th className="p-2">Severity</th>
                <th className="p-2">State</th>
                <th className="p-2">Edition</th>
                <th className="p-2">Pullout</th>
                <th className="p-2 text-right">Mistakes</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {qc.recent.map((r, i) => (
                <>
                  <tr key={r.id}
                    className="border-t hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => setExpanded(expanded === i ? null : i)}
                  >
                    <td className="p-2 font-mono">{r.date}</td>
                    <td className="p-2">{r.category}</td>
                    <td className="p-2">
                      {r.severity && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{ background: (SEV_COLORS[r.severity] || '#6b7280') + '20',
                                   color: SEV_COLORS[r.severity] || '#6b7280' }}>
                          {r.severity}
                        </span>
                      )}
                    </td>
                    <td className="p-2">{r.state}</td>
                    <td className="p-2">{r.edition}</td>
                    <td className="p-2">{r.pullout}</td>
                    <td className="p-2 text-right font-bold" style={{ color: '#d71920' }}>{r.mistakes}</td>
                    <td className="p-2">
                      <span style={{ color: 'var(--brand)', cursor: 'pointer', fontSize: 11 }}>
                        {expanded === i ? '▲ less' : '▼ more'}
                      </span>
                    </td>
                  </tr>
                  {expanded === i && (
                    <tr key={`${r.id}-exp`} className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                      <td colSpan={8} className="p-3">
                        <div className="flex gap-4 flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>Mistake Description</div>
                            <p className="text-sm">{r.mistake || '—'}</p>
                          </div>
                          {r.photo_url && (
                            <div>
                              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>Photo Evidence</div>
                              <img src={r.photo_url} alt="QC evidence" className="rounded-lg max-h-40 object-contain border"
                                style={{ borderColor: 'var(--border)' }} onError={e => e.target.style.display='none'} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {qc.recent.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-sm" style={{ color: 'var(--muted)' }}>No QC records in last 7 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── VisitsTab ─────────────────────────────────────────────────────────────────
function VisitsTab({ data }) {
  const { visits } = data;

  const remarkData = visits.by_remark;
  const transportData = visits.by_transport;
  const markers = visits.markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));

  // India center
  const center = [22.9, 78.7];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {/* By remark */}
        <SectionCard title="Visits by Type / Remark">
          {remarkData.length === 0
            ? <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>No visit data for selected date.</p>
            : <ResponsiveContainer width="100%" height={Math.max(220, remarkData.length * 30)}>
                <BarChart data={remarkData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted)" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} stroke="var(--muted)" fontSize={9} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0,4,4,0]} barSize={14}
                    label={{ position: 'right', fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
          }
        </SectionCard>

        {/* By transport */}
        <SectionCard title="Visits by Transport">
          {transportData.length === 0
            ? <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>No transport data.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={transportData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                    label={({ name, percent }) => percent > 0.05 ? `${name}: ${(percent*100).toFixed(0)}%` : ''}
                    labelLine={false} fontSize={10}>
                    {transportData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
          }
        </SectionCard>
      </div>

      {/* Map */}
      <SectionCard title={`Field Visit Map · ${markers.length} GPS locations`}>
        {markers.length === 0
          ? <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
              <MapPin size={32} />
              <p className="text-sm">No GPS-tagged visits for this date.</p>
            </div>
          : <>
              <div style={{ height: 480, borderRadius: 12, overflow: 'hidden' }}>
                <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {markers.map((m, i) => (
                    <CircleMarker
                      key={i}
                      center={[m.lat, m.lng]}
                      radius={7}
                      pathOptions={{
                        fillColor: markerColor(m.remark),
                        fillOpacity: 0.85,
                        color: '#fff',
                        weight: 1.5,
                      }}
                    >
                      <Popup>
                        <div style={{ minWidth: 160, fontSize: 12 }}>
                          <div className="font-bold mb-1">{m.label || m.location || 'Visit'}</div>
                          {m.location && <div style={{ color: '#666' }}>{m.location}</div>}
                          <div className="mt-1"><b>Remark:</b> {m.remark || '—'}</div>
                          <div><b>Transport:</b> {m.transport || '—'}</div>
                          <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                            {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                {Object.entries(MARKER_COLORS).map(([label, col]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: col }} />
                    {label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#6b7280' }} />
                  Other
                </span>
              </div>
            </>
        }
      </SectionCard>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PageMonitoring() {
  const { t, state: globalState, branch: globalBranch } = useApp();
  const [date,    setDate]    = useState(yesterday());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('overview');

  const load = (d, st, br) => {
    setLoading(true);
    api.pages(d, st, br)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(date, globalState, globalBranch); }, [date, globalState, globalBranch]);

  const shiftDate = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(d.toISOString().slice(0, 10));
  };

  const downloadExcel = () => {
    if (!data) return;
    const cats = data.news.categories.map(c => ({ Category: c.name, Count: c.value }));
    const qcRows = data.qc.recent.map(r => ({
      Date: r.date, Category: r.category, Severity: r.severity,
      State: r.state, Edition: r.edition, Pullout: r.pullout,
      Mistakes: r.mistakes, Description: r.mistake,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cats),   'News Categories');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qcRows), 'QC Review');
    XLSX.writeFile(wb, `page_monitoring_${date}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        title={t('nav.pages')}
        subtitle={`News categories · QC review · Field visits with GPS map${globalState !== 'All' ? ` · ${globalState}` : ''}${globalBranch !== 'All' ? ` › ${globalBranch}` : ''}`}
      />

      {/* ── Controls ─────────────────────────────────────────────────────── */}
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

        <button onClick={() => load(date, globalState, globalBranch)} className="btn-ghost p-1.5" title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={downloadExcel} className="btn-ghost flex items-center gap-1.5 text-sm" disabled={!data}>
          <Download size={14} /> Excel
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              background: tab === id ? 'var(--brand)' : 'var(--surface)',
              color:      tab === id ? '#fff'         : 'var(--text)',
              border:     `1px solid ${tab === id ? 'var(--brand)' : 'var(--border)'}`,
            }}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2" style={{ color: 'var(--muted)' }}>
          <Loader2 size={20} className="animate-spin" /> Loading page data…
        </div>
      ) : !data || (!data.news?.summary?.stories && !data.qc?.summary?.total && !data.visits?.summary?.total) ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2" style={{ color: 'var(--muted)' }}>
          <Newspaper size={32} />
          <p className="text-sm">No data found for <strong>{date}</strong></p>
          <p className="text-xs">Try selecting a different date.</p>
        </div>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab data={data} />}
          {tab === 'news'     && <NewsTab     data={data} />}
          {tab === 'qc'       && <QCTab       data={data} />}
          {tab === 'visits'   && <VisitsTab   data={data} />}
        </>
      )}
    </div>
  );
}
