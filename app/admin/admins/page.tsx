'use client';

import { useEffect, useState } from 'react';
import { FiKey, FiPlus, FiPower, FiUserCheck } from 'react-icons/fi';
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

  const load = async () => {
    const [adminRows, branchRows] = await Promise.all([api.get('/branches/admins/all'), api.get('/branches')]);
    setAdmins(adminRows.data);
    setBranches(branchRows.data);
  };
  useEffect(() => { load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
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

  return <RequireRole role="super_admin">
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-navy-800/60">Assign one or more admins to a branch. Each admin can manage only that branch.</p>
        <button onClick={() => { setError(''); setForm({...form, branch: branches.find((b) => b.isActive)?._id || ''}); setOpen(true); }} className="btn-primary flex shrink-0 items-center gap-2"><FiPlus /> Add Admin</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[700px]">
          <thead><tr><th>Admin</th><th>Username</th><th>Branch</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{admins.map((admin) => <tr key={admin._id}>
            <td className="font-semibold">{admin.displayName}</td><td>{admin.username}</td>
            <td>{admin.branch ? `${admin.branch.name} (${admin.branch.code})` : 'Not assigned'}</td>
            <td><span className={`pill ${admin.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>{admin.isActive ? 'Active' : 'Inactive'}</span></td>
            <td><div className="flex gap-3"><button title="Reset password" onClick={() => setResetTarget(admin)} className="text-amber-600"><FiKey /></button><button title="Change status" onClick={() => toggle(admin)} className="text-navy-700"><FiPower /></button></div></td>
          </tr>)}
          {!admins.length && <tr><td colSpan={5} className="py-8 text-center text-navy-800/50"><FiUserCheck className="mx-auto mb-2 text-2xl" />No branch admins.</td></tr>}</tbody>
        </table>
      </div>
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
