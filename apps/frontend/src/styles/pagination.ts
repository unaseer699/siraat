import type { CSSProperties } from 'react';

// UI REVIEW finding — this exact function was independently copy-pasted
// into browse/page.tsx, contractors/page.tsx, suppliers/page.tsx,
// house-plans/page.tsx, admin/house-plans/page.tsx, and admin/projects/
// page.tsx — six identical copies of the same Prev/Next button style.
// Consolidated here as the one source of truth.
export function paginationButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: disabled ? '#f3f4f6' : '#fff',
    color: disabled ? 'var(--muted)' : 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
