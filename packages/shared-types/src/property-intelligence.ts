import { z } from 'zod';

export interface SocietySummary {
  id: string;
  name: string;
  city: string;
  noc_approved: boolean;
}

export interface PropertyDetail {
  id: string;
  society_id: string;
  society: SocietySummary | null;
  owner_ref: string | null;
  address: string;
  price: number;
  listing_source: string;
  status: 'LISTED' | 'ACTIVE' | 'ARCHIVED';
  property_type: string;
  area_marla: number;
}

export interface DeveloperProfile {
  id: string;
  name: string;
  project_history: string[];
  is_siraat_affiliated: boolean;
}

// Overall claim-derived status for Browse Societies — distinct from the per-claim
// VERIFIED | DISPUTED | PENDING | CANCELLED status stored on a single Verification
// record (EVIDENCE DOCUMENT MODEL Chunk 1 added CANCELLED to both — a cancelled
// approval no longer exists at all, a genuinely more severe state than a merely
// contested (DISPUTED) one — see TrustService.deriveVerificationStatus).
export type SocietyVerificationStatus = 'VERIFIED' | 'PARTIAL' | 'PENDING' | 'DISPUTED' | 'CANCELLED';

export interface SocietyBrowseSummary {
  id: string;
  name: string;
  city: string;
  price_range: { min: number | null; max: number | null };
  area_range: { min: number | null; max: number | null };
  property_types: string[];
  verification_status: SocietyVerificationStatus;
}

export interface SocietyListResponse {
  societies: SocietyBrowseSummary[];
  total_count: number;
  page: number;
  total_pages: number;
}

// ─── DEVELOPER PROFILE Chunk 1 / DEVELOPER-SOCIETY LINK Chunk 1 ─────────────
// linked_societies is populated from SocietyEntity.developer_id (added in
// DEVELOPER-SOCIETY LINK Chunk 1) — a plain UUID string reference, no SQL FK
// per Law 2. Existing societies created before that column existed simply
// have developer_id: null and never appear here.

export interface LinkedSociety {
  id: string;
  name: string;
  city: string;
  verification_status: SocietyVerificationStatus;
}

export interface DeveloperStats {
  developer_id: string;
  developer_name: string;
  verification_status: SocietyVerificationStatus;
  project_history: string[];
  linked_societies: LinkedSociety[];
  evidence_count: number;
  is_siraat_affiliated: boolean;
}

// ─── WATCHLIST Chunk 1 — Society Changes ─────────────────────────────────────
// Session-based watchlist tracking lives entirely in the browser (no User/Identity
// system exists yet). This is the backend half: given society IDs the browser is
// already tracking, report what changed since a given date.

export const SocietyChangesRequestSchema = z.object({
  society_ids: z.array(z.string().uuid()),
  // ISO date or datetime string — validated as a real date server-side, not
  // constrained to full ISO-8601 datetime here, so a plain YYYY-MM-DD (e.g. from
  // a browser <input type="date">) is accepted too.
  since: z.string().min(1),
});
export type SocietyChangesRequest = z.infer<typeof SocietyChangesRequestSchema>;

export interface ObservationSummary {
  metric: string;
  old_value: string | null;
  new_value: string;
  recorded_at: string;
}

export interface SocietyChangeSummary {
  society_id: string;
  society_name: string;
  has_changes: boolean;
  observations: ObservationSummary[];
}

export interface SocietyChangesResponse {
  changes: SocietyChangeSummary[];
}

// ─── CONTRACTOR DIRECTORY Chunk 1 ────────────────────────────────────────────
// A directory (find + verify), not a marketplace — no booking/payment/in-app
// transactions. Standalone from Developer per founder decision, but lives in
// the same property_intelligence context: both are "who does the work"
// concepts, distinct from Society/Property ("what's being built/bought").

export const TradeCategorySchema = z.enum([
  'EXCAVATION',
  'MASON_GREY_STRUCTURE',
  'STEEL_FIXING',
  'SHUTTERING',
  'ELECTRICIAN',
  'PLUMBER',
  'TILE_WORK',
  'PAINTER',
  'WOODWORK_CARPENTER',
  'ALUMINUM_GLASS',
  'FALSE_CEILING',
  'GENERAL_CONTRACTOR',
  // PROJECT COST TRACKER Chunk 1 — extended (not a separate enum) for
  // ProjectSectionEntity.category, seen in real project data (Bahria 1180)
  // with no existing match above.
  'KITCHEN_WORK',
  'MISCELLANEOUS',
]);
export type TradeCategory = z.infer<typeof TradeCategorySchema>;
export const TRADE_CATEGORIES = TradeCategorySchema.options;

