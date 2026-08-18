"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiActivity,
  FiAlertCircle,
  FiBox,
  FiCheck,
  FiCheckCircle,
  FiEdit2,
  FiDollarSign,
  FiGitBranch,
  FiPlus,
  FiRefreshCw,
  FiSettings,
  FiTrash2,
  FiTruck,
} from "react-icons/fi";
import api, { dedupedGet } from "../../../lib/api";
import { getItemBarUsed, formatDate, WASTAGE_REASONS } from "../../../lib/api";
import Modal from "../../../components/Modal";
import SaleForm from "../../../components/SaleForm";
import { formatBarQuantity, formatCurrency } from "../../../lib/api";
import useDismissibleMenu from "../../../hooks/useDismissibleMenu";
import { useAuth } from "../../../context/AuthContext";
import { selectedBranchHeaders } from "../../../lib/branch-fetch";
import { getOpeningProductionStock } from "../../../lib/production-stock";

type BoxInfo = { nextOpen: number; totalBoxes: number; barsPerBox: number };
type BranchOption = { _id: string; name: string; code: string; isActive?: boolean };
type TruckOption = { _id: string; truckName: string; truckNumber: string; isOnline?: boolean; driverOnline?: boolean; online?: boolean };
type TruckLoad = {
  _id: string;
  date: string;
  quantity: number;
  createdAt?: string;
  truck?: TruckOption | string;
};

const LOAD_SECTIONS = [
  "production",
  "sales",
  "wastage",
  "stock",
  "outsource",
  "trucks",
  "assignments",
  "truckLoads",
  "closing",
  "reconciliation",
] as const;
type LoadSection = (typeof LOAD_SECTIONS)[number];

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

