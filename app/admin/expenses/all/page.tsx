"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCalendar, FiGitBranch, FiRefreshCw } from "react-icons/fi";
import api, { COST_TYPES, formatCurrency, formatDate } from "../../../../lib/api";
import { selectedBranchHeaders } from "../../../../lib/branch-fetch";
import { useAuth } from "../../../../context/AuthContext";

type Branch = { _id: string; name: string; code: string; isActive?: boolean };

type ExpenseRecord = {
  _id: string;
  date: string;
  costType: string;
  amount: number;
  notes?: string;
  branch?: string;
  branchName?: string;
  workerName?: string;
  truckName?: string;
  fuelQuantity?: number;
};

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(date));

const CATEGORY_NOTE_PREFIX = "[[expense-category:";
const CATEGORY_NOTE_SUFFIX = "]]";

const customCategory = (notes = "") => {
  const firstLine = notes.split("\n")[0] || "";
  if (!firstLine.startsWith(CATEGORY_NOTE_PREFIX) || !firstLine.endsWith(CATEGORY_NOTE_SUFFIX)) return "";
  try {
    return decodeURIComponent(firstLine.slice(CATEGORY_NOTE_PREFIX.length, -CATEGORY_NOTE_SUFFIX.length));
  } catch {
    return "";
  }
};

const visibleNotes = (record: ExpenseRecord) =>
  customCategory(record.notes)
    ? (record.notes || "").split("\n").slice(1).join("\n").trim()
    : record.notes || "";

