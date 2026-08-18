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
// VERIFIED | DISPUTED | PENDING status stored on a single Verification record.
export type SocietyVerificationStatus = 'VERIFIED' | 'PARTIAL' | 'PENDING' | 'DISPUTED';

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
]);
export type TradeCategory = z.infer<typeof TradeCategorySchema>;
export const TRADE_CATEGORIES = TradeCategorySchema.options;
