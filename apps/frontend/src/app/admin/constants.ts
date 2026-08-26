import type { CSSProperties } from 'react';
import type { ClaimType, EvidenceType } from '@/lib/api';
import { TRADE_CATEGORY_OPTIONS } from '@/lib/tradeCategories';
import { MATERIAL_CATEGORY_OPTIONS } from '@/lib/materialCategories';

export { TRADE_CATEGORY_OPTIONS, MATERIAL_CATEGORY_OPTIONS };

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

// Inline per-field validation message, shown under an input — same red used
// by the generic error banner (var(--error)) but sized/weighted for a
// one-line caption rather than a boxed alert.
export const errorTextStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--error)',
  fontWeight: 500,
};
