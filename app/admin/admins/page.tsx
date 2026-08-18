'use client';

import { useEffect, useState } from 'react';
import { FiGitBranch, FiKey, FiPlus, FiPower, FiShield, FiTrash2, FiUser, FiUserCheck } from 'react-icons/fi';
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
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

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
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(''); setDeleting(true);
    try {
      await api.delete(`/branches/admins/${deleteTarget._id}`);
      setDeleteTarget(null); await load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Could not delete admin');
    } finally { setDeleting(false); }
  };

  const activeAdmins = admins.filter((admin) => admin.isActive);
  const inactiveAdmins = admins.filter((admin) => !admin.isActive);

  const adminCard = (admin: Admin) => (
    <article key={admin._id} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500">
            <FiUserCheck />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-navy-900">{admin.displayName}</h3>
            <p className="truncate text-xs font-semibold text-slate-400">@{admin.username}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold ${admin.isActive ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
          {admin.isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      <div className="my-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
        <div className="flex items-center gap-3 text-slate-600"><FiGitBranch className="shrink-0 text-slate-400" /><div className="min-w-0"><p className="truncate font-semibold text-navy-900">{admin.branch?.name || 'Branch not assigned'}</p>{admin.branch?.code && <p className="text-xs text-slate-400">Branch code: {admin.branch.code}</p>}</div></div>
        <div className="flex items-center gap-3 text-slate-600"><FiShield className="shrink-0 text-slate-400" /><span>Branch administrator</span></div>
        <div className="flex items-center gap-3 text-slate-600"><FiUser className="shrink-0 text-slate-400" /><span className="truncate">Login ID: {admin.username}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button title="Reset password" onClick={() => { setError(''); setResetTarget(admin); }} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-slate-50"><FiKey /> Reset Password</button>
        <button title={admin.isActive ? 'Deactivate admin' : 'Activate admin'} onClick={() => toggle(admin)} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-slate-50"><FiPower /> {admin.isActive ? 'Disable' : 'Enable'}</button>
        <button
          title={admin.isActive ? 'Deactivate the admin first to delete it' : 'Delete admin'}
          disabled={admin.isActive}
          onClick={() => { setDeleteError(''); setDeleteTarget(admin); }}
          className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        ><FiTrash2 /> Delete</button>
      </div>
    </article>
  );

  return <RequireRole role="super_admin">
    <div className="space-y-7">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Administrator network</p>
          <h2 className="mt-1 text-xl font-bold text-navy-900">Manage branch access</h2>
          <p className="mt-1 text-sm text-slate-500">Assign secure administrator access to each branch location.</p>
        </div>
        <button onClick={() => { setError(''); setForm({ branch: branches.find((b) => b.isActive)?._id || '', displayName: '', username: '', password: '' }); setOpen(true); }} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-navy-800"><FiPlus /> Add New Admin</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total admins</p><p className="mt-2 text-2xl font-bold text-navy-900">{admins.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active admins</p><p className="mt-2 text-2xl font-bold text-navy-900">{activeAdmins.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Inactive admins</p><p className="mt-2 text-2xl font-bold text-navy-900">{inactiveAdmins.length}</p></div>
      </div>

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading branch admins...</div> : admins.length ? <>
        <section>
          <div className="mb-4 flex items-center gap-3"><h2 className="font-bold text-navy-900">Active Administrators</h2><span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">{activeAdmins.length}</span></div>
          {activeAdmins.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeAdmins.map(adminCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No active administrators.</div>}
        </section>
        <section>
          <div className="mb-4 flex items-center gap-3"><h2 className="font-bold text-navy-900">Inactive Administrators</h2><span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">{inactiveAdmins.length}</span></div>
          {inactiveAdmins.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{inactiveAdmins.map(adminCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No inactive administrators.</div>}
        </section>
      </> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500"><FiUserCheck className="mx-auto mb-3 text-3xl text-slate-400" /><p className="font-semibold text-navy-900">No branch administrators yet</p><p className="mt-1 text-sm">Add an administrator and assign them to an active branch.</p></div>}
      {open && <Modal title="Add Branch Admin" onClose={() => setOpen(false)}><form onSubmit={create} className="space-y-3">
        <div><label className="label-text">Branch</label><select required className="input-field" value={form.branch} onChange={(e) => setForm({...form, branch: e.target.value})}><option value="">Select branch</option>{branches.filter((b) => b.isActive).map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}</select></div>
        <div><label className="label-text">Admin Name</label><input required className="input-field" value={form.displayName} onChange={(e) => setForm({...form, displayName: e.target.value})} /></div>
        <div><label className="label-text">Username</label><input required className="input-field" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} /></div>
        <div><label className="label-text">Temporary Password</label><input required minLength={6} type="password" className="input-field" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} /></div>
        {error && <p className="text-sm text-red-500">{error}</p>}<button className="btn-primary w-full">Create Admin</button>
      </form></Modal>}
      {resetTarget && <Modal title={`Reset Password: ${resetTarget.displayName}`} onClose={() => setResetTarget(null)}><form onSubmit={reset} className="space-y-3"><input required minLength={6} type="password" className="input-field" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button className="btn-primary w-full">Reset Password</button></form></Modal>}
      {deleteTarget && <Modal title={`Delete Admin: ${deleteTarget.displayName}`} onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            This permanently removes the login for <strong>{deleteTarget.displayName}</strong> (@{deleteTarget.username}). This cannot be undone.
          </p>
          {deleteError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{deleteError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
              {deleting ? 'Deleting...' : 'Delete Admin'}
            </button>
          </div>
        </div>
      </Modal>}
    </div>
  </RequireRole>;
}
