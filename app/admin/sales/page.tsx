'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPrinter, FiFilter } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency, formatDate, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';

export default function AdminSalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [printSale, setPrintSale] = useState<any>(null);

  const [filters, setFilters] = useState({ from: '', to: '', truck: '', customer: '', saleType: '' });

  const load = async () => {
    setLoading(true);
    const params: any = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const { data } = await api.get('/sales', { params });
    setSales(data);
    setLoading(false);
  };

  useEffect(() => {
    api.get('/trucks').then((r) => setTrucks(r.data));
    api.get('/customers').then((r) => setCustomers(r.data));
    load();
  }, []);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this sale entry?')) return;
    await api.delete(`/sales/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label-text">From</label>
          <input type="date" className="input-field" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="label-text">To</label>
          <input type="date" className="input-field" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div>
          <label className="label-text">Truck</label>
          <select className="input-field" value={filters.truck} onChange={(e) => setFilters({ ...filters, truck: e.target.value })}>
            <option value="">All</option>
            {trucks.map((t) => <option key={t._id} value={t._id}>{t.truckName}</option>)}
          </select>
        </div>
        <div>
          <label className="label-text">Customer</label>
          <select className="input-field" value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })}>
            <option value="">All</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-text">Sale Type</label>
          <select className="input-field" value={filters.saleType} onChange={(e) => setFilters({ ...filters, saleType: e.target.value })}>
            <option value="">All</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
        <button className="btn-secondary flex items-center gap-2"><FiFilter /> Apply</button>
        <button type="button" onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 ml-auto">
          <FiPlus /> Add Sale
        </button>
      </form>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <table className="table-base min-w-[900px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Truck</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Bars</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s._id}>
                  <td>{formatDate(s.date)}</td>
                  <td>{s.truck?.truckName}</td>
                  <td>{s.customer?.name}</td>
                  <td className="capitalize">{s.saleType}</td>
                  <td>{s.items.reduce((a: number, i: any) => a + i.quantity, 0)}</td>
                  <td className="font-semibold">{formatCurrency(s.totalAmount)}</td>
                  <td>{formatCurrency(s.paidAmount)}</td>
                  <td className={s.balanceAmount > 0 ? 'text-red-500 font-semibold' : ''}>{formatCurrency(s.balanceAmount)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPrintSale(s)} className="text-navy-700"><FiPrinter /></button>
                      <button onClick={() => { setEditing(s); setModalOpen(true); }} className="text-iceblue-600"><FiEdit2 /></button>
                      <button onClick={() => remove(s._id)} className="text-red-500"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-navy-800/50">No sales found for the selected filters.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Edit Sale' : 'Add Sale'} onClose={() => setModalOpen(false)} wide>
          <SaleForm trucks={trucks} initial={editing} onSaved={() => { setModalOpen(false); load(); }} />
        </Modal>
      )}

      {printSale && <PrintBill sale={printSale} onClose={() => setPrintSale(null)} />}
    </div>
  );
}

function PrintBill({ sale, onClose }: { sale: any; onClose: () => void }) {
  return (
    <Modal title="Bill" onClose={onClose}>
      <div id="bill-print" className="text-sm space-y-3">
        <div className="text-center">
          <p className="font-display font-bold text-lg">Tiruppur Ice Since 2000</p>
          <p className="text-navy-800/60">Ice Bar Sales Receipt</p>
        </div>
        <div className="flex justify-between text-xs text-navy-800/70">
          <span>Date: {formatDate(sale.date)}</span>
          <span>Truck: {sale.truck?.truckName}</span>
        </div>
        <p className="text-xs">Customer: <strong>{sale.customer?.name}</strong></p>
        <table className="table-base">
          <thead><tr><th>Size</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            {sale.items.map((i: any, idx: number) => (
              <tr key={idx}><td>{i.size} bar</td><td>{i.quantity}</td><td>{formatCurrency(i.pricePerBar)}</td><td>{formatCurrency(i.total)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(sale.totalAmount)}</span></div>
        <div className="flex justify-between"><span>Paid ({sale.paymentMode})</span><span>{formatCurrency(sale.paidAmount)}</span></div>
        <div className="flex justify-between text-red-500 font-semibold"><span>Balance</span><span>{formatCurrency(sale.balanceAmount)}</span></div>
        <button onClick={() => window.print()} className="btn-primary w-full">Print</button>
      </div>
    </Modal>
  );
}
