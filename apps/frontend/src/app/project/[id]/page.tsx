'use client';

import { projectIdFromParam } from '@/lib/projectSlug';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  fetchProjectDashboard,
  fetchOwnerBills,
  type ExpenseBill,
  type ProjectWithSectionsAndExpenses,
  type ExpenseResult,
} from '@/lib/api';
import { sectionLabel } from '@/lib/sectionCategories';
import { RADIUS } from '@/styles/tokens';
import WhatsappBadge from '@/components/WhatsappBadge';
import VendorLabel from '@/components/VendorLabel';
import Boq5MarlaPanel from '@/components/Boq5MarlaPanel';
import ForecastCard from '@/components/ForecastCard';
import ProjectDocumentsCard from '@/components/ProjectDocumentsCard';

interface Props {
  params: { id: string };
}

function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

function tradeLabel(value: string): string {
  return sectionLabel(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

// PROJECT COST TRACKER Chunk 2 — flex rows, not a <table>. The admin
// management page can afford a horizontally-scrollable table (internal
// tooling); this page is explicitly the one most likely to get checked from
// a phone on-site, so line items wrap naturally at narrow widths instead.
function ExpenseLine({ expense, bills }: { expense: ExpenseResult; bills: ExpenseBill[] }) {
  const isCorrection = expense.amount < 0;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 0',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{expense.description}</span>
          {expense.source === 'WHATSAPP' && <WhatsappBadge />}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          <VendorLabel vendor_name={expense.vendor_name} source={expense.source} />{expense.paid_by ? ` · paid by ${expense.paid_by}` : ''} · {formatDate(expense.expense_date)}
        </span>
        {bills.length > 0 && (
          <span style={{ fontSize: '12px' }}>
            {bills.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ' · '}
                {b.download_url ? (
                  <a href={b.download_url} target="_blank" rel="noreferrer" className="no-print">
                    📎 Bill{bills.length > 1 ? ` ${i + 1}` : ''}
                  </a>
                ) : null}
              </span>
            ))}
            <span className="print-only" style={{ color: 'var(--muted)' }}>
              Bill attached{bills.length > 1 ? ` (${bills.length})` : ''}
            </span>
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: isCorrection ? 'var(--error)' : 'var(--text)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {isCorrection ? '−' : ''}
        {formatPKR(Math.abs(expense.amount))}
      </span>
    </div>
  );
}

// Native <details>/<summary> — collapsible at any viewport with zero JS,
// defaults open so nothing is hidden on first load.
function SectionCard({ section, bills }: { section: ProjectWithSectionsAndExpenses['sections'][number]; bills: ExpenseBill[] }) {
  return (
    <details
      open
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          padding: '14px 16px',
          background: '#f9fafb',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          listStyle: 'none',
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 700 }}>{tradeLabel(section.category)}</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{formatPKR(section.subtotal)}</span>
      </summary>
      <div style={{ padding: '4px 16px 12px' }}>
        {section.expenses.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)', padding: '10px 0' }}>No expenses in this section.</p>
        ) : (
          section.expenses.map((e) => <ExpenseLine key={e.id} expense={e} bills={bills.filter((b) => b.expense_ref === e.id)} />)
        )}
      </div>
    </details>
  );
}

