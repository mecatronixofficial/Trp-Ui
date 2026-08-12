'use client';

import { useEffect, useState } from 'react';

const fallbackLogo = '/tiruppur-ice-logo.png';

export default function BrandLogo({ alt = 'Tiruppur Ice', className = '' }: { alt?: string; className?: string }) {
  const [src, setSrc] = useState(fallbackLogo);

  useEffect(() => {
    const syncLogo = () => setSrc(window.localStorage.getItem('tii_business_logo') || fallbackLogo);
    syncLogo();
    window.addEventListener('storage', syncLogo);
    window.addEventListener('tii-logo-change', syncLogo);
    return () => {
      window.removeEventListener('storage', syncLogo);
      window.removeEventListener('tii-logo-change', syncLogo);
    };
  }, []);

  return <img src={src} alt={alt} className={className} onError={() => setSrc(fallbackLogo)} />;
}
