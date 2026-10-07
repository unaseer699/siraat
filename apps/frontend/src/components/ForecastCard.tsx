'use client';

import { useEffect, useState } from 'react';
import { fetchOwnerForecast, type ProjectForecast } from '@/lib/api';

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

// Forecast of the final cost for the owner. Only shown once the project's
// layout has been confirmed; it moves as real expenses and real rates arrive.
export default function ForecastCard({ projectId }: { projectId: string }) {
  const [fc, setFc] = useState<ProjectForecast | null>(null);

  useEffect(() => {
    fetchOwnerForecast(projectId)
      .then((r) => setFc(r.state === 'FULL' ? (r as ProjectForecast) : null))
      .catch(() => setFc(null));
  }, [projectId]);

  if (!fc) return null;
  const pct = fc.forecast_total > 0 ? Math.min(100, Math.round((fc.spent_total / fc.forecast_total) * 100)) : 0;
  const over = fc.spent_total > fc.estimated_total && fc.estimated_total > 0;
  const rows = fc.groups.filter((g) => g.estimated !== null || g.spent > 0);

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff' }}>
      <h2 style={{ fontSize: '16px', margin: '0 0 2px' }}>Forecasted cost</h2>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px' }}>
        {fc.layout ? `${fc.layout.total_area_sqft.toLocaleString()} sq ft covered · ${fc.layout.finish_level.toLowerCase()} finish` : ''}
      </p>
      <div style={{ fontSize: '26px', fontWeight: 800 }}>{pkr(fc.forecast_total)}</div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
        expected final cost{fc.per_sqft ? ` · about ${pkr(fc.per_sqft)} per sq ft` : ''}
      </div>
      <div style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: over ? '#b45309' : '#111' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0 12px' }}>
        <span>Spent {pkr(fc.spent_total)} ({pct}%)</span>
        <span>Remaining {pkr(Math.max(fc.forecast_total - fc.spent_total, 0))}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'left' }}>
            <th style={{ padding: '4px 0' }}>Group</th><th>Done</th><th>Spent</th><th>Forecast</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.group} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '6px 0' }}>{g.label}</td>
              <td>{g.progress_pct !== null ? `${Math.round(g.progress_pct)}%` : '—'}</td>
              <td>{pkr(g.spent)}</td>
              <td>{pkr(g.forecast_at_completion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fc.rate_observations.length > 0 && fc.structure_index_applied && (
        <p style={{ fontSize: '12px', margin: '10px 0 0' }}>
          Adjusted for the prices actually paid:{' '}
          {fc.rate_observations.map((o) => `${o.label} ${o.ratio >= 1 ? '+' : ''}${Math.round((o.ratio - 1) * 100)}%`).join(', ')}.
        </p>
      )}
      <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '8px 0 0' }}>
        An estimate, not a quote. It is based on a completed house of similar size, and updates as real expenses and prices are recorded.
        {fc.is_stale ? ' Reference prices are older than 90 days.' : ''} Confidence {Math.round(fc.confidence_score * 100)}%.
      </p>
    </section>
  );
}
