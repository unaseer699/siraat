import type { CSSProperties } from 'react';
import type { ClaimType, EvidenceType, DocumentType } from '@/lib/api';
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

// EVIDENCE DOCUMENT MODEL Chunk 2 — mirrors DocumentTypeSchema in
// @siraat/shared-types (trust.ts), distinct from claim_type above: one
// claim (e.g. NOC) can have multiple document types tied to it over its
// lifetime, e.g. both a "NOC" document and a later "NOC Cancellation" one.
export const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'LOP', label: 'LOP' },
  { value: 'LOP_APPROVAL', label: 'LOP Approval' },
  { value: 'LOP_LETTER', label: 'LOP Letter' },
  { value: 'LOP_CANCELLATION', label: 'Cancellation of LOP' },
  { value: 'NOC', label: 'NOC' },
  { value: 'NOC_CANCELLATION', label: 'NOC Cancellation' },
  { value: 'SHOW_CAUSE_NOTICE', label: 'Show Cause Notice' },
  { value: 'MORTGAGE_DEED', label: 'Mortgage Deed' },
  { value: 'TRANSFER_DEED', label: 'Transfer Deed' },
  { value: 'OTHER', label: 'Other' },
];

export const PROPERTY_TYPE_OPTIONS = ['PLOT', 'HOUSE', 'APARTMENT', 'COMMERCIAL'];

// PRE-DATA-POPULATION REVIEW finding #10 — a canonical city list used as
// suggestions (datalist / checkbox options) across Society, Contractor,
// Supplier and House Plan admin forms. Before any data exists, the
// Society-derived city list (fetchPlatformStats().cities_covered) is empty,
// so operators had nothing to pick from and typed free text — exactly how
// "Lahore" / "lahore " / "Lahore City" variants get created in the first
// place. This list is suggestions only (operators can still type a city not
// listed here, e.g. a smaller town), not a hard enum — Society.city and
// Contractor/Supplier.service_cities remain free-text columns.
export const CANONICAL_CITY_OPTIONS = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Gujranwala',
  'Sialkot',
  'Bahawalpur',
  'Sargodha',
  'Sukkur',
  'Hyderabad',
  'Abbottabad',
  'Mardan',
  'Gujrat',
  'Sheikhupura',
  'Rahim Yar Khan',
  'Jhelum',
];

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
