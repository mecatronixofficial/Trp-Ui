'use client';

import { useEffect, useState } from 'react';
import { FiEdit2, FiGitBranch, FiKey, FiPlus, FiPower, FiUsers } from 'react-icons/fi';
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
  admin?: { username: string; displayName: string; isActive: boolean } | null;
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
    await api.patch(`/branches/${resetTarget._id}/admin/reset-password`, { newPassword });
    setResetTarget(null); setNewPassword('');
  };

  return (
    <RequireRole role="super_admin">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-navy-800/60">Each branch has an independent admin and driver team.</p>
            <p className="mt-1 text-xs font-semibold text-iceblue-700">{branches.length} branch(es) configured</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2"><FiPlus /> Add Branch</button>
        </div>

        <div className="card overflow-x-auto">
          {loading ? <p className="text-navy-800/50">Loading branches...</p> : (
            <table className="table-base min-w-[850px]">
              <thead><tr><th>Branch</th><th>Code</th><th>Branch Admin</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch._id}>
                    <td><p className="font-semibold">{branch.name}</p><p className="text-xs text-navy-800/50">{branch.address || 'No address'}</p></td>
                    <td><span className="pill bg-iceblue-50 font-bold text-iceblue-700">{branch.code}</span></td>
                    <td><p className="font-medium">{branch.admin?.displayName || 'Not assigned'}</p><p className="text-xs text-navy-800/50">{branch.admin?.username}</p></td>
                    <td>{branch.phoneNumber || '-'}</td>
                    <td><span className={`pill ${branch.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>{branch.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td><div className="flex items-center gap-3">
                      <button title="Edit branch" onClick={() => openEdit(branch)} className="text-iceblue-600"><FiEdit2 /></button>
                      <button title="Reset admin password" onClick={() => setResetTarget(branch)} className="text-amber-600"><FiKey /></button>
                      <button title={branch.isActive ? 'Deactivate branch' : 'Activate branch'} onClick={() => toggle(branch)} className="text-navy-700"><FiPower /></button>
                    </div></td>
                  </tr>
                ))}
                {!branches.length && <tr><td colSpan={6} className="py-8 text-center text-navy-800/50"><FiGitBranch className="mx-auto mb-2 text-2xl" />No branches yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>

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
            <input required minLength={6} type="password" className="input-field" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button className="btn-primary w-full">Reset Admin Password</button>
          </form>
        </Modal>}
      </div>
    </RequireRole>
  );
}
