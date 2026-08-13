import { promises as fs } from 'fs';
import path from 'path';

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
};

export type ExpenseSummary = {
  snacksTotal: number;
  petrolDieselTotal: number;
  totalExpenses: number;
  balance: number;
};

const storePath = path.join(process.cwd(), 'data', 'expenses.json');

const isSnackCategory = (costType: string) => {
  const normalized = String(costType || '').trim().toLowerCase();
  return normalized === 'food' || normalized === 'food_expenses' || normalized === 'snacks_expenses' || normalized === 'snacks' || normalized.includes('snack');
};

const normalizeCostType = (costType: unknown) => {
  const normalized = String(costType || 'other').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (normalized === 'petrol' || normalized === 'diesel' || normalized === 'petrol_diesel') return 'petrol_diesel';
  return normalized || 'other';
};

async function readStore() {
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Expense data file must contain a JSON array');
    }
    return parsed as ExpenseRecord[];
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify([], null, 2));
    return [];
  }
}

async function writeStore(records: ExpenseRecord[]) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(records, null, 2));
}

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

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(date));

function dateMatches(recordDate: string, filters?: { month?: number | null; year?: number | null; today?: boolean; date?: string | null; from?: string | null; to?: string | null }) {
  if (!filters) return true;

  if (filters.today) {
    const todayKey = indiaDateKey(new Date());
    return indiaDateKey(recordDate) === todayKey;
  }

  if (filters.date) {
    return indiaDateKey(recordDate) === filters.date;
  }

  if (filters.from || filters.to) {
    const recordKey = indiaDateKey(recordDate);
    return (!filters.from || recordKey >= filters.from)
      && (!filters.to || recordKey <= filters.to);
  }

  if (filters.month && filters.year) {
    const monthKey = `${String(filters.year).padStart(4, '0')}-${String(filters.month).padStart(2, '0')}`;
    return recordDate.startsWith(monthKey);
  }

  return true;
}

export async function listExpenses(filters?: { month?: number | null; year?: number | null; today?: boolean; date?: string | null; from?: string | null; to?: string | null; branch?: string | null }) {
  const records = await readStore();
  return records.filter((record) => dateMatches(record.date, filters)
    && (!filters?.branch || String(record.branch || '') === filters.branch));
}

export async function createExpense(input: Partial<ExpenseRecord>) {
  const records = await readStore();
  const amount = parseAmount(input.amount);
  if (!amount) throw new Error('Amount must be a positive number');

  const now = new Date().toISOString();
  const record: ExpenseRecord = {
    _id: input._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: validateDate(input.date || new Date().toISOString()),
    costType: normalizeCostType(input.costType),
    amount,
    notes: cleanText(input.notes, 1000),
    worker: cleanText(input.worker, 120),
    workerName: cleanText(input.workerName, 160),
    branch: cleanText(input.branch, 120),
    branchName: cleanText(input.branchName, 160),
    truck: cleanText(input.truck, 120),
    truckName: cleanText(input.truckName, 160),
    fuelQuantity: parseAmount(input.fuelQuantity),
    description: cleanText(input.description || input.notes, 1000),
    createdAt: now,
    updatedAt: now,
  };

  records.unshift(record);
  await writeStore(records);
  return record;
}

export async function updateExpense(id: string, input: Partial<ExpenseRecord>) {
  const records = await readStore();
  const index = records.findIndex((record) => record._id === id);
  if (index === -1) return null;

  const amount = parseAmount(input.amount);
  if (!amount) throw new Error('Amount must be a positive number');

  const updated: ExpenseRecord = {
    ...records[index],
    ...input,
    _id: id,
    amount,
    date: validateDate(input.date || records[index].date),
    costType: normalizeCostType(input.costType || records[index].costType),
    notes: cleanText(input.notes ?? records[index].notes, 1000),
    worker: cleanText(input.worker ?? records[index].worker, 120),
    workerName: cleanText(input.workerName ?? records[index].workerName, 160),
    branch: cleanText(input.branch ?? records[index].branch, 120),
    branchName: cleanText(input.branchName ?? records[index].branchName, 160),
    truck: cleanText(input.truck ?? records[index].truck, 120),
    truckName: cleanText(input.truckName ?? records[index].truckName, 160),
    fuelQuantity: parseAmount(input.fuelQuantity ?? records[index].fuelQuantity),
    description: cleanText(input.description ?? input.notes ?? records[index].description ?? records[index].notes, 1000),
    updatedAt: new Date().toISOString(),
  };

  records[index] = updated;
  await writeStore(records);
  return updated;
}

export async function deleteExpense(id: string) {
  const records = await readStore();
  const next = records.filter((record) => record._id !== id);
  if (next.length === records.length) return false;
  await writeStore(next);
  return true;
}

export async function getExpenseSummary(filters?: { month?: number | null; year?: number | null; today?: boolean; date?: string | null; from?: string | null; to?: string | null; branch?: string | null }) {
  const records = await listExpenses(filters);
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
