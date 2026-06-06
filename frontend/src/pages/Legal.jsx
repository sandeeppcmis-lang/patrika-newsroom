import { useEffect, useState } from 'react';
import { Gavel, CalendarClock, FileWarning, Plus, X, Save, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { PageHeader, SectionCard, Badge } from '../components/UI.jsx';

// ── Status and Risk options ───────────────────────────────────────────────────
const STATUS_OPTIONS = ['Active', 'Pending Docs', 'Adjourned', 'Disposed', 'Closed'];
const RISK_OPTIONS   = ['Low', 'Medium', 'High'];

// ── Blank case template ───────────────────────────────────────────────────────
const blankCase = () => ({
  case_no: '', state: '', branch: '', court: '', party: '',
  advocate: '', hearing: '', status: 'Active', risk: 'Low',
  documents: '', notes: '',
});

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Legal() {
  const { t, edition, canEditLegal } = useApp();
  const [cases,     setCases]     = useState([]);
  const [editing,   setEditing]   = useState(null);
  const [toast,     setToast]     = useState(null);
  const [deleting,  setDeleting]  = useState(null);
  const [locations, setLocations] = useState({ states: [], branchesByState: {} });

  // Load cases + locations on mount / edition change
  useEffect(() => {
    api.legalCases(edition).then(setCases);
    api.listLocations().then(setLocations);
  }, [edition]);

  // Show a temporary toast notification
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Save (create or update) a case
  const handleSave = async (caseData) => {
    try {
      const res = await api.saveLegalCase(caseData);
      if (res.ok) {
        setCases((prev) => {
          const idx = prev.findIndex((c) => c.case_no === caseData.case_no);
          if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], ...caseData }; return next; }
          return [{ ...caseData, id: Date.now() }, ...prev];
        });
        setEditing(null);
        showToast('ok', `Case ${caseData.case_no} ${res.action === 'created' ? 'added' : 'updated'} successfully.`);
      } else {
        showToast('err', res.error || 'Save failed.');
      }
    } catch (err) {
      showToast('err', err.message || 'Network error.');
    }
  };

  // Delete a case
  const handleDelete = async (id, caseNo) => {
    if (!window.confirm(`Delete case ${caseNo}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api.deleteLegalCase(id);
      setCases((prev) => prev.filter((c) => c.id !== id));
      showToast('ok', `Case ${caseNo} deleted.`);
    } catch (err) {
      showToast('err', 'Delete failed: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  // Stats
  const activeCases   = cases.filter((c) => c.status === 'Active').length;
  const upcomingCount = cases.filter((c) => {
    const diff = (new Date(c.hearing) - new Date()) / 864e5;
    return diff >= 0 && diff <= 7;
  }).length;
  const highRiskCount = cases.filter((c) => c.risk === 'High').length;

  return (
    <div>
      <PageHeader
        title={`${t('nav.legal')} · ${edition}`}
        subtitle="Case management · hearing reminders · AI priority prediction"
      >
        {canEditLegal() && (
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setEditing(blankCase())}>
            <Plus size={16} /> Add Case
          </button>
        )}
      </PageHeader>

      {/* ── Summary Tiles ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Tile icon={Gavel}        label="Active Cases"     value={activeCases}   accent="#3b82f6" />
        <Tile icon={CalendarClock} label="Hearings ≤7 days" value={upcomingCount} accent="#C9A227" />
        <Tile icon={FileWarning}  label="High Risk"        value={highRiskCount} accent="#d71920" />
      </div>

      {/* ── Toast notification ────────────────────────────────────────────── */}
      {toast && (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: toast.type === 'ok' ? '#d1fae5' : '#fee2e2', color: toast.type === 'ok' ? '#065f46' : '#991b1b' }}
        >
          {toast.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Cases Table ───────────────────────────────────────────────────── */}
      <SectionCard className="mt-4" title="Legal Cases">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--muted)' }}>
                <th className="p-2">Case No.</th>
                <th className="p-2">State</th>
                <th className="p-2">Branch</th>
                <th className="p-2">Edition</th>
                <th className="p-2">Court</th>
                <th className="p-2">Party</th>
                <th className="p-2">Hearing</th>
                <th className="p-2">Advocate</th>
                <th className="p-2">Status</th>
                <th className="p-2">Risk</th>
                {canEditLegal() && <th className="p-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 && (
                <tr>
                  <td colSpan={canEditLegal() ? 11 : 10} className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                    No cases found. {canEditLegal() ? 'Click "Add Case" to create one.' : ''}
                  </td>
                </tr>
              )}
              {cases.map((c) => (
                <tr key={c.case_no} className="border-t hover:bg-black/5 dark:hover:bg-white/5 transition" style={{ borderColor: 'var(--border)' }}>
                  <td className="p-2 font-mono text-xs font-semibold">{c.case_no}</td>
                  <td className="p-2">{c.state  || '—'}</td>
                  <td className="p-2">{c.branch || '—'}</td>
                  <td className="p-2">{c.edition}</td>
                  <td className="p-2">{c.court}</td>
                  <td className="p-2">{c.party}</td>
                  <td className="p-2 whitespace-nowrap">
                    {c.hearing && (
                      <>
                        {c.hearing}
                        {(() => {
                          const d = Math.ceil((new Date(c.hearing) - new Date()) / 864e5);
                          if (d >= 0 && d <= 7) return <span className="ml-1 text-xs font-semibold" style={{ color: '#d71920' }}>({d}d)</span>;
                          return null;
                        })()}
                      </>
                    )}
                  </td>
                  <td className="p-2">{c.advocate}</td>
                  <td className="p-2">
                    <Badge tone={c.status === 'Active' ? 'active' : c.status === 'Closed' || c.status === 'Disposed' ? 'low' : 'med'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Badge tone={c.risk === 'High' ? 'high' : c.risk === 'Medium' ? 'med' : 'low'}>
                      {c.risk}
                    </Badge>
                  </td>
                  {canEditLegal() && (
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs font-semibold hover:opacity-70 transition"
                          style={{ color: 'var(--brand)' }}
                          onClick={() => setEditing({ ...c })}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs font-semibold hover:opacity-70 transition"
                          style={{ color: '#d71920' }}
                          onClick={() => handleDelete(c.id, c.case_no)}
                          disabled={deleting === c.id}
                        >
                          {deleting === c.id ? <Loader2 size={13} className="animate-spin" /> : 'Delete'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
          Red badge on hearing date = hearing within 7 days. Cases are filtered by selected edition.
        </p>
      </SectionCard>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      {editing && (
        <CaseModal
          caseData={editing}
          locations={locations}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ── Tile ──────────────────────────────────────────────────────────────────────
function Tile({ icon: Icon, label, value, accent = '#3b82f6' }) {
  return (
    <div className="card p-4">
      <span className="rounded-lg p-1.5 inline-flex" style={{ background: accent + '1a', color: accent }}>
        <Icon size={16} />
      </span>
      <div className="mt-2 text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

// ── Case Add / Edit Modal ─────────────────────────────────────────────────────
function CaseModal({ caseData, locations, onClose, onSave }) {
  const [form,    setForm]    = useState({ ...caseData });
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState({});

  const { states = [], branchesByState = {} } = locations || {};
  const availBranches = form.state ? (branchesByState[form.state] || []) : [];

  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Reset branch when state changes
      if (k === 'state') next.branch = '';
      return next;
    });
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.case_no.trim())   e.case_no  = 'Required';
    if (!form.court.trim())     e.court    = 'Required';
    if (!form.party.trim())     e.party    = 'Required';
    if (!form.advocate.trim())  e.advocate = 'Required';
    if (!form.hearing)          e.hearing  = 'Required';
    if (!form.status)           e.status   = 'Required';
    if (!form.risk)             e.risk     = 'Required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const isEdit = !!caseData.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="card relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel size={18} style={{ color: 'var(--brand)' }} />
            <h3 className="text-lg font-bold">{isEdit ? 'Edit Case' : 'Add New Case'}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10 transition">
            <X size={20} />
          </button>
        </div>

        {/* ── Form Fields ── */}
        <div className="space-y-4">

          {/* Row 1: Case No. (full width) */}
          <Field label="Case No." error={errors.case_no} required>
            <input
              className="input w-full"
              placeholder="e.g. CIV/2025/118"
              value={form.case_no}
              onChange={(e) => set('case_no', e.target.value)}
              disabled={isEdit}
            />
          </Field>

          {/* Row 2: State | Branch */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="State">
              <select className="input w-full" value={form.state} onChange={(e) => set('state', e.target.value)}>
                <option value="">— Select State —</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select className="input w-full" value={form.branch} onChange={(e) => set('branch', e.target.value)} disabled={!form.state}>
                <option value="">— Select Branch —</option>
                {availBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 3: Court | Party / Opponent */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Court" error={errors.court} required>
              <input
                className="input w-full"
                placeholder="e.g. Rajasthan High Court"
                value={form.court}
                onChange={(e) => set('court', e.target.value)}
              />
            </Field>
            <Field label="Party / Opponent" error={errors.party} required>
              <input
                className="input w-full"
                placeholder="e.g. State vs Patrika"
                value={form.party}
                onChange={(e) => set('party', e.target.value)}
              />
            </Field>
          </div>

          {/* Row 4: Advocate | Hearing Date */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Advocate" error={errors.advocate} required>
              <input
                className="input w-full"
                placeholder="e.g. Adv. S. Mehta"
                value={form.advocate}
                onChange={(e) => set('advocate', e.target.value)}
              />
            </Field>
            <Field label="Next Hearing Date" error={errors.hearing} required>
              <input
                className="input w-full"
                type="date"
                value={form.hearing}
                onChange={(e) => set('hearing', e.target.value)}
              />
            </Field>
          </div>

          {/* Row 5: Status | Risk Level */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Status" error={errors.status} required>
              <select className="input w-full" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Risk Level" error={errors.risk} required>
              <select className="input w-full" value={form.risk} onChange={(e) => set('risk', e.target.value)}>
                {RISK_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r === 'High' ? '🔴' : r === 'Medium' ? '🟡' : '🟢'} {r}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Row 6: Documents (optional) */}
          <Field label="Documents / File Reference" hint="Optional — file path, URL, or reference number">
            <input
              className="input w-full"
              placeholder="e.g. /docs/CIV2025118.pdf or Google Drive link"
              value={form.documents}
              onChange={(e) => set('documents', e.target.value)}
            />
          </Field>

          {/* Row 7: Notes (optional, full width) */}
          <Field label="Notes" hint="Optional — additional remarks, hearing history, lawyer instructions">
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Add any internal notes about this case…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </div>

        {/* ── Footer Buttons ── */}
        <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Fields marked <span style={{ color: '#d71920' }}>*</span> are required
          </p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              className="btn-primary flex items-center gap-1.5"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : <><Save size={14} /> {isEdit ? 'Update Case' : 'Save Case'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field wrapper with label, error, hint ─────────────────────────────────────
function Field({ label, children, error, hint, required }) {
  return (
    <div>
      <label className="label mb-1 flex items-center gap-1">
        {label}
        {required && <span style={{ color: '#d71920' }}>*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs" style={{ color: '#d71920' }}>{error}</p>}
      {hint && !error && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  );
}
