'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiCheckCircle, FiPlus, FiSearch, FiTrash2, FiUser, FiUserPlus } from 'react-icons/fi';
import api from '../lib/api';
import { PAYMENT_MODES, formatBarQuantity, formatCurrency, getItemBarUsed } from '../lib/api';
import { isQuarterBarQuantity, toSaleApiItems } from '../lib/sale-items';
import { getOpeningProductionStock } from '../lib/production-stock';

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

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(date));

export default function SaleForm({ trucks, fixedTruckId, onSaved, initial }: SaleFormProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState('');
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
  const customerRequestRef = useRef(0);

  const loadCustomers = async (search = '') => {
    const requestId = ++customerRequestRef.current;
    setCustomersLoading(true);
    setCustomersError('');
    try {
      const { data } = await api.get('/customers', {
        params: { limit: 10000, ...(search.trim() ? { search: search.trim() } : {}) },
      });
      const rows = Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : [];
      const initialCustomer = initial?.customer && typeof initial.customer === 'object' ? initial.customer : null;
      const completeRows = initialCustomer && !rows.some((row: any) => row._id === initialCustomer._id)
        ? [initialCustomer, ...rows]
        : rows;
      if (requestId === customerRequestRef.current) setCustomers(completeRows);
      return completeRows;
    } catch (requestError: any) {
      if (requestId === customerRequestRef.current) {
        setCustomers([]);
        setCustomersError(requestError?.response?.data?.message || 'Could not load customers.');
      }
      return [];
    } finally {
      if (requestId === customerRequestRef.current) setCustomersLoading(false);
    }
  };

  useEffect(() => {
    if (customer || showAllCustomers) return;
    const term = customerSearch.trim();
    const timer = window.setTimeout(() => void loadCustomers(term), term ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [customer, customerSearch, showAllCustomers]);

  useEffect(() => {
    if (!customer) return setPriceList([]);
    api.get(`/price-list/customer/${customer}`)
      .then((res) => {
        const rows = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.records)
            ? res.data.records
            : res.data
              ? [res.data]
              : [];
        setPriceList(rows);
      })
      .catch(() => setPriceList([]));
  }, [customer]);

  const selectedCustomer = useMemo(() => customers.find((c) => c._id === customer), [customer, customers]);
  const visibleCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();

    return customers.filter((c) => {
      const searchMatch =
        !term ||
        String(c.name || '').toLowerCase().includes(term) ||
        String(c.phoneNumber || '').toLowerCase().includes(term);

      return searchMatch;
    }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [customerSearch, customers]);

  useEffect(() => {
    if (!selectedCustomer || initial?._id) return;
    setSaleType(selectedCustomer.defaultSaleType === 'wholesale' ? 'wholesale' : 'retail');
  }, [initial?._id, selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCustomerSearch(`${selectedCustomer.name}${selectedCustomer.phoneNumber ? ` - ${selectedCustomer.phoneNumber}` : ''}`);
  }, [selectedCustomer]);

  // Flat price for a single bar, stored per customer and sale type.
  const barPrice = useMemo(() => {
    const normalizedType = String(saleType || '').toLowerCase();
    const match = priceList.find((p) => String(p.saleType || p.type || '').toLowerCase() === normalizedType);
    const customerPrice = normalizedType === 'wholesale'
      ? selectedCustomer?.wholesalePrice
      : selectedCustomer?.retailPrice;
    const notesPrice = String(selectedCustomer?.notes || '').match(new RegExp(`\\[Customer price: ${normalizedType}=([0-9]+(?:\\.[0-9]+)?)\\]`, 'i'))?.[1];
    const resolved = Number(match?.price ?? match?.pricePerBar ?? customerPrice ?? notesPrice);
    return Number.isFinite(resolved) && resolved > 0 ? resolved : null;
  }, [priceList, saleType, selectedCustomer]);

  const computeTotal = (quantity: string) => {
    const qty = Number(quantity) || 0;
    if (!qty || barPrice == null) return '';
    return String(Math.round(qty * barPrice * 100) / 100);
  };

  useEffect(() => {
    setItems((prev) => prev.map((item) => {
      const suggested = computeTotal(item.quantity);
      return { ...item, pricePerBar: suggested };
    }));
  }, [barPrice]);

  const updateItem = (idx: number, field: keyof Item, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'quantity') {
        const suggested = computeTotal(value);
        next[idx].pricePerBar = suggested;
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
  const initialTruckId = typeof initial?.truck === 'string' ? initial.truck : initial?.truck?._id || '';
  // Customer-to-truck assignment is only customer classification; it must not
  // silently turn an admin shop sale into a truck sale. Drivers always use
  // their own truck, while editing keeps the original sale location.
  const derivedTruck = fixedTruckId || (initial?._id ? initialTruckId : '');

  // Admin sales show the same "Shop Ready" quantity as the production page:
  // today's production less stock movements and truck assignments, plus
  // outsourced bars. Driver sales still use their truck's stock.
  useEffect(() => {
    let active = true;
    setAvailableStock(null);
    const request = fixedTruckId
      ? api.get(`/stock/truck/${fixedTruckId}`)
      : Promise.all([
        api.get('/production'),
        api.get('/stock-entries'),
        api.get('/outsource-entries'),
        api.get('/truck-loads'),
        api.get('/sales'),
        api.get('/wastage'),
        api.get('/daily-closing', { params: { date: indiaDateKey(new Date()) } }),
      ]);

    request
      .then((res: any) => {
        if (!active) return;
        if (fixedTruckId) {
          setAvailableStock(Number(res.data?.totalStock) || 0);
          return;
        }

        const [productionRows, stockRows, outsourceRows, truckLoadRows, saleRows, wastageRows, closingRows] = res;
        const today = indiaDateKey(new Date());
        const closing = (Array.isArray(closingRows.data) ? closingRows.data : [])[0];
        if (closing?.status === 'closed') {
          setAvailableStock(0);
          return;
        }
        const sessionStartedAt = closing?.sessionStartedAt ? new Date(closing.sessionStartedAt).getTime() : 0;
        const inCurrentSession = (row: any) => !sessionStartedAt || new Date(row.createdAt || row.date).getTime() >= sessionStartedAt;
        const allProductionRows = Array.isArray(productionRows.data) ? productionRows.data : [];
        const produced = allProductionRows
          .filter((row: any) => indiaDateKey(row.date) === today && inCurrentSession(row))
          .reduce((sum: number, row: any) => sum + Number(row.totalBars || 0), 0);
        const allStockRows = Array.isArray(stockRows.data) ? stockRows.data : [];
        // Once a daily-closing record exists for today, it is the authoritative
        // source for stock carried into a (possibly reopened) session — same
        // fix as the production page's summary calculation.
        const openingStock = produced > 0
          ? (closing
              ? Math.max(0, Number(closing.openingBalance || 0))
              : getOpeningProductionStock(allStockRows, today, indiaDateKey, undefined, allProductionRows))
          : 0;
        const stocked = allStockRows
          .filter((row: any) => indiaDateKey(row.date) === today && inCurrentSession(row))
          .reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
        const outsourced = (Array.isArray(outsourceRows.data) ? outsourceRows.data : [])
          .filter((row: any) => indiaDateKey(row.date) === today && inCurrentSession(row))
          .reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
        const assigned = (Array.isArray(truckLoadRows.data) ? truckLoadRows.data : [])
          .filter((row: any) => indiaDateKey(row.date) === today && inCurrentSession(row))
          .reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
        const shopSold = (Array.isArray(saleRows.data) ? saleRows.data : [])
          .filter((sale: any) => indiaDateKey(sale.date) === today && !sale.truck && inCurrentSession(sale))
          .reduce((sum: number, sale: any) => sum + (sale.items || []).reduce(
            (itemSum: number, item: any) => itemSum + getItemBarUsed(item), 0,
          ), 0);
        const wasted = (Array.isArray(wastageRows.data) ? wastageRows.data : [])
          .filter((row: any) => indiaDateKey(row.date) === today && !row.truck && row.reason !== 'unsold' && inCurrentSession(row))
          .reduce((sum: number, row: any) => sum + getItemBarUsed(row), 0);

        setAvailableStock(Math.max(0, produced + openingStock - stocked + outsourced - assigned - shopSold - wasted));
      })
      .catch(() => { if (active) setAvailableStock(0); });

    return () => { active = false; };
  }, [fixedTruckId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!customer) {
      setError('Select or create customer');
      return;
    }
    if (priceLocked) {
      setError('No price is set for this customer. Ask admin to set the bar price first.');
      return;
    }
    if (items.some((item) => item.quantity !== '' && !isQuarterBarQuantity(item.quantity))) {
      setError('Ice bar quantity must be 0.25 or more and use 0.25 steps (for example 0.25, 0.50, 0.75, 1).');
      return;
    }
    if (totalAmount <= 0) {
      setError('Enter an item quantity and make sure this customer has a valid bar price.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: initial?._id ? initial.date : new Date().toISOString(),
        ...(derivedTruck ? { truck: derivedTruck } : {}),
        customer,
        saleType,
        items: items
          .filter((i) => Number(i.quantity) > 0)
          .flatMap((i) => toSaleApiItems(i.quantity, i.pricePerBar)),
        paymentMode,
        paidAmount: Number(paidAmount) || 0,
        totalAmount,
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
            className="input-field h-12 pl-11 pr-16"
            placeholder="Search old customer by name or phone"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomer('');
              setShowAllCustomers(false);
            }}
          />
          <button
            type="button"
            onClick={() => {
              const opening = !showAllCustomers;
              setCustomer('');
              setCustomerSearch('');
              setShowAllCustomers(opening);
              if (opening) void loadCustomers();
            }}
            className={`absolute right-2 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center rounded-lg px-3 text-xs font-bold transition ${showAllCustomers ? 'bg-navy-900 text-white' : 'bg-iceblue-50 text-iceblue-700 hover:bg-iceblue-100'}`}
            aria-expanded={showAllCustomers}
            aria-label="Show all customers in this branch"
          >
            All
          </button>
        </div>

        {!customer && (customerSearch || showAllCustomers) && (
          <div className="mt-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-iceblue-100 bg-white shadow-lg shadow-iceblue-900/10 sm:max-h-[43rem]">
            {showAllCustomers && !customersLoading && !customersError && (
              <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-iceblue-100 bg-iceblue-50 px-4 py-2 text-xs font-semibold text-navy-800">
                <span>All branch customers</span>
                <span>{visibleCustomers.length}</span>
              </div>
            )}
            {customersLoading ? (
              <p className="px-4 py-5 text-center text-sm text-navy-800/50">Loading customers...</p>
            ) : customersError ? (
              <div className="px-4 py-4 text-sm text-red-600">
                <p>{customersError}</p>
                <button type="button" onClick={() => void loadCustomers()} className="mt-2 font-semibold text-navy-900 underline">Try again</button>
              </div>
            ) : visibleCustomers.length === 0 ? (
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
              visibleCustomers.map((c) => {
                  const customerTruck = typeof c.truck === 'object' && c.truck ? `${c.truck.truckName} (${c.truck.truckNumber})` : 'Local';

                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => {
                        setCustomer(c._id);
                        setShowAllCustomers(false);
                      }}
                      className="flex min-h-[64px] w-full items-start gap-3 border-b border-iceblue-50 px-4 py-3 text-left last:border-b-0 hover:bg-iceblue-50"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-600">
                        <FiUser />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-900">{c.name}</span>
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
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase text-navy-800/45">Balance</p>
                <p className="mt-1 text-xs font-semibold text-red-600">
                  {formatCurrency(selectedCustomer.creditBalance || 0)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <InfoPill
                label="Type"
                value={getCustomerTruckId(selectedCustomer) ? 'Truck Customer' : selectedCustomer.defaultSaleType === 'wholesale' ? 'Wholesale' : 'Local / Retail'}
              />
              <InfoPill label="Truck" value={typeof selectedCustomer.truck === 'object' && selectedCustomer.truck ? selectedCustomer.truck.truckName : 'Local'} />
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label-text">Items</label>
          {selectedCustomer && (
            <span className={`text-xs font-medium ${priceLocked ? 'text-red-500' : 'text-navy-800/50'}`}>
              {barPrice != null ? `${formatCurrency(barPrice)} / bar` : 'No price set for this customer — create or update the customer price'}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-iceblue-100 bg-iceblue-50/60 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-center">
                <input
                  type="number" min={0.25} step={0.25} inputMode="decimal" placeholder="0.25, 0.50, 0.75, 1..." required
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
