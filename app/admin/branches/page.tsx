'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiEdit2,
  FiGitBranch,
  FiGrid,
  FiMapPin,
  FiPhone,
  FiPlus,
  FiPower,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
} from 'react-icons/fi';
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

type Admin = {
  _id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  branch?: { _id: string; name: string; code: string } | null;
};

type BranchForm = {
  name: string;
  code: string;
  address: string;
  phoneNumber: string;
  adminId: string;
};

type BranchFilter = 'all' | 'active' | 'inactive';

const emptyForm: BranchForm = {
  name: '',
  code: '',
  address: '',
  phoneNumber: '',
  adminId: '',
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BranchFilter>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [branchRows, adminRows] = await Promise.all([
        api.get('/branches'),
        api.get('/branches/admins/all'),
      ]);
      setBranches(branchRows.data);
      setAdmins(adminRows.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      adminId: admins.find((admin) => admin.isActive && !admin.branch)?._id || '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setForm({
      ...emptyForm,
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phoneNumber: branch.phoneNumber || '',
      adminId: branch.admin?.id || branch.admin?._id || '',
    });
    setError('');
    setModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
    const nameChanged = !editing || text(form.name) !== text(editing.name);
    const phoneChanged = !editing || phone(form.phoneNumber) !== phone(editing.phoneNumber);
    const duplicate = branches.find((branch) => branch._id !== editing?._id && (
      (nameChanged && text(branch.name) === text(form.name)) ||
      (form.code && text(branch.code) === text(form.code)) ||
      (phoneChanged && form.phoneNumber && phone(branch.phoneNumber) === phone(form.phoneNumber))
    ));

    if (duplicate) {
      setError('Branch name, code, and phone number must be unique.');
      return;
    }

    try {
      const payload = {
        name: form.name,
        address: form.address,
        phoneNumber: form.phoneNumber,
        adminId: form.adminId,
        ...(!editing ? { code: form.code } : {}),
      };
      if (editing) await api.patch(`/branches/${editing._id}`, payload);
      else await api.post('/branches', payload);
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save branch');
    }
  };

  const toggle = async (branch: Branch) => {
    await api.patch(`/branches/${branch._id}`, { isActive: !branch.isActive });
    await load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await api.delete(`/branches/${deleteTarget._id}`);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Could not delete branch');
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = branches.filter((branch) => branch.isActive).length;
  const inactiveCount = branches.length - activeCount;
  const coverage = branches.length ? Math.round((activeCount / branches.length) * 100) : 0;

  const visibleBranches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return branches.filter((branch) => {
      const matchesFilter = filter === 'all' || (filter === 'active' ? branch.isActive : !branch.isActive);
      const matchesSearch = !query || [
        branch.name,
        branch.code,
        branch.address,
        branch.phoneNumber,
        branch.admin?.displayName,
        branch.admin?.username,
      ].some((value) => String(value || '').toLocaleLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [branches, filter, search]);

  const filterOptions: { value: BranchFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All locations', count: branches.length },
    { value: 'active', label: 'Active', count: activeCount },
    { value: 'inactive', label: 'Inactive', count: inactiveCount },
  ];

  const assignableAdmins = admins.filter((admin) => {
    const assignedBranchId = admin.branch?._id;
    return (!assignedBranchId && admin.isActive) || assignedBranchId === editing?._id;
  });

  const branchCard = (branch: Branch) => (
    <article
      key={branch._id}
      className="group relative flex min-h-[330px] flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)] transition duration-300 hover:-translate-y-1 hover:border-iceblue-200 hover:shadow-[0_24px_55px_-30px_rgba(28,166,209,0.42)]"
    >
      <div className={`h-1.5 w-full ${branch.isActive ? 'bg-gradient-to-r from-emerald-400 via-iceblue-400 to-cyan-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`} />

      <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black tracking-tight shadow-sm ${branch.isActive ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-iceblue-100' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
            {branch.code?.slice(0, 2).toUpperCase() || <FiGitBranch />}
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{branch.code}</p>
            <h3 className="truncate text-lg font-extrabold tracking-tight text-navy-900">{branch.name}</h3>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider ${branch.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {branch.isActive ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className="mx-5 space-y-3 border-y border-slate-100 py-4 text-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400"><FiMapPin size={13} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p>
            <p className="mt-0.5 line-clamp-2 leading-5 text-slate-600">{branch.address || 'No address has been added'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400"><FiPhone size={13} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact</p>
            <p className="mt-0.5 truncate font-semibold text-slate-600">{branch.phoneNumber || 'Not provided'}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-white shadow-sm"><FiUser size={15} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch administrator</p>
          <p className="truncate text-sm font-bold text-navy-900">{branch.admin?.displayName || 'Not assigned'}</p>
          {branch.admin?.username && <p className="truncate text-xs text-slate-400">@{branch.admin.username}</p>}
        </div>
        {branch.admin && <span title={branch.admin.isActive ? 'Admin active' : 'Admin inactive'} className={`h-2.5 w-2.5 rounded-full ring-4 ${branch.admin.isActive ? 'bg-emerald-500 ring-emerald-50' : 'bg-slate-400 ring-slate-100'}`} />}
      </div>

      <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/70">
        <button aria-label={`Edit ${branch.name}`} title="Edit branch" onClick={() => openEdit(branch)} className="flex h-12 items-center justify-center border-r border-slate-100 text-slate-500 transition hover:bg-white hover:text-iceblue-600"><FiEdit2 /></button>
        <button aria-label={`${branch.isActive ? 'Deactivate' : 'Activate'} ${branch.name}`} title={branch.isActive ? 'Deactivate branch' : 'Activate branch'} onClick={() => toggle(branch)} className="flex h-12 items-center justify-center border-r border-slate-100 text-slate-500 transition hover:bg-white hover:text-emerald-600"><FiPower /></button>
        <button
          aria-label={`Delete ${branch.name}`}
          title={branch.isActive ? 'Deactivate the branch first to delete it' : 'Delete branch'}
          disabled={branch.isActive}
          onClick={() => { setDeleteError(''); setDeleteTarget(branch); }}
          className="flex h-12 items-center justify-center text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
        ><FiTrash2 /></button>
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
                <FiGitBranch /> Distribution network
              </div>
              <h1 className="max-w-xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">Every branch.<br className="hidden sm:block" /> One clear view.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Manage locations, branch contacts, administrator access, and availability across your entire ice distribution network.</p>
            </div>
            <button onClick={openCreate} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-navy-900 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-iceblue-50 sm:w-auto">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-iceblue-500 text-white transition group-hover:rotate-90"><FiPlus /></span>
              Create new branch
            </button>
          </div>

          <div className="relative mt-8 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm">
            <div className="px-3 py-4 sm:px-5">
              <p className="text-2xl font-black sm:text-3xl">{branches.length}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">Locations</p>
            </div>
            <div className="border-x border-white/10 px-3 py-4 sm:px-5">
              <p className="text-2xl font-black text-emerald-300 sm:text-3xl">{activeCount}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">Active now</p>
            </div>
            <div className="px-3 py-4 sm:px-5">
              <p className="text-2xl font-black text-iceblue-300 sm:text-3xl">{coverage}%</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">Availability</p>
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
                placeholder="Search branch, code, admin or location..."
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
                <h2 className="text-base font-extrabold text-navy-900">Branch directory</h2>
                <p className="text-xs text-slate-500">{visibleBranches.length} {visibleBranches.length === 1 ? 'location' : 'locations'} shown</p>
              </div>
            </div>
            {inactiveCount > 0 && <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-slate-400" />{inactiveCount} offline</div>}
          </div>

          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-[330px] animate-pulse rounded-3xl border border-white bg-white/70 p-5"><div className="h-12 w-12 rounded-2xl bg-slate-100" /><div className="mt-7 h-4 w-2/3 rounded bg-slate-100" /><div className="mt-3 h-3 w-full rounded bg-slate-100" /><div className="mt-24 h-10 w-full rounded-xl bg-slate-100" /></div>)}
            </div>
          ) : visibleBranches.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleBranches.map(branchCard)}</div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-iceblue-200 bg-white/70 px-5 py-16 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-iceblue-50 text-2xl text-iceblue-600 ring-1 ring-iceblue-100">{branches.length ? <FiSearch /> : <FiGitBranch />}</div>
              <h3 className="mt-5 text-lg font-extrabold text-navy-900">{branches.length ? 'No matching branches' : 'Build your branch network'}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{branches.length ? 'Try another search or switch the status filter to see more locations.' : 'Create an administrator first, then assign that account while creating the branch.'}</p>
              {!branches.length && <button onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-bold text-white"><FiPlus /> Add first branch</button>}
            </div>
          )}
        </section>

        {modalOpen && <Modal title={editing ? 'Edit branch' : 'Create a new branch'} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save} className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-iceblue-50 p-4 ring-1 ring-iceblue-100">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm"><FiMapPin /></div>
              <div><p className="font-bold text-navy-900">Location details</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{editing ? 'Update the location and change its assigned administrator.' : 'Set up the location and assign an existing administrator.'}</p></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label-text">Branch name</label><input required autoFocus className="input-field" placeholder="e.g. Avinashi Road" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div><label className="label-text">Branch code</label><input required={!editing} disabled={!!editing} className="input-field uppercase disabled:bg-slate-100 disabled:text-slate-500" placeholder="TIR-01" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></div>
            </div>
            <div><label className="label-text">Full address</label><textarea className="input-field min-h-24 resize-none" rows={3} placeholder="Street, area, city and PIN code" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
            <div><label className="label-text">Contact number</label><input className="input-field" inputMode="tel" placeholder="Primary branch phone number" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} /></div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-navy-900 text-white"><FiShield /></div>
                <div><p className="font-bold text-navy-900">Assigned administrator</p><p className="text-xs text-slate-500">Choose an available account created on the Administrators page</p></div>
              </div>
              <label className="label-text">Branch administrator</label>
              <select required className="input-field bg-white" value={form.adminId} onChange={(event) => setForm({ ...form, adminId: event.target.value })}>
                <option value="">Select an available administrator</option>
                {assignableAdmins.map((admin) => <option key={admin._id} value={admin._id}>{admin.displayName} (@{admin.username}){!admin.isActive ? ' — inactive' : ''}</option>)}
              </select>
              {!assignableAdmins.length && <p className="mt-3 text-xs font-medium text-amber-700">No unassigned active administrators are available. <Link href="/admin/admins" className="font-bold underline underline-offset-2">Create an administrator</Link> first.</p>}
              {editing?.admin && <p className="mt-3 text-xs text-slate-500">Changing this selection keeps the previous administrator account and marks it unassigned.</p>}
            </div>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary sm:min-w-28">Cancel</button>
              <button className="btn-primary sm:min-w-48">{editing ? 'Save branch & assignment' : 'Create branch'}</button>
            </div>
          </form>
        </Modal>}

        {deleteTarget && <Modal title="Delete branch" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-xl text-red-600 ring-1 ring-red-100"><FiTrash2 /></div>
              <h3 className="mt-4 text-lg font-extrabold text-navy-900">Remove {deleteTarget.name}?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">This permanently removes branch <strong className="text-slate-700">{deleteTarget.code}</strong>. Its administrator account will remain available as an unassigned account.</p>
            </div>
            {deleteError && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">{deleteError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Keep branch</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                {deleting ? 'Deleting...' : <><FiTrash2 /> Delete branch</>}
              </button>
            </div>
          </div>
        </Modal>}
      </div>
    </RequireRole>
  );
}