// Single source of truth for a human-readable TradeCategory label (e.g.
// MASON_GREY_STRUCTURE -> "Mason Grey Structure") — shared so the frontend's
// TRADE_CATEGORY_OPTIONS (apps/frontend/src/lib/tradeCategories.ts) and the
// backend's WhatsApp draft-summary text (apps/backend/src/whatsapp) can't
// drift into two different label algorithms for the same enum.
export function tradeCategoryLabel(category: TradeCategory): string {
  return category
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── SUPPLIER DIRECTORY Chunk 1 ──────────────────────────────────────────────
// Same organization as TradeCategory above — a Supplier is the material-supply
// counterpart to Contractor (trades), living in the same property_intelligence
// context.

export const MaterialCategorySchema = z.enum([
  'STEEL',
  'CEMENT',
  'AGGREGATE',
  'TILES',
  'ELECTRICAL_SUPPLIES',
  'PLUMBING_SUPPLIES',
]);
export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;
export const MATERIAL_CATEGORIES = MaterialCategorySchema.options;

// CONTRACTOR DIRECTORY Chunk 3 — public directory + profile shapes. Same
// verification_status derivation as SocietyBrowseSummary (via TrustService,
// reused not re-implemented) — see PropertyIntelligenceService.searchContractors
// / findContractorById.
export interface ContractorSummary {
  id: string;
  name: string;
  trade_categories: TradeCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
  record_type: 'FACT';
  verification_status: SocietyVerificationStatus;
}

export interface ContractorListResponse {
  contractors: ContractorSummary[];
  total_count: number;
  page: number;
  total_pages: number;
}

// SUPPLIER DIRECTORY Chunk 3 — public directory + profile shapes. Same
// shape/organization as ContractorSummary/ContractorListResponse above,
// same verification_status derivation — see
// PropertyIntelligenceService.searchSuppliers / findSupplierById.
export interface SupplierSummary {
  id: string;
  name: string;
  material_categories: MaterialCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
  record_type: 'FACT';
  verification_status: SocietyVerificationStatus;
}

export interface SupplierListResponse {
  suppliers: SupplierSummary[];
  total_count: number;
  page: number;
  total_pages: number;
}

// ─── HOUSE PLANS DIRECTORY Chunk 1 ───────────────────────────────────────────
// Standalone catalog, not linked to any Society/Property (founder decision,
// Phase 1 scope). Directory only: no payment, no full-resolution download.

export const HousePlanStyleSchema = z.enum([
  'MODERN',
  'TRADITIONAL',
  'CONTEMPORARY',
  'MINIMALIST',
]);
export type HousePlanStyle = z.infer<typeof HousePlanStyleSchema>;
export const HOUSE_PLAN_STYLES = HousePlanStyleSchema.options;

export interface HousePlanSummary {
  id: string;
  title: string;
  area_marla: number;
  bedrooms: number;
  style: HousePlanStyle;
  preview_image_ref: string;
  description: string;
  contact_whatsapp: string;
  is_siraat_affiliated: boolean;
  record_type: 'FACT';
}

export interface HousePlanListResponse {
  house_plans: HousePlanSummary[];
  total_count: number;
  page: number;
  total_pages: number;
}

// ─── HOUSE PLAN GALLERY (elevations + 3D renders) ───────────────────────────
// Extends the single preview_image_ref above with a per-plan set of tagged
// images. Added ahead of the actual paywall (payment gateway, subscription)
// on purpose, per founder direction: admins can upload and price GATED assets
// today; the unlock flow (subscription or WhatsApp-mediated request) is a
// separate, later change. Until then, GATED images are never resolved to a
// downloadable URL by the backend (see the image-url endpoint) — they only
// ever render client-side as a locked placeholder carrying their price.

export const HousePlanImageTypeSchema = z.enum([
  'FLOOR_PLAN',
  'ELEVATION_FRONT',
  'ELEVATION_SIDE',
  'RENDER_3D',
]);
export type HousePlanImageType = z.infer<typeof HousePlanImageTypeSchema>;
export const HOUSE_PLAN_IMAGE_TYPES = HousePlanImageTypeSchema.options;

export const HousePlanAccessTierSchema = z.enum(['FREE', 'GATED']);
export type HousePlanAccessTier = z.infer<typeof HousePlanAccessTierSchema>;
export const HOUSE_PLAN_ACCESS_TIERS = HousePlanAccessTierSchema.options;

export interface HousePlanImage {
  id: string;
  house_plan_id: string;
  image_type: HousePlanImageType;
  access_tier: HousePlanAccessTier;
  // Required display price for every image (free or gated) — "no bait and
  // switch": FREE images show it as Rs. 0 / "Free preview", GATED images
  // show the real unlock price. Never null.
  price: number;
  display_order: number;
  has_file: boolean;
  // MIME type of the uploaded file, e.g. 'image/jpeg' or 'application/pdf'.
  // 3D renders are often delivered as a multi-page PDF (several camera
  // angles/walkthrough stills in one file) rather than a single image, so
  // the gallery needs this to pick img vs. a PDF viewer. Null until a file
  // is uploaded.
  content_type: string | null;
}

export interface HousePlanImageListResponse {
  images: HousePlanImage[];
}

// ─── WHATSAPP LISTING INGESTION ─────────────────────────────────────────────
// Real-estate-group inventory forwarded by the founder via WhatsApp (already
// personally verified before forwarding — see WhatsappDraftListingEntity's
// own comment on why that collapses the confirm-loop this codebase uses for
// expenses down to a one-click admin Publish/Reject). A PropertyListing is a
// FACT the moment an admin publishes it (the human review step IS the
// verification — there is nothing further derived from it), scoped to a
// Society once/if one is matched by name, but never required to be (a
// forwarded block/society name may not match anything in the directory yet).

// One dealer's OFFER on a plot. Several dealers forwarding the same plot are
// several offers, grouped into one PropertyPlotGroup for display.
export interface PropertyListingSummary {
  id: string;
  // Effective Society link: the stored society_ref, or a read-time name match
  // when the listing was published before its Society was onboarded.
  society_ref: string | null;
  society_name: string | null;
  society_name_raw: string;
  city: string | null;
  block: string | null;
  plot_number: string;
  // Size as the market writes it ("25x50") — what the UI displays/filters on.
  size_label: string | null;
  size_marla: number | null;
  price_lac: number | null;
  // price_lac / size_marla, only when both are known — makes plots of
  // different sizes comparable at a glance.
  price_per_marla_lac: number | null;
  status_raw: string | null;
  // Optional dealer contact number; null when the source message had none.
  contact_phone: string | null;
  // Normalized (international digits) contact_phone — the dealer's identity
  // for /dealers/:key. Null when there is no contact_phone.
  dealer_key: string | null;
  is_siraat_affiliated: boolean;
  record_type: 'FACT';
  published_at: string;
  // Latest dealer confirmation (re-forwarding the same plot refreshes it).
  last_confirmed_at: string;
  // True when not re-confirmed within the staleness window (default 7 days).
  may_be_sold: boolean;
  sold_at: string | null;
  expires_at: string;
}

// One physical plot, however many dealers are offering it.
export interface PropertyPlotGroup {
  key: string;
  society_ref: string | null;
  society_name: string | null;
  society_name_raw: string;
  city: string | null;
  block: string | null;
  plot_number: string;
  size_label: string | null;
  size_marla: number | null;
  status_raw: string | null;
  min_price_lac: number | null;
  max_price_lac: number | null;
  min_price_per_marla_lac: number | null;
  last_confirmed_at: string;
  // Only true when EVERY offer on the plot is stale.
  may_be_sold: boolean;
  offers: PropertyListingSummary[];
}

// Filter options computed over ALL active plots (not the filtered subset),
// so a dropdown never collapses to the one value currently selected.
// Society `key` is the Society id, or `raw:<lowercased name>` for inventory
// whose Society is not onboarded yet.
export interface PropertyListingFacets {
  cities: string[];
  societies: { key: string; name: string; count: number }[];
  // Distinct plot sizes ("25x50"…), smallest first, counted per distinct plot.
  sizes: { label: string; count: number }[];
}

export interface PropertyListingListResponse {
  // Offer-level rows (kept for consumers that want every dealer's row).
  listings: PropertyListingSummary[];
  // Plot-level rows: duplicates across dealers collapsed into one group.
  plots: PropertyPlotGroup[];
  // Number of distinct plots (== plots.length).
  total_count: number;
  facets: PropertyListingFacets;
}

// Active PLOT count per Society, for Browse card badges. Keyed by the
// EFFECTIVE society id (the stored society_ref, or — for a listing published
// before its Society was onboarded — a read-time name match), so a listing
// starts counting the moment its Society exists, with no backfill.
export interface PropertyListingCountsResponse {
  counts: Record<string, number>;
}

export interface DealerProfile {
  dealer_key: string;
  contact_phone: string;
  active_plots: PropertyPlotGroup[];
  total_published: number;
  sold_count: number;
  // Offers re-forwarded at least a day after first posting — a proxy for a
  // dealer who keeps inventory current.
  reconfirmed_count: number;
  first_seen_at: string;
  last_confirmed_at: string;
}
