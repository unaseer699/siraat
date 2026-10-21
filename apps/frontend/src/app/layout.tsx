import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppHeader } from '@/components/HomeButton';
import { SiraatChatFloat } from '@/components/SiraatChatFloat';
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
        {/* MOBILE REVIEW — AppHeader (components/HomeButton.tsx) replaces the
            old `position: fixed` HomeButton. It's sticky and occupies real
            document-flow height, so it can never overlap a page's own
            top-left content (BackLink, AdminNav) the way the fixed pill
            did on narrow viewports — see that file's comment. */}
        <AppHeader />
        <ServiceWorkerRegister />
        {children}
        <SiraatChatFloat />
      </body>
    </html>
  );
}
