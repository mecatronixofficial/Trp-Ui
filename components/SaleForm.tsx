'use client';

import { useEffect, useMemo, useState } from 'react';
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

type CustomerType = 'retail' | 'wholesale' | 'truck';

const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'retail', label: 'Local / Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'truck', label: 'Truck Customer' },
];

const getCustomerTruckId = (customer: any) => (
  typeof customer?.truck === 'string' ? customer.truck : customer?.truck?._id || ''
);

const typeToSaleType = (type: CustomerType) => (type === 'wholesale' ? 'wholesale' : 'retail');

export default function SaleForm({ trucks, fixedTruckId, onSaved, initial }: SaleFormProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [date, setDate] = useState(initial?.date?.slice(0, 10) || todayISO());
  const [truck, setTruck] = useState(fixedTruckId || initial?.truck?._id || initial?.truck || '');
  const [customer, setCustomer] = useState(initial?.customer?._id || initial?.customer || '');
  const [saleType, setSaleType] = useState(initial?.saleType || 'retail');
  const [customerType, setCustomerType] = useState<CustomerType>(
    initial?.customer?.truck ? 'truck' : initial?.saleType === 'wholesale' ? 'wholesale' : 'retail',
  );
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phoneNumber: '',
    address: '',
  });
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
  const [saving, setSaving] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
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
    const nextType = getCustomerTruckId(selectedCustomer)
      ? 'truck'
      : selectedCustomer.defaultSaleType === 'wholesale'
        ? 'wholesale'
        : 'retail';
    setCustomerType(nextType);
    setSaleType(typeToSaleType(nextType));
  }, [initial?._id, selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCustomerSearch(`${selectedCustomer.name}${selectedCustomer.phoneNumber ? ` - ${selectedCustomer.phoneNumber}` : ''}`);
    setCreatingCustomer(false);
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedCustomer || initial?._id) return;
    setSaleType(typeToSaleType(customerType));
  }, [customerType, initial?._id, selectedCustomer]);

  const prepareNewCustomer = () => {
    const raw = customerSearch.trim();
    const digits = raw.replace(/\D/g, '');
    const looksLikePhone = digits.length >= 6 && digits.length >= raw.replace(/\s/g, '').length - 2;

    setCustomerForm({
      name: looksLikePhone ? '' : raw,
      phoneNumber: looksLikePhone ? raw : '',
      address: '',
    });
    setCreatingCustomer(true);
  };

  const saveCustomer = async () => {
    setError('');
    if (!customerForm.name.trim()) {
      setError('Enter customer name');
      return;
    }

    setSavingCustomer(true);
    try {
      const customerTruck = customerType === 'truck' ? fixedTruckId || truck || undefined : undefined;
      const { data } = await api.post('/customers', {
        ...customerForm,
        defaultSaleType: typeToSaleType(customerType),
        truck: customerTruck,
      });
      const rows = await loadCustomers();
      const created = data?._id ? data : rows.find((row: any) => row.phoneNumber === customerForm.phoneNumber && row.name === customerForm.name);
      if (created?._id) setCustomer(created._id);
      setCustomerSearch(`${customerForm.name}${customerForm.phoneNumber ? ` - ${customerForm.phoneNumber}` : ''}`);
      setCreatingCustomer(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create customer');
    } finally {
      setSavingCustomer(false);
    }
  };

  const lookupPrice = (quantity: string) => {
    const normalizedQuantity = formatBarQuantity(quantity);
    const match = priceList.find((p) => formatBarQuantity(p.size) === normalizedQuantity && p.saleType === saleType);
    return match ? String(match.price) : '';
  };

  useEffect(() => {
    if (!priceList.length) return;
    setItems((prev) => prev.map((item) => {
      if (item.pricePerBar) return item;
      const suggested = lookupPrice(item.quantity);
      return suggested ? { ...item, pricePerBar: suggested } : item;
    }));
  }, [priceList, saleType]);

  const updateItem = (idx: number, field: keyof Item, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'quantity') {
        const suggested = lookupPrice(value);
        if (suggested) next[idx].pricePerBar = suggested;
      }
      return next;
    });
  };

  const addItem = () => setItems([...items, { size: '1', quantity: '', pricePerBar: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.pricePerBar) || 0), 0);
  const balance = totalAmount - (Number(paidAmount) || 0);
  const derivedTruck = fixedTruckId || getCustomerTruckId(selectedCustomer) || truck || trucks?.[0]?._id || '';

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
    setSaving(true);
    try {
      const payload = {
        date,
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-text">Date</label>
          <input type="date" className="input-field" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label-text">Customer Type</label>
          <select
            className="input-field"
            value={customerType}
            onChange={(e) => {
              const nextType = e.target.value as CustomerType;
              setCustomerType(nextType);
              setSaleType(typeToSaleType(nextType));
            }}
          >
            {CUSTOMER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

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
              setCreatingCustomer(false);
            }}
          />
        </div>

        {!customer && customerSearch && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-iceblue-100 bg-white shadow-lg shadow-iceblue-900/10">
            {visibleCustomers.length === 0 ? (
              <div className="px-4 py-3">
                <p className="text-sm text-navy-800/50">No customer found.</p>
                <button
                  type="button"
                  onClick={prepareNewCustomer}
                  className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 text-sm font-semibold text-white transition hover:bg-iceblue-700"
                >
                  <FiUserPlus /> Create customer
                </button>
              </div>
            ) : (
              <>
                {visibleCustomers.slice(0, 8).map((c) => {
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
                })}
                <div className="border-t border-iceblue-50 px-4 py-3">
                  <button
                    type="button"
                    onClick={prepareNewCustomer}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-iceblue-700 ring-1 ring-iceblue-100 transition hover:bg-iceblue-50"
                  >
                    <FiUserPlus /> Create new customer
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {creatingCustomer && (
          <div className="mt-3 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-text">Name</label>
                <input
                  className="input-field h-11"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label-text">Mobile Number</label>
                <input
                  className="input-field h-11"
                  inputMode="tel"
                  value={customerForm.phoneNumber}
                  onChange={(e) => setCustomerForm({ ...customerForm, phoneNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="label-text">Address</label>
              <textarea
                className="input-field"
                rows={2}
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={saveCustomer}
              disabled={savingCustomer}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition hover:bg-iceblue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <FiUserPlus /> {savingCustomer ? 'Creating...' : 'Create and Select'}
            </button>
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
              <InfoPill label="Type" value={customerType === 'truck' ? 'Truck Customer' : customerType} />
              <InfoPill label="Truck" value={typeof selectedCustomer.truck === 'object' && selectedCustomer.truck ? selectedCustomer.truck.truckName : 'Local'} />
              <InfoPill label="Balance" value={formatCurrency(selectedCustomer.creditBalance || 0)} danger={Number(selectedCustomer.creditBalance || 0) > 0} />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="label-text">Items</label>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-iceblue-100 bg-iceblue-50/60 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-center">
                <input
                  type="number" min={0.25} step={0.25} placeholder="Bar Used e.g. 0.25, 1.25" required
                  className="input-field h-11 sm:col-span-4"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                />
                <input
                  type="number" min={0} step="0.01" placeholder="Price" required
                  className="input-field h-11 sm:col-span-4"
                  value={item.pricePerBar}
                  onChange={(e) => updateItem(idx, 'pricePerBar', e.target.value)}
                />
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
        <button type="button" onClick={addItem} className="mt-2 text-iceblue-600 text-sm font-medium flex items-center gap-1">
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
