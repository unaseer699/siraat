import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Siraat — The Trust Operating System for Real Estate',
  description: 'Find property you can trust.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
