import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const PropertyTypeSchema = z.enum(['PLOT', 'HOUSE', 'APARTMENT', 'COMMERCIAL', 'FARMHOUSE']);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const ResponseStateSchema = z.enum(['FULL', 'DEGRADED_SUCCESS', 'NOT_COVERED']);
export type ResponseState = z.infer<typeof ResponseStateSchema>;

export const RecordTypeSchema = z.enum(['FACT', 'GENERATED']);
export type RecordType = z.infer<typeof RecordTypeSchema>;

// ─── Request ─────────────────────────────────────────────────────────────────

export const RecommendationFiltersSchema = z.object({
  city: z.string().nullable().optional(),
  max_price: z.number().nullable().optional(),
  min_price: z.number().nullable().optional(),
  property_type: PropertyTypeSchema.nullable().optional(),
  min_area_marla: z.number().nullable().optional(),
  max_area_marla: z.number().nullable().optional(),
});
export type RecommendationFilters = z.infer<typeof RecommendationFiltersSchema>;

export const RecommendationRequestSchema = z.object({
  query_text: z.string().min(1),
  filters: RecommendationFiltersSchema.optional(),
});
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;

// ─── Response ─────────────────────────────────────────────────────────────────

export const RecommendationItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  society_id: z.string().uuid(),
  society_name: z.string(),
  price: z.number(),
  confidence_score: z.number().min(0).max(1),
  is_stale: z.boolean(),
  staleness_threshold_days: z.number(),
  affiliation_disclosure: z.string().nullable(),
  recommendation_summary: z.string(),
  derived_from: z.array(z.string()),
  record_type: RecordTypeSchema.default('GENERATED'),
});
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

export const RecommendationResponseSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('FULL'),
    recommendations: z.array(RecommendationItemSchema),
  }),
  z.object({
    state: z.literal('DEGRADED_SUCCESS'),
    recommendations: z.array(RecommendationItemSchema),
    missing_evidence: z.array(z.string()),
    // Top-level fields are authoritative only when recommendations is empty (explaining no match).
    // When recommendations are present, per-item fields are authoritative — omit top-level.
    confidence_score: z.number().min(0).max(1).optional(),
    is_stale: z.literal(true).optional(),
    staleness_threshold_days: z.number().optional(),
    affiliation_disclosure: z.string().nullable().optional(),
  }),
  z.object({
    state: z.literal('NOT_COVERED'),
    recommendations: z.array(z.never()).default([]),
    message: z.string(),
    demand_count: z.number().nullable().default(null),
  }),
]);
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

// ─── Score Breakdown ──────────────────────────────────────────────────────────

export const ScoreBreakdownSchema = z.object({
  regulatory: z.object({
    status: z.enum(['VERIFIED', 'PLANNING_APPROVAL', 'PENDING', 'NONE']),
    label: z.string(),
    tone: z.enum(['success', 'warning', 'danger', 'neutral']),
  }),
  active_issues: z.object({
    count: z.number(),
    penalty_applied: z.number(),
    label: z.string(),
    tone: z.enum(['success', 'warning', 'danger']),
  }),
  evidence_strength: z.object({
    count: z.number(),
    bonus_applied: z.number(),
    label: z.string(),
    tone: z.enum(['success', 'warning', 'danger', 'neutral']),
  }),
  data_freshness: z.object({
    is_stale: z.boolean(),
    penalty_applied: z.number(),
    checked_date: z.string(),
    tone: z.enum(['success', 'warning']),
  }),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

// ─── Recommendation Detail (Screen 4 — GET /v1/market-intelligence/recommendations/{id}) ──

export const EvidenceSummarySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['document', 'photo', 'receipt', 'inspection_report']),
  source_ref: z.string(),
});
export type EvidenceSummary = z.infer<typeof EvidenceSummarySchema>;

export const RecommendationDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  society_id: z.string().uuid(),
  society_name: z.string(),
  price: z.number(),
  confidence_score: z.number().min(0).max(1),
  is_stale: z.boolean(),
  staleness_threshold_days: z.number(),
  affiliation_disclosure: z.string().nullable(),
  recommendation_summary: z.string(),
  reasoning_summary: z.string(),
  derived_from: z.array(z.string()),
  evidence_summaries: z.array(EvidenceSummarySchema).default([]),
  record_type: RecordTypeSchema,
  computed_at: z.string().datetime(),
  breakdown: ScoreBreakdownSchema.nullable(),
});
export type RecommendationDetail = z.infer<typeof RecommendationDetailSchema>;

// ─── Society Score (GET /v1/market-intelligence/societies/{id}/score) ────────
// Fetches a Society's Score directly by society id — used by the Society Profile
// breakdown and the Comparison feature, independent of any search/recommendation flow.

export const NumericRangeSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
});
export type NumericRange = z.infer<typeof NumericRangeSchema>;

export const SocietyScoreResponseSchema = z.object({
  society_id: z.string().uuid(),
  society_name: z.string(),
  confidence_score: z.number().min(0).max(1),
  is_stale: z.boolean(),
  staleness_threshold_days: z.number(),
  affiliation_disclosure: z.string().nullable(),
  derived_from: z.array(z.string()),
  reasoning_summary: z.string(),
  breakdown: ScoreBreakdownSchema.nullable(),
  // FACT data carried straight from the Society entity (not derived from the
  // Score) — included here so the Comparison feature can render price/area
  // without a second endpoint or client-side caching.
  price_range: NumericRangeSchema,
  area_range: NumericRangeSchema,
});
export type SocietyScoreResponse = z.infer<typeof SocietyScoreResponseSchema>;

// ─── Intent (parsed by backend, not in API surface) ──────────────────────────

export interface ParsedIntent {
  city: string | null;
  property_type: PropertyType | null;
  min_price: number | null;
  max_price: number | null;
  min_area_marla: number | null;
  max_area_marla: number | null;
  keywords: string[];
}
