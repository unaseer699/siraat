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
  verified_at: string | null;
  evidence: EvidenceItem[];
}
