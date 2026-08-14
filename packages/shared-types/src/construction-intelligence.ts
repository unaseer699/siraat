import { z } from 'zod';
import { RecordTypeSchema } from './market-intelligence';

// ─── POST /v1/construction-intelligence/estimates ─────────────────────────────

export const QualityTierSchema = z.enum(['ECONOMY', 'STANDARD', 'PREMIUM']);
export type QualityTier = z.infer<typeof QualityTierSchema>;

export const EstimateRequestSchema = z.object({
  city: z.string().min(1),
  area_marla: z.number().positive(),
  quality_tier: QualityTierSchema,
});
export type EstimateRequest = z.infer<typeof EstimateRequestSchema>;

// The five core grey-structure materials an estimate is built from. A city needs
// at least one non-stale rate for each of these to reach a FULL estimate.
export const CoreMaterialKeySchema = z.enum(['CEMENT', 'STEEL', 'BRICKS', 'SAND', 'CRUSH']);
export type CoreMaterialKey = z.infer<typeof CoreMaterialKeySchema>;

export const MaterialRateSourceTierSchema = z.enum(['SUPPLIER_VERIFIED', 'MARKET_REFERENCE']);
export type MaterialRateSourceTier = z.infer<typeof MaterialRateSourceTierSchema>;

// One line of the "show your work" breakdown — always present for all 5 core
// materials, even when no rate could be found (unit_rate/subtotal null, is_stale
// true), so the caller can see exactly what's missing rather than a silent gap.
export const EstimateLineItemSchema = z.object({
  material_key: CoreMaterialKeySchema,
  material_name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_rate: z.number().nullable(),
  subtotal: z.number().nullable(),
  source_tier: MaterialRateSourceTierSchema.nullable(),
  source_name: z.string().nullable(),
  recorded_date: z.string().nullable(),
  is_stale: z.boolean(),
});
export type EstimateLineItem = z.infer<typeof EstimateLineItemSchema>;

export const EstimateResponseSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('FULL'),
    id: z.string().uuid(),
    city: z.string(),
    area_marla: z.number(),
    quality_tier: QualityTierSchema,
    line_items: z.array(EstimateLineItemSchema),
    total_estimate: z.number(),
    confidence_score: z.number().min(0).max(1),
    is_stale: z.literal(false),
    staleness_threshold_days: z.number(),
    affiliation_disclosure: z.string().nullable(),
    derived_from: z.array(z.string()),
    record_type: RecordTypeSchema,
    computed_at: z.string().datetime(),
  }),
  z.object({
    state: z.literal('DEGRADED_SUCCESS'),
    id: z.string().uuid(),
    city: z.string(),
    area_marla: z.number(),
    quality_tier: QualityTierSchema,
    line_items: z.array(EstimateLineItemSchema),
    // Deliberately null, not a partial sum — a grand total missing e.g. steel or
    // cement would understate cost badly enough to actively mislead. The honest
    // partial figure is exposed separately as partial_subtotal.
    total_estimate: z.null(),
    partial_subtotal: z.number().nullable(),
    missing_materials: z.array(z.string()),
    confidence_score: z.number().min(0).max(1),
    is_stale: z.literal(true),
    staleness_threshold_days: z.number(),
    affiliation_disclosure: z.string().nullable(),
    derived_from: z.array(z.string()),
    record_type: RecordTypeSchema,
    computed_at: z.string().datetime(),
  }),
  z.object({
    state: z.literal('NOT_COVERED'),
    city: z.string(),
    message: z.string(),
    demand_count: z.number().nullable().default(null),
  }),
]);
export type EstimateResponse = z.infer<typeof EstimateResponseSchema>;
