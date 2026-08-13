import type {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationDetail,
  VerificationListResponse,
  PropertyDetail,
  DeveloperProfile,
} from '@siraat/shared-types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    // All Siraat endpoints reflect live database state — never serve from Next.js Data Cache
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SIRAAT_API_KEY ?? ''}`,
      'X-Siraat-Country-Code': 'PK',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRecommendations(
  req: RecommendationRequest,
): Promise<RecommendationResponse> {
  return apiFetch('/v1/market-intelligence/recommendations', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function fetchRecommendationDetail(id: string): Promise<RecommendationDetail> {
  return apiFetch(`/v1/market-intelligence/recommendations/${id}`);
}

export async function fetchSocietyVerifications(
  societyId: string,
): Promise<VerificationListResponse> {
  return apiFetch(`/v1/trust/societies/${societyId}/noc-status`);
}

export async function fetchDeveloperVerification(
  developerId: string,
): Promise<VerificationListResponse> {
  return apiFetch(`/v1/trust/developers/${developerId}/verification`);
}

export async function fetchPropertyDetail(propertyId: string): Promise<PropertyDetail> {
  return apiFetch(`/v1/property-intelligence/properties/${propertyId}`);
}

export async function submitEvidence(societyId: string, data: {
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';
  source_ref: string;
  file_ref: string;
}): Promise<{ submission_id: string; status: 'pending_review' }> {
  return apiFetch('/v1/trust/evidence-submissions', {
    method: 'POST',
    body: JSON.stringify({ linked_to: societyId, ...data }),
  });
}

export async function fetchEvidenceDownloadUrl(
  evidenceId: string,
): Promise<{ url: string; expires_in_seconds: number }> {
  return apiFetch(`/v1/trust/evidence/${evidenceId}/download-url`);
}

// ── Admin (internal, no public UI links to these) ──────────────────────────

export interface CandidateSociety {
  id: string;
  name: string;
  regulator: 'CDA' | 'RDA' | 'TMA' | 'OTHER';
  city: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ONBOARDED';
  record_type: 'FACT';
  created_at: string;
  updated_at: string;
}

export type ClaimType =
  | 'NOC'
  | 'PLANNING_APPROVAL'
  | 'COMPLETION_CERTIFICATE'
  | 'SHOW_CAUSE_NOTICE'
  | 'ILLEGAL_SCHEME_NOTICE'
  | 'TRANSFER_DEED'
  | 'MORTGAGE_DEED'
  | 'OTHER';

export type EvidenceType = 'document' | 'photo' | 'receipt' | 'inspection_report';

export interface AdminEvidenceItem {
  type: EvidenceType;
  file_ref: string;
  source_ref: string;
}

export interface CreateSocietyBody {
  name: string;
  city: string;
  min_price: number | null;
  max_price: number | null;
  min_area_marla: number | null;
  max_area_marla: number | null;
  property_types: string[];
  noc_approved: boolean;
  base_confidence: number;
  is_siraat_affiliated: boolean;
  affiliation_disclosure: string | null;
  noc_summary: string | null;
  claim: string;
  claim_type: ClaimType;
  target_status: 'VERIFIED' | 'PENDING';
  evidence: AdminEvidenceItem[];
}

export interface AddClaimBody {
  claim: string;
  claim_type: ClaimType;
  target_status: 'VERIFIED' | 'DISPUTED' | 'PENDING';
  evidence: AdminEvidenceItem[];
}

export async function fetchCandidateSocieties(status?: string): Promise<CandidateSociety[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch(`/v1/admin/candidate-societies${qs}`);
}

export async function createSociety(
  data: CreateSocietyBody,
): Promise<{ society_id: string; verification_id: string; candidate_marked_onboarded: boolean }> {
  return apiFetch('/v1/admin/societies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function addClaimToSociety(
  societyId: string,
  data: AddClaimBody,
): Promise<{ verification_id: string }> {
  return apiFetch(`/v1/admin/societies/${societyId}/claims`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
