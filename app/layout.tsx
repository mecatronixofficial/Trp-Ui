import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata: Metadata = {
  title: {
    default: 'Tiruppur Ice Since 2000',
    template: '%s | Tiruppur Ice',
  },
  description: 'Ice bar production, sales & profit management',
  applicationName: 'Tiruppur Ice',
  icons: { icon: '/tiruppur-ice-logo.png', apple: '/tiruppur-ice-logo.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1ca6d1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-iceblue-50 text-navy-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
