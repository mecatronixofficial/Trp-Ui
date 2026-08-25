'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDollarSign,
  FiEdit2,
  FiEye,
  FiGitBranch,
  FiGrid,
  FiHome,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiTruck,
  FiUsers,
} from 'react-icons/fi';
import api from '../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';
import Modal from '../../../components/Modal';
import PaymentModal from '../../../components/PaymentModal';
import { useAuth } from '../../../context/AuthContext';

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
  retailPrice?: number;
  wholesalePrice?: number;
  creditBalance: number;
  isActive: boolean;
  customerType?: 'local' | 'truck';
  truck?: { _id: string; truckName: string; truckNumber: string; driverName?: string } | string | null;
  notes?: string;
  createdByName?: string;
  createdBy?: { displayName?: string; username?: string; name?: string } | string;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

const emptyForm = { customerType: 'local', name: '', phoneNumber: '', address: '', defaultSaleType: 'retail', defaultPrice: '', truck: '', notes: '', isActive: true };
const creatorFromNotes = (notes?: string) => String(notes || '').match(/^\[Created by: ([^\]]+)\]/)?.[1] || '';
const notesWithoutCreator = (notes?: string) => String(notes || '')
  .replace(/^\[Created by: [^\]]+\]\s*/, '')
  .replace(/\[Customer price: (?:retail|wholesale)=[0-9]+(?:\.[0-9]+)?\]\s*/gi, '')
  .trim();
const notesPrice = (customer: Customer) => Number(String(customer.notes || '')
  .match(new RegExp(`\\[Customer price: ${customer.defaultSaleType || 'retail'}=([0-9]+(?:\\.[0-9]+)?)\\]`, 'i'))?.[1] || 0);
const customerDefaultPrice = (customer: Customer) => {
  const price = customer.defaultSaleType === 'wholesale' ? customer.wholesalePrice : customer.retailPrice;
  return Number(price || notesPrice(customer) || 0);
};
const creatorName = (customer: Customer) => customer.createdByName
  || (typeof customer.createdBy === 'object' && customer.createdBy
    ? customer.createdBy.displayName || customer.createdBy.name || customer.createdBy.username
    : '')
  || creatorFromNotes(customer.notes)
  || 'Not recorded';
const customerTruckName = (customer: Customer) => typeof customer.truck === 'object' && customer.truck
  ? `${customer.truck.truckName}${customer.truck.truckNumber ? ` (${customer.truck.truckNumber})` : ''}`
  : customer.truck ? 'Assigned truck' : 'Local';

