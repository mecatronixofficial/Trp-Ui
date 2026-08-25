"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiCoffee,
  FiDollarSign,
  FiEdit3,
  FiGitBranch,
  FiGrid,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip } from "recharts";
import Modal from "../../../components/Modal";
import api, { COST_TYPES, formatCurrency, formatDate } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { selectedBranchHeaders } from "../../../lib/branch-fetch";

type Branch = { _id: string; name: string; code: string; isActive?: boolean };

type ExpenseRecord = {
  _id: string;
  date: string;
  costType: string;
  amount: number;
  notes?: string;
  worker?: string;
  workerName?: string;
  branch?: string;
  branchName?: string;
  truck?: string;
  truckName?: string;
  fuelQuantity?: number;
  createdAt?: string;
};

type ExpenseForm = {
  date: string;
  costType: string;
  amount: string;
  notes: string;
  customCategory: string;
  worker: string;
  truck: string;
  fuelQuantity: string;
};

async function readExpenseResponse(response: Response) {
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json") || body.trim().startsWith("<")) {
    throw new Error("The expense service is unavailable. Please refresh the page or restart the application server.");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("The expense service returned an invalid response. Please try again.");
  }
}

const indiaDateKey = (date: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));

const todayIndiaISO = () => indiaDateKey(new Date());
const CATEGORY_NOTE_PREFIX = "[[expense-category:";
const CATEGORY_NOTE_SUFFIX = "]]";
const CHART_COLORS = ["#2563eb", "#0ea5e9", "#22c55e", "#a855f7", "#f59e0b", "#14b8a6", "#ef4444", "#64748b"];

const createForm = (): ExpenseForm => ({
  date: todayIndiaISO(),
  costType: "",
  amount: "",
  notes: "",
  customCategory: "",
  worker: "",
  truck: "",
  fuelQuantity: "",
});

const expenseLabel = (value: string) =>
  COST_TYPES.find((item) => item.value === value)?.label ||
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeCategory = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const displayCategoryName = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "Other Expenses";

  const normalized = normalizeCategory(raw);
  const aliases: Record<string, string> = {
    food: "Food",
    food_expenses: "Food",
    snacks: "Food",
    snack: "Food",
    snacks_expenses: "Food",
    advance_for_employee: "Worker Amount",
    advance_for_emp: "Worker Amount",
    advance_employee: "Worker Amount",
    advance: "Worker Amount",
    employee_advance: "Worker Amount",
    other_expenses: "Other Expenses",
    other_expense: "Other Expenses",
    other: "Other Expenses",
    chat_expenses: "Other Expenses",
    chat_expense: "Other Expenses",
    chat: "Other Expenses",
    communication: "Other Expenses",
    petrol_diesel: "Petrol / Diesel",
    petrol: "Petrol / Diesel",
    diesel: "Petrol / Diesel",
  };

  if (aliases[normalized]) return aliases[normalized];

  const fromCostType = COST_TYPES.find(
    (item) =>
      normalizeCategory(item.value) === normalized ||
      normalizeCategory(item.label) === normalized,
  )?.label;
  if (fromCostType) return fromCostType;

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const apiCostType = (category: string) => {
  const normalized = normalizeCategory(category);
  if (["food", "food_expenses", "snacks", "snack", "snacks_expenses"].includes(normalized))
    return "snacks";
  if (["petrol_diesel", "petrol", "diesel"].includes(normalized))
    return "petrol_diesel";
  if (
    [
      "advance_for_employee",
      "advance_for_emp",
      "advance_employee",
      "advance",
      "employee_advance",
    ].includes(normalized)
  )
    return "advance_for_employee";
  if (
    [
      "other_expenses",
      "other_expense",
      "other",
      "chat_expenses",
      "chat_expense",
      "chat",
      "communication",
    ].includes(normalized)
  )
    return "other_expenses";
  return (
    COST_TYPES.find(
      (item) =>
        normalizeCategory(item.value) === normalized ||
        normalizeCategory(item.label) === normalized,
    )?.value || "other"
  );
};

