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
    confidence_score: z.number().min(0).max(1),
    is_stale: z.literal(true),
    staleness_threshold_days: z.number(),
    affiliation_disclosure: z.string().nullable(),
  }),
  z.object({
    state: z.literal('NOT_COVERED'),
    recommendations: z.array(z.never()).default([]),
    message: z.string(),
    demand_count: z.number().nullable().default(null),
  }),
]);
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

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
