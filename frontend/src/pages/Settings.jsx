import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, Loader2, Users, Lock, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { useApp, ROLES } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { PageHeader, SectionCard, Badge } from '../components/UI.jsx';

const ROLE_BADGE = {
  'Admin':           'high',
  'State Head':      'med',
  'Regional Editor': 'active',
  'Legal':           'low',
};

// Which roles need a state / branch assignment
const NEEDS_STATE  = ['State Head', 'Regional Editor'];
const NEEDS_BRANCH = ['Regional Editor'];

export default function Settings() {
  const { t, theme, setTheme, lang, setLang, user, isAdmin } = useApp();

  return (
    <div>
      <PageHeader title={t('nav.settings')} subtitle="Preferences · account · user management" />
      <div className="space-y-4">

        {/* ── Appearance + Account ─────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Appearance">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <div className="flex gap-2">
                  {['light', 'dark'].map((m) => (
                    <button key={m} className={theme === m ? 'btn-primary px-3 py-1.5' : 'btn-ghost px-3 py-1.5'} onClick={() => setTheme(m)}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Language</span>
                <div className="flex gap-2">
                  {[['en', 'English'], ['hi', 'हिंदी']].map(([code, lbl]) => (
                    <button key={code} className={lang === code ? 'btn-primary px-3 py-1.5' : 'btn-ghost px-3 py-1.5'} onClick={() => setLang(code)}>{lbl}</button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="My Account">
            <div className="space-y-2 text-sm">
              <Row label="Name"   value={user?.name} />
              <Row label="Role"   value={<Badge tone={ROLE_BADGE[user?.role] || 'med'}>{user?.role}</Badge>} />
              {user?.state  && <Row label="State"  value={user.state} />}
              {user?.branch && <Row label="Branch" value={user.branch} />}
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
              To change your password or role, contact the Admin.
            </p>
          </SectionCard>
        </div>

        {/* ── User Management — Admin only ─────────────────────────────── */}
        {isAdmin() && <UserManagement />}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Management (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
function UserManagement() {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null); // null | 'add' | {user object}
  const [deleting,   setDeleting]   = useState(null);
  const [toggling,   setToggling]   = useState(null);
  const [syncing,    setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [locations,  setLocations]  = useState({ states: [], branchesByState: {} });
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | inactive

  const load = () => {
    setLoading(true);
    api.listUsers().then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.listLocations().then(setLocations).catch(() => {});
  }, []);

  const handleSave = async (data, id) => {
    if (id) {
      const updated = await api.updateUser(id, data);
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
    } else {
      const created = await api.createUser(data);
      setUsers(prev => [...prev, created]);
    }
    setModal(null);
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete user "${u.name}" (${u.username})? This cannot be undone.`)) return;
    setDeleting(u.id);
    try {
      await api.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e) { alert('Error: ' + e.message); }
    setDeleting(null);
  };

  const toggleActive = async (u) => {
    setToggling(u.id);
    try {
      const updated = await api.updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch (e) { alert('Error: ' + e.message); }
    setToggling(null);
  };

  const handleSync = async () => {
    if (!confirm('Sync will create/update login accounts for all State Head and RE employees from the HR table. Continue?')) return;
    setSyncing(true); setSyncResult(null);
    try {
      const result = await api.syncUsers();
      setSyncResult(result);
      load(); // refresh list
    } catch (e) {
      setSyncResult({ ok: false, error: e.message });
    }
    setSyncing(false);
  };

  const displayed = users.filter(u => {
    if (filterStatus === 'active')   return u.is_active !== 0;
    if (filterStatus === 'inactive') return u.is_active === 0;
    return true;
  });

  const activeCount   = users.filter(u => u.is_active !== 0).length;
  const inactiveCount = users.filter(u => u.is_active === 0).length;

  return (
    <SectionCard
      title={`User Management (${users.length})`}
      action={
        <div className="flex items-center gap-2">
          {/* Sync from HR button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition"
            style={{ background: '#6366f1', color: '#fff', opacity: syncing ? 0.7 : 1 }}
            title="Sync State Head & RE accounts from HR employee table"
          >
            {syncing
              ? <><Loader2 size={13} className="animate-spin" /> Syncing…</>
              : <><RefreshCw size={13} /> Sync from HR</>}
          </button>
          <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Add User
          </button>
        </div>
      }
    >
      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        Manage who can access the system. State Head → locked to their state; Regional Editor → locked to state + branch.
        <br />Username = PAN No · Default password = PAN No (user should change after first login).
      </p>

      {/* Sync result banner */}
      {syncResult && (
        <div className="mb-3 rounded-xl p-3 text-sm"
          style={{
            background: syncResult.error ? '#d7192015' : '#10b98115',
            border:     `1px solid ${syncResult.error ? '#d7192030' : '#10b98130'}`,
          }}>
          {syncResult.error
            ? <p style={{ color: '#d71920' }}>❌ Sync error: {syncResult.error}</p>
            : <p style={{ color: '#10b981' }}>
                ✅ Sync complete — <strong>{syncResult.total}</strong> employees processed:&nbsp;
                <strong>{syncResult.created}</strong> created,&nbsp;
                <strong>{syncResult.updated}</strong> updated
              </p>
          }
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-3">
        {[
          ['all',      `All (${users.length})`],
          ['active',   `Active (${activeCount})`],
          ['inactive', `Inactive (${inactiveCount})`],
        ].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilterStatus(val)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition"
            style={{
              background: filterStatus === val ? 'var(--brand)' : 'var(--bg)',
              color:      filterStatus === val ? '#fff' : 'var(--muted)',
            }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--muted)' }}>
          <Loader2 size={16} className="animate-spin" /> Loading users…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--muted)' }}>
                <th className="p-2">Name</th>
                <th className="p-2">Username (PAN)</th>
                <th className="p-2">Role</th>
                <th className="p-2">State</th>
                <th className="p-2">Branch</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center" style={{ color: 'var(--muted)' }}>No users found.</td></tr>
              )}
              {displayed.map(u => {
                const isActive = u.is_active !== 0;
                return (
                  <tr key={u.id}
                    className="border-t hover:bg-black/5 transition"
                    style={{
                      borderColor: 'var(--border)',
                      opacity: isActive ? 1 : 0.55,
                    }}>
                    <td className="p-2 font-semibold">{u.name}</td>
                    <td className="p-2 font-mono text-xs">{u.username}</td>
                    <td className="p-2"><Badge tone={ROLE_BADGE[u.role] || 'med'}>{u.role}</Badge></td>
                    <td className="p-2">
                      {u.state
                        ? <span className="flex items-center gap-1 text-xs"><Lock size={10} style={{ color: 'var(--muted)' }} />{u.state}</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="p-2">
                      {u.branch
                        ? <span className="flex items-center gap-1 text-xs"><Lock size={10} style={{ color: 'var(--muted)' }} />{u.branch}</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={toggling === u.id}
                        title={isActive ? 'Click to deactivate' : 'Click to activate'}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition"
                        style={{
                          background: isActive ? '#10b98120' : '#d7192015',
                          color:      isActive ? '#10b981'   : '#d71920',
                          cursor: 'pointer',
                        }}>
                        {toggling === u.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : isActive
                            ? <><UserCheck size={11} /> Active</>
                            : <><UserX    size={11} /> Inactive</>}
                      </button>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setModal(u)} className="hover:opacity-70" style={{ color: 'var(--brand)' }}>
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={deleting === u.id}
                          className="hover:opacity-70"
                          style={{ color: '#d71920' }}>
                          {deleting === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <UserModal
          user={modal === 'add' ? null : modal}
          locations={locations}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </SectionCard>
  );
}

function UserModal({ user: editUser, locations, onClose, onSave }) {
  const isEdit = !!editUser;
  const [form,   setForm]   = useState({
    name:      editUser?.name      || '',
    username:  editUser?.username  || '',
    password:  '',
    role:      editUser?.role      || 'Regional Editor',
    state:     editUser?.state     || '',
    branch:    editUser?.branch    || '',
    is_active: editUser?.is_active !== 0,  // true = active
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const { states = [], branchesByState = {} } = locations || {};
  const availBranches = form.state ? (branchesByState[form.state] || []) : [];

  const needsState  = NEEDS_STATE.includes(form.role);
  const needsBranch = NEEDS_BRANCH.includes(form.role);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'role')  { next.state = ''; next.branch = ''; }
      if (k === 'state') { next.branch = ''; }
      return next;
    });
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim())     return setError('Name is required');
    if (!form.username.trim()) return setError('Username is required');
    if (!isEdit && !form.password) return setError('Password is required for new users');
    if (needsState  && !form.state)  return setError('State is required for this role');
    if (needsBranch && !form.branch) return setError('Branch is required for this role');

    setSaving(true);
    try {
      const payload = {
        name:      form.name,
        username:  form.username,
        role:      form.role,
        state:     form.state  || null,
        branch:    form.branch || null,
        is_active: form.is_active ? 1 : 0,
      };
      if (form.password) payload.password = form.password;
      await onSave(payload, editUser?.id);
    } catch (e) {
      setError(e.message || 'Save failed');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="card relative z-10 w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users size={18} /> {isEdit ? 'Edit User' : 'Add User'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10"><X size={20} /></button>
        </div>

        <div className="space-y-3">

          {/* Name + Username */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1">Full Name *</label>
              <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Raj Sharma" />
            </div>
            <div>
              <label className="label mb-1">Username *</label>
              <input className="input w-full" value={form.username} onChange={e => set('username', e.target.value)} placeholder="e.g. r.sharma" disabled={isEdit} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="label mb-1">Password {isEdit ? '(leave blank to keep current)' : '*'}</label>
            <input className="input w-full" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </div>

          {/* Role */}
          <div>
            <label className="label mb-1">Role *</label>
            <select className="input w-full" value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {form.role === 'Admin'           && 'Full access — can see and edit everything across all states.'}
              {form.role === 'State Head'      && 'Locked to their state — can see/edit all data within that state.'}
              {form.role === 'Regional Editor' && 'Locked to their state + branch — can see/edit only their edition.'}
              {form.role === 'Legal'           && 'Access to Legal menu only.'}
            </p>
          </div>

          {/* Assigned State — always visible, required for State Head / Regional Editor */}
          <div>
            <label className="label mb-1">
              Assigned State {needsState && <span style={{ color: '#d71920' }}>*</span>}
            </label>
            <select
              className="input w-full"
              value={form.state}
              onChange={e => set('state', e.target.value)}
            >
              <option value="">— Select State —</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Assigned Branch — always visible, required for Regional Editor */}
          <div>
            <label className="label mb-1">
              Assigned Branch {needsBranch && <span style={{ color: '#d71920' }}>*</span>}
            </label>
            <select
              className="input w-full"
              value={form.branch}
              onChange={e => set('branch', e.target.value)}
              disabled={!form.state}
            >
              <option value="">— Select Branch —</option>
              {availBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {!form.state && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Select a state first</p>
            )}
          </div>

          {/* Account Status */}
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div>
              <div className="text-sm font-medium">Account Status</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {form.is_active ? 'Active — user can log in' : 'Inactive — login blocked'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition"
              style={{
                background: form.is_active ? '#10b98120' : '#d7192015',
                color:      form.is_active ? '#10b981'   : '#d71920',
              }}>
              {form.is_active
                ? <><UserCheck size={13} /> Active</>
                : <><UserX    size={13} /> Inactive</>}
            </button>
          </div>

          {error && <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#d71920', background: '#d7192015' }}>{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary flex items-center gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> {isEdit ? 'Update' : 'Create User'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
