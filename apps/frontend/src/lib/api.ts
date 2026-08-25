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
  HousePlanStyle,
  ContractorSummary,
  ContractorListResponse,
  SupplierSummary,
  SupplierListResponse,
  HousePlanSummary,
  HousePlanListResponse,
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
  // ADMIN CRUD PHASE 1 Chunk 2 — first callers to hit a 204 No Content
  // response (the new DELETE routes). res.json() throws on an empty body,
  // so it's skipped here rather than at each call site.
  if (res.status === 204) {
    return undefined as T;
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

// SUPPLIER DIRECTORY Chunk 3 — public directory listing + profile, same
// shape/organization as the Contractor block above.
export async function fetchSuppliers(params?: {
  material_category?: string;
  city?: string;
  page?: number;
  limit?: number;
}): Promise<SupplierListResponse> {
  const qs = new URLSearchParams();
  if (params?.material_category) qs.set('material_category', params.material_category);
  if (params?.city) qs.set('city', params.city);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/v1/property-intelligence/suppliers${suffix}`);
}

export async function fetchSupplier(supplierId: string): Promise<SupplierSummary> {
  return apiFetch(`/v1/property-intelligence/suppliers/${supplierId}`);
}

export async function fetchSupplierVerifications(
  supplierId: string,
): Promise<VerificationListResponse> {
  return apiFetch(`/v1/trust/suppliers/${supplierId}/verification`);
}

// Linked active material rate submissions for the supplier profile page, via
// findMaterialRatesBySupplierId (SUPPLIER DIRECTORY Chunk 1).
export async function fetchSupplierMaterialRates(supplierId: string): Promise<MaterialRateItem[]> {
  return apiFetch(`/v1/property-intelligence/suppliers/${supplierId}/material-rates`);
}

// HOUSE PLANS DIRECTORY Chunk 2 — public directory listing + profile, same
// shape/organization as the Contractor/Supplier blocks above. No
// verification_status field — this directory was never wired to Trust claims.
export async function fetchHousePlans(params?: {
  area_marla_min?: number;
  area_marla_max?: number;
  bedrooms?: number;
  style?: string;
  page?: number;
  limit?: number;
}): Promise<HousePlanListResponse> {
  const qs = new URLSearchParams();
  if (params?.area_marla_min != null) qs.set('area_marla_min', String(params.area_marla_min));
  if (params?.area_marla_max != null) qs.set('area_marla_max', String(params.area_marla_max));
  if (params?.bedrooms != null) qs.set('bedrooms', String(params.bedrooms));
  if (params?.style) qs.set('style', params.style);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/v1/property-intelligence/house-plans${suffix}`);
}

export async function fetchHousePlan(id: string): Promise<HousePlanSummary> {
  return apiFetch(`/v1/property-intelligence/house-plans/${id}`);
}

