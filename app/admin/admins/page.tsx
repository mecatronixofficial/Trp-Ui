'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiGitBranch,
  FiGrid,
  FiKey,
  FiPlus,
  FiPower,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi';
import Modal from '../../../components/Modal';
import RequireRole from '../../../components/RequireRole';
import api from '../../../lib/api';

type Branch = { _id: string; name: string; code: string; isActive: boolean };
type Admin = { _id: string; username: string; displayName: string; isActive: boolean; branch?: Branch | null };
type AdminFilter = 'all' | 'active' | 'inactive';

const emptyForm = { displayName: '', username: '', password: '' };

export default function BranchAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AdminFilter>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [adminRows, branchRows] = await Promise.all([api.get('/branches/admins/all'), api.get('/branches')]);
      setAdmins(adminRows.data);
      setBranches(branchRows.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setError('');
    setForm(emptyForm);
    setOpen(true);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    if (admins.some((admin) => text(admin.username) === text(form.username) || text(admin.displayName) === text(form.displayName))) {
      setError('Admin display name and username must be unique.');
      return;
    }
    try {
      await api.post('/branches/admins', {
        displayName: form.displayName,
        username: form.username,
        password: form.password,
      });
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create administrator');
    }
  };

  const toggle = async (admin: Admin) => {
    await api.patch(`/branches/admins/${admin._id}/status`, { isActive: !admin.isActive });
    await load();
  };

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    setError('');
    try {
      await api.patch(`/branches/admins/${resetTarget._id}/reset-password`, { newPassword });
      setResetTarget(null);
      setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not reset the password');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await api.delete(`/branches/admins/${deleteTarget._id}`);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Could not delete admin');
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = admins.filter((admin) => admin.isActive).length;
  const inactiveCount = admins.length - activeCount;
  const accessCoverage = branches.length
    ? Math.round((new Set(admins.filter((admin) => admin.isActive && admin.branch?._id).map((admin) => admin.branch?._id)).size / branches.length) * 100)
    : 0;

  const visibleAdmins = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return admins.filter((admin) => {
      const matchesFilter = filter === 'all' || (filter === 'active' ? admin.isActive : !admin.isActive);
      const matchesSearch = !query || [
        admin.displayName,
        admin.username,
        admin.branch?.name,
        admin.branch?.code,
      ].some((value) => String(value || '').toLocaleLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [admins, filter, search]);

  const filterOptions: { value: AdminFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All admins', count: admins.length },
    { value: 'active', label: 'Active', count: activeCount },
    { value: 'inactive', label: 'Inactive', count: inactiveCount },
  ];

  const adminCard = (admin: Admin) => (
    <article
      key={admin._id}
      className="group relative flex min-h-[310px] flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)] transition duration-300 hover:-translate-y-1 hover:border-iceblue-200 hover:shadow-[0_24px_55px_-30px_rgba(28,166,209,0.42)]"
    >
      <div className={`h-1.5 w-full ${admin.isActive ? 'bg-gradient-to-r from-emerald-400 via-iceblue-400 to-cyan-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`} />

      <div className="flex items-start justify-between gap-4 px-5 pb-5 pt-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg shadow-sm ${admin.isActive ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-iceblue-100' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
            <FiUserCheck />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Administrator</p>
            <h3 className="truncate text-lg font-extrabold tracking-tight text-navy-900">{admin.displayName}</h3>
            <p className="truncate text-xs font-semibold text-slate-400">@{admin.username}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider ${admin.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${admin.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {admin.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mx-5 space-y-4 border-y border-slate-100 py-4 text-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400"><FiGitBranch size={14} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned branch</p>
            <p className="mt-0.5 truncate font-bold text-navy-900">{admin.branch?.name || 'Not assigned'}</p>
            {admin.branch?.code && <p className="text-xs text-slate-400">Branch code: {admin.branch.code}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400"><FiShield size={14} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Access level</p>
            <p className="mt-0.5 font-semibold text-slate-600">Branch administrator</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-white shadow-sm"><FiUser size={15} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Login identity</p>
          <p className="truncate text-sm font-bold text-navy-900">{admin.username}</p>
        </div>
        <span title={admin.branch?.isActive ? 'Branch active' : 'Branch inactive'} className={`h-2.5 w-2.5 rounded-full ring-4 ${admin.branch?.isActive ? 'bg-emerald-500 ring-emerald-50' : 'bg-slate-400 ring-slate-100'}`} />
      </div>

      <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/70">
        <button
          aria-label={`Reset password for ${admin.displayName}`}
          title="Reset password"
          onClick={() => { setError(''); setNewPassword(''); setResetTarget(admin); }}
          className="flex h-12 items-center justify-center gap-2 border-r border-slate-100 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-amber-600"
        ><FiKey /> <span className="hidden sm:inline">Password</span></button>
        <button
          aria-label={`${admin.isActive ? 'Deactivate' : 'Activate'} ${admin.displayName}`}
          title={admin.isActive ? 'Deactivate admin' : 'Activate admin'}
          onClick={() => toggle(admin)}
          className="flex h-12 items-center justify-center gap-2 border-r border-slate-100 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-emerald-600"
        ><FiPower /> <span className="hidden sm:inline">{admin.isActive ? 'Disable' : 'Enable'}</span></button>
        <button
          aria-label={`Delete ${admin.displayName}`}
          title={admin.branch ? 'Change the branch administrator first' : admin.isActive ? 'Deactivate the admin first to delete it' : 'Delete admin'}
          disabled={admin.isActive || Boolean(admin.branch)}
          onClick={() => { setDeleteError(''); setDeleteTarget(admin); }}
          className="flex h-12 items-center justify-center gap-2 text-xs font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
        ><FiTrash2 /> <span className="hidden sm:inline">Delete</span></button>
      </div>
    </article>
  );

  return (
    <RequireRole role="super_admin">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-6 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="absolute right-8 top-8 hidden h-28 w-28 rounded-full border border-white/10 lg:block" />
          <div className="absolute right-16 top-16 hidden h-20 w-20 rounded-full border border-white/10 lg:block" />

          <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-iceblue-100 backdrop-blur-sm">
                <FiShield /> Access network
              </div>
              <h1 className="max-w-xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">Every admin.<br className="hidden sm:block" /> One secure view.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Manage administrator identities, branch assignments, access status, and credentials across your distribution network.</p>
            </div>
            <button onClick={openCreate} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-navy-900 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-iceblue-50 sm:w-auto">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-iceblue-500 text-white transition group-hover:rotate-90"><FiPlus /></span>
              Create new admin
            </button>
          </div>

          <div className="relative mt-8 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm">
            <div className="px-3 py-4 sm:px-5">
              <p className="text-2xl font-black sm:text-3xl">{admins.length}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">Administrators</p>
            </div>
            <div className="border-x border-white/10 px-3 py-4 sm:px-5">
              <p className="text-2xl font-black text-emerald-300 sm:text-3xl">{activeCount}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">Active access</p>
            </div>
            <div className="px-3 py-4 sm:px-5">
              <p className="text-2xl font-black text-iceblue-300 sm:text-3xl">{accessCoverage}%</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">Branch coverage</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/80 bg-white/85 p-3 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search admin, username, branch or code..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-iceblue-300 focus:bg-white focus:ring-4 focus:ring-iceblue-100/60"
              />
            </div>
            <div className="scrollbar-hidden flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1.5">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition sm:px-4 ${filter === option.value ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900'}`}
                >
                  {option.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === option.value ? 'bg-iceblue-50 text-iceblue-700' : 'bg-slate-200 text-slate-500'}`}>{option.count}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><FiGrid /></div>
              <div>
                <h2 className="text-base font-extrabold text-navy-900">Administrator directory</h2>
                <p className="text-xs text-slate-500">{visibleAdmins.length} {visibleAdmins.length === 1 ? 'account' : 'accounts'} shown</p>
              </div>
            </div>
            {inactiveCount > 0 && <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-slate-400" />{inactiveCount} inactive</div>}
          </div>

          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-[310px] animate-pulse rounded-3xl border border-white bg-white/70 p-5"><div className="h-12 w-12 rounded-2xl bg-slate-100" /><div className="mt-7 h-4 w-2/3 rounded bg-slate-100" /><div className="mt-3 h-3 w-full rounded bg-slate-100" /><div className="mt-24 h-10 w-full rounded-xl bg-slate-100" /></div>)}
            </div>
          ) : visibleAdmins.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleAdmins.map(adminCard)}</div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-iceblue-200 bg-white/70 px-5 py-16 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-iceblue-50 text-2xl text-iceblue-600 ring-1 ring-iceblue-100">{admins.length ? <FiSearch /> : <FiUserCheck />}</div>
              <h3 className="mt-5 text-lg font-extrabold text-navy-900">{admins.length ? 'No matching administrators' : 'Build your admin network'}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{admins.length ? 'Try another search or switch the status filter to see more accounts.' : 'Create the first administrator, then assign them from the Branches page.'}</p>
              {!admins.length && <button onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-bold text-white"><FiPlus /> Add first admin</button>}
            </div>
          )}
        </section>

        {open && <Modal title="Create a new administrator" onClose={() => setOpen(false)} wide>
          <form onSubmit={create} className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-iceblue-50 p-4 ring-1 ring-iceblue-100">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm"><FiShield /></div>
              <div><p className="font-bold text-navy-900">Administrator identity</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Create the login first. Assign it when creating or editing a branch.</p></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label-text">Administrator name</label><input required autoFocus className="input-field" placeholder="Full name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></div>
              <div><label className="label-text">Username</label><input required className="input-field" placeholder="Login username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label-text">Temporary password</label><input required minLength={6} type="password" className="input-field" placeholder="At least 6 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
            </div>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary sm:min-w-28">Cancel</button>
              <button className="btn-primary sm:min-w-44">Create administrator</button>
            </div>
          </form>
        </Modal>}

        {resetTarget && <Modal title="Reset administrator password" onClose={() => setResetTarget(null)}>
          <form onSubmit={reset} className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-600"><FiKey /></div>
              <div className="min-w-0"><p className="truncate font-bold text-navy-900">{resetTarget.displayName}</p><p className="truncate text-xs text-slate-500">@{resetTarget.username} {resetTarget.branch?.name ? `• ${resetTarget.branch.name}` : ''}</p></div>
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">{error}</p>}
            <div><label className="label-text">New password</label><input required autoFocus minLength={6} type="password" className="input-field" placeholder="Enter at least 6 characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
            <button className="btn-primary flex w-full items-center justify-center gap-2"><FiKey /> Update password</button>
          </form>
        </Modal>}

        {deleteTarget && <Modal title="Delete administrator" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-xl text-red-600 ring-1 ring-red-100"><FiTrash2 /></div>
              <h3 className="mt-4 text-lg font-extrabold text-navy-900">Remove {deleteTarget.displayName}?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">This permanently removes the login for <strong className="text-slate-700">@{deleteTarget.username}</strong>. This action cannot be undone.</p>
            </div>
            {deleteError && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">{deleteError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Keep admin</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                {deleting ? 'Deleting...' : <><FiTrash2 /> Delete admin</>}
              </button>
            </div>
          </div>
        </Modal>}
      </div>
    </RequireRole>
  );
}
