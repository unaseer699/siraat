import type { Metadata, Viewport } from 'next';
import './globals.css';
import { HomeButton } from '@/components/HomeButton';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Siraat — The Trust Operating System for Real Estate',
  description: 'Find property you can trust.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

// theme_color lives here (not metadata) — Next 14 moved it out of the
// Metadata type into a dedicated viewport export.
export const viewport: Viewport = {
  themeColor: '#1a56db',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <HomeButton />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