// house_plans.preview_image_ref is a private bucket-relative storage key
// (same convention as Evidence.file_ref), never a directly-servable URL — the
// actual image is fetched through this presigned-URL route instead (same
// pattern as fetchEvidenceDownloadUrl above). Callers should skip calling
// this at all when preview_image_ref is '' (the "no image yet" sentinel) —
// see HousePlanImage.tsx.
export async function fetchHousePlanImageUrl(
  id: string,
): Promise<{ url: string; expires_in_seconds: number }> {
  return apiFetch(`/v1/property-intelligence/house-plans/${id}/image-url`);
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

// ADMIN CRUD PHASE 1 Chunk 2 — all fields optional (partial update); the
// field this exists for is `status` (manual override, e.g. reverting an
// accidental ONBOARDED back to NOT_STARTED), but name/regulator/city are
// correctable too.
export interface UpdateCandidateSocietyBody {
  name?: string;
  regulator?: CandidateSociety['regulator'];
  city?: string;
  status?: CandidateSociety['status'];
}

export async function updateCandidateSociety(
  id: string,
  data: UpdateCandidateSocietyBody,
): Promise<CandidateSociety> {
  return apiFetch(`/v1/admin/candidate-societies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCandidateSociety(id: string): Promise<void> {
  return apiFetch(`/v1/admin/candidate-societies/${id}`, { method: 'DELETE' });
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

// FIX: admin material-rates table was rendering "Supplier #<id fragment>"
// instead of the linked supplier's name — GET /v1/admin/material-rates now
// resolves and returns it (AdminService.listMaterialRates), so this response
// shape needs supplier_name on top of the plain MaterialRateItem fields.
// Admin-only, mirrors backend's MaterialRateListItem — not in shared-types
// since no other consumer needs supplier_name.
export interface MaterialRateListItem extends MaterialRateItem {
  supplier_name: string | null;
}

export async function fetchMaterialRates(filters?: {
  city?: string;
  material?: string;
}): Promise<MaterialRateListItem[]> {
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
// block above (ContractorItem): a lightweight admin-only return shape,
// deliberately without verification_status (a freshly-created supplier has
// none yet). Same relationship to the public SupplierSummary (shared-types,
// added in Chunk 3) as ContractorItem has to ContractorSummary.
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

// HOUSE PLANS DIRECTORY Chunk 2 — admin onboarding. No claim/evidence step
// (unlike Society/Contractor/Supplier) — this directory was never wired to
// Trust claims, so creation is a single call. preview_image_ref is
// deliberately omitted here: the backend defaults it to '' ("no image yet"),
// and the real key is set afterward via uploadHousePlanImage once the plan
// (and therefore its id) exists.
export interface CreateHousePlanBody {
  title: string;
  area_marla: number;
  bedrooms: number;
  style: HousePlanStyle;
  description: string;
  contact_whatsapp: string;
  is_siraat_affiliated: boolean;
}

export async function createHousePlan(data: CreateHousePlanBody): Promise<HousePlanSummary> {
  return apiFetch('/v1/admin/house-plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// POST /v1/admin/house-plans/:id/upload-image — base64 JSON body, not
// multipart/form-data (the backend runs on the Fastify adapter with no
// @fastify/multipart plugin installed; see admin.controller.ts). Callers
// base64-encode the file client-side (see fileToBase64 in
// admin/new-house-plan/page.tsx) before calling this.
export async function uploadHousePlanImage(
  id: string,
  data: { filename: string; content_type: string; data_base64: string },
): Promise<{ preview_image_ref: string }> {
  return apiFetch(`/v1/admin/house-plans/${id}/upload-image`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ADMIN CRUD PHASE 1 Chunk 2 — GET /v1/admin/house-plans, backs the new
// admin list page. Same shape/filters as the public fetchHousePlans above,
// different route — the admin route has no verification-status gating (this
// directory never had any) but stays distinct in case admin-only fields are
// ever added to the response.
export async function fetchAdminHousePlans(params?: {
  area_marla_min?: number;
  area_marla_max?: number;
  bedrooms?: number;
  style?: string;
  page?: number;
  limit?: number;
}): Promise<HousePlanListResponse> {
  const qs = new URLSearchParams();
  if (params?.area_marla_min != null) qs.set('area_marla_min', String(params.area_marla_min));
  if (params?.area_marla_max != null) qs.set('area_marla_max', String(params.area_marla_max));
  if (params?.bedrooms != null) qs.set('bedrooms', String(params.bedrooms));
  if (params?.style) qs.set('style', params.style);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/v1/admin/house-plans${suffix}`);
}

// All fields optional (partial update). preview_image_ref is deliberately
// absent — that's uploadHousePlanImage's job, not this one's.
export interface UpdateHousePlanBody {
  title?: string;
  area_marla?: number;
  bedrooms?: number;
  style?: HousePlanStyle;
  description?: string;
  contact_whatsapp?: string;
  is_siraat_affiliated?: boolean;
}

export async function updateHousePlan(id: string, data: UpdateHousePlanBody): Promise<HousePlanSummary> {
  return apiFetch(`/v1/admin/house-plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Also removes the stored preview image server-side (AdminService.deleteHousePlan)
// — no separate cleanup call needed here.
export async function deleteHousePlan(id: string): Promise<void> {
  return apiFetch(`/v1/admin/house-plans/${id}`, { method: 'DELETE' });
}

// PROJECT COST TRACKER Chunk 2 — an organized, immutable expense ledger per
// construction project. No dedicated public route exists for this (Chunk 1
// only added admin routes) — the "private link" project dashboard
// (app/project/[id]/page.tsx) calls the same /v1/admin/projects/:id route
// the admin management page uses. That's consistent with how every other
// "public" page in this app already works: BearerGuard is one shared API key
// today (REVIEW_BACKLOG #9), not a real admin-vs-public auth split.

export type ConstructionProjectStatus = 'ACTIVE' | 'COMPLETE' | 'ON_HOLD';

export interface ProjectResult {
  id: string;
  name: string;
  property_ref: string | null;
  owner_contact: string;
  start_date: string;
  status: ConstructionProjectStatus;
  record_type: 'FACT';
}

export interface CreateProjectBody {
  name: string;
  property_ref: string | null;
  owner_contact: string;
  start_date: string;
  status: ConstructionProjectStatus;
}

export async function createProject(data: CreateProjectBody): Promise<ProjectResult> {
  return apiFetch('/v1/admin/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface SectionResult {
  id: string;
  project_ref: string;
  category: TradeCategory;
  display_order: number;
  record_type: 'FACT';
}

export interface CreateSectionBody {
  category: TradeCategory;
  display_order: number;
}

export async function createProjectSection(
  projectId: string,
  data: CreateSectionBody,
): Promise<SectionResult> {
  return apiFetch(`/v1/admin/projects/${projectId}/sections`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface ExpenseResult {
  id: string;
  section_ref: string;
  expense_date: string;
  description: string;
  vendor_name: string;
  vendor_contact: string | null;
  linked_contractor_id: string | null;
  linked_supplier_id: string | null;
  amount: number;
  record_type: 'FACT';
}

// May be negative — a correction to a prior expense is a new row with a
// negative amount, never an edit to the original (Law 3: FACT records are
// immutable). No updateExpense function exists here, deliberately.
export interface CreateExpenseBody {
  expense_date: string;
  description: string;
  vendor_name: string;
  vendor_contact: string | null;
  linked_contractor_id: string | null;
  linked_supplier_id: string | null;
  amount: number;
}

export async function createSectionExpense(
  sectionId: string,
  data: CreateExpenseBody,
): Promise<ExpenseResult> {
  return apiFetch(`/v1/admin/sections/${sectionId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface SectionWithExpenses extends SectionResult {
  expenses: ExpenseResult[];
  subtotal: number;
}

export interface ProjectWithSectionsAndExpenses extends ProjectResult {
  sections: SectionWithExpenses[];
  total: number;
}

export async function fetchProject(id: string): Promise<ProjectWithSectionsAndExpenses> {
  return apiFetch(`/v1/admin/projects/${id}`);
}

export interface ContractorSearchResult {
  id: string;
  name: string;
}

// Search-as-you-type over GET /admin/contractors/search?q= — same shape and
// purpose as searchSuppliers above, powering the contractor picker on the
// project expense form.
export async function searchContractorsByName(query: string): Promise<ContractorSearchResult[]> {
  return apiFetch(`/v1/admin/contractors/search?q=${encodeURIComponent(query)}`);
}
