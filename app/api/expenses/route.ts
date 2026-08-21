import { NextRequest, NextResponse } from 'next/server';
import { createExpense, deleteExpense, getExpenseSummary, listExpenses, updateExpense, type ExpenseAuth } from '../../../data/expense-store';
import { getAdminUser } from '../../../lib/server-auth';

const authFor = (request: NextRequest, branch: string): ExpenseAuth => ({ cookie: request.headers.get('cookie') || '', branch });

const referenceId = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id || '');
  return String(value || '');
};

function expenseBranch(request: NextRequest, user: any) {
  return user?.role === 'super_admin'
    ? String(request.headers.get('x-branch-id') || '')
    : referenceId(user?.branch);
}

export async function GET(request: NextRequest) {
  const auth = await getAdminUser(request); if (auth.error) return auth.error;
  const branch = expenseBranch(request, auth.user);
  if (auth.user?.role !== 'super_admin' && !branch) {
    return NextResponse.json({ message: 'Your admin account is not assigned to a branch.' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const year = searchParams.get('year');
  const today = searchParams.get('today');
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (month && (!Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12)) {
    return NextResponse.json({ message: 'Month must be between 1 and 12.' }, { status: 400 });
  }
  if (year && (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 9999)) {
    return NextResponse.json({ message: 'Enter a valid year.' }, { status: 400 });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ message: 'Date must use YYYY-MM-DD format.' }, { status: 400 });
  }
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ message: 'From date must use YYYY-MM-DD format.' }, { status: 400 });
  }
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ message: 'To date must use YYYY-MM-DD format.' }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ message: 'From date cannot be after to date.' }, { status: 400 });
  }
  const filters = {
    month: month ? Number(month) : null,
    year: year ? Number(year) : null,
    today: today === 'true',
    date: date || null,
    from: from || null,
    to: to || null,
    branch: branch || null,
  };

  try {
    const expenseAuth = authFor(request, branch);
    const records = await listExpenses(filters, expenseAuth);
    const summary = await getExpenseSummary(filters, expenseAuth, records);
    return NextResponse.json({ records, summary });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to load expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAdminUser(request); if (auth.error) return auth.error;
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ message: 'Expense payload must be an object.' }, { status: 400 });
    }
    const branch = expenseBranch(request, auth.user);
    if (!branch) return NextResponse.json({ message: 'Select a branch before adding an expense.' }, { status: 400 });
    const expenseAuth = authFor(request, branch);
    const record = await createExpense({ ...payload, branch }, expenseAuth);
    return NextResponse.json({ record, summary: await getExpenseSummary({ branch }, expenseAuth) });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to create expense' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getAdminUser(request); if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'Expense id is required' }, { status: 400 });
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ message: 'Expense payload must be an object.' }, { status: 400 });
    }
    const branch = expenseBranch(request, auth.user);
    if (!branch) return NextResponse.json({ message: 'Select a branch before editing an expense.' }, { status: 400 });
    const expenseAuth = authFor(request, branch);
    const visible = await listExpenses({ branch }, expenseAuth);
    if (!visible.some((record) => record._id === id)) return NextResponse.json({ message: 'Expense not found in this branch' }, { status: 404 });
    const updated = await updateExpense(id, { ...payload, branch }, expenseAuth);
    if (!updated) return NextResponse.json({ message: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ record: updated, summary: await getExpenseSummary({ branch }, expenseAuth) });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to update expense' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAdminUser(request); if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'Expense id is required' }, { status: 400 });
    const branch = expenseBranch(request, auth.user);
    if (!branch) return NextResponse.json({ message: 'Select a branch before deleting an expense.' }, { status: 400 });
    const expenseAuth = authFor(request, branch);
    const visible = await listExpenses({ branch }, expenseAuth);
    if (!visible.some((record) => record._id === id)) return NextResponse.json({ message: 'Expense not found in this branch' }, { status: 404 });
    const deleted = await deleteExpense(id, expenseAuth);
    if (!deleted) return NextResponse.json({ message: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ success: true, summary: await getExpenseSummary({ branch }, expenseAuth) });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to delete expense' }, { status: 400 });
  }
}
