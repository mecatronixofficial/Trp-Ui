type LoadingRole = 'super_admin' | 'admin' | 'truck' | null;

export default function AppLoadingScreen({
  message = 'Loading...',
}: {
  message?: string;
  role?: LoadingRole;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div role="status" aria-live="polite" className="flex items-center gap-3">
        <span className="h-7 w-7 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-iceblue-600" />
        <p className="text-sm font-semibold text-slate-600">{message}</p>
      </div>
    </main>
  );
}
