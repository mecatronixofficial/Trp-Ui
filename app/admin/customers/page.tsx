'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiTag } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';
import Modal from '../../../components/Modal';

function last30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

const startOfIndiaDay = (date: string) => `${date}T00:00:00.000+05:30`;
const endOfIndiaDay = (date: string) => `${date}T23:59:59.999+05:30`;
const indiaTodayISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(date));
const formatHistoryTime = (date: string | Date) => new Date(date).toLocaleTimeString('en-IN', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
});

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

interface Customer {
  _id: string;
  name: string;
  phoneNumber: string;
  address: string;
  defaultSaleType: string;
  creditBalance: number;
  isActive: boolean;
  customerType?: 'local' | 'truck';
  truck?: { _id: string; truckName: string; truckNumber: string; driverName?: string } | string | null;
}

const emptyForm = { customerType: 'local', name: '', phoneNumber: '', address: '', defaultSaleType: 'retail', truck: '', notes: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [priceTarget, setPriceTarget] = useState<Customer | null>(null);
  const [prices, setPrices] = useState<any[]>([]);
  const [priceForm, setPriceForm] = useState<{ retail: string; wholesale: string }>({ retail: '', wholesale: '' });
  const [savingPrice, setSavingPrice] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null);
  const [historyRange, setHistoryRange] = useState({ from: last30Days(), to: indiaTodayISO() });
  const [historyRows, setHistoryRows] = useState<HistoryDay[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const customerTotals = useMemo(() => customers.reduce((totals, customer) => {
    const type = customer.customerType || (customer.truck ? 'truck' : 'local');
    totals.total += 1;
    if (type === 'truck') {
      totals.truck += 1;
      totals.truckPending += Number(customer.creditBalance || 0);
    } else {
      totals.local += 1;
      totals.localPending += Number(customer.creditBalance || 0);
    }
    return totals;
  }, { total: 0, truck: 0, local: 0, truckPending: 0, localPending: 0 }), [customers]);

  const load = async (q?: string) => {
    setLoading(true);
    const [{ data }, truckRows] = await Promise.all([
      api.get('/customers', { params: { search: q } }),
      api.get('/trucks'),
    ]);
    setCustomers(data);
    setTrucks(truckRows.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    const truckId = typeof c.truck === 'string' ? c.truck : c.truck?._id || '';
    setForm({ customerType: c.customerType || (truckId ? 'truck' : 'local'), name: c.name, phoneNumber: c.phoneNumber, address: c.address, defaultSaleType: c.defaultSaleType, truck: truckId });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, truck: form.customerType === 'truck' ? form.truck : null };
    if (editing) await api.patch(`/customers/${editing._id}`, payload);
    else await api.post('/customers', payload);
    setModalOpen(false);
    load(search);
  };

  const remove = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    await api.delete(`/customers/${c._id}`);
    load(search);
  };

  const openPrices = async (c: Customer) => {
    setPriceTarget(c);
    const { data } = await api.get(`/price-list/customer/${c._id}`);
    setPrices(data);
    setPriceForm({
      retail: data.find((p: any) => p.saleType === 'retail')?.price?.toString() || '',
      wholesale: data.find((p: any) => p.saleType === 'wholesale')?.price?.toString() || '',
    });
  };

  const savePrice = async (saleType: 'retail' | 'wholesale') => {
    if (!priceTarget) return;
    const price = Number(priceForm[saleType]);
    if (!price) return;
    setSavingPrice(true);
    await api.post('/price-list', { customer: priceTarget._id, saleType, price });
    const { data } = await api.get(`/price-list/customer/${priceTarget._id}`);
    setPrices(data);
    setSavingPrice(false);
  };

  const removePrice = async (saleType: 'retail' | 'wholesale') => {
    const entry = prices.find((p) => p.saleType === saleType);
    if (!entry) return;
    await api.delete(`/price-list/${entry._id}`);
    setPrices(prices.filter((p) => p._id !== entry._id));
    setPriceForm((prev) => ({ ...prev, [saleType]: '' }));
  };

  const loadHistory = async (customer: Customer, range: { from: string; to: string }) => {
    if (range.from && range.to && range.from > range.to) {
      setHistoryError('From date cannot be after To date.');
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const params: Record<string, string> = { customer: customer._id };
      if (range.from) params.from = startOfIndiaDay(range.from);
      if (range.to) params.to = endOfIndiaDay(range.to);
      const { data } = await api.get('/sales', { params });
      const byDate: Record<string, HistoryDay> = {};
      const ensure = (date: string) => byDate[date] ||= {
        date, bars: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0, sales: [],
      };
      for (const sale of (Array.isArray(data) ? data : []) as HistorySale[]) {
        const row = ensure(indiaDateKey(sale.date));
        row.bars += (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
        row.totalAmount += Number(sale.totalAmount || 0);
        row.paidAmount += Number(sale.paidAmount || 0);
        row.balanceAmount += Number(sale.balanceAmount || 0);
        row.sales.push(sale);
      }
      setHistoryRows(Object.values(byDate)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((row) => ({ ...row, sales: row.sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) })));
    } catch (error: any) {
      setHistoryRows([]);
      setHistoryError(error?.response?.data?.message || 'Could not load this customer’s purchase history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = (c: Customer) => {
    setHistoryTarget(c);
    setHistoryRows([]);
    setHistoryError('');
    loadHistory(c, historyRange);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Customer Summary</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CustomerSummaryCard label="Total Customers" value={customerTotals.total} />
          <CustomerSummaryCard label="Truck Customers" value={customerTotals.truck} />
          <CustomerSummaryCard label="Local Customers" value={customerTotals.local} />
          <CustomerSummaryCard label="Truck Pending" value={formatCurrency(customerTotals.truckPending)} danger={customerTotals.truckPending > 0} />
          <CustomerSummaryCard label="Local Pending" value={formatCurrency(customerTotals.localPending)} danger={customerTotals.localPending > 0} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-iceblue-400" />
          <input
            className="input-field pl-9"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              load(e.target.value);
            }}
          />
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
          <FiPlus /> Add Customer
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <table className="table-base min-w-[820px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Customer Type</th>
                <th>Truck / Local</th>
                <th>Sale Type</th>
                <th>Credit Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id}>
                  <td>
                    <Link href={`/admin/customers/${c._id}`} className="font-medium text-iceblue-700 underline-offset-2 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.phoneNumber}</td>
                  <td>
                    <span className={`pill ${(c.customerType || (c.truck ? 'truck' : 'local')) === 'truck' ? 'bg-iceblue-50 text-iceblue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {(c.customerType || (c.truck ? 'truck' : 'local')) === 'truck' ? 'Truck' : 'Local'}
                    </span>
                  </td>
                  <td>
                    {typeof c.truck === 'object' && c.truck ? (
                      <span>{c.truck.truckName}</span>
                    ) : (
                      <span className="font-medium text-emerald-600">Local</span>
                    )}
                  </td>
                  <td className="capitalize">{c.defaultSaleType}</td>
                  <td className={c.creditBalance > 0 ? 'text-red-500 font-semibold' : ''}>{formatCurrency(c.creditBalance)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button title="Price list" onClick={() => openPrices(c)} className="text-iceblue-600 hover:text-iceblue-700">
                        <FiTag />
                      </button>
                      <button title="Edit" onClick={() => openEdit(c)} className="text-navy-700 hover:text-navy-900">
                        <FiEdit2 />
                      </button>
                      <button title="Delete" onClick={() => remove(c)} className="text-red-500 hover:text-red-600">
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label-text">Customer Type</label>
              <select className="input-field" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value, truck: e.target.value === 'local' ? '' : form.truck })}>
                <option value="local">Local Customer</option>
                <option value="truck">Truck Customer</option>
              </select>
            </div>
            <div>
              <label className="label-text">Name</label>
              <input className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Phone Number</label>
              <input className="input-field" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Address</label>
              <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Default Sale Type</label>
              <select className="input-field" value={form.defaultSaleType} onChange={(e) => setForm({ ...form, defaultSaleType: e.target.value })}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </div>
            {form.customerType === 'truck' && <div>
              <label className="label-text">Assigned Truck</label>
              <select required className="input-field" value={form.truck} onChange={(e) => setForm({ ...form, truck: e.target.value })}>
                <option value="">Select truck</option>
                {trucks.map((truck) => (
                  <option key={truck._id} value={truck._id}>
                    {truck.truckName} ({truck.truckNumber})
                  </option>
                ))}
              </select>
            </div>}
            <button className="btn-primary w-full">{editing ? 'Save Changes' : 'Create Customer'}</button>
          </form>
        </Modal>
      )}

      {priceTarget && (
        <Modal title={`Bar Price: ${priceTarget.name}`} onClose={() => setPriceTarget(null)}>
          <p className="mb-3 text-xs text-navy-800/50">Set the price for 1 bar. The total is calculated automatically when a sale is recorded (bars × price).</p>
          <div className="space-y-3">
            {(['retail', 'wholesale'] as const).map((saleType) => {
              const entry = prices.find((p) => p.saleType === saleType);
              return (
                <div key={saleType} className="rounded-2xl border border-iceblue-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="pill capitalize bg-iceblue-50 text-iceblue-700">{saleType}</span>
                    {entry && <span className="text-xs text-navy-800/45">Current: {formatCurrency(entry.price)} / bar</span>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Price per bar"
                      className="input-field"
                      value={priceForm[saleType]}
                      onChange={(e) => setPriceForm({ ...priceForm, [saleType]: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => savePrice(saleType)}
                      disabled={savingPrice || !priceForm[saleType]}
                      className="btn-primary shrink-0 disabled:opacity-50"
                    >
                      Save
                    </button>
                    {entry && (
                      <button type="button" onClick={() => removePrice(saleType)} className="shrink-0 text-red-500 text-xs">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {historyTarget && (
        <Modal title={`Customer Details: ${historyTarget.name}`} onClose={() => setHistoryTarget(null)} full>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-iceblue-50 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Name</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Phone</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.phoneNumber || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Address</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.address || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Customer Type</p>
                <p className="mt-1 font-bold text-navy-900 capitalize">{historyTarget.customerType || (historyTarget.truck ? 'truck' : 'local')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Sale Type</p>
                <p className="mt-1 font-bold text-navy-900 capitalize">{historyTarget.defaultSaleType}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Truck</p>
                <p className="mt-1 font-bold text-navy-900">{typeof historyTarget.truck === 'object' && historyTarget.truck ? historyTarget.truck.truckName : 'Local'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Credit Balance</p>
                <p className={`mt-1 font-bold ${historyTarget.creditBalance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrency(historyTarget.creditBalance)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Status</p>
                <p className={`mt-1 font-bold ${historyTarget.isActive ? 'text-emerald-600' : 'text-red-500'}`}>{historyTarget.isActive ? 'Active' : 'Inactive'}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-iceblue-100 bg-white p-3 text-center">
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Bars Bought</p>
                <p className="mt-1 font-display text-xl font-bold text-navy-900">{formatBarQuantity(historyRows.reduce((sum, row) => sum + row.bars, 0))}</p>
              </div>
              <div className="rounded-2xl border border-iceblue-100 bg-white p-3 text-center">
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Paid Amount</p>
                <p className="mt-1 font-display text-xl font-bold text-emerald-600">{formatCurrency(historyRows.reduce((sum, row) => sum + row.paidAmount, 0))}</p>
              </div>
              <div className="rounded-2xl border border-iceblue-100 bg-white p-3 text-center">
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Unpaid Amount</p>
                <p className="mt-1 font-display text-xl font-bold text-red-500">{formatCurrency(historyRows.reduce((sum, row) => sum + row.balanceAmount, 0))}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end">
              <div className="w-full">
                <label className="label-text">From</label>
                <input type="date" className="input-field" value={historyRange.from} onChange={(e) => setHistoryRange({ ...historyRange, from: e.target.value })} />
              </div>
              <div className="w-full">
                <label className="label-text">To</label>
                <input type="date" className="input-field" value={historyRange.to} onChange={(e) => setHistoryRange({ ...historyRange, to: e.target.value })} />
              </div>
              <button type="button" onClick={() => loadHistory(historyTarget, historyRange)} className="btn-secondary">Apply</button>
              <button
                type="button"
                onClick={() => {
                  const allTimeRange = { from: '', to: '' };
                  setHistoryRange(allTimeRange);
                  loadHistory(historyTarget, allTimeRange);
                }}
                className="btn-secondary"
              >
                All Time
              </button>
            </div>

            {historyError && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {historyError}
              </p>
            )}

            <div>
              {historyLoading ? (
                <p className="text-navy-800/50">Loading...</p>
              ) : (
                <>
                <table className="table-base hidden table-fixed md:table">
                  <thead>
                    <tr>
                      <th className="w-[18%]">Date / Time</th>
                      <th className="w-[13%]">Sale Type</th>
                      <th className="w-[13%]">Bars Bought</th>
                      <th className="w-[15%]">Total Amount</th>
                      <th className="w-[14%]">Paid Amount</th>
                      <th className="w-[15%]">Unpaid Amount</th>
                      <th className="w-[12%]">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <Fragment key={row.date}>
                        <tr className="bg-iceblue-50/80">
                          <td className="font-bold text-navy-900">
                            {formatDate(`${row.date}T12:00:00+05:30`)}
                            <span className="ml-2 text-xs font-medium text-navy-800/45">{row.sales.length} sale{row.sales.length === 1 ? '' : 's'}</span>
                          </td>
                          <td className="text-xs font-semibold uppercase text-iceblue-700">Daily total</td>
                          <td className="font-bold">{formatBarQuantity(row.bars) || '0'}</td>
                          <td className="font-bold">{formatCurrency(row.totalAmount)}</td>
                          <td className="font-bold text-emerald-600">{formatCurrency(row.paidAmount)}</td>
                          <td className={row.balanceAmount > 0 ? 'font-bold text-red-500' : 'font-bold'}>{formatCurrency(row.balanceAmount)}</td>
                          <td>-</td>
                        </tr>
                        {row.sales.map((sale) => {
                          const bars = (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0);
                          return (
                            <tr key={sale._id}>
                              <td>
                                <span className="pl-3 text-navy-800/65">{formatHistoryTime(sale.date)}</span>
                                {sale.notes && <p className="mt-1 break-words pl-3 text-xs text-navy-800/45" title={sale.notes}>{sale.notes}</p>}
                              </td>
                              <td><span className="pill capitalize bg-white text-navy-800">{sale.saleType}</span></td>
                              <td>{formatBarQuantity(bars) || '0'}</td>
                              <td>{formatCurrency(sale.totalAmount)}</td>
                              <td className="text-emerald-600">{formatCurrency(sale.paidAmount)}</td>
                              <td className={Number(sale.balanceAmount || 0) > 0 ? 'font-semibold text-red-500' : ''}>{formatCurrency(sale.balanceAmount)}</td>
                              <td className="capitalize">{sale.paymentMode || '-'}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                    {historyRows.length === 0 && (
                      <tr><td colSpan={7} className="py-4 text-center text-navy-800/50">No purchases for the selected range.</td></tr>
                    )}
                  </tbody>
                  {historyRows.length > 0 && (
                    <tfoot>
                      <tr className="font-semibold">
                        <td>Total</td>
                        <td>{historyRows.reduce((sum, row) => sum + row.sales.length, 0)} sales</td>
                        <td>{formatBarQuantity(historyRows.reduce((sum, row) => sum + row.bars, 0))}</td>
                        <td>{formatCurrency(historyRows.reduce((sum, row) => sum + row.totalAmount, 0))}</td>
                        <td className="text-emerald-600">{formatCurrency(historyRows.reduce((sum, row) => sum + row.paidAmount, 0))}</td>
                        <td className="text-red-500">{formatCurrency(historyRows.reduce((sum, row) => sum + row.balanceAmount, 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                <div className="space-y-3 md:hidden">
                  {historyRows.map((row) => (
                    <section key={row.date} className="overflow-hidden rounded-2xl border border-iceblue-100 bg-white">
                      <div className="bg-iceblue-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-navy-900">{formatDate(`${row.date}T12:00:00+05:30`)}</p>
                            <p className="mt-1 text-xs font-semibold text-iceblue-700">{row.sales.length} sale{row.sales.length === 1 ? '' : 's'} · Daily total</p>
                          </div>
                          <p className="shrink-0 font-display text-lg font-bold text-navy-900">{formatBarQuantity(row.bars) || '0'} bars</p>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <HistoryAmount label="Total" value={row.totalAmount} />
                          <HistoryAmount label="Paid" value={row.paidAmount} tone="paid" />
                          <HistoryAmount label="Unpaid" value={row.balanceAmount} tone="unpaid" />
                        </div>
                      </div>
                      <div className="divide-y divide-iceblue-50">
                        {row.sales.map((sale) => {
                          const bars = (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0);
                          return (
                            <div key={sale._id} className="p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-navy-900">{formatHistoryTime(sale.date)}</p>
                                <span className="pill capitalize bg-iceblue-50 text-iceblue-700">{sale.saleType}</span>
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                <HistoryDetail label="Ice Bars" value={formatBarQuantity(bars) || '0'} />
                                <HistoryDetail label="Payment" value={sale.paymentMode || '-'} capitalize />
                                <HistoryDetail label="Total Amount" value={formatCurrency(sale.totalAmount)} />
                                <HistoryDetail label="Paid Amount" value={formatCurrency(sale.paidAmount)} tone="paid" />
                                <HistoryDetail label="Unpaid Amount" value={formatCurrency(sale.balanceAmount)} tone={Number(sale.balanceAmount || 0) > 0 ? 'unpaid' : undefined} />
                              </dl>
                              {sale.notes && <p className="mt-3 break-words rounded-xl bg-iceblue-50/70 px-3 py-2 text-xs text-navy-800/60">{sale.notes}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                  {historyRows.length === 0 && (
                    <p className="rounded-2xl bg-iceblue-50 px-4 py-8 text-center text-sm text-navy-800/50">No purchases for the selected range.</p>
                  )}
                </div>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CustomerSummaryCard({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
    <p className="text-[11px] font-semibold uppercase text-navy-800/45">{label}</p>
    <p className={`mt-2 font-display text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
  </div>;
}

function HistoryAmount({ label, value, tone }: { label: string; value: number; tone?: 'paid' | 'unpaid' }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-2 py-2">
      <p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p>
      <p className={`mt-1 break-words text-xs font-bold ${tone === 'paid' ? 'text-emerald-600' : tone === 'unpaid' && value > 0 ? 'text-red-500' : 'text-navy-900'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function HistoryDetail({ label, value, tone, capitalize = false }: { label: string; value: string; tone?: 'paid' | 'unpaid'; capitalize?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</dt>
      <dd className={`mt-1 break-words font-semibold ${capitalize ? 'capitalize' : ''} ${tone === 'paid' ? 'text-emerald-600' : tone === 'unpaid' ? 'text-red-500' : 'text-navy-900'}`}>
        {value}
      </dd>
    </div>
  );
}
