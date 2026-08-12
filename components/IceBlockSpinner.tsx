export default function IceBlockSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="text-center">
      <div className="relative mx-auto mb-4 h-14 w-14">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-iceblue-200/60" />
        <svg
          viewBox="0 0 48 48"
          className="relative h-14 w-14 animate-bounce drop-shadow-md [animation-duration:1.2s]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="pageLoaderIce" x1="0" y1="0" x2="1" y2="1">
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
          <rect x="6" y="8" width="30" height="30" rx="4" fill="url(#pageLoaderIce)" stroke="#0284c7" strokeWidth="1.5" />
          {/* crack line */}
          <path d="M13 8 L19 20 L12 27" stroke="#f0fbff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          {/* shine */}
          <rect x="10" y="12" width="5" height="14" rx="2.5" fill="white" opacity="0.55" />
        </svg>
      </div>
      <p className="font-medium text-navy-800/70">{label}</p>
    </div>
  );
}