export default function ProjectDashboardPage({ params: routeParams }: Props) {
  // The URL may carry the project name before the id (see lib/projectSlug.ts).
  const params = { id: projectIdFromParam(routeParams.id) };
  const [project, setProject] = useState<ProjectWithSectionsAndExpenses | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bills, setBills] = useState<ExpenseBill[]>([]);
  const [sectionFilter, setSectionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchProjectDashboard(params.id)
      .then((data) => {
        if (!cancelled) setProject(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load project');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    fetchOwnerBills(params.id).then(setBills).catch(() => setBills([]));
  }, [params.id]);

  // Filters affect which line items are shown, not the headline running
  // total above — that always reflects the whole project, matching the real
  // sheet. Kept deliberately simple per the "nice-to-have" scope note.
  const filteredSections = useMemo(() => {
    if (!project) return [];
    return project.sections
      .filter((s) => !sectionFilter || s.category === sectionFilter)
      .map((s) => ({
        ...s,
        expenses: s.expenses.filter((e) => {
          if (dateFrom && e.expense_date < dateFrom) return false;
          if (dateTo && e.expense_date > dateTo) return false;
          return true;
        }),
      }));
  }, [project, sectionFilter, dateFrom, dateTo]);

  const hasFilters = Boolean(sectionFilter || dateFrom || dateTo);
  const showBoq = project?.boq_template === '5_MARLA';
  const usedCategories = Array.from(new Set((project?.sections ?? []).map((s) => s.category)));

  if (loading) {
    return (
      <main style={pageStyle}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading…</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main style={pageStyle}>
        <p style={{ color: 'var(--error)', fontSize: '14px' }}>{error ?? 'Project not found'}</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <style>{PRINT_CSS}</style>
      <div style={{ width: '100%', maxWidth: showBoq ? '1080px' : '640px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ flex: '1 1 440px', maxWidth: '640px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <p className="print-only" style={{ fontSize: '11px', letterSpacing: '0.06em', fontWeight: 700 }}>
              SIRAAT · PROJECT COST REPORT · {formatDate(new Date().toISOString())}
            </p>
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>{project.name}</h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
              Started {formatDate(project.start_date)} · {project.status.replace('_', ' ')}
            </p>
          </div>
          <button type="button" className="no-print" onClick={() => window.print()} style={printButtonStyle}>
            Download / Print PDF
          </button>
        </div>

        <div
          style={{
            background: '#111',
            color: '#fff',
            borderRadius: RADIUS.md,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8, letterSpacing: '0.04em' }}>RUNNING TOTAL</span>
          <span style={{ fontSize: '30px', fontWeight: 800 }}>{formatPKR(project.total)}</span>
          {project.whatsapp_activity.confirmed_count > 0 && (
            <span style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
              {project.whatsapp_activity.confirmed_count}{' '}
              {project.whatsapp_activity.confirmed_count === 1 ? 'expense' : 'expenses'} (
              {formatPKR(project.whatsapp_activity.total_amount)}) added via WhatsApp
            </span>
          )}
        </div>

        <ForecastCard projectId={project.id} />

        {usedCategories.length > 1 && (
          <div className="no-print" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              style={filterSelectStyle}
            >
              <option value="">All sections</option>
              {usedCategories.map((c) => (
                <option key={c} value={c}>
                  {tradeLabel(c)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={filterSelectStyle}
              aria-label="From date"
            />
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={filterSelectStyle}
              aria-label="To date"
            />
            {hasFilters && (
              <button
                onClick={() => {
                  setSectionFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}
                style={clearFiltersButtonStyle}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {filteredSections.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
            {hasFilters ? 'No expenses match these filters.' : 'No sections recorded yet.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredSections.map((s) => (
              <SectionCard key={s.id} section={s} bills={bills} />
            ))}
          </div>
        )}
        <div className="no-print" style={{ marginTop: '16px' }}>
          <ProjectDocumentsCard projectId={project.id} />
        </div>
      </div>
      {showBoq && (
        <div style={{ flex: '1 1 320px', maxWidth: '420px', minWidth: 0, position: 'sticky', top: '16px' }}>
          <Boq5MarlaPanel />
        </div>
      )}
      </div>
    </main>
  );
}

// Print / Save-as-PDF: the browser prints the page exactly as shown (current
// filters included) minus the controls. Users choose "Save as PDF" in the
// print dialog to download.
const PRINT_CSS = `
.print-only { display: none; }
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; margin-bottom: 6px; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  main { padding: 0 !important; min-height: 0 !important; }
  details > summary { list-style: none; }
  details { break-inside: avoid; }
}
@page { margin: 14mm; }
`;

const printButtonStyle: CSSProperties = {
  padding: '8px 14px',
  background: '#111',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '64px 16px 32px',
};

const filterSelectStyle: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '13px',
  background: '#fff',
};

const clearFiltersButtonStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--muted)',
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '6px 10px',
  cursor: 'pointer',
};
