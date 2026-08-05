'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertCircle,
  FiBox,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSettings,
  FiTrash2,
  FiTruck,
} from 'react-icons/fi';
import api from '../../../lib/api';
import { getItemBarUsed, formatDate } from '../../../lib/api';
import Modal from '../../../components/Modal';

type BoxInfo = { nextOpen: number; totalBoxes: number; barsPerBox: number };
type TruckOption = { _id: string; truckName: string; truckNumber: string };
type TruckLoad = {
  _id: string;
  date: string;
  quantity: number;
  createdAt?: string;
  truck?: TruckOption | string;
};

// quarter-bar quantities (0.25, 0.5, 0.75...) display with 2 decimals; whole numbers stay clean
const fmtBars = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(date));

const todayIndiaISO = () => indiaDateKey(new Date());

const nextIndiaDayLabel = (day: string) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date(new Date(`${day}T12:00:00+05:30`).getTime() + 86_400_000));

export default function ProductionPage() {
  const [activeDay, setActiveDay] = useState(todayIndiaISO());
  const [records, setRecords] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [wastage, setWastage] = useState<any[]>([]);
  const [stockEntries, setStockEntries] = useState<any[]>([]);
  const [outsourceEntries, setOutsourceEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [boxInfo, setBoxInfo] = useState<BoxInfo | null>(null);
  const [date, setDate] = useState(todayIndiaISO());
  const [boxClose, setBoxClose] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [prodSettingsOpen, setProdSettingsOpen] = useState(false);
  const [prodSettingsForm, setProdSettingsForm] = useState({ totalBoxes: '', barsPerBox: '' });
  const [prodSettingsSaving, setProdSettingsSaving] = useState(false);
  const [prodSettingsError, setProdSettingsError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'production' | 'stock' | 'outsource'; id: string; label: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockEditing, setStockEditing] = useState<any | null>(null);
  const [stockDate, setStockDate] = useState(todayIndiaISO());
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [stockError, setStockError] = useState('');
  const [outsourceModalOpen, setOutsourceModalOpen] = useState(false);
  const [outsourceEditing, setOutsourceEditing] = useState<any | null>(null);
  const [outsourceDate, setOutsourceDate] = useState(todayIndiaISO());
  const [outsourceQuantity, setOutsourceQuantity] = useState('');
  const [outsourceNotes, setOutsourceNotes] = useState('');
  const [outsourceError, setOutsourceError] = useState('');
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [truckLoads, setTruckLoads] = useState<TruckLoad[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<Record<string, number>>({});
  const [closings, setClosings] = useState<any[]>([]);
  const [driverClosings, setDriverClosings] = useState<any[]>([]);
  const [closeTarget, setCloseTarget] = useState<any | null>(null);
  const [closingError, setClosingError] = useState<any>(null);
  const [checkingTruck, setCheckingTruck] = useState('');
  const [closingDay, setClosingDay] = useState(false);
  const [truckBarsOpen, setTruckBarsOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState('');
  const [exactTruckBars, setExactTruckBars] = useState('');
  const [savingTruckBars, setSavingTruckBars] = useState(false);
  const [truckBarsError, setTruckBarsError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingAction, setPendingAction] = useState('');

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setLoadError('');
    try {
      const [productionRows, saleRows, wastageRows, stockRows, outsourceRows, truckRows, assignmentRows, truckLoadRows, closingRows, reconciliationRows] = await Promise.all([
        api.get('/production'), api.get('/sales'), api.get('/wastage'), api.get('/stock-entries'), api.get('/outsource-entries'),
        api.get('/trucks'), api.get('/truck-assignments', { params: { date: activeDay } }),
        api.get('/truck-loads'),
        api.get('/daily-closing', { params: { date: activeDay } }),
        api.get('/truck-loads/reconciliation', { params: { date: activeDay } }),
      ]);
      setRecords(Array.isArray(productionRows.data) ? productionRows.data : []);
      setSales(Array.isArray(saleRows.data) ? saleRows.data : []);
      setWastage(Array.isArray(wastageRows.data) ? wastageRows.data : []);
      setStockEntries(Array.isArray(stockRows.data) ? stockRows.data : []);
      setOutsourceEntries(Array.isArray(outsourceRows.data) ? outsourceRows.data : []);
      const availableTrucks = Array.isArray(truckRows.data) ? truckRows.data : [];
      setTrucks(availableTrucks);
      setTruckLoads(Array.isArray(truckLoadRows.data) ? truckLoadRows.data : []);
      setClosings(Array.isArray(closingRows.data) ? closingRows.data : []);
      setDriverClosings(Array.isArray(reconciliationRows.data) ? reconciliationRows.data : []);
      setTruckAssignments(Object.fromEntries((Array.isArray(assignmentRows.data) ? assignmentRows.data : []).map((row: any) => [
        String(row.truck?._id || row.truck), Number(row.quantity || 0),
      ])));
      setSelectedTruck((current) => current || availableTrucks[0]?._id || '');
      setLastUpdated(new Date());
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load production data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeDay]);

  const fetchNextBox = async () => {
    const { data } = await api.get('/production/next-box');
    setBoxInfo(data);
    return data as BoxInfo;
  };

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const moveToCurrentDay = () => {
      const currentIndiaDay = todayIndiaISO();
      setActiveDay((previousDay) => previousDay === currentIndiaDay ? previousDay : currentIndiaDay);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') moveToCurrentDay();
    };

    const dayWatcher = window.setInterval(moveToCurrentDay, 30_000);
    window.addEventListener('focus', moveToCurrentDay);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(dayWatcher);
      window.removeEventListener('focus', moveToCurrentDay);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const summary = useMemo(() => {
    const today = activeDay;
    const produced = records
      .filter((row) => indiaDateKey(row.date) === today)
      .reduce((sum, row) => sum + Number(row.totalBars || 0), 0);
    const sold = sales
      .filter((sale) => indiaDateKey(sale.date) === today)
      .reduce((sum, sale) => sum + (sale.items || []).reduce((itemSum: number, item: any) => itemSum + getItemBarUsed(item), 0), 0);
    const wasted = wastage
      .filter((row) => indiaDateKey(row.date) === today && row.reason !== 'unsold')
      .reduce((sum, row) => sum + getItemBarUsed(row), 0);
    const stocked = stockEntries
      .filter((row) => indiaDateKey(row.date) === today)
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const outsourced = outsourceEntries
      .filter((row) => indiaDateKey(row.date) === today)
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const assigned = Object.values(truckAssignments).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
    // Production total updates live when stock is deducted, outsource bars are
    // added, and bars are taken by trucks.
    const finalTotal = produced - stocked + outsourced - assigned;
    return {
      produced,
      sold,
      wasted,
      stocked,
      outsourced,
      assigned,
      balance: produced - sold - wasted,
      finalTotal,
    };
  }, [records, sales, wastage, stockEntries, outsourceEntries, truckAssignments, activeDay]);

  const todaysSales = useMemo(
    () => sales.filter((sale) => indiaDateKey(sale.date) === activeDay),
    [sales, activeDay],
  );

  const soldByTruck = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of todaysSales) {
      const truckId = String(sale.truck?._id || sale.truck || '');
      if (!truckId) continue;
      const sold = (sale.items || []).reduce(
        (sum: number, item: any) => sum + getItemBarUsed(item),
        0,
      );
      totals[truckId] = (totals[truckId] || 0) + sold;
    }
    return totals;
  }, [todaysSales]);

  const truckSoldToday = useMemo(
    () => Object.values(soldByTruck).reduce((sum, quantity) => sum + quantity, 0),
    [soldByTruck],
  );

  const shopSoldToday = Math.max(0, summary.sold - truckSoldToday);

  const soldByTruckAndDate = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of sales) {
      const truckId = String(sale.truck?._id || sale.truck || '');
      if (!truckId) continue;
      const key = `${indiaDateKey(sale.date)}:${truckId}`;
      totals[key] = (totals[key] || 0) + (sale.items || []).reduce(
        (sum: number, item: any) => sum + getItemBarUsed(item),
        0,
      );
    }
    return totals;
  }, [sales]);

  const truckReportRows = useMemo(() => {
    const rows: Record<string, {
      key: string;
      date: string;
      truckId: string;
      truckName: string;
      truckNumber: string;
      assignments: TruckLoad[];
      taken: number;
      sold: number;
    }> = {};

    for (const loadRow of truckLoads) {
      const truck = typeof loadRow.truck === 'object' && loadRow.truck ? loadRow.truck : null;
      const truckId = String(truck?._id || loadRow.truck || '');
      if (!truckId) continue;
      const dateKey = indiaDateKey(loadRow.date);
      const key = `${dateKey}:${truckId}`;
      if (!rows[key]) {
        const fallbackTruck = trucks.find((item) => item._id === truckId);
        rows[key] = {
          key,
          date: dateKey,
          truckId,
          truckName: truck?.truckName || fallbackTruck?.truckName || 'Truck',
          truckNumber: truck?.truckNumber || fallbackTruck?.truckNumber || '',
          assignments: [],
          taken: 0,
          sold: Number(soldByTruckAndDate[key] || 0),
        };
      }
      rows[key].assignments.push(loadRow);
      rows[key].taken += Number(loadRow.quantity || 0);
    }

    return Object.values(rows)
      .map((row) => ({
        ...row,
        assignments: row.assignments.sort((a, b) => String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date))),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [truckLoads, trucks, soldByTruckAndDate]);

  const todaysRecord = useMemo(
    () => records.find((r) => indiaDateKey(r.date) === activeDay) || null,
    [records, activeDay],
  );

  const todaysOutsource = useMemo(
    () => outsourceEntries.find((o) => indiaDateKey(o.date) === activeDay) || null,
    [outsourceEntries, activeDay],
  );

  const todaysStock = useMemo(
    () => stockEntries.find((s) => indiaDateKey(s.date) === activeDay) || null,
    [stockEntries, activeDay],
  );

  const stockByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of stockEntries) {
      const key = indiaDateKey(s.date);
      map[key] = (map[key] || 0) + Number(s.quantity || 0);
    }
    return map;
  }, [stockEntries]);

  const outsourceByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of outsourceEntries) {
      const key = indiaDateKey(o.date);
      map[key] = (map[key] || 0) + Number(o.quantity || 0);
    }
    return map;
  }, [outsourceEntries]);

  const openModal = async () => {
    setError('');
    setEditing(null);
    setDate(activeDay);
    setBoxClose('');
    setNotes('');
    setBoxInfo(null);
    setModalOpen(true);
    try {
      await fetchNextBox();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the next box reading');
    }
  };

  const openEdit = async (record: any) => {
    setError('');
    setEditing(record);
    setDate(String(record.date).slice(0, 10));
    setBoxClose(String(record.boxClose));
    setNotes(record.notes || '');
    setBoxInfo(null);
    setModalOpen(true);
    try {
      const { data } = await api.get('/settings');
      setBoxInfo({ nextOpen: record.boxOpen, totalBoxes: data.totalBoxes, barsPerBox: data.barsPerBox });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load production settings');
    }
  };

  const preview = useMemo(() => {
    if (!boxInfo || boxClose === '') return null;
    const open = boxInfo.nextOpen;
    const close = Number(boxClose);
    if (!Number.isFinite(close) || close < 1 || close > boxInfo.totalBoxes) return null;
    const boxesProduced = (close >= open ? close - open : (boxInfo.totalBoxes - open) + close) + 1;
    return { boxesProduced, barsProduced: boxesProduced * boxInfo.barsPerBox };
  }, [boxInfo, boxClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxInfo || !preview) return;
    setError('');
    setPendingAction('production');
    try {
      const payload = { date, boxOpen: boxInfo.nextOpen, boxClose: Number(boxClose), notes };
      if (editing) {
        await api.patch(`/production/${editing._id}`, payload);
      } else {
        await api.post('/production', payload);
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save production');
    } finally {
      setPendingAction('');
    }
  };

  const deleteEndpoints = { production: '/production', stock: '/stock-entries', outsource: '/outsource-entries' };

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setPendingAction('delete');
    try {
      await api.delete(`${deleteEndpoints[deleteTarget.kind]}/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Could not delete');
    } finally {
      setPendingAction('');
    }
  };

  const openStockModal = () => {
    setStockError('');
    setStockEditing(null);
    setStockDate(activeDay);
    setStockQuantity('');
    setStockNotes('');
    setStockModalOpen(true);
  };

  const openStockEdit = (entry: any) => {
    setStockError('');
    setStockEditing(entry);
    setStockDate(String(entry.date).slice(0, 10));
    setStockQuantity(String(entry.quantity));
    setStockNotes(entry.notes || '');
    setStockModalOpen(true);
  };

  const submitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setStockError('');
    setPendingAction('stock');
    try {
      const payload = { date: stockDate, quantity: Number(stockQuantity), notes: stockNotes };
      if (stockEditing) {
        await api.patch(`/stock-entries/${stockEditing._id}`, payload);
      } else {
        await api.post('/stock-entries', payload);
      }
      setStockModalOpen(false);
      await load();
    } catch (err: any) {
      setStockError(err?.response?.data?.message || 'Could not save stock entry');
    } finally {
      setPendingAction('');
    }
  };

  const openOutsourceModal = () => {
    setOutsourceError('');
    setOutsourceEditing(null);
    setOutsourceDate(activeDay);
    setOutsourceQuantity('');
    setOutsourceNotes('');
    setOutsourceModalOpen(true);
  };

  const openOutsourceEdit = (entry: any) => {
    setOutsourceError('');
    setOutsourceEditing(entry);
    setOutsourceDate(String(entry.date).slice(0, 10));
    setOutsourceQuantity(String(entry.quantity));
    setOutsourceNotes(entry.notes || '');
    setOutsourceModalOpen(true);
  };

  const submitOutsource = async (e: React.FormEvent) => {
    e.preventDefault();
    setOutsourceError('');
    setPendingAction('outsource');
    try {
      const payload = { date: outsourceDate, quantity: Number(outsourceQuantity), notes: outsourceNotes };
      if (outsourceEditing) {
        await api.patch(`/outsource-entries/${outsourceEditing._id}`, payload);
      } else {
        await api.post('/outsource-entries', payload);
      }
      setOutsourceModalOpen(false);
      await load();
    } catch (err: any) {
      setOutsourceError(err?.response?.data?.message || 'Could not save outsourced bars');
    } finally {
      setPendingAction('');
    }
  };

  const openProdSettings = async () => {
    setProdSettingsError('');
    setProdSettingsOpen(true);
    try {
      const { data } = await api.get('/settings');
      setProdSettingsForm({
        totalBoxes: String(data.totalBoxes ?? 200),
        barsPerBox: String(data.barsPerBox ?? 2),
      });
    } catch (err: any) {
      setProdSettingsError(err?.response?.data?.message || 'Could not load production settings');
    }
  };

  const saveProdSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdSettingsError('');
    setProdSettingsSaving(true);
    try {
      await api.patch('/settings', {
        totalBoxes: Number(prodSettingsForm.totalBoxes),
        barsPerBox: Number(prodSettingsForm.barsPerBox),
      });
      setProdSettingsOpen(false);
      if (boxInfo) await fetchNextBox();
    } catch (err: any) {
      setProdSettingsError(err?.response?.data?.message || 'Could not save production settings');
    } finally {
      setProdSettingsSaving(false);
    }
  };

  const openTruckBars = () => {
    const truckId = selectedTruck || trucks[0]?._id || '';
    setSelectedTruck(truckId);
    setExactTruckBars('');
    setTruckBarsError('');
    setTruckBarsOpen(true);
  };

  const changeSelectedTruck = (truckId: string) => {
    setSelectedTruck(truckId);
    setExactTruckBars('');
    setTruckBarsError('');
  };

  const addTruckBars = async (quantity: number) => {
    if (!selectedTruck) {
      setTruckBarsError('Select a truck');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTruckBarsError('Enter a valid bar quantity');
      return;
    }
    setSavingTruckBars(true);
    setTruckBarsError('');
    try {
      const { data } = await api.post('/truck-assignments/add', { truck: selectedTruck, date: activeDay, quantity });
      setTruckAssignments((current) => ({ ...current, [selectedTruck]: Number(data.quantity || 0) }));
      setExactTruckBars('');
      await load();
    } catch (err: any) {
      setTruckBarsError(err?.response?.data?.message || 'Could not save today’s truck bars');
    } finally {
      setSavingTruckBars(false);
    }
  };

  const dayClosed = closings.length > 0 && closings.every((row) => row.status === 'closed');
  const operationsLocked = loading || dayClosed;
  const allDriversClosed = driverClosings.every((row) => row.driverClosed);
  const allDriversChecked = driverClosings.every((row) => row.checked);
  const readyToClose = allDriversClosed && allDriversChecked;
  const liveSummary = dayClosed
    ? { ...summary, produced: 0, sold: 0, finalTotal: 0, wasted: 0, stocked: 0, outsourced: 0, assigned: 0, balance: 0 }
    : summary;
  const liveShopSold = dayClosed ? 0 : shopSoldToday;
  const liveTruckSold = dayClosed ? 0 : truckSoldToday;
  const historyRecords = [...records].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const checkTruckClosing = async (row: any) => {
    setCheckingTruck(row.truckId);
    setClosingError(null);
    try {
      await api.post('/truck-loads/reconciliation/check', { truck: row.truckId, date: activeDay });
      await load();
    } catch (err: any) {
      setClosingError(err?.response?.data || { message: 'Could not check truck closing' });
    } finally {
      setCheckingTruck('');
    }
  };

  const closeDay = async (row: any) => {
    setClosingDay(true);
    setClosingError(null);
    try {
      await api.post('/daily-closing/close', {
        date: activeDay,
        branch: row.branch?._id || row.branch,
      });
      setCloseTarget(null);
      await load();
    } catch (err: any) {
      setClosingError(err?.response?.data || { message: 'Could not close today' });
    } finally {
      setClosingDay(false);
    }
  };

  const reopenDay = async (row: any) => {
    setClosingError(null);
    setPendingAction(`reopen-${row._id}`);
    try {
      await api.post('/daily-closing/reopen', {
        date: activeDay,
        branch: row.branch?._id || row.branch,
      });
      await load();
    } catch (err: any) {
      setClosingError(err?.response?.data || { message: 'Could not reopen today' });
    } finally {
      setPendingAction('');
    }
  };

  const closingMessage = typeof closingError?.message === 'string'
    ? closingError.message
    : closingError?.message?.message || 'Could not complete daily closing';
  const closingDrivers = closingError?.unclosedDrivers || closingError?.message?.unclosedDrivers || [];

  return (
    <div className="space-y-6 pb-16 sm:pb-20">
      <section className="relative overflow-hidden rounded-3xl border border-iceblue-200 bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 p-5 text-white shadow-xl shadow-iceblue-900/10 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-iceblue-100">
              <FiActivity /> Live production control
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Today&apos;s ice bar operations</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              Record production, move bars to stock or trucks, and complete the night closing from one place.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-white/75">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5"><FiCalendar /> {formatDate(`${activeDay}T12:00:00+05:30`)}</span>
              <span className={`rounded-full px-3 py-1.5 ${dayClosed ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-300/20 text-amber-100'}`}>
                {dayClosed ? 'Day closed' : 'Day open'}
              </span>
              {lastUpdated && <span className="px-1 text-white/50">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:max-w-xl xl:justify-end">
            <button type="button" onClick={() => void load()} disabled={refreshing} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60 sm:col-span-1">
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <button type="button" onClick={openProdSettings} disabled={operationsLocked} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">
              <FiSettings /> Settings
            </button>
            <button type="button" disabled={operationsLocked} onClick={() => (todaysStock ? openStockEdit(todaysStock) : openStockModal())} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-50">
              <FiBox /> {todaysStock ? 'Edit Stock' : 'Add Stock'}
            </button>
            <button type="button" disabled={operationsLocked} onClick={() => (todaysOutsource ? openOutsourceEdit(todaysOutsource) : openOutsourceModal())} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-50">
              <FiTruck /> {todaysOutsource ? 'Edit Outsource' : 'Outsource'}
            </button>
            <button type="button" disabled={operationsLocked} onClick={() => (todaysRecord ? openEdit(todaysRecord) : openModal())} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-iceblue-400 px-4 py-2.5 text-sm font-bold text-navy-900 transition hover:bg-iceblue-300 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1">
              {todaysRecord ? <FiEdit2 /> : <FiPlus />} {todaysRecord ? 'Edit Production' : 'Add Production'}
            </button>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 font-medium"><FiAlertCircle className="shrink-0" /> {loadError}</span>
          <button type="button" onClick={() => void load()} className="font-bold text-red-700 underline underline-offset-4">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ProductionSummary label="Produced Today" value={fmtBars(liveSummary.produced)} helper="Bars made from the box counter" icon={<FiBox />} />
        <ProductionSummary label="Shop Ready" value={fmtBars(liveSummary.finalTotal)} helper="Available before shop sales" icon={<FiActivity />} danger={liveSummary.finalTotal < 0} />
        <ProductionSummary label="Sold Today" value={fmtBars(liveSummary.sold)} helper={`${fmtBars(liveShopSold)} shop · ${fmtBars(liveTruckSold)} trucks`} icon={<FiCheckCircle />} />
        <ProductionSummary label="Wastage" value={fmtBars(liveSummary.wasted)} helper="Reported damaged or melted bars" icon={<FiAlertCircle />} danger={liveSummary.wasted > 0} />
      </div>

      <div className="grid grid-cols-3 divide-x divide-iceblue-100 overflow-hidden rounded-2xl border border-iceblue-100 bg-white shadow-sm">
        <FlowMetric label="Moved to stock" value={liveSummary.stocked} tone="navy" />
        <FlowMetric label="Added by outsource" value={liveSummary.outsourced} tone="emerald" />
        <FlowMetric label="Sent to trucks" value={liveSummary.assigned} tone="blue" />
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Today&apos;s Bar Distribution</p>
          <p className="text-xs text-navy-800/50">Shop bars + truck bars</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <DistributionCard
            label="Shop Selling Bars"
            taken={liveSummary.finalTotal}
            sold={liveShopSold}
            shop
            danger={liveSummary.finalTotal < 0}
          />
          {trucks.map((truck) => (
            <DistributionCard
              key={truck._id}
              label={truck.truckName}
              detail={truck.truckNumber}
              taken={dayClosed ? 0 : Number(truckAssignments[truck._id] || 0)}
              sold={dayClosed ? 0 : Number(soldByTruck[truck._id] || 0)}
            />
          ))}
        </div>
      </section>

      <section className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${dayClosed ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Night Closing</p>
            <h2 className="mt-1 font-display text-xl font-bold text-navy-900">Check all trucks and close today</h2>
            <p className="mt-1 text-sm text-navy-800/55">{dayClosed ? 'All live counters are reset to 0. The completed figures remain in the historical reports.' : 'Close today after every truck has returned and been checked.'}</p>
          </div>
          <span className={`pill ${dayClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {dayClosed ? 'Today Closed' : `${driverClosings.filter((row) => row.checked).length}/${driverClosings.length} trucks checked`}
          </span>
        </div>

        {dayClosed && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white/80 p-4 text-emerald-800">
            <FiCalendar className="mt-0.5 shrink-0 text-xl" />
            <div>
              <p className="font-semibold">Next production starts automatically on {nextIndiaDayLabel(activeDay)}.</p>
              <p className="mt-1 text-sm leading-6 text-emerald-700/80">At 12:00 AM IST, this page switches to the new day, unlocks production actions, and continues from the next box-counter reading.</p>
            </div>
          </div>
        )}

        {closingError && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">{closingMessage}</p>
            {closingDrivers.map((driver: any) => (
              <p key={driver.truckId} className="mt-1">{driver.truckName}: {driver.reason}</p>
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {driverClosings.map((row) => (
            <div key={row.truckId} className={`rounded-2xl border p-4 ${row.checked ? 'border-emerald-200 bg-emerald-50/70' : row.driverClosed ? 'border-iceblue-100 bg-iceblue-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{row.truck?.truckName || 'Truck'}</p>
                  <p className="mt-0.5 truncate text-xs text-navy-800/45">{row.truck?.driverName || 'Driver'}{row.truck?.truckNumber ? ` · ${row.truck.truckNumber}` : ''}</p>
                </div>
                <span className={`pill shrink-0 ${row.checked ? 'bg-emerald-100 text-emerald-700' : row.driverClosed ? 'bg-iceblue-100 text-iceblue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {row.checked ? 'Accepted · Offline' : row.driverClosed ? 'Awaiting Approval · Online' : 'Open · Online'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1 text-center text-xs">
                <ClosingBarMetric label="Taken" value={row.taken} />
                <ClosingBarMetric label="Sold" value={row.sold} />
                <ClosingBarMetric label="Return" value={row.returned} />
                <ClosingBarMetric label="Balance" value={row.remaining} danger={Number(row.remaining || 0) < 0} />
              </div>
              {!dayClosed && row.driverClosed && !row.checked && (
                <button
                  type="button"
                  onClick={() => void checkTruckClosing(row)}
                  disabled={checkingTruck === row.truckId}
                  className="btn-secondary mt-4 flex w-full items-center justify-center gap-2"
                >
                  <FiCheck /> {checkingTruck === row.truckId ? 'Accepting...' : 'Accept Closing & Set Offline'}
                </button>
              )}
              {row.checked && <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-emerald-700">Closing accepted. This truck is offline for today.</p>}
              {row.driverClosed && !row.checked && <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-iceblue-700">Driver returned the remaining bars and submitted closing. Verify before accepting.</p>}
              {!row.driverClosed && <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-amber-800">{row.closeReason}</p>}
            </div>
          ))}
        </div>

        {driverClosings.length === 0 && (
          <p className="mt-5 rounded-2xl bg-iceblue-50 px-4 py-6 text-center text-sm text-navy-800/50">No active trucks to check today.</p>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {closings.map((row) => (
            <div key={row._id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-navy-900">{row.branch?.name || 'Selected Branch'} {row.branch?.code ? `(${row.branch.code})` : ''}</p>
                  <p className="mt-1 text-xs text-navy-800/45">Made {fmtBars(Number(row.produced || 0))} · Sold {fmtBars(Number(row.sold || 0))} · Wastage {fmtBars(Number(row.wastage || 0))}</p>
                </div>
                {row.status === 'closed' ? (
                  <button type="button" onClick={() => void reopenDay(row)} disabled={pendingAction === `reopen-${row._id}`} className="btn-secondary text-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {pendingAction === `reopen-${row._id}` ? 'Reopening...' : 'Reopen Today'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCloseTarget(row)}
                    disabled={!readyToClose}
                    className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiCheckCircle /> {readyToClose ? 'Final Check & Close' : 'Waiting for Checks'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden p-0 sm:p-0">
        <div className="flex items-center justify-between gap-3 border-b border-iceblue-100 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">Production history</h2>
            <p className="mt-1 text-sm text-navy-800/50">Daily box readings and bars available for selling.</p>
          </div>
          <span className="pill shrink-0 bg-iceblue-50 text-iceblue-700">{records.length} records</span>
        </div>
        <div className="overflow-x-auto">
        {loading ? (
          <LoadingRows />
        ) : historyRecords.length ? (
          <table className="table-base min-w-[700px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Open</th>
                <th>Close</th>
                <th>Total Bars</th>
                <th>Stocks</th>
                <th>Selling Bars</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historyRecords.map((r) => {
                const dateKey = indiaDateKey(r.date);
                const stockForDate = stockByDate[dateKey] || 0;
                const outsourceForDate = outsourceByDate[dateKey] || 0;
                const totalBars = Number(r.totalBars || 0);
                return (
                  <tr key={r._id}>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.boxOpen}</td>
                    <td>{r.boxClose}</td>
                    <td>{fmtBars(totalBars)}</td>
                    <td>{fmtBars(stockForDate)}</td>
                    <td>{fmtBars(totalBars + outsourceForDate - stockForDate)}</td>
                    <td><button title="Delete" onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'production', id: r._id, label: `production record for ${formatDate(r.date)}` }); }} className="text-red-500 hover:text-red-600"><FiTrash2 /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No production recorded" description="Use Add Production to save the first box-counter reading." />
        )}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold text-navy-900">Truck Assignment &amp; Sales Report</h2>
          <p className="mt-1 text-sm text-navy-800/50">Every truck assignment is shown separately, with the total bars sold for that truck and day.</p>
        </div>
        {loading ? (
          <LoadingRows compact />
        ) : truckReportRows.length ? (
          <table className="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Truck</th>
                <th>Separate Assignments</th>
                <th>Total Taken</th>
                <th>Sold Bars</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {truckReportRows.map((row) => (
                <tr key={row.key}>
                  <td>{formatDate(`${row.date}T12:00:00+05:30`)}</td>
                  <td>
                    <p className="font-semibold text-navy-900">{row.truckName}</p>
                    {row.truckNumber && <p className="text-xs text-navy-800/45">{row.truckNumber}</p>}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {row.assignments.map((assignment, index) => (
                        <span key={assignment._id} className="rounded-lg bg-iceblue-50 px-2.5 py-1 text-xs font-semibold text-iceblue-700">
                          #{index + 1}: {fmtBars(Number(assignment.quantity || 0))} bars
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="font-semibold">{fmtBars(row.taken)}</td>
                  <td className="font-semibold text-amber-700">{fmtBars(row.sold)}</td>
                  <td className={row.taken - row.sold < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700'}>
                    {fmtBars(row.taken - row.sold)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-xl bg-iceblue-50 px-4 py-8 text-center text-sm text-navy-800/50">No truck assignments recorded.</p>
        )}
      </section>

      <button
        type="button"
        onClick={openTruckBars}
        disabled={operationsLocked || trucks.length === 0}
        className="fixed bottom-5 right-4 z-40 flex h-14 items-center justify-center gap-2 rounded-full bg-iceblue-600 px-4 text-base font-bold text-white shadow-xl shadow-iceblue-900/25 transition hover:-translate-y-0.5 hover:bg-iceblue-700 focus:outline-none focus:ring-4 focus:ring-iceblue-200 disabled:cursor-not-allowed disabled:bg-navy-800/30 disabled:hover:translate-y-0 sm:bottom-7 sm:right-7 sm:px-5"
        title="Assign today's truck bars"
        aria-label="Assign today's truck bars"
      >
        <FiPlus className="text-xl" /> <span>Assign truck bars</span>
      </button>

      {closeTarget && (
        <Modal title="Final Check & Close Today" onClose={() => setCloseTarget(null)} wide>
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <FiAlertCircle className="mt-0.5 shrink-0 text-xl" />
              <div>
                <p className="font-semibold">Close today only after checking every value.</p>
                <p className="mt-1 text-sm leading-6">After closing, production, stock, outsource, truck assignments, sales, returns, and wastage are locked for today.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <CloseReviewMetric label="Opening" value={closeTarget.openingBalance} />
              <CloseReviewMetric label="Made" value={closeTarget.produced} />
              <CloseReviewMetric label="Sold" value={closeTarget.sold} />
              <CloseReviewMetric label="Wastage" value={closeTarget.wastage} />
              <CloseReviewMetric label="Balance" value={closeTarget.closingBalance} danger={Number(closeTarget.closingBalance || 0) < 0} />
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <FiCheckCircle className="mr-2 inline" /> All {driverClosings.length} truck{driverClosings.length === 1 ? '' : 's'} closed and checked
            </div>
            {closingError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{closingMessage}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCloseTarget(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => void closeDay(closeTarget)} disabled={closingDay} className="btn-primary">
                {closingDay ? 'Closing...' : 'Yes, Close Today'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {truckBarsOpen && (
        <Modal title="Today's Truck Bars" onClose={() => setTruckBarsOpen(false)}>
          <div className="space-y-5">
            <div>
              <label className="label-text">Truck</label>
              <select className="input-field h-12" value={selectedTruck} onChange={(event) => changeSelectedTruck(event.target.value)}>
                <option value="">Select truck</option>
                {trucks.map((truck) => <option key={truck._id} value={truck._id}>{truck.truckName} ({truck.truckNumber})</option>)}
              </select>
            </div>

            {selectedTruck ? (
              <>
                <div className="rounded-2xl bg-iceblue-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-navy-800/45">Assigned Today</p>
                  <p className="mt-1 font-display text-3xl font-bold text-navy-900">{fmtBars(Number(truckAssignments[selectedTruck] || 0))} bars</p>
                </div>

                <div>
                  <label className="label-text">Add Bar Quantity</label>
                  <p className="mb-2 text-xs text-navy-800/50">Each save adds a separate assignment to today&apos;s truck report.</p>
                  <div className="flex gap-2">
                    <input type="number" min={0.25} step={0.25} className="input-field h-11 flex-1" placeholder="Bars to add" value={exactTruckBars} onChange={(event) => setExactTruckBars(event.target.value)} />
                    <button type="button" onClick={() => void addTruckBars(Number(exactTruckBars))} disabled={savingTruckBars} className="btn-primary shrink-0 px-5">{savingTruckBars ? 'Adding...' : 'Add'}</button>
                  </div>
                </div>

                {truckBarsError && <p className="text-sm font-medium text-red-600">{truckBarsError}</p>}
              </>
            ) : (
              <p className="rounded-2xl bg-iceblue-50 px-4 py-6 text-center text-sm text-navy-800/50">No truck is available.</p>
            )}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Confirm Delete" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-navy-800/70">Are you sure you want to delete the {deleteTarget.label}? This cannot be undone.</p>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={pendingAction === 'delete'} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => void confirmRemove()} disabled={pendingAction === 'delete'} className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {pendingAction === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {stockModalOpen && (
        <Modal title={stockEditing ? 'Edit Stock' : 'Add Stock'} onClose={() => setStockModalOpen(false)}>
          <form onSubmit={submitStock} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input type="date" className="input-field" required value={stockDate} onChange={(e) => setStockDate(e.target.value)} />
            </div>
            <div>
              <label className="label-text">Quantity</label>
              <input type="number" min={0.25} step={0.25} required className="input-field" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} />
              <p className="mt-1 text-xs text-navy-800/50">Supports quarter-bar sizes: 0.25, 0.5, 0.75, 1, 1.25... Deducted from Total Bars to show Final Total Bars.</p>
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} />
            </div>
            {stockError && <p className="text-sm text-red-600">{stockError}</p>}
            <button className="btn-primary w-full" disabled={pendingAction === 'stock'}>{pendingAction === 'stock' ? 'Saving...' : stockEditing ? 'Save Changes' : 'Save Stock'}</button>
            {stockEditing && (
              <button
                type="button"
                onClick={() => { setStockModalOpen(false); setDeleteError(''); setDeleteTarget({ kind: 'stock', id: stockEditing._id, label: `stock entry for ${formatDate(stockEditing.date)}` }); }}
                className="w-full rounded-xl border border-red-200 py-2.5 font-semibold text-red-600 hover:bg-red-50"
              >
                Delete Stock Entry
              </button>
            )}
          </form>
        </Modal>
      )}

      {outsourceModalOpen && (
        <Modal title={outsourceEditing ? 'Edit Outsource' : 'Add Outsource'} onClose={() => setOutsourceModalOpen(false)}>
          <form onSubmit={submitOutsource} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input type="date" className="input-field" required value={outsourceDate} onChange={(e) => setOutsourceDate(e.target.value)} />
            </div>
            <div>
              <label className="label-text">Quantity</label>
              <input type="number" min={0.25} step={0.25} required className="input-field" value={outsourceQuantity} onChange={(e) => setOutsourceQuantity(e.target.value)} />
              <p className="mt-1 text-xs text-navy-800/50">Supports quarter-bar sizes: 0.25, 0.5, 0.75, 1, 1.25... Added to Selling Bars for bars brought in from an outside source.</p>
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={outsourceNotes} onChange={(e) => setOutsourceNotes(e.target.value)} />
            </div>
            {outsourceError && <p className="text-sm text-red-600">{outsourceError}</p>}
            <button className="btn-primary w-full" disabled={pendingAction === 'outsource'}>{pendingAction === 'outsource' ? 'Saving...' : outsourceEditing ? 'Save Changes' : 'Save Outsource'}</button>
            {outsourceEditing && (
              <button
                type="button"
                onClick={() => { setOutsourceModalOpen(false); setDeleteError(''); setDeleteTarget({ kind: 'outsource', id: outsourceEditing._id, label: `outsource entry for ${formatDate(outsourceEditing.date)}` }); }}
                className="w-full rounded-xl border border-red-200 py-2.5 font-semibold text-red-600 hover:bg-red-50"
              >
                Delete Outsource Entry
              </button>
            )}
          </form>
        </Modal>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit Production' : 'Add Production'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input type="date" className="input-field" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label-text">Box Open</label>
              <input type="number" className="input-field bg-iceblue-50" value={boxInfo?.nextOpen ?? ''} disabled />
              <p className="mt-1 text-xs text-navy-800/50">
                {editing ? 'Fixed to this record’s original opening reading.' : 'Continues automatically from the previous closing box reading.'}
              </p>
            </div>
            <div>
              <label className="label-text">Box Close</label>
              <input
                type="number"
                min={1}
                max={boxInfo?.totalBoxes}
                required
                placeholder={boxInfo ? `1 to ${boxInfo.totalBoxes}` : ''}
                className="input-field"
                value={boxClose}
                onChange={(e) => setBoxClose(e.target.value)}
              />
              <p className="mt-1 text-xs text-navy-800/50">Boxes wrap back to 1 after reaching {boxInfo?.totalBoxes ?? '...'}, so closing can be lower than opening.</p>
            </div>
            {preview && (
              <div className="rounded-xl bg-iceblue-50 p-3 text-sm">
                <p>Boxes made: <span className="font-semibold">{preview.boxesProduced}</span></p>
                <p>Ice bars made: <span className="font-semibold">{preview.barsProduced}</span> ({boxInfo?.barsPerBox} bars/box)</p>
              </div>
            )}
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={!boxInfo || !preview || pendingAction === 'production'}>
              {pendingAction === 'production' ? 'Saving...' : editing ? 'Save Changes' : 'Save Production'}
            </button>
          </form>
        </Modal>
      )}

      {prodSettingsOpen && (
        <Modal title="Production Settings" onClose={() => setProdSettingsOpen(false)}>
          <form onSubmit={saveProdSettings} className="space-y-3">
            <p className="text-sm text-navy-800/60">
              Boxes are numbered 1 to Total Boxes and wrap back to 1. Bars produced = boxes made &times; bars per box.
            </p>
            <div>
              <label className="label-text">Total Boxes</label>
              <input
                type="number"
                min={1}
                required
                className="input-field"
                value={prodSettingsForm.totalBoxes}
                onChange={(e) => setProdSettingsForm({ ...prodSettingsForm, totalBoxes: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">Bars per Box</label>
              <input
                type="number"
                min={1}
                required
                className="input-field"
                value={prodSettingsForm.barsPerBox}
                onChange={(e) => setProdSettingsForm({ ...prodSettingsForm, barsPerBox: e.target.value })}
              />
            </div>
            {prodSettingsError && <p className="text-sm text-red-600">{prodSettingsError}</p>}
            <button className="btn-primary w-full" disabled={prodSettingsSaving}>{prodSettingsSaving ? 'Saving...' : 'Save Production Settings'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProductionSummary({
  label,
  value,
  helper,
  icon,
  danger = false,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-3xl sm:p-6 ${danger ? 'border-red-200' : 'border-iceblue-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-navy-800/45 sm:text-xs">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-red-600' : 'bg-iceblue-50 text-iceblue-700'}`}>{icon}</span>
      </div>
      <p className={`mt-3 font-display text-3xl font-bold sm:text-4xl ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-navy-800/45 sm:text-xs">{helper}</p>
    </div>
  );
}

function FlowMetric({ label, value, tone }: { label: string; value: number; tone: 'navy' | 'emerald' | 'blue' }) {
  const tones = {
    navy: 'text-navy-900',
    emerald: 'text-emerald-700',
    blue: 'text-iceblue-700',
  };

  return (
    <div className="min-w-0 px-2 py-3 text-center sm:px-4 sm:py-4">
      <p className={`font-display text-xl font-bold sm:text-2xl ${tones[tone]}`}>{fmtBars(value)}</p>
      <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-navy-800/45 sm:text-[11px]">{label}</p>
    </div>
  );
}

function LoadingRows({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`animate-pulse space-y-3 ${compact ? 'py-2' : 'p-5'}`} aria-label="Loading data">
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid grid-cols-4 gap-3">
          <span className="h-4 rounded bg-iceblue-100" />
          <span className="h-4 rounded bg-iceblue-50" />
          <span className="h-4 rounded bg-iceblue-100" />
          <span className="h-4 rounded bg-iceblue-50" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-iceblue-50 text-xl text-iceblue-600"><FiBox /></span>
      <p className="mt-3 font-semibold text-navy-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-navy-800/50">{description}</p>
    </div>
  );
}

function DistributionCard({
  label,
  detail,
  taken,
  sold,
  takenLabel = 'Taken',
  shop = false,
  soldOnly = false,
  danger = false,
}: {
  label: string;
  detail?: string;
  taken: number;
  sold: number;
  takenLabel?: string;
  shop?: boolean;
  soldOnly?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 shadow-sm ${shop ? 'border-emerald-100 bg-emerald-50/70' : 'border-iceblue-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate text-[11px] font-bold uppercase tracking-wide ${shop ? 'text-emerald-700/70' : 'text-navy-800/45'}`}>{label}</p>
          {detail && <p className="mt-0.5 truncate text-[10px] text-navy-800/40">{detail}</p>}
        </div>
        {shop ? <FiBox className="shrink-0 text-emerald-600" /> : <FiTruck className="shrink-0 text-iceblue-600" />}
      </div>
      <div className={`mt-3 grid gap-2 ${soldOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {!soldOnly && (
          <DistributionMetric
            label={takenLabel}
            value={taken}
            tone={danger ? 'danger' : shop ? 'shop' : 'default'}
          />
        )}
        <DistributionMetric label="Sold" value={sold} tone="sold" />
      </div>
    </div>
  );
}

function DistributionMetric({ label, value, tone }: { label: string; value: number; tone: 'default' | 'shop' | 'sold' | 'danger' }) {
  const tones = {
    default: 'bg-iceblue-50 text-navy-900',
    shop: 'bg-white/80 text-emerald-700',
    sold: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-600',
  };

  return (
    <div className={`min-w-0 rounded-xl px-2.5 py-2 ${tones[tone]}`}>
      <p className="text-[9px] font-bold uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-0.5 truncate font-display text-lg font-bold">{fmtBars(value)}</p>
    </div>
  );
}

function ClosingBarMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-white/80 px-1.5 py-2">
      <p className={`font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{fmtBars(Number(value || 0))}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase text-navy-800/40">{label}</p>
    </div>
  );
}

function CloseReviewMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${danger ? 'bg-red-50' : 'bg-iceblue-50'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{fmtBars(Number(value || 0))}</p>
    </div>
  );
}
