import { z } from 'zod';

export const EvidenceSubmissionRequestSchema = z.object({
  linked_to: z.string().uuid(),
  type: z.enum(['document', 'photo', 'receipt', 'inspection_report']),
  source_ref: z.string().min(1),
  file_ref: z.string().min(1),
});
export type EvidenceSubmissionRequest = z.infer<typeof EvidenceSubmissionRequestSchema>;

export interface EvidenceSubmissionResponse {
  submission_id: string;
  status: 'pending_review';
}

// EVIDENCE DOCUMENT MODEL Chunk 1 — distinct from claim_type: one claim
// (e.g. NOC) can have multiple document types tied to it over its lifetime,
// e.g. both a "NOC" document and a later "NOC Cancellation" document.
export const DocumentTypeSchema = z.enum([
  'LOP_APPROVAL',
  'LOP_LETTER',
  'NOC',
  'NOC_CANCELLATION',
  'SHOW_CAUSE_NOTICE',
  'MORTGAGE_DEED',
  'TRANSFER_DEED',
  'OTHER',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export const DOCUMENT_TYPES = DocumentTypeSchema.options;

export interface EvidenceItem {
  id: string;
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';
  file_ref: string;
  source_ref: string;
  record_type: 'FACT';
  created_at: string;
  // EVIDENCE DOCUMENT MODEL Chunk 1 — both nullable: existing Evidence rows
  // predate these fields and won't have them. document_date is the
  // real-world date the document itself was issued/dated (distinct from
  // created_at, which is when it was entered into Siraat).
  document_date: string | null;
  document_type: DocumentType | null;
}

export interface VerificationResponse {
  // ADD EVIDENCE TO EXISTING CLAIM — previously absent: every consumer had
  // to display a claim without any way to reference it back to the server
  // (e.g. to target POST /v1/admin/verifications/:verificationId/evidence).
  id: string;
  status: 'VERIFIED' | 'DISPUTED' | 'PENDING' | 'CANCELLED';
  claim: string;
  claim_type:
    | 'NOC'
    | 'PLANNING_APPROVAL'
    | 'COMPLETION_CERTIFICATE'
    | 'SHOW_CAUSE_NOTICE'
    | 'ILLEGAL_SCHEME_NOTICE'
    | 'TRANSFER_DEED'
    | 'MORTGAGE_DEED'
    | 'OTHER';
  verified_at: string | null;
  evidence: EvidenceItem[];
}

export interface VerificationListResponse {
  claims: VerificationResponse[];
}
