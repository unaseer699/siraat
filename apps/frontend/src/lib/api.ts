import type {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationDetail,
  SocietyScoreResponse,
  VerificationListResponse,
  PropertyDetail,
  DeveloperProfile,
  DeveloperStats,
  EstimateRequest,
  EstimateResponse,
  MaterialRateItem,
  CreateMaterialRateBody,
  PlatformStatsResponse,
  SocietyListResponse,
  SocietyChangesRequest,
  SocietyChangesResponse,
  TradeCategory,
  MaterialCategory,
  ContractorSummary,
  ContractorListResponse,
} from '@siraat/shared-types';

export type { MaterialRateItem, CreateMaterialRateBody };

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

export async function fetchPlatformStats(): Promise<PlatformStatsResponse> {
  return apiFetch('/v1/market-intelligence/platform-stats');
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

export async function fetchSocieties(params?: {
  city?: string;
  page?: number;
  limit?: number;
}): Promise<SocietyListResponse> {
  const qs = new URLSearchParams();
  if (params?.city) qs.set('city', params.city);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/v1/property-intelligence/societies${suffix}`);
}

export async function fetchSocietyScore(societyId: string): Promise<SocietyScoreResponse> {
  return apiFetch(`/v1/market-intelligence/societies/${societyId}/score`);
}

// Watchlist Chunk 2 — reports what changed for a browser-supplied batch of
// watched society IDs since each one's "date added".
export async function fetchSocietyChanges(
  req: SocietyChangesRequest,
): Promise<SocietyChangesResponse> {
  return apiFetch('/v1/property-intelligence/societies/changes', {
    method: 'POST',
    body: JSON.stringify(req),
  });
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

// Aggregate stats (evidence count, project history, linked societies) — lives in
// property_intelligence, a separate context/table from the trust claims above
// (no FK between them), and is fetched independently.
export async function fetchDeveloperStats(developerId: string): Promise<DeveloperStats> {
  return apiFetch(`/v1/property-intelligence/developers/${developerId}/stats`);
}

export async function fetchPropertyDetail(propertyId: string): Promise<PropertyDetail> {
  return apiFetch(`/v1/property-intelligence/properties/${propertyId}`);
}

export async function fetchConstructionEstimate(
  req: EstimateRequest,
): Promise<EstimateResponse> {
  return apiFetch('/v1/construction-intelligence/estimates', {
    method: 'POST',
    body: JSON.stringify(req),
  });
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

// Export endpoint returns the report body directly (text/html, Content-Disposition:
// attachment) rather than JSON — bypasses apiFetch's res.json() and reads the
// filename the backend chose off the response header instead of guessing one here.
export async function fetchRecommendationExport(
  id: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${BASE_URL}/v1/market-intelligence/recommendations/${id}/export`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SIRAAT_API_KEY ?? ''}`,
      'X-Siraat-Country-Code': 'PK',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `recommendation-${id}.html`;
  const blob = await res.blob();
  return { blob, filename };
}

// CONTRACTOR DIRECTORY Chunk 3 — public directory listing + profile, same
// auth level (shared BearerGuard) as fetchSocieties/fetchSocietyScore above.
export async function fetchContractors(params?: {
  trade_category?: string;
  city?: string;
  page?: number;
  limit?: number;
}): Promise<ContractorListResponse> {
  const qs = new URLSearchParams();
  if (params?.trade_category) qs.set('trade_category', params.trade_category);
  if (params?.city) qs.set('city', params.city);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/v1/property-intelligence/contractors${suffix}`);
}

export async function fetchContractor(contractorId: string): Promise<ContractorSummary> {
  return apiFetch(`/v1/property-intelligence/contractors/${contractorId}`);
}

export async function fetchContractorVerifications(
  contractorId: string,
): Promise<VerificationListResponse> {
  return apiFetch(`/v1/trust/contractors/${contractorId}/verification`);
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
  developer_id: string | null;
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

export interface DeveloperSearchResult {
  id: string;
  name: string;
}

// DEVELOPER-SOCIETY LINK Chunk 3 — powers the admin new-society developer
// search-as-you-type field.
export async function searchDevelopers(query: string): Promise<DeveloperSearchResult[]> {
  return apiFetch(`/v1/admin/developers?search=${encodeURIComponent(query)}`);
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

// MaterialRateItem/CreateMaterialRateBody now come from @siraat/shared-types
// (SUPPLIER DIRECTORY Chunk 2b) — previously hand-duplicated here (and
// separately in admin.controller.ts's local Zod schema), each commented
// "Mirrors ..." the other, exactly the silent-drift risk shared-types exists
// to prevent. Re-exported above for existing callers that import these types
// from '@/lib/api'.

export async function fetchMaterialRates(filters?: {
  city?: string;
  material?: string;
}): Promise<MaterialRateItem[]> {
  const qs = new URLSearchParams();
  if (filters?.city) qs.set('city', filters.city);
  if (filters?.material) qs.set('material', filters.material);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/v1/admin/material-rates${suffix}`);
}

export async function createMaterialRate(data: CreateMaterialRateBody): Promise<MaterialRateItem> {
  return apiFetch('/v1/admin/material-rates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// CONTRACTOR DIRECTORY Chunk 2b — mirrors ContractorResult in
// apps/backend/src/property-intelligence/property-intelligence.service.ts
export interface ContractorItem {
  id: string;
  name: string;
  trade_categories: TradeCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
  record_type: 'FACT';
}

export interface CreateContractorBody {
  name: string;
  trade_categories: TradeCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
}

export async function createContractor(data: CreateContractorBody): Promise<ContractorItem> {
  return apiFetch('/v1/admin/contractors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Same claim-adding shape as addClaimToSociety, just against the contractor
// subject_type on the backend (both routes share AdminService.addClaim()).
export async function addClaimToContractor(
  contractorId: string,
  data: AddClaimBody,
): Promise<{ verification_id: string }> {
  return apiFetch(`/v1/admin/contractors/${contractorId}/claims`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// SUPPLIER DIRECTORY Chunk 2b — same shape/organization as the Contractor
// block above. Mirrors SupplierResult in
// apps/backend/src/property-intelligence/property-intelligence.service.ts —
// local here (rather than shared-types) since, same as SupplierResult
// upstream, there's no public API route exposing suppliers yet.
export interface SupplierItem {
  id: string;
  name: string;
  material_categories: MaterialCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
  record_type: 'FACT';
}

export interface CreateSupplierBody {
  name: string;
  material_categories: MaterialCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
}

export async function createSupplier(data: CreateSupplierBody): Promise<SupplierItem> {
  return apiFetch('/v1/admin/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Same claim-adding shape as addClaimToContractor, just against the supplier
// subject_type on the backend (both routes share AdminService.addClaim()).
export async function addClaimToSupplier(
  supplierId: string,
  data: AddClaimBody,
): Promise<{ verification_id: string }> {
  return apiFetch(`/v1/admin/suppliers/${supplierId}/claims`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface SupplierSearchResult {
  id: string;
  name: string;
}

// Search-as-you-type over GET /admin/suppliers/search?q= — same shape and
// purpose as searchDevelopers above, powering the supplier picker on the
// material-rate form.
export async function searchSuppliers(query: string): Promise<SupplierSearchResult[]> {
  return apiFetch(`/v1/admin/suppliers/search?q=${encodeURIComponent(query)}`);
}
