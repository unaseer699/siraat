'use client';

import { usePathname } from 'next/navigation';
import { siraatWhatsAppUrl } from '@/lib/siraatContact';

// Floating "Chat with us" bubble on public pages. Hidden in admin and on
// the contractor's private upload page, and when printing.
export function SiraatChatFloat() {
  const path = usePathname() ?? '';
  if (path.startsWith('/admin') || path.startsWith('/contractor-upload')) return null;
  return (
    <>
      <style>{`@media print { .siraat-chat-float { display: none !important; } }`}</style>
      <a
        className="siraat-chat-float"
        href={siraatWhatsAppUrl('Assalam o Alaikum Siraat team. I need some help.')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Siraat on WhatsApp"
        style={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: '#16a34a',
          color: '#fff',
          borderRadius: '99px',
          fontSize: '14px',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}
      >
        <span aria-hidden>💬</span> Chat with us
      </a>
    </>
  );
}
