'use client';

import { siraatWhatsAppUrl } from '@/lib/siraatContact';

// "Ask Siraat" WhatsApp button. The message names the page's subject and
// links back to it so the Siraat team knows what the person is asking about.
export function AskSiraatButton({ subject, label }: { subject: string; label?: string }) {
  function open() {
    const msg = `Assalam o Alaikum Siraat team. I would like more details about ${subject}.\n${window.location.href}`;
    window.open(siraatWhatsAppUrl(msg), '_blank', 'noopener,noreferrer');
  }
  return (
    <button
      type="button"
      onClick={open}
      className="no-print"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: '#16a34a',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      <span aria-hidden>💬</span>
      {label ?? 'Ask Siraat on WhatsApp'}
    </button>
  );
}
