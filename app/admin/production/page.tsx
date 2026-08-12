"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FiActivity,
  FiAlertCircle,
  FiBox,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiEdit2,
  FiPlus,
  FiSettings,
  FiTrash2,
  FiTruck,
} from "react-icons/fi";
import api, { dedupedGet } from "../../../lib/api";
import { getItemBarUsed, formatDate } from "../../../lib/api";
import Modal from "../../../components/Modal";
import SaleForm from "../../../components/SaleForm";
import { formatBarQuantity, formatCurrency } from "../../../lib/api";
import useDismissibleMenu from "../../../hooks/useDismissibleMenu";

type BoxInfo = { nextOpen: number; totalBoxes: number; barsPerBox: number };
type TruckOption = { _id: string; truckName: string; truckNumber: string; isOnline?: boolean; driverOnline?: boolean; online?: boolean };
type TruckLoad = {
  _id: string;
  date: string;
  quantity: number;
  createdAt?: string;
  truck?: TruckOption | string;
};

// quarter-bar quantities (0.25, 0.5, 0.75...) display with 2 decimals; whole numbers stay clean
const fmtBars = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const indiaDateKey = (date: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));

const todayIndiaISO = () => indiaDateKey(new Date());

const nextIndiaDayLabel = (day: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
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
  const [boxClose, setBoxClose] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [prodSettingsOpen, setProdSettingsOpen] = useState(false);
  const [prodSettingsForm, setProdSettingsForm] = useState({
    totalBoxes: "",
    barsPerBox: "",
  });
  const [prodSettingsSaving, setProdSettingsSaving] = useState(false);
  const [prodSettingsError, setProdSettingsError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "production" | "stock" | "outsource";
    id: string;
    label: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockEditing, setStockEditing] = useState<any | null>(null);
  const [stockDate, setStockDate] = useState(todayIndiaISO());
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNotes, setStockNotes] = useState("");
  const [stockError, setStockError] = useState("");
  const [outsourceModalOpen, setOutsourceModalOpen] = useState(false);
  const [outsourceEditing, setOutsourceEditing] = useState<any | null>(null);
  const [outsourceDate, setOutsourceDate] = useState(todayIndiaISO());
  const [outsourceQuantity, setOutsourceQuantity] = useState("");
  const [outsourceNotes, setOutsourceNotes] = useState("");
  const [outsourceError, setOutsourceError] = useState("");
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [truckLoads, setTruckLoads] = useState<TruckLoad[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<
    Record<string, number>
  >({});
  const [closings, setClosings] = useState<any[]>([]);
  const [driverClosings, setDriverClosings] = useState<any[]>([]);
  const [closeTarget, setCloseTarget] = useState<any | null>(null);
  const [closingError, setClosingError] = useState<any>(null);
  const [checkingTruck, setCheckingTruck] = useState("");
  const [checkingAll, setCheckingAll] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [truckBarsOpen, setTruckBarsOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState("");
  const [exactTruckBars, setExactTruckBars] = useState("");
  const [savingTruckBars, setSavingTruckBars] = useState(false);
  const [truckBarsError, setTruckBarsError] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
  useDismissibleMenu(quickAddOpen, quickAddRef, closeQuickAdd);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");

  const load = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true);
      setLoadError("");
      try {
        const [
          productionRows,
          saleRows,
          wastageRows,
          stockRows,
          outsourceRows,
          truckRows,
          assignmentRows,
          truckLoadRows,
          closingRows,
          reconciliationRows,
        ] = await Promise.all([
          dedupedGet("/production"),
          dedupedGet("/sales"),
          dedupedGet("/wastage"),
          dedupedGet("/stock-entries"),
          dedupedGet("/outsource-entries"),
          dedupedGet("/trucks"),
          dedupedGet("/truck-assignments", { params: { date: activeDay } }),
          dedupedGet("/truck-loads"),
          dedupedGet("/daily-closing", { params: { date: activeDay } }),
          dedupedGet("/truck-loads/reconciliation", {
            params: { date: activeDay },
          }),
        ]);
        setRecords(
          Array.isArray(productionRows.data) ? productionRows.data : [],
        );
        setSales(Array.isArray(saleRows.data) ? saleRows.data : []);
        setWastage(Array.isArray(wastageRows.data) ? wastageRows.data : []);
        setStockEntries(Array.isArray(stockRows.data) ? stockRows.data : []);
        setOutsourceEntries(
          Array.isArray(outsourceRows.data) ? outsourceRows.data : [],
        );
        const availableTrucks = Array.isArray(truckRows.data)
          ? truckRows.data
          : [];
        setTrucks(availableTrucks);
        setTruckLoads(
          Array.isArray(truckLoadRows.data) ? truckLoadRows.data : [],
        );
        setClosings(Array.isArray(closingRows.data) ? closingRows.data : []);
        setDriverClosings(
          Array.isArray(reconciliationRows.data) ? reconciliationRows.data : [],
        );
        setTruckAssignments(
          Object.fromEntries(
            (Array.isArray(assignmentRows.data) ? assignmentRows.data : []).map(
              (row: any) => [
                String(row.truck?._id || row.truck),
                Number(row.quantity || 0),
              ],
            ),
          ),
        );
        setSelectedTruck((current) => current || availableTrucks[0]?._id || "");
      } catch (err: any) {
        setLoadError(
          err?.response?.data?.message || "Could not load production data",
        );
      } finally {
        setLoading(false);
      }
    },
    [activeDay],
  );

  const fetchNextBox = async () => {
    const { data } = await api.get("/production/next-box");
    setBoxInfo(data);
    return data as BoxInfo;
  };

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const refreshDriverPresence = async () => {
      try {
        const [truckRows, reconciliationRows] = await Promise.all([
          api.get('/trucks'),
          api.get('/truck-loads/reconciliation', { params: { date: activeDay } }),
        ]);
        setTrucks(Array.isArray(truckRows.data) ? truckRows.data : []);
        setDriverClosings(Array.isArray(reconciliationRows.data) ? reconciliationRows.data : []);
      } catch {
        // Keep the last known presence when a background refresh fails.
      }
    };
    const timer = window.setInterval(() => void refreshDriverPresence(), 15_000);
    return () => window.clearInterval(timer);
  }, [activeDay]);

  useEffect(() => {
    const moveToCurrentDay = () => {
      const currentIndiaDay = todayIndiaISO();
      setActiveDay((previousDay) =>
        previousDay === currentIndiaDay ? previousDay : currentIndiaDay,
      );
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") moveToCurrentDay();
    };

    const dayWatcher = window.setInterval(moveToCurrentDay, 30_000);
    window.addEventListener("focus", moveToCurrentDay);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(dayWatcher);
      window.removeEventListener("focus", moveToCurrentDay);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const summary = useMemo(() => {
    const today = activeDay;
    const produced = records
      .filter((row) => indiaDateKey(row.date) === today)
      .reduce((sum, row) => sum + Number(row.totalBars || 0), 0);
    const sold = sales
      .filter((sale) => indiaDateKey(sale.date) === today)
      .reduce(
        (sum, sale) =>
          sum +
          (sale.items || []).reduce(
            (itemSum: number, item: any) => itemSum + getItemBarUsed(item),
            0,
          ),
        0,
      );
    const wasted = wastage
      .filter(
        (row) => indiaDateKey(row.date) === today && row.reason !== "unsold",
      )
      .reduce((sum, row) => sum + getItemBarUsed(row), 0);
    const stocked = stockEntries
      .filter((row) => indiaDateKey(row.date) === today)
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const outsourced = outsourceEntries
      .filter((row) => indiaDateKey(row.date) === today)
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const assigned = Object.values(truckAssignments).reduce(
      (sum, quantity) => sum + Number(quantity || 0),
      0,
    );
    // Shop sales do not have a truck. Deduct them only from Shop Ready; truck
    // sales are already covered by the quantities sent to each truck.
    const shopSold = sales
      .filter((sale) => indiaDateKey(sale.date) === today && !sale.truck)
      .reduce(
        (sum, sale) =>
          sum +
          (sale.items || []).reduce(
            (itemSum: number, item: any) => itemSum + getItemBarUsed(item),
            0,
          ),
        0,
      );
    const finalTotal = produced - stocked + outsourced - assigned - shopSold;
    return {
      produced,
      sold,
      wasted,
      stocked,
      outsourced,
      assigned,
      shopSold,
      balance: produced - sold - wasted,
      finalTotal,
    };
  }, [
    records,
    sales,
    wastage,
    stockEntries,
    outsourceEntries,
    truckAssignments,
    activeDay,
  ]);

  const todaysSales = useMemo(
    () => sales.filter((sale) => indiaDateKey(sale.date) === activeDay),
    [sales, activeDay],
  );

  const soldByTruck = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of todaysSales) {
      const truckId = String(sale.truck?._id || sale.truck || "");
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
    () =>
      Object.values(soldByTruck).reduce((sum, quantity) => sum + quantity, 0),
    [soldByTruck],
  );

  const shopSoldToday = summary.shopSold;

  const soldByTruckAndDate = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of sales) {
      const truckId = String(sale.truck?._id || sale.truck || "");
      if (!truckId) continue;
      const key = `${indiaDateKey(sale.date)}:${truckId}`;
      totals[key] =
        (totals[key] || 0) +
        (sale.items || []).reduce(
          (sum: number, item: any) => sum + getItemBarUsed(item),
          0,
        );
    }
    return totals;
  }, [sales]);

  const truckReportRows = useMemo(() => {
    const rows: Record<
      string,
      {
        key: string;
        date: string;
        truckId: string;
        truckName: string;
        truckNumber: string;
        assignments: TruckLoad[];
        taken: number;
        sold: number;
      }
    > = {};

    for (const loadRow of truckLoads) {
      const truck =
        typeof loadRow.truck === "object" && loadRow.truck
          ? loadRow.truck
          : null;
      const truckId = String(truck?._id || loadRow.truck || "");
      if (!truckId) continue;
      const dateKey = indiaDateKey(loadRow.date);
      const key = `${dateKey}:${truckId}`;
      if (!rows[key]) {
        const fallbackTruck = trucks.find((item) => item._id === truckId);
        rows[key] = {
          key,
          date: dateKey,
          truckId,
          truckName: truck?.truckName || fallbackTruck?.truckName || "Truck",
          truckNumber: truck?.truckNumber || fallbackTruck?.truckNumber || "",
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
        assignments: row.assignments.sort((a, b) =>
          String(a.createdAt || a.date).localeCompare(
            String(b.createdAt || b.date),
          ),
        ),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [truckLoads, trucks, soldByTruckAndDate]);

  const todaysRecord = useMemo(
    () => records.find((r) => indiaDateKey(r.date) === activeDay) || null,
    [records, activeDay],
  );

  const todaysOutsource = useMemo(
    () =>
      outsourceEntries.find((o) => indiaDateKey(o.date) === activeDay) || null,
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
    setError("");
    setEditing(null);
    setDate(activeDay);
    setBoxClose("");
    setNotes("");
    setBoxInfo(null);
    setModalOpen(true);
    try {
      await fetchNextBox();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Could not load the next box reading",
      );
    }
  };

  const openEdit = async (record: any) => {
    setError("");
    setEditing(record);
    setDate(String(record.date).slice(0, 10));
    setBoxClose(String(record.boxClose));
    setNotes(record.notes || "");
    setBoxInfo(null);
    setModalOpen(true);
    try {
      const { data } = await api.get("/settings");
      setBoxInfo({
        nextOpen: record.boxOpen,
        totalBoxes: data.totalBoxes,
        barsPerBox: data.barsPerBox,
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Could not load production settings",
      );
    }
  };

  const preview = useMemo(() => {
    if (!boxInfo || boxClose === "") return null;
    const open = boxInfo.nextOpen;
    const close = Number(boxClose);
    if (!Number.isFinite(close) || close < 1 || close > boxInfo.totalBoxes)
      return null;
    const boxesProduced =
      (close >= open ? close - open : boxInfo.totalBoxes - open + close) + 1;
    return { boxesProduced, barsProduced: boxesProduced * boxInfo.barsPerBox };
  }, [boxInfo, boxClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxInfo || !preview) return;
    setError("");
    setPendingAction("production");
    try {
      const payload = {
        date,
        boxOpen: boxInfo.nextOpen,
        boxClose: Number(boxClose),
        notes,
      };
      if (editing) {
        await api.patch(`/production/${editing._id}`, payload);
      } else {
        await api.post("/production", payload);
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not save production");
    } finally {
      setPendingAction("");
    }
  };

  const deleteEndpoints = {
    production: "/production",
    stock: "/stock-entries",
    outsource: "/outsource-entries",
  };

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    setDeleteError("");
    setPendingAction("delete");
    try {
      await api.delete(
        `${deleteEndpoints[deleteTarget.kind]}/${deleteTarget.id}`,
      );
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || "Could not delete");
    } finally {
      setPendingAction("");
    }
  };

  const openStockModal = () => {
    setStockError("");
    setStockEditing(null);
    setStockDate(activeDay);
    setStockQuantity("");
    setStockNotes("");
    setStockModalOpen(true);
  };

  const openStockEdit = (entry: any) => {
    setStockError("");
    setStockEditing(entry);
    setStockDate(String(entry.date).slice(0, 10));
    setStockQuantity(String(entry.quantity));
    setStockNotes(entry.notes || "");
    setStockModalOpen(true);
  };

  const submitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setStockError("");
    setPendingAction("stock");
    try {
      const payload = {
        date: stockDate,
        quantity: Number(stockQuantity),
        notes: stockNotes,
      };
      if (stockEditing) {
        await api.patch(`/stock-entries/${stockEditing._id}`, payload);
      } else {
        await api.post("/stock-entries", payload);
      }
      setStockModalOpen(false);
      await load();
    } catch (err: any) {
      setStockError(
        err?.response?.data?.message || "Could not save stock entry",
      );
    } finally {
      setPendingAction("");
    }
  };

  const openOutsourceModal = () => {
    setOutsourceError("");
    setOutsourceEditing(null);
    setOutsourceDate(activeDay);
    setOutsourceQuantity("");
    setOutsourceNotes("");
    setOutsourceModalOpen(true);
  };

  const openOutsourceEdit = (entry: any) => {
    setOutsourceError("");
    setOutsourceEditing(entry);
    setOutsourceDate(String(entry.date).slice(0, 10));
    setOutsourceQuantity(String(entry.quantity));
    setOutsourceNotes(entry.notes || "");
    setOutsourceModalOpen(true);
  };

  const submitOutsource = async (e: React.FormEvent) => {
    e.preventDefault();
    setOutsourceError("");
    setPendingAction("outsource");
    try {
      const payload = {
        date: outsourceDate,
        quantity: Number(outsourceQuantity),
        notes: outsourceNotes,
      };
      if (outsourceEditing) {
        await api.patch(`/outsource-entries/${outsourceEditing._id}`, payload);
      } else {
        await api.post("/outsource-entries", payload);
      }
      setOutsourceModalOpen(false);
      await load();
    } catch (err: any) {
      setOutsourceError(
        err?.response?.data?.message || "Could not save outsourced bars",
      );
    } finally {
      setPendingAction("");
    }
  };

  const openProdSettings = async () => {
    setProdSettingsError("");
    setProdSettingsOpen(true);
    try {
      const { data } = await api.get("/settings");
      setProdSettingsForm({
        totalBoxes: String(data.totalBoxes ?? 200),
        barsPerBox: String(data.barsPerBox ?? 2),
      });
    } catch (err: any) {
      setProdSettingsError(
        err?.response?.data?.message || "Could not load production settings",
      );
    }
  };

  const saveProdSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdSettingsError("");
    setProdSettingsSaving(true);
    try {
      await api.patch("/settings", {
        totalBoxes: Number(prodSettingsForm.totalBoxes),
        barsPerBox: Number(prodSettingsForm.barsPerBox),
      });
      setProdSettingsOpen(false);
      if (boxInfo) await fetchNextBox();
    } catch (err: any) {
      setProdSettingsError(
        err?.response?.data?.message || "Could not save production settings",
      );
    } finally {
      setProdSettingsSaving(false);
    }
  };

  const openTruckBars = () => {
    const truckId = selectedTruck || trucks[0]?._id || "";
    setSelectedTruck(truckId);
    setExactTruckBars("");
    setTruckBarsError("");
    setTruckBarsOpen(true);
    setQuickAddOpen(false);
  };

  const openSaleForm = () => {
    setQuickAddOpen(false);
    setSaleModalOpen(true);
  };

  const handleSaleSaved = async () => {
    setSaleModalOpen(false);
    await load();
  };

  const changeSelectedTruck = (truckId: string) => {
    setSelectedTruck(truckId);
    setExactTruckBars("");
    setTruckBarsError("");
  };

  const addTruckBars = async (quantity: number) => {
    if (!selectedTruck) {
      setTruckBarsError("Select a truck");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTruckBarsError("Enter a valid bar quantity");
      return;
    }
    setSavingTruckBars(true);
    setTruckBarsError("");
    try {
      const { data } = await api.post("/truck-assignments/add", {
        truck: selectedTruck,
        date: activeDay,
        quantity,
      });
      setTruckAssignments((current) => ({
        ...current,
        [selectedTruck]: Number(data.quantity || 0),
      }));
      setExactTruckBars("");
      await load();
    } catch (err: any) {
      setTruckBarsError(
        err?.response?.data?.message || "Could not save today’s truck bars",
      );
    } finally {
      setSavingTruckBars(false);
    }
  };

  const dayClosed =
    closings.length > 0 && closings.every((row) => row.status === "closed");
  const operationsLocked = loading || dayClosed;
  const allDriversClosed = driverClosings.every((row) => row.driverClosed);
  const allDriversChecked = driverClosings.every((row) => row.checked);
  const readyToClose = allDriversClosed && allDriversChecked;
  const liveSummary = dayClosed
    ? {
        ...summary,
        produced: 0,
        sold: 0,
        finalTotal: 0,
        wasted: 0,
        stocked: 0,
        outsourced: 0,
        assigned: 0,
        balance: 0,
      }
    : summary;
  const liveShopSold = dayClosed ? 0 : shopSoldToday;
  const liveTruckSold = dayClosed ? 0 : truckSoldToday;
  const historyRecords = [...records].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  const todayHistoryRecords = historyRecords.filter(
    (record) => indiaDateKey(record.date) === activeDay,
  );
  const todayTruckReportRows = truckReportRows.filter(
    (row) => row.date === activeDay,
  );
  const pendingTruckChecks = useMemo(
    () => driverClosings.filter((row) => row.driverClosed && !row.checked),
    [driverClosings],
  );

  const checkTruckClosing = async (row: any) => {
    setCheckingTruck(row.truckId);
    setClosingError(null);
    try {
      await api.post("/truck-loads/reconciliation/check", {
        truck: row.truckId,
        date: activeDay,
      });
      await load();
    } catch (err: any) {
      setClosingError(
        err?.response?.data || { message: "Could not check truck closing" },
      );
    } finally {
      setCheckingTruck("");
    }
  };

  // "Check all trucks" — accept every truck that has returned but is still
  // awaiting admin approval, in one action, then refresh once at the end.
  const checkAllTrucks = async () => {
    if (pendingTruckChecks.length === 0) return;
    setCheckingAll(true);
    setClosingError(null);
    try {
      for (const row of pendingTruckChecks) {
        await api.post("/truck-loads/reconciliation/check", {
          truck: row.truckId,
          date: activeDay,
        });
      }
      await load();
    } catch (err: any) {
      setClosingError(
        err?.response?.data || { message: "Could not check all trucks" },
      );
    } finally {
      setCheckingAll(false);
    }
  };

  const closeDay = async (row: any) => {
    setClosingDay(true);
    setClosingError(null);
    try {
      await api.post("/daily-closing/close", {
        date: activeDay,
        branch: row.branch?._id || row.branch,
      });
      setCloseTarget(null);
      await load();
    } catch (err: any) {
      setClosingError(
        err?.response?.data || { message: "Could not close today" },
      );
    } finally {
      setClosingDay(false);
    }
  };

  const reopenDay = async (row: any) => {
    setClosingError(null);
    setPendingAction(`reopen-${row._id}`);
    try {
      await api.post("/daily-closing/reopen", {
        date: activeDay,
        branch: row.branch?._id || row.branch,
      });
      await load();
    } catch (err: any) {
      setClosingError(
        err?.response?.data || { message: "Could not reopen today" },
      );
    } finally {
      setPendingAction("");
    }
  };

  const closingMessage =
    typeof closingError?.message === "string"
      ? closingError.message
      : closingError?.message?.message || "Could not complete daily closing";
  const closingDrivers =
    closingError?.unclosedDrivers ||
    closingError?.message?.unclosedDrivers ||
    [];

  return (
    <div className="space-y-4 pb-16 sm:pb-20">
      {loadError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 font-medium">
            <FiAlertCircle className="shrink-0" /> {loadError}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="font-bold text-red-700 underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <ProductionSummary
          label="Produced Today"
          value={fmtBars(liveSummary.produced)}
          icon={<FiBox />}
        />
        <ProductionSummary
          label="Shop Ready"
          value={fmtBars(liveSummary.finalTotal)}
          icon={<FiActivity />}
          danger={liveSummary.finalTotal < 0}
        />
        <ProductionSummary
          label="Sold Today"
          value={fmtBars(liveSummary.sold)}
          icon={<FiCheckCircle />}
        />
        <ProductionSummary
          label="Wastage"
          value={fmtBars(liveSummary.wasted)}
          icon={<FiAlertCircle />}
          danger={liveSummary.wasted > 0}
        />
        <ProductionSummary
          label="Moved to Stock"
          value={fmtBars(liveSummary.stocked)}
          icon={<FiBox />}
        />
        <ProductionSummary
          label="Outsourced"
          value={fmtBars(liveSummary.outsourced)}
          icon={<FiTruck />}
        />
        <ProductionSummary
          label="Sent to Trucks"
          value={fmtBars(liveSummary.assigned)}
          icon={<FiTruck />}
        />
      </div>

      <section className="hidden" aria-hidden="true">
        {/* Header */}
        <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/50">
              Today&apos;s Bar Distribution
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              Shop bars + truck bars
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
            {dayClosed ? "Day Closed" : "Live Distribution"}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-left text-xs font-bold uppercase tracking-wider text-white">
                <th className="border-r border-white/10 px-4 py-3 text-center">
                  S.No
                </th>

                <th className="border-r border-white/10 px-4 py-3">
                  Distribution
                </th>

                <th className="border-r border-white/10 px-4 py-3">
                  Vehicle No
                </th>

                <th className="border-r border-white/10 px-4 py-3 text-center">
                  Total Bar
                </th>

                <th className="border-r border-white/10 px-4 py-3 text-center">
                  Sold
                </th>

                <th className="border-r border-white/10 px-4 py-3 text-center">
                  Balance
                </th>

                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>

            <tbody>
              {/* Shop Row */}
              {(() => {
                const taken = Number(liveSummary.finalTotal || 0);
                const sold = Number(liveShopSold || 0);
                const balance = taken - sold;

                return (
                  <tr className="border-b border-slate-200 bg-blue-50/50 transition hover:bg-blue-50">
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-semibold text-slate-500">
                      1
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700">
                          S
                        </div>

                        <div>
                          <p className="font-bold text-slate-800">
                            Shop Selling Bars
                          </p>
                          <p className="text-xs text-slate-500">Main shop</p>
                        </div>
                      </div>
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3 font-medium text-slate-400">
                      —
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3 text-center">
                      <span
                        className={`font-bold ${
                          taken < 0 ? "text-red-600" : "text-slate-800"
                        }`}
                      >
                        {taken}
                      </span>
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-emerald-600">
                      {sold}
                    </td>

                    <td
                      className={`border-r border-slate-200 px-4 py-3 text-center font-black ${
                        balance < 0
                          ? "text-red-600"
                          : balance === 0
                            ? "text-slate-500"
                            : "text-blue-700"
                      }`}
                    >
                      {balance}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          balance < 0
                            ? "bg-red-100 text-red-700"
                            : balance === 0
                              ? "bg-slate-100 text-slate-600"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {balance < 0
                          ? "Check"
                          : balance === 0
                            ? "Completed"
                            : "Available"}
                      </span>
                    </td>
                  </tr>
                );
              })()}

              {/* Truck Rows */}
              {trucks.map((truck, index) => {
                const taken = dayClosed
                  ? 0
                  : Number(truckAssignments[truck._id] || 0);

                const sold = dayClosed
                  ? 0
                  : Number(soldByTruck[truck._id] || 0);

                const balance = taken - sold;

                return (
                  <tr
                    key={truck._id}
                    className={`border-b border-slate-200 transition hover:bg-slate-50 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-semibold text-slate-500">
                      {index + 2}
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-xs font-black text-orange-700">
                          T
                        </div>

                        <div>
                          <p className="font-bold text-slate-800">
                            {truck.truckName}
                          </p>

                          <p className="text-xs text-slate-500">
                            Truck distribution
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                        {truck.truckNumber || "—"}
                      </span>
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-slate-800">
                      {taken}
                    </td>

                    <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-emerald-600">
                      {sold}
                    </td>

                    <td
                      className={`border-r border-slate-200 px-4 py-3 text-center font-black ${
                        balance < 0
                          ? "text-red-600"
                          : balance === 0
                            ? "text-slate-500"
                            : "text-blue-700"
                      }`}
                    >
                      {balance}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          balance < 0
                            ? "bg-red-100 text-red-700"
                            : balance === 0
                              ? "bg-slate-100 text-slate-600"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {balance < 0
                          ? "Check"
                          : balance === 0
                            ? "Completed"
                            : "Available"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Empty truck state */}
              {trucks.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    No truck distribution available.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Total */}
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-800">
                <td
                  colSpan={3}
                  className="border-r border-t border-slate-200 px-4 py-3 text-right text-xs font-black uppercase tracking-wider"
                >
                  Total
                </td>

                <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                  {Number(liveSummary.finalTotal || 0) +
                    trucks.reduce(
                      (total, truck) =>
                        total +
                        (dayClosed
                          ? 0
                          : Number(truckAssignments[truck._id] || 0)),
                      0,
                    )}
                </td>

                <td className="border-r border-t border-slate-200 px-4 py-3 text-center text-emerald-700">
                  {Number(liveShopSold || 0) +
                    trucks.reduce(
                      (total, truck) =>
                        total +
                        (dayClosed ? 0 : Number(soldByTruck[truck._id] || 0)),
                      0,
                    )}
                </td>

                <td className="border-r border-t border-slate-200 px-4 py-3 text-center text-blue-700">
                  {Number(liveSummary.finalTotal || 0) +
                    trucks.reduce(
                      (total, truck) =>
                        total +
                        (dayClosed
                          ? 0
                          : Number(truckAssignments[truck._id] || 0)),
                      0,
                    ) -
                    (Number(liveShopSold || 0) +
                      trucks.reduce(
                        (total, truck) =>
                          total +
                          (dayClosed ? 0 : Number(soldByTruck[truck._id] || 0)),
                        0,
                      ))}
                </td>

                <td className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-500">
                  Summary
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section
        className={`overflow-hidden rounded-2xl border shadow-sm ${dayClosed ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">
              Today&apos;s bar distribution and truck closing
            </h2>
            {dayClosed && <p className="mt-1 text-sm text-navy-800/50">All live counters are reset to 0. The completed figures remain in the historical reports.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`pill shrink-0 ${dayClosed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {dayClosed
                ? "Today Closed"
                : `${driverClosings.filter((row) => row.checked).length}/${driverClosings.length} trucks checked`}
            </span>
            {!dayClosed && pendingTruckChecks.length > 0 && (
              <button
                type="button"
                onClick={() => void checkAllTrucks()}
                disabled={checkingAll}
                className="btn-secondary flex shrink-0 items-center gap-2 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheck />{" "}
                {checkingAll
                  ? "Checking all..."
                  : `Check All Trucks (${pendingTruckChecks.length})`}
              </button>
            )}
          </div>
        </div>

        {dayClosed && (
          <div className="mx-5 mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white/80 p-4 text-emerald-800 sm:mx-6">
            <FiCalendar className="mt-0.5 shrink-0 text-xl" />
            <div>
              <p className="font-semibold">
                Next production starts automatically on{" "}
                {nextIndiaDayLabel(activeDay)}.
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-700/80">
                At 12:00 AM IST, this page switches to the new day, unlocks
                production actions, and continues from the next box-counter
                reading.
              </p>
            </div>
          </div>
        )}

        {closingError && (
          <div className="mx-5 mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 sm:mx-6">
            <p className="font-semibold">{closingMessage}</p>
            {closingDrivers.map((driver: any) => (
              <p key={driver.truckId} className="mt-1">
                {driver.truckName}: {driver.reason}
              </p>
            ))}
          </div>
        )}

        <div className="mx-5 mb-5 mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm sm:mx-6 sm:grid-cols-4">
          <div className="col-span-3 flex items-center justify-between border-b border-emerald-200 bg-emerald-100/70 px-3 py-2 sm:col-span-1 sm:border-b-0 sm:border-r">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">
                Shop Distribution
              </p>
              <p className="mt-0.5 text-sm font-bold text-navy-900">
                Main Shop
              </p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 font-black text-white shadow-sm">
              S
            </span>
          </div>
          <div className="border-r border-emerald-200 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-navy-800/45">
              Total Bar
            </p>
            <p className="mt-1 font-display text-lg font-bold text-navy-900">
              {fmtBars(
                Number(liveSummary.finalTotal || 0) + Number(liveShopSold || 0),
              )}
            </p>
          </div>
          <div className="border-r border-emerald-200 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-navy-800/45">
              Sold
            </p>
            <p className="mt-1 font-display text-lg font-bold text-emerald-600">
              {fmtBars(Number(liveShopSold || 0))}
            </p>
          </div>
          <div className="px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-navy-800/45">
              Balance
            </p>
            <p
              className={`mt-1 font-display text-lg font-bold ${Number(liveSummary.finalTotal || 0) < 0 ? "text-red-600" : "text-emerald-700"}`}
            >
              {fmtBars(Number(liveSummary.finalTotal || 0))}
            </p>
          </div>
        </div>

        {/* Reconciliation is the single source for truck distribution and closing. */}
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wider text-navy-900">
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  S.No
                </th>
                <th className="border-r border-slate-300 px-4 py-3">
                  Truck &amp; Driver
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Total Bar
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Sold
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Return
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Balance
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Status
                </th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {driverClosings.map((row, index) => {
                const remaining = Number(row.remaining || 0);
                const truckPresence = trucks.find((truck) => truck._id === row.truckId);
                const driverOnline = Boolean(
                  row.isOnline ?? row.driverOnline ?? row.online ??
                  row.truck?.isOnline ?? row.truck?.driverOnline ?? row.truck?.online ??
                  truckPresence?.isOnline ?? truckPresence?.driverOnline ?? truckPresence?.online ?? false
                );
                return (
                  <tr
                    key={row.truckId}
                    className={`border-b border-slate-200 transition hover:bg-slate-50 ${
                      row.checked
                        ? "bg-emerald-50/40"
                        : row.driverClosed
                          ? "bg-iceblue-50/30"
                          : "bg-amber-50/30"
                    }`}
                  >
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-semibold text-navy-900">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3">
                      <p className="font-bold text-navy-900">
                        {row.truck?.truckName || "Truck"}
                      </p>
                      <p className="text-xs text-navy-800/50">
                        {row.truck?.driverName || "Driver"}
                        {row.truck?.truckNumber
                          ? ` · ${row.truck.truckNumber}`
                          : ""}
                      </p>
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-navy-900">
                      {fmtBars(Number(row.taken || 0))}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-navy-900">
                      {fmtBars(Number(row.sold || 0))}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-navy-900">
                      {fmtBars(Number(row.returned || 0))}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-black text-navy-900">
                      {fmtBars(remaining)}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          driverOnline
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {driverOnline ? "Online" : "Offline"}
                      </span>
                      {!row.driverClosed && row.closeReason && (
                        <p className="mt-1 text-[10px] text-amber-700">
                          {row.closeReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!dayClosed && row.driverClosed && !row.checked ? (
                        <button
                          type="button"
                          onClick={() => void checkTruckClosing(row)}
                          disabled={
                            checkingTruck === row.truckId || checkingAll
                          }
                          className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {checkingTruck === row.truckId
                            ? "Accepting..."
                            : "Accept"}
                        </button>
                      ) : row.checked ? (
                        <span className="text-xs font-semibold text-emerald-600">
                          Done
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {driverClosings.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    No active trucks to check today.
                  </td>
                </tr>
              )}
            </tbody>

            {driverClosings.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-navy-900">
                  <td
                    colSpan={2}
                    className="border-r border-t border-slate-200 px-4 py-3 text-right text-xs font-black uppercase tracking-wider"
                  >
                    Total
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                    {fmtBars(
                      driverClosings.reduce(
                        (sum, r) => sum + Number(r.taken || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                    {fmtBars(
                      driverClosings.reduce(
                        (sum, r) => sum + Number(r.sold || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                    {fmtBars(
                      driverClosings.reduce(
                        (sum, r) => sum + Number(r.returned || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                    {fmtBars(
                      driverClosings.reduce(
                        (sum, r) => sum + Number(r.remaining || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td
                    colSpan={2}
                    className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-500"
                  >
                    {driverClosings.filter((r) => r.checked).length}/
                    {driverClosings.length} checked
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Branch closing sheet */}
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wider text-navy-900">
                <th className="border-r border-slate-300 px-4 py-3">Branch</th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Made
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Sold
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Wastage
                </th>
                <th className="border-r border-slate-300 px-4 py-3 text-center">
                  Status
                </th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {closings.map((row, index) => (
                <tr
                  key={row._id}
                  className={`border-b border-slate-200 transition hover:bg-slate-50 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                  }`}
                >
                  <td className="border-r border-slate-200 px-4 py-3 font-semibold text-navy-900">
                    {row.branch?.name || "Selected Branch"}{" "}
                    {row.branch?.code ? `(${row.branch.code})` : ""}
                  </td>
                  <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-navy-900">
                    {fmtBars(Number(row.produced || 0))}
                  </td>
                  <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-navy-900">
                    {fmtBars(Number(row.sold || 0))}
                  </td>
                  <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-navy-900">
                    {fmtBars(Number(row.wastage || 0))}
                  </td>
                  <td className="border-r border-slate-200 px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        row.status === "closed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {row.status === "closed" ? "Closed" : "Open"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.status === "closed" ? (
                      <button
                        type="button"
                        onClick={() => void reopenDay(row)}
                        disabled={pendingAction === `reopen-${row._id}`}
                        className="btn-secondary px-3 py-1.5 text-xs text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pendingAction === `reopen-${row._id}`
                          ? "Reopening..."
                          : "Reopen"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCloseTarget(row)}
                        disabled={!readyToClose}
                        className="btn-primary flex items-center gap-2 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiCheckCircle />{" "}
                        {readyToClose ? "Close Today" : "Waiting for Checks"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {closings.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    No branch closing record for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">
              Production History
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Today
            </span>
            <Link
              href="/admin/production/records"
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              All Records
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="w-full">
          {loading ? (
            <LoadingRows />
          ) : todayHistoryRecords.length ? (
            <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr className="text-navy-900">
                  <th className="w-[5%] border-b border-r border-slate-300 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide">
                    #
                  </th>

                  <th className="w-[18%] border-b border-r border-slate-300 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide">
                    Date
                  </th>

                  <th className="w-[11%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Open
                  </th>

                  <th className="w-[11%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Close
                  </th>

                  <th className="w-[15%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Total Bars
                  </th>

                  <th className="w-[13%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Stocks
                  </th>

                  <th className="w-[18%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Selling Bars
                  </th>

                  <th className="w-[9%] border-b border-slate-300 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {todayHistoryRecords.map((r, index) => {
                  const dateKey = indiaDateKey(r.date);

                  const stockForDate = Number(stockByDate[dateKey] || 0);

                  const outsourceForDate = Number(
                    outsourceByDate[dateKey] || 0,
                  );

                  const totalBars = Number(r.totalBars || 0);

                  const sellingBars =
                    totalBars + outsourceForDate - stockForDate;

                  return (
                    <tr
                      key={r._id}
                      className="group bg-white transition-colors hover:bg-slate-50"
                    >
                      {/* Serial Number */}
                      <td className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-xs font-semibold text-slate-400 group-hover:bg-slate-100">
                        {index + 1}
                      </td>

                      {/* Date */}
                      <td className="border-b border-r border-slate-200 px-2 py-2.5 text-left text-xs font-semibold text-slate-700 sm:text-sm">
                        {formatDate(r.date)}
                      </td>

                      {/* Open */}
                      <td className="border-b border-r border-slate-200 px-2 py-2.5 text-right font-semibold tabular-nums text-slate-700">
                        {r.boxOpen}
                      </td>

                      {/* Close */}
                      <td className="border-b border-r border-slate-200 px-2 py-2.5 text-right font-semibold tabular-nums text-slate-700">
                        {r.boxClose}
                      </td>

                      {/* Total Bars */}
                      <td className="border-b border-r border-slate-200 px-2 py-2.5 text-right">
                        <span className="font-bold tabular-nums text-navy-900">
                          {fmtBars(totalBars)}
                        </span>
                      </td>

                      {/* Stocks */}
                      <td className="border-b border-r border-slate-200 px-2 py-2.5 text-right">
                        <span className="font-bold tabular-nums text-navy-900">
                          {fmtBars(stockForDate)}
                        </span>
                      </td>

                      {/* Selling Bars */}
                      <td className="border-b border-r border-slate-200 px-2 py-2.5 text-right">
                        <span className="font-bold tabular-nums text-navy-900">
                          {fmtBars(sellingBars)}
                        </span>
                      </td>

                      {/* Delete */}
                      <td className="border-b border-slate-200 px-2 py-2.5 text-center">
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => {
                            setDeleteError("");

                            setDeleteTarget({
                              kind: "production",
                              id: r._id,
                              label: `production record for ${formatDate(
                                r.date,
                              )}`,
                            });
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <FiTrash2 className="text-sm" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              title="No production recorded"
              description="Use Add Production to save the first box-counter reading."
            />
          )}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">
              Daily Sales
            </h2>
            <p className="mt-1 text-sm text-navy-800/50">
              Sales recorded today appear here immediately.
            </p>
          </div>
          <Link
            href="/admin/sales"
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            All Sales
          </Link>
        </div>

        {loading ? (
          <LoadingRows compact />
        ) : todaysSales.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse border border-slate-300 text-sm">
              <thead className="bg-slate-100 text-navy-900">
                <tr>
                  <th className="border border-slate-300 px-3 py-3 text-left text-xs uppercase">
                    Time
                  </th>
                  <th className="border border-slate-300 px-3 py-3 text-left text-xs uppercase">
                    Customer
                  </th>
                  <th className="border border-slate-300 px-3 py-3 text-left text-xs uppercase">
                    Truck / Shop
                  </th>
                  <th className="border border-slate-300 px-3 py-3 text-right text-xs uppercase">
                    Bars
                  </th>
                  <th className="border border-slate-300 px-3 py-3 text-right text-xs uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {todaysSales.map((sale) => {
                  const bars = (sale.items || []).reduce(
                    (sum: number, item: any) => sum + getItemBarUsed(item),
                    0,
                  );
                  return (
                    <tr key={sale._id} className="bg-white hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2.5 whitespace-nowrap">
                        {new Date(sale.date).toLocaleTimeString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="border border-slate-300 px-3 py-2.5 font-semibold text-navy-900">
                        {sale.customer?.name || "Unknown customer"}
                      </td>
                      <td className="border border-slate-300 px-3 py-2.5">
                        {sale.truck?.truckName || "Shop"}
                      </td>
                      <td className="border border-slate-300 px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatBarQuantity(bars) || "0"}
                      </td>
                      <td className="border border-slate-300 px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatCurrency(Number(sale.totalAmount || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl bg-iceblue-50 px-4 py-8 text-center text-sm text-navy-800/50">
            No sales recorded today.
          </p>
        )}
      </section>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">
              Truck Assignment &amp; Sales Report
            </h2>

            <p className="mt-1 text-sm text-navy-800/50">
              Every truck assignment is shown separately, with the total bars
              sold for that truck and day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Today
            </span>
            <Link
              href="/admin/production/truck-records"
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              All Records
            </Link>
          </div>
        </div>

        {loading ? (
          <LoadingRows compact />
        ) : todayTruckReportRows.length ? (
          <table className="w-full min-w-[760px] table-fixed border-collapse border border-slate-300 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="w-[15%] border border-slate-300 px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-navy-900">
                  Date
                </th>

                <th className="w-[18%] border border-slate-300 px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-navy-900">
                  Truck
                </th>

                <th className="w-[28%] border border-slate-300 px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-navy-900">
                  Separate Assignments
                </th>

                <th className="w-[13%] border border-slate-300 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-navy-900">
                  Total Bar
                </th>

                <th className="w-[13%] border border-slate-300 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-navy-900">
                  Sold Bars
                </th>

                <th className="w-[13%] border border-slate-300 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-navy-900">
                  Remaining
                </th>
              </tr>
            </thead>

            <tbody>
              {todayTruckReportRows.map((row) => (
                <tr
                  key={row.key}
                  className="bg-white transition-colors hover:bg-slate-50"
                >
                  {/* Date */}
                  <td className="border border-slate-300 px-3 py-2.5 align-middle">
                    {formatDate(`${row.date}T12:00:00+05:30`)}
                  </td>

                  {/* Truck */}
                  <td className="border border-slate-300 px-3 py-2.5 align-middle">
                    <p className="font-semibold text-navy-900">
                      {row.truckName}
                    </p>

                    {row.truckNumber && (
                      <p className="text-xs text-navy-800/45">
                        {row.truckNumber}
                      </p>
                    )}
                  </td>

                  {/* Separate Assignments */}
                  <td className="border border-slate-300 px-3 py-2.5 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      {row.assignments.map((assignment, index) => (
                        <span
                          key={assignment._id}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-navy-900"
                        >
                          #{index + 1}:{" "}
                          {fmtBars(Number(assignment.quantity || 0))} bars
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Total Taken */}
                  <td className="border border-slate-300 px-3 py-2.5 text-center align-middle font-semibold tabular-nums text-navy-900">
                    {fmtBars(row.taken)}
                  </td>

                  {/* Sold Bars */}
                  <td className="border border-slate-300 px-3 py-2.5 text-center align-middle font-semibold tabular-nums text-navy-900">
                    {fmtBars(row.sold)}
                  </td>

                  {/* Remaining */}
                  <td className="border border-slate-300 px-3 py-2.5 text-center align-middle font-semibold tabular-nums text-navy-900">
                    {fmtBars(row.taken - row.sold)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-xl bg-iceblue-50 px-4 py-8 text-center text-sm text-navy-800/50">
            No truck assignments recorded.
          </p>
        )}
      </section>

      <div ref={quickAddRef} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 sm:bottom-7 sm:right-7">
        {quickAddOpen && (
          <div className="mb-3 w-52 overflow-hidden rounded-2xl border border-iceblue-100 bg-white p-2 shadow-xl shadow-iceblue-900/20">
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                void openProdSettings();
              }}
              disabled={operationsLocked}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiSettings className="text-slate-600" /> Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                todaysStock ? openStockEdit(todaysStock) : openStockModal();
              }}
              disabled={operationsLocked}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiBox className="text-blue-600" />{" "}
              {todaysStock ? "Edit Stock" : "Add Stock"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                todaysOutsource
                  ? openOutsourceEdit(todaysOutsource)
                  : openOutsourceModal();
              }}
              disabled={operationsLocked}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiTruck className="text-amber-600" />{" "}
              {todaysOutsource ? "Edit Outsource" : "Add Outsource"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                todaysRecord ? openEdit(todaysRecord) : openModal();
              }}
              disabled={operationsLocked}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {todaysRecord ? (
                <FiEdit2 className="text-iceblue-600" />
              ) : (
                <FiPlus className="text-iceblue-600" />
              )}{" "}
              {todaysRecord ? "Edit Production" : "Add Production"}
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={openTruckBars}
              disabled={operationsLocked || trucks.length === 0}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiTruck className="text-iceblue-600" /> Add Truck
            </button>
            <button
              type="button"
              onClick={openSaleForm}
              disabled={operationsLocked}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiActivity className="text-emerald-600" /> Add Sale
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setQuickAddOpen((open) => !open)}
          disabled={operationsLocked}
          aria-expanded={quickAddOpen}
          aria-label="Open quick add menu"
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-iceblue-600 p-0 text-sm font-bold text-white shadow-lg shadow-iceblue-900/20 transition hover:-translate-y-0.5 hover:bg-iceblue-700 focus:outline-none focus:ring-4 focus:ring-iceblue-200 disabled:cursor-not-allowed disabled:bg-navy-800/30 disabled:hover:translate-y-0 sm:h-12 sm:w-12 sm:text-base"
        >
          <FiPlus
            className={`text-lg transition-transform ${
              quickAddOpen ? "rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {closeTarget && (
        <Modal
          title="Final Check & Close Today"
          onClose={() => setCloseTarget(null)}
          wide
        >
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <FiAlertCircle className="mt-0.5 shrink-0 text-xl" />
              <div>
                <p className="font-semibold">
                  Close today only after checking every value.
                </p>
                <p className="mt-1 text-sm leading-6">
                  After closing, production, stock, outsource, truck
                  assignments, sales, returns, and wastage are locked for today.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <CloseReviewMetric
                label="Opening"
                value={closeTarget.openingBalance}
              />
              <CloseReviewMetric label="Made" value={closeTarget.produced} />
              <CloseReviewMetric label="Sold" value={closeTarget.sold} />
              <CloseReviewMetric label="Wastage" value={closeTarget.wastage} />
              <CloseReviewMetric
                label="Balance"
                value={closeTarget.closingBalance}
                danger={Number(closeTarget.closingBalance || 0) < 0}
              />
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <FiCheckCircle className="mr-2 inline" /> All{" "}
              {driverClosings.length} truck
              {driverClosings.length === 1 ? "" : "s"} closed and checked
            </div>
            {closingError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {closingMessage}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCloseTarget(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void closeDay(closeTarget)}
                disabled={closingDay}
                className="btn-primary"
              >
                {closingDay ? "Closing..." : "Yes, Close Today"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {truckBarsOpen && (
        <Modal
          title="Today's Truck Bars"
          onClose={() => setTruckBarsOpen(false)}
        >
          <div className="space-y-5">
            <div>
              <label className="label-text">Truck</label>
              <select
                className="input-field h-12"
                value={selectedTruck}
                onChange={(event) => changeSelectedTruck(event.target.value)}
              >
                <option value="">Select truck</option>
                {trucks.map((truck) => (
                  <option key={truck._id} value={truck._id}>
                    {truck.truckName} ({truck.truckNumber})
                  </option>
                ))}
              </select>
            </div>

            {selectedTruck ? (
              <>
                <div className="rounded-2xl bg-iceblue-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-navy-800/45">
                    Assigned Today
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold text-navy-900">
                    {fmtBars(Number(truckAssignments[selectedTruck] || 0))} bars
                  </p>
                </div>

                <div>
                  <label className="label-text">Add Bar Quantity</label>
                  <p className="mb-2 text-xs text-navy-800/50">
                    Each save adds a separate assignment to today&apos;s truck
                    report.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      className="input-field h-11 flex-1"
                      placeholder="Bars to add"
                      value={exactTruckBars}
                      onChange={(event) =>
                        setExactTruckBars(event.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => void addTruckBars(Number(exactTruckBars))}
                      disabled={savingTruckBars}
                      className="btn-primary shrink-0 px-5"
                    >
                      {savingTruckBars ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>

                {truckBarsError && (
                  <p className="text-sm font-medium text-red-600">
                    {truckBarsError}
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-2xl bg-iceblue-50 px-4 py-6 text-center text-sm text-navy-800/50">
                No truck is available.
              </p>
            )}
          </div>
        </Modal>
      )}

      {saleModalOpen && (
        <Modal title="Add Sale" onClose={() => setSaleModalOpen(false)} wide>
          <SaleForm trucks={trucks} onSaved={() => void handleSaleSaved()} />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Confirm Delete" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-navy-800/70">
              Are you sure you want to delete the {deleteTarget.label}? This
              cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={pendingAction === "delete"}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRemove()}
                disabled={pendingAction === "delete"}
                className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingAction === "delete" ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {stockModalOpen && (
        <Modal
          title={stockEditing ? "Edit Stock" : "Add Stock"}
          onClose={() => setStockModalOpen(false)}
        >
          <form onSubmit={submitStock} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input
                type="date"
                className="input-field"
                required
                value={stockDate}
                onChange={(e) => setStockDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">Quantity</label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                required
                className="input-field"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
              />
              <p className="mt-1 text-xs text-navy-800/50">
                Supports quarter-bar sizes: 0.25, 0.5, 0.75, 1, 1.25... Deducted
                from Total Bars to show Final Total Bars.
              </p>
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea
                className="input-field"
                rows={2}
                value={stockNotes}
                onChange={(e) => setStockNotes(e.target.value)}
              />
            </div>
            {stockError && <p className="text-sm text-red-600">{stockError}</p>}
            <button
              className="btn-primary w-full"
              disabled={pendingAction === "stock"}
            >
              {pendingAction === "stock"
                ? "Saving..."
                : stockEditing
                  ? "Save Changes"
                  : "Save Stock"}
            </button>
            {stockEditing && (
              <button
                type="button"
                onClick={() => {
                  setStockModalOpen(false);
                  setDeleteError("");
                  setDeleteTarget({
                    kind: "stock",
                    id: stockEditing._id,
                    label: `stock entry for ${formatDate(stockEditing.date)}`,
                  });
                }}
                className="w-full rounded-xl border border-red-200 py-2.5 font-semibold text-red-600 hover:bg-red-50"
              >
                Delete Stock Entry
              </button>
            )}
          </form>
        </Modal>
      )}

      {outsourceModalOpen && (
        <Modal
          title={outsourceEditing ? "Edit Outsource" : "Add Outsource"}
          onClose={() => setOutsourceModalOpen(false)}
        >
          <form onSubmit={submitOutsource} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input
                type="date"
                className="input-field"
                required
                value={outsourceDate}
                onChange={(e) => setOutsourceDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">Quantity</label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                required
                className="input-field"
                value={outsourceQuantity}
                onChange={(e) => setOutsourceQuantity(e.target.value)}
              />
              <p className="mt-1 text-xs text-navy-800/50">
                Supports quarter-bar sizes: 0.25, 0.5, 0.75, 1, 1.25... Added to
                Selling Bars for bars brought in from an outside source.
              </p>
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea
                className="input-field"
                rows={2}
                value={outsourceNotes}
                onChange={(e) => setOutsourceNotes(e.target.value)}
              />
            </div>
            {outsourceError && (
              <p className="text-sm text-red-600">{outsourceError}</p>
            )}
            <button
              className="btn-primary w-full"
              disabled={pendingAction === "outsource"}
            >
              {pendingAction === "outsource"
                ? "Saving..."
                : outsourceEditing
                  ? "Save Changes"
                  : "Save Outsource"}
            </button>
            {outsourceEditing && (
              <button
                type="button"
                onClick={() => {
                  setOutsourceModalOpen(false);
                  setDeleteError("");
                  setDeleteTarget({
                    kind: "outsource",
                    id: outsourceEditing._id,
                    label: `outsource entry for ${formatDate(outsourceEditing.date)}`,
                  });
                }}
                className="w-full rounded-xl border border-red-200 py-2.5 font-semibold text-red-600 hover:bg-red-50"
              >
                Delete Outsource Entry
              </button>
            )}
          </form>
        </Modal>
      )}

      {modalOpen && (
        <Modal
          title={editing ? "Edit Production" : "Add Production"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input
                type="date"
                className="input-field"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">Box Open</label>
              <input
                type="number"
                className="input-field bg-iceblue-50"
                value={boxInfo?.nextOpen ?? ""}
                disabled
              />
              <p className="mt-1 text-xs text-navy-800/50">
                {editing
                  ? "Fixed to this record’s original opening reading."
                  : "Continues automatically from the previous closing box reading."}
              </p>
            </div>
            <div>
              <label className="label-text">Box Close</label>
              <input
                type="number"
                min={1}
                max={boxInfo?.totalBoxes}
                required
                placeholder={boxInfo ? `1 to ${boxInfo.totalBoxes}` : ""}
                className="input-field"
                value={boxClose}
                onChange={(e) => setBoxClose(e.target.value)}
              />
              <p className="mt-1 text-xs text-navy-800/50">
                Boxes wrap back to 1 after reaching{" "}
                {boxInfo?.totalBoxes ?? "..."}, so closing can be lower than
                opening.
              </p>
            </div>
            {preview && (
              <div className="rounded-xl bg-iceblue-50 p-3 text-sm">
                <p>
                  Boxes made:{" "}
                  <span className="font-semibold">{preview.boxesProduced}</span>
                </p>
                <p>
                  Ice bars made:{" "}
                  <span className="font-semibold">{preview.barsProduced}</span>{" "}
                  ({boxInfo?.barsPerBox} bars/box)
                </p>
              </div>
            )}
            <div>
              <label className="label-text">Notes</label>
              <textarea
                className="input-field"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              className="btn-primary w-full"
              disabled={!boxInfo || !preview || pendingAction === "production"}
            >
              {pendingAction === "production"
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Save Production"}
            </button>
          </form>
        </Modal>
      )}

      {prodSettingsOpen && (
        <Modal
          title="Production Settings"
          onClose={() => setProdSettingsOpen(false)}
        >
          <form onSubmit={saveProdSettings} className="space-y-3">
            <p className="text-sm text-navy-800/60">
              Boxes are numbered 1 to Total Boxes and wrap back to 1. Bars
              produced = boxes made &times; bars per box.
            </p>
            <div>
              <label className="label-text">Total Boxes</label>
              <input
                type="number"
                min={1}
                required
                className="input-field"
                value={prodSettingsForm.totalBoxes}
                onChange={(e) =>
                  setProdSettingsForm({
                    ...prodSettingsForm,
                    totalBoxes: e.target.value,
                  })
                }
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
                onChange={(e) =>
                  setProdSettingsForm({
                    ...prodSettingsForm,
                    barsPerBox: e.target.value,
                  })
                }
              />
            </div>
            {prodSettingsError && (
              <p className="text-sm text-red-600">{prodSettingsError}</p>
            )}
            <button
              className="btn-primary w-full"
              disabled={prodSettingsSaving}
            >
              {prodSettingsSaving ? "Saving..." : "Save Production Settings"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm ${
        primary
          ? "bg-iceblue-500 text-white hover:bg-iceblue-600"
          : "text-navy-900 hover:bg-slate-100"
      }`}
    >
      <span className={primary ? "text-white" : "text-iceblue-700"}>{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function ProductionSummary({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${danger ? "border-red-200" : "border-iceblue-100"}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${danger ? "bg-red-50 text-red-600" : "bg-iceblue-50 text-iceblue-700"}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-wide text-navy-800/45">
          {label}
        </p>
        <p
          className={`truncate font-display text-base font-bold ${danger ? "text-red-600" : "text-navy-900"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function LoadingRows({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`animate-pulse space-y-3 ${compact ? "py-2" : "p-5"}`}
      aria-label="Loading data"
    >
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

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-iceblue-50 text-xl text-iceblue-600">
        <FiBox />
      </span>
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
  takenLabel = "Total Bar",
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
    <div
      className={`min-w-0 rounded-2xl border p-4 shadow-sm ${shop ? "border-emerald-100 bg-emerald-50/70" : "border-iceblue-100 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`truncate text-[11px] font-bold uppercase tracking-wide ${shop ? "text-emerald-700/70" : "text-navy-800/45"}`}
          >
            {label}
          </p>
          {detail && (
            <p className="mt-0.5 truncate text-[10px] text-navy-800/40">
              {detail}
            </p>
          )}
        </div>
        {shop ? (
          <FiBox className="shrink-0 text-emerald-600" />
        ) : (
          <FiTruck className="shrink-0 text-iceblue-600" />
        )}
      </div>
      <div
        className={`mt-3 grid gap-2 ${soldOnly ? "grid-cols-1" : "grid-cols-2"}`}
      >
        {!soldOnly && (
          <DistributionMetric
            label={takenLabel}
            value={taken}
            tone={danger ? "danger" : shop ? "shop" : "default"}
          />
        )}
        <DistributionMetric label="Sold" value={sold} tone="sold" />
      </div>
    </div>
  );
}

function DistributionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "shop" | "sold" | "danger";
}) {
  const tones = {
    default: "bg-iceblue-50 text-navy-900",
    shop: "bg-white/80 text-emerald-700",
    sold: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-600",
  };

  return (
    <div className={`min-w-0 rounded-xl px-2.5 py-2 ${tones[tone]}`}>
      <p className="text-[9px] font-bold uppercase tracking-wide opacity-60">
        {label}
      </p>
      <p className="mt-0.5 truncate font-display text-lg font-bold">
        {fmtBars(value)}
      </p>
    </div>
  );
}

function CloseReviewMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 ${danger ? "bg-red-50" : "bg-iceblue-50"}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-bold ${danger ? "text-red-600" : "text-navy-900"}`}
      >
        {fmtBars(Number(value || 0))}
      </p>
    </div>
  );
}
