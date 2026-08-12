import { FiArrowDownRight, FiArrowUpRight } from 'react-icons/fi';

export default function SalesSummaryTile({ label, value, danger = false, trend = 'up' }: { label: string; value: string; danger?: boolean; trend?: 'up' | 'down' }) {
  const TrendIcon = trend === 'up' ? FiArrowUpRight : FiArrowDownRight;
  return (
    <div className={`flex min-h-[112px] min-w-0 items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${danger ? 'border-red-100' : 'border-iceblue-100'}`}>
      <div className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full ${danger ? 'bg-[conic-gradient(#ef4444_0deg,#ef4444_260deg,#fee2e2_260deg)]' : 'bg-[conic-gradient(#1ca6d1_0deg,#175872_265deg,#dff5fd_265deg)]'}`}><span className="grid h-11 w-11 place-items-center rounded-full bg-white"><span className={`h-2.5 w-2.5 rounded-full ${danger ? 'bg-red-500' : 'bg-iceblue-600'}`} /></span></div>
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/50">{label}</p><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${trend === 'up' && !danger ? 'bg-emerald-100 text-emerald-700' : danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}><TrendIcon size={17} /></span></div><p className={`mt-2 truncate text-lg font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>
    </div>
  );
}
