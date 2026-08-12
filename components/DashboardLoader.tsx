export default function DashboardLoader({ label = 'Loading dashboard...' }: { label?: string }) {
  return (
    <div className="text-center">
      <div className="relative mx-auto mb-5 h-28 w-28">
        <span className="absolute inset-0 animate-ping rounded-[2rem] bg-iceblue-200/50 [animation-duration:1s]" />
        <svg
          viewBox="0 0 48 48"
          className="relative h-28 w-28 animate-bounce drop-shadow-xl [animation-duration:.7s]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="dashboardLoaderIce" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0fbff" />
              <stop offset="50%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          {/* top face (pseudo-3D) */}
          <path d="M11 8 L18 3 L42 3 L36 8 Z" fill="#f0fbff" stroke="#0284c7" strokeWidth="1" strokeLinejoin="round" />
          {/* right face (pseudo-3D) */}
          <path d="M36 8 L42 3 L42 30 L36 36 Z" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1" strokeLinejoin="round" />
          {/* block body (front face) */}
          <rect x="6" y="8" width="30" height="30" rx="4" fill="url(#dashboardLoaderIce)" stroke="#0284c7" strokeWidth="1.5" />
          {/* crack line */}
          <path d="M13 8 L19 20 L12 27" stroke="#f0fbff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          {/* shine */}
          <rect x="10" y="12" width="5" height="14" rx="2.5" fill="white" opacity="0.55" />
        </svg>
        {/* melt drips */}
        <span className="absolute left-[36%] top-[88%] h-2.5 w-2.5 animate-bounce rounded-full bg-iceblue-400 [animation-delay:.15s] [animation-duration:.9s]" />
        <span className="absolute left-[58%] top-[88%] h-2 w-2 animate-bounce rounded-full bg-iceblue-300 [animation-delay:.35s] [animation-duration:1.1s]" />
      </div>
      <p className="font-display text-base font-bold text-navy-900">{label}</p>
      <p className="mt-1 text-xs text-navy-800/50">Just a moment...</p>
    </div>
  );
}
