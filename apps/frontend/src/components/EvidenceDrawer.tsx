'use client';

import { useState } from 'react';
import type { EvidenceItem } from '@siraat/shared-types';

interface Props {
  evidence: EvidenceItem[];
  triggerLabel?: string;
}

const TYPE_LABEL: Record<EvidenceItem['type'], string> = {
  document: 'Document',
  photo: 'Photo',
  receipt: 'Receipt',
  inspection_report: 'Inspection Report',
};

export function EvidenceDrawer({ evidence, triggerLabel = 'View all evidence' }: Props) {
  const [open, setOpen] = useState(false);

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
                evidence.map((item) => (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: '99px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {TYPE_LABEL[item.type]}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '99px',
                          color: '#166534',
                        }}
                      >
                        FACT
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--text)' }}>{item.source_ref}</p>

                    {/* Placeholder link — file_ref is a path string, no real file exists this capability */}
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--muted)',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}
                    >
                      {item.file_ref}
                    </p>

                    <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Added {new Date(item.created_at).toLocaleDateString('en-PK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
