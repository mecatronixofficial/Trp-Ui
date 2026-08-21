'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FiArrowLeft, FiClock, FiDollarSign, FiPhone, FiUser } from 'react-icons/fi';
import IceBlockSpinner from '../../../../components/IceBlockSpinner';
import api, { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../../lib/api';
import { formatTime } from '../../../../lib/salesUtils';

const referenceId = (value: any) => String(value?._id || value || '');

export default function DriverCustomerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.get(`/customers/${id}`), api.get('/sales', { params: { customer: id } })])
      .then(([customerResult, salesResult]) => {
        if (!active) return;
        setCustomer(customerResult.data);
        setSales(Array.isArray(salesResult.data) ? salesResult.data : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.response?.data?.message || 'Could not load customer history.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const totals = useMemo(() => sales.reduce((result, sale) => ({
    bars: result.bars + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0),
    total: result.total + Number(sale.totalAmount || 0),
    paid: result.paid + Number(sale.paidAmount || 0),
    pending: result.pending + Number(sale.balanceAmount || 0),
  }), { bars: 0, total: 0, paid: 0, pending: 0 }), [sales]);

  if (loading) return <div className="grid min-h-[55vh] place-items-center"><IceBlockSpinner label="Loading customer history..." /></div>;

  if (error || !customer) return (
    <section className="card">
      <p className="font-semibold text-red-600">{error || 'Customer not found.'}</p>
      <Link href="/truck/dashboard" className="btn-secondary mt-4 inline-flex items-center gap-2"><FiArrowLeft /> Driver Dashboard</Link>
    </section>
  );

  const truck = typeof customer.truck === 'object' && customer.truck ? customer.truck : null;

  return (
    <div className="min-w-0 space-y-4 pb-6 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/truck/dashboard" className="btn-secondary inline-flex items-center gap-2"><FiArrowLeft /> Dashboard</Link>
        <span className="pill bg-iceblue-50 text-iceblue-700">{truck?.truckName || 'Local Customer'}</span>
      </div>

      <section className="min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-iceblue-700 p-4 text-white shadow-lg min-[390px]:p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-iceblue-200">Customer</p>
        <h1 className="mt-2 break-words font-display text-2xl font-black sm:text-3xl">{customer.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
          <span className="inline-flex items-center gap-1.5"><FiPhone /> {customer.phoneNumber || 'No phone'}</span>
          <span className="inline-flex items-center gap-1.5"><FiUser /> {truck?.truckName || 'Local'}</span>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Pending Amount" value={formatCurrency(customer.creditBalance || totals.pending)} danger />
        <Summary label="Bars Purchased" value={formatBarQuantity(totals.bars) || '0'} />
        <Summary label="Total Amount" value={formatCurrency(totals.total)} />
        <Summary label="Paid Amount" value={formatCurrency(totals.paid)} />
      </div>

      <section className="card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-iceblue-100 px-4 py-4 sm:px-5">
          <FiClock className="text-iceblue-600" />
          <h2 className="font-display text-lg font-bold text-navy-900">Purchase History</h2>
        </div>
        <div className="space-y-3 p-3 sm:hidden">
          {sales.map((sale) => <SaleCard key={sale._id} sale={sale} />)}
          {!sales.length && <p className="py-10 text-center text-sm text-navy-800/50">No purchase history found.</p>}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="table-base min-w-[760px]">
            <thead><tr><th>Date / Time</th><th>Bars</th><th>Total</th><th>Paid</th><th>Pending</th><th>Payment</th></tr></thead>
            <tbody>
              {sales.map((sale) => <tr key={sale._id}><td>{formatDate(sale.date)} · {formatTime(sale.date)}</td><td>{formatBarQuantity((sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0)) || '0'}</td><td>{formatCurrency(sale.totalAmount)}</td><td className="text-emerald-600">{formatCurrency(sale.paidAmount)}</td><td className={Number(sale.balanceAmount || 0) > 0 ? 'font-bold text-red-600' : ''}>{formatCurrency(sale.balanceAmount)}</td><td className="capitalize">{sale.paymentMode || '-'}</td></tr>)}
              {!sales.length && <tr><td colSpan={6} className="py-10 text-center text-navy-800/50">No purchase history found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-2 break-words font-display text-xl font-black ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}

function SaleCard({ sale }: { sale: any }) {
  const bars = (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
  return <div className="rounded-2xl border border-iceblue-100 p-4"><div className="flex justify-between gap-3"><p className="font-bold text-navy-900">{formatDate(sale.date)}</p><p className="text-xs text-navy-800/50">{formatTime(sale.date)}</p></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><Detail label="Bars" value={formatBarQuantity(bars) || '0'} /><Detail label="Total" value={formatCurrency(sale.totalAmount)} /><Detail label="Paid" value={formatCurrency(sale.paidAmount)} paid /><Detail label="Pending" value={formatCurrency(sale.balanceAmount)} danger={Number(sale.balanceAmount || 0) > 0} /></div></div>;
}

function Detail({ label, value, paid = false, danger = false }: { label: string; value: string; paid?: boolean; danger?: boolean }) {
  return <div><p className="text-[10px] font-bold uppercase text-navy-800/40">{label}</p><p className={`mt-1 font-semibold ${danger ? 'text-red-600' : paid ? 'text-emerald-600' : 'text-navy-900'}`}>{value}</p></div>;
}
