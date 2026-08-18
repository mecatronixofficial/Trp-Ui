'use client';

import { useEffect, useState } from 'react';
import { FiEdit2, FiGitBranch, FiKey, FiMapPin, FiPhone, FiPlus, FiPower, FiTrash2, FiUser, FiUsers } from 'react-icons/fi';
import Modal from '../../../components/Modal';
import RequireRole from '../../../components/RequireRole';
import api from '../../../lib/api';

type Branch = {
  _id: string;
  name: string;
  code: string;
  address?: string;
  phoneNumber?: string;
  isActive: boolean;
  admin?: { id?: string; _id?: string; username: string; displayName: string; isActive: boolean } | null;
};

const emptyForm = {
  name: '', code: '', address: '', phoneNumber: '', adminName: '', adminUsername: '', adminPassword: '',
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [resetTarget, setResetTarget] = useState<Branch | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setBranches((await api.get('/branches')).data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true);
  };
  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setForm({ name: branch.name, address: branch.address || '', phoneNumber: branch.phoneNumber || '' });
    setError(''); setModalOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
    const nameChanged = !editing || text(form.name) !== text(editing.name);
    const phoneChanged = !editing || phone(form.phoneNumber) !== phone(editing.phoneNumber);
    const duplicate = branches.find((branch) => branch._id !== editing?._id && (
      (nameChanged && text(branch.name) === text(form.name)) ||
      (form.code && text(branch.code) === text(form.code)) ||
      (phoneChanged && form.phoneNumber && phone(branch.phoneNumber) === phone(form.phoneNumber)) ||
      (form.adminUsername && text(branch.admin?.username) === text(form.adminUsername))
    ));
    if (duplicate) { setError('Branch name, code, phone number, and admin username must be unique.'); return; }
    try {
      if (editing) await api.patch(`/branches/${editing._id}`, form);
      else await api.post('/branches', form);
      setModalOpen(false); await load();
    } catch (err: any) { setError(err?.response?.data?.message || 'Could not save branch'); }
  };
  const toggle = async (branch: Branch) => {
    await api.patch(`/branches/${branch._id}`, { isActive: !branch.isActive }); await load();
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(''); setDeleting(true);
    try {
      await api.delete(`/branches/${deleteTarget._id}`);
      setDeleteTarget(null); await load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Could not delete branch');
    } finally { setDeleting(false); }
  };
  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    setError('');
    try {
      const adminId = resetTarget.admin?.id || resetTarget.admin?._id;
      if (!adminId) throw new Error('This branch does not have an administrator account.');
      await api.patch(`/branches/admins/${adminId}/reset-password`, { newPassword });
      setResetTarget(null); setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not reset the password.');
    }
  };

  const activeBranches = branches.filter((branch) => branch.isActive);
  const inactiveBranches = branches.filter((branch) => !branch.isActive);

  const branchCard = (branch: Branch) => (
    <article key={branch._id} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500">
            <FiGitBranch />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-navy-900">{branch.name}</h3>
            <span className="text-xs font-semibold tracking-wide text-slate-500">{branch.code}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold ${branch.isActive ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
          {branch.isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      <div className="my-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
        <div className="flex items-start gap-3 text-slate-600"><FiMapPin className="mt-0.5 shrink-0 text-slate-400" /><span className="line-clamp-2">{branch.address || 'Address not added'}</span></div>
        <div className="flex items-center gap-3 text-slate-600"><FiPhone className="shrink-0 text-slate-400" /><span>{branch.phoneNumber || 'Phone not added'}</span></div>
        <div className="flex items-start gap-3 text-slate-600">
          <FiUser className="mt-0.5 shrink-0 text-slate-400" />
          <div><p className="font-semibold text-navy-900">{branch.admin?.displayName || 'Admin not assigned'}</p>{branch.admin?.username && <p className="text-xs text-slate-400">@{branch.admin.username}</p>}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button title="Edit branch" onClick={() => openEdit(branch)} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-slate-50"><FiEdit2 /> Edit</button>
        <button title="Reset admin password" onClick={() => { setError(''); setResetTarget(branch); }} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-slate-50"><FiKey /> Password</button>
        <button title={branch.isActive ? 'Deactivate branch' : 'Activate branch'} onClick={() => toggle(branch)} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-slate-50"><FiPower /> {branch.isActive ? 'Disable' : 'Enable'}</button>
        <button
          title={branch.isActive ? 'Deactivate the branch first to delete it' : 'Delete branch'}
          disabled={branch.isActive}
          onClick={() => { setDeleteError(''); setDeleteTarget(branch); }}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        ><FiTrash2 /> Delete</button>
      </div>
    </article>
  );

  return (
    <RequireRole role="super_admin">
      <div className="space-y-7">
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Branch network</p>
            <h2 className="mt-1 text-xl font-bold text-navy-900">Manage every location</h2>
            <p className="mt-1 text-sm text-slate-500">Independent admins, drivers and contact details in one place.</p>
          </div>
          <button onClick={openCreate} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-navy-800"><FiPlus /> Add New Branch</button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total branches</p><p className="mt-2 text-2xl font-bold text-navy-900">{branches.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active branches</p><p className="mt-2 text-2xl font-bold text-navy-900">{activeBranches.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Inactive branches</p><p className="mt-2 text-2xl font-bold text-navy-900">{inactiveBranches.length}</p></div>
        </div>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading branches...</div> : branches.length ? <>
          <section>
            <div className="mb-4 flex items-center gap-3"><h2 className="font-bold text-navy-900">Active Branches</h2><span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">{activeBranches.length}</span></div>
            {activeBranches.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeBranches.map(branchCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No active branches.</div>}
          </section>
          <section>
            <div className="mb-4 flex items-center gap-3"><h2 className="font-bold text-navy-900">Inactive Branches</h2><span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">{inactiveBranches.length}</span></div>
            {inactiveBranches.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{inactiveBranches.map(branchCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No inactive branches.</div>}
          </section>
        </> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500"><FiGitBranch className="mx-auto mb-3 text-3xl text-slate-400" /><p className="font-semibold text-navy-900">No branches yet</p><p className="mt-1 text-sm">Add your first branch to start building the network.</p></div>}

        {modalOpen && <Modal title={editing ? 'Edit Branch' : 'Create Branch & Admin'} onClose={() => setModalOpen(false)}>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label-text">Branch Name</label><input required className="input-field" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
              {!editing && <div><label className="label-text">Branch Code</label><input required className="input-field uppercase" placeholder="TIR-01" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} /></div>}
            </div>
            <div><label className="label-text">Address</label><textarea className="input-field" rows={2} value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} /></div>
            <div><label className="label-text">Phone Number</label><input className="input-field" value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value})} /></div>
            {!editing && <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold text-navy-900"><FiUsers /> Branch Admin Login</p>
              <div className="space-y-3">
                <input required className="input-field bg-white" placeholder="Admin name" value={form.adminName} onChange={(e) => setForm({...form, adminName: e.target.value})} />
                <input required className="input-field bg-white" placeholder="Admin username" value={form.adminUsername} onChange={(e) => setForm({...form, adminUsername: e.target.value})} />
                <input required minLength={6} type="password" className="input-field bg-white" placeholder="Temporary password" value={form.adminPassword} onChange={(e) => setForm({...form, adminPassword: e.target.value})} />
              </div>
            </div>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button className="btn-primary w-full">{editing ? 'Save Branch' : 'Create Branch & Admin'}</button>
          </form>
        </Modal>}

        {resetTarget && <Modal title={`Reset Admin: ${resetTarget.name}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={resetPassword} className="space-y-3">
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <input required minLength={6} type="password" className="input-field" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button className="btn-primary w-full">Reset Admin Password</button>
          </form>
        </Modal>}

        {deleteTarget && <Modal title={`Delete Branch: ${deleteTarget.name}`} onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              This permanently removes <strong>{deleteTarget.name}</strong> ({deleteTarget.code}) and its admin login. This cannot be undone.
            </p>
            {deleteError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{deleteError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Delete Branch'}
              </button>
            </div>
          </div>
        </Modal>}
      </div>
    </RequireRole>
  );
}
