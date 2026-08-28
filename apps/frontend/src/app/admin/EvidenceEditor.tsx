'use client';

import type { AdminEvidenceItem, EvidenceType, DocumentType } from '@/lib/api';
import { EVIDENCE_TYPE_OPTIONS, DOCUMENT_TYPE_OPTIONS, fieldGroupStyle, inputStyle, labelStyle } from './constants';

/**
 * Dynamic list editor for evidence items, mirroring the `collectEvidence` /
 * evidence-loop prompts in scripts/prompts.ts used by the admin CLI tools.
 */
export function EvidenceEditor({
  items,
  onChange,
  required,
}: {
  items: AdminEvidenceItem[];
  onChange: (items: AdminEvidenceItem[]) => void;
  required: boolean;
}) {
  function addItem() {
    onChange([
      ...items,
      { type: 'document', file_ref: '', source_ref: '', document_date: null, document_type: null },
    ]);
  }

  function updateItem(index: number, patch: Partial<AdminEvidenceItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <label style={labelStyle}>
        Evidence {required ? '(at least one required)' : '(optional)'}
      </label>

      {items.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No evidence items added yet.</p>
      )}

      {items.map((item, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
              Evidence #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeItem(i)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--error)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Remove
            </button>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Type</label>
            <select
              value={item.type}
              onChange={(e) => updateItem(i, { type: e.target.value as EvidenceType })}
              style={inputStyle}
            >
              {EVIDENCE_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>File reference</label>
            <input
              type="text"
              value={item.file_ref}
              onChange={(e) => updateItem(i, { file_ref: e.target.value })}
              placeholder="e.g. trust/society/noc.pdf"
              style={inputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Source reference</label>
            <input
              type="text"
              value={item.source_ref}
              onChange={(e) => updateItem(i, { source_ref: e.target.value })}
              placeholder="e.g. CDA Portal — NOC No. X"
              style={inputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Document type (optional)</label>
            <select
              value={item.document_type ?? ''}
              onChange={(e) => updateItem(i, { document_type: (e.target.value || null) as DocumentType | null })}
              style={inputStyle}
            >
              <option value="">—</option>
              {DOCUMENT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Document date (optional)</label>
            <input
              type="date"
              value={item.document_date ?? ''}
              onChange={(e) => updateItem(i, { document_date: e.target.value || null })}
              style={inputStyle}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
              The date on the document itself, not today&apos;s date.
            </p>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        style={{
          padding: '8px 14px',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        + Add evidence item
      </button>
    </div>
  );
}
