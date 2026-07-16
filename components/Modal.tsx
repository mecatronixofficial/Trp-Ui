'use client';

import { FiX } from 'react-icons/fi';

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className={`max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-iceblue-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="min-w-0 truncate font-display text-base font-semibold sm:text-lg">{title}</h2>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-navy-800/50 hover:bg-iceblue-50 hover:text-navy-900">
            <FiX size={20} />
          </button>
        </div>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </div>
    </div>
  );
}
