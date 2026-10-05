import type { CSSProperties } from 'react';

// UI REVIEW finding — plainButtonStyle and dangerButtonStyle were
// byte-for-byte identical across admin/candidates/page.tsx, admin/house-
// plans/page.tsx, and admin/whatsapp-review/page.tsx; primaryButtonStyle
// existed in two of the three with only a padding difference (6px 12px vs
// 8px 16px). Consolidated here — primaryButtonStyle keeps the slightly
// larger 8px/16px padding (house-plans' value) as the one shared size,
// which is close enough to the other callers' prior 6px/12px that no
// caller needed a visible layout adjustment.
export const plainButtonStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  cursor: 'pointer',
};

export function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    fontSize: '13px',
    fontWeight: 600,
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius)',
    background: disabled ? 'var(--muted)' : '#111',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export function dangerButtonStyle(disabled: boolean): CSSProperties {
  return {
    fontSize: '13px',
    fontWeight: 600,
    padding: '6px 12px',
    border: '1px solid var(--error)',
    borderRadius: 'var(--radius)',
    background: '#fff',
    color: 'var(--error)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
