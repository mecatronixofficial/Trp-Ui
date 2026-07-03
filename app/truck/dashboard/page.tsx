'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiShoppingCart, FiDollarSign, FiTrash2, FiPackage, FiPlus } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency } from '../../../lib/api';
import StatCard from '../../../components/StatCard';

export default function TruckDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/truck').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-navy-800/60">Loading...</p>;
  if (!data) return <p className="text-red-500">Could not load dashboard.</p>;

  const customerRows = Object.entries(data.customerWiseSalesToday || {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Link href="/truck/sales" className="btn-primary flex items-center justify-center gap-2 py-4">
          <FiPlus /> Add Sale
        </Link>
        <Link href="/truck/wastage" className="btn-secondary flex items-center justify-center gap-2 py-4">
          <FiPlus /> Add Wastage
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Today's Sales" value={formatCurrency(data.todaySales)} icon={FiShoppingCart} accent="green" />
        <StatCard label="Qty Sold Today" value={data.todayQuantitySold} suffix="bars" icon={FiPackage} accent="iceblue" />
        <StatCard label="Today's Collection" value={formatCurrency(data.todayCollection)} icon={FiDollarSign} accent="navy" />
        <StatCard label="Today's Wastage" value={data.todayWastage} suffix="bars" icon={FiTrash2} accent="red" />
      </div>

      <div className="card">
        <p className="font-display font-semibold mb-3">Customer-wise Sales Today</p>
        {customerRows.length === 0 ? (
          <p className="text-sm text-navy-800/50">No sales recorded today yet.</p>
        ) : (
          <table className="table-base">
            <thead><tr><th>Customer</th><th>Bars</th><th>Amount</th></tr></thead>
            <tbody>
              {customerRows.map(([id, v]: any) => (
                <tr key={id}><td>{v.customerName}</td><td>{v.quantity}</td><td>{formatCurrency(v.totalAmount)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
