import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, Loader2, Users, Lock } from 'lucide-react';
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
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // null | 'add' | {user object for edit}
  const [deleting,  setDeleting]  = useState(null);
  const [locations, setLocations] = useState({ states: [], branchesByState: {} });

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

  return (
    <SectionCard
      title={`User Management (${users.length})`}
      action={
        <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={14} /> Add User
        </button>
      }
    >
      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        Manage who can access the system and what they can see. State Head is locked to their state; Regional Editor is locked to their state + branch.
      </p>

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
                <th className="p-2">Username</th>
                <th className="p-2">Role</th>
                <th className="p-2">State</th>
                <th className="p-2">Branch</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center" style={{ color: 'var(--muted)' }}>No users found.</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="border-t hover:bg-black/5 dark:hover:bg-white/5 transition" style={{ borderColor: 'var(--border)' }}>
                  <td className="p-2 font-semibold">{u.name}</td>
                  <td className="p-2 font-mono text-xs">{u.username}</td>
                  <td className="p-2"><Badge tone={ROLE_BADGE[u.role] || 'med'}>{u.role}</Badge></td>
                  <td className="p-2">
                    {u.state ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Lock size={10} style={{ color: 'var(--muted)' }} /> {u.state}
                      </span>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td className="p-2">
                    {u.branch ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Lock size={10} style={{ color: 'var(--muted)' }} /> {u.branch}
                      </span>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setModal(u)}
                        className="text-xs font-medium hover:opacity-70"
                        style={{ color: 'var(--brand)' }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deleting === u.id}
                        className="text-xs hover:opacity-70"
                        style={{ color: '#d71920' }}
                      >
                        {deleting === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
    name:     editUser?.name     || '',
    username: editUser?.username || '',
    password: '',
    role:     editUser?.role     || 'Regional Editor',
    state:    editUser?.state    || '',
    branch:   editUser?.branch   || '',
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
        name:   form.name,
        username: form.username,
        role:   form.role,
        state:  form.state  || null,
        branch: form.branch || null,
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
