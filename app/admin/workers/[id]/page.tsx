'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { FiArrowLeft, FiCalendar, FiCreditCard, FiPhone, FiTruck, FiUser, FiUserCheck } from 'react-icons/fi';
import api from '../../../../lib/api';
import { formatCurrency, formatDate } from '../../../../lib/api';

interface Worker {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  notes?: string;
  truck?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface Truck {
  _id: string;
  truckName: string;
  truckNumber?: string;
  driverName?: string;
  phoneNumber?: string;
  monthlySalary?: number;
  status?: boolean;
}

interface HistoryEntry {
  _id: string;
  date: string;
  amount: number;
  purpose: string;
  notes?: string;
  status?: string;
}

const indiaToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function currentMonthRange() {
  const month = indiaToday().slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const finalDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(finalDay).padStart(2, '0')}` };
}

export default function WorkerProfilePage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const [worker, setWorker] = useState<Worker | null>(null);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [range, setRange] = useState(currentMonthRange());
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async (activeRange: { from: string; to: string }, activeWorker = worker, activeTruck = truck) => {
    if (!activeWorker) return;
    if (activeRange.from && activeRange.to && activeRange.from > activeRange.to) {
      setError('From date cannot be after To date.');
      return;
    }
    setLoadingHistory(true);
    setError('');
    try {
      if (activeTruck) {
        const query: Record<string, string> = { truck: activeTruck._id };
        if (activeRange.from) query.from = activeRange.from;
        if (activeRange.to) query.to = activeRange.to;
        const { data } = await api.get('/driver-expenses', { params: query });
        setHistory((Array.isArray(data) ? data : []).map((entry: any) => ({
          _id: entry._id,
          date: entry.date,
          amount: Number(entry.amount || 0),
          purpose: entry.purpose || 'Driver buying',
          notes: entry.notes || '',
        })));
      } else {
        const query: Record<string, string> = { worker: activeWorker._id };
        if (activeRange.from) query.from = activeRange.from;
        if (activeRange.to) query.to = activeRange.to;
        const { data } = await api.get('/workers/buying', { params: query });
        setHistory((Array.isArray(data) ? data : []).map((entry: any) => ({
          _id: entry._id,
          date: entry.date,
          amount: Number(entry.buyingAmount || 0),
          purpose: 'Daily buying',
          notes: entry.notes || '',
          status: entry.status,
        })));
      }
    } catch (requestError: any) {
      setHistory([]);
      setError(requestError?.response?.data?.message || 'Could not load worker history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setLoadingProfile(true);
    setError('');
    Promise.all([
      api.get('/workers', { params: { includeInactive: 'true' } }),
      api.get('/trucks'),
    ])
      .then(([workerResponse, truckResponse]) => {
        const workers: Worker[] = Array.isArray(workerResponse.data) ? workerResponse.data : [];
        const trucks: Truck[] = Array.isArray(truckResponse.data) ? truckResponse.data : [];
        const foundWorker = workers.find((item) => item._id === routeId || String(item.truck || '') === routeId) || null;
        const foundTruck = foundWorker?.truck
          ? trucks.find((item) => item._id === String(foundWorker.truck)) || null
          : trucks.find((item) => item._id === routeId) || null;
        setWorker(foundWorker);
        setTruck(foundTruck);
        if (!foundWorker) {
          setError('Worker not found.');
          setLoadingHistory(false);
          return;
        }
        void loadHistory(range, foundWorker, foundTruck);
      })
      .catch((requestError) => {
        setError(requestError?.response?.data?.message || 'Could not load worker profile.');
        setLoadingHistory(false);
      })
      .finally(() => setLoadingProfile(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const totals = useMemo(() => ({
    entries: history.length,
    amount: history.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    presentDays: history.filter((entry) => !entry.status || entry.status === 'present').length,
  }), [history]);

  if (loadingProfile) return <div className="card text-sm text-navy-800/50">Loading worker profile...</div>;

  if (!worker) {
    return <div className="card text-center"><p className="font-semibold text-red-600">{error || 'Worker not found.'}</p><Link href="/admin/workers" className="btn-secondary mt-4 inline-flex items-center gap-2"><FiArrowLeft /> Back to Workers</Link></div>;
  }

  const isDriver = Boolean(truck);
  const isActive = worker.isActive !== false && (!truck || truck.status !== false);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/workers" className="btn-secondary inline-flex items-center gap-2"><FiArrowLeft /> Workers</Link>
        <span className={`pill ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{isActive ? 'Active Worker' : 'Inactive Worker'}</span>
      </div>

