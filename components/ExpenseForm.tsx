'use client';

import { useEffect, useState } from 'react';
import { FiDollarSign } from 'react-icons/fi';
import api from '../lib/api';
import { selectedBranchHeaders } from '../lib/branch-fetch';

// Mirrors the "Add Expense" create flow in app/admin/expenses/page.tsx
// (same categories, same worker/truck conditional fields, same payload
// shape) so it can be dropped into a Modal elsewhere — same pattern as
// SaleForm — without touching the Expenses page itself.

interface ExpenseFormProps {
  onSaved: () => void;
}

type FormState = {
  date: string;
  costType: string;
  amount: string;
  notes: string;
  customCategory: string;
  worker: string;
  truck: string;
  fuelQuantity: string;
};

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(date));

const todayIndiaISO = () => indiaDateKey(new Date());
const CATEGORY_NOTE_PREFIX = '[[expense-category:';
const CATEGORY_NOTE_SUFFIX = ']]';

const createForm = (): FormState => ({
  date: todayIndiaISO(),
  costType: '',
  amount: '',
  notes: '',
  customCategory: '',
  worker: '',
  truck: '',
  fuelQuantity: '',
});

const normalizeCategory = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const apiCostType = (category: string) => {
  const normalized = normalizeCategory(category);
  if (['food', 'food_expenses', 'snacks', 'snack', 'snacks_expenses'].includes(normalized)) return 'snacks';
  if (['petrol_diesel', 'petrol', 'diesel'].includes(normalized)) return 'petrol_diesel';
  if (['advance_for_employee', 'advance_for_emp', 'advance_employee', 'advance', 'employee_advance'].includes(normalized)) return 'advance_for_employee';
  if (['other_expenses', 'other_expense', 'other', 'chat_expenses', 'chat_expense', 'chat', 'communication'].includes(normalized)) return 'other_expenses';
  return normalized || 'other';
};

const notesForApi = (category: string, costType: string, notes: string) => {
  const isCustom = costType === 'other' && normalizeCategory(category) !== 'other';
  if (!isCustom) return notes.trim();
  const marker = `${CATEGORY_NOTE_PREFIX}${encodeURIComponent(category.trim())}${CATEGORY_NOTE_SUFFIX}`;
  return notes.trim() ? `${marker}\n${notes.trim()}` : marker;
};

async function readExpenseResponse(response: Response) {
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') || body.trim().startsWith('<')) {
    throw new Error('The expense service is unavailable. Please refresh the page or restart the application server.');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('The expense service returned an invalid response. Please try again.');
  }
}

export default function ExpenseForm({ onSaved }: ExpenseFormProps) {
  const [form, setForm] = useState<FormState>(createForm);
  const [workers, setWorkers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/workers')
      .then(({ data }) => setWorkers((Array.isArray(data) ? data : []).filter((worker: any) => worker.isActive !== false)))
      .catch(() => setWorkers([]));
    api.get('/trucks')
      .then(({ data }) => setTrucks((Array.isArray(data) ? data : []).filter((truck: any) => truck.status !== false)))
      .catch(() => setTrucks([]));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const typedCategory = form.costType === 'custom' ? form.customCategory.trim() : form.costType.trim();
    if (!typedCategory) {
      setError('Select or type an expense category');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const costType = apiCostType(typedCategory);
      const needsWorker = costType === 'advance_for_employee';
      const needsTruck = costType === 'petrol_diesel';
      const selectedWorker = workers.find((worker) => worker._id === form.worker);
      const selectedTruck = trucks.find((truck) => truck._id === form.truck);
      if (needsWorker && !selectedWorker) {
        setError('Select a registered worker');
        setSaving(false);
        return;
      }
      const fuelQuantity = Number(form.fuelQuantity);
      if (needsTruck && !selectedTruck) {
        setError('Select the truck that used this fuel');
        setSaving(false);
        return;
      }
      if (needsTruck && (!Number.isFinite(fuelQuantity) || fuelQuantity <= 0)) {
        setError('Enter fuel consumed in litres');
        setSaving(false);
        return;
      }
      const payload = {
        date: form.date,
        costType,
        amount,
        notes: notesForApi(typedCategory, costType, form.notes),
        worker: needsWorker ? selectedWorker._id : '',
        workerName: needsWorker ? selectedWorker.name : '',
        truck: needsTruck ? selectedTruck._id : '',
        truckName: needsTruck ? `${selectedTruck.truckName}${selectedTruck.truckNumber ? ` (${selectedTruck.truckNumber})` : ''}` : '',
        fuelQuantity: needsTruck ? fuelQuantity : 0,
      };
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...selectedBranchHeaders() },
        body: JSON.stringify(payload),
      });
      const result = await readExpenseResponse(response);
      if (!response.ok) throw new Error(result?.message || 'Could not save expense');
      setForm(createForm());
      onSaved();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date</label>
        <input
          type="date"
          required
          className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
          value={form.date}
          onChange={(event) => setForm({ ...form, date: event.target.value })}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expense Category</label>
        <select
          className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
          value={form.costType}
          onChange={(event) => setForm({ ...form, costType: event.target.value, customCategory: '', worker: '', truck: '', fuelQuantity: '' })}
        >
          <option value="">Select category</option>
          <option value="food">Food</option>
          <option value="petrol_diesel">Petrol / Diesel</option>
          <option value="advance_for_employee">Worker Amount</option>
          <option value="other_expenses">Other Expenses</option>
          <option value="custom">Custom category</option>
        </select>
        {form.costType === 'custom' && (
          <input
            autoFocus
            maxLength={100}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
            placeholder="Type custom category"
            value={form.customCategory}
            onChange={(event) => setForm({ ...form, customCategory: event.target.value })}
          />
        )}
        <p className="mt-1 text-xs text-slate-500">Choose a common category or add a custom one.</p>
      </div>

      {form.costType === 'advance_for_employee' && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Select Worker</label>
          <select required className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white" value={form.worker} onChange={(event) => setForm({ ...form, worker: event.target.value })}>
            <option value="">Select worker</option>
            {workers.map((worker) => <option key={worker._id} value={worker._id}>{worker.name}{worker.role ? ` (${worker.role})` : ''}</option>)}
          </select>
        </div>
      )}

      {form.costType === 'petrol_diesel' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Truck</label>
            <select required className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white" value={form.truck} onChange={(event) => setForm({ ...form, truck: event.target.value })}>
              <option value="">Select truck</option>
              {trucks.map((truck) => <option key={truck._id} value={truck._id}>{truck.truckName}{truck.truckNumber ? ` (${truck.truckNumber})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fuel Used (Litres)</label>
            <input type="number" min="0.01" step="0.01" inputMode="decimal" required className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white" placeholder="0.00" value={form.fuelQuantity} onChange={(event) => setForm({ ...form, fuelQuantity: event.target.value })} />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Amount (₹)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          required
          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-lg font-semibold outline-none transition focus:border-amber-400 focus:bg-white"
          placeholder="0.00"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</label>
        <textarea
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
          rows={3}
          maxLength={500}
          placeholder="Invoice, supplier, or reason for expense"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
        <p className="mt-1 text-right text-xs text-slate-400">{form.notes.length}/500</p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-navy-900 px-4 py-2.5 font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiDollarSign /> {saving ? 'Saving Expense...' : 'Save Expense'}
      </button>
    </form>
  );
}
