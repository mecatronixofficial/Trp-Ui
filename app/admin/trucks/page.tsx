'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiKey, FiPower, FiBox, FiCheck, FiSearch, FiGitBranch } from 'react-icons/fi';
import api from '../../../lib/api';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';

interface Truck {
  _id: string;
  truckName: string;
  truckNumber: string;
  driverName: string;
  phoneNumber: string;
  loginId: string;
  status: boolean;
  branch?: { _id: string; name: string; code: string } | string;
}

interface Worker {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  truck?: { _id: string } | string;
}

const emptyForm = { branch: '', truckName: '', truckNumber: '', driverName: '', phoneNumber: '', loginId: '', password: '' };

const indiaDateISO = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

function last30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return indiaDateISO(date);
}

export default function TrucksPage() {
  const { user, loading: authLoading } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Truck | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [resetTarget, setResetTarget] = useState<Truck | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [truckStock, setTruckStock] = useState<Record<string, number>>({});
  const [loadTarget, setLoadTarget] = useState<Truck | null>(null);
  const [loadForm, setLoadForm] = useState({ date: indiaDateISO(), quantity: '', notes: '' });
  const [tripCheck, setTripCheck] = useState<any>(null);
  const [dailyTotals, setDailyTotals] = useState({ taken: 0, sold: 0, remaining: 0, salesAmount: 0, pendingAmount: 0, fuelLitres: 0, fuelCost: 0 });
  const [fuelByTruck, setFuelByTruck] = useState<Record<string, { litres: number; cost: number }>>({});
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [assignmentDetails, setAssignmentDetails] = useState<Record<string, any>>({});
  const [assignInputs, setAssignInputs] = useState<Record<string, string>>({});
  const [totalInputs, setTotalInputs] = useState<Record<string, string>>({});
  const [savingAssign, setSavingAssign] = useState<string>('');
  const [assignTarget, setAssignTarget] = useState<Truck | null>(null);
  const [assignChooserOpen, setAssignChooserOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Truck | null>(null);
  const [historyRange, setHistoryRange] = useState({ from: last30Days(), to: indiaDateISO() });
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pageError, setPageError] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageTrucks = !isSuperAdmin || Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);

  const load = async () => {
    setLoading(true);
    setPageError('');
    try {
    const { data: truckData } = await api.get('/trucks');
    const data = Array.isArray(truckData) ? truckData : [];
    setTrucks(data);
    api.get('/workers').then(({ data: workerRows }) => setWorkers(workerRows)).catch(() => setWorkers([]));
    const stockRows = await Promise.all(data.map((truck: Truck) => api.get(`/stock/truck/${truck._id}`).catch(() => ({ data: { totalStock: 0 } }))));
    setTruckStock(Object.fromEntries(data.map((truck: Truck, index: number) => [truck._id, Number(stockRows[index].data.totalStock || 0)])));
    const today = indiaDateISO();
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = indiaDateISO(tomorrowDate);
    const [dailyRows, todaySales, assignRows, expenseResult] = await Promise.all([
      api.get('/truck-loads/reconciliation', { params: { date: today } }).catch(() => ({ data: [] })),
      api.get('/sales', { params: { from: today, to: tomorrow } }).catch(() => ({ data: [] })),
      api.get('/truck-assignments', { params: { date: today } }).catch(() => ({ data: [] })),
      fetch('/api/expenses?today=true', { cache: 'no-store', headers: selectedBranchHeaders() })
        .then(async (response) => response.ok ? response.json() : { records: [] })
        .catch(() => ({ records: [] })),
    ]);
    const barTotals = dailyRows.data.reduce((totals: any, row: any) => ({
      taken: totals.taken + Number(row.taken || 0),
      sold: totals.sold + Number(row.sold || 0),
      remaining: totals.remaining + Number(row.remaining || 0),
    }), { taken: 0, sold: 0, remaining: 0, salesAmount: 0, pendingAmount: 0 });
    const moneyTotals = todaySales.data.reduce((totals: any, sale: any) => ({
      salesAmount: totals.salesAmount + Number(sale.totalAmount || 0),
      pendingAmount: totals.pendingAmount + Number(sale.balanceAmount || 0),
    }), { salesAmount: 0, pendingAmount: 0 });
    const visibleTruckIds = new Set(data.map((truck: Truck) => String(truck._id)));
    const fuelRows = (Array.isArray(expenseResult?.records) ? expenseResult.records : []).filter((record: any) => {
      const category = String(record.costType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const truckId = String(record.truck?._id || record.truck || '');
      return ['petrol', 'diesel', 'petrol_diesel'].includes(category) && visibleTruckIds.has(truckId);
    });
    const truckFuel: Record<string, { litres: number; cost: number }> = fuelRows.reduce((result: Record<string, { litres: number; cost: number }>, record: any) => {
      const truckId = String(record.truck?._id || record.truck || '');
      if (!truckId) return result;
      const current = result[truckId] || { litres: 0, cost: 0 };
      result[truckId] = {
        litres: current.litres + Number(record.fuelQuantity || 0),
        cost: current.cost + Number(record.amount || 0),
      };
      return result;
    }, {} as Record<string, { litres: number; cost: number }>);
    const fuelTotals = Object.values(truckFuel).reduce((total, fuel) => ({
      fuelLitres: total.fuelLitres + fuel.litres,
      fuelCost: total.fuelCost + fuel.cost,
    }), { fuelLitres: 0, fuelCost: 0 });
    setFuelByTruck(truckFuel);
    setDailyTotals({ ...barTotals, ...moneyTotals, ...fuelTotals });
    setAssignments(Object.fromEntries(assignRows.data.map((row: any) => [String(row.truck?._id || row.truck), Number(row.quantity || 0) + Number(row.pendingQuantity || 0)])));
    setAssignmentDetails(Object.fromEntries(assignRows.data.map((row: any) => [String(row.truck?._id || row.truck), row])));
    } catch (loadError: any) {
      setTrucks([]);
      setTruckStock({});
      setFuelByTruck({});
      setPageError(loadError?.response?.data?.message || loadError?.message || 'Could not load trucks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
    setSelectedBranch(isSuperAdmin ? storedBranch : (user?.branch || ''));
    if (isSuperAdmin) api.get('/branches')
      .then(({ data }) => setBranches((Array.isArray(data) ? data : []).filter((branch: any) => branch.isActive)))
      .catch(() => setBranches([]));
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    void load();
  }, [authLoading, selectedBranch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  const driverWorkers = useMemo(() => workers.filter((w) => w.role === 'Driver').sort((a, b) => a.name.localeCompare(b.name)), [workers]);
  const visibleTrucks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return trucks;
    return trucks.filter((truck) => {
      const branch = typeof truck.branch === 'object' && truck.branch ? `${truck.branch.name} ${truck.branch.code}` : '';
      return [truck.truckName, truck.truckNumber, truck.driverName, truck.phoneNumber, truck.loginId, branch]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [search, trucks]);

  const openCreate = () => {
    if (!canManageTrucks) return;
    setEditing(null);
    setForm({ ...emptyForm, branch: selectedBranch || '' });
    setError('');
    setModalOpen(true);
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') !== 'truck') return;
    openCreate();
    window.history.replaceState({}, '', window.location.pathname);
  }, [branches]);

  useEffect(() => {
    if (loading || new URLSearchParams(window.location.search).get('assign') !== 'truck') return;
    setAssignChooserOpen(true);
    window.history.replaceState({}, '', window.location.pathname);
  }, [loading]);

  const openEdit = (t: Truck) => {
    setEditing(t);
    setForm({
      truckName: t.truckName,
      truckNumber: t.truckNumber,
      driverName: t.driverName,
      phoneNumber: t.phoneNumber,
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTrucks) return;
    setError('');
    const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
    const duplicate = trucks.find((truck) => truck._id !== editing?._id && (
      text(truck.truckName) === text(form.truckName) || text(truck.truckNumber) === text(form.truckNumber) ||
      (form.phoneNumber && phone(truck.phoneNumber) === phone(form.phoneNumber)) ||
      (form.loginId && text(truck.loginId) === text(form.loginId))
    ));
    if (duplicate) { setError('Truck name, vehicle number, phone number, and login ID must be unique.'); return; }
    try {
      if (editing) {
        await api.patch(`/trucks/${editing._id}`, form);
      } else {
        await api.post('/trucks', form);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong');
    }
  };

  const toggleStatus = async (t: Truck) => {
    await api.patch(`/trucks/${t._id}/${t.status ? 'deactivate' : 'activate'}`);
    load();
  };

  const remove = async (t: Truck) => {
    if (!confirm(`Delete truck "${t.truckName}"? This also removes its login.`)) return;
    await api.delete(`/trucks/${t._id}`);
    load();
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    await api.patch(`/trucks/${resetTarget._id}/reset-password`, { newPassword });
    setResetTarget(null);
    setNewPassword('');
  };

  const saveAssignment = async (t: Truck) => {
    const raw = assignInputs[t._id];
    const addQty = Number(raw || 0);
    if (!addQty || addQty <= 0) return;
    const quantity = Number(assignments[t._id] || 0) + addQty;
    setSavingAssign(t._id);
    try {
      await api.post('/truck-assignments', { truck: t._id, date: indiaDateISO(), quantity });
      setAssignments({ ...assignments, [t._id]: quantity });
      setAssignInputs({ ...assignInputs, [t._id]: '' });
    } finally {
      setSavingAssign('');
    }
  };

  const saveTotalEdit = async (t: Truck) => {
    const raw = totalInputs[t._id];
    const current = Number(assignments[t._id] || 0);
    const quantity = raw === undefined ? current : Number(raw) || 0;
    if (quantity !== current) {
      setSavingAssign(t._id);
      try {
        await api.post('/truck-assignments', { truck: t._id, date: indiaDateISO(), quantity });
        setAssignments({ ...assignments, [t._id]: quantity });
      } finally {
        setSavingAssign('');
      }
    }
    closeAssignModal(t._id);
  };

  const clearAssignment = async (t: Truck) => {
    if (!Number(assignments[t._id] || 0)) return;
    if (!confirm(`Clear today's assigned bars for "${t.truckName}"?`)) return;
    setSavingAssign(t._id);
    try {
      await api.post('/truck-assignments', { truck: t._id, date: indiaDateISO(), quantity: 0 });
      setAssignments({ ...assignments, [t._id]: 0 });
      setTotalInputs((prev) => { const next = { ...prev }; delete next[t._id]; return next; });
    } finally {
      setSavingAssign('');
    }
  };

  const cancelAssignmentRequest = async (t: Truck) => {
    const assignment = assignmentDetails[t._id];
    if (!assignment?._id || Number(assignment.pendingQuantity || 0) <= 0) return;
    setSavingAssign(t._id);
    try {
      const { data } = await api.post(`/truck-assignments/${assignment._id}/cancel`);
      setAssignmentDetails({ ...assignmentDetails, [t._id]: data });
      setAssignments({ ...assignments, [t._id]: Number(data.quantity || 0) });
    } finally {
      setSavingAssign('');
    }
  };

  const closeAssignModal = (truckId: string) => {
    setAssignTarget(null);
    setAssignInputs((prev) => { const next = { ...prev }; delete next[truckId]; return next; });
    setTotalInputs((prev) => { const next = { ...prev }; delete next[truckId]; return next; });
  };

  const openTripCheck = async (truck: Truck) => {
    setLoadTarget(truck); setTripCheck(null); setError('');
    try { const { data } = await api.get('/truck-loads/reconciliation', { params: { truck: truck._id, date: loadForm.date } }); setTripCheck(data[0] || { truckId: truck._id, date: loadForm.date, taken: 0, sold: 0, returned: 0, wastage: 0, remaining: 0, checked: false }); }
    catch (err: any) { setError(err?.response?.data?.message || 'Could not load truck check'); }
  };
  const approveTrip = async () => {
    if (!loadTarget || !tripCheck) return;
    await api.post('/truck-loads/reconciliation/check', { truck: loadTarget._id, date: loadForm.date });
    setTripCheck({ ...tripCheck, checked: true, checkedAt: new Date().toISOString() });
  };

  const loadHistory = async (truck: Truck, range: { from: string; to: string }) => {
    setHistoryLoading(true);
    setError('');
    try {
      const params = { truck: truck._id, from: range.from, to: range.to };
      const [loadRows, saleRows] = await Promise.all([
        api.get('/truck-loads', { params }),
        api.get('/sales', { params }),
      ]);
      const byDate: Record<string, { date: string; taken: number; sold: number; salesAmount: number; pendingAmount: number }> = {};
      const ensure = (date: string) => byDate[date] ||= { date, taken: 0, sold: 0, salesAmount: 0, pendingAmount: 0 };
      for (const row of loadRows.data) ensure(String(row.date).slice(0, 10)).taken += Number(row.quantity || 0);
      for (const sale of saleRows.data) {
        const row = ensure(String(sale.date).slice(0, 10));
        row.sold += (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
        row.salesAmount += Number(sale.totalAmount || 0);
        row.pendingAmount += Number(sale.balanceAmount || 0);
      }
      setHistoryRows(Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load truck history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = (truck: Truck) => {
    setHistoryTarget(truck);
    setHistoryRows([]);
    loadHistory(truck, historyRange);
  };

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <section className="flex flex-col gap-3 rounded-2xl border border-iceblue-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><FiGitBranch /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Truck view</p><p className="font-semibold text-navy-900">{activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Overall — all branches'}</p></div>
          </div>
          <select className="input-field h-10 sm:max-w-xs" aria-label="Change truck branch" value={selectedBranch || ''} onChange={(event) => changeBranch(event.target.value)}>
            <option value="">Overall — all branches</option>
            {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
          </select>
        </section>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Today&apos;s Truck Summary</p>
          <span className="pill bg-iceblue-50 text-iceblue-700">{new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <DailyCard label="Bars Taken" value={dailyTotals.taken} />
          <DailyCard label="Bars Sold" value={dailyTotals.sold} />
          <DailyCard label="Remaining" value={dailyTotals.remaining} danger={dailyTotals.remaining < 0} />
          <DailyCard label="Selling Amount" value={formatCurrency(dailyTotals.salesAmount)} />
          <DailyCard label="Pending Amount" value={formatCurrency(dailyTotals.pendingAmount)} danger={dailyTotals.pendingAmount > 0} />
          <DailyCard label="Fuel Used" value={`${dailyTotals.fuelLitres.toLocaleString('en-IN')} L`} />
          <DailyCard label="Fuel Cost" value={formatCurrency(dailyTotals.fuelCost)} />
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-iceblue-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
          <div className="shrink-0">
            <h2 className="font-display text-base font-bold text-navy-900">Registered Trucks</h2>
            <p className="mt-0.5 text-xs text-navy-800/50">{trucks.length} truck{trucks.length === 1 ? '' : 's'}</p>
          </div>
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-iceblue-400" />
            <input className="input-field h-10 pl-9" placeholder="Search truck, number, driver, phone or branch..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {canManageTrucks && <button onClick={openCreate} className="btn-primary flex h-10 shrink-0 items-center justify-center gap-2 px-4">
            <FiPlus /> Add Truck
          </button>}
        </div>
        {pageError && <div className="m-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{pageError}</div>}
        <div className="overflow-x-auto">
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <table className="w-full min-w-[1160px] table-fixed border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-slate-100 text-navy-900">
              <tr>
                <th className="w-[5%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                {user?.role === 'super_admin' && <th className="w-[10%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Branch</th>}
                <th className="w-[13%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Truck Name</th>
                <th className="w-[12%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Truck Number</th>
                <th className="w-[13%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Driver Name</th>
                <th className="w-[13%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Phone Number</th>
                <th className="w-[11%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Login ID</th>
                <th className="w-[8%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Ice Bars</th>
                <th className="w-[8%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Fuel Used Today</th>
                <th className="w-[9%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Fuel Cost Today</th>
                <th className="w-[8%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Status</th>
                <th className="w-[17%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrucks.map((t, index) => (
                <tr key={t._id} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                  <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                  {user?.role === 'super_admin' && <td className="break-words border border-slate-300 px-2 py-3 text-center text-navy-900">{typeof t.branch === 'object' ? `${t.branch.name} (${t.branch.code})` : '-'}</td>}
                  <td className="break-words border border-slate-300 px-2 py-3">
                    <Link href={`/admin/trucks/${t._id}`} className="font-medium text-navy-900 underline-offset-2 hover:underline">
                      {t.truckName}
                    </Link>
                  </td>
                  <td className="break-words border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{t.truckNumber}</td>
                  <td className="break-words border border-slate-300 px-2 py-3 text-navy-900">{t.driverName || '-'}</td>
                  <td className="break-all border border-slate-300 px-2 py-3 text-navy-900">{t.phoneNumber || '-'}</td>
                  <td className="break-all border border-slate-300 px-2 py-3 text-center font-mono text-xs text-navy-900">{t.loginId || '-'}</td>
                  <td className="border border-slate-300 px-1 py-3 text-center font-bold text-navy-900">{truckStock[t._id] || 0}</td>
                  <td className="border border-slate-300 px-1 py-3 text-center font-bold text-navy-900">{(fuelByTruck[t._id]?.litres || 0).toLocaleString('en-IN')} L</td>
                  <td className="border border-slate-300 px-1 py-3 text-center font-bold text-navy-900">{formatCurrency(fuelByTruck[t._id]?.cost || 0)}</td>
                  <td className="border border-slate-300 px-1 py-3 text-center">
                    <span className={`pill ${t.status ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-1 py-3">
                    {canManageTrucks ? <div className="flex flex-wrap items-center justify-center gap-2">
                      <button title="Check daily truck account" aria-label={`Check ${t.truckName} daily account`} onClick={() => openTripCheck(t)} className="text-navy-900 hover:text-black"><FiBox /></button>
                      <button title="Edit" aria-label={`Edit ${t.truckName}`} onClick={() => openEdit(t)} className="text-navy-900 hover:text-black">
                        <FiEdit2 />
                      </button>
                      <button title="Reset password" aria-label={`Reset ${t.truckName} password`} onClick={() => setResetTarget(t)} className="text-navy-900 hover:text-black">
                        <FiKey />
                      </button>
                      <button title={t.status ? 'Deactivate truck' : 'Activate truck'} aria-label={t.status ? `Deactivate ${t.truckName}` : `Activate ${t.truckName}`} onClick={() => toggleStatus(t)} className="text-navy-900 hover:text-black">
                        <FiPower />
                      </button>
                      <button title="Delete" aria-label={`Delete ${t.truckName}`} onClick={() => remove(t)} className="text-navy-900 hover:text-black">
                        <FiTrash2 />
                      </button>
                    </div> : <span className="block text-center text-navy-800/35">—</span>}
                  </td>
                </tr>
              ))}
              {visibleTrucks.length === 0 && (
                <tr><td colSpan={user?.role === 'super_admin' ? 12 : 11} className="border border-slate-300 px-4 py-10 text-center text-navy-800/50">{search ? 'No trucks match your search.' : 'No trucks registered.'}</td></tr>
              )}
            </tbody>
          </table>
        )}
        </div>
      </section>

      {modalOpen && (
        <Modal title={editing ? 'Edit Truck' : 'Add Truck'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            {!editing && user?.role === 'super_admin' && <div>
              <label className="label-text">Branch</label>
              <select className="input-field" required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                <option value="">Select branch</option>
                {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
              </select>
            </div>}
            <div>
              <label className="label-text">Truck Name</label>
              <input className="input-field" required value={form.truckName} onChange={(e) => setForm({ ...form, truckName: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Truck Number</label>
              <input className="input-field" required value={form.truckNumber} onChange={(e) => setForm({ ...form, truckNumber: e.target.value })} />
            </div>
            {!editing && (
              <>
                <div>
                  <label className="label-text">Login ID</label>
                  <input className="input-field" required value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} />
                </div>
                <div>
                  <label className="label-text">Password</label>
                  <input type="password" className="input-field" required minLength={4} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <label className="label-text">Driver</label>
              <select
                className="input-field"
                value=""
                onChange={(e) => {
                  const selected = driverWorkers.find((w) => w._id === e.target.value);
                  if (selected) setForm({ ...form, driverName: selected.name, phoneNumber: selected.phoneNumber || '' });
                }}
              >
                <option value="">Select driver</option>
                {driverWorkers.map((w) => (
                  <option key={w._id} value={w._id}>{w.name}{w.phoneNumber ? ` (${w.phoneNumber})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Driver Name</label>
              <input className="input-field" required value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Phone Number</label>
              <input className="input-field" required value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button className="btn-primary w-full">{editing ? 'Save Changes' : 'Create Truck'}</button>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset Password: ${resetTarget.truckName}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={submitReset} className="space-y-3">
            <div>
              <label className="label-text">New Password</label>
              <input type="password" className="input-field" required minLength={4} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <button className="btn-primary w-full">Reset Password</button>
          </form>
        </Modal>
      )}

      {assignChooserOpen && (
        <Modal title="Assign Truck" onClose={() => setAssignChooserOpen(false)}>
          <div className="space-y-2">
            <p className="pb-2 text-sm text-navy-800/55">Select a truck to assign today&apos;s bars.</p>
            {trucks.filter((truck) => truck.status !== false).map((truck) => (
              <button
                key={truck._id}
                type="button"
                onClick={() => { setAssignChooserOpen(false); setAssignTarget(truck); }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-iceblue-300 hover:bg-iceblue-50"
              >
                <span>
                  <span className="block font-semibold text-navy-900">{truck.truckName}</span>
                  <span className="mt-0.5 block text-xs text-navy-800/45">{truck.truckNumber || truck.driverName || 'Truck'}</span>
                </span>
                <span className="text-xs font-bold text-iceblue-700">{assignments[truck._id] || 0} bars</span>
              </button>
            ))}
            {trucks.filter((truck) => truck.status !== false).length === 0 && (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-navy-800/45">No active trucks available.</p>
            )}
          </div>
        </Modal>
      )}

      {assignTarget && (
        <Modal title={`Today's Bars: ${assignTarget.truckName}`} onClose={() => closeAssignModal(assignTarget._id)}>
          <div className="space-y-5">
            <div className="rounded-2xl bg-iceblue-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase text-navy-800/45">Assigned Today</p>
              <p className="mt-1 font-display text-3xl font-bold text-navy-900">{assignments[assignTarget._id] || 0} bars</p>
              {Number(assignmentDetails[assignTarget._id]?.pendingQuantity || 0) > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-800">
                  <p className="font-semibold">Waiting for driver acceptance</p>
                  <p className="mt-1 text-sm">Pending: {assignmentDetails[assignTarget._id].pendingQuantity} bars</p>
                  <button type="button" onClick={() => void cancelAssignmentRequest(assignTarget)} disabled={savingAssign === assignTarget._id} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">
                    <FiTrash2 /> {savingAssign === assignTarget._id ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="label-text">Add Bars</label>
              <div className="flex flex-wrap gap-2">
                {['0.25', '0.50', '0.75', '1'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAssignInputs({ ...assignInputs, [assignTarget._id]: val })}
                    className={`pill ${assignInputs[assignTarget._id] === val ? 'bg-iceblue-600 text-white' : 'bg-iceblue-50 text-iceblue-700 hover:bg-iceblue-100'}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  placeholder="Quantity"
                  className="input-field h-11 flex-1"
                  value={assignInputs[assignTarget._id] ?? ''}
                  onChange={(e) => setAssignInputs({ ...assignInputs, [assignTarget._id]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => saveAssignment(assignTarget)}
                  disabled={savingAssign === assignTarget._id}
                  className="btn-primary flex shrink-0 items-center gap-2 px-5 disabled:opacity-50"
                >
                  <FiCheck /> Add
                </button>
              </div>
            </div>

            <div>
              <label className="label-text">Set Exact Total</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  className="input-field h-11 flex-1"
                  value={totalInputs[assignTarget._id] ?? String(assignments[assignTarget._id] || 0)}
                  onChange={(e) => setTotalInputs({ ...totalInputs, [assignTarget._id]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => saveTotalEdit(assignTarget)}
                  disabled={savingAssign === assignTarget._id}
                  className="btn-secondary shrink-0 px-5 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="button"
              onClick={() => clearAssignment(assignTarget)}
              disabled={savingAssign === assignTarget._id || !assignments[assignTarget._id]}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <FiTrash2 /> Clear Today&apos;s Assignment
            </button>
          </div>
        </Modal>
      )}

      {loadTarget && (
        <Modal title={`Daily Check: ${loadTarget.truckName}`} onClose={() => setLoadTarget(null)}>
          <div className="space-y-4">
            <div><label className="label-text">Date</label><input type="date" className="input-field" value={loadForm.date} onChange={async (e) => { const date = e.target.value; setLoadForm({...loadForm, date}); setTripCheck(null); const { data } = await api.get('/truck-loads/reconciliation', { params: { truck: loadTarget._id, date } }); setTripCheck(data[0] || { truckId: loadTarget._id, date, taken: 0, sold: 0, returned: 0, wastage: 0, remaining: 0, checked: false }); }} /></div>
            {tripCheck && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[['Taken', tripCheck.taken], ['Sold', tripCheck.sold], ['Returned', tripCheck.returned], ['Wastage', tripCheck.wastage], ['Remaining', tripCheck.remaining]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-iceblue-50 p-3"><p className="text-xs font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 text-xl font-bold text-navy-900">{value}</p></div>)}
            </div>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {tripCheck?.checked ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-center font-semibold text-emerald-700">Checked by admin</p> : <button onClick={approveTrip} disabled={!tripCheck || !tripCheck.taken} className="btn-primary w-full disabled:opacity-50">Check & Approve Daily Account</button>}
          </div>
        </Modal>
      )}

      {historyTarget && (
        <Modal title={`Daily History: ${historyTarget.truckName}`} onClose={() => setHistoryTarget(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-iceblue-50 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Truck</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.truckName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Truck Number</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.truckNumber}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Driver</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.driverName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Phone</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.phoneNumber}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Login ID</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.loginId}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Ice Bars In Truck</p>
                <p className={`mt-1 font-bold ${(truckStock[historyTarget._id] || 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{truckStock[historyTarget._id] || 0}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label-text">From</label>
                <input type="date" className="input-field" value={historyRange.from} onChange={(e) => setHistoryRange({ ...historyRange, from: e.target.value })} />
              </div>
              <div>
                <label className="label-text">To</label>
                <input type="date" className="input-field" value={historyRange.to} onChange={(e) => setHistoryRange({ ...historyRange, to: e.target.value })} />
              </div>
              <button type="button" onClick={() => loadHistory(historyTarget, historyRange)} className="btn-secondary">Apply</button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="overflow-x-auto">
              {historyLoading ? (
                <p className="text-navy-800/50">Loading...</p>
              ) : (
                <table className="table-base min-w-[600px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Bars Taken</th>
                      <th>Bars Sold</th>
                      <th>Selling Amount</th>
                      <th>Pending Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.date}>
                        <td>{formatDate(row.date)}</td>
                        <td>{row.taken}</td>
                        <td>{row.sold}</td>
                        <td className="font-semibold">{formatCurrency(row.salesAmount)}</td>
                        <td className={row.pendingAmount > 0 ? 'font-semibold text-red-500' : ''}>{formatCurrency(row.pendingAmount)}</td>
                      </tr>
                    ))}
                    {historyRows.length === 0 && (
                      <tr><td colSpan={5} className="py-4 text-center text-navy-800/50">No records for the selected range.</td></tr>
                    )}
                  </tbody>
                  {historyRows.length > 0 && (
                    <tfoot>
                      <tr className="font-semibold">
                        <td>Total</td>
                        <td>{historyRows.reduce((sum, row) => sum + row.taken, 0)}</td>
                        <td>{historyRows.reduce((sum, row) => sum + row.sold, 0)}</td>
                        <td>{formatCurrency(historyRows.reduce((sum, row) => sum + row.salesAmount, 0))}</td>
                        <td>{formatCurrency(historyRows.reduce((sum, row) => sum + row.pendingAmount, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DailyCard({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
    <p className="text-[11px] font-semibold uppercase text-navy-800/45">{label}</p>
    <p className={`mt-2 font-display text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
  </div>;
}
