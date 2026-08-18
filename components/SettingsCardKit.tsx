'use client';

import { FiCheckCircle, FiSave } from 'react-icons/fi';

// Shared building blocks for the Admin Profile and Company Profile pages —
// kept here so both pages render the same numbered-card look without
// duplicating the markup.

export function SettingsCard({ step, icon: Icon, title, subtitle, children }: { step: string; icon: any; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="text-lg" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-navy-900">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="hidden shrink-0 font-display text-2xl font-black text-slate-100 sm:block">{step}</span>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function CardFooter({ saved, savedText, error, saving, label, savingLabel }: { saved: boolean; savedText: string; error: string; saving: boolean; label: string; savingLabel?: string }) {
  return (
    <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
      <div>
        {saved && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><FiCheckCircle /> {savedText}</p>}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
      <button className="btn-primary flex min-w-40 items-center justify-center gap-2" disabled={saving}><FiSave />{saving ? (savingLabel || 'Saving...') : label}</button>
    </div>
  );
}

export function ProfileRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-navy-900">{value}</p>
      </div>
    </div>
  );
}

export function Field({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return <div><label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Icon className="text-indigo-600" />{label}</label>{children}</div>;
}
