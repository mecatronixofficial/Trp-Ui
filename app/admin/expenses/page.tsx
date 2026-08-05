'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCalendar,
  FiDollarSign,
  FiFileText,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTrendingDown,
  FiX,
} from 'react-icons/fi';
import Modal from '../../../components/Modal';
import api, { COST_TYPES, formatCurrency, formatDate } from '../../../lib/api';

type ExpenseRecord = {
  _id: string;
  date: string;
  costType: string;
  amount: number;
  notes?: string;
  createdAt?: string;
};

type ExpenseForm = {
  date: string;
  costType: string;
  amount: string;
  notes: string;
};

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(date));

const todayIndiaISO = () => indiaDateKey(new Date());
const CATEGORY_NOTE_PREFIX = '[[expense-category:';
const CATEGORY_NOTE_SUFFIX = ']]';

const createForm = (): ExpenseForm => ({
  date: todayIndiaISO(),
  costType: '',
  amount: '',
  notes: '',
});

const expenseLabel = (value: string) => COST_TYPES.find((item) => item.value === value)?.label
  || value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeCategory = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const apiCostType = (category: string) => {
  const normalized = normalizeCategory(category);
  return COST_TYPES.find((item) => (
    normalizeCategory(item.value) === normalized || normalizeCategory(item.label) === normalized
  ))?.value || 'other';
};

const storedCustomCategory = (notes = '') => {
  const firstLine = notes.split('\n')[0] || '';
  if (!firstLine.startsWith(CATEGORY_NOTE_PREFIX) || !firstLine.endsWith(CATEGORY_NOTE_SUFFIX)) return '';
  const encoded = firstLine.slice(CATEGORY_NOTE_PREFIX.length, -CATEGORY_NOTE_SUFFIX.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return '';
  }
};

const recordCategory = (record: ExpenseRecord) => storedCustomCategory(record.notes) || expenseLabel(record.costType);

const recordNotes = (record: ExpenseRecord) => {
  if (!storedCustomCategory(record.notes)) return record.notes || '';
  return (record.notes || '').split('\n').slice(1).join('\n').trim();
};

const notesForApi = (category: string, costType: string, notes: string) => {
  const isCustom = costType === 'other' && normalizeCategory(category) !== 'other';
  if (!isCustom) return notes.trim();
  const marker = `${CATEGORY_NOTE_PREFIX}${encodeURIComponent(category.trim())}${CATEGORY_NOTE_SUFFIX}`;
  return notes.trim() ? `${marker}\n${notes.trim()}` : marker;
};