const storedCustomCategory = (notes = "") => {
  const firstLine = notes.split("\n")[0] || "";
  if (
    !firstLine.startsWith(CATEGORY_NOTE_PREFIX) ||
    !firstLine.endsWith(CATEGORY_NOTE_SUFFIX)
  )
    return "";
  const encoded = firstLine.slice(
    CATEGORY_NOTE_PREFIX.length,
    -CATEGORY_NOTE_SUFFIX.length,
  );
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "";
  }
};

const recordCategory = (record: ExpenseRecord) =>
  storedCustomCategory(record.notes) || expenseLabel(record.costType);

const recordNotes = (record: ExpenseRecord) => {
  if (!storedCustomCategory(record.notes)) return record.notes || "";
  return (record.notes || "").split("\n").slice(1).join("\n").trim();
};

const notesForApi = (category: string, costType: string, notes: string) => {
  const isCustom =
    costType === "other" && normalizeCategory(category) !== "other";
  if (!isCustom) return notes.trim();
  const marker = `${CATEGORY_NOTE_PREFIX}${encodeURIComponent(category.trim())}${CATEGORY_NOTE_SUFFIX}`;
  return notes.trim() ? `${marker}\n${notes.trim()}` : marker;
};

const presetCategoryValue = (category: string) => {
  const normalized = normalizeCategory(category);
  if (["food", "food_expenses", "snacks", "snack", "snacks_expenses"].includes(normalized)) return "food";
  if (["petrol_diesel", "petrol", "diesel"].includes(normalized))
    return "petrol_diesel";
  if (
    ["advance_for_employee", "advance_for_emp", "advance_employee"].includes(
      normalized,
    )
  )
    return "advance_for_employee";
  if (
    ["chat_expenses", "chat_expense", "chat", "communication"].includes(
      normalized,
    )
  )
    return "other_expenses";
  if (["other_expenses", "other_expense"].includes(normalized))
    return "other_expenses";
  return "custom";
};

