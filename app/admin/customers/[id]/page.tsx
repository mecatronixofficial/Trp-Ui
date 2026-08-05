'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FiArrowLeft,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiMapPin,
  FiPhone,
  FiShoppingBag,
  FiTruck,
  FiUser,
} from 'react-icons/fi';
import api from '../../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../../lib/api';

interface Customer {
  _id: string;
  name: string;
  phoneNumber?: string;
  address?: string;
  defaultSaleType?: string;
  creditBalance?: number;
  isActive?: boolean;
  customerType?: 'local' | 'truck';
  truck?: { _id: string; truckName: string; truckNumber?: string; driverName?: string } | string | null;
  notes?: string;
  createdAt?: string;
}

interface HistorySale {
  _id: string;
  date: string;
  saleType: string;
  paymentMode: string;
  items?: { size?: string; quantity?: number; pricePerBar?: number; total?: number }[];
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes?: string;
}

interface HistoryDay {
  date: string;
  bars: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  sales: HistorySale[];
}

const indiaDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

function last30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return indiaDate(date);
}

const startOfIndiaDay = (date: string) => `${date}T00:00:00.000+05:30`;
const endOfIndiaDay = (date: string) => `${date}T23:59:59.999+05:30`;
const formatHistoryTime = (date: string | Date) => new Date(date).toLocaleTimeString('en-IN', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
});

