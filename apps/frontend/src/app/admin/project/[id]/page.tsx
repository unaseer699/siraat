'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import type { TradeCategory } from '@siraat/shared-types';
import {
  fetchProject,
  createProjectSection,
  createSectionExpense,
  searchContractorsByName,
  searchSuppliers,
  type ProjectWithSectionsAndExpenses,
  type ExpenseResult,
  type CreateExpenseBody,
} from '@/lib/api';
import { TRADE_CATEGORY_OPTIONS } from '@/lib/tradeCategories';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { fieldGroupStyle, inputStyle, labelStyle } from '../../constants';
import { AdminNav } from '../../AdminNav';
import { TRUST_GREEN, RADIUS } from '@/styles/tokens';

interface Props {
  params: { id: string };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

function tradeLabel(value: string): string {
  return TRADE_CATEGORY_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

// ─── PROJECT COST TRACKER Chunk 2 — vendor directory link (optional) ───────
// Generic over Contractor/Supplier search rather than two near-duplicate
// components — mirrors DeveloperSearchField (new-society/page.tsx) and
// SupplierSearchField (material-rates/page.tsx), parameterized by which
// endpoint to hit.
type LinkType = 'NONE' | 'CONTRACTOR' | 'SUPPLIER';

function VendorLinkPicker({
  linkType,
  onLinkTypeChange,
  query,
  onQueryChange,
  linkedId,
  onSelect,
  onClear,
}: {
  linkType: LinkType;
  onLinkTypeChange: (t: LinkType) => void;
  query: string;
  onQueryChange: (v: string) => void;
  linkedId: string | null;
  onSelect: (r: { id: string; name: string }) => void;
  onClear: () => void;
}) {
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (linkType === 'NONE' || !trimmed || linkedId) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const found =
          linkType === 'CONTRACTOR' ? await searchContractorsByName(trimmed) : await searchSuppliers(trimmed);
        if (id === requestId.current) setResults(found);
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, linkType, linkedId]);

  const showDropdown = linkType !== 'NONE' && !linkedId && query.trim().length > 0 && (searching || results.length > 0);

