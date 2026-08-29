'use client';

import { useState } from 'react';
import {
  addEvidenceToVerification,
  type AdminEvidenceItem,
  type VerificationResponse,
} from '@/lib/api';
import { EvidenceEditor } from './EvidenceEditor';
import { errorTextStyle, fieldGroupStyle, labelStyle } from './constants';

/**
 * ADD EVIDENCE TO EXISTING CLAIM — until now the only admin path was
 * "create a new claim with its first evidence" (the add-claim forms this
 * renders alongside). Lists a subject's existing claims (Society/
 * Contractor/Supplier — subject-agnostic, driven entirely by the
 * VerificationResponse[] the caller already fetched) with a "+ Add
 * Evidence" action per claim, reusing EvidenceEditor rather than a new
 * one-off form.
 *
 * The underlying endpoint (POST /v1/admin/verifications/:id/evidence)
 * takes one evidence item per call — unlike the create-a-claim flows,
 * which send a whole evidence[] array in one request looped server-side —
 * so adding several items here loops client-side, one request per item.
 */

const STATUS_LABEL: Record<VerificationResponse['status'], string> = {
  VERIFIED: 'Verified',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending',
};

function ExistingClaimCard({
  claim,
  onEvidenceAdded,
}: {
  claim: VerificationResponse;
  onEvidenceAdded: () => void;
}) {
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [items, setItems] = useState<AdminEvidenceItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setAddingEvidence(true);
    setItems([]);
    setError(null);
  }

  function cancelEditor() {
    setAddingEvidence(false);
    setItems([]);
    setError(null);
  }

  async function handleSave() {
    if (items.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      // One request per item — the endpoint links a single Evidence row at
      // a time. Sequential, not Promise.all: if one fails partway through,
      // the error should point at exactly how many actually saved rather
      // than leaving that ambiguous.
      for (const item of items) {
        await addEvidenceToVerification(claim.id, item);
      }
      setAddingEvidence(false);
      setItems([]);
      onEvidenceAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add evidence');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{claim.claim}</p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            {claim.claim_type} · {STATUS_LABEL[claim.status]} · {claim.evidence.length} evidence item
            {claim.evidence.length === 1 ? '' : 's'}
          </p>
        </div>
        {!addingEvidence && (
          <button type="button" onClick={openEditor} style={addEvidenceButtonStyle}>
            + Add Evidence
          </button>
        )}
      </div>

      {addingEvidence && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
          <EvidenceEditor items={items} onChange={setItems} required={false} />
          {error && <p style={errorTextStyle}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || items.length === 0}
              style={saveButtonStyle(submitting || items.length === 0)}
            >
              {submitting ? 'Saving…' : `Save evidence (${items.length})`}
            </button>
            <button type="button" onClick={cancelEditor} disabled={submitting} style={addEvidenceButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExistingClaimsList({
  claims,
  onEvidenceAdded,
}: {
  claims: VerificationResponse[];
  onEvidenceAdded: () => void;
}) {
  return (
    <div style={fieldGroupStyle}>
      <label style={labelStyle}>Existing claims{claims.length > 0 ? ` (${claims.length})` : ''}</label>
      {claims.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No existing claims yet — add the first one below.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {claims.map((c) => (
            <ExistingClaimCard key={c.id} claim={c} onEvidenceAdded={onEvidenceAdded} />
          ))}
        </div>
      )}
    </div>
  );
}

const addEvidenceButtonStyle = {
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  cursor: 'pointer',
} as const;

function saveButtonStyle(disabled: boolean) {
  return {
    padding: '8px 16px',
    background: disabled ? 'var(--muted)' : '#111',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const;
}
