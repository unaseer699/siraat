'use client';

import { useState } from 'react';
import { setContractorVerified, setSupplierVerified } from '@/lib/api';

// Tick to mark a contractor or supplier verified, from the admin lists.
// Ticking asks how it was checked (kept as the proof); unticking asks to confirm.
export function VerifiedToggle({ kind, id, initial }: { kind: 'contractor' | 'supplier'; id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    let note: string | undefined;
    if (next) {
      const answer = window.prompt('How did you verify? (e.g. visited a finished house, met in person)');
      if (!answer || !answer.trim()) return;
      note = answer.trim();
    } else if (!window.confirm('Remove the verified mark? It is kept in the history.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await (kind === 'contractor' ? setContractorVerified : setSupplierVerified)(id, next, note);
      setOn(next);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API error \d+: /, '') : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: on ? '#166534' : 'var(--text)', cursor: busy ? 'wait' : 'pointer' }}>
      <input type="checkbox" checked={on} disabled={busy} onChange={(e) => change(e.target.checked)} style={{ width: '18px', height: '18px' }} />
      Verified
      {error && <span style={{ color: 'var(--error)', fontWeight: 500, fontSize: '12px' }}>{error}</span>}
    </label>
  );
}
