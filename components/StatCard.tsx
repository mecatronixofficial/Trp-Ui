import { IconType } from 'react-icons';

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'iceblue',
  suffix,
}: {
  label: string;
  value: string | number;
  icon: IconType;
  accent?: 'iceblue' | 'navy' | 'green' | 'red' | 'amber';
  suffix?: string;
}) {
  const accents: Record<string, string> = {
    iceblue: 'bg-iceblue-50 text-iceblue-600',
    navy: 'bg-navy-900/5 text-navy-800',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="label-text">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accents[accent]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-navy-900">
        {value}
        {suffix && <span className="text-sm font-normal text-navy-800/50 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