  return (
    <div style={{ ...fieldGroupStyle, position: 'relative' }}>
      <label style={labelStyle}>Link to directory (optional)</label>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {(['NONE', 'CONTRACTOR', 'SUPPLIER'] as LinkType[]).map((t) => (
          <label key={t} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="radio"
              name="link-type"
              checked={linkType === t}
              onChange={() => {
                onLinkTypeChange(t);
                onClear();
                onQueryChange('');
              }}
            />
            {t === 'NONE' ? 'None' : t === 'CONTRACTOR' ? 'Contractor' : 'Supplier'}
          </label>
        ))}
      </div>

      {linkType !== 'NONE' && (
        <>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={`Search ${linkType === 'CONTRACTOR' ? 'contractors' : 'suppliers'}…`}
              autoComplete="off"
              style={{ ...inputStyle, flex: 1 }}
            />
            {linkedId && (
              <button type="button" onClick={onClear} style={smallClearButtonStyle}>
                Clear
              </button>
            )}
          </div>
          {linkedId && <p style={{ fontSize: '12px', color: '#166534' }}>✓ Linked</p>}
          {showDropdown && (
            <ul style={dropdownStyle}>
              {searching && <li style={dropdownItemStyle}>Searching…</li>}
              {!searching && results.length === 0 && <li style={dropdownItemStyle}>No matches</li>}
              {!searching &&
                results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(r)}
                      onMouseDown={(e) => e.preventDefault()}
                      style={dropdownButtonStyle}
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ─── Expense entry form — used for both "+ Add Expense" and "+ Correction" ──
// Same form either way: a correction is just another createExpense call with
// a pre-filled description and a hint about the sign convention, NEVER an
// edit path (Law 3: FACT records are immutable — see ProjectExpenseEntity).

interface ExpenseDraft {
  expense_date: string;
  description: string;
  vendor_name: string;
  vendor_contact: string;
  amount: string;
}

function ExpenseForm({
  initial,
  correctionHint,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  initial: ExpenseDraft;
  correctionHint: boolean;
  onSubmit: (data: CreateExpenseBody) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<ExpenseDraft>(initial);
  const [linkType, setLinkType] = useState<LinkType>('NONE');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkedId, setLinkedId] = useState<string | null>(null);

  const amountNum = Number(draft.amount);
  const amountValid = draft.amount.trim().length > 0 && Number.isFinite(amountNum);
  const canSubmit =
    draft.description.trim().length > 0 && draft.vendor_name.trim().length > 0 && draft.expense_date.length > 0 && amountValid;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      expense_date: draft.expense_date,
      description: draft.description.trim(),
      vendor_name: draft.vendor_name.trim(),
      vendor_contact: draft.vendor_contact.trim() || null,
      linked_contractor_id: linkType === 'CONTRACTOR' ? linkedId : null,
      linked_supplier_id: linkType === 'SUPPLIER' ? linkedId : null,
      amount: amountNum,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px',
        background: '#f9fafb',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      {correctionHint && (
        <p
          style={{
            fontSize: '12px',
            color: '#92400e',
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            borderRadius: '4px',
            padding: '8px 10px',
            margin: 0,
          }}
        >
          Adding a correcting entry — this does not edit the original expense. Use a negative
          amount to reduce a prior total.
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '140px' }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={draft.expense_date}
            onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '140px' }}>
          <label style={labelStyle}>Amount (PKR)</label>
          <input
            type="number"
            step="any"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            placeholder={correctionHint ? 'e.g. -5000' : 'e.g. 45000'}
            required
            style={inputStyle}
          />
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Description</label>
        <input
          type="text"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          required
          autoFocus
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Vendor name</label>
          <input
            type="text"
            value={draft.vendor_name}
            onChange={(e) => setDraft({ ...draft, vendor_name: e.target.value })}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Vendor contact (optional)</label>
          <input
            type="text"
            value={draft.vendor_contact}
            onChange={(e) => setDraft({ ...draft, vendor_contact: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <VendorLinkPicker
        linkType={linkType}
        onLinkTypeChange={setLinkType}
        query={linkQuery}
        onQueryChange={(v) => {
          setLinkQuery(v);
          setLinkedId(null);
        }}
        linkedId={linkedId}
        onSelect={(r) => {
          setLinkedId(r.id);
          setLinkQuery(r.name);
        }}
        onClear={() => {
          setLinkedId(null);
          setLinkQuery('');
        }}
      />

      {error && <p style={{ fontSize: '12px', color: 'var(--error)', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={submitting || !canSubmit} style={primaryButtonStyle(submitting || !canSubmit)}>
          {submitting ? 'Saving…' : correctionHint ? 'Add correction' : 'Add expense'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} style={plainButtonStyle}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ExpenseRow({
  expense,
  onCorrect,
}: {
  expense: ExpenseResult;
  onCorrect: () => void;
}) {
  const isCorrection = expense.amount < 0;
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={tdStyle}>{expense.expense_date}</td>
      <td style={tdStyle}>{expense.description}</td>
      <td style={tdStyle}>
        {expense.vendor_name}
        {(expense.linked_contractor_id || expense.linked_supplier_id) && (
          <span style={{ fontSize: '11px', color: TRUST_GREEN, marginLeft: '6px' }}>✓ linked</span>
        )}
      </td>
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: isCorrection ? 'var(--error)' : 'var(--text)' }}>
        {isCorrection ? '−' : ''}
        {formatPKR(Math.abs(expense.amount))}
      </td>
      <td style={tdStyle}>
        <button onClick={onCorrect} style={correctionButtonStyle}>
          + Correction
        </button>
      </td>
    </tr>
  );
}

export default function AdminProjectPage({ params }: Props) {
  const [project, setProject] = useState<ProjectWithSectionsAndExpenses | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addingSection, setAddingSection] = useState(false);
  const [newSectionCategory, setNewSectionCategory] = useState<TradeCategory>(TRADE_CATEGORY_OPTIONS[0].value);
  const [sectionSubmitting, setSectionSubmitting] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const [activeForm, setActiveForm] = useState<{
    sectionId: string;
    initial: ExpenseDraft;
    correctionHint: boolean;
  } | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProject(params.id)
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

  async function handleAddSection(e: FormEvent) {
    e.preventDefault();
    if (!project) return;
    setSectionSubmitting(true);
    setSectionError(null);
    try {
      const section = await createProjectSection(project.id, {
        category: newSectionCategory,
        display_order: project.sections.length,
      });
      setProject({ ...project, sections: [...project.sections, { ...section, expenses: [], subtotal: 0 }] });
      setAddingSection(false);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Failed to add section');
    } finally {
      setSectionSubmitting(false);
    }
  }

  async function handleAddExpense(sectionId: string, data: CreateExpenseBody) {
    setExpenseSubmitting(true);
    setExpenseError(null);
    try {
      const expense = await createSectionExpense(sectionId, data);
      // Applied locally rather than refetching the whole nested tree — this
      // form gets used repeatedly in one sitting (WhatsApp-relay entry), so
      // speed matters more here than anywhere else in the admin.
      setProject((prev) => {
        if (!prev) return prev;
        const sections = prev.sections.map((s) =>
          s.id === sectionId ? { ...s, expenses: [...s.expenses, expense], subtotal: s.subtotal + expense.amount } : s,
        );
        return { ...prev, sections, total: prev.total + expense.amount };
      });
      setActiveForm(null);
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setExpenseSubmitting(false);
    }
  }

  function openAddExpense(sectionId: string) {
    setExpenseError(null);
    setActiveForm({
      sectionId,
      correctionHint: false,
      initial: { expense_date: todayIso(), description: '', vendor_name: '', vendor_contact: '', amount: '' },
    });
  }

  function openCorrection(sectionId: string, expense: ExpenseResult) {
    setExpenseError(null);
    setActiveForm({
      sectionId,
      correctionHint: true,
      initial: {
        expense_date: todayIso(),
        description: `Correction: ${expense.description}`,
        vendor_name: expense.vendor_name,
        vendor_contact: expense.vendor_contact ?? '',
        amount: '',
      },
    });
  }

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
        <div style={{ maxWidth: '900px', width: '100%' }}>
          <AdminNav active="projects" />
          <div style={{ marginTop: '20px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '14px' }}>
            {error ?? 'Project not found'}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <AdminNav active="projects" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
              ADMIN — INTERNAL ONLY
            </p>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>{project.name}</h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
              {project.owner_contact} · Started {project.start_date} · {project.status.replace('_', ' ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href={`/project/${project.id}`} style={plainButtonLinkStyle}>
              View dashboard →
            </Link>
            <CopyLinkButton
              label="Copy dashboard link"
              text={typeof window !== 'undefined' ? `${window.location.origin}/project/${project.id}` : ''}
            />
          </div>
        </div>

        <div
          style={{
            background: '#111',
            color: '#fff',
            borderRadius: RADIUS.md,
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8 }}>RUNNING TOTAL</span>
          <span style={{ fontSize: '28px', fontWeight: 800 }}>{formatPKR(project.total)}</span>
        </div>

        {project.sections.length === 0 && !addingSection && (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No sections yet — add the first one below.</p>
        )}

        {project.sections.map((section) => (
          <div key={section.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: RADIUS.md, overflow: 'hidden' }}>
            <div
              style={{
                padding: '14px 18px',
                background: '#f9fafb',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <h2 style={{ fontSize: '15px', fontWeight: 700 }}>{tradeLabel(section.category)}</h2>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{formatPKR(section.subtotal)}</span>
            </div>

            {section.expenses.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: '#fff' }}>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Vendor</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.expenses.map((expense) => (
                      <ExpenseRow key={expense.id} expense={expense} onCorrect={() => openCorrection(section.id, expense)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ padding: '12px 18px' }}>
              {activeForm?.sectionId === section.id ? (
                <ExpenseForm
                  initial={activeForm.initial}
                  correctionHint={activeForm.correctionHint}
                  onSubmit={(data) => handleAddExpense(section.id, data)}
                  onCancel={() => setActiveForm(null)}
                  submitting={expenseSubmitting}
                  error={expenseError}
                />
              ) : (
                <button onClick={() => openAddExpense(section.id)} style={plainButtonStyle}>
                  + Add Expense
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={{ background: '#fff', border: '1px dashed var(--border)', borderRadius: RADIUS.md, padding: '16px 18px' }}>
          {addingSection ? (
            <form onSubmit={handleAddSection} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '200px' }}>
                <label style={labelStyle}>Category</label>
                <select value={newSectionCategory} onChange={(e) => setNewSectionCategory(e.target.value as TradeCategory)} style={inputStyle}>
                  {TRADE_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={sectionSubmitting} style={primaryButtonStyle(sectionSubmitting)}>
                {sectionSubmitting ? 'Adding…' : 'Add section'}
              </button>
              <button type="button" onClick={() => setAddingSection(false)} disabled={sectionSubmitting} style={plainButtonStyle}>
                Cancel
              </button>
              {sectionError && <p style={{ fontSize: '12px', color: 'var(--error)', width: '100%' }}>{sectionError}</p>}
            </form>
          ) : (
            <button onClick={() => setAddingSection(true)} style={plainButtonStyle}>
              + Add Section
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 16px 48px',
};

const thStyle: CSSProperties = { padding: '8px 12px', fontWeight: 700, fontSize: '11px', color: 'var(--muted)' };
const tdStyle: CSSProperties = { padding: '8px 12px', verticalAlign: 'middle' };

const plainButtonStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  padding: '8px 14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  cursor: 'pointer',
};

const plainButtonLinkStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  textDecoration: 'none',
  color: 'var(--text)',
};

const smallClearButtonStyle: CSSProperties = {
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  fontSize: '13px',
  color: 'var(--muted)',
  cursor: 'pointer',
};

const correctionButtonStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--muted)',
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '4px 8px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 10,
  margin: 0,
  marginTop: '4px',
  padding: '4px',
  listStyle: 'none',
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  maxHeight: '220px',
  overflowY: 'auto',
};

const dropdownItemStyle: CSSProperties = { padding: '8px 10px', fontSize: '13px', color: 'var(--muted)' };

const dropdownButtonStyle: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  border: 'none',
  background: 'transparent',
  fontSize: '14px',
  cursor: 'pointer',
  borderRadius: '6px',
};

function primaryButtonStyle(disabled: boolean): CSSProperties {
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
