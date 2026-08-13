"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { dedupedGet, formatDate, getItemBarUsed } from "../../../../lib/api";

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(date));
const fmtBars = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);

export default function ProductionRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [outsource, setOutsource] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [wastage, setWastage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([dedupedGet("/production"), dedupedGet("/stock-entries"), dedupedGet("/outsource-entries"), dedupedGet("/sales"), dedupedGet("/wastage")])
      .then(([productionRows, stockRows, outsourceRows, saleRows, wastageRows]) => {
        setRecords(Array.isArray(productionRows.data) ? productionRows.data : []);
        setStock(Array.isArray(stockRows.data) ? stockRows.data : []);
        setOutsource(Array.isArray(outsourceRows.data) ? outsourceRows.data : []);
        setSales(Array.isArray(saleRows.data) ? saleRows.data : []);
        setWastage(Array.isArray(wastageRows.data) ? wastageRows.data : []);
      })
      .catch((err) => setError(err?.response?.data?.message || "Could not load production records."))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const branchId = (row: any) => String(row.branch?._id || row.branch || "");
    const rowKey = (row: any) => `${indiaDateKey(row.date)}:${branchId(row)}`;
    const stockByDate: Record<string, number> = {};
    const outsourceByDate: Record<string, number> = {};
    const soldByDate: Record<string, number> = {};
    const wastageByDate: Record<string, number> = {};
    stock.forEach((row) => { const key = rowKey(row); stockByDate[key] = (stockByDate[key] || 0) + Number(row.quantity || 0); });
    outsource.forEach((row) => { const key = rowKey(row); outsourceByDate[key] = (outsourceByDate[key] || 0) + Number(row.quantity || 0); });
    sales.forEach((sale) => {
      const key = rowKey(sale);
      soldByDate[key] = (soldByDate[key] || 0) + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
    });
    wastage
      .filter((row) => row.reason !== "unsold")
      .forEach((row) => {
        const key = rowKey(row);
        wastageByDate[key] = (wastageByDate[key] || 0) + getItemBarUsed(row);
      });
    const days: Record<string, any[]> = {};
    for (const record of records) {
      const key = rowKey(record);
      (days[key] ||= []).push(record);
    }
    return Object.entries(days)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, dayRecords]) => {
        const batches = [...dayRecords].sort((a, b) =>
          String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id)),
        );
        const totalBars = batches.reduce((sum, record) => sum + Number(record.totalBars || 0), 0);
        const dayStock = stockByDate[key] || 0;
        const dayOutsource = outsourceByDate[key] || 0;
        const sold = soldByDate[key] || 0;
        const wasted = wastageByDate[key] || 0;
        const returned = Math.max(0, totalBars - sold - wasted);
        return {
          key,
          date: batches[0]?.date,
          branch: batches[0]?.branch,
          batches: batches.length,
          boxOpen: batches[0]?.boxOpen,
          boxClose: batches[batches.length - 1]?.boxClose,
          madeBars: totalBars,
          productionBars: Math.max(0, totalBars - returned),
          returned,
          wastage: wasted,
          stock: dayStock,
          outsource: dayOutsource,
          selling: totalBars + dayOutsource - dayStock,
          sold,
        };
      })
      .filter((row) => row.sold > 0);
  }, [records, stock, outsource, sales, wastage]);

  return <div className="space-y-4 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">All Records</p><h1 className="mt-1 font-display text-2xl font-bold text-navy-900">Production History</h1></div>
      <Link href="/admin/production" className="btn-secondary flex items-center gap-2"><FiArrowLeft /> Today View</Link>
    </div>
    <section className="card overflow-x-auto">
      {loading ? <p className="py-8 text-center text-sm text-navy-800/50">Loading records...</p> : error ? <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : rows.length ?
        <table className="table-base min-w-[1120px]"><thead><tr><th>#</th><th>Date</th><th>Branch</th><th>Batches</th><th>First Open</th><th>Final Close</th><th>Made Bars</th><th>Returned Bars</th><th>Production Bars</th><th>Sold Bars</th><th>Wastage</th><th>Stocks</th><th>Outsource</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.key}><td>{index + 1}</td><td className="font-semibold">{formatDate(row.date)}</td><td><p className="font-semibold text-navy-900">{row.branch?.name || "Branch"}</p><p className="text-xs text-navy-800/45">{row.branch?.code || ""}</p></td><td className="font-semibold text-navy-900">{row.batches}</td><td>{row.boxOpen}</td><td>{row.boxClose}</td><td className="font-bold text-navy-900">{fmtBars(row.madeBars)}</td><td className="font-bold text-amber-700">{fmtBars(row.returned)}</td><td className="font-bold text-blue-700">{fmtBars(row.productionBars)}</td><td className="font-bold text-emerald-700">{fmtBars(row.sold)}</td><td className="font-semibold text-red-600">{fmtBars(row.wastage)}</td><td className="font-semibold text-amber-700">{fmtBars(row.stock)}</td><td className="font-semibold text-iceblue-700">{fmtBars(row.outsource)}</td></tr>)}</tbody></table>
        : <p className="py-8 text-center text-sm text-navy-800/50">No sold production records available. Unsold-only production is not listed.</p>}
    </section>
  </div>;
}
