import 'server-only';
import { getBackendApiUrl } from '../lib/backend-api-url';

// Expenses used to be persisted to a local JSON file (data/expenses.json).
// That works in local dev but crashes in production, where the deployed
// function's filesystem is read-only (EROFS on write). Expenses now live in
// the real backend (Trp-Server's Mongo-backed /expenses API), reached the
// same way every other resource in this app is: an authenticated fetch
// forwarding the caller's session cookie and selected-branch header. The
// exported function names/signatures below are unchanged other than the
// added `auth` parameter, so app/api/expenses/route.ts keeps its existing
// request validation, response shape, and error messages.

export type ExpenseRecord = {
  _id: string;
  date: string;
  costType: string;
  amount: number;
  notes?: string;
  worker?: string;
  workerName?: string;
  branch?: string;
  branchName?: string;
  truck?: string;
  truckName?: string;
  fuelQuantity?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByType?: 'ADMIN' | 'DRIVER';
  driverName?: string;
};

export type ExpenseSummary = {
  snacksTotal: number;
  petrolDieselTotal: number;
  totalExpenses: number;
  balance: number;
};

// Credentials to reach the backend as the same caller: the session cookie
// (who), and the resolved branch (which branch's data — already computed by
// the route handler from the user's role / X-Branch-Id header).
export type ExpenseAuth = { cookie: string; branch: string };

const isSnackCategory = (costType: string) => {
  const normalized = String(costType || '').trim().toLowerCase();
  return normalized === 'food' || normalized === 'food_expenses' || normalized === 'snacks_expenses' || normalized === 'snacks' || normalized.includes('snack');
};

const normalizeCostType = (costType: unknown) => {
  const normalized = String(costType || 'other').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (normalized === 'petrol' || normalized === 'diesel' || normalized === 'petrol_diesel') return 'petrol_diesel';
  return normalized || 'other';
};

function parseAmount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function validateDate(value: unknown) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid expense date');
  return date.toISOString();
}

function cleanText(value: unknown, maximum: number) {
  return String(value || '').trim().slice(0, maximum);
}

function referenceId(value: any) {
  return String(value?._id || value || '');
}

function backendErrorMessage(data: any, fallback: string) {
  const message = data?.message;
  return Array.isArray(message) ? message.join(', ') : (message || fallback);
}

