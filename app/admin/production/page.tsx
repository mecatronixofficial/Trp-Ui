'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../../../lib/api';
import { PRODUCTION_ICE_BAR_SIZES, formatCurrency, formatDate, getItemBarUsed, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';

export default function ProductionPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [wastage, setWastage] = useState<any[]>([]);
  const [closings, setClosings] = useState<any[]>([]);
  const [driverClosings, setDriverClosings] = useState<any[]>([]);
  const [closingError, setClosingError] = useState<any>(null);
  const [closeTarget, setCloseTarget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState('full_day');
  const [notes, setNotes] = useState('');
  const [sizeWise, setSizeWise] = useState<Record<string, string>>(
    Object.fromEntries(PRODUCTION_ICE_BAR_SIZES.map((s) => [s, ''])),
  );

  const load = async () => {
    setLoading(true);
    const [productionRows, saleRows, wastageRows, closingRows, driverRows] = await Promise.all([
      api.get('/production'), api.get('/sales'), api.get('/wastage'), api.get('/daily-closing', { params: { date: todayISO() } }), api.get('/truck-loads/reconciliation', { params: { date: todayISO() } }),
    ]);
    setRecords(productionRows.data);
    setSales(saleRows.data);
    setWastage(wastageRows.data);
    setClosings(closingRows.data);
    setDriverClosings(driverRows.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const total = Object.values(sizeWise).reduce((s, v) => s + (Number(v) || 0), 0);
  const summary = useMemo(() => {
    const produced = records.reduce((sum, row) => sum + Number(row.totalBars || 0), 0);
    const sold = sales.reduce((sum, sale) => sum + (sale.items || []).reduce((itemSum: number, item: any) => itemSum + getItemBarUsed(item), 0), 0);
    const wasted = wastage.filter((row) => row.reason !== 'unsold').reduce((sum, row) => sum + getItemBarUsed(row), 0);
    return { produced, sold, wasted, balance: produced - sold - wasted };
  }, [records, sales, wastage]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      date,
      shift,
      notes,
      sizeWise: PRODUCTION_ICE_BAR_SIZES.map((size) => ({ size, quantity: Number(sizeWise[size]) || 0 })).filter((s) => s.quantity > 0),
    };
    await api.post('/production', payload);
    setModalOpen(false);
    setSizeWise(Object.fromEntries(PRODUCTION_ICE_BAR_SIZES.map((s) => [s, ''])));
    setNotes('');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this production record?')) return;
    await api.delete(`/production/${id}`);
    load();
  };
  const closeDay = async (row: any) => {
    setClosingError(null);
    try { await api.post('/daily-closing/close', { date: todayISO(), branch: row.branch?._id || row.branch }); setCloseTarget(null); await load(); }
    catch (err: any) { setClosingError(err?.response?.data || { message: 'Could not close the branch' }); }
  };
  const canCloseBranch = (row: any) => {
    const branchId = String(row.branch?._id || row.branch || '');
    const related = driverClosings.filter((driver) => {
      const driverBranch = driver.truck?.branch?._id || driver.truck?.branch;
      return !branchId || !driverBranch || String(driverBranch) === branchId;
    });
    return related.every((driver) => driver.driverClosed);
  };
  const reopenDay = async (row: any) => {
    if (!confirm(`Mark today's ice-bar account as NOT CLOSED for ${row.branch?.name || 'this branch'}? Sales and all daily entries will be enabled again.`)) return;
    await api.post('/daily-closing/reopen', { date: todayISO(), branch: row.branch?._id || row.branch });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ProductionSummary label="Total Bars" value={summary.produced} />
        <ProductionSummary label="Sold Bars" value={summary.sold} />
        <ProductionSummary label="Wastage" value={summary.wasted} danger={summary.wasted > 0} />
        <ProductionSummary label="Balance Bars" value={summary.balance} danger={summary.balance < 0} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-display text-lg font-semibold text-navy-900">Daily Ice-Bar Closing</h2><p className="text-xs text-navy-800/50">Close every branch after checking at 8:00 PM</p></div>
          <span className="pill bg-iceblue-50 text-iceblue-700">{formatDate(todayISO())}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {closings.map((row) => <div key={row._id} className={`rounded-2xl border p-4 shadow-sm ${row.status === 'closed' ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-white'}`}>
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-navy-900">{row.branch?.name || 'Selected Branch'} {row.branch?.code ? `(${row.branch.code})` : ''}</p><p className="mt-1 text-xs text-navy-800/55">Opening balance: {row.openingBalance}</p></div><span className={`pill ${row.status === 'closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.status === 'closed' ? 'Closed' : 'Not Closed'}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Made', row.produced], ['Sold', row.sold], ['Returned', row.returned], ['Wastage', row.wastage], ['Balance', row.closingBalance]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 font-bold text-navy-900">{value}</p></div>)}</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ClosingMoney label="Selling Amount" value={row.sellingAmount} />
              <ClosingMoney label="Making Cost" value={row.makingCost} danger={row.makingCost > row.sellingAmount} />
              <ClosingMoney label={row.profit >= 0 ? 'Daily Profit' : 'Daily Loss'} value={row.profit} danger={row.profit < 0} />
            </div>
            {row.status === 'closed' ? <div className="mt-4 space-y-3"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><FiCheckCircle /> Daily account checked and closed</p><button onClick={() => reopenDay(row)} className="btn-secondary flex w-full items-center justify-center gap-2 border-amber-200 text-amber-700"><FiAlertCircle /> Mark Not Closed / Reopen</button></div> : <button onClick={() => setCloseTarget(row)} disabled={!canCloseBranch(row)} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-navy-800/30"><FiAlertCircle /> {canCloseBranch(row) ? 'Check & Close Today' : 'Waiting for Drivers to Close'}</button>}
          </div>)}
        </div>
      </section>

      {closeTarget && <Modal title={`Close Day: ${closeTarget.branch?.name || 'Branch'}`} onClose={() => setCloseTarget(null)} wide>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Confirm all driver accounts and branch totals. Driver balances move to Unsold Returns. Any remaining branch balance ({Math.max(0, Number(closeTarget.closingBalance || 0))} bars) will also be moved to Returns.</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[['Opening', closeTarget.openingBalance], ['Made', closeTarget.produced], ['Sold', closeTarget.sold], ['Final Returns', Math.max(0, Number(closeTarget.closingBalance || 0))], ['Wastage', closeTarget.wastage], ['Closing Balance', Math.min(0, Number(closeTarget.closingBalance || 0))]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-iceblue-50 p-3"><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 text-lg font-bold text-navy-900">{value}</p></div>)}</div>
          <ClosingTally row={closeTarget} />
          <div className="grid gap-2 sm:grid-cols-3"><ClosingMoney label="Selling Amount" value={closeTarget.sellingAmount} /><ClosingMoney label="Making Cost" value={closeTarget.makingCost} danger={closeTarget.makingCost > closeTarget.sellingAmount} /><ClosingMoney label={closeTarget.profit >= 0 ? 'Daily Profit' : 'Daily Loss'} value={closeTarget.profit} danger={closeTarget.profit < 0} /></div>
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700"><FiCheckCircle /> All active drivers are closed</p>
          <div className="grid grid-cols-2 gap-3"><button onClick={() => setCloseTarget(null)} className="btn-secondary">Cancel</button><button onClick={() => closeDay(closeTarget)} className="btn-primary">Yes, Close Branch</button></div>
        </div>
      </Modal>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-lg font-semibold text-navy-900">Driver Closing Status</h2><p className="text-xs text-navy-800/50">Every driver must close before the branch can close.</p></div><span className={`pill ${driverClosings.every((row) => row.driverClosed) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{driverClosings.filter((row) => row.driverClosed).length}/{driverClosings.length} closed</span></div>
        {closingError && <div className="rounded-2xl border border-red-100 bg-red-50 p-4"><p className="font-semibold text-red-700">{closingError.message}</p>{closingError.unclosedDrivers?.map((driver: any) => <p key={driver.truckId} className="mt-2 text-sm text-red-600">{driver.driverName} — {driver.truckName}: {driver.reason}</p>)}</div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {driverClosings.map((row) => <div key={row.truckId} className={`rounded-2xl border p-4 ${row.driverClosed ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-white'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-navy-900">{row.truck?.driverName || 'Driver'}</p><p className="mt-1 text-xs text-navy-800/55">{row.truck?.truckName || 'Truck'} {row.truck?.truckNumber ? `(${row.truck.truckNumber})` : ''}</p></div><span className={`pill ${row.driverClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.driverClosed ? 'Closed' : 'Not Closed'}</span></div><p className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${row.driverClosed ? 'bg-white text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{row.closeReason}</p><div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs"><div><b>{row.taken}</b><span className="block text-navy-800/45">Taken</span></div><div><b>{row.sold}</b><span className="block text-navy-800/45">Sold</span></div><div><b>{row.returned}</b><span className="block text-navy-800/45">Return</span></div><div><b>{row.remaining}</b><span className="block text-navy-800/45">Balance</span></div></div></div>)}
        </div>
      </section>
      <div className="flex items-center justify-between">
        <p className="text-navy-800/60 text-sm">Daily production is usually 130–200 bars</p>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <FiPlus /> Add Production
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <table className="table-base min-w-[700px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift</th>
                <th>Size-wise</th>
                <th>Total Bars</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{formatDate(r.date)}</td>
                  <td className="capitalize">{r.shift.replace('_', ' ')}</td>
                  <td className="text-xs text-navy-800/70">
                    {r.sizeWise.map((s: any) => `${s.size}: ${s.quantity}`).join(', ')}
                  </td>
                  <td className="font-semibold">{r.totalBars}</td>
                  <td>
                    <button onClick={() => remove(r._id)} className="text-red-500"><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title="Add Daily Production" onClose={() => setModalOpen(false)} wide>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Date</label>
                <input type="date" className="input-field" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label-text">Shift</label>
                <select className="input-field" value={shift} onChange={(e) => setShift(e.target.value)}>
                  <option value="full_day">Full Day</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label-text">Full Bar Production</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PRODUCTION_ICE_BAR_SIZES.map((size) => (
                  <div key={size}>
                    <span className="text-xs text-navy-800/60">{size} bar</span>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={sizeWise[size]}
                      onChange={(e) => setSizeWise({ ...sizeWise, [size]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-iceblue-600 font-semibold mt-2">Total: {total} bars</p>
            </div>

            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button className="btn-primary w-full">Save Production</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProductionSummary({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-800/45">{label}</p>
    <p className={`mt-2 font-display text-2xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
  </div>;
}

function ClosingTally({ row }: { row: any }) {
  const available = Number(row.openingBalance || 0) + Number(row.produced || 0);
  const finalReturns = Math.max(0, Number(row.closingBalance || 0));
  const accounted = Number(row.sold || 0) + finalReturns + Number(row.wastage || 0);
  const tallied = available === accounted;
  return <div className={`rounded-2xl border p-4 ${tallied ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
    <div className="flex items-center justify-between gap-3"><p className={`font-semibold ${tallied ? 'text-emerald-800' : 'text-red-700'}`}>Final Bar Tally</p><span className={`pill ${tallied ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{tallied ? 'Tallied' : 'Not Tallied'}</span></div>
    <p className="mt-2 text-sm font-semibold text-navy-900">{available} available = {Number(row.sold || 0)} sold + {finalReturns} returned + {Number(row.wastage || 0)} wastage = {accounted}</p>
    <p className="mt-1 text-xs text-navy-800/55">Opening + Made = Sold + Returned + Wastage</p>
  </div>;
}

function ClosingMoney({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className={`rounded-xl px-3 py-3 ${danger ? 'bg-red-50' : 'bg-white'}`}><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className={`mt-1 font-bold ${danger ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(value || 0)}</p></div>;
}
