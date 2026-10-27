'use client';

import { useEffect, useState } from 'react';
import { fetchWhatsappAccounts, setWhatsappAccountPlan, type WhatsappAccount, type WhatsappPlan } from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { plainButtonStyle, primaryButtonStyle } from '../buttonStyles';

const cell = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '13px', verticalAlign: 'middle' } as const;

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function planLabel(a: WhatsappAccount): { text: string; color: string } {
  if (a.plan === 'BLOCKED') return { text: 'Blocked', color: '#b91c1c' };
  if (a.plan === 'PAID') {
    return a.is_active_paid
      ? { text: `Paid until ${fmt(a.paid_until)}`, color: '#166534' }
      : { text: `Paid — expired ${fmt(a.paid_until)}`, color: '#b45309' };
  }
  return { text: 'Free trial', color: '#1d4ed8' };
}

export default function AdminWhatsappPlansPage() {
  const [rows, setRows] = useState<WhatsappAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newWa, setNewWa] = useState('');
  const [newDays, setNewDays] = useState('30');

  function load() {
    fetchWhatsappAccounts()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }
  useEffect(load, []);

  async function act(wa: string, body: Parameters<typeof setWhatsappAccountPlan>[0]) {
    setBusy(wa);
    setError(null);
    try {
      await setWhatsappAccountPlan(body);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API error \d+: /, '') : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  async function grantNew() {
    const wa = newWa.replace(/\D/g, '');
    const days = Number(newDays);
    if (wa.length < 6) return setError('Enter the WhatsApp number with country code, digits only (e.g. 923001234567)');
    if (!(days > 0)) return setError('Enter a number of days');
    await act(wa, { wa_id: wa, plan: 'PAID', paid_until: inDays(days) });
    setNewWa('');
  }

  const btn = (disabled: boolean) => ({ ...plainButtonStyle, padding: '4px 10px', fontSize: '12px', opacity: disabled ? 0.5 : 1 });

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <AdminNav active="whatsapp-plans" />
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADMIN — INTERNAL ONLY</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>WhatsApp Plans</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            People who start a live project from WhatsApp get a free trial. Give a number the paid plan here once they pay. Your own numbers and numbers you linked by hand are never limited.
          </p>
        </div>
        {error && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</p>}

        <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Give a number the paid plan</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              aria-label="WhatsApp number"
              value={newWa}
              onChange={(e) => setNewWa(e.target.value)}
              placeholder="923001234567"
              style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', minWidth: '200px' }}
            />
            <input
              aria-label="Days"
              inputMode="numeric"
              value={newDays}
              onChange={(e) => setNewDays(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', width: '70px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>days</span>
            <button style={primaryButtonStyle(busy !== null)} disabled={busy !== null} onClick={grantNew}>
              Give paid plan
            </button>
          </div>
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '12px', color: 'var(--muted)' }}>
                <th style={cell}>Number</th>
                <th style={cell}>Plan</th>
                <th style={cell}>Expenses used</th>
                <th style={cell}>Projects</th>
                <th style={cell}>Joined</th>
                <th style={cell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr><td style={cell} colSpan={6}>Loading…</td></tr>
              )}
              {rows?.length === 0 && (
                <tr><td style={cell} colSpan={6}>No one has started a live project yet.</td></tr>
              )}
              {rows?.map((a) => {
                const pl = planLabel(a);
                const disabled = busy === a.wa_id;
                const set = (plan: WhatsappPlan, extra: { paid_until?: string | null; trial_expense_limit?: number } = {}) =>
                  act(a.wa_id, { wa_id: a.wa_id, plan, ...extra });
                const nearLimit = a.plan === 'TRIAL' && a.expenses_used >= a.trial_expense_limit;
                return (
                  <tr key={a.id}>
                    <td style={{ ...cell, fontWeight: 600 }}>{a.wa_id}</td>
                    <td style={{ ...cell, color: pl.color, fontWeight: 600 }}>{pl.text}</td>
                    <td style={{ ...cell, color: nearLimit ? '#b91c1c' : undefined }}>
                      {a.expenses_used}
                      {a.plan === 'TRIAL' ? ` / ${a.trial_expense_limit}` : ''}
                    </td>
                    <td style={cell}>{a.projects}</td>
                    <td style={cell}>{fmt(a.created_at)}</td>
                    <td style={{ ...cell, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button style={btn(disabled)} disabled={disabled} onClick={() => set('PAID', { paid_until: inDays(30) })}>
                        Paid 30 days
                      </button>
                      <button style={btn(disabled)} disabled={disabled} onClick={() => set('PAID', { paid_until: inDays(365) })}>
                        Paid 1 year
                      </button>
                      {a.plan === 'TRIAL' && (
                        <button style={btn(disabled)} disabled={disabled} onClick={() => set('TRIAL', { trial_expense_limit: a.trial_expense_limit + 25 })}>
                          +25 trial expenses
                        </button>
                      )}
                      {a.plan === 'BLOCKED' ? (
                        <button style={btn(disabled)} disabled={disabled} onClick={() => set('TRIAL')}>
                          Unblock
                        </button>
                      ) : (
                        <button
                          style={{ ...btn(disabled), color: 'var(--error)' }}
                          disabled={disabled}
                          onClick={() => window.confirm(`Block ${a.wa_id}?`) && set('BLOCKED')}
                        >
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