export default function ExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(createForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editingRecord, setEditingRecord] = useState<ExpenseRecord | null>(
    null,
  );
  const [workers, setWorkers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const isSuperAdmin = user?.role === "super_admin";
  const canManageExpenses = Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);

  const today = todayIndiaISO();
  const initialMonth = today.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterMode, setFilterMode] = useState<"today" | "month" | "date">(
    "today",
  );
  const [search, setSearch] = useState("");

  const load = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setLoadError("");
      try {
        const params = new URLSearchParams();
        if (filterMode === "today") {
          params.set("today", "true");
        } else if (filterMode === "date") {
          params.set("date", selectedDate);
        } else {
          const [year, month] = selectedMonth.split("-");
          if (year && month) {
            params.set("month", String(Number(month)));
            params.set("year", year);
          }
        }
        const response = await fetch(`/api/expenses?${params.toString()}`, { cache: "no-store", headers: selectedBranchHeaders() });
        const payload = await readExpenseResponse(response);
        if (!response.ok)
          throw new Error(payload?.message || "Could not load expenses");
        setRecords(Array.isArray(payload.records) ? payload.records : []);
      } catch (error: any) {
        setLoadError(error?.message || "Could not load expenses");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filterMode, selectedMonth, selectedDate],
  );

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    void load(true);
  }, [authLoading, load, selectedBranch]);

  useEffect(() => {
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem("tii_selected_branch") || "";
    setSelectedBranch(isSuperAdmin ? storedBranch : String(user?.branch || ""));
    if (isSuperAdmin) api.get("/branches")
      .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]));
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null || !canManageExpenses) {
      setWorkers([]);
      setTrucks([]);
      return;
    }
    api.get("/workers")
      .then(({ data }) => setWorkers((Array.isArray(data) ? data : []).filter((worker: any) => worker.isActive !== false)))
      .catch(() => setWorkers([]));
    api.get("/trucks")
      .then(({ data }) => setTrucks((Array.isArray(data) ? data : []).filter((truck: any) => truck.status !== false)))
      .catch(() => setTrucks([]));
  }, [authLoading, canManageExpenses, selectedBranch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem("tii_selected_branch", branch);
    else window.localStorage.removeItem("tii_selected_branch");
    window.location.reload();
  };

  const monthRecords = useMemo(() => {
    if (filterMode === "today") {
      return records.filter((record) => indiaDateKey(record.date) === today);
    }
    if (filterMode === "date") {
      return records.filter(
        (record) => indiaDateKey(record.date) === selectedDate,
      );
    }
    if (selectedMonth === "all") return records;
    return records.filter((record) =>
      indiaDateKey(record.date).startsWith(selectedMonth),
    );
  }, [records, selectedMonth, selectedDate, filterMode, today]);

  const filteredRecords = useMemo(
    () =>
      [...monthRecords].sort((a, b) => {
        const dateOrder = String(b.date).localeCompare(String(a.date));
        if (dateOrder !== 0) return dateOrder;
        return String(b.createdAt || b._id).localeCompare(
          String(a.createdAt || a._id),
        );
      }),
    [monthRecords],
  );

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return filteredRecords;
    return filteredRecords.filter((record) =>
      [displayCategoryName(recordCategory(record)), record.workerName, record.truckName, recordNotes(record)]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [filteredRecords, search]);

  const categoryTotals = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const record of filteredRecords) {
      const recordType = displayCategoryName(recordCategory(record));
      grouped[recordType] =
        (grouped[recordType] || 0) + Number(record.amount || 0);
    }
    return Object.entries(grouped)
      .map(([key, amount]) => ({ key, label: key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredRecords]);

  const totalSpending = useMemo(
    () => monthRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0),
    [monthRecords],
  );
  const chartData = useMemo(
    () =>
      categoryTotals.map((item, index) => ({
        ...item,
        percent: totalSpending > 0 ? (item.amount / totalSpending) * 100 : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [categoryTotals, totalSpending],
  );

  const ChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-lg">
        <p className="font-semibold text-slate-900">{item.label}</p>
        <p className="mt-2">{formatCurrency(item.amount)}</p>
        <p className="text-xs text-slate-500">{item.percent.toFixed(1)}%</p>
      </div>
    );
  };

  const monthLabel = selectedMonth
    ? new Date(`${selectedMonth}-01T12:00:00+05:30`).toLocaleDateString(
        "en-IN",
        { month: "long", year: "numeric" },
      )
    : "Month";
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00+05:30`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const todayLabel = new Date(`${today}T12:00:00+05:30`).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "long", year: "numeric" },
  );
  const selectedPeriodLabel =
    filterMode === "today"
      ? `Today (${todayLabel})`
      : filterMode === "date"
        ? selectedDateLabel
        : monthLabel;
  const overallView = Boolean(isSuperAdmin && !selectedBranch);
  const scopeName = overallView ? "All branches" : activeBranch?.name || "Assigned branch";
  const isSnackRecord = (record: ExpenseRecord) => {
    const label = displayCategoryName(recordCategory(record));
    const normalized = normalizeCategory(label);
    return (
      normalized === "food" ||
      normalized === "food_expenses" ||
      normalized === "snacks" ||
      normalized === "snacks_expenses" ||
      ["food", "food_expenses", "snacks", "snacks_expenses"].includes(normalizeCategory(record.costType))
    );
  };
  const snacksAmount = monthRecords.reduce(
    (sum, record) =>
      sum + (isSnackRecord(record) ? Number(record.amount || 0) : 0),
    0,
  );
  const petrolDieselAmount = monthRecords.reduce(
    (sum, record) =>
      sum +
      (displayCategoryName(recordCategory(record)) === "Petrol / Diesel"
        ? Number(record.amount || 0)
        : 0),
    0,
  );
  const advanceAmount = monthRecords.reduce(
    (sum, record) =>
      sum +
      (displayCategoryName(recordCategory(record)) === "Worker Amount"
        ? Number(record.amount || 0)
        : 0),
    0,
  );
  const otherExpensesAmount = monthRecords.reduce(
    (sum, record) =>
      sum +
      (displayCategoryName(recordCategory(record)) === "Other Expenses"
        ? Number(record.amount || 0)
        : 0),
    0,
  );

  const openAddExpense = () => {
    if (!canManageExpenses) return;
    setEditingRecord(null);
    setForm(createForm());
    setFormError("");
    setModalOpen(true);
  };

  const openEditExpense = (record: ExpenseRecord) => {
    if (!canManageExpenses) return;
    const categoryText = recordCategory(record);
    const preset = presetCategoryValue(categoryText);
    setEditingRecord(record);
    setForm({
      date: indiaDateKey(record.date),
      costType: preset === "custom" ? "custom" : preset,
      amount: String(record.amount || ""),
      notes: recordNotes(record),
      customCategory: preset === "custom" ? categoryText : "",
      worker: record.worker || "",
      truck: record.truck || "",
      fuelQuantity: record.fuelQuantity ? String(record.fuelQuantity) : "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageExpenses) return;
    const typedCategory =
      form.costType === "custom"
        ? form.customCategory.trim()
        : form.costType.trim();
    if (!typedCategory) {
      setFormError("Select or type an expense category");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter an amount greater than zero");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const costType = apiCostType(typedCategory);
      const needsWorker = costType === "advance_for_employee";
      const needsTruck = costType === "petrol_diesel";
      const selectedWorker = workers.find((worker) => worker._id === form.worker);
      const selectedTruck = trucks.find((truck) => truck._id === form.truck);
      if (needsWorker && !selectedWorker) {
        setFormError("Select a registered worker");
        setSaving(false);
        return;
      }
      const fuelQuantity = Number(form.fuelQuantity);
      if (needsTruck && !selectedTruck) {
        setFormError("Select the truck that used this fuel");
        setSaving(false);
        return;
      }
      if (needsTruck && (!Number.isFinite(fuelQuantity) || fuelQuantity <= 0)) {
        setFormError("Enter fuel consumed in litres");
        setSaving(false);
        return;
      }
      const payload = {
        date: form.date,
        costType,
        amount,
        notes: notesForApi(typedCategory, costType, form.notes),
        worker: needsWorker ? selectedWorker._id : "",
        workerName: needsWorker ? selectedWorker.name : "",
        truck: needsTruck ? selectedTruck._id : "",
        truckName: needsTruck ? `${selectedTruck.truckName}${selectedTruck.truckNumber ? ` (${selectedTruck.truckNumber})` : ""}` : "",
        fuelQuantity: needsTruck ? fuelQuantity : 0,
        branch: selectedBranch || "",
        branchName: activeBranch ? `${activeBranch.name} (${activeBranch.code})` : "",
      };
      if (editingRecord) {
        const response = await fetch(`/api/expenses?id=${editingRecord._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...selectedBranchHeaders() },
          body: JSON.stringify(payload),
        });
        const result = await readExpenseResponse(response);
        if (!response.ok)
          throw new Error(result?.message || "Could not save expense");
      } else {
        const response = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...selectedBranchHeaders() },
          body: JSON.stringify(payload),
        });
        const result = await readExpenseResponse(response);
        if (!response.ok)
          throw new Error(result?.message || "Could not save expense");
      }
      setModalOpen(false);
      setForm(createForm());
      setEditingRecord(null);
      await load();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || error?.message || "Could not save expense");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!canManageExpenses) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/expenses?id=${deleteTarget._id}`, {
        method: "DELETE",
        headers: selectedBranchHeaders(),
      });
      const result = await readExpenseResponse(response);
      if (!response.ok)
        throw new Error(result?.message || "Could not delete expense");
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      setDeleteError(
        error?.response?.data?.message || "Could not delete expense",
      );
    } finally {
      setDeleting(false);
    }
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
              {isSuperAdmin ? "Super admin expense centre" : "Branch expense workspace"}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Expense management</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overallView
                ? `Review consolidated business spending and category patterns across ${branches.length} branches.`
                : `Record, review, and control operational spending for ${scopeName}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{scopeName}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiCalendar className="text-emerald-300" />{selectedPeriodLabel}</span>
            <button type="button" onClick={() => void load()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50 disabled:opacity-60"><FiRefreshCw className={refreshing ? "animate-spin" : ""} />Refresh</button>
            {canManageExpenses && <button type="button" onClick={openAddExpense} className="inline-flex items-center gap-2 rounded-xl bg-iceblue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-iceblue-400"><FiPlus />Add expense</button>}
          </div>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => changeBranch("")} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${overallView ? "bg-navy-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-navy-900"}`}><FiGrid />All branches<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${overallView ? "bg-white/10" : "bg-slate-100"}`}>{branches.length}</span></button>
            <span className="h-6 w-px shrink-0 bg-slate-200" />
            {branches.filter((branch) => branch.isActive !== false).map((branch) => (
              <button key={branch._id} type="button" onClick={() => changeBranch(branch._id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${selectedBranch === branch._id ? "bg-iceblue-50 text-iceblue-700 ring-1 ring-inset ring-iceblue-100" : "text-slate-500 hover:bg-slate-50 hover:text-navy-900"}`}><span className="h-2 w-2 rounded-full bg-emerald-500" />{branch.name}<span className="text-[9px] font-semibold text-slate-400">{branch.code}</span></button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><FiTrendingUp /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Assigned branch active</p><p className="mt-0.5 text-[10px] text-slate-500">Expense records are automatically saved under your assigned branch.</p></div>
        </section>
      )}

      {overallView && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><FiLock /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Network expense view is read-only</p><p className="mt-1 text-[10px] leading-4 text-slate-600">You can search, filter, and compare consolidated spending. Select a branch before adding, editing, or deleting an expense.</p></div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center gap-3 px-1"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><FiDollarSign /></span><div><h2 className="font-extrabold text-navy-900">Expense snapshot</h2><p className="text-xs text-slate-500">Category totals for {selectedPeriodLabel}.</p></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ExpenseSummaryCard
          icon={FiDollarSign}
          label="Total Expenses"
          value={formatCurrency(totalSpending)}
          helper={selectedPeriodLabel}
          tone="blue"
        />
        <ExpenseSummaryCard
          icon={FiCoffee}
          label="Food Expenses"
          value={formatCurrency(snacksAmount)}
          helper="Food & refreshments"
          tone="amber"
        />
        <ExpenseSummaryCard
          icon={FiDollarSign}
          label="Petrol / Diesel"
          value={formatCurrency(petrolDieselAmount)}
          helper="Fuel expenses"
          tone="amber"
        />
        <ExpenseSummaryCard
          icon={FiUser}
          label="Worker Amount"
          value={formatCurrency(advanceAmount)}
          helper="Amounts paid to workers"
          tone="cyan"
        />
        <ExpenseSummaryCard
          icon={FiBriefcase}
          label="Other Expenses"
          value={formatCurrency(otherExpensesAmount)}
          helper="Other business expenses"
          tone="violet"
        />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="mr-auto flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600"><FiDollarSign /></span><div><h2 className="font-extrabold text-navy-900">Expense records</h2><p className="mt-0.5 text-[10px] text-slate-500">{visibleRecords.length} entries · {scopeName}</p></div></div>
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs font-semibold text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-iceblue-300 focus:bg-white focus:ring-4 focus:ring-iceblue-50" placeholder="Search category, worker, truck, or notes..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Link href="/admin/expenses/all" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-navy-900">
            Expense archive
          </Link>
          {canManageExpenses && <button type="button" onClick={openAddExpense} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-xs font-bold text-white transition hover:bg-iceblue-800">
            <FiPlus /> Add expense
          </button>}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3 lg:px-5">
          {/* Today */}
          <button
            type="button"
            onClick={() => {
              setFilterMode("today");
              setSelectedMonth(today.slice(0, 7));
              setSelectedDate(today);
            }}
            className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
              filterMode === "today"
                ? "bg-iceblue-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-navy-900 hover:bg-iceblue-50"
            }`}
          >
            Today
          </button>

          {/* Last Month */}
          <button
            type="button"
            onClick={() => {
              const baseMonth =
                filterMode === "today"
                  ? today.slice(0, 7)
                  : selectedMonth || initialMonth;

              const previousMonth = new Date(
                `${baseMonth}-01T12:00:00+05:30`,
              );
              previousMonth.setMonth(previousMonth.getMonth() - 1);

              setFilterMode("month");

              setSelectedMonth(
                `${previousMonth.getFullYear()}-${String(
                  previousMonth.getMonth() + 1,
                ).padStart(2, "0")}`,
              );
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-navy-900 transition hover:bg-iceblue-50"
          >
            Last Month
          </button>

          {/* Month Picker */}
          <div className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5">
            <FiCalendar className="shrink-0 text-iceblue-500" />
            <label className="sr-only" htmlFor="month-picker">
              Select month
            </label>
            <input
              id="month-picker"
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                setFilterMode("month");
                setSelectedMonth(event.target.value);
              }}
              className="min-w-0 bg-transparent text-xs font-semibold text-navy-900 outline-none"
            />
          </div>

          {/* Date Picker */}
          <div className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5">
            <FiCalendar className="shrink-0 text-iceblue-500" />
            <label className="sr-only" htmlFor="date-picker">
              Select date
            </label>
            <input
              id="date-picker"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setFilterMode("date");
                setSelectedDate(event.target.value);
              }}
              className="min-w-0 bg-transparent text-xs font-semibold text-navy-900 outline-none"
            />
          </div>

          {/* Selected Period */}
          <div className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-iceblue-100 bg-iceblue-50 px-2.5 py-1.5 text-xs font-medium text-navy-800/70">
            <span>Selected:</span>
            <span className="font-semibold text-navy-900">
              {filterMode === "today"
                ? new Date(`${selectedDate}T12:00:00+05:30`).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )
                : selectedPeriodLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-navy-900 transition hover:bg-iceblue-50 disabled:opacity-60"
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        </div>

        {loadError && (
          <div className="m-4 flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <FiAlertCircle className="shrink-0" /> {loadError}
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="font-bold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <ExpenseLoading />
        ) : visibleRecords.length ? (
          <>
            <div className="sm:hidden">
              {visibleRecords.map((record, index) => (
                <div key={record._id} className="border-b border-slate-100 px-4 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tabular-nums text-navy-800/45">{index + 1}</span>
                        <p className="font-semibold text-navy-900">{formatDate(record.date)}</p>
                      </div>
                      <span className="pill mt-1.5 inline-block bg-slate-100 text-navy-900">
                        {displayCategoryName(recordCategory(record))}
                      </span>
                    </div>
                    <p className="shrink-0 font-extrabold tabular-nums text-red-600">{formatCurrency(Number(record.amount || 0))}</p>
                  </div>
                  {isSuperAdmin && (
                    <p className="mt-2 text-xs text-navy-800/60">
                      <span className="font-semibold text-navy-800/45">Branch: </span>
                      {record.branchName || branches.find((branch) => branch._id === record.branch)?.name || "Unassigned"}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-navy-800/60">
                    <span className="font-semibold text-navy-800/45">Worker / Truck: </span>
                    {record.workerName || record.truckName || "—"}
                    {Number(record.fuelQuantity || 0) > 0 && (
                      <span className="ml-1 text-navy-800/50">({Number(record.fuelQuantity).toLocaleString("en-IN")} L)</span>
                    )}
                  </p>
                  <p className="mt-1 break-words text-xs text-navy-800/60">
                    <span className="font-semibold text-navy-800/45">Notes: </span>
                    {recordNotes(record) || "—"}
                  </p>
                  {canManageExpenses && (
                    <div className="mt-2 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => openEditExpense(record)}
                        title="Edit expense"
                        className="flex items-center gap-1 text-xs font-semibold text-navy-900 hover:text-black"
                      >
                        <FiEdit3 /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(record);
                        }}
                        title="Delete expense"
                        className="flex items-center gap-1 text-xs font-semibold text-navy-900 hover:text-black"
                      >
                        <FiTrash2 /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
            <table className={`w-full ${isSuperAdmin ? "min-w-[1060px]" : "min-w-[920px]"} table-fixed border-collapse text-left text-xs sm:text-sm`}>
              <thead className="bg-slate-50/80 text-slate-400">
                <tr>
                  <th className="w-[5%] border-b border-slate-100 px-1 py-3 text-center text-[9px] font-black uppercase tracking-wider">#</th>
                  {isSuperAdmin && <th className="w-[13%] border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Branch</th>}
                  <th className="w-[12%] border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Date</th>
                  <th className="w-[16%] border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Category</th>
                  <th className="w-[16%] border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Worker / Truck</th>
                  <th className="w-[25%] border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Notes</th>
                  <th className="w-[14%] border-b border-slate-100 px-3 py-3 text-right text-[9px] font-black uppercase tracking-wider">Amount</th>
                  <th className="w-[12%] border-b border-slate-100 px-3 py-3 text-center text-[9px] font-black uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRecords.map((record, index) => (
                  <tr
                    key={record._id}
                    className="transition hover:bg-iceblue-50/40"
                  >
                    <td className="px-2 py-4 text-center text-slate-400">{index + 1}</td>
                    {isSuperAdmin && <td className="break-words px-3 py-4 text-xs font-semibold text-navy-900">{record.branchName || branches.find((branch) => branch._id === record.branch)?.name || "Unassigned"}</td>}
                    <td className="px-3 py-4 text-xs font-semibold text-navy-900">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">
                        {displayCategoryName(recordCategory(record))}
                      </span>
                    </td>
                    <td className="break-words px-3 py-4 text-xs font-medium text-navy-900">
                      {record.workerName || record.truckName || "—"}
                      {Number(record.fuelQuantity || 0) > 0 && <span className="mt-0.5 block text-xs text-navy-800/50">{Number(record.fuelQuantity).toLocaleString("en-IN")} L</span>}
                    </td>
                    <td
                      className="truncate px-3 py-4 text-xs text-slate-500"
                      title={recordNotes(record)}
                    >
                      {recordNotes(record) || "—"}
                    </td>
                    <td className="px-3 py-4 text-right text-xs font-extrabold tabular-nums text-red-600">
                      {formatCurrency(Number(record.amount || 0))}
                    </td>
                    <td className="px-3 py-4">
                      {canManageExpenses ? <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditExpense(record)}
                          title="Edit expense"
                          className="text-navy-900 hover:text-black"
                        >
                          <FiEdit3 />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(record);
                          }}
                          title="Delete expense"
                          className="text-navy-900 hover:text-black"
                        >
                          <FiTrash2 />
                        </button>
                      </div> : <span className="block text-center text-navy-800/30">—</span>}
                    </td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-14 text-center text-navy-800/50">No expenses found.</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-iceblue-50 text-2xl text-iceblue-600">
              <FiDollarSign />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-navy-900">
              No expenses recorded
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-600">
              Add the first expense to begin tracking business spending.
            </p>
            {canManageExpenses && <button
              type="button"
              onClick={openAddExpense}
              className="btn-primary mt-4 flex items-center gap-2"
            >
              <FiPlus /> Add Expense
            </button>}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/80 bg-white p-4 text-navy-900 shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)] sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><FiBriefcase /></span>
            <div><h2 className="font-extrabold text-navy-900">Spending by category</h2><p className="mt-0.5 text-xs text-slate-500">Category distribution for {selectedPeriodLabel}.</p></div>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/70">
              Total spending
            </p>
            <p className="mt-1 text-sm font-bold text-navy-900">
              {formatCurrency(totalSpending)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/40 p-1">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius={68}
                  outerRadius={102}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  stroke="transparent"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize="11" fontWeight="700">
                  TOTAL EXPENSES
                </text>
                <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontSize="15" fontWeight="800">
                  {formatCurrency(totalSpending)}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid content-start gap-2 sm:grid-cols-2">
            {chartData.length > 0 ? (
              chartData.map((item) => (
                <div
                  key={item.key}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-950">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-950">
                    {item.percent.toFixed(1)}%
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                No category totals yet for the selected range.
              </div>
            )}
          </div>
        </div>
      </section>

      {modalOpen && (
        <Modal
          title={editingRecord ? "Edit Expense" : "Add Expense"}
          onClose={() => !saving && setModalOpen(false)}
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Record an expense against the selected date and category.
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Date
              </label>
              <input
                type="date"
                required
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
                value={form.date}
                onChange={(event) =>
                  setForm({ ...form, date: event.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Expense Category
              </label>
              <select
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
                value={form.costType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    costType: event.target.value,
                    customCategory: "",
                    worker: "",
                    truck: "",
                    fuelQuantity: "",
                  })
                }
              >
                <option value="">Select category</option>
                <option value="food">Food</option>
                <option value="petrol_diesel">Petrol / Diesel</option>
                <option value="advance_for_employee">
                  Worker Amount
                </option>
                <option value="other_expenses">Other Expenses</option>
                <option value="custom">Custom category</option>
              </select>
              {form.costType === "custom" && (
                <input
                  autoFocus
                  maxLength={100}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
                  placeholder="Type custom category"
                  value={form.customCategory}
                  onChange={(event) =>
                    setForm({ ...form, customCategory: event.target.value })
                  }
                />
              )}
              <p className="mt-1 text-xs text-slate-500">
                Choose a common category or add a custom one.
              </p>
            </div>
            {form.costType === "advance_for_employee" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Select Worker</label>
                <select required className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white" value={form.worker} onChange={(event) => setForm({ ...form, worker: event.target.value })}>
                  <option value="">Select worker</option>
                  {workers.map((worker) => <option key={worker._id} value={worker._id}>{worker.name}{worker.role ? ` (${worker.role})` : ""}</option>)}
                </select>
              </div>
            )}
            {form.costType === "petrol_diesel" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Truck</label>
                  <select required className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white" value={form.truck} onChange={(event) => setForm({ ...form, truck: event.target.value })}>
                    <option value="">Select truck</option>
                    {trucks.map((truck) => <option key={truck._id} value={truck._id}>{truck.truckName}{truck.truckNumber ? ` (${truck.truckNumber})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fuel Used (Litres)</label>
                  <input type="number" min="0.01" step="0.01" inputMode="decimal" required className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white" placeholder="0.00" value={form.fuelQuantity} onChange={(event) => setForm({ ...form, fuelQuantity: event.target.value })} />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Amount (₹)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-lg font-semibold outline-none transition focus:border-amber-400 focus:bg-white"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Notes
              </label>
              <textarea
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
                rows={3}
                maxLength={500}
                placeholder="Invoice, supplier, or reason for expense"
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {form.notes.length}/500
              </p>
            </div>
            {formError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {formError}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-navy-900 px-4 py-2.5 font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiDollarSign /> {saving ? "Saving Expense..." : "Save Expense"}
            </button>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete Expense"
          onClose={() => !deleting && setDeleteTarget(null)}
        >
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800">
              <FiAlertCircle className="mt-0.5 shrink-0 text-xl" />
              <div>
                <p className="font-semibold">
                  Delete this{" "}
                  {displayCategoryName(recordCategory(deleteTarget))} expense?
                </p>
                <p className="mt-1 text-sm">
                  {formatDate(deleteTarget.date)} ·{" "}
                  {formatCurrency(deleteTarget.amount)}
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {deleteError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="rounded-2xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Expense"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ExpenseSummaryCard({ icon: Icon, label, value, helper, danger = false, tone = "blue" }: { icon: any; label: string; value: string | number; helper?: string; danger?: boolean; tone?: "blue" | "cyan" | "violet" | "amber" }) {
  const styles = {
    blue: { soft: "bg-blue-50", icon: "bg-blue-500", border: "border-blue-100" },
    cyan: { soft: "bg-cyan-50", icon: "bg-cyan-500", border: "border-cyan-100" },
    violet: { soft: "bg-violet-50", icon: "bg-violet-500", border: "border-violet-100" },
    amber: { soft: "bg-amber-50", icon: "bg-amber-500", border: "border-amber-100" },
  }[tone];
  return (
    <div className={`relative min-h-[120px] min-w-0 overflow-hidden rounded-2xl border bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,43,61,0.45)] transition hover:-translate-y-0.5 hover:shadow-md ${danger ? "border-red-100" : styles.border}`}>
      <span className={`absolute -right-7 -top-7 h-20 w-20 rounded-full ${danger ? "bg-red-50" : styles.soft}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p><p className={`mt-2 break-words text-lg font-black leading-tight tracking-tight ${danger ? "text-red-600" : "text-navy-900"}`}>{value}</p>{helper && <p className={`mt-2 text-[10px] ${danger ? "text-red-500" : "text-slate-500"}`}>{helper}</p>}</div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm ${danger ? "bg-red-500" : styles.icon}`}><Icon /></span>
      </div>
    </div>
  );
}

function CategoryProgress({
  label,
  amount,
  total,
}: {
  label: string;
  amount: number;
  total: number;
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-navy-900">{label}</p>
        <p className="shrink-0 text-sm font-bold text-navy-900">
          {formatCurrency(amount)}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-amber-400"
          style={{ width: `${Math.max(percentage, 4)}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] font-semibold text-slate-500">
        {percentage.toFixed(1)}%
      </p>
    </div>
  );
}

function ExpenseLoading() {
  return (
    <div className="animate-pulse space-y-4 p-5" aria-label="Loading expenses">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid grid-cols-4 gap-4">
          <span className="h-5 rounded bg-iceblue-100" />
          <span className="h-5 rounded bg-amber-50" />
          <span className="h-5 rounded bg-iceblue-50" />
          <span className="h-5 rounded bg-iceblue-100" />
        </div>
      ))}
    </div>
  );
}
