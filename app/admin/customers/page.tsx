'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiTag } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatBarQuantity, formatCurrency } from '../../../lib/api';
import Modal from '../../../components/Modal';

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
  const [priceForm, setPriceForm] = useState({ size: '1', saleType: 'retail', price: '' });

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
  };

  const savePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceTarget) return;
    await api.post('/price-list', { customer: priceTarget._id, ...priceForm, size: formatBarQuantity(priceForm.size), price: Number(priceForm.price) });
    const { data } = await api.get(`/price-list/customer/${priceTarget._id}`);
    setPrices(data);
    setPriceForm({ size: '1', saleType: 'retail', price: '' });
  };

  const removePrice = async (id: string) => {
    await api.delete(`/price-list/${id}`);
    setPrices(prices.filter((p) => p._id !== id));
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
                  <td className="font-medium">{c.name}</td>
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
        <Modal title={`Price List: ${priceTarget.name}`} onClose={() => setPriceTarget(null)} wide>
          <form onSubmit={savePrice} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="number"
              min={0.25}
              step={0.25}
              required
              className="input-field"
              placeholder="Bar Used e.g. 0.25, 1.25"
              value={priceForm.size}
              onChange={(e) => setPriceForm({ ...priceForm, size: e.target.value })}
            />
            <select className="input-field" value={priceForm.saleType} onChange={(e) => setPriceForm({ ...priceForm, saleType: e.target.value })}>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Price"
                required
                className="input-field"
                value={priceForm.price}
                onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
              />
              <button className="btn-primary shrink-0">Save</button>
            </div>
          </form>

          <table className="table-base">
            <thead>
              <tr>
                <th>Bar Used</th>
                <th>Type</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p._id}>
                  <td>{formatBarQuantity(p.size)} bar used</td>
                  <td className="capitalize">{p.saleType}</td>
                  <td>{formatCurrency(p.price)}</td>
                  <td>
                    <button onClick={() => removePrice(p._id)} className="text-red-500 text-xs">Remove</button>
                  </td>
                </tr>
              ))}
              {prices.length === 0 && (
                <tr><td colSpan={4} className="text-center text-navy-800/50 py-4">No custom prices set yet.</td></tr>
              )}
            </tbody>
          </table>
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
