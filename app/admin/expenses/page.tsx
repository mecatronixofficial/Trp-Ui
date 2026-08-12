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
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip } from "recharts";
import Modal from "../../../components/Modal";
import { COST_TYPES, formatCurrency, formatDate } from "../../../lib/api";

type ExpenseRecord = {
  _id: string;
  date: string;
  costType: string;
  amount: number;
  notes?: string;
  worker?: string;
  workerName?: string;
  createdAt?: string;
};

type ExpenseForm = {
  date: string;
  costType: string;
  amount: string;
  notes: string;
  customCategory: string;
  worker: string;
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

const createForm = (): ExpenseForm => ({
  date: todayIndiaISO(),
  costType: "",
  amount: "",
  notes: "",
  customCategory: "",
  worker: "",
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
    snacks: "Snacks",
    snack: "Snacks",
    snacks_expenses: "Snacks",
    advance_for_employee: "Advance for Employee",
    advance_for_emp: "Advance for Employee",
    advance_employee: "Advance for Employee",
    advance: "Advance for Employee",
    employee_advance: "Advance for Employee",
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
  if (["snacks", "snack", "snacks_expenses"].includes(normalized))
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
  if (["snacks", "snacks_expenses"].includes(normalized)) return "snacks";
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
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState<{
    totalExpenses: number;
    snacksTotal: number;
    petrolDieselTotal: number;
    balance: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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
        const response = await fetch(`/api/expenses?${params.toString()}`, { cache: "no-store" });
        const payload = await readExpenseResponse(response);
        if (!response.ok)
          throw new Error(payload?.message || "Could not load expenses");
        setRecords(Array.isArray(payload.records) ? payload.records : []);
        setSummary(
          payload?.summary
            ? {
                totalExpenses: Number(payload.summary.totalExpenses || 0),
                snacksTotal: Number(payload.summary.snacksTotal || 0),
                petrolDieselTotal: Number(payload.summary.petrolDieselTotal || 0),
                balance: Number(payload.summary.balance || 0),
              }
            : null,
        );
        setLastUpdated(new Date());
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
    void load(true);
  }, [load]);

  useEffect(() => {
    import("../../../lib/api").then(({ default: api }) => api.get("/workers")
      .then(({ data }) => setWorkers((Array.isArray(data) ? data : []).filter((worker: any) => worker.isActive !== false)))
      .catch(() => setWorkers([])));
  }, []);

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
      [displayCategoryName(recordCategory(record)), record.workerName, recordNotes(record)]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [filteredRecords, search]);

  const totals = useMemo(() => {
    const all = monthRecords.reduce(
      (sum, record) => sum + Number(record.amount || 0),
      0,
    );
    const todayTotal = monthRecords
      .filter((record) => indiaDateKey(record.date) === today)
      .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const monthTotal = monthRecords.reduce(
      (sum, record) => sum + Number(record.amount || 0),
      0,
    );
    const visible = filteredRecords.reduce(
      (sum, record) => sum + Number(record.amount || 0),
      0,
    );
    return { all, today: todayTotal, month: monthTotal, visible };
  }, [monthRecords, filteredRecords, today]);

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

  const chartColors = [
    "#2563eb",
    "#0ea5e9",
    "#22c55e",
    "#a855f7",
    "#f59e0b",
    "#14b8a6",
    "#ef4444",
    "#64748b",
  ];
  // Use the filtered backend summary as the source of truth for the donut total.
  const totalSpending = Number(summary?.totalExpenses ?? totals.visible);
  const chartData = useMemo(
    () =>
      categoryTotals.map((item, index) => ({
        ...item,
        percent: totalSpending > 0 ? (item.amount / totalSpending) * 100 : 0,
        color: chartColors[index % chartColors.length],
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
  const isSnackRecord = (record: ExpenseRecord) => {
    const label = displayCategoryName(recordCategory(record));
    const normalized = normalizeCategory(label);
    return (
      normalized === "snacks" ||
      normalized === "snacks_expenses" ||
      normalizeCategory(record.costType) === "snacks"
    );
  };
  const snacksAmount = monthRecords.reduce(
    (sum, record) =>
      sum + (isSnackRecord(record) ? Number(record.amount || 0) : 0),
    0,
  );
  const advanceAmount = monthRecords.reduce(
    (sum, record) =>
      sum +
      (displayCategoryName(recordCategory(record)) === "Advance for Employee"
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
    setEditingRecord(null);
    setForm(createForm());
    setFormError("");
    setModalOpen(true);
  };

  const openEditExpense = (record: ExpenseRecord) => {
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
    });
    setFormError("");
    setModalOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      const selectedWorker = workers.find((worker) => worker._id === form.worker);
      if (needsWorker && !selectedWorker) {
        setFormError("Select a registered employee");
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
      };
      let responseRecord: ExpenseRecord | null = null;
      if (editingRecord) {
        const response = await fetch(`/api/expenses?id=${editingRecord._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await readExpenseResponse(response);
        if (!response.ok)
          throw new Error(result?.message || "Could not save expense");
        responseRecord = {
          ...editingRecord,
          ...payload,
          _id: editingRecord._id,
          amount: Number(payload.amount),
          notes: payload.notes,
          date: payload.date,
          ...(result.record || {}),
        } as ExpenseRecord;
      } else {
        const response = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await readExpenseResponse(response);
        if (!response.ok)
          throw new Error(result?.message || "Could not save expense");
        const created = result.record || result;
        responseRecord = {
          ...created,
          _id: created?._id || `${Date.now()}`,
          date: created?.date || payload.date,
          costType: created?.costType || payload.costType,
          amount: Number(created?.amount || payload.amount),
          notes: created?.notes || payload.notes,
        } as ExpenseRecord;
      }
      setLastUpdated(new Date());
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
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/expenses?id=${deleteTarget._id}`, {
        method: "DELETE",
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
    <div className="-mt-4 space-y-1 sm:-mt-5">
      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <ExpenseSummaryCard
          icon={FiDollarSign}
          label="Total Expenses"
          value={formatCurrency(summary?.totalExpenses ?? totals.month)}
          helper="All recorded expenses"
          tone="blue"
        />
        <ExpenseSummaryCard
          icon={FiCoffee}
          label="Snacks Expenses"
          value={formatCurrency(summary?.snacksTotal ?? snacksAmount)}
          helper="Food & refreshments"
          tone="amber"
        />
        <ExpenseSummaryCard
          icon={FiDollarSign}
          label="Petrol / Diesel"
          value={formatCurrency(summary?.petrolDieselTotal ?? 0)}
          helper="Fuel expenses"
          tone="amber"
        />
        <ExpenseSummaryCard
          icon={FiUser}
          label="Advance for Employee"
          value={formatCurrency(advanceAmount)}
          helper="Employee advance payments"
          tone="cyan"
        />
        <ExpenseSummaryCard
          icon={FiBriefcase}
          label="Other Expenses"
          value={formatCurrency(otherExpensesAmount)}
          helper="Other business expenses"
          tone="violet"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-iceblue-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
          <h1 className="shrink-0 font-display text-base font-bold text-navy-900">All Expenses</h1>
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-iceblue-400" />
            <input className="input-field h-10 pl-9" placeholder="Search by category, employee or notes..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Link href="/admin/expenses/all" className="btn-secondary flex h-10 shrink-0 items-center justify-center gap-2 px-4">
            All Records
          </Link>
          <button type="button" onClick={openAddExpense} className="btn-primary flex h-10 shrink-0 items-center justify-center gap-2 px-4">
            <FiPlus /> Add Expense
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-iceblue-100 px-4 py-3">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-navy-900">
                <tr>
                  <th className="w-[5%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                  <th className="w-[12%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Date</th>
                  <th className="w-[16%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Category</th>
                  <th className="w-[16%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Employee</th>
                  <th className="w-[25%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Notes</th>
                  <th className="w-[14%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Amount</th>
                  <th className="w-[12%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record, index) => (
                  <tr
                    key={record._id}
                    className="even:bg-slate-50 hover:bg-iceblue-50/70"
                  >
                    <td className="border border-slate-300 px-1 py-2.5 text-center font-medium text-navy-900">{index + 1}</td>
                    <td className="border border-slate-300 px-2 py-2.5 text-center font-medium text-navy-900">
                      {formatDate(record.date)}
                    </td>
                    <td className="border border-slate-300 px-2 py-2.5 text-center">
                      <span className="pill bg-slate-100 text-navy-900">
                        {displayCategoryName(recordCategory(record))}
                      </span>
                    </td>
                    <td className="break-words border border-slate-300 px-2 py-2.5 text-center font-medium text-navy-900">{record.workerName || "—"}</td>
                    <td
                      className="truncate border border-slate-300 px-2 py-2.5 text-center text-navy-800/60"
                      title={recordNotes(record)}
                    >
                      {recordNotes(record) || "—"}
                    </td>
                    <td className="border border-slate-300 px-2 py-2.5 text-center font-bold tabular-nums text-navy-900">
                      {formatCurrency(Number(record.amount || 0))}
                    </td>
                    <td className="border border-slate-300 px-2 py-2.5">
                      <div className="flex flex-wrap items-center justify-center gap-2">
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
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="border border-slate-300 px-4 py-10 text-center text-navy-800/50">No expenses found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
            <button
              type="button"
              onClick={openAddExpense}
              className="btn-primary mt-4 flex items-center gap-2"
            >
              <FiPlus /> Add Expense
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 border-b border-iceblue-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-800/45">
              Spending by category
            </p>
            <h2 className="mt-0.5 font-display text-base font-bold text-navy-900">
              Expenses Breakdown
            </h2>
          </div>
          <div className="rounded-xl border border-iceblue-100 bg-iceblue-50 px-4 py-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">
              Total Spending
            </p>
            <p className="mt-1 text-sm font-bold text-navy-900">
              {formatCurrency(totalSpending)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-iceblue-100 bg-white p-1">
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
                  })
                }
              >
                <option value="">Select category</option>
                <option value="snacks">Snacks</option>
                <option value="petrol_diesel">Petrol / Diesel</option>
                <option value="advance_for_employee">
                  Advance for Employee
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
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Registered Employee</label>
                <select required className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white" value={form.worker} onChange={(event) => setForm({ ...form, worker: event.target.value })}>
                  <option value="">Select employee</option>
                  {workers.map((worker) => <option key={worker._id} value={worker._id}>{worker.name}{worker.role ? ` (${worker.role})` : ""}</option>)}
                </select>
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
    blue: { card: "from-blue-50 to-white", icon: "bg-blue-600", accent: "bg-blue-500" },
    cyan: { card: "from-cyan-50 to-white", icon: "bg-cyan-600", accent: "bg-cyan-500" },
    violet: { card: "from-violet-50 to-white", icon: "bg-violet-600", accent: "bg-violet-500" },
    amber: { card: "from-amber-50 to-white", icon: "bg-amber-500", accent: "bg-amber-500" },
  }[tone];
  return (
    <div className={`relative flex min-h-[108px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles.card} ${danger ? "border-red-100" : "border-iceblue-100"}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${danger ? "bg-red-500" : styles.accent}`} />
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg text-white shadow-sm ${danger ? "bg-red-500" : styles.icon}`}>
        <Icon />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/45">{label}</p>
        <p className={`mt-1 break-words font-display text-lg font-bold leading-tight ${danger ? "text-red-600" : "text-navy-900"}`}>{value}</p>
        {helper && (
          <p className={`mt-0.5 text-xs font-semibold ${danger ? "text-red-600" : "text-navy-800/55"}`}>
            {helper}
          </p>
        )}
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
