'use client';

import { useEffect, useState } from 'react';
import { FiGitBranch, FiKey, FiPlus, FiPower, FiShield, FiUser, FiUserCheck } from 'react-icons/fi';
import Modal from '../../../components/Modal';
import RequireRole from '../../../components/RequireRole';
import api from '../../../lib/api';

type Branch = { _id: string; name: string; code: string; isActive: boolean };
type Admin = { _id: string; username: string; displayName: string; isActive: boolean; branch?: Branch };

export default function BranchAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [form, setForm] = useState({ branch: '', displayName: '', username: '', password: '' });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [adminRows, branchRows] = await Promise.all([api.get('/branches/admins/all'), api.get('/branches')]);
      setAdmins(adminRows.data);
      setBranches(branchRows.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    if (admins.some((admin) => text(admin.username) === text(form.username) || text(admin.displayName) === text(form.displayName))) {
      setError('Admin display name and username must be unique.');
      return;
    }
    try {
      await api.post(`/branches/${form.branch}/admins`, { displayName: form.displayName, username: form.username, password: form.password });
      setOpen(false); setForm({ branch: '', displayName: '', username: '', password: '' }); await load();
    } catch (err: any) { setError(err?.response?.data?.message || 'Could not create branch admin'); }
  };
  const toggle = async (admin: Admin) => {
    await api.patch(`/branches/admins/${admin._id}/status`, { isActive: !admin.isActive }); await load();
  };
  const reset = async (event: React.FormEvent) => {
    event.preventDefault(); if (!resetTarget) return;
    await api.patch(`/branches/admins/${resetTarget._id}/reset-password`, { newPassword });
    setResetTarget(null); setNewPassword('');
  };

  const activeAdmins = admins.filter((admin) => admin.isActive);
  const inactiveAdmins = admins.filter((admin) => !admin.isActive);

  const adminCard = (admin: Admin) => (
    <article key={admin._id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-iceblue-200 hover:shadow-lg">
      <div className={`h-1.5 ${admin.isActive ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${admin.isActive ? 'bg-iceblue-50 text-iceblue-700' : 'bg-slate-100 text-slate-500'}`}>
              <FiUserCheck className="text-xl" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-navy-900">{admin.displayName}</h3>
              <p className="mt-1 truncate text-xs font-semibold text-slate-400">@{admin.username}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${admin.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {admin.isActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>

        <div className="my-5 space-y-3 border-y border-slate-100 py-4 text-sm">
          <div className="flex items-center gap-3 text-slate-600"><FiGitBranch className="shrink-0 text-iceblue-500" /><div className="min-w-0"><p className="truncate font-semibold text-navy-900">{admin.branch?.name || 'Branch not assigned'}</p>{admin.branch?.code && <p className="text-xs text-slate-400">Branch code: {admin.branch.code}</p>}</div></div>
          <div className="flex items-center gap-3 text-slate-600"><FiShield className="shrink-0 text-iceblue-500" /><span>Branch administrator</span></div>
          <div className="flex items-center gap-3 text-slate-600"><FiUser className="shrink-0 text-iceblue-500" /><span className="truncate">Login ID: {admin.username}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button title="Reset password" onClick={() => { setError(''); setResetTarget(admin); }} className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100"><FiKey /> Reset Password</button>
          <button title={admin.isActive ? 'Deactivate admin' : 'Activate admin'} onClick={() => toggle(admin)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${admin.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}><FiPower /> {admin.isActive ? 'Disable' : 'Enable'}</button>
        </div>
      </div>
    </article>
  );

  return <RequireRole role="super_admin">
    <div className="space-y-7">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-navy-900 to-iceblue-800 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-iceblue-200">Administrator network</p>
          <h2 className="mt-2 text-2xl font-bold">Manage branch access</h2>
          <p className="mt-1 text-sm text-white/70">Assign secure administrator access to each branch location.</p>
        </div>
        <button onClick={() => { setError(''); setForm({ branch: branches.find((b) => b.isActive)?._id || '', displayName: '', username: '', password: '' }); setOpen(true); }} className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-navy-900 shadow-sm transition hover:bg-iceblue-50"><FiPlus /> Add New Admin</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total admins</p><p className="mt-2 text-3xl font-black text-navy-900">{admins.length}</p></div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active admins</p><p className="mt-2 text-3xl font-black text-emerald-700">{activeAdmins.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Inactive admins</p><p className="mt-2 text-3xl font-black text-slate-600">{inactiveAdmins.length}</p></div>
      </div>

      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading branch admins...</div> : admins.length ? <>
        <section>
          <div className="mb-4 flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-emerald-100" /><div><h2 className="font-bold text-navy-900">Active Administrators</h2><p className="text-xs text-slate-500">Accounts with current branch access</p></div><span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{activeAdmins.length}</span></div>
          {activeAdmins.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeAdmins.map(adminCard)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No active administrators.</div>}
        </section>
        <section>
          <div className="mb-4 flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-slate-400 ring-4 ring-slate-100" /><div><h2 className="font-bold text-navy-900">Inactive Administrators</h2><p className="text-xs text-slate-500">Disabled administrator accounts</p></div><span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{inactiveAdmins.length}</span></div>
          {inactiveAdmins.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{inactiveAdmins.map(adminCard)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No inactive administrators.</div>}
        </section>
      </> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500"><FiUserCheck className="mx-auto mb-3 text-3xl text-iceblue-500" /><p className="font-semibold text-navy-900">No branch administrators yet</p><p className="mt-1 text-sm">Add an administrator and assign them to an active branch.</p></div>}
      {open && <Modal title="Add Branch Admin" onClose={() => setOpen(false)}><form onSubmit={create} className="space-y-3">
        <div><label className="label-text">Branch</label><select required className="input-field" value={form.branch} onChange={(e) => setForm({...form, branch: e.target.value})}><option value="">Select branch</option>{branches.filter((b) => b.isActive).map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}</select></div>
        <div><label className="label-text">Admin Name</label><input required className="input-field" value={form.displayName} onChange={(e) => setForm({...form, displayName: e.target.value})} /></div>
        <div><label className="label-text">Username</label><input required className="input-field" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} /></div>
        <div><label className="label-text">Temporary Password</label><input required minLength={6} type="password" className="input-field" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} /></div>
        {error && <p className="text-sm text-red-500">{error}</p>}<button className="btn-primary w-full">Create Admin</button>
      </form></Modal>}
      {resetTarget && <Modal title={`Reset Password: ${resetTarget.displayName}`} onClose={() => setResetTarget(null)}><form onSubmit={reset} className="space-y-3"><input required minLength={6} type="password" className="input-field" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button className="btn-primary w-full">Reset Password</button></form></Modal>}
    </div>
  </RequireRole>;
}
