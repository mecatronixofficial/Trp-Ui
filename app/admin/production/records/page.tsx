"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { dedupedGet } from "../../../../lib/api";
import { formatDate } from "../../../../lib/api";

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(date));
const fmtBars = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);

export default function ProductionRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [outsource, setOutsource] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([dedupedGet("/production"), dedupedGet("/stock-entries"), dedupedGet("/outsource-entries")])
      .then(([productionRows, stockRows, outsourceRows]) => {
        setRecords(Array.isArray(productionRows.data) ? productionRows.data : []);
        setStock(Array.isArray(stockRows.data) ? stockRows.data : []);
        setOutsource(Array.isArray(outsourceRows.data) ? outsourceRows.data : []);
      })
      .catch((err) => setError(err?.response?.data?.message || "Could not load production records."))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const stockByDate: Record<string, number> = {};
    const outsourceByDate: Record<string, number> = {};
    stock.forEach((row) => { const key = indiaDateKey(row.date); stockByDate[key] = (stockByDate[key] || 0) + Number(row.quantity || 0); });
    outsource.forEach((row) => { const key = indiaDateKey(row.date); outsourceByDate[key] = (outsourceByDate[key] || 0) + Number(row.quantity || 0); });
    return [...records].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((record) => {
      const key = indiaDateKey(record.date);
      const total = Number(record.totalBars || 0);
      return { ...record, stock: stockByDate[key] || 0, outsource: outsourceByDate[key] || 0, selling: total + (outsourceByDate[key] || 0) - (stockByDate[key] || 0) };
    });
  }, [records, stock, outsource]);

  return <div className="space-y-4 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">All Records</p><h1 className="mt-1 font-display text-2xl font-bold text-navy-900">Production History</h1></div>
      <Link href="/admin/production" className="btn-secondary flex items-center gap-2"><FiArrowLeft /> Today View</Link>
    </div>
    <section className="card overflow-x-auto">
      {loading ? <p className="py-8 text-center text-sm text-navy-800/50">Loading records...</p> : error ? <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : rows.length ?
        <table className="table-base min-w-[760px]"><thead><tr><th>#</th><th>Date</th><th>Open</th><th>Close</th><th>Total Bars</th><th>Stocks</th><th>Outsource</th><th>Selling Bars</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row._id}><td>{index + 1}</td><td className="font-semibold">{formatDate(row.date)}</td><td>{row.boxOpen}</td><td>{row.boxClose}</td><td className="font-bold text-blue-700">{fmtBars(Number(row.totalBars || 0))}</td><td className="font-semibold text-amber-700">{fmtBars(row.stock)}</td><td className="font-semibold text-iceblue-700">{fmtBars(row.outsource)}</td><td className={`font-bold ${row.selling < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtBars(row.selling)}</td></tr>)}</tbody></table>
        : <p className="py-8 text-center text-sm text-navy-800/50">No production records available.</p>}
    </section>
  </div>;
}