async function backendRequest(path: string, auth: ExpenseAuth, init?: RequestInit) {
  const headers: Record<string, string> = { cookie: auth.cookie || '' };
  if (auth.branch) headers['x-branch-id'] = auth.branch;
  if (init?.body) headers['content-type'] = 'application/json';

  const response = await fetch(`${getBackendApiUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, data };
}

function filtersToQuery(filters?: { month?: number | null; year?: number | null; today?: boolean; date?: string | null; from?: string | null; to?: string | null }) {
  const params = new URLSearchParams();
  if (filters?.month) params.set('month', String(filters.month));
  if (filters?.year) params.set('year', String(filters.year));
  if (filters?.today) params.set('today', 'true');
  if (filters?.date) params.set('date', filters.date);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  return params.toString();
}

function indiaDateKey(value: unknown) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function matchesExpenseFilters(record: ExpenseRecord, filters?: { month?: number | null; year?: number | null; today?: boolean; date?: string | null; from?: string | null; to?: string | null }) {
  const date = indiaDateKey(record.date || record.createdAt);
  if (!date) return false;
  const today = indiaDateKey(new Date());
  if (filters?.today && date !== today) return false;
  if (filters?.date && date !== filters.date) return false;
  if (filters?.month && Number(date.slice(5, 7)) !== Number(filters.month)) return false;
  if (filters?.year && Number(date.slice(0, 4)) !== Number(filters.year)) return false;
  if (filters?.from && date < filters.from) return false;
  if (filters?.to && date > filters.to) return false;
  return true;
}

export async function listExpenses(
  filters: { month?: number | null; year?: number | null; today?: boolean; date?: string | null; from?: string | null; to?: string | null; branch?: string | null } | undefined,
  auth: ExpenseAuth,
) {
  const query = filtersToQuery(filters);
  const [expenseResult, driverResult] = await Promise.all([
    backendRequest(`/expenses${query ? `?${query}` : ''}`, auth),
    // Driver expenses use their own endpoint contract and do not accept the
    // Admin expense filters. Apply those filters after normalizing the rows.
    backendRequest('/driver-expenses', auth),
  ]);
  const { ok, data } = expenseResult;
  if (!ok) throw new Error(backendErrorMessage(data, 'Could not load expenses.'));
  const records = Array.isArray(data) ? (data as ExpenseRecord[]) : [];
  const existingIds = new Set(records.map((record) => String(record._id || '')));
  const driverExpenses: ExpenseRecord[] = driverResult.ok && Array.isArray(driverResult.data)
    ? driverResult.data.filter((row: any) => !existingIds.has(String(row?._id || ''))).map((row: any) => {
      const truck = row?.truck && typeof row.truck === 'object' ? row.truck : null;
      const purpose = cleanText(row?.purpose, 500);
      const notes = cleanText(row?.notes, 500);
      const purposeType = normalizeCostType(row?.costType || row?.purpose);
      const costType = purposeType === 'worker_amount' ? 'advance_for_employee'
        : purposeType === 'food' ? 'food'
          : purposeType === 'petrol_diesel' ? 'petrol_diesel'
            : purposeType === 'other_expenses' ? 'other_expenses'
              : purposeType || 'truck_expense';
      return {
        _id: String(row?._id || ''),
        date: String(row?.date || row?.createdAt || ''),
        costType,
        amount: Number(row?.amount || 0),
        notes: [purpose, notes].filter(Boolean).join(' - '),
        description: purpose,
        truck: referenceId(truck || row?.truck),
        truckName: cleanText(truck?.truckName || row?.truckName, 160),
        workerName: cleanText(row?.workerName || truck?.driverName || row?.driverName || row?.createdByName, 160),
        driverName: cleanText(truck?.driverName || row?.driverName || row?.createdByName, 160),
        createdByType: 'DRIVER',
        fuelQuantity: Number(row?.fuelQuantity || 0),
        branch: referenceId(row?.branch || truck?.branch),
        createdAt: row?.createdAt,
        updatedAt: row?.updatedAt,
      };
    })
    : [];
  return [...records, ...driverExpenses.filter((record) => matchesExpenseFilters(record, filters))];
}

export async function createExpense(input: Partial<ExpenseRecord>, auth: ExpenseAuth) {
  const amount = parseAmount(input.amount);
  if (!amount) throw new Error('Amount must be a positive number');

  const payload = {
    date: validateDate(input.date || new Date().toISOString()),
    costType: normalizeCostType(input.costType),
    amount,
    notes: cleanText(input.notes, 1000),
    worker: cleanText(input.worker, 120),
    workerName: cleanText(input.workerName, 160),
    truck: cleanText(input.truck, 120),
    truckName: cleanText(input.truckName, 160),
    fuelQuantity: parseAmount(input.fuelQuantity),
    description: cleanText(input.description || input.notes, 1000),
  };

  const { ok, data } = await backendRequest('/expenses', auth, { method: 'POST', body: JSON.stringify(payload) });
  if (!ok) throw new Error(backendErrorMessage(data, 'Could not save expense'));
  return data as ExpenseRecord;
}

export async function updateExpense(id: string, input: Partial<ExpenseRecord>, auth: ExpenseAuth) {
  const amount = parseAmount(input.amount);
  if (!amount) throw new Error('Amount must be a positive number');

  const payload = {
    date: validateDate(input.date || new Date().toISOString()),
    costType: normalizeCostType(input.costType),
    amount,
    notes: cleanText(input.notes, 1000),
    worker: cleanText(input.worker, 120),
    workerName: cleanText(input.workerName, 160),
    truck: cleanText(input.truck, 120),
    truckName: cleanText(input.truckName, 160),
    fuelQuantity: parseAmount(input.fuelQuantity),
    description: cleanText(input.description ?? input.notes, 1000),
  };

  const { ok, status, data } = await backendRequest(`/expenses/${id}`, auth, { method: 'PATCH', body: JSON.stringify(payload) });
  if (status === 404) return null;
  if (!ok) throw new Error(backendErrorMessage(data, 'Could not save expense'));
  return data as ExpenseRecord;
}

export async function deleteExpense(id: string, auth: ExpenseAuth) {
  const { ok, status, data } = await backendRequest(`/expenses/${id}`, auth, { method: 'DELETE' });
  if (status === 404) return false;
  if (!ok) throw new Error(backendErrorMessage(data, 'Could not delete expense'));
  return true;
}

export async function getExpenseSummary(
  filters: { month?: number | null; year?: number | null; today?: boolean; date?: string | null; from?: string | null; to?: string | null; branch?: string | null } | undefined,
  auth: ExpenseAuth,
  existingRecords?: ExpenseRecord[],
) {
  const records = existingRecords ?? await listExpenses(filters, auth);
  const snacksTotal = records.reduce((sum, record) => sum + (isSnackCategory(record.costType) ? Number(record.amount || 0) : 0), 0);
  const petrolDieselTotal = records.reduce((sum, record) => sum + (normalizeCostType(record.costType) === 'petrol_diesel' ? Number(record.amount || 0) : 0), 0);
  const totalExpenses = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  return {
    snacksTotal,
    petrolDieselTotal,
    totalExpenses,
    balance: Math.max(0, totalExpenses ? 0 : 0),
  } satisfies ExpenseSummary;
}