export default function ProductionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeDay, setActiveDay] = useState(todayIndiaISO());
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [wastage, setWastage] = useState<any[]>([]);
  const [wastageModalOpen, setWastageModalOpen] = useState(false);
  const [wastageEditing, setWastageEditing] = useState<any | null>(null);
  const [wastageQuantity, setWastageQuantity] = useState("");
  const [wastageReason, setWastageReason] = useState("broken");
  const [wastageNotes, setWastageNotes] = useState("");
  const [wastageError, setWastageError] = useState("");
  const [savingWastage, setSavingWastage] = useState(false);
  const [stockEntries, setStockEntries] = useState<any[]>([]);
  const [outsourceEntries, setOutsourceEntries] = useState<any[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<any[]>([]);
  const [expenseLoadError, setExpenseLoadError] = useState("");
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
    kind: "production" | "stock" | "outsource" | "wastage";
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
  const [truckAssignmentDetails, setTruckAssignmentDetails] = useState<Record<string, any>>({});
  const [closings, setClosings] = useState<any[]>([]);
  const [driverClosings, setDriverClosings] = useState<any[]>([]);
  const [closeTarget, setCloseTarget] = useState<any | null>(null);
  const [closingError, setClosingError] = useState<any>(null);
  const [checkingTruck, setCheckingTruck] = useState("");
  const [checkingAll, setCheckingAll] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [reopeningDay, setReopeningDay] = useState(false);
  const [truckBarsOpen, setTruckBarsOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState("");
  const [exactTruckBars, setExactTruckBars] = useState("");
  const [savingTruckBars, setSavingTruckBars] = useState(false);
  const [cancellingTruckBars, setCancellingTruckBars] = useState(false);
  const [truckBarsError, setTruckBarsError] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
  useDismissibleMenu(quickAddOpen, quickAddRef, closeQuickAdd);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const loadDayRef = useRef("");
  const midnightClosingRef = useRef(false);
  const autoOpenProductionRef = useRef(false);
  const isSuperAdmin = user?.role === "super_admin";
  const canManageProduction = !isSuperAdmin || Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);

  useEffect(() => {
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem("tii_selected_branch") || "";
    setSelectedBranch(isSuperAdmin ? storedBranch : user?.branch || "");
    if (isSuperAdmin) {
      api.get("/branches")
        .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
        .catch(() => setBranches([]));
    }
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    setExpenseLoadError("");
    fetch(`/api/expenses?date=${encodeURIComponent(activeDay)}`, {
      cache: "no-store",
      headers: selectedBranchHeaders(),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "Could not load expenses");
        setExpenseRecords(Array.isArray(payload.records) ? payload.records : []);
      })
      .catch((error) => {
        setExpenseRecords([]);
        setExpenseLoadError(error?.message || "Could not load expenses");
      });
  }, [authLoading, selectedBranch, activeDay]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem("tii_selected_branch", branch);
    else window.localStorage.removeItem("tii_selected_branch");
    window.location.reload();
  };

  const load = useCallback(
    (initial = false, sections: readonly LoadSection[] = LOAD_SECTIONS, silent = false) => {
      if (loadInFlightRef.current) {
        if (silent || (initial && loadDayRef.current === activeDay)) return loadInFlightRef.current;
        return loadInFlightRef.current.then(() => load(initial, sections, silent));
      }
      loadDayRef.current = activeDay;
      if (initial) setLoading(true);
      if (!initial && !silent) setRefreshing(true);
      if (!silent) setLoadError("");

      const task = (async () => {
        const definitions = [
          { key: "production" as const, label: "production", request: () => dedupedGet("/production") },
          { key: "sales" as const, label: "sales", request: () => dedupedGet("/sales") },
          { key: "wastage" as const, label: "wastage", request: () => dedupedGet("/wastage") },
          { key: "stock" as const, label: "stock", request: () => dedupedGet("/stock-entries") },
          { key: "outsource" as const, label: "outsource", request: () => dedupedGet("/outsource-entries") },
          { key: "trucks" as const, label: "trucks", request: () => dedupedGet("/trucks") },
          { key: "assignments" as const, label: "truck assignments", request: () => dedupedGet("/truck-assignments", { params: { date: activeDay } }) },
          { key: "truckLoads" as const, label: "truck loads", request: () => dedupedGet("/truck-loads") },
          { key: "closing" as const, label: "daily closing", request: () => dedupedGet("/daily-closing", { params: { date: activeDay } }) },
          { key: "reconciliation" as const, label: "truck checks", request: () => dedupedGet("/truck-loads/reconciliation", { params: { date: activeDay } }) },
        ].filter((definition) => sections.includes(definition.key));

        const completed: Array<{ definition: (typeof definitions)[number]; result: PromiseSettledResult<any> }> = [];
        // Limit concurrency so opening the page does not overwhelm rate-limited APIs.
        for (let index = 0; index < definitions.length; index += 3) {
          const batch = definitions.slice(index, index + 3);
          const results = await Promise.allSettled(batch.map((definition) => definition.request()));
          batch.forEach((definition, resultIndex) => completed.push({ definition, result: results[resultIndex] }));
        }

        let successful = 0;
        const failures: Array<{ label: string; reason: any }> = [];
        for (const { definition, result } of completed) {
          if (result.status === "rejected") {
            failures.push({ label: definition.label, reason: result.reason });
            continue;
          }
          successful += 1;
          const rows = Array.isArray(result.value.data) ? result.value.data : [];
          switch (definition.key) {
            case "production": setRecords(rows); break;
            case "sales": setSales(rows); break;
            case "wastage": setWastage(rows); break;
            case "stock": setStockEntries(rows); break;
            case "outsource": setOutsourceEntries(rows); break;
            case "trucks":
              setTrucks(rows);
              setSelectedTruck((current) => current || rows[0]?._id || "");
              break;
            case "assignments":
              setTruckAssignments(Object.fromEntries(rows.map((row: any) => [String(row.truck?._id || row.truck), Number(row.quantity || 0) + Number(row.pendingQuantity || 0)])));
              setTruckAssignmentDetails(Object.fromEntries(rows.map((row: any) => [String(row.truck?._id || row.truck), row])));
              break;
            case "truckLoads": setTruckLoads(rows); break;
            case "closing": setClosings(rows); break;
            case "reconciliation": setDriverClosings(rows); break;
          }
        }

        if (successful > 0) setLastUpdated(new Date());
        if (!silent && failures.length > 0) {
          const rateLimited = failures.some(({ reason }) => reason?.response?.status === 429);
          const failedNames = failures.map(({ label }) => label).join(", ");
          setLoadError(
            rateLimited
              ? `The server is busy. Showing the last available data; retry ${failedNames} in a moment.`
              : successful > 0
                ? `Some information could not refresh: ${failedNames}. Other production data is still available.`
                : failures[0]?.reason?.response?.data?.message || "Could not load production data",
          );
        }
      })().finally(() => {
        setLoading(false);
        if (!silent) setRefreshing(false);
        loadInFlightRef.current = null;
      });

      loadInFlightRef.current = task;
      return task;
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
    void fetchNextBox().catch(() => setBoxInfo(null));
  }, [load]);

  useEffect(() => {
    const refreshDriverPresence = () => {
      if (document.visibilityState !== "visible") return;
      void load(false, ["trucks", "reconciliation", "assignments"], true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshDriverPresence();
    };
    const timer = window.setInterval(refreshDriverPresence, 60_000);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  const activeSessionStartedAt =
    canManageProduction && closings[0]?.status === "open" && closings[0]?.sessionStartedAt
      ? new Date(closings[0].sessionStartedAt).getTime()
      : 0;
  const isCurrentSessionEntry = (row: any) =>
    !activeSessionStartedAt ||
    new Date(row.createdAt || row.date).getTime() >= activeSessionStartedAt;

  const summary = useMemo(() => {
    const today = activeDay;
    const madeToday = records
      .filter((row) => indiaDateKey(row.date) === today && isCurrentSessionEntry(row))
      .reduce((sum, row) => sum + Number(row.totalBars || 0), 0);
    // Once a daily-closing record exists for today, it is the authoritative
    // source for the balance carried into the (possibly reopened) session —
    // getOpeningProductionStock only looks at stock entries dated *before*
    // today, so it can never see a same-day reopen's closing balance and
    // falls back to stale, unrelated older stock instead.
    const todaysClosing = closings[0];
    const carriedStock = todaysClosing
      ? Math.max(0, Number(todaysClosing.openingBalance || 0))
      : getOpeningProductionStock(stockEntries, today, indiaDateKey, undefined, records);
    const openingStock = madeToday > 0
      ? carriedStock
      : 0;
    const produced = madeToday + openingStock;
    const shopSold = sales
      .filter((sale) => indiaDateKey(sale.date) === today && !sale.truck && isCurrentSessionEntry(sale))
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
        (row) => indiaDateKey(row.date) === today && row.reason !== "unsold" && !row.truck && isCurrentSessionEntry(row),
      )
      .reduce((sum, row) => sum + getItemBarUsed(row), 0);
    const movedToStock = stockEntries
      .filter((row) => indiaDateKey(row.date) === today && isCurrentSessionEntry(row))
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const outsourced = outsourceEntries
      .filter((row) => indiaDateKey(row.date) === today && isCurrentSessionEntry(row))
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const assigned = truckLoads
      .filter((row) => indiaDateKey(row.date) === today && isCurrentSessionEntry(row))
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    // Main Shop receives what remains after factory wastage, stock movement,
    // and truck distribution. Shop Ready is its live balance after shop sales.
    const shopTotal = Math.max(0, produced + outsourced - wasted - movedToStock - assigned);
    const finalTotal = Math.max(0, shopTotal - shopSold);
    return {
      madeToday,
      openingStock,
      produced,
      sold: shopSold,
      wasted,
      stocked: madeToday > 0 ? movedToStock : carriedStock + movedToStock,
      movedToStock,
      outsourced,
      assigned,
      shopSold,
      shopTotal,
      balance: finalTotal,
      finalTotal,
    };
  }, [
    records,
    sales,
    wastage,
    stockEntries,
    outsourceEntries,
    truckAssignments,
    truckLoads,
    closings,
    activeDay,
    activeSessionStartedAt,
  ]);

  const todaysSales = useMemo(
    () => sales.filter((sale) => indiaDateKey(sale.date) === activeDay),
    [sales, activeDay],
  );

  const sessionSales = useMemo(
    () => todaysSales.filter((sale) => isCurrentSessionEntry(sale)),
    [todaysSales, activeSessionStartedAt],
  );

  const todaysShopWastage = useMemo(
    () => wastage
      .filter((entry) => indiaDateKey(entry.date) === activeDay && entry.reason !== "unsold" && !entry.truck)
      .sort((a, b) => String(b.createdAt || b._id).localeCompare(String(a.createdAt || a._id))),
    [wastage, activeDay],
  );

  const soldByTruck = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of sessionSales) {
      const truckId = String(sale.truck?._id || sale.truck || "");
      if (!truckId) continue;
      const sold = (sale.items || []).reduce(
        (sum: number, item: any) => sum + getItemBarUsed(item),
        0,
      );
      totals[truckId] = (totals[truckId] || 0) + sold;
    }
    return totals;
  }, [sessionSales]);

  const truckSoldToday = useMemo(
    () =>
      Object.values(soldByTruck).reduce((sum, quantity) => sum + quantity, 0),
    [soldByTruck],
  );

  const shopSoldToday = summary.shopSold;
  const totalSoldToday = shopSoldToday + truckSoldToday;
  const dailyShopSold = useMemo(
    () => todaysSales
      .filter((sale) => !sale.truck)
      .reduce((total, sale) => total + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0), 0),
    [todaysSales],
  );
  const dailyTruckSold = useMemo(
    () => todaysSales
      .filter((sale) => Boolean(sale.truck))
      .reduce((total, sale) => total + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0), 0),
    [todaysSales],
  );
  const dailyTotalSold = dailyShopSold + dailyTruckSold;
  const dailyShopWastage = useMemo(
    () => wastage
      .filter((row) => indiaDateKey(row.date) === activeDay && row.reason !== "unsold" && !row.truck)
      .reduce((sum, row) => sum + getItemBarUsed(row), 0),
    [wastage, activeDay],
  );
  const sessionNonReturnWastage = useMemo(
    () => wastage
      .filter((row) => indiaDateKey(row.date) === activeDay && row.reason !== "unsold" && isCurrentSessionEntry(row))
      .reduce((sum, row) => sum + getItemBarUsed(row), 0),
    [wastage, activeDay, activeSessionStartedAt],
  );
  const financialSummary = useMemo(() => {
    const salesAmount = todaysSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    const collectionAmount = todaysSales.reduce((sum, sale) => sum + Number(sale.paidAmount || 0), 0);
    const pendingAmount = todaysSales.reduce((sum, sale) => sum + Number(sale.balanceAmount || 0), 0);
    const expenses = expenseRecords.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    return {
      salesCount: todaysSales.length,
      salesAmount,
      collectionAmount,
      pendingAmount,
      expenses,
      profit: collectionAmount - expenses,
    };
  }, [todaysSales, expenseRecords]);
  const overallBranchRows = useMemo(() => branches
    .filter((branch) => branch.isActive !== false)
    .map((branch) => {
      const belongsToBranch = (row: any) => String(row.branch?._id || row.branch || "") === branch._id;
      const closing = closings.find((row) => belongsToBranch(row));
      const sessionStartedAt = closing?.status === "open" && closing?.sessionStartedAt
        ? new Date(closing.sessionStartedAt).getTime()
        : 0;
      const inActiveSession = (row: any) => !sessionStartedAt || new Date(row.createdAt || row.date).getTime() >= sessionStartedAt;
      const produced = records
        .filter((row) => indiaDateKey(row.date) === activeDay && belongsToBranch(row) && inActiveSession(row))
        .reduce((sum, row) => sum + Number(row.totalBars || 0), 0);
      const openingStock = produced > 0
        ? (closing
            ? Math.max(0, Number(closing.openingBalance || 0))
            : getOpeningProductionStock(stockEntries, activeDay, indiaDateKey, branch._id, records))
        : 0;
      const availableProduction = produced + openingStock;
      const branchSales = sales.filter((sale) => indiaDateKey(sale.date) === activeDay && belongsToBranch(sale));
      const liveBranchSales = closing?.status === "closed" ? branchSales : branchSales.filter(inActiveSession);
      const shopSold = liveBranchSales
        .filter((sale) => !sale.truck)
        .reduce((total, sale) => total + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0), 0);
      const truckSold = liveBranchSales
        .filter((sale) => Boolean(sale.truck))
        .reduce((total, sale) => total + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0), 0);
      const sessionWasted = wastage
        .filter((row) => indiaDateKey(row.date) === activeDay && belongsToBranch(row) && inActiveSession(row) && row.reason !== "unsold" && !row.truck)
        .reduce((sum, row) => sum + getItemBarUsed(row), 0);
      const dailyWasted = wastage
        .filter((row) => indiaDateKey(row.date) === activeDay && belongsToBranch(row) && row.reason !== "unsold" && !row.truck)
        .reduce((sum, row) => sum + getItemBarUsed(row), 0);
      const stocked = stockEntries
        .filter((row) => indiaDateKey(row.date) === activeDay && belongsToBranch(row) && inActiveSession(row))
        .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const outsourced = outsourceEntries
        .filter((row) => indiaDateKey(row.date) === activeDay && belongsToBranch(row) && inActiveSession(row))
        .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const assigned = truckLoads
        .filter((row) => indiaDateKey(row.date) === activeDay && belongsToBranch(row) && inActiveSession(row))
        .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const expenses = expenseRecords
        .filter((row) => belongsToBranch(row))
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const collection = branchSales.reduce((sum, sale) => sum + Number(sale.paidAmount || 0), 0);
      const dailySold = branchSales.reduce(
        (total, sale) => total + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0),
        0,
      );
      const branchProductionBars = closing
        ? Math.max(0, Number(closing.produced || 0) - Number(closing.returnedTotal ?? closing.returned ?? 0))
        : availableProduction;
      return {
        ...branch,
        produced: branchProductionBars,
        // Whole day's production history for this branch, across every
        // close/reopen session — matches the single-branch "Produced Today"
        // tile, not just the current session's own new production.
        madeToday: Number(closing?.produced || 0),
        sold: dailySold,
        ready: closing?.status === "closed" ? 0 : Math.max(0, availableProduction + outsourced - sessionWasted - stocked - assigned - shopSold),
        wasted: dailyWasted,
        expenses,
        profit: collection - expenses,
        closingBox: closing?.closingBox,
        status: closing?.status || "open",
      };
    }), [branches, records, sales, wastage, stockEntries, outsourceEntries, truckLoads, closings, expenseRecords, activeDay]);
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

  // Lets other pages (e.g. the Entry summary page's "Add Production" button)
  // deep-link here and open this same Add Production card automatically.
  useEffect(() => {
    if (authLoading || selectedBranch === null || autoOpenProductionRef.current) return;
    if (new URLSearchParams(window.location.search).get("openProduction") !== "1") return;
    autoOpenProductionRef.current = true;
    router.replace("/admin/production");
    if (canManageProduction) void openModal();
  }, [authLoading, selectedBranch, canManageProduction, router]);

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
  const openingStockForEntry = editing
    ? 0
    : getOpeningProductionStock(stockEntries, date, indiaDateKey, undefined, records);

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
      await load(false, ["production", "closing"]);
      await fetchNextBox().catch(() => undefined);
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
    wastage: "/wastage",
  };

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    setDeleteError("");
    setPendingAction("delete");
    try {
      await api.delete(
        `${deleteEndpoints[deleteTarget.kind]}/${deleteTarget.id}`,
      );
      const changedSection: LoadSection = deleteTarget.kind === "production"
        ? "production"
        : deleteTarget.kind;
      setDeleteTarget(null);
      await load(false, [changedSection, "closing"]);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || "Could not delete");
    } finally {
      setPendingAction("");
    }
  };

  const openStockModal = () => {
    const existing = stockEntries.find((entry) => indiaDateKey(entry.date) === activeDay) || null;
    if (existing) {
      setStockError("");
      setStockEditing(existing);
      setStockDate(String(existing.date).slice(0, 10));
      setStockQuantity(String(existing.quantity || ""));
      setStockNotes(existing.notes || "");
      setStockModalOpen(true);
      return;
    }

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
      await load(false, ["stock", "closing"]);
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
      await load(false, ["outsource", "closing"]);
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

  const openShopWastage = () => {
    setWastageEditing(null);
    setWastageQuantity("");
    setWastageReason("broken");
    setWastageNotes("");
    setWastageError("");
    setWastageModalOpen(true);
    setQuickAddOpen(false);
  };

  const openShopWastageEdit = (entry: any) => {
    setWastageEditing(entry);
    setWastageQuantity(String(entry.quantity || ""));
    setWastageReason(entry.reason || "broken");
    setWastageNotes(entry.notes || "");
    setWastageError("");
    setWastageModalOpen(true);
    setQuickAddOpen(false);
  };

  const saveShopWastage = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(wastageQuantity);
    if (!Number.isFinite(quantity) || quantity < 0.25 || Math.round(quantity * 4) !== quantity * 4) {
      setWastageError("Enter wastage in 0.25 bar increments.");
      return;
    }
    const originalQuantity = Number(wastageEditing?.quantity || 0);
    const availableForEntry = Math.max(0, Number(summary.finalTotal || 0) + originalQuantity);
    if (quantity > availableForEntry) {
      setWastageError(`Shop wastage cannot be more than the available shop balance of ${fmtBars(availableForEntry)} bar(s).`);
      return;
    }

    setSavingWastage(true);
    setWastageError("");
    try {
      const payload = {
        date: activeDay,
        size: "1",
        quantity,
        reason: wastageReason,
        notes: wastageNotes.trim(),
        truck: null,
        location: "shop",
      };
      if (wastageEditing) await api.patch(`/wastage/${wastageEditing._id}`, payload);
      else await api.post("/wastage", payload);
      setWastageModalOpen(false);
      setWastageEditing(null);
      await load(false, ["wastage", "closing"]);
    } catch (err: any) {
      setWastageError(err?.response?.data?.message || "Could not save shop wastage.");
    } finally {
      setSavingWastage(false);
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
    await load(false, ["sales", "closing", "reconciliation"]);
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
    const remainingBars = Math.max(0, Number(summary.finalTotal || 0));
    if (quantity > remainingBars) {
      setTruckBarsError(
        `Only ${fmtBars(remainingBars)} bar(s) remaining. You are assigning ${fmtBars(quantity)} bar(s), which is higher than the available balance.`,
      );
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
        [selectedTruck]: Number(data.quantity || 0) + Number(data.pendingQuantity || 0),
      }));
      setTruckAssignmentDetails((current) => ({ ...current, [selectedTruck]: data }));
      setExactTruckBars("");
      await load(false, ["assignments", "truckLoads", "closing", "reconciliation"]);
    } catch (err: any) {
      setTruckBarsError(
        err?.response?.data?.message || "Could not save today’s truck bars",
      );
    } finally {
      setSavingTruckBars(false);
    }
  };

  const cancelTruckBarRequest = async () => {
    const assignment = truckAssignmentDetails[selectedTruck];
    if (!assignment?._id || Number(assignment.pendingQuantity || 0) <= 0) return;
    setCancellingTruckBars(true);
    setTruckBarsError("");
    try {
      const { data } = await api.post(`/truck-assignments/${assignment._id}/cancel`);
      setTruckAssignmentDetails((current) => ({ ...current, [selectedTruck]: data }));
      setTruckAssignments((current) => ({
        ...current,
        [selectedTruck]: Number(data.quantity || 0),
      }));
      await load(false, ["assignments", "truckLoads", "reconciliation"]);
    } catch (err: any) {
      setTruckBarsError(err?.response?.data?.message || "Could not cancel the assignment request.");
    } finally {
      setCancellingTruckBars(false);
    }
  };

  const dayClosed =
    closings.length > 0 && closings.every((row) => row.status === "closed");
  const openClosing = closings.find((row) => row.status !== "closed") || null;
  const currentClosing = closings[0] || null;
  const hasCurrentSessionProduction = canManageProduction && Number(summary.produced || 0) > 0;
  const todayProductionRecords = records
    .filter((record) => indiaDateKey(record.date) === activeDay && (dayClosed || isCurrentSessionEntry(record)))
    .sort((a, b) => String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id)));
  // All made bars that were neither sold nor wasted are returned at closing.
  // Keep this formula aligned with DailyClosingService so the preview and the
  // saved closing report always use the same bar and box totals.
  const currentSessionReturnedBars = Math.max(
    0,
    Number(summary.produced || 0) - totalSoldToday - sessionNonReturnWastage,
  );
  const dailyReturnedBars = Math.max(0, Number(currentClosing?.returnedTotal ?? currentClosing?.returned ?? 0));
  // Production Bars is a running total of bars actually made today, across
  // every close/reopen session — currentClosing.produced already accumulates
  // that (production.sumBySizeInRange spans the whole day, not just this
  // session), so it must stand alone: adding openingBalance back in double
  // counts a same-day carried balance that is already part of this total.
  const closedProductionBars = Math.max(0, Number(currentClosing?.produced || 0));
  // "Produced Today" is only ever displayed for the live (not-closed) case
  // below, and should be the whole day's production history — every batch
  // made today across every close/reopen session, not just this session's
  // (summary.madeToday resets to 0 right after a reopen, which is correct
  // for the Shop Ready/return math but wrong for this display).
  const dailyProductionBars = Number(currentClosing?.produced || 0);
  const reportMadeBars = dayClosed ? Number(currentClosing?.produced || 0) : Number(summary.madeToday || 0);
  // Same running total as closedProductionBars above, kept live (not just for
  // an already-closed day) so the close-confirmation preview matches it too.
  const reportProductionBars = Math.max(0, Number(currentClosing?.produced || 0));
  const reportShopSold = dayClosed ? dailyShopSold : shopSoldToday;
  const reportTruckSold = dayClosed ? dailyTruckSold : truckSoldToday;
  const reportTotalSold = reportShopSold + reportTruckSold;
  // DailyClosing keeps the cumulative stock across close/reopen sessions and
  // is the authoritative closed-day report value. This also displays legacy
  // days correctly when StockEntry contains only the final session's balance.
  const stockAtClosingBars = Math.max(0, Number(dayClosed ? dailyReturnedBars : currentSessionReturnedBars));
  const lastTodayProductionRecord = todayProductionRecords[todayProductionRecords.length - 1];
  const calculatedClosingBox = lastTodayProductionRecord
    ? Number(lastTodayProductionRecord.boxClose)
    : null;
  const closingBoxNumber = dayClosed && currentClosing?.closingBox != null
    ? Number(currentClosing.closingBox)
    : calculatedClosingBox;
  const operationsLocked = loading || dayClosed || !canManageProduction;
  const validDriverClosings = useMemo(
    () => driverClosings.filter((row) => {
      const truckId = String(row.truckId || row.truck?._id || row.truck || "");
      return Boolean(
        truckId &&
        trucks.some((truck) => truck._id === truckId) &&
        Number(row.taken || 0) > 0,
      );
    }),
    [driverClosings, trucks],
  );
  const allDriversClosed = validDriverClosings.every((row) => row.driverClosed);
  const allDriversChecked = validDriverClosings.every((row) => row.checked);
  const onlineTrucks = trucks.filter((truck) => Boolean(truck.isOnline ?? truck.driverOnline ?? truck.online));
  const readyToClose = allDriversClosed && allDriversChecked && onlineTrucks.length === 0;
  const liveSummary = !canManageProduction
    ? {
        ...summary,
        // "Produced Today" should read as just today's new production for an
        // open branch (closed branches keep their net closed-report figure).
        produced: overallBranchRows.reduce(
          (sum, branch) => sum + (branch.status === "closed" ? branch.produced : branch.madeToday),
          0,
        ),
        sold: overallBranchRows.reduce((sum, branch) => sum + branch.sold, 0),
        shopSold: overallBranchRows.reduce((sum, branch) => sum + branch.sold, 0),
        shopTotal: overallBranchRows.reduce((sum, branch) => sum + branch.ready, 0),
        balance: overallBranchRows.reduce((sum, branch) => sum + branch.ready, 0),
        finalTotal: overallBranchRows.reduce((sum, branch) => sum + branch.ready, 0),
        wasted: overallBranchRows.reduce((sum, branch) => sum + branch.wasted, 0),
      }
    : dayClosed
      ? {
        ...summary,
        produced: closedProductionBars,
        sold: dailyShopSold,
        shopSold: dailyShopSold,
        shopTotal: dailyShopSold,
        balance: 0,
        finalTotal: 0,
      }
      : {
        ...summary,
        produced: dailyProductionBars,
        wasted: dailyShopWastage,
      };
  const liveShopSold = shopSoldToday;
  const liveTruckSold = truckSoldToday;
  const historyRecords = [...records].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  const todayHistoryRecords = historyRecords.filter(
    (record) => indiaDateKey(record.date) === activeDay,
  );
  const soldProductionBatchRows = useMemo(() => {
    const batches = records
      .filter((record) => indiaDateKey(record.date) === activeDay)
      .sort((a, b) => String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id)))
      .map((record) => ({
        ...record,
        branchId: String(record.branch?._id || record.branch || ""),
        soldBars: 0,
      }));
    if (!batches.length) return [];

    for (const sale of todaysSales) {
      const saleAt = new Date(sale.createdAt || sale.date).getTime();
      const saleBranchId = String(sale.branch?._id || sale.branch || "");
      let batchIndex = -1;
      for (let index = 0; index < batches.length; index += 1) {
        if (batches[index].branchId !== saleBranchId) continue;
        const batchAt = new Date(batches[index].createdAt || batches[index].date).getTime();
        if (batchAt <= saleAt) batchIndex = index;
      }
      if (batchIndex < 0) continue;
      batches[batchIndex].soldBars += (sale.items || []).reduce(
        (sum: number, item: any) => sum + getItemBarUsed(item),
        0,
      );
    }

    return batches.filter((batch) => batch.soldBars > 0).reverse();
  }, [records, todaysSales, activeDay]);
  const todayTruckReportRows = truckReportRows.filter(
    (row) => row.date === activeDay,
  );
  const pendingTruckChecks = useMemo(
    () => validDriverClosings.filter((row) => row.driverClosed && !row.checked),
    [validDriverClosings],
  );

  const checkTruckClosing = async (row: any) => {
    setCheckingTruck(row.truckId);
    setClosingError(null);
    try {
      await api.post("/truck-loads/reconciliation/check", {
        truck: row.truckId,
        date: activeDay,
      });
      await load(false, ["reconciliation", "closing"]);
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
      await load(false, ["reconciliation", "closing"]);
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
      await load(false, ["stock", "closing"]);
      await fetchNextBox().catch(() => undefined);
      return true;
    } catch (err: any) {
      setClosingError(
        err?.response?.data || { message: "Could not close today" },
      );
      return false;
    } finally {
      setClosingDay(false);
    }
  };

  useEffect(() => {
    const closeAtMidnight = async () => {
      const currentIndiaDay = todayIndiaISO();
      if (currentIndiaDay === activeDay || midnightClosingRef.current) return;
      midnightClosingRef.current = true;
      try {
        const needsClosing = canManageProduction && Boolean(openClosing) && !dayClosed;
        const closed = needsClosing ? await closeDay(openClosing) : true;
        if (closed) {
          setActiveDay(currentIndiaDay);
          setDate(currentIndiaDay);
          setStockDate(currentIndiaDay);
          setOutsourceDate(currentIndiaDay);
        }
      } finally {
        midnightClosingRef.current = false;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void closeAtMidnight();
    };
    const dayWatcher = window.setInterval(() => void closeAtMidnight(), 30_000);
    window.addEventListener("focus", closeAtMidnight);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(dayWatcher);
      window.removeEventListener("focus", closeAtMidnight);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeDay, canManageProduction, dayClosed, openClosing]);

  const reopenDay = async () => {
    if (!currentClosing || !canManageProduction) return;
    setReopeningDay(true);
    setClosingError(null);
    try {
      await api.post("/daily-closing/reopen", {
        date: activeDay,
        branch: currentClosing.branch?._id || currentClosing.branch,
      });
      setCloseTarget(null);
      await load(false, LOAD_SECTIONS);
      await fetchNextBox().catch(() => undefined);
    } catch (err: any) {
      setClosingError(err?.response?.data || { message: "Could not open today again" });
    } finally {
      setReopeningDay(false);
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
      {isSuperAdmin && (
        <section className="flex flex-col gap-3 rounded-2xl border border-iceblue-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><FiGitBranch /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Production view</p>
              <p className="font-semibold text-navy-900">{activeBranch ? `${activeBranch.name} (${activeBranch.code})` : "Overall — all branches"}</p>
              {!activeBranch && <p className="mt-0.5 text-xs text-navy-800/45">Combined production details are read-only. Select a branch to manage production.</p>}
            </div>
          </div>
          <select className="input-field h-10 sm:max-w-xs" aria-label="Change production branch" value={selectedBranch || ""} onChange={(event) => changeBranch(event.target.value)}>
            <option value="">Overall — all branches</option>
            {branches.filter((branch) => branch.isActive !== false).map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
          </select>
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-r from-navy-900 via-sky-900 to-iceblue-700 text-white shadow-lg shadow-iceblue-900/10">
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl ring-1 ring-white/15"><FiActivity /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100/80">Factory operations</p>
              <h1 className="mt-0.5 font-display text-xl font-bold sm:text-2xl">Production Control</h1>
              <p className="mt-1 text-sm text-iceblue-50/80">Production, shop stock, truck distribution, sales and daily closing in one view.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {dayClosed ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => currentClosing && setCloseTarget(currentClosing)} disabled={!canManageProduction || !currentClosing} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-400/15 px-3 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/30 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50">
                  <FiCheckCircle /> View Closed Report
                </button>
                <button type="button" onClick={() => void reopenDay()} disabled={!canManageProduction || !currentClosing || reopeningDay} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <FiRefreshCw className={reopeningDay ? "animate-spin" : ""} /> {reopeningDay ? "Opening..." : "Open Again Today"}
                </button>
              </div>
            ) : hasCurrentSessionProduction ? (
              <button
                type="button"
                onClick={() => openClosing && setCloseTarget(openClosing)}
                disabled={!canManageProduction || !openClosing || !readyToClose}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCheckCircle /> {onlineTrucks.length > 0 ? "Trucks Must Be Offline" : readyToClose ? "Close Today" : "Waiting for Checks"}
              </button>
            ) : null}
            {!dayClosed && hasCurrentSessionProduction && (
              <button
                type="button"
                onClick={openShopWastage}
                disabled={operationsLocked}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200/40 bg-red-500/90 px-4 text-xs font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 /> Add Shop Wastage
              </button>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={refreshing || loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/10 px-4 py-2 text-[11px] text-iceblue-50/70 sm:px-6">
          <span>Automatic truck status refresh runs once per minute while this page is visible.</span>
          <span>{lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Loading latest data..."}</span>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 font-medium">
            <FiAlertCircle className="shrink-0" /> {loadError}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="font-bold text-amber-900 underline underline-offset-4 disabled:opacity-50"
          >
            {refreshing ? "Retrying..." : "Try again"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-8">
        <ProductionSummary
          label={dayClosed ? "Production Bars" : "Produced Today"}
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
          value={fmtBars(dailyTotalSold)}
          icon={<FiCheckCircle />}
        />
        <ProductionSummary
          label="Shop Wastage"
          value={fmtBars(liveSummary.wasted)}
          icon={<FiAlertCircle />}
          danger={liveSummary.wasted > 0}
        />
        <ProductionSummary
          label="Stock"
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
        <ProductionSummary
          label="Closing Box"
          value={!canManageProduction || closingBoxNumber == null ? "-" : fmtBars(closingBoxNumber)}
          icon={<FiBox />}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy-900"><FiDollarSign className="text-emerald-600" /> Today Financial Check</h2>
            <p className="mt-1 text-sm text-navy-800/50">Matches the Sales and Expenses pages. Profit is collection minus expenses.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/sales" className="btn-secondary px-3 py-1.5 text-xs">Check Sales</Link>
            <Link href="/admin/expenses" className="btn-secondary px-3 py-1.5 text-xs">Check Expenses</Link>
            <Link href="/admin/reports" className="btn-secondary px-3 py-1.5 text-xs">Full Report</Link>
          </div>
        </div>
        {expenseLoadError && <p className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Expense check unavailable: {expenseLoadError}</p>}
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <FinancialMetric label="Sales Count" value={String(financialSummary.salesCount)} />
          <FinancialMetric label="Total Sales" value={formatCurrency(financialSummary.salesAmount)} />
          <FinancialMetric label="Collection" value={formatCurrency(financialSummary.collectionAmount)} positive />
          <FinancialMetric label="Pending" value={formatCurrency(financialSummary.pendingAmount)} danger={financialSummary.pendingAmount > 0} />
          <FinancialMetric label="Expenses" value={formatCurrency(financialSummary.expenses)} danger={financialSummary.expenses > 0} />
          <FinancialMetric label="Profit" value={formatCurrency(financialSummary.profit)} positive={financialSummary.profit >= 0} danger={financialSummary.profit < 0} />
        </div>
      </section>

      {isSuperAdmin && !selectedBranch && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <h2 className="font-display text-lg font-bold text-navy-900">All Branch Production Today</h2>
            <p className="mt-1 text-sm text-navy-800/50">Combined view of every active branch. Select a branch above to add, edit, assign bars, or close production.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-100 text-xs font-bold uppercase text-navy-900">
                <tr><th className="border border-slate-300 px-3 py-3 text-left">Branch</th><th className="border border-slate-300 px-3 py-3 text-right">Produced</th><th className="border border-slate-300 px-3 py-3 text-right">Sold</th><th className="border border-slate-300 px-3 py-3 text-right">Shop Ready</th><th className="border border-slate-300 px-3 py-3 text-right">Wastage</th><th className="border border-slate-300 px-3 py-3 text-right">Expenses</th><th className="border border-slate-300 px-3 py-3 text-right">Profit</th><th className="border border-slate-300 px-3 py-3 text-center">Closing Box</th><th className="border border-slate-300 px-3 py-3 text-center">Status</th></tr>
              </thead>
              <tbody>
                {overallBranchRows.map((branch) => (
                  <tr key={branch._id} className="hover:bg-iceblue-50/50">
                    <td className="border border-slate-300 px-3 py-3"><p className="font-bold text-navy-900">{branch.name}</p><p className="text-xs text-navy-800/45">{branch.code}</p></td>
                    <td className="border border-slate-300 px-3 py-3 text-right font-bold">{fmtBars(branch.produced)}</td>
                    <td className="border border-slate-300 px-3 py-3 text-right font-bold text-emerald-700">{fmtBars(branch.sold)}</td>
                    <td className="border border-slate-300 px-3 py-3 text-right font-bold text-blue-700">{fmtBars(branch.ready)}</td>
                    <td className="border border-slate-300 px-3 py-3 text-right font-bold text-red-600">{fmtBars(branch.wasted)}</td>
                    <td className="border border-slate-300 px-3 py-3 text-right font-bold text-red-600">{formatCurrency(branch.expenses)}</td>
                    <td className={`border border-slate-300 px-3 py-3 text-right font-bold ${branch.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatCurrency(branch.profit)}</td>
                    <td className="border border-slate-300 px-3 py-3 text-center font-semibold">{branch.closingBox == null ? "-" : fmtBars(Number(branch.closingBox))}</td>
                    <td className="border border-slate-300 px-3 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${branch.status === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{branch.status === "closed" ? "Closed" : "Open"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canManageProduction && todaysShopWastage.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-red-100 bg-red-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display text-sm font-bold text-navy-900"><FiTrash2 className="text-red-500" /> Today&apos;s Shop Wastage</h2>
              <p className="mt-0.5 text-xs text-navy-800/50">Main Shop entries only. Truck wastage is maintained separately by each truck.</p>
            </div>
            <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-100">
              {fmtBars(summary.wasted)} bars total
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] table-fixed border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-100 text-navy-900">
                <tr>
                  <th className="w-[8%] border border-slate-300 px-2 py-2.5 text-center text-[10px] font-bold uppercase">S.No</th>
                  <th className="w-[18%] border border-slate-300 px-3 py-2.5 text-left text-[10px] font-bold uppercase">Location</th>
                  <th className="w-[17%] border border-slate-300 px-3 py-2.5 text-left text-[10px] font-bold uppercase">Reason</th>
                  <th className="w-[30%] border border-slate-300 px-3 py-2.5 text-left text-[10px] font-bold uppercase">Notes</th>
                  <th className="w-[15%] border border-slate-300 px-3 py-2.5 text-right text-[10px] font-bold uppercase">Bars</th>
                  <th className="w-[16%] border border-slate-300 px-3 py-2.5 text-center text-[10px] font-bold uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {todaysShopWastage.map((entry, index) => (
                  <tr key={entry._id} className="even:bg-slate-50 hover:bg-red-50/40">
                    <td className="border border-slate-300 px-2 py-2.5 text-center text-navy-800/60">{index + 1}</td>
                    <td className="border border-slate-300 px-3 py-2.5 font-semibold text-navy-900">Main Shop</td>
                    <td className="border border-slate-300 px-3 py-2.5 capitalize text-navy-900">{String(entry.reason || "Other").replaceAll("_", " ")}</td>
                    <td className="truncate border border-slate-300 px-3 py-2.5 text-navy-800/60" title={entry.notes || ""}>{entry.notes || "—"}</td>
                    <td className="border border-slate-300 px-3 py-2.5 text-right font-bold tabular-nums text-red-600">{fmtBars(Number(entry.quantity || 0))}</td>
                    <td className="border border-slate-300 px-3 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => openShopWastageEdit(entry)}
                        disabled={operationsLocked}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-iceblue-100 bg-white px-2.5 py-1.5 text-xs font-bold text-iceblue-700 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FiEdit2 /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget({
                            kind: "wastage",
                            id: entry._id,
                            label: `${fmtBars(Number(entry.quantity || 0))}-bar Main Shop wastage`,
                          });
                        }}
                        disabled={operationsLocked}
                        title="Delete shop wastage"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FiTrash2 />
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {false && <section className="hidden" aria-hidden="true">
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
      </section>}

      {canManageProduction && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">
              Today&apos;s bar distribution and truck closing
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!dayClosed && (
              <span className="pill shrink-0 bg-amber-50 text-amber-700">
                {validDriverClosings.filter((row) => row.checked).length}/{validDriverClosings.length} assigned trucks checked
              </span>
            )}
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

        {!dayClosed && pendingTruckChecks.length > 0 && (
          <div
            role="status"
            className="mx-5 mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:mx-6"
          >
            <FiAlertCircle className="mt-0.5 shrink-0 text-xl" />
            <div>
              <p className="font-bold">
                {pendingTruckChecks.length} truck
                {pendingTruckChecks.length === 1 ? "" : "s"} requested return approval
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-800/80">
                Verify the returned ice bars below and click Accept. The driver
                will remain Online and cannot logout until the return is accepted.
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
          <div className="col-span-3 flex items-center justify-between border-b border-emerald-200 bg-emerald-100/70 px-4 py-3 sm:col-span-1 sm:border-b-0 sm:border-r">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">
                Shop Distribution
              </p>
              <p className="mt-1 text-sm font-bold text-navy-900">Main Shop</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 font-black text-white shadow-sm">
              S
            </span>
          </div>
          <div className="border-r border-emerald-200 px-3 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-navy-800/45">Total Bar</p>
            <p className="mt-1 font-display text-lg font-bold text-navy-900">
              {fmtBars(Number(liveSummary.shopTotal || 0))}
            </p>
          </div>
          <div className="border-r border-emerald-200 px-3 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-navy-800/45">Sold</p>
            <p className="mt-1 font-display text-lg font-bold text-emerald-600">
              {fmtBars(Number(liveShopSold || 0))}
            </p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-navy-800/45">Balance</p>
            <p className="mt-1 font-display text-lg font-bold text-emerald-700">
              {fmtBars(Number(liveSummary.finalTotal || 0))}
            </p>
          </div>
        </div>

        {/* Reconciliation is the single source for truck distribution and closing. */}
        {validDriverClosings.length > 0 && (
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
                  Wastage
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
              {validDriverClosings.map((row, index) => {
                const remaining = Number(row.remaining || 0);
                const visibleBalance = Math.max(0, remaining);
                const truckPresence = trucks.find((truck) => truck._id === row.truckId);
                const returnApprovalPending = Boolean(row.driverClosed && !row.checked);
                const mustRemainOnline = remaining > 0.0001 || returnApprovalPending;
                const driverOnline = mustRemainOnline || Boolean(
                  truckPresence?.isOnline ?? truckPresence?.driverOnline ?? truckPresence?.online ??
                  row.isOnline ?? row.driverOnline ?? row.online ??
                  row.truck?.isOnline ?? row.truck?.driverOnline ?? row.truck?.online ?? false
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
                        {row.truck?.truckName || truckPresence?.truckName || "Truck"}
                      </p>
                      <p className="text-xs text-navy-800/50">
                        {row.truck?.driverName || "Driver"}
                        {(row.truck?.truckNumber || truckPresence?.truckNumber)
                          ? ` · ${row.truck?.truckNumber || truckPresence?.truckNumber}`
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
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-bold text-red-600">
                      {fmtBars(Number(row.wastage || 0))}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center font-black text-navy-900">
                      {fmtBars(visibleBalance)}
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
                        <p className={`mt-1 text-[10px] ${remaining < 0 ? "font-semibold text-red-700" : "text-amber-700"}`}>
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

            </tbody>

            {validDriverClosings.length > 0 && (
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
                      validDriverClosings.reduce(
                        (sum, r) => sum + Number(r.taken || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                    {fmtBars(
                      validDriverClosings.reduce(
                        (sum, r) => sum + Number(r.sold || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                    {fmtBars(
                      validDriverClosings.reduce(
                        (sum, r) => sum + Number(r.returned || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center text-red-600">
                    {fmtBars(
                      validDriverClosings.reduce(
                        (sum, r) => sum + Number(r.wastage || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-slate-200 px-4 py-3 text-center">
                    {fmtBars(
                      validDriverClosings.reduce(
                        (sum, r) => sum + Math.max(0, Number(r.remaining || 0)),
                        0,
                      ),
                    )}
                  </td>
                  <td
                    colSpan={2}
                    className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-500"
                  >
                    {validDriverClosings.filter((r) => r.checked).length}/
                    {validDriverClosings.length} checked
                  </td>
                </tr>
              </tfoot>
            )}
            </table>
          </div>
        )}

      </section>}

      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">
              Today&apos;s Sold Production
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
          ) : soldProductionBatchRows.length ? (
            <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr className="text-navy-900">
                  <th className="w-[5%] border-b border-r border-slate-300 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide">
                    #
                  </th>

                  <th className="w-[18%] border-b border-r border-slate-300 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide">
                    Date
                  </th>

                  {isSuperAdmin && !selectedBranch && (
                    <th className="border-b border-r border-slate-300 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide">
                      Branch
                    </th>
                  )}

                  <th className="w-[11%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Open
                  </th>

                  <th className="w-[11%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Close
                  </th>

                  <th className="w-[15%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Made Bars
                  </th>

                  <th className="w-[13%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Stocks
                  </th>

                  <th className="w-[18%] border-b border-r border-slate-300 px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide">
                    Sold Bars
                  </th>

                  <th className="w-[12%] border-b border-slate-300 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {soldProductionBatchRows.map((r, index) => {
                  const totalBars = Number(r.totalBars || 0);

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

                      {isSuperAdmin && !selectedBranch && (
                        <td className="border-b border-r border-slate-200 px-2 py-2.5 text-left text-xs font-semibold text-navy-900">
                          {r.branch?.name || branches.find((branch) => branch._id === r.branchId)?.name || "Branch"}
                        </td>
                      )}

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
                        <span className="text-slate-400">—</span>
                      </td>

                      {/* Selling Bars */}
                      <td className="border-b border-r border-slate-200 px-2 py-2.5 text-right">
                        <span className="font-bold tabular-nums text-navy-900">
                          {fmtBars(Number(r.soldBars || 0))}
                        </span>
                      </td>

                      {/* Edit / Delete batch */}
                      <td className="border-b border-slate-200 px-2 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Edit production batch"
                            onClick={() => void openEdit(r)}
                            disabled={operationsLocked}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-iceblue-600 transition hover:bg-iceblue-50 hover:text-iceblue-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FiEdit2 className="text-sm" />
                          </button>
                          <button
                            type="button"
                            title="Delete production batch"
                            onClick={() => {
                              setDeleteError("");
                              setDeleteTarget({
                                kind: "production",
                                id: r._id,
                                label: `production batch for ${formatDate(r.date)}`,
                              });
                            }}
                            disabled={operationsLocked}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FiTrash2 className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-navy-900">
                  <td colSpan={isSuperAdmin && !selectedBranch ? 5 : 4} className="border-r border-t border-slate-300 px-3 py-3 text-right text-xs uppercase tracking-wide">Daily Total ({soldProductionBatchRows.length} sold batch{soldProductionBatchRows.length === 1 ? "" : "es"})</td>
                  <td className="border-r border-t border-slate-300 px-2 py-3 text-right">{fmtBars(soldProductionBatchRows.reduce((sum, record) => sum + Number(record.totalBars || 0), 0))}</td>
                  <td className="border-r border-t border-slate-300 px-2 py-3 text-right">{fmtBars(Number(dayClosed ? dailyReturnedBars : stockByDate[activeDay] || 0))}</td>
                  <td className="border-r border-t border-slate-300 px-2 py-3 text-right text-emerald-700">{fmtBars(soldProductionBatchRows.reduce((sum, record) => sum + Number(record.soldBars || 0), 0))}</td>
                  <td className="border-t border-slate-300" />
                </tr>
              </tfoot>
            </table>
          ) : (
            <EmptyState
              title="No production recorded"
              description="No production batch has recorded a sale yet. Unsold production is returned and is not shown as a sold record."
            />
          )}
        </div>
      </section>

      {canManageProduction && <section className="card">
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
      </section>}

      {canManageProduction && <section className="card">
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
      </section>}

      {canManageProduction && <div ref={quickAddRef} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 sm:bottom-7 sm:right-7">
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
              <FiBox className="text-iceblue-700" />{" "}
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
                void openModal();
              }}
              disabled={operationsLocked}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiPlus className="text-iceblue-600" /> Add Production Batch
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={openTruckBars}
              disabled={operationsLocked || trucks.length === 0}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-navy-900 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiTruck className="text-iceblue-600" /> Assign Truck
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
          disabled={loading}
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
      </div>}

      {wastageModalOpen && (
        <Modal title={wastageEditing ? "Edit Shop Wastage" : "Add Shop Wastage"} onClose={() => {
          if (savingWastage) return;
          setWastageModalOpen(false);
          setWastageEditing(null);
        }}>
          <form onSubmit={saveShopWastage} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-800">
              <FiAlertCircle className="mt-0.5 shrink-0 text-lg" />
              <div>
                <p className="font-semibold">Main Shop Wastage</p>
                <p className="mt-0.5 text-xs leading-5 text-red-700/80">
                  {wastageEditing
                    ? "Update this Main Shop entry. The Shop Ready balance will be recalculated automatically."
                    : "This entry is recorded for the shop, not for a truck, and will reduce today's Shop Ready balance."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-text">Date</label>
                <input type="date" className="input-field h-12 bg-slate-50" value={activeDay} disabled />
              </div>
              <div>
                <label className="label-text">Available for This Entry</label>
                <div className="flex h-12 items-center rounded-xl border border-iceblue-100 bg-iceblue-50 px-3 font-display text-lg font-bold text-navy-900">
                  {fmtBars(Math.max(0, Number(summary.finalTotal || 0) + Number(wastageEditing?.quantity || 0)))} bars
                </div>
              </div>
            </div>

            <div>
              <label className="label-text">Wastage Bar Quantity</label>
              <input
                type="number"
                min={0.25}
                max={Math.max(0, Number(summary.finalTotal || 0) + Number(wastageEditing?.quantity || 0)) || undefined}
                step={0.25}
                inputMode="decimal"
                required
                className="input-field h-12"
                placeholder="Example: 0.25 or 1.50"
                value={wastageQuantity}
                onChange={(event) => setWastageQuantity(event.target.value)}
              />
              <p className="mt-1 text-xs text-navy-800/50">Use quarter-bar increments: 0.25, 0.50, 0.75, 1.00...</p>
            </div>

            <div>
              <label className="label-text">Reason</label>
              <select className="input-field h-12" value={wastageReason} onChange={(event) => setWastageReason(event.target.value)}>
                {WASTAGE_REASONS.filter((reason) => reason.value !== "unsold").map((reason) => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text">Notes</label>
              <textarea
                className="input-field"
                rows={3}
                maxLength={500}
                placeholder="Explain the shop wastage if needed"
                value={wastageNotes}
                onChange={(event) => setWastageNotes(event.target.value)}
              />
            </div>

            {wastageError && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{wastageError}</p>
            )}

            <button type="submit" className="btn-primary flex h-12 w-full items-center justify-center gap-2" disabled={savingWastage || Number(summary.finalTotal || 0) + Number(wastageEditing?.quantity || 0) <= 0}>
              {wastageEditing ? <FiEdit2 /> : <FiTrash2 />}
              {savingWastage ? "Saving Shop Wastage..." : wastageEditing ? "Update Shop Wastage" : "Save Shop Wastage"}
            </button>
          </form>
        </Modal>
      )}

      {closeTarget && (
        <Modal
          title={closeTarget.status === "closed" ? "Today's Closed Report" : "Final Check & Close Today"}
          onClose={() => setCloseTarget(null)}
          wide
        >
          <div className="space-y-5">
            <div className={`flex items-start gap-3 rounded-2xl border p-4 ${closeTarget.status === "closed" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {closeTarget.status === "closed" ? <FiCheckCircle className="mt-0.5 shrink-0 text-xl" /> : <FiAlertCircle className="mt-0.5 shrink-0 text-xl" />}
              <div>
                <p className="font-semibold">{closeTarget.status === "closed" ? "Today is closed. All final figures remain available below." : "Confirm every bar and financial total before closing."}</p>
                <p className="mt-1 text-sm leading-6">
                  Closing moves remaining ready bars into Stock. When the next production starts, that stock is added to Production and Stock returns to zero.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-iceblue-100 bg-white p-3 sm:p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-iceblue-700">Bar Summary</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <CloseReviewMetric label="Made Bars" value={reportMadeBars} />
                <CloseReviewMetric label="Production Bars" value={reportProductionBars} />
                <CloseReviewMetric label="Shop Sold" value={reportShopSold} />
                <CloseReviewMetric label="Truck Sold" value={reportTruckSold} />
                <CloseReviewMetric label="Total Sold" value={reportTotalSold} />
                <CloseReviewMetric label="Shop Wastage" value={dayClosed ? Number(currentClosing?.wastage || 0) : summary.wasted} />
                <CloseReviewMetric label="Stock" value={stockAtClosingBars} />
                <CloseReviewMetric label="Closing Box" value={Number(closingBoxNumber || 0)} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Financial Summary</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <FinancialMetric label="Sales Count" value={String(financialSummary.salesCount)} />
                <FinancialMetric label="Total Sales" value={formatCurrency(financialSummary.salesAmount)} />
                <FinancialMetric label="Collection" value={formatCurrency(financialSummary.collectionAmount)} positive />
                <FinancialMetric label="Pending" value={formatCurrency(financialSummary.pendingAmount)} danger={financialSummary.pendingAmount > 0} />
                <FinancialMetric label="Expenses" value={formatCurrency(financialSummary.expenses)} danger={financialSummary.expenses > 0} />
                <FinancialMetric label="Profit" value={formatCurrency(financialSummary.profit)} positive={financialSummary.profit >= 0} danger={financialSummary.profit < 0} />
              </div>
            </div>
            {closingError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {closingMessage}
              </p>
            )}
            {closeTarget.status === "closed" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setCloseTarget(null)} className="btn-secondary">Close Report</button>
                <button type="button" onClick={() => void reopenDay()} disabled={reopeningDay} className="btn-primary">{reopeningDay ? "Opening..." : "Open Again Today"}</button>
              </div>
            ) : <div className="grid grid-cols-2 gap-3">
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
            </div>}
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
                    {truck.truckName} ({truck.truckNumber}) - {Boolean(truck.isOnline ?? truck.driverOnline ?? truck.online) ? "Online" : "Offline"}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-navy-800/50">Offline trucks receive this assignment when the driver next logs in.</p>
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
                  {Number(truckAssignmentDetails[selectedTruck]?.pendingQuantity || 0) > 0 && (
                    <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3 text-amber-800">
                      <p className="font-semibold">Waiting for driver acceptance</p>
                      <p className="mt-1 text-sm">Pending: {fmtBars(Number(truckAssignmentDetails[selectedTruck]?.pendingQuantity || 0))} bars</p>
                      <button
                        type="button"
                        onClick={() => void cancelTruckBarRequest()}
                        disabled={cancellingTruckBars}
                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <FiTrash2 /> {cancellingTruckBars ? "Cancelling..." : "Cancel Request"}
                      </button>
                    </div>
                  )}
                  {truckAssignmentDetails[selectedTruck]?.status === "accepted" && (
                    <p className="mt-2 font-semibold text-emerald-700">Accepted — ready for sales</p>
                  )}
                  {truckAssignmentDetails[selectedTruck]?.status === "rejected" && (
                    <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      <p className="font-semibold">Cancelled assignment</p>
                      <p className="mt-1">Reason: {truckAssignmentDetails[selectedTruck]?.responseReason || "No reason provided"}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label-text">Add Bar Quantity</label>
                  <p className="mb-2 text-xs text-navy-800/50">
                    The driver must Accept before these bars become available
                    for sales. Cancelling requires a reason.
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
                      {savingTruckBars ? "Sending..." : "Assign"}
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
                {openingStockForEntry > 0 && (
                  <p className="mt-1 font-semibold text-iceblue-800">
                    Production after adding {fmtBars(openingStockForEntry)} stock bars: {fmtBars(preview.barsProduced + openingStockForEntry)}
                  </p>
                )}
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

function FinancialMetric({
  label,
  value,
  danger = false,
  positive = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={`flex min-h-[86px] min-w-0 flex-col justify-between rounded-xl border p-3 ${danger ? "border-red-100 bg-red-50" : positive ? "border-emerald-100 bg-emerald-50" : "border-iceblue-100 bg-white"}`}>
      <p className={`min-h-[2rem] text-[10px] font-bold uppercase leading-4 tracking-wide ${danger ? "text-red-700/65" : positive ? "text-emerald-700/65" : "text-navy-800/45"}`}>{label}</p>
      <p className={`mt-1 break-words font-display text-lg font-bold tabular-nums ${danger ? "text-red-700" : positive ? "text-emerald-700" : "text-navy-900"}`}>{value}</p>
    </div>
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
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 ${compact ? "py-3" : "p-6"}`}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-iceblue-600" />
      <span className="text-sm font-semibold text-slate-500">Loading...</span>
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
      className={`flex min-h-[86px] min-w-0 flex-col justify-between rounded-xl border p-3 ${danger ? "border-red-100 bg-red-50" : "border-iceblue-100 bg-iceblue-50/60"}`}
    >
      <p className="min-h-[2rem] text-[10px] font-bold uppercase leading-4 tracking-wide text-navy-800/45">
        {label}
      </p>
      <p
        className={`mt-1 break-words font-display text-xl font-bold tabular-nums ${danger ? "text-red-600" : "text-navy-900"}`}
      >
        {fmtBars(Number(value || 0))}
      </p>
    </div>
  );
}