export default function ExpensesPage() {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(createForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setLoadError('');
    try {
      const { data } = await api.get('/making-cost');
      setRecords(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || 'Could not load expenses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const today = todayIndiaISO();
  const currentMonth = today.slice(0, 7);

  const filteredRecords = useMemo(() => {
    const search = query.trim().toLowerCase();
    return [...records]
      .filter((record) => {
        const date = indiaDateKey(record.date);
        if (category !== 'all' && recordCategory(record) !== category) return false;
        if (fromDate && date < fromDate) return false;
        if (toDate && date > toDate) return false;
        if (search) {
          const text = `${recordCategory(record)} ${recordNotes(record)}`.toLowerCase();
          if (!text.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateOrder = String(b.date).localeCompare(String(a.date));
        if (dateOrder !== 0) return dateOrder;
        return String(b.createdAt || b._id).localeCompare(String(a.createdAt || a._id));
      });
  }, [records, query, category, fromDate, toDate]);

  const totals = useMemo(() => {
    const all = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const todayTotal = records
      .filter((record) => indiaDateKey(record.date) === today)
      .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const monthTotal = records
      .filter((record) => indiaDateKey(record.date).startsWith(currentMonth))
      .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const visible = filteredRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
    return { all, today: todayTotal, month: monthTotal, visible };
  }, [records, filteredRecords, today, currentMonth]);

  const categoryTotals = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const record of filteredRecords) {
      const recordType = recordCategory(record);
      grouped[recordType] = (grouped[recordType] || 0) + Number(record.amount || 0);
    }
    return Object.entries(grouped)
      .map(([key, amount]) => ({ key, label: key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredRecords]);

  const availableCategories = useMemo(() => Array.from(new Set(
    records.map(recordCategory).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b)), [records]);

  const filtersActive = Boolean(query || category !== 'all' || fromDate || toDate);

  const openAddExpense = () => {
    setForm(createForm());
    setFormError('');
    setModalOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const typedCategory = form.costType.trim();
    if (!typedCategory) {
      setFormError('Type an expense category');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter an amount greater than zero');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const costType = apiCostType(typedCategory);
      await api.post('/making-cost', {
        date: form.date,
        costType,
        amount,
        notes: notesForApi(typedCategory, costType, form.notes),
      });
      setModalOpen(false);
      setForm(createForm());
      await load();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/making-cost/${deleteTarget._id}`);
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || 'Could not delete expense');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-navy-900 via-navy-800 to-amber-700 p-5 text-white shadow-xl shadow-amber-900/10 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
              <FiTrendingDown /> Business spending
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Expense management</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              Record operating costs and review where the business is spending money.
            </p>
            {lastUpdated && (
              <p className="mt-3 text-xs text-white/45">
                Last updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex">
            <button
              type="button"
              onClick={() => void load()}
              disabled={refreshing}
              title="Refresh expenses"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={openAddExpense} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 font-bold text-navy-900 transition hover:bg-amber-200">
              <FiPlus className="text-lg" /> Add Expense
            </button>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 font-medium"><FiAlertCircle className="shrink-0" /> {loadError}</span>
          <button type="button" onClick={() => void load()} className="font-bold underline underline-offset-4">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ExpenseMetric icon={<FiFilter />} label="Visible Expenses" value={formatCurrency(totals.visible)} helper={filtersActive ? 'Matching current filters' : 'All recorded expenses'} tone="navy" />
        <ExpenseMetric icon={<FiCalendar />} label="Today" value={formatCurrency(totals.today)} helper={formatDate(`${today}T12:00:00+05:30`)} tone="blue" />
        <ExpenseMetric icon={<FiTrendingDown />} label="This Month" value={formatCurrency(totals.month)} helper={new Date(`${today}T12:00:00+05:30`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} tone="amber" />
        <ExpenseMetric icon={<FiFileText />} label="Entries" value={String(filteredRecords.length)} helper={`${records.length} total records`} tone="emerald" />
      </div>

      <section className="rounded-3xl border border-iceblue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-navy-800/45"><FiFilter /> Filter expenses</p>
            <p className="mt-1 text-sm text-navy-800/50">Search by note, category, or date range.</p>
          </div>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1.5 text-sm font-semibold text-iceblue-700 hover:text-iceblue-800"><FiX /> Clear filters</button>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label-text">Search</label>
            <input className="input-field h-11" placeholder="Notes or category" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div>
            <label className="label-text">Category</label>
            <select className="input-field h-11" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {availableCategories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="label-text">From</label>
            <input type="date" className="input-field h-11" max={toDate || undefined} value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div>
            <label className="label-text">To</label>
            <input type="date" className="input-field h-11" min={fromDate || undefined} value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        </div>
      </section>

      {categoryTotals.length > 0 && (
        <section className="rounded-3xl border border-iceblue-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-navy-900">Spending by category</h2>
              <p className="mt-1 text-sm text-navy-800/50">Breakdown for the currently visible expenses.</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-navy-900">{formatCurrency(totals.visible)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categoryTotals.map((item) => (
              <CategoryTotal key={item.key} label={item.label} amount={item.amount} total={totals.visible} />
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-iceblue-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-iceblue-100 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">Expense history</h2>
            <p className="mt-1 text-sm text-navy-800/50">Every recorded business expense.</p>
          </div>
          <span className="pill shrink-0 bg-amber-50 text-amber-700">{filteredRecords.length} entries</span>
        </div>

        {loading ? (
          <ExpenseLoading />
        ) : filteredRecords.length ? (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[720px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th className="text-right">Amount</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record._id} className="transition hover:bg-iceblue-50/40">
                    <td className="font-medium text-navy-900">{formatDate(record.date)}</td>
                    <td><span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{recordCategory(record)}</span></td>
                    <td className="max-w-xs truncate text-navy-800/55" title={recordNotes(record)}>{recordNotes(record) || '—'}</td>
                    <td className="text-right font-bold text-navy-900">{formatCurrency(Number(record.amount || 0))}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => { setDeleteError(''); setDeleteTarget(record); }}
                        title="Delete expense"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50 hover:text-red-700"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-iceblue-50/60">
                  <td colSpan={3} className="font-bold text-navy-900">Visible total</td>
                  <td className="text-right font-display text-base font-bold text-navy-900">{formatCurrency(totals.visible)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-600"><FiDollarSign /></span>
            <h3 className="mt-4 font-display text-lg font-bold text-navy-900">{filtersActive ? 'No matching expenses' : 'No expenses recorded'}</h3>
            <p className="mt-1 max-w-sm text-sm text-navy-800/50">{filtersActive ? 'Change or clear the filters to see more records.' : 'Add the first expense to begin tracking business spending.'}</p>
            {filtersActive ? (
              <button type="button" onClick={clearFilters} className="btn-secondary mt-4">Clear Filters</button>
            ) : (
              <button type="button" onClick={openAddExpense} className="btn-primary mt-4 flex items-center gap-2"><FiPlus /> Add Expense</button>
            )}
          </div>
        )}
      </section>

      {modalOpen && (
        <Modal title="Add Expense" onClose={() => !saving && setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Record an expense against the selected date and category.
            </div>
            <div>
              <label className="label-text">Date</label>
              <input type="date" required className="input-field h-11" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </div>
            <div>
              <label className="label-text">Expense Category</label>
              <input
                required
                autoFocus
                maxLength={100}
                className="input-field h-11"
                placeholder="Type category, e.g. Diesel"
                value={form.costType}
                onChange={(event) => setForm({ ...form, costType: event.target.value })}
              />
              <p className="mt-1 text-xs text-navy-800/45">Type the category for each new expense.</p>
            </div>
            <div>
              <label className="label-text">Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                className="input-field h-12 text-lg font-semibold"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={3} maxLength={500} placeholder="Invoice, supplier, or reason for expense" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              <p className="mt-1 text-right text-xs text-navy-800/35">{form.notes.length}/500</p>
            </div>
            {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{formError}</p>}
            <button type="submit" disabled={saving} className="btn-primary flex h-12 w-full items-center justify-center gap-2">
              <FiDollarSign /> {saving ? 'Saving Expense...' : 'Save Expense'}
            </button>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Expense" onClose={() => !deleting && setDeleteTarget(null)}>
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800">
              <FiAlertCircle className="mt-0.5 shrink-0 text-xl" />
              <div>
                <p className="font-semibold">Delete this {recordCategory(deleteTarget)} expense?</p>
                <p className="mt-1 text-sm">{formatDate(deleteTarget.date)} · {formatCurrency(deleteTarget.amount)}</p>
              </div>
            </div>
            {deleteError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ExpenseMetric({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: 'navy' | 'blue' | 'amber' | 'emerald';
}) {
  const tones = {
    navy: 'bg-navy-900 text-white',
    blue: 'bg-iceblue-50 text-iceblue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.13em] text-navy-800/45 sm:text-xs">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-3 truncate font-display text-xl font-bold text-navy-900 sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[11px] text-navy-800/45 sm:text-xs">{helper}</p>
    </div>
  );
}

function CategoryTotal({ label, amount, total }: { label: string; amount: number; total: number }) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="rounded-2xl border border-iceblue-100 bg-iceblue-50/30 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-navy-900">{label}</p>
        <p className="shrink-0 text-sm font-bold text-navy-900">{formatCurrency(amount)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(percentage, 2)}%` }} />
      </div>
      <p className="mt-1.5 text-right text-[10px] font-bold text-navy-800/40">{percentage.toFixed(1)}%</p>
    </div>
  );
}

function ExpenseLoading() {
  return (
    <div className="animate-pulse space-y-4 p-5" aria-label="Loading expenses">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid grid-cols-4 gap-4">
          <span className="h-5 rounded bg-iceblue-100" />
          <span className="h-5 rounded bg-amber-50" />
          <span className="h-5 rounded bg-iceblue-50" />
          <span className="h-5 rounded bg-iceblue-100" />
        </div>
      ))}
    </div>
  );
}
