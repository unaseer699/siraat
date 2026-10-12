import type { ClaimType, DocumentType, VerificationResponse } from '@/lib/api';

// One document drives everything: choosing "NOC Cancellation" files the paper
// under the NOC record AND marks that record Cancelled. The admin never has to
// think in "claims" and "evidence" separately.

export type RecordStatus = 'VERIFIED' | 'DISPUTED' | 'CANCELLED';

export interface DocRule {
  claimType: ClaimType;
  claim: string; // claim text when a new record has to be created
  status: RecordStatus; // status the record takes when this is its newest paper
  topic: 'LOP' | 'NOC' | 'IMPORTANT';
  outcome: string; // plain-language preview shown to the admin
}

export const DOC_RULES: Record<DocumentType, DocRule> = {
  LOP_APPROVAL: { claimType: 'PLANNING_APPROVAL', claim: 'LOP (Layout Plan Approval)', status: 'VERIFIED', topic: 'LOP', outcome: 'LOP will show as Approved' },
  LOP_LETTER: { claimType: 'PLANNING_APPROVAL', claim: 'LOP (Layout Plan Approval)', status: 'VERIFIED', topic: 'LOP', outcome: 'LOP will show as Approved' },
  LOP_CANCELLATION: { claimType: 'PLANNING_APPROVAL', claim: 'LOP (Layout Plan Approval)', status: 'CANCELLED', topic: 'LOP', outcome: 'LOP will show as Cancelled' },
  NOC: { claimType: 'NOC', claim: 'NOC', status: 'VERIFIED', topic: 'NOC', outcome: 'NOC will show as Issued' },
  NOC_CANCELLATION: { claimType: 'NOC', claim: 'NOC', status: 'CANCELLED', topic: 'NOC', outcome: 'NOC will show as Cancelled' },
  SHOW_CAUSE_NOTICE: { claimType: 'SHOW_CAUSE_NOTICE', claim: 'Show cause notice', status: 'DISPUTED', topic: 'IMPORTANT', outcome: 'Listed under Important documents, flagged as a problem' },
  MORTGAGE_DEED: { claimType: 'MORTGAGE_DEED', claim: 'Mortgage deed', status: 'VERIFIED', topic: 'IMPORTANT', outcome: 'Listed under Important documents' },
  TRANSFER_DEED: { claimType: 'TRANSFER_DEED', claim: 'Transfer deed', status: 'VERIFIED', topic: 'IMPORTANT', outcome: 'Listed under Important documents' },
  OTHER: { claimType: 'OTHER', claim: 'Other document', status: 'VERIFIED', topic: 'IMPORTANT', outcome: 'Listed under Important documents' },
};

export const STATUS_WORD: Record<VerificationResponse['status'], string> = {
  VERIFIED: 'Approved',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending',
};

export function topicOf(claimType: string): 'LOP' | 'NOC' | 'IMPORTANT' {
  if (claimType === 'PLANNING_APPROVAL') return 'LOP';
  if (claimType === 'NOC') return 'NOC';
  return 'IMPORTANT';
}

export function docTime(e: { document_date: string | null; created_at: string }): number {
  return new Date(e.document_date ?? e.created_at).getTime();
}

export function newestDocTime(c: VerificationResponse): number {
  return c.evidence.reduce((m, e) => Math.max(m, docTime(e)), 0);
}
