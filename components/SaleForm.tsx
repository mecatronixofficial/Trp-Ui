'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiCheckCircle, FiPlus, FiSearch, FiTrash2, FiUser, FiUserPlus } from 'react-icons/fi';
import api from '../lib/api';
import { PAYMENT_MODES, formatBarQuantity, formatCurrency, getItemBarUsed, todayISO } from '../lib/api';

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

const getCustomerTruckId = (customer: any) => (
  typeof customer?.truck === 'string' ? customer.truck : customer?.truck?._id || ''
);

export default function SaleForm({ trucks, fixedTruckId, onSaved, initial }: SaleFormProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [truck, setTruck] = useState(fixedTruckId || initial?.truck?._id || initial?.truck || '');
  const [customer, setCustomer] = useState(initial?.customer?._id || initial?.customer || '');
  const [saleType, setSaleType] = useState(initial?.saleType || 'retail');
  const [items, setItems] = useState<Item[]>(
    initial?.items?.map((i: any) => {
      const totalBars = getItemBarUsed(i);
      return {
        size: '1',
        quantity: formatBarQuantity(totalBars),
        pricePerBar: String(Number(i.quantity || 0) * Number(i.pricePerBar || 0)),
      };
    }) || [
      { size: '1', quantity: '', pricePerBar: '' },
    ],
  );
  const [paymentMode, setPaymentMode] = useState(initial?.paymentMode || 'cash');
  const [paidAmount, setPaidAmount] = useState(initial?.paidAmount?.toString() || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [priceList, setPriceList] = useState<any[]>([]);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCustomers = async () => {
    const { data } = await api.get('/customers');
    setCustomers(data);
    return data;
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!customer) return setPriceList([]);
    api.get(`/price-list/customer/${customer}`).then((res) => setPriceList(res.data));
  }, [customer]);

  const selectedCustomer = useMemo(() => customers.find((c) => c._id === customer), [customer, customers]);
  const activeTruck = fixedTruckId || truck;
  const visibleCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();

    return customers.filter((c) => {
      const customerTruck = typeof c.truck === 'string' ? c.truck : c.truck?._id;
      const truckMatch = !activeTruck || !customerTruck || customerTruck === activeTruck;
      const searchMatch =
        !term ||
        c.name?.toLowerCase().includes(term) ||
        c.phoneNumber?.toLowerCase().includes(term);

      return truckMatch && searchMatch;
    });
  }, [activeTruck, customerSearch, customers]);

  useEffect(() => {
    if (!selectedCustomer) return;
    const customerTruck = getCustomerTruckId(selectedCustomer);
    if (activeTruck && customerTruck && customerTruck !== activeTruck) {
      setCustomer('');
      setPriceList([]);
    }
  }, [activeTruck, selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer || initial?._id) return;
    setSaleType(selectedCustomer.defaultSaleType === 'wholesale' ? 'wholesale' : 'retail');
  }, [initial?._id, selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCustomerSearch(`${selectedCustomer.name}${selectedCustomer.phoneNumber ? ` - ${selectedCustomer.phoneNumber}` : ''}`);
  }, [selectedCustomer]);

  // Flat price for a single bar, set by admin per customer per sale type.
  const barPrice = useMemo(() => {
    const match = priceList.find((p) => p.saleType === saleType);
    return match ? Number(match.price) : null;
  }, [priceList, saleType]);

  const computeTotal = (quantity: string) => {
    const qty = Number(quantity) || 0;
    if (!qty || barPrice == null) return '';
    return String(Math.round(qty * barPrice * 100) / 100);
  };

  useEffect(() => {
    if (barPrice == null) return;
    setItems((prev) => prev.map((item) => {
      const suggested = computeTotal(item.quantity);
      return suggested ? { ...item, pricePerBar: suggested } : item;
    }));
  }, [barPrice]);

  const updateItem = (idx: number, field: keyof Item, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'quantity') {
        const suggested = computeTotal(value);
        if (suggested) next[idx].pricePerBar = suggested;
      }
      return next;
    });
  };

  const addItem = () => setItems([...items, { size: '1', quantity: '', pricePerBar: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  // Drivers only pick the customer and bar quantity — the price always comes from what admin set.
  const isDriver = !!fixedTruckId;
  const priceLocked = isDriver && barPrice == null;

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.pricePerBar) || 0), 0);
  const balance = totalAmount - (Number(paidAmount) || 0);
  const customerTruckId = getCustomerTruckId(selectedCustomer);
  const derivedTruck = fixedTruckId || customerTruckId || truck;

  // Admin sales use the stock remaining in the shop. Driver sales use only the
  // stock assigned to that driver's truck.
  useEffect(() => {
    let active = true;
    setAvailableStock(null);
    const request = fixedTruckId
      ? api.get(`/stock/truck/${fixedTruckId}`)
      : api.get('/stock');

    request
      .then((res) => {
        if (!active) return;
        setAvailableStock(Number(fixedTruckId ? res.data?.totalStock : res.data?.totalClosingStock) || 0);
      })
      .catch(() => { if (active) setAvailableStock(0); });

    return () => { active = false; };
  }, [fixedTruckId]);

  // No blank placeholder in the truck select, so default to the first truck once trucks load.
  useEffect(() => {
    if (!truck && !fixedTruckId && !customerTruckId && trucks && trucks.length > 0) setTruck(trucks[0]._id);
  }, [trucks, fixedTruckId, customerTruckId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!customer) {
      setError('Select or create customer');
      return;
    }
    if (!derivedTruck) {
      setError('No truck is available for this sale');
      return;
    }
    if (priceLocked) {
      setError('No price is set for this customer. Ask admin to set the bar price first.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: initial?._id ? initial.date : new Date().toISOString(),
        truck: derivedTruck,
        customer,
        saleType,
        items: items
          .filter((i) => Number(i.quantity) > 0)
          .map((i) => {
            const quantity = Number(i.quantity);
            const linePrice = Number(i.pricePerBar);
            return { size: '1', quantity, pricePerBar: quantity ? linePrice / quantity : 0 };
          }),
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
      {availableStock !== null && (
        <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold ${availableStock > 0 ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-600'}`}>
          <span>{fixedTruckId ? 'Available Ice Bars in Truck' : 'Available Ice Bars in Shop'}</span>
          <span className="text-lg">{formatBarQuantity(availableStock) || 0}</span>
        </div>
      )}

      <div>
        <label className="label-text">Customer Name / Phone</label>
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-iceblue-500" />
          <input
            className="input-field h-12 pl-11"
            placeholder="Search old customer by name or phone"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomer('');
            }}
          />
        </div>

        {!customer && customerSearch && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-iceblue-100 bg-white shadow-lg shadow-iceblue-900/10">
            {visibleCustomers.length === 0 ? (
              <div className="px-4 py-3">
                <p className="text-sm text-navy-800/50">{fixedTruckId ? 'No customer found. Ask admin to add this customer.' : 'No customer found.'}</p>
                {!fixedTruckId && (
                  <button
                    type="button"
                    onClick={() => router.push('/admin/customers')}
                    className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 text-sm font-semibold text-white transition hover:bg-iceblue-700"
                  >
                    <FiUserPlus /> Create Customer
                  </button>
                )}
              </div>
            ) : (
              visibleCustomers.slice(0, 8).map((c) => {
                  const customerTruck = typeof c.truck === 'object' && c.truck ? `${c.truck.truckName} (${c.truck.truckNumber})` : 'Local';
                  const isNew = String(c.createdAt || '').slice(0, 10) === todayISO();

                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => setCustomer(c._id)}
                      className="flex w-full items-start gap-3 border-b border-iceblue-50 px-4 py-3 text-left last:border-b-0 hover:bg-iceblue-50"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-600">
                        <FiUser />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-navy-900">{c.name}</span>
                          <span className={`pill shrink-0 ${isNew ? 'bg-emerald-50 text-emerald-600' : 'bg-navy-900/5 text-navy-800'}`}>
                            {isNew ? 'New' : 'Old'}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-navy-800/55">
                          {c.phoneNumber || 'No phone'} · {customerTruck}
                        </span>
                      </span>
                    </button>
                  );
                })
            )}
          </div>
        )}

        {selectedCustomer && (
          <div className="mt-3 rounded-2xl border border-iceblue-100 bg-iceblue-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-navy-900">
                  <FiCheckCircle className="shrink-0 text-emerald-600" />
                  <span className="truncate">{selectedCustomer.name}</span>
                </p>
                <p className="mt-1 text-xs text-navy-800/60">
                  {selectedCustomer.phoneNumber || 'No phone'} · {selectedCustomer.address || 'No address'}
                </p>
              </div>
              <span
                className={`pill shrink-0 ${
                  String(selectedCustomer.createdAt || '').slice(0, 10) === todayISO()
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-white text-navy-800'
                }`}
              >
                {String(selectedCustomer.createdAt || '').slice(0, 10) === todayISO() ? 'New Customer' : 'Old Customer'}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <InfoPill
                label="Type"
                value={getCustomerTruckId(selectedCustomer) ? 'Truck Customer' : selectedCustomer.defaultSaleType === 'wholesale' ? 'Wholesale' : 'Local / Retail'}
              />
              <InfoPill label="Truck" value={typeof selectedCustomer.truck === 'object' && selectedCustomer.truck ? selectedCustomer.truck.truckName : 'Local'} />
              <InfoPill label="Balance" value={formatCurrency(selectedCustomer.creditBalance || 0)} danger={Number(selectedCustomer.creditBalance || 0) > 0} />
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label-text">Items</label>
          {selectedCustomer && (
            <span className={`text-xs font-medium ${priceLocked ? 'text-red-500' : 'text-navy-800/50'}`}>
              {barPrice != null ? `${formatCurrency(barPrice)} / bar` : 'No price set for this customer — ask admin'}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-iceblue-100 bg-iceblue-50/60 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-center">
                <input
                  type="number" min={0.25} step={0.25} placeholder="Bar Used e.g. 0.25, 1.25" required
                  disabled={priceLocked}
                  className={`input-field h-11 disabled:cursor-not-allowed disabled:opacity-50 ${isDriver ? 'sm:col-span-8' : 'sm:col-span-4'}`}
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                />
                {!isDriver && (
                  <input
                    type="number" min={0} step="0.01" placeholder="Total" required
                    className="input-field h-11 sm:col-span-4"
                    value={item.pricePerBar}
                    onChange={(e) => updateItem(idx, 'pricePerBar', e.target.value)}
                  />
                )}
                <div className="flex h-11 items-center justify-between rounded-xl bg-white px-3 text-sm font-semibold text-navy-800 sm:col-span-3 sm:justify-end">
                  <span className="text-xs font-medium text-navy-800/45 sm:hidden">Total</span>
                  {formatCurrency(Number(item.pricePerBar) || 0)}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-semibold text-red-500 sm:col-span-1 sm:h-11"
                  aria-label="Remove item"
                >
                  <FiTrash2 />
                  <span className="sm:hidden">Remove</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} disabled={priceLocked} className="mt-2 text-iceblue-600 text-sm font-medium flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50">
          <FiPlus /> Add another item
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

function InfoPill({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p>
      <p className={`mt-1 truncate font-semibold capitalize ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
    </div>
  );
}
