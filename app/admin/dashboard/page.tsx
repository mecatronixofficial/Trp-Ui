'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from 'recharts';
import { FiBox, FiShoppingCart, FiTrash2, FiDollarSign, FiTrendingUp, FiPackage } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency } from '../../../lib/api';
import StatCard from '../../../components/StatCard';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [profitChart, setProfitChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dash, profit] = await Promise.all([
          api.get('/dashboard/admin'),
          api.get('/dashboard/monthly-profit'),
        ]);
        setData(dash.data);
        setProfitChart(profit.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-navy-800/60">Loading dashboard...</p>;
  if (!data) return <p className="text-red-500">Could not load dashboard data.</p>;

  const truckRows = Object.entries(data.truckWiseSalesToday || {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Production" value={data.today.production} suffix="bars" icon={FiBox} accent="iceblue" />
        <StatCard label="Today's Sales" value={formatCurrency(data.today.sales)} icon={FiShoppingCart} accent="green" />
        <StatCard label="Today's Wastage" value={data.today.wastage} suffix="bars" icon={FiTrash2} accent="red" />
        <StatCard label="Today's Making Cost" value={formatCurrency(data.today.makingCost)} icon={FiDollarSign} accent="amber" />
        <StatCard label="Today's Profit" value={formatCurrency(data.today.profit)} icon={FiTrendingUp} accent="navy" />
        <StatCard label="Pending Stock" value={data.pendingStock.totalClosingStock} suffix="bars" icon={FiPackage} accent="iceblue" />
        <StatCard label="Monthly Sales" value={formatCurrency(data.monthlySales)} icon={FiShoppingCart} accent="green" />
        <StatCard label="Yearly Sales" value={formatCurrency(data.yearlySales)} icon={FiShoppingCart} accent="green" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <p className="font-display font-semibold mb-4">Last 7 Days Sales</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.last7DaysSales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dff5fd" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="total" stroke="#1ca6d1" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="font-display font-semibold mb-4">Monthly Profit</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={profitChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dff5fd" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              <Bar dataKey="profit" fill="#1284ac" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <p className="font-display font-semibold mb-4">Truck-wise Sales Today</p>
        {truckRows.length === 0 ? (
          <p className="text-sm text-navy-800/50">No sales recorded today yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Truck</th>
                <th>Bars Sold</th>
                <th>Sales Amount</th>
              </tr>
            </thead>
            <tbody>
              {truckRows.map(([id, v]: any) => (
                <tr key={id}>
                  <td>{v.truckName}</td>
                  <td>{v.quantity}</td>
                  <td>{formatCurrency(v.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <p className="font-display font-semibold mb-4">Pending Stock (Size-wise)</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {data.pendingStock.sizeWise.map((s: any) => (
            <div key={s.size} className="rounded-xl bg-iceblue-50 border border-iceblue-100 p-3 text-center">
              <p className="text-xs text-navy-800/60">{s.size} bar</p>
              <p className="text-lg font-bold text-iceblue-700">{s.quantity}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
