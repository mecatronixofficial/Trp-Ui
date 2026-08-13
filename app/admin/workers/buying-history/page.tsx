'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';
import api, { formatCurrency, formatDate } from '../../../../lib/api';

type Period = 'today' | 'weekly' | 'monthly';

const indiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftDay = (date: string, days: number) => { const value = new Date(`${date}T12:00:00+05:30`); value.setDate(value.getDate() + days); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value); };
const rangeFor = (period: Period) => { const to = indiaToday(); if (period === 'today') return { from: to, to }; if (period === 'weekly') return { from: shiftDay(to, -6), to }; return { from: `${to.slice(0, 7)}-01`, to }; };
const formatDateTime = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function BuyingHistoryPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const { data } = await api.get('/workers/buying', { params: rangeFor(period) }); setRows(Array.isArray(data) ? data : []); } catch (err: any) { setError(err?.response?.data?.message || 'Could not load daily buying history'); } finally { setLoading(false); } }, [period]);
  useEffect(() => { void load(); }, [load]);
  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0), [rows]);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-navy-800/45">Worker Management</p><h1 className="mt-1 font-display text-2xl font-bold text-navy-900">Daily Buying History</h1></div><Link href="/admin/workers" className="btn-secondary flex items-center gap-2"><FiArrowLeft /> Workers</Link></div>
    <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-iceblue-100 p-4"><div className="flex flex-wrap gap-2">{(['today','weekly','monthly'] as Period[]).map((item) => <button key={item} onClick={() => setPeriod(item)} className={`h-10 rounded-xl px-4 text-sm font-semibold capitalize ${period === item ? 'bg-navy-900 text-white' : 'bg-iceblue-50 text-navy-800'}`}>{item}</button>)}</div><p className="font-semibold text-navy-900">Total: <span className="text-red-600">{formatCurrency(total)}</span></p></div>
      {error && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">{loading ? <p className="p-6 text-navy-800/50">Loading history...</p> : <table className="w-full min-w-[820px] table-fixed border-collapse text-xs sm:text-sm"><thead className="bg-slate-100 text-navy-900"><tr><th className="w-[7%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">S.No</th><th className="w-[20%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Worker Name</th><th className="w-[15%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Buying Date</th><th className="w-[23%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Entry Date &amp; Time</th><th className="w-[15%] border border-slate-300 px-3 py-3 text-right font-bold uppercase">Amount</th><th className="w-[20%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Notes</th></tr></thead><tbody>{rows.map((row,index) => <tr key={row._id} className="even:bg-slate-50 hover:bg-iceblue-50/70"><td className="border border-slate-300 px-2 py-2.5 text-center">{index + 1}</td><td className="border border-slate-300 px-3 py-2.5 font-semibold text-navy-900">{row.worker?.name || 'Worker'}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatDate(row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-right font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td><td className="border border-slate-300 px-3 py-2.5">{row.notes || '-'}</td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="border border-slate-300 py-10 text-center text-navy-800/50">No records for this period.</td></tr>}</tbody>{rows.length > 0 && <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={4} className="border border-slate-300 px-3 py-3 text-right uppercase">Total</td><td className="border border-slate-300 px-3 py-3 text-right text-red-600">{formatCurrency(total)}</td><td className="border border-slate-300" /></tr></tfoot>}</table>}</div>
    </section>
  </div>;
}
