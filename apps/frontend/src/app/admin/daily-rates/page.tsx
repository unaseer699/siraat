'use client';

import { useEffect, useState } from 'react';
import { fetchMarketRates, saveMarketRates, type MarketRatesView } from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { plainButtonStyle, primaryButtonStyle } from '../buttonStyles';

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

const cell = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: '13px' } as const;

export default function AdminDailyRatesPage() {
  const [view, setView] = useState<MarketRatesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function load() {
    fetchMarketRates(14)
      .then((v) => {
        setView(v);
        setDate((d) => d || v.today);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }
  useEffect(load, []);

  async function save() {
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim() === '') continue;
      const n = Number(v.replace(/,/g, ''));
      if (!(n > 0)) return setError(`${k}: enter a number`);
      rates[k] = n;
    }
    if (Object.keys(rates).length === 0) return setError('Enter at least one rate');
    setBusy(true);
    setError(null);
    try {
      setView(await saveMarketRates(date, rates));
      setValues({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const template = view?.template.replace('DD-MM-YYYY', view ? fmtDate(view.today) : 'DD-MM-YYYY') ?? '';

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <AdminNav active="daily-rates" />
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADMIN — INTERNAL ONLY</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Daily Market Rates</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Rates sent by WhatsApp (or entered here) price the cost forecast. A day with no new rate keeps the previous day&apos;s rate.
          </p>
        </div>
        {error && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</p>}

        <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>WhatsApp message template</h2>
          <pre style={{ background: '#f6f6f6', padding: '10px', borderRadius: '4px', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{template}</pre>
          <button
            style={{ ...plainButtonStyle, marginTop: '8px' }}
            onClick={() => {
              navigator.clipboard?.writeText(template).then(() => setCopied(true)).catch(() => undefined);
            }}
          >
            {copied ? 'Copied' : 'Copy template'}
          </button>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
            Send it from your own number. Drop any line you have no new rate for. Steel can be per kg or per ton. The date defaults to today if left out.
          </p>
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Current rates</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '12px', color: 'var(--muted)' }}>
                <th style={cell}>Item</th><th style={cell}>Rate</th><th style={cell}>From</th><th style={cell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {view?.items.map((i) => {
                const c = view.current.find((x) => x.key === i.key);
                return (
                  <tr key={i.key}>
                    <td style={cell}>{i.label}</td>
                    <td style={cell}>{c ? `Rs ${c.rate.toLocaleString()} /${c.unit}` : '—'}</td>
                    <td style={cell}>{c ? fmtDate(c.rate_date) : 'no rate yet'}</td>
                    <td style={{ ...cell, color: c?.carried_forward ? '#b45309' : undefined }}>
                      {c ? (c.carried_forward ? `carried forward (${c.age_days} day${c.age_days === 1 ? '' : 's'} old)` : 'updated today') : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Enter rates here instead</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: '12px' }}>Date<br />
              <input type="date" value={date} max={view?.today} onChange={(e) => setDate(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px' }} />
            </label>
            {view?.items.map((i) => (
              <label key={i.key} style={{ fontSize: '12px' }}>{i.label} (/{i.unit})<br />
                <input
                  inputMode="decimal"
                  value={values[i.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [i.key]: e.target.value })}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', width: '90px' }}
                />
              </label>
            ))}
            <button style={primaryButtonStyle(busy)} disabled={busy} onClick={save}>Save rates</button>
          </div>
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff', overflowX: 'auto' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Last 14 days</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '12px', color: 'var(--muted)' }}>
                <th style={cell}>Date</th>
                {view?.items.map((i) => <th key={i.key} style={cell}>{i.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {view?.history.map((h) => (
                <tr key={h.date}>
                  <td style={cell}>{fmtDate(h.date)}</td>
                  {view.items.map((i) => {
                    const r = h.rates[i.key];
                    return (
                      <td key={i.key} style={{ ...cell, color: r?.carried_forward ? 'var(--muted)' : undefined }}>
                        {r ? `${r.rate.toLocaleString()}${r.carried_forward ? ' ↺' : ''}` : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>↺ means no new rate that day, so the previous day&apos;s rate was kept.</p>
        </section>
      </div>
    </main>
  );
}
