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

export interface EvidenceItem {
  id: string;
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';
  file_ref: string;
  source_ref: string;
  record_type: 'FACT';
  created_at: string;
}

export interface VerificationResponse {
  status: 'VERIFIED' | 'DISPUTED' | 'PENDING';
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
