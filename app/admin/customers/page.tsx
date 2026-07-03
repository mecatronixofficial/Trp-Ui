'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiTag } from 'react-icons/fi';
import api from '../../../lib/api';
import { ICE_BAR_SIZES, formatCurrency } from '../../../lib/api';
import Modal from '../../../components/Modal';

interface Customer {
  _id: string;
  name: string;
  phoneNumber: string;
  address: string;
  defaultSaleType: string;
  creditBalance: number;
  isActive: boolean;
}

const emptyForm = { name: '', phoneNumber: '', address: '', defaultSaleType: 'retail', notes: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [priceTarget, setPriceTarget] = useState<Customer | null>(null);
  const [prices, setPrices] = useState<any[]>([]);
  const [priceForm, setPriceForm] = useState({ size: '1', saleType: 'retail', price: '' });

  const load = async (q?: string) => {
    setLoading(true);
    const { data } = await api.get('/customers', { params: { search: q } });
    setCustomers(data);
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
    setForm({ name: c.name, phoneNumber: c.phoneNumber, address: c.address, defaultSaleType: c.defaultSaleType });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await api.patch(`/customers/${editing._id}`, form);
    else await api.post('/customers', form);
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
    await api.post('/price-list', { customer: priceTarget._id, ...priceForm, price: Number(priceForm.price) });
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
          <table className="table-base min-w-[700px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Credit Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.phoneNumber}</td>
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
            <button className="btn-primary w-full">{editing ? 'Save Changes' : 'Create Customer'}</button>
          </form>
        </Modal>
      )}

      {priceTarget && (
        <Modal title={`Price List: ${priceTarget.name}`} onClose={() => setPriceTarget(null)} wide>
          <form onSubmit={savePrice} className="grid grid-cols-3 gap-3 mb-4">
            <select className="input-field" value={priceForm.size} onChange={(e) => setPriceForm({ ...priceForm, size: e.target.value })}>
              {ICE_BAR_SIZES.map((s) => (
                <option key={s} value={s}>{s} bar</option>
              ))}
            </select>
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
                <th>Size</th>
                <th>Type</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p._id}>
                  <td>{p.size} bar</td>
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