function groupSales(sales: HistorySale[]) {
  const byDate: Record<string, HistoryDay> = {};
  for (const sale of sales) {
    const key = indiaDate(new Date(sale.date));
    const row = byDate[key] ||= {
      date: key, bars: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0, sales: [],
    };
    row.bars += (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0);
    row.totalAmount += Number(sale.totalAmount || 0);
    row.paidAmount += Number(sale.paidAmount || 0);
    row.balanceAmount += Number(sale.balanceAmount || 0);
    row.sales.push(sale);
  }

  return Object.values(byDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((row) => ({
      ...row,
      sales: row.sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }));
}

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryDay[]>([]);
  const [historyRange, setHistoryRange] = useState({ from: last30Days(), to: indiaDate() });
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async (range: { from: string; to: string }) => {
    if (range.from && range.to && range.from > range.to) {
      setError('From date cannot be after To date.');
      return;
    }
    setLoadingHistory(true);
    setError('');
    try {
      const query: Record<string, string> = { customer: customerId };
      if (range.from) query.from = startOfIndiaDay(range.from);
      if (range.to) query.to = endOfIndiaDay(range.to);
      const { data } = await api.get('/sales', { params: query });
      setHistoryRows(groupSales(Array.isArray(data) ? data : []));
    } catch (requestError: any) {
      setHistoryRows([]);
      setError(requestError?.response?.data?.message || 'Could not load purchase history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setLoadingCustomer(true);
    api.get(`/customers/${customerId}`)
      .then(({ data }) => setCustomer(data))
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Could not load customer profile.'))
      .finally(() => setLoadingCustomer(false));
    void loadHistory(historyRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const totals = useMemo(() => historyRows.reduce((result, row) => ({
    sales: result.sales + row.sales.length,
    bars: result.bars + row.bars,
    total: result.total + row.totalAmount,
    paid: result.paid + row.paidAmount,
    balance: result.balance + row.balanceAmount,
  }), { sales: 0, bars: 0, total: 0, paid: 0, balance: 0 }), [historyRows]);

  if (loadingCustomer) {
    return <div className="card text-sm text-navy-800/50">Loading customer profile...</div>;
  }

  if (!customer) {
    return (
      <div className="card text-center">
        <p className="font-semibold text-red-600">{error || 'Customer not found.'}</p>
        <Link href="/admin/customers" className="btn-secondary mt-4 inline-flex items-center gap-2"><FiArrowLeft /> Back to Customers</Link>
      </div>
    );
  }

  const truck = typeof customer.truck === 'object' && customer.truck ? customer.truck : null;
  const customerType = customer.customerType || (customer.truck ? 'truck' : 'local');

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/customers" className="btn-secondary inline-flex items-center gap-2"><FiArrowLeft /> Customers</Link>
        <span className={`pill ${customer.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {customer.isActive !== false ? 'Active Customer' : 'Inactive Customer'}
        </span>
      </div>

      <section className="overflow-hidden rounded-3xl border border-iceblue-100 bg-white shadow-ice">
        <div className="bg-navy-900 px-4 py-6 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl text-iceblue-200"><FiUser /></span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-iceblue-200/70">Customer Profile</p>
              <h2 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">{customer.name}</h2>
              <p className="mt-2 text-sm capitalize text-white/65">{customerType} customer · {customer.defaultSaleType || 'retail'} sales</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <ProfileDetail icon={FiPhone} label="Phone" value={customer.phoneNumber || 'Not provided'} />
          <ProfileDetail icon={FiMapPin} label="Address" value={customer.address || 'Not provided'} />
          <ProfileDetail icon={FiTruck} label="Truck / Location" value={truck ? `${truck.truckName}${truck.truckNumber ? ` (${truck.truckNumber})` : ''}` : 'Local'} />
          <ProfileDetail icon={FiCreditCard} label="Current Credit Balance" value={formatCurrency(customer.creditBalance || 0)} danger={Number(customer.creditBalance || 0) > 0} />
          <ProfileDetail icon={FiShoppingBag} label="Default Sale Type" value={customer.defaultSaleType || 'Retail'} capitalize />
          <ProfileDetail icon={FiUser} label="Driver" value={truck?.driverName || 'Not assigned'} />
          <ProfileDetail icon={FiCalendar} label="Customer Since" value={customer.createdAt ? formatDate(customer.createdAt) : 'Not available'} />
          <ProfileDetail icon={FiUser} label="Customer Type" value={customerType} capitalize />
        </div>
        {customer.notes && <p className="mx-4 mb-4 break-words rounded-2xl bg-iceblue-50 px-4 py-3 text-sm text-navy-800/65 sm:mx-6 sm:mb-6"><strong>Notes:</strong> {customer.notes}</p>}
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Purchase Summary</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryCard label="Sales" value={totals.sales} />
          <SummaryCard label="Ice Bars Bought" value={formatBarQuantity(totals.bars) || '0'} />
          <SummaryCard label="Sales Amount" value={formatCurrency(totals.total)} />
          <SummaryCard label="Amount Paid" value={formatCurrency(totals.paid)} tone="paid" />
          <SummaryCard label="Unpaid Amount" value={formatCurrency(totals.balance)} tone={totals.balance > 0 ? 'unpaid' : undefined} />
        </div>
      </section>

      <section className="card min-w-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-navy-900">Purchase History</h3>
            <p className="mt-1 text-sm text-navy-800/50">Daily totals and every ice-bar sale for this customer.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_9rem_auto_auto] lg:items-end">
            <div><label className="label-text">From</label><input type="date" className="input-field" value={historyRange.from} onChange={(event) => setHistoryRange({ ...historyRange, from: event.target.value })} /></div>
            <div><label className="label-text">To</label><input type="date" className="input-field" value={historyRange.to} onChange={(event) => setHistoryRange({ ...historyRange, to: event.target.value })} /></div>
            <button type="button" onClick={() => void loadHistory(historyRange)} className="btn-secondary">Apply</button>
            <button type="button" onClick={() => { const all = { from: '', to: '' }; setHistoryRange(all); void loadHistory(all); }} className="btn-secondary">All Time</button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}

        {loadingHistory ? (
          <p className="mt-5 text-sm text-navy-800/50">Loading purchase history...</p>
        ) : (
          <HistoryList rows={historyRows} totals={totals} />
        )}
      </section>
    </div>
  );
}

function HistoryList({ rows, totals }: { rows: HistoryDay[]; totals: { sales: number; bars: number; total: number; paid: number; balance: number } }) {
  return (
    <div className="mt-5 min-w-0">
      <table className="table-base hidden table-fixed md:table">
        <thead><tr><th className="w-[18%]">Date / Time</th><th className="w-[13%]">Sale Type</th><th className="w-[13%]">Bars Bought</th><th className="w-[15%]">Total Amount</th><th className="w-[14%]">Paid Amount</th><th className="w-[15%]">Unpaid Amount</th><th className="w-[12%]">Payment</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.date}>
              <tr className="bg-iceblue-50/80"><td className="font-bold text-navy-900">{formatDate(`${row.date}T12:00:00+05:30`)}<span className="ml-2 text-xs font-medium text-navy-800/45">{row.sales.length} sale{row.sales.length === 1 ? '' : 's'}</span></td><td className="text-xs font-semibold uppercase text-iceblue-700">Daily total</td><td className="font-bold">{formatBarQuantity(row.bars) || '0'}</td><td className="font-bold">{formatCurrency(row.totalAmount)}</td><td className="font-bold text-emerald-600">{formatCurrency(row.paidAmount)}</td><td className={row.balanceAmount > 0 ? 'font-bold text-red-500' : 'font-bold'}>{formatCurrency(row.balanceAmount)}</td><td>-</td></tr>
              {row.sales.map((sale) => {
                const bars = (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0);
                return <tr key={sale._id}><td><span className="pl-3 text-navy-800/65">{formatHistoryTime(sale.date)}</span>{sale.notes && <p className="mt-1 break-words pl-3 text-xs text-navy-800/45">{sale.notes}</p>}</td><td><span className="pill capitalize bg-white text-navy-800">{sale.saleType}</span></td><td>{formatBarQuantity(bars) || '0'}</td><td>{formatCurrency(sale.totalAmount)}</td><td className="text-emerald-600">{formatCurrency(sale.paidAmount)}</td><td className={Number(sale.balanceAmount || 0) > 0 ? 'font-semibold text-red-500' : ''}>{formatCurrency(sale.balanceAmount)}</td><td className="capitalize">{sale.paymentMode || '-'}</td></tr>;
              })}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-navy-800/50">No purchases for the selected range.</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr className="font-semibold"><td>Total</td><td>{totals.sales} sales</td><td>{formatBarQuantity(totals.bars) || '0'}</td><td>{formatCurrency(totals.total)}</td><td className="text-emerald-600">{formatCurrency(totals.paid)}</td><td className="text-red-500">{formatCurrency(totals.balance)}</td><td /></tr></tfoot>}
      </table>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <section key={row.date} className="overflow-hidden rounded-2xl border border-iceblue-100 bg-white">
            <div className="bg-iceblue-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-navy-900">{formatDate(`${row.date}T12:00:00+05:30`)}</p><p className="mt-1 text-xs font-semibold text-iceblue-700">{row.sales.length} sale{row.sales.length === 1 ? '' : 's'} · Daily total</p></div><p className="shrink-0 font-display text-lg font-bold text-navy-900">{formatBarQuantity(row.bars) || '0'} bars</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><AmountBox label="Total" value={row.totalAmount} /><AmountBox label="Paid" value={row.paidAmount} tone="paid" /><AmountBox label="Unpaid" value={row.balanceAmount} tone="unpaid" /></div></div>
            <div className="divide-y divide-iceblue-50">{row.sales.map((sale) => { const bars = (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0); return <div key={sale._id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-navy-900">{formatHistoryTime(sale.date)}</p><span className="pill capitalize bg-iceblue-50 text-iceblue-700">{sale.saleType}</span></div><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><Detail label="Ice Bars" value={formatBarQuantity(bars) || '0'} /><Detail label="Payment" value={sale.paymentMode || '-'} capitalize /><Detail label="Total Amount" value={formatCurrency(sale.totalAmount)} /><Detail label="Paid Amount" value={formatCurrency(sale.paidAmount)} tone="paid" /><Detail label="Unpaid Amount" value={formatCurrency(sale.balanceAmount)} tone={Number(sale.balanceAmount || 0) > 0 ? 'unpaid' : undefined} /></dl>{sale.notes && <p className="mt-3 break-words rounded-xl bg-iceblue-50/70 px-3 py-2 text-xs text-navy-800/60">{sale.notes}</p>}</div>; })}</div>
          </section>
        ))}
        {rows.length === 0 && <p className="rounded-2xl bg-iceblue-50 px-4 py-8 text-center text-sm text-navy-800/50">No purchases for the selected range.</p>}
      </div>
    </div>
  );
}

function ProfileDetail({ icon: Icon, label, value, danger = false, capitalize = false }: { icon: typeof FiUser; label: string; value: string; danger?: boolean; capitalize?: boolean }) {
  return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><Icon /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-1 break-words font-semibold ${capitalize ? 'capitalize' : ''} ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div></div>;
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone?: 'paid' | 'unpaid' }) {
  return <div className="rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-2 break-words font-display text-xl font-bold ${tone === 'paid' ? 'text-emerald-600' : tone === 'unpaid' ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}

function AmountBox({ label, value, tone }: { label: string; value: number; tone?: 'paid' | 'unpaid' }) {
  return <div className="min-w-0 rounded-xl bg-white px-2 py-2"><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className={`mt-1 break-words text-xs font-bold ${tone === 'paid' ? 'text-emerald-600' : tone === 'unpaid' && value > 0 ? 'text-red-500' : 'text-navy-900'}`}>{formatCurrency(value)}</p></div>;
}

function Detail({ label, value, tone, capitalize = false }: { label: string; value: string; tone?: 'paid' | 'unpaid'; capitalize?: boolean }) {
  return <div><dt className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</dt><dd className={`mt-1 break-words font-semibold ${capitalize ? 'capitalize' : ''} ${tone === 'paid' ? 'text-emerald-600' : tone === 'unpaid' ? 'text-red-500' : 'text-navy-900'}`}>{value}</dd></div>;
}
