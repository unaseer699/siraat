'use client';

import { useState } from 'react';
import type { EvidenceItem, DocumentType } from '@siraat/shared-types';
import { fetchEvidenceDownloadUrl } from '@/lib/api';

interface Props {
  // Always one claim's evidence — every caller already scopes this drawer to
  // a single ClaimCard/Verification (society/contractor/supplier/developer
  // profile pages, property page's linked-society evidence). The CDA-style
  // "grouped by claim" structure this chunk asks for is therefore already
  // the page-level architecture; this component only had to redesign the
  // per-item row inside one claim's group.
  evidence: EvidenceItem[];
  triggerLabel?: string;
}

const TYPE_LABEL: Record<EvidenceItem['type'], string> = {
  document: 'Document',
  photo: 'Photo',
  receipt: 'Receipt',
  inspection_report: 'Inspection Report',
};

// EVIDENCE DOCUMENT MODEL Chunk 2 — mirrors DOCUMENT_TYPE_OPTIONS in
// apps/frontend/src/app/admin/constants.ts, but declared locally rather than
// imported from there: that file is admin-only, and this component also
// renders on public profile pages (society/contractor/supplier/developer).
const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  LOP_APPROVAL: 'LOP Approval',
  LOP_LETTER: 'LOP Letter',
  NOC: 'NOC',
  NOC_CANCELLATION: 'NOC Cancellation',
  SHOW_CAUSE_NOTICE: 'Show Cause Notice',
  MORTGAGE_DEED: 'Mortgage Deed',
  TRANSFER_DEED: 'Transfer Deed',
  OTHER: 'Other',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function EvidenceDrawer({ evidence, triggerLabel = 'View all evidence' }: Props) {
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleViewDocument(itemId: string) {
    setLoadingId(itemId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    try {
      const { url } = await fetchEvidenceDownloadUrl(itemId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setErrors((prev) => ({
        ...prev,
        [itemId]: 'Could not fetch download link. Try again.',
      }));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontSize: '13px',
          color: 'var(--text)',
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '6px 12px',
          cursor: 'pointer',
        }}
      >
        {triggerLabel} ({evidence.length})
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Evidence drawer"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
          />

          {/* Drawer panel */}
          <aside
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '440px',
              height: '100%',
              background: '#fff',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 700 }}>
                Evidence ({evidence.length})
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close evidence drawer"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {evidence.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
                  No evidence items have been attached to this record yet.
                </p>
              ) : (
                // EVIDENCE DOCUMENT MODEL Chunk 2 — CDA-portal-style row:
                // document type, a "— View Document" link, and the document's
                // own date right-aligned. `evidence` arrives already sorted
                // document_date DESC (falling back to created_at DESC) by
                // TrustService.getVerifications — not re-sorted here.
                evidence.map((item) => {
                  const typeLabel = item.document_type
                    ? DOCUMENT_TYPE_LABEL[item.document_type]
                    : TYPE_LABEL[item.type];
                  // Old records have no document_date — showing created_at
                  // instead is only honest with the "(entry date)" qualifier,
                  // since that's when it was entered into Siraat, not
                  // necessarily when the document itself was issued.
                  const dateLabel = item.document_date
                    ? formatDate(item.document_date)
                    : `${formatDate(item.created_at)} (entry date)`;

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                          <strong style={{ fontWeight: 700 }}>{typeLabel}</strong>
                          {' — '}
                          <button
                            onClick={() => handleViewDocument(item.id)}
                            disabled={loadingId === item.id}
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: loadingId === item.id ? 'var(--muted)' : '#2563eb',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: loadingId === item.id ? 'default' : 'pointer',
                              textDecoration: 'underline',
                              textDecorationColor: loadingId === item.id ? 'var(--muted)' : '#2563eb',
                            }}
                          >
                            {loadingId === item.id ? 'Loading…' : 'View Document →'}
                          </button>
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                          }}
                        >
                          {dateLabel}
                        </span>
                      </div>

                      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>{item.source_ref}</p>

                      {errors[item.id] && (
                        <p style={{ fontSize: '11px', color: 'var(--error)', margin: 0 }}>
                          {errors[item.id]}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