      <section className="overflow-hidden rounded-3xl border border-iceblue-100 bg-white shadow-ice">
        <div className="bg-navy-900 px-4 py-6 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl text-iceblue-200"><FiUser /></span>
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-iceblue-200/70">Worker Profile</p><h2 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">{worker.name}</h2><p className="mt-2 text-sm text-white/65">{worker.role || 'Worker'}{truck ? ` · ${truck.truckName}` : ''}</p></div>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <ProfileDetail icon={FiPhone} label="Phone" value={worker.phoneNumber || truck?.phoneNumber || 'Not provided'} />
          <ProfileDetail icon={FiUserCheck} label="Role" value={worker.role || 'Not provided'} />
          <ProfileDetail icon={FiTruck} label="Assigned Truck" value={truck ? `${truck.truckName}${truck.truckNumber ? ` (${truck.truckNumber})` : ''}` : 'Not assigned'} />
          <ProfileDetail icon={FiCreditCard} label="Monthly Salary" value={isDriver ? formatCurrency(truck?.monthlySalary || 0) : 'Not set'} />
          <ProfileDetail icon={FiCalendar} label="Worker Since" value={worker.createdAt ? formatDate(worker.createdAt) : 'Not available'} />
          <ProfileDetail icon={FiUser} label="Worker Type" value={isDriver ? 'Truck Driver' : 'General Worker'} />
        </div>
        {worker.notes && <p className="mx-4 mb-4 break-words rounded-2xl bg-iceblue-50 px-4 py-3 text-sm text-navy-800/65 sm:mx-6 sm:mb-6"><strong>Notes:</strong> {worker.notes}</p>}
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Selected Period Summary</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Buying Entries" value={totals.entries} />
          <SummaryCard label="Buying Days" value={totals.presentDays} />
          <SummaryCard label="Total Buying" value={formatCurrency(totals.amount)} danger={totals.amount > 0} />
          <SummaryCard label="Monthly Salary" value={isDriver ? formatCurrency(truck?.monthlySalary || 0) : 'Not set'} />
        </div>
      </section>

      <section className="card min-w-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h3 className="font-display text-xl font-bold text-navy-900">Buying History</h3><p className="mt-1 text-sm text-navy-800/50">Date-based buying records for this worker.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_9rem_auto_auto] lg:items-end">
            <div><label className="label-text">From</label><input type="date" className="input-field" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></div>
            <div><label className="label-text">To</label><input type="date" className="input-field" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></div>
            <button type="button" onClick={() => void loadHistory(range)} className="btn-secondary">Apply</button>
            <button type="button" onClick={() => { const all = { from: '', to: '' }; setRange(all); void loadHistory(all); }} className="btn-secondary">All Time</button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}

        {loadingHistory ? <p className="mt-5 text-sm text-navy-800/50">Loading buying history...</p> : <History records={history} total={totals.amount} isDriver={isDriver} />}
      </section>
    </div>
  );
}

function History({ records, total, isDriver }: { records: HistoryEntry[]; total: number; isDriver: boolean }) {
  return (
    <div className="mt-5 min-w-0">
      <table className="table-base hidden table-fixed md:table">
        <thead><tr><th className="w-1/5">Date</th><th className="w-1/5">Amount</th><th className="w-1/4">{isDriver ? 'Purpose' : 'Status'}</th><th>Notes</th></tr></thead>
        <tbody>{records.map((record) => <tr key={record._id}><td className="font-medium text-navy-900">{formatDate(record.date)}</td><td className="font-semibold text-red-500">{formatCurrency(record.amount)}</td><td className="capitalize">{isDriver ? record.purpose : record.status || 'Present'}</td><td className="break-words text-sm text-navy-800/60">{record.notes || '-'}</td></tr>)}{records.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-navy-800/50">No buying entries for the selected range.</td></tr>}</tbody>
        {records.length > 0 && <tfoot><tr className="font-semibold"><td>Total</td><td className="text-red-500">{formatCurrency(total)}</td><td /><td /></tr></tfoot>}
      </table>
      <div className="space-y-3 md:hidden">
        {records.map((record) => <article key={record._id} className="rounded-2xl border border-iceblue-100 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-navy-900">{formatDate(record.date)}</p><p className="mt-1 text-xs capitalize text-navy-800/50">{isDriver ? record.purpose : record.status || 'Present'}</p></div><p className="font-display text-lg font-bold text-red-500">{formatCurrency(record.amount)}</p></div>{record.notes && <p className="mt-3 break-words rounded-xl bg-iceblue-50 px-3 py-2 text-sm text-navy-800/60">{record.notes}</p>}</article>)}
        {records.length === 0 && <p className="rounded-2xl bg-iceblue-50 px-4 py-8 text-center text-sm text-navy-800/50">No buying entries for the selected range.</p>}
      </div>
    </div>
  );
}

function ProfileDetail({ icon: Icon, label, value }: { icon: typeof FiUser; label: string; value: string }) {
  return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><Icon /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className="mt-1 break-words font-semibold text-navy-900">{value}</p></div></div>;
}

function SummaryCard({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-2 break-words font-display text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}
