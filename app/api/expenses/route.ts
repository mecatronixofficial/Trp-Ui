import { NextRequest, NextResponse } from 'next/server';
import { createExpense, deleteExpense, getExpenseSummary, listExpenses, updateExpense } from '../../../data/expense-store';
import { requireAdmin } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const year = searchParams.get('year');
  const today = searchParams.get('today');
  const date = searchParams.get('date');
  if (month && (!Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12)) {
    return NextResponse.json({ message: 'Month must be between 1 and 12.' }, { status: 400 });
  }
  if (year && (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 9999)) {
    return NextResponse.json({ message: 'Enter a valid year.' }, { status: 400 });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ message: 'Date must use YYYY-MM-DD format.' }, { status: 400 });
  }
  const filters = {
    month: month ? Number(month) : null,
    year: year ? Number(year) : null,
    today: today === 'true',
    date: date || null,
  };

  const records = await listExpenses(filters);
  const summary = await getExpenseSummary(filters);
  return NextResponse.json({ records, summary });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError;
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ message: 'Expense payload must be an object.' }, { status: 400 });
    }
    const record = await createExpense(payload);
    return NextResponse.json({ record, summary: await getExpenseSummary() });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to create expense' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'Expense id is required' }, { status: 400 });
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ message: 'Expense payload must be an object.' }, { status: 400 });
    }
    const updated = await updateExpense(id, payload);
    if (!updated) return NextResponse.json({ message: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ record: updated, summary: await getExpenseSummary() });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to update expense' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'Expense id is required' }, { status: 400 });
    const deleted = await deleteExpense(id);
    if (!deleted) return NextResponse.json({ message: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ success: true, summary: await getExpenseSummary() });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to delete expense' }, { status: 400 });
  }
}
