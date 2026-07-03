'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../lib/api';
import { ICE_BAR_SIZES, PAYMENT_MODES, formatCurrency, todayISO } from '../lib/api';

interface SaleFormProps {
  trucks?: { _id: string; truckName: string }[]; // only needed for admin (truck picker)
  fixedTruckId?: string; // used for truck users
  onSaved: () => void;
  initial?: any; // existing sale for editing
}

interface Item {
  size: string;
  quantity: string;
  pricePerBar: string;
}

export default function SaleForm({ trucks, fixedTruckId, onSaved, initial }: SaleFormProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [date, setDate] = useState(initial?.date?.slice(0, 10) || todayISO());
  const [truck, setTruck] = useState(fixedTruckId || initial?.truck?._id || initial?.truck || '');
  const [customer, setCustomer] = useState(initial?.customer?._id || initial?.customer || '');
  const [saleType, setSaleType] = useState(initial?.saleType || 'retail');
  const [items, setItems] = useState<Item[]>(
    initial?.items?.map((i: any) => ({ size: i.size, quantity: String(i.quantity), pricePerBar: String(i.pricePerBar) })) || [
      { size: '1', quantity: '', pricePerBar: '' },
    ],
  );
  const [paymentMode, setPaymentMode] = useState(initial?.paymentMode || 'cash');
  const [paidAmount, setPaidAmount] = useState(initial?.paidAmount?.toString() || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [priceList, setPriceList] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data));
  }, []);

  useEffect(() => {
    if (!customer) return setPriceList([]);
    api.get(`/price-list/customer/${customer}`).then((res) => setPriceList(res.data));
  }, [customer]);

  const lookupPrice = (size: string) => {
    const match = priceList.find((p) => p.size === size && p.saleType === saleType);
    return match ? String(match.price) : '';
  };

  const updateItem = (idx: number, field: keyof Item, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'size') {
        const suggested = lookupPrice(value);
        if (suggested) next[idx].pricePerBar = suggested;
      }
      return next;
    });
  };

  const addItem = () => setItems([...items, { size: '1', quantity: '', pricePerBar: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.pricePerBar) || 0), 0);
  const balance = totalAmount - (Number(paidAmount) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        date,
        truck: fixedTruckId || truck,
        customer,
        saleType,
        items: items
          .filter((i) => Number(i.quantity) > 0)
          .map((i) => ({ size: i.size, quantity: Number(i.quantity), pricePerBar: Number(i.pricePerBar) })),
        paymentMode,
        paidAmount: Number(paidAmount) || 0,
        notes,
      };
      if (initial?._id) await api.patch(`/sales/${initial._id}`, payload);
      else await api.post('/sales', payload);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-text">Date</label>
          <input type="date" className="input-field" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label-text">Sale Type</label>
          <select className="input-field" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
      </div>

      {!fixedTruckId && trucks && (
        <div>
          <label className="label-text">Truck</label>
          <select className="input-field" required value={truck} onChange={(e) => setTruck(e.target.value)}>
            <option value="">Select truck</option>
            {trucks.map((t) => <option key={t._id} value={t._id}>{t.truckName}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="label-text">Customer</label>
        <select className="input-field" required value={customer} onChange={(e) => setCustomer(e.target.value)}>
          <option value="">Select customer</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="label-text">Items</label>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <select className="input-field col-span-3" value={item.size} onChange={(e) => updateItem(idx, 'size', e.target.value)}>
                {ICE_BAR_SIZES.map((s) => <option key={s} value={s}>{s} bar</option>)}
              </select>
              <input
                type="number" min={1} placeholder="Qty" required
                className="input-field col-span-3"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
              />
              <input
                type="number" min={0} step="0.01" placeholder="Price/bar" required
                className="input-field col-span-3"
                value={item.pricePerBar}
                onChange={(e) => updateItem(idx, 'pricePerBar', e.target.value)}
              />
              <div className="col-span-2 text-sm font-semibold text-navy-800 text-right">
                {formatCurrency((Number(item.quantity) || 0) * (Number(item.pricePerBar) || 0))}
              </div>
              <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-red-500 flex justify-center">
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-2 text-iceblue-600 text-sm font-medium flex items-center gap-1">
          <FiPlus /> Add another size
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-text">Payment Mode</label>
          <select className="input-field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            {PAYMENT_MODES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label-text">Paid Amount</label>
          <input type="number" min={0} step="0.01" className="input-field" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label-text">Notes</label>
        <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="bg-iceblue-50 border border-iceblue-100 rounded-xl p-3 flex justify-between text-sm">
        <span>Total: <strong>{formatCurrency(totalAmount)}</strong></span>
        <span className={balance > 0 ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'}>
          Balance: {formatCurrency(balance)}
        </span>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button className="btn-primary w-full" disabled={saving}>
        {saving ? 'Saving...' : initial?._id ? 'Save Changes' : 'Record Sale'}
      </button>
    </form>
  );
}
