"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { dedupedGet, formatDate, getItemBarUsed } from "../../../../lib/api";

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
const fmtBars = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);

export default function TruckRecordsPage() {
  const [loads, setLoads] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([dedupedGet("/truck-loads"), dedupedGet("/sales"), dedupedGet("/trucks")])
      .then(([loadRows, saleRows, truckRows]) => { setLoads(Array.isArray(loadRows.data) ? loadRows.data : []); setSales(Array.isArray(saleRows.data) ? saleRows.data : []); setTrucks(Array.isArray(truckRows.data) ? truckRows.data : []); })
      .catch((err) => setError(err?.response?.data?.message || "Could not load truck records."))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const sold: Record<string, number> = {};
    sales.forEach((sale) => { const id = String(sale.truck?._id || sale.truck || ""); if (!id) return; const key = `${indiaDateKey(sale.date)}:${id}`; sold[key] = (sold[key] || 0) + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0); });
    const grouped: Record<string, any> = {};
    loads.forEach((load) => { const truck = typeof load.truck === "object" ? load.truck : trucks.find((item) => item._id === load.truck); const id = String(truck?._id || load.truck || ""); if (!id) return; const date = indiaDateKey(load.date); const key = `${date}:${id}`; grouped[key] ||= { key, date, truckName: truck?.truckName || "Truck", truckNumber: truck?.truckNumber || "", assignments: [], taken: 0, sold: sold[key] || 0 }; grouped[key].assignments.push(load); grouped[key].taken += Number(load.quantity || 0); });
    return Object.values(grouped).sort((a: any, b: any) => b.date.localeCompare(a.date));
  }, [loads, sales, trucks]);

  return <div className="space-y-4 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">All Records</p><h1 className="mt-1 font-display text-2xl font-bold text-navy-900">Truck Assignment &amp; Sales Report</h1></div><Link href="/admin/production" className="btn-secondary flex items-center gap-2"><FiArrowLeft /> Today View</Link></div>
    <section className="card overflow-x-auto">
      {loading ? <p className="py-8 text-center text-sm text-navy-800/50">Loading records...</p> : error ? <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : rows.length ?
        <table className="table-base min-w-[820px]"><thead><tr><th>Date</th><th>Truck</th><th>Separate Assignments</th><th>Total Taken</th><th>Sold Bars</th><th>Remaining</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.key}><td>{formatDate(`${row.date}T12:00:00+05:30`)}</td><td><p className="font-semibold text-navy-900">{row.truckName}</p><p className="text-xs text-navy-800/45">{row.truckNumber}</p></td><td><div className="flex flex-wrap gap-1">{row.assignments.map((assignment: any, index: number) => <span key={assignment._id} className="pill bg-iceblue-50 text-iceblue-700">#{index + 1}: {fmtBars(Number(assignment.quantity || 0))}</span>)}</div></td><td className="font-semibold">{fmtBars(row.taken)}</td><td className="font-semibold text-amber-700">{fmtBars(row.sold)}</td><td className={`font-bold ${row.taken - row.sold < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtBars(row.taken - row.sold)}</td></tr>)}</tbody></table>
        : <p className="py-8 text-center text-sm text-navy-800/50">No truck assignment records available.</p>}
    </section>
  </div>;
}
