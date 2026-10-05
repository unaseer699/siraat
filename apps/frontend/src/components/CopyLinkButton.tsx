'use client';

import { useState } from 'react';

interface Props {
  label?: string;
  // What to copy — defaults to the current page URL (sharing this page IS
  // sharing its link, so there's nothing to call the backend for). Contractor
  // Profile passes a phone number instead to reuse this same button style
  // for "Copy Number".
  text?: string;
}

export function CopyLinkButton({ label = 'Copy Link', text }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text ?? window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be denied by the browser (permissions, insecure
      // context) — nothing useful to recover into, so just leave the button as-is.
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text)',
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        // MOBILE REVIEW finding — 6px 12px netted a ~28px-tall target, just
        // under the ~32px touch-target guideline.
        padding: '10px 14px',
        cursor: 'pointer',
      }}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
