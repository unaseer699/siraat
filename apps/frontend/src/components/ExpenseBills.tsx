'use client';

import { useRef, useState } from 'react';
import { attachBill, deleteBill, setBillVisibility, type ExpenseBill } from '@/lib/api';

const BTN = { fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: '#fff', cursor: 'pointer' } as const;

// Bills and invoices for one expense (admin). Optional: an expense with no
// bill just shows "Attach bill".
export default function ExpenseBills({
  projectId,
  expenseId,
  bills,
  onChanged,
}: {
  projectId: string;
  expenseId: string;
  bills: ExpenseBill[];
  onChanged: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^API error \d+: /, '') : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {bills.map((b) => (
        <div key={b.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', fontSize: '11px' }}>
          <span>📎</span>
          {b.download_url ? (
            <a href={b.download_url} target="_blank" rel="noreferrer">{b.filename}</a>
          ) : (
            <span>{b.filename}</span>
          )}
          <label style={{ color: 'var(--muted)', display: 'flex', gap: '3px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={b.visible_to_owner}
              disabled={busy}
              onChange={(e) => run(() => setBillVisibility(projectId, b.id, e.target.checked))}
            />
            show to owner
          </label>
          <button type="button" disabled={busy} style={BTN} onClick={() => run(() => deleteBill(projectId, b.id), `Remove ${b.filename}?`)}>
            Remove
          </button>
        </div>
      ))}
      <div>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void run(() => attachBill(projectId, expenseId, f, false));
          }}
        />
        <button type="button" disabled={busy} style={BTN} onClick={() => input.current?.click()}>
          {busy ? 'Working…' : bills.length ? '+ Another bill' : '+ Attach bill'}
        </button>
        {bills.length === 0 && <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '6px' }}>no bill</span>}
      </div>
      {error && <span style={{ fontSize: '11px', color: 'var(--error)' }}>{error}</span>}
    </div>
  );
}
