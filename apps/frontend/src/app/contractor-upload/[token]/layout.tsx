import type { Metadata } from 'next';

// A private link: keep it out of search results.
export const metadata: Metadata = { title: 'Add your projects | Siraat', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