export default function CustomersPage() {
  const { user, loading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'truck'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null);
  const [historyRange, setHistoryRange] = useState({ from: last30Days(), to: indiaTodayISO() });
  const [historyRows, setHistoryRows] = useState<HistoryDay[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [collectionTarget, setCollectionTarget] = useState<Customer | null>(null);
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [collectionSale, setCollectionSale] = useState<any>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState('');
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageCustomers = !isSuperAdmin || Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const overallView = Boolean(isSuperAdmin && !selectedBranch);

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

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const customerType = customer.customerType || (customer.truck ? 'truck' : 'local');
    if (typeFilter !== 'all' && customerType !== typeFilter) return false;
    if (statusFilter === 'active' && customer.isActive === false) return false;
    if (statusFilter === 'inactive' && customer.isActive !== false) return false;
    return true;
  }), [customers, statusFilter, typeFilter]);

  const activeCustomers = useMemo(() => customers.filter((customer) => customer.isActive !== false).length, [customers]);
  const totalPending = customerTotals.truckPending + customerTotals.localPending;
  const scopeName = overallView ? 'All branches' : activeBranch?.name || 'Assigned branch';

  const load = async (q?: string) => {
    setLoading(true);
    setPageError('');
    try {
      const { data } = await api.get('/customers', { params: q ? { search: q } : {} });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setCustomers([]);
      setPageError(error?.response?.data?.message || error?.message || 'Could not load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
    setSelectedBranch(isSuperAdmin ? storedBranch : (user?.branch || ''));
    if (isSuperAdmin) {
      api.get('/branches')
        .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
        .catch(() => setBranches([]));
    }
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null || !canManageCustomers) {
      setTrucks([]);
      return;
    }
    api.get('/trucks')
      .then(({ data }) => setTrucks(Array.isArray(data) ? data : []))
      .catch(() => setTrucks([]));
  }, [authLoading, canManageCustomers, selectedBranch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(timer);
  }, [authLoading, search, selectedBranch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  const openCreate = () => {
    if (!canManageCustomers) return;
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    if (!canManageCustomers) return;
    setEditing(c);
    const truckId = typeof c.truck === 'string' ? c.truck : c.truck?._id || '';
    setForm({
      customerType: c.customerType || (truckId ? 'truck' : 'local'),
      name: c.name,
      phoneNumber: c.phoneNumber || '',
      address: c.address || '',
      defaultSaleType: c.defaultSaleType || 'retail',
      defaultPrice: customerDefaultPrice(c) > 0 ? String(customerDefaultPrice(c)) : '',
      truck: truckId,
      notes: notesWithoutCreator(c.notes),
      isActive: c.isActive !== false,
    });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCustomers) return;
    setFormError('');
    const defaultPrice = Number(form.defaultPrice);
    if (!Number.isFinite(defaultPrice) || defaultPrice <= 0) {
      setFormError('Enter a default ice bar price greater than zero.');
      return;
    }
    const normalizedName = String(form.name || '').trim().toLocaleLowerCase();
    const normalizedPhone = String(form.phoneNumber || '').replace(/\D/g, '');
    const duplicate = customers.find((customer) => customer._id !== editing?._id && (customer.name.trim().toLocaleLowerCase() === normalizedName || (normalizedPhone && String(customer.phoneNumber || '').replace(/\D/g, '') === normalizedPhone)));
    if (duplicate) {
      setFormError(duplicate.name.trim().toLocaleLowerCase() === normalizedName ? 'A customer with this name already exists.' : 'A customer with this phone number already exists.');
      return;
    }
    const { defaultPrice: _defaultPrice, ...customerFields } = form;
    const saleType = form.defaultSaleType === 'wholesale' ? 'wholesale' : 'retail';
    const createdBy = editing && creatorName(editing) !== 'Not recorded'
      ? `[Created by: ${creatorName(editing)}]`
      : '';
    const priceMarker = `[Customer price: ${saleType}=${defaultPrice}]`;
    const payload = {
      ...customerFields,
      truck: form.customerType === 'truck' ? form.truck : null,
      retailPrice: saleType === 'retail' ? defaultPrice : Number(editing?.retailPrice || 0),
      wholesalePrice: saleType === 'wholesale' ? defaultPrice : Number(editing?.wholesalePrice || 0),
      notes: [createdBy, priceMarker, String(form.notes || '').trim()].filter(Boolean).join('\n'),
    };
    setSavingCustomer(true);
    try {
      if (editing) await api.patch(`/customers/${editing._id}`, payload);
      else await api.post('/customers', payload);
      setModalOpen(false);
      void load(search);
    } catch (error: any) {
      setFormError(error?.response?.data?.message || 'Could not save customer. A duplicate value may already exist.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const remove = async (c: Customer) => {
    if (!canManageCustomers) return;
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    setDeletingCustomerId(c._id);
    setPageError('');
    try {
      await api.delete(`/customers/${c._id}`);
      await load(search);
    } catch (error: any) {
      setPageError(error?.response?.data?.message || `Could not delete ${c.name}.`);
    } finally {
      setDeletingCustomerId('');
    }
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

  const loadPendingSales = async (customer: Customer) => {
    setCollectionLoading(true);
    setCollectionError('');
    try {
      const { data } = await api.get('/sales', { params: { customer: customer._id } });
      setPendingSales((Array.isArray(data) ? data : [])
        .filter((sale: any) => Number(sale.balanceAmount || 0) > 0)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error: any) {
      setPendingSales([]);
      setCollectionError(error?.response?.data?.message || 'Could not load pending customer bills.');
    } finally {
      setCollectionLoading(false);
    }
  };

  const openCollection = (customer: Customer) => {
    setCollectionTarget(customer);
    setCollectionSale(null);
    void loadPendingSales(customer);
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100">
              {isSuperAdmin ? <FiShield /> : <FiLock />}
              {isSuperAdmin ? 'Super admin customer centre' : 'Branch customer workspace'}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Customer directory</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overallView
                ? `Review customers and outstanding balances across ${branches.length} branches. Select a branch to make changes.`
                : `Manage customer profiles, collections, and purchase history for ${scopeName}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{scopeName}</span>
            <button type="button" onClick={() => void load(search)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50"><FiRefreshCw /> Refresh</button>
            {canManageCustomers && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-iceblue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-iceblue-400"><FiPlus /> Add customer</button>}
          </div>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => changeBranch('')} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${overallView ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><FiGrid /> All branches <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${overallView ? 'bg-white/10' : 'bg-slate-100'}`}>{branches.length}</span></button>
            <span className="h-6 w-px shrink-0 bg-slate-200" />
            {branches.filter((branch) => branch.isActive).map((branch) => (
              <button key={branch._id} type="button" onClick={() => changeBranch(branch._id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${selectedBranch === branch._id ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-inset ring-iceblue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><span className="h-2 w-2 rounded-full bg-emerald-500" />{branch.name}<span className="text-[9px] font-semibold text-slate-400">{branch.code}</span></button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><FiCheckCircle /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Assigned branch active</p><p className="mt-0.5 text-[10px] text-slate-500">Customer records and collections are automatically scoped to your branch.</p></div>
        </section>
      )}

      {overallView && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><FiLock /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Network directory is read-only</p><p className="mt-1 text-[10px] leading-4 text-slate-600">You can search customers and review purchase history across the network. Select a branch to add, edit, delete, or collect pending payments.</p></div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerSummaryCard
          icon={FiUsers}
          label="Total Customers"
          value={customerTotals.total}
          helperLabel="Active"
          helperValue={String(activeCustomers)}
          tone="blue"
        />
        <CustomerSummaryCard
          icon={FiTruck}
          label="Truck Customers"
          value={customerTotals.truck}
          helperLabel="Truck Pending"
          helperValue={formatCurrency(customerTotals.truckPending)}
          danger={customerTotals.truckPending > 0}
          tone="cyan"
        />
        <CustomerSummaryCard
          icon={FiHome}
          label="Local Customers"
          value={customerTotals.local}
          helperLabel="Local Pending"
          helperValue={formatCurrency(customerTotals.localPending)}
          danger={customerTotals.localPending > 0}
          tone="violet"
        />
        <CustomerSummaryCard
          icon={FiDollarSign}
          label="Total Outstanding"
          value={formatCurrency(totalPending)}
          helperLabel="Customers due"
          helperValue={String(customers.filter((customer) => Number(customer.creditBalance || 0) > 0).length)}
          danger={totalPending > 0}
          tone="amber"
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="mr-auto flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiUsers /></span>
            <div><h2 className="font-extrabold text-navy-900">{overallView ? 'All customers' : `${scopeName} customers`}</h2><p className="mt-0.5 text-[10px] text-slate-500">{filteredCustomers.length} of {customers.length} customer records</p></div>
          </div>
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs font-semibold text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-iceblue-300 focus:bg-white focus:ring-4 focus:ring-iceblue-50" placeholder="Search name, phone, or address..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select aria-label="Filter customer type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-iceblue-300"><option value="all">All types</option><option value="local">Local</option><option value="truck">Truck</option></select>
            <select aria-label="Filter customer status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-iceblue-300"><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </div>
          {canManageCustomers && <button onClick={openCreate} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-xs font-bold text-white transition hover:bg-iceblue-800"><FiPlus /> Add customer</button>}
        </div>
        {pageError && <div className="m-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600"><FiAlertCircle className="mt-0.5 shrink-0" />{pageError}</div>}
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <>
            <div className="sm:hidden">
              {filteredCustomers.map((c, index) => (
                <div key={c._id} className="border-b border-slate-100 px-4 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-navy-800/45">{index + 1}</span>
                        <Link href={`/admin/customers/${c._id}`} className="min-w-0 truncate font-semibold text-navy-900 underline-offset-2 hover:underline">
                          {c.name}
                        </Link>
                      </div>
                      <p className="mt-1 break-all pl-8 text-xs text-navy-800/55">{c.phoneNumber || '-'}</p>
                      <p className="mt-0.5 truncate pl-8 text-xs text-navy-800/45">{c.address || '-'}</p>
                      <p className="mt-0.5 truncate pl-8 text-xs text-navy-800/45">Created by: {creatorName(c)}</p>
                      <p className="mt-0.5 truncate pl-8 text-xs text-navy-800/45">Truck: {customerTruckName(c)}</p>
                      <p className="mt-0.5 truncate pl-8 text-xs font-bold text-emerald-700">Default price: {customerDefaultPrice(c) > 0 ? `${formatCurrency(customerDefaultPrice(c))} / bar` : 'Not set'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-extrabold ${c.creditBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(c.creditBalance)}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-1 text-[9px] font-bold ${(c.customerType || (c.truck ? 'truck' : 'local')) === 'truck' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>
                        {(c.customerType || (c.truck ? 'truck' : 'local')) === 'truck' ? 'Truck' : 'Local'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 pl-8">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{c.isActive ? 'Active' : 'Inactive'}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <button title="View details and purchase history" aria-label={`View ${c.name} details`} onClick={() => openHistory(c)} className="text-navy-900 hover:text-black">
                        <FiEye />
                      </button>
                      {canManageCustomers && <>
                      {Number(c.creditBalance || 0) > 0 && (
                        <button title="Collect pending amount" aria-label={`Collect pending amount from ${c.name}`} onClick={() => openCollection(c)} className="text-emerald-600 transition hover:text-emerald-800">
                          <FiDollarSign />
                        </button>
                      )}
                      <button title="Edit" onClick={() => openEdit(c)} className="text-navy-900 hover:text-black">
                        <FiEdit2 />
                      </button>
                      <button title="Delete" disabled={deletingCustomerId === c._id} onClick={() => remove(c)} className="text-navy-900 hover:text-black disabled:cursor-wait disabled:opacity-40">
                        <FiTrash2 />
                      </button>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="px-4 py-12 text-center text-sm text-navy-800/50">No customers match the current filters.</p>
              )}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1060px] table-fixed border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/80 text-slate-400">
                  <tr>
                    <th className="w-[6%] border-b border-slate-100 px-1 py-3 text-center text-[9px] font-black uppercase tracking-wider">#</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Customer</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Created by</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Truck</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-center text-[9px] font-black uppercase tracking-wider">Type</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-right text-[9px] font-black uppercase tracking-wider">Default Price</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-right text-[9px] font-black uppercase tracking-wider">Outstanding</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-center text-[9px] font-black uppercase tracking-wider">Status</th>
                    <th className="border-b border-slate-100 px-3 py-3 text-center text-[9px] font-black uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((c, index) => (
                    <tr key={c._id} className="transition hover:bg-iceblue-50/40">
                      <td className="px-3 py-4 text-center text-xs text-slate-400">{index + 1}</td>
                      <td className="break-words px-3 py-4">
                        <Link href={`/admin/customers/${c._id}`} className="font-medium text-navy-900 underline-offset-2 hover:underline">
                          {c.name}
                        </Link>
                        <p className="mt-1 break-all text-[11px] font-medium text-slate-500">{c.phoneNumber || 'No phone number'}</p>
                        <p className="mt-1 break-words text-[11px] text-slate-400">{c.address || 'No address'}</p>
                      </td>
                      <td className="break-words px-3 py-4 text-xs text-slate-500">{creatorName(c)}</td>
                      <td className="break-words px-3 py-4 text-xs text-slate-500">{customerTruckName(c)}</td>
                      <td className="px-3 py-4 text-center">
                        <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${(c.customerType || (c.truck ? 'truck' : 'local')) === 'truck' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>
                          {(c.customerType || (c.truck ? 'truck' : 'local')) === 'truck' ? 'Truck' : 'Local'}
                        </span>
                      </td>
                      <td className={`px-3 py-4 text-right text-xs font-bold ${customerDefaultPrice(c) > 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                        {customerDefaultPrice(c) > 0 ? `${formatCurrency(customerDefaultPrice(c))} / bar` : 'Not set'}
                      </td>
                      <td className={`break-words px-3 py-4 text-right text-xs font-extrabold ${c.creditBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(c.creditBalance)}</td>
                      <td className="px-3 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{c.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button title="View details and purchase history" aria-label={`View ${c.name} details`} onClick={() => openHistory(c)} className="text-navy-900 hover:text-black">
                            <FiEye />
                          </button>
                          {canManageCustomers && <>
                          {Number(c.creditBalance || 0) > 0 && (
                            <button title="Collect pending amount" aria-label={`Collect pending amount from ${c.name}`} onClick={() => openCollection(c)} className="text-emerald-600 transition hover:text-emerald-800">
                              <FiDollarSign />
                            </button>
                          )}
                          <button title="Edit" onClick={() => openEdit(c)} className="text-navy-900 hover:text-black">
                            <FiEdit2 />
                          </button>
                          <button title="Delete" disabled={deletingCustomerId === c._id} onClick={() => remove(c)} className="text-navy-900 hover:text-black disabled:cursor-wait disabled:opacity-40">
                            <FiTrash2 />
                          </button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-14 text-center text-navy-800/50">No customers match the current filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

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
            <div>
              <label className="label-text">Default Ice Bar Price</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-navy-800/45">₹</span>
                <input required type="number" min="0.01" step="0.01" inputMode="decimal" className="input-field pl-8" placeholder="Price for one full ice bar" value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} />
              </div>
              <p className="mt-1 text-xs text-navy-800/45">Automatically used when creating a {form.defaultSaleType} sale for this customer.</p>
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {editing && <div>
              <label className="label-text">Status</label>
              <select className="input-field" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>}
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
            {formError && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{formError}</p>}
            <button disabled={savingCustomer} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60">{savingCustomer ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}</button>
          </form>
        </Modal>
      )}

      {collectionTarget && !collectionSale && (
        <Modal title={`Collect Amount: ${collectionTarget.name}`} onClose={() => setCollectionTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-emerald-50 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Pending amount</p>
                <p className="mt-1 text-sm font-semibold text-navy-900">{(collectionTarget.customerType || (collectionTarget.truck ? 'truck' : 'local')) === 'truck' ? 'Truck Customer' : 'Local Customer'} · {collectionTarget.phoneNumber || 'No phone'}</p>
              </div>
              <p className="shrink-0 font-display text-xl font-bold text-red-600">{formatCurrency(pendingSales.reduce((sum, sale) => sum + Number(sale.balanceAmount || 0), 0))}</p>
            </div>

            {collectionError && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{collectionError}</p>}
            {collectionLoading ? (
              <p className="py-8 text-center text-sm text-navy-800/50">Loading pending bills...</p>
            ) : pendingSales.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-8 text-center">
                <FiCheckCircle className="mx-auto text-2xl text-emerald-600" />
                <p className="mt-2 text-sm font-semibold text-emerald-700">No pending amount remains.</p>
              </div>
            ) : (
              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {pendingSales.map((sale) => (
                  <div key={sale._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-navy-800/55">{formatDate(sale.date)}</p>
                      <p className="mt-1 text-sm font-bold text-navy-900">Bill {formatCurrency(sale.totalAmount)}</p>
                      <p className="text-xs font-semibold text-red-600">Pending {formatCurrency(sale.balanceAmount)}</p>
                    </div>
                    <button type="button" onClick={() => setCollectionSale({ ...sale, customer: sale.customer || collectionTarget })} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700">
                      <FiDollarSign /> Collect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {collectionSale && collectionTarget && (
        <PaymentModal
          sale={collectionSale}
          onClose={() => setCollectionSale(null)}
          onSaved={() => {
            setCollectionSale(null);
            void loadPendingSales(collectionTarget);
            void load(search);
          }}
        />
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
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Default Price</p>
                <p className={`mt-1 font-bold ${customerDefaultPrice(historyTarget) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{customerDefaultPrice(historyTarget) > 0 ? `${formatCurrency(customerDefaultPrice(historyTarget))} / bar` : 'Not set'}</p>
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

function CustomerSummaryCard({ icon: Icon, label, value, helperLabel, helperValue, danger = false, tone = 'blue' }: { icon: any; label: string; value: string | number; helperLabel?: string; helperValue?: string; danger?: boolean; tone?: 'blue' | 'cyan' | 'violet' | 'amber' }) {
  const styles = {
    blue: { card: 'from-blue-50 to-white', icon: 'bg-blue-600', accent: 'bg-blue-500' },
    cyan: { card: 'from-cyan-50 to-white', icon: 'bg-cyan-600', accent: 'bg-cyan-500' },
    violet: { card: 'from-violet-50 to-white', icon: 'bg-violet-600', accent: 'bg-violet-500' },
    amber: { card: 'from-amber-50 to-white', icon: 'bg-amber-500', accent: 'bg-amber-500' },
  }[tone];
  return (
    <div className={`relative flex min-h-[108px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-iceblue-100 bg-gradient-to-br px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles.card}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${styles.accent}`} />
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg text-white shadow-sm ${styles.icon}`}>
        <Icon />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/45">{label}</p>
        <p className="mt-1 break-words font-display text-base font-bold leading-tight text-navy-900">{value}</p>
        {helperLabel && helperValue && (
          <p className="mt-0.5 text-xs font-semibold text-navy-800/55">
            {helperLabel}: <span className={`text-sm font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{helperValue}</span>
          </p>
        )}
      </div>
    </div>
  );
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
