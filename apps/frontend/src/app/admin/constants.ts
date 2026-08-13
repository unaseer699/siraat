import type { CSSProperties } from 'react';
import type { ClaimType, EvidenceType } from '@/lib/api';

// Mirrors CLAIM_TYPES in apps/backend/src/admin/admin.controller.ts
export const CLAIM_TYPE_OPTIONS: { value: ClaimType; label: string }[] = [
  { value: 'NOC', label: 'NOC' },
  { value: 'PLANNING_APPROVAL', label: 'Planning Approval' },
  { value: 'COMPLETION_CERTIFICATE', label: 'Completion Certificate' },
  { value: 'SHOW_CAUSE_NOTICE', label: 'Show Cause Notice' },
  { value: 'ILLEGAL_SCHEME_NOTICE', label: 'Illegal Scheme Notice' },
  { value: 'TRANSFER_DEED', label: 'Transfer Deed' },
  { value: 'MORTGAGE_DEED', label: 'Mortgage Deed' },
  { value: 'OTHER', label: 'Other' },
];

// Mirrors EVIDENCE_TYPES in apps/backend/src/admin/admin.controller.ts
export const EVIDENCE_TYPE_OPTIONS: { value: EvidenceType; label: string }[] = [
  { value: 'document', label: 'Document' },
  { value: 'photo', label: 'Photo' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'inspection_report', label: 'Inspection Report' },
];

export const PROPERTY_TYPE_OPTIONS = ['PLOT', 'HOUSE', 'APARTMENT', 'COMMERCIAL'];

// Shared input/label styling — matches apps/frontend/src/app/submit-evidence/[societyId]/page.tsx
export const inputStyle: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  width: '100%',
  background: '#fff',
};

export const labelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
};

export const fieldGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};
