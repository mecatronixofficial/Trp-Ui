'use client';

import { FiCheckCircle, FiSave } from 'react-icons/fi';

// Shared building blocks for the Admin Profile and Company Profile pages —
// kept here so both pages render the same numbered-card look without
// duplicating the markup.

export function SettingsCard({ step, icon: Icon, title, subtitle, children }: { step: string; icon: any; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
      <div className="flex items-center gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white px-5 py-4 sm:px-6 sm:py-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-iceblue-50 text-iceblue-700 ring-1 ring-iceblue-100"><Icon className="text-lg" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold tracking-tight text-navy-900">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
        <span className="hidden shrink-0 text-3xl font-black tracking-tight text-slate-100 sm:block">{step}</span>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function CardFooter({ saved, savedText, error, saving, label, savingLabel }: { saved: boolean; savedText: string; error: string; saving: boolean; label: string; savingLabel?: string }) {
  return (
    <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
      <div>
        {saved && <p className="flex items-center gap-2 text-sm font-bold text-emerald-600"><FiCheckCircle /> {savedText}</p>}
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      </div>
      <button className="btn-primary flex min-w-40 items-center justify-center gap-2" disabled={saving}><FiSave />{saving ? (savingLabel || 'Saving...') : label}</button>
    </div>
  );
}

export function ProfileRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-100"><Icon /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-navy-900">{value}</p>
      </div>
    </div>
  );
}

export function Field({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return <div><label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><Icon className="text-iceblue-600" />{label}</label>{children}</div>;
}
