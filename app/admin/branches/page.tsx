'use client';

import { useEffect, useState } from 'react';
import { FiEdit2, FiGitBranch, FiKey, FiMapPin, FiPhone, FiPlus, FiPower, FiUser, FiUsers } from 'react-icons/fi';
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
    <article key={branch._id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-iceblue-200 hover:shadow-lg">
      <div className={`h-1.5 ${branch.isActive ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${branch.isActive ? 'bg-iceblue-50 text-iceblue-700' : 'bg-slate-100 text-slate-500'}`}>
              <FiGitBranch className="text-xl" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-navy-900">{branch.name}</h3>
              <span className="mt-1 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-extrabold tracking-wider text-slate-600">{branch.code}</span>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${branch.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {branch.isActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>

        <div className="my-5 space-y-3 border-y border-slate-100 py-4 text-sm">
          <div className="flex items-start gap-3 text-slate-600"><FiMapPin className="mt-0.5 shrink-0 text-iceblue-500" /><span className="line-clamp-2">{branch.address || 'Address not added'}</span></div>
          <div className="flex items-center gap-3 text-slate-600"><FiPhone className="shrink-0 text-iceblue-500" /><span>{branch.phoneNumber || 'Phone not added'}</span></div>
          <div className="flex items-start gap-3 text-slate-600">
            <FiUser className="mt-0.5 shrink-0 text-iceblue-500" />
            <div><p className="font-semibold text-navy-900">{branch.admin?.displayName || 'Admin not assigned'}</p>{branch.admin?.username && <p className="text-xs text-slate-400">@{branch.admin.username}</p>}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button title="Edit branch" onClick={() => openEdit(branch)} className="flex items-center justify-center gap-2 rounded-xl bg-iceblue-50 px-3 py-2.5 text-xs font-bold text-iceblue-700 transition hover:bg-iceblue-100"><FiEdit2 /> Edit</button>
          <button title="Reset admin password" onClick={() => { setError(''); setResetTarget(branch); }} className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100"><FiKey /> Password</button>
          <button title={branch.isActive ? 'Deactivate branch' : 'Activate branch'} onClick={() => toggle(branch)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${branch.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}><FiPower /> {branch.isActive ? 'Disable' : 'Enable'}</button>
        </div>
      </div>
    </article>
  );

  return (
    <RequireRole role="super_admin">
      <div className="space-y-7">
        <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-navy-900 to-iceblue-800 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-iceblue-200">Branch network</p>
            <h2 className="mt-2 text-2xl font-bold">Manage every location</h2>
            <p className="mt-1 text-sm text-white/70">Independent admins, drivers and contact details in one place.</p>
          </div>
          <button onClick={openCreate} className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-navy-900 shadow-sm transition hover:bg-iceblue-50"><FiPlus /> Add New Branch</button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total branches</p><p className="mt-2 text-3xl font-black text-navy-900">{branches.length}</p></div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active branches</p><p className="mt-2 text-3xl font-black text-emerald-700">{activeBranches.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Inactive branches</p><p className="mt-2 text-3xl font-black text-slate-600">{inactiveBranches.length}</p></div>
        </div>

        {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading branches...</div> : branches.length ? <>
          <section>
            <div className="mb-4 flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-emerald-100" /><div><h2 className="font-bold text-navy-900">Active Branches</h2><p className="text-xs text-slate-500">Locations currently operating</p></div><span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{activeBranches.length}</span></div>
            {activeBranches.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeBranches.map(branchCard)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No active branches.</div>}
          </section>
          <section>
            <div className="mb-4 flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-slate-400 ring-4 ring-slate-100" /><div><h2 className="font-bold text-navy-900">Inactive Branches</h2><p className="text-xs text-slate-500">Paused or disabled locations</p></div><span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{inactiveBranches.length}</span></div>
            {inactiveBranches.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{inactiveBranches.map(branchCard)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No inactive branches.</div>}
          </section>
        </> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500"><FiGitBranch className="mx-auto mb-3 text-3xl text-iceblue-500" /><p className="font-semibold text-navy-900">No branches yet</p><p className="mt-1 text-sm">Add your first branch to start building the network.</p></div>}

        {modalOpen && <Modal title={editing ? 'Edit Branch' : 'Create Branch & Admin'} onClose={() => setModalOpen(false)}>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label-text">Branch Name</label><input required className="input-field" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
              {!editing && <div><label className="label-text">Branch Code</label><input required className="input-field uppercase" placeholder="TIR-01" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} /></div>}
            </div>
            <div><label className="label-text">Address</label><textarea className="input-field" rows={2} value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} /></div>
            <div><label className="label-text">Phone Number</label><input className="input-field" value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value})} /></div>
            {!editing && <div className="rounded-2xl border border-iceblue-100 bg-iceblue-50/60 p-4">
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
      </div>
    </RequireRole>
  );
}
