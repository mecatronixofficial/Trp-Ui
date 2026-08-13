'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiEdit2 } from 'react-icons/fi';
import api, { formatCurrency, formatDate } from '../../../../lib/api';
import Modal from '../../../../components/Modal';
import { useAuth } from '../../../../context/AuthContext';
import { selectedBranchHeaders } from '../../../../lib/branch-fetch';

type Period = 'today' | 'weekly' | 'monthly';

const indiaDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value);
const shiftDay = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00+05:30`);
  value.setDate(value.getDate() + days);
  return indiaDate(value);
};
const rangeFor = (period: Period) => {
  const to = indiaDate();
  if (period === 'today') return { from: to, to };
  if (period === 'weekly') return { from: shiftDay(to, -6), to };
  return { from: `${to.slice(0, 7)}-01`, to };
};
const formatDateTime = (value: string) => new Date(value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const referenceId = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id || '');
  return String(value || '');
};
const isTodayAmount = (value: string | Date) => indiaDate(new Date(value)) === indiaDate();
const isAdvanceExpense = (entry: any) => ['advance', 'employee_advance', 'advance_employee', 'advance_for_employee']
  .includes(String(entry?.costType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));

export default function BuyingHistoryPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('today');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ worker: '', date: indiaDate(), buyingAmount: '', notes: '' });
  const canManageAmounts = user?.role !== 'super_admin' || Boolean(selectedBranch);

  useEffect(() => {
    setSelectedBranch(window.localStorage.getItem('tii_selected_branch') || '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = rangeFor(period);
      const expenseQuery = period === 'today'
        ? 'today=true'
        : period === 'monthly'
          ? `month=${Number(range.from.slice(5, 7))}&year=${range.from.slice(0, 4)}`
          : '';
      const [{ data }, workerResponse, expensePayload] = await Promise.all([
        api.get('/workers/buying', { params: range }),
        api.get('/workers').catch(() => ({ data: [] })),
        fetch(`/api/expenses${expenseQuery ? `?${expenseQuery}` : ''}`, { cache: 'no-store', headers: selectedBranchHeaders() })
          .then(async (response) => response.ok ? response.json() : { records: [] })
          .catch(() => ({ records: [] })),
      ]);
      const workers = Array.isArray(workerResponse.data) ? workerResponse.data : [];
      const workerNames = new Map(workers.map((worker: any) => [String(worker._id), worker.name]));
      const amountRows = (Array.isArray(data) ? data : []).map((row: any) => ({ ...row, isExpenseAdvance: false }));
      const advanceRows = (Array.isArray(expensePayload?.records) ? expensePayload.records : [])
        .filter((row: any) => {
          const date = indiaDate(new Date(row.date));
          return isAdvanceExpense(row) && workerNames.has(String(row.worker || ''))
            && date >= range.from && date <= range.to;
        })
        .map((row: any) => ({
          ...row,
          worker: { _id: String(row.worker), name: row.workerName || workerNames.get(String(row.worker)) || 'Worker' },
          buyingAmount: Number(row.amount || 0),
          entryDateTime: row.updatedAt || row.createdAt || row.date,
          entryType: 'Worker Amount',
          isExpenseAdvance: true,
        }));
      setRows([...amountRows, ...advanceRows]
        .sort((a, b) => new Date(b.entryDateTime || b.updatedAt || b.createdAt || b.date).getTime()
          - new Date(a.entryDateTime || a.updatedAt || a.createdAt || a.date).getTime()));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load amount history');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0), [rows]);

  const openEdit = (row: any) => {
    if (!canManageAmounts || !isTodayAmount(row.date)) return;
    setEditing(row);
    setForm({
      worker: referenceId(row.worker),
      date: indiaDate(new Date(row.date)),
      buyingAmount: String(row.buyingAmount ?? ''),
      notes: row.notes || '',
    });
    setError('');
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !canManageAmounts) return;
    if (!isTodayAmount(editing.date)) {
      setError("Only today's amounts can be edited.");
      return;
    }
    setError('');
    try {
      await api.patch(`/workers/buying/${editing._id}`, {
        ...form,
        buyingAmount: Number(form.buyingAmount) || 0,
      });
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update amount');
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wide text-navy-800/45">Worker Management</p><h1 className="mt-1 font-display text-2xl font-bold text-navy-900">Amount History</h1></div>
      <Link href="/admin/workers" className="btn-secondary flex items-center gap-2"><FiArrowLeft /> Workers</Link>
    </div>
    <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-iceblue-100 p-4">
        <div className="flex flex-wrap gap-2">{(['today', 'weekly', 'monthly'] as Period[]).map((item) => <button key={item} onClick={() => setPeriod(item)} className={`h-10 rounded-xl px-4 text-sm font-semibold capitalize ${period === item ? 'bg-navy-900 text-white' : 'bg-iceblue-50 text-navy-800'}`}>{item}</button>)}</div>
        <p className="font-semibold text-navy-900">Total: <span className="text-red-600">{formatCurrency(total)}</span></p>
      </div>
      {error && !editing && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        {loading ? <p className="p-6 text-navy-800/50">Loading history...</p> : <table className="w-full min-w-[900px] table-fixed border-collapse text-xs sm:text-sm">
          <thead className="bg-slate-100 text-navy-900"><tr><th className="w-[7%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">S.No</th><th className="w-[19%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Worker Name</th><th className="w-[14%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Amount Date</th><th className="w-[22%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Entry Date &amp; Time</th><th className="w-[14%] border border-slate-300 px-3 py-3 text-right font-bold uppercase">Amount</th><th className="w-[16%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Notes</th><th className="w-[8%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">Actions</th></tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={`${row.isExpenseAdvance ? 'worker-amount' : 'amount'}-${row._id}`} className="even:bg-slate-50 hover:bg-iceblue-50/70"><td className="border border-slate-300 px-2 py-2.5 text-center">{index + 1}</td><td className="border border-slate-300 px-3 py-2.5 font-semibold text-navy-900">{row.worker?.name || 'Worker'}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatDate(row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-right font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td><td className="border border-slate-300 px-3 py-2.5">{row.entryType === 'Worker Amount' ? `Worker Amount${row.notes ? ` - ${row.notes}` : ''}` : row.notes || '-'}</td><td className="border border-slate-300 px-2 py-2.5 text-center">{canManageAmounts && !row.isExpenseAdvance && isTodayAmount(row.date) ? <button type="button" title="Edit today's amount" aria-label={`Edit ${row.worker?.name || 'worker'} amount`} onClick={() => openEdit(row)} className="text-navy-900 hover:text-black"><FiEdit2 /></button> : <span className="text-navy-800/30">—</span>}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={7} className="border border-slate-300 py-10 text-center text-navy-800/50">No records for this period.</td></tr>}
          </tbody>
          {rows.length > 0 && <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={4} className="border border-slate-300 px-3 py-3 text-right uppercase">Total</td><td className="border border-slate-300 px-3 py-3 text-right text-red-600">{formatCurrency(total)}</td><td className="border border-slate-300" /><td className="border border-slate-300" /></tr></tfoot>}
        </table>}
      </div>
    </section>

    {editing && <Modal title="Edit Worker Amount" onClose={() => setEditing(null)}>
      <form onSubmit={saveEdit} className="space-y-3">
        <div><label className="label-text">Worker</label><input className="input-field" value={editing.worker?.name || 'Worker'} disabled /></div>
        <div><label className="label-text">Date</label><input type="date" required disabled className="input-field cursor-not-allowed opacity-60" value={form.date} /></div>
        <div><label className="label-text">Amount</label><input type="number" min="0" step="0.01" required className="input-field" value={form.buyingAmount} onChange={(event) => setForm({ ...form, buyingAmount: event.target.value })} /></div>
        <div><label className="label-text">Notes</label><textarea rows={2} className="input-field" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="btn-primary w-full">Update Amount</button>
      </form>
    </Modal>}
  </div>;
}