const categoryLabel = (record: ExpenseRecord) => {
  const value = customCategory(record.notes) || record.costType;
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (["food", "food_expenses", "snack", "snacks", "snacks_expenses"].includes(normalized)) return "Food";
  if (["advance", "advance_for_emp", "advance_for_employee", "employee_advance"].includes(normalized)) return "Worker Amount";
  if (["chat", "chat_expense", "chat_expenses", "communication", "other_expense", "other_expenses"].includes(normalized)) return "Other Expenses";
  if (["petrol", "diesel", "petrol_diesel"].includes(normalized)) return "Petrol / Diesel";
  return COST_TYPES.find((item) => item.value === value)?.label
    || String(value || "Other").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default function AllExpenseRecordsPage() {
  const { user, loading: authLoading } = useAuth();
  const today = indiaDateKey(new Date());
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<"all" | "today" | "month">("all");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [error, setError] = useState("");
  const isSuperAdmin = user?.role === "super_admin";
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/expenses", { cache: "no-store", headers: selectedBranchHeaders() });
      const payload = await readExpenseResponse(response);
      if (!response.ok) throw new Error(payload?.message || "Could not load expense records");
      setRecords(Array.isArray(payload.records) ? payload.records : []);
    } catch (loadError: any) {
      setError(loadError?.message || "Could not load expense records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    void load();
  }, [authLoading, load, selectedBranch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem("tii_selected_branch", branch);
    else window.localStorage.removeItem("tii_selected_branch");
    window.location.reload();
  };

  const visibleRecords = useMemo(() => records.filter((record) => {
    const key = indiaDateKey(record.date);
    if (period === "today") return key === today;
    if (period === "month") return key.startsWith(month);
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [records, period, month, today]);

  const total = visibleRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <section className="flex flex-col gap-3 rounded-2xl border border-iceblue-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><FiGitBranch /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Expense records view</p>
              <p className="font-semibold text-navy-900">{activeBranch ? `${activeBranch.name} (${activeBranch.code})` : "Overall — all branches"}</p>
            </div>
          </div>
          <select className="input-field h-10 sm:max-w-xs" aria-label="Change expense records branch" value={selectedBranch || ""} onChange={(event) => changeBranch(event.target.value)}>
            <option value="">Overall — all branches</option>
            {branches.filter((branch) => branch.isActive !== false).map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
          </select>
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-emerald-700 to-teal-600 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Expense Records</p>
            <h1 className="mt-1 font-display text-2xl font-bold">All Expense Records</h1>
            <p className="mt-1 text-sm text-emerald-50/90">Review every expense and select the period you want to display.</p>
          </div>
          <Link href="/admin/expenses" className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/30 bg-white px-3 py-2 text-sm font-semibold text-emerald-700">
            <FiArrowLeft /> Expenses Page
          </Link>
        </div>

        <div className="grid gap-3 border-b border-emerald-200 bg-emerald-50/60 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="label-text">Select Records</label>
            <select className="input-field" value={period} onChange={(event) => setPeriod(event.target.value as "all" | "today" | "month")}>
              <option value="all">All Records</option>
              <option value="today">Today&apos;s Records</option>
              <option value="month">Selected Month</option>
            </select>
          </div>
          <div>
            <label className="label-text">Month</label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
              <input type="month" className="input-field pl-9" disabled={period !== "month"} value={month} onChange={(event) => { setMonth(event.target.value); setPeriod("month"); }} />
            </div>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60">
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm">
          <span className="font-semibold text-slate-600">{visibleRecords.length} record(s)</span>
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-bold text-emerald-700">Total: {formatCurrency(total)}</span>
        </div>

        {error && <p className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {loading ? <p className="p-8 text-center text-slate-500">Loading records...</p> : (
          <div className="overflow-x-auto"><table className={`w-full ${isSuperAdmin ? "min-w-[900px]" : "min-w-[760px]"} table-fixed border-collapse text-left text-xs sm:text-sm`}>
            <thead className="bg-emerald-700 text-white">
              <tr>
                <th className="w-[7%] border border-emerald-800 px-2 py-3 text-center text-xs font-bold uppercase">S.No</th>
                {isSuperAdmin && <th className="w-[14%] border border-emerald-800 px-3 py-3 text-xs font-bold uppercase">Branch</th>}
                <th className="w-[15%] border border-emerald-800 px-3 py-3 text-xs font-bold uppercase">Date</th>
                <th className="w-[19%] border border-emerald-800 px-3 py-3 text-xs font-bold uppercase">Category</th>
                <th className="w-[18%] border border-emerald-800 px-3 py-3 text-xs font-bold uppercase">Worker / Truck</th>
                <th className="w-[25%] border border-emerald-800 px-3 py-3 text-xs font-bold uppercase">Notes</th>
                <th className="w-[16%] border border-emerald-800 px-3 py-3 text-right text-xs font-bold uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record, index) => (
                <tr key={record._id} className="even:bg-slate-50 hover:bg-emerald-50/70">
                  <td className="border border-slate-300 px-2 py-3 text-center text-slate-500">{index + 1}</td>
                  {isSuperAdmin && <td className="break-words border border-slate-300 px-3 py-3 font-medium">{record.branchName || branches.find((branch) => branch._id === record.branch)?.name || "Unassigned"}</td>}
                  <td className="border border-slate-300 px-3 py-3 font-medium">{formatDate(record.date)}</td>
                  <td className="break-words border border-slate-300 px-3 py-3">{categoryLabel(record)}</td>
                  <td className="break-words border border-slate-300 px-3 py-3 font-medium">
                    {record.workerName || record.truckName || "—"}
                    {Number(record.fuelQuantity || 0) > 0 && <span className="mt-0.5 block text-xs text-slate-500">{Number(record.fuelQuantity).toLocaleString("en-IN")} L</span>}
                  </td>
                  <td className="break-words border border-slate-300 px-3 py-3 text-slate-600">{visibleNotes(record) || "—"}</td>
                  <td className="border border-slate-300 bg-emerald-50/30 px-3 py-3 text-right font-bold">{formatCurrency(Number(record.amount || 0))}</td>
                </tr>
              ))}
              {visibleRecords.length === 0 && <tr><td colSpan={isSuperAdmin ? 7 : 6} className="border border-slate-300 px-4 py-10 text-center text-slate-500">No expense records for this selection.</td></tr>}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
