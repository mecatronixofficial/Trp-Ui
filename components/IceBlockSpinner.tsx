export default function IceBlockSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3">
      <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-iceblue-600" />
      <p className="text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}
