import { z } from 'zod';
import { RecordTypeSchema } from './market-intelligence';

// ─── POST /v1/construction-intelligence/estimates — MATERIAL + WORKS BOQ ──────
// v1 replaces the original grey-structure-only (5 material) estimate entirely —
// see boq-catalog.ts for the approved Step 0 ratios/formulas this is built from.

export const FinishLevelSchema = z.enum(['ECONOMY', 'STANDARD', 'PREMIUM']);
export type FinishLevel = z.infer<typeof FinishLevelSchema>;

export const BoqAreaUnitSchema = z.enum(['SQFT', 'MARLA']);
export type BoqAreaUnit = z.infer<typeof BoqAreaUnitSchema>;

export const BoqFloorsSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type BoqFloors = z.infer<typeof BoqFloorsSchema>;

export const BoqRequestSchema = z.object({
  city: z.string().min(1),
  area: z.number().positive(),
  area_unit: BoqAreaUnitSchema,
  floors: BoqFloorsSchema,
  basement: z.boolean(),
  finish_level: FinishLevelSchema,
});
export type BoqRequest = z.infer<typeof BoqRequestSchema>;

// The exact 15-item v1 list (Step 0, approved) — 6 Core Materials + 9
// Additional Works & Items. Do not add items beyond this list (brief's own
// constraint) without a fresh Step-0-style review of its ratio/sourcing.
export const BoqItemKeySchema = z.enum([
  // Core Materials
  'CEMENT',
  'STEEL',
  'BRICKS',
  'SAND',
  'CRUSH',
  'PAINT',
  // Additional Works & Items
  'EXCAVATION',
  'BORING',
  'PLUMBING_ROUGH_IN',
  'ELECTRICAL_ROUGH_IN',
  'MARBLE_STAIRS',
  'WINDOWS',
  'DOORS',
  'KITCHEN_WOODWORK',
  'HARDWARE',
]);
export type BoqItemKey = z.infer<typeof BoqItemKeySchema>;

// WHATSAPP INTEGRATION Phase 6a — FIELD_REPORTED: founder/site-reported
// actual purchase prices confirmed over WhatsApp (first-party FACT, not a
// third-party MARKET_REFERENCE price and not a SUPPLIER_VERIFIED quote).
export const MaterialRateSourceTierSchema = z.enum(['SUPPLIER_VERIFIED', 'MARKET_REFERENCE', 'FIELD_REPORTED']);
export type MaterialRateSourceTier = z.infer<typeof MaterialRateSourceTierSchema>;

// ─── SUPPLIER DIRECTORY Chunk 2 ──────────────────────────────────────────────
// Single source of truth for the admin material-rate creation contract and
// its read shape — previously duplicated by hand across
// apps/backend/src/admin/admin.controller.ts's local Zod schema and
// apps/frontend/src/lib/api.ts's hand-mirrored interfaces (each commented
// "Mirrors ..." the other, exactly the silent-drift risk this package exists
// to prevent). source_name is now optional/nullable — required only for
// MARKET_REFERENCE (enforced in ConstructionIntelligenceService.
// createMaterialRate, not here, same pattern as supplier_id's SUPPLIER_VERIFIED
// requirement from Chunk 1).

export const CreateMaterialRateBodySchema = z.object({
  material_name: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().positive(),
  city: z.string().min(1),
  source_tier: MaterialRateSourceTierSchema,
  source_name: z.string().min(1).nullable().default(null),
  source_contact: z.string().min(1).nullable().default(null),
  // UUID string, no SQL FK per Law 2 — references SupplierEntity.id.
  supplier_id: z.string().uuid().nullable().default(null),
  recorded_date: z.string().min(1),
});
export type CreateMaterialRateBody = z.infer<typeof CreateMaterialRateBodySchema>;

export const MaterialRateItemSchema = z.object({
  id: z.string().uuid(),
  material_name: z.string(),
  unit: z.string(),
  price: z.number(),
  city: z.string(),
  source_tier: MaterialRateSourceTierSchema,
  source_name: z.string().nullable(),
  source_contact: z.string().nullable(),
  supplier_id: z.string().uuid().nullable(),
  recorded_date: z.string(),
  record_type: z.literal('FACT'),
  is_stale: z.boolean(),
  staleness_threshold_days: z.number(),
});
export type MaterialRateItem = z.infer<typeof MaterialRateItemSchema>;

// One line of the BOQ table — always present for all 15 items, even the 9
// with no sourced quantity ratio (Step 0 Tier C: available=false, quantity/
// unit_rate/subtotal all null, notes explains why). "Always show quantities"
// per the brief means always show the ROW; it does not mean fabricating a
// number for an item with no defensible ratio — that's exactly what Tier C's
// available=false honestly represents instead.
export const BoqLineItemSchema = z.object({
  item_key: BoqItemKeySchema,
  item_name: z.string(),
  unit: z.string(),
  // null only for Tier C items (available=false) — never a fabricated number.
  quantity: z.number().nullable(),
  unit_rate: z.number().nullable(),
  subtotal: z.number().nullable(),
  source_tier: MaterialRateSourceTierSchema.nullable(),
  source_name: z.string().nullable(),
  recorded_date: z.string().nullable(),
  is_stale: z.boolean(),
  // One of the 6 Core Materials (Step 0's definition of "major") — grand
  // total requires a verified rate for every major item, nothing else.
  is_major: z.boolean(),
  // false = Step 0 Tier C: no standard planning-stage quantity ratio exists
  // for this item in any source found — quantity is intentionally not
  // estimated, not merely "not yet priced" (that's what a null unit_rate on
  // an available=true item means).
  available: z.boolean(),
  notes: z.string().nullable(),
});
export type BoqLineItem = z.infer<typeof BoqLineItemSchema>;

// Discriminated three-state shape per CLAUDE.md Law 4 — kept for architectural
// consistency with every other recommendation/Score-like GENERATED payload in
// this codebase (Law 5's trust telemetry below), even though NOT_COVERED is
// never actually emitted by BoqEstimatorService in v1: quantities are pure
// geometry/ratio math with no dependency on a city having any rate data at
// all, so there is no "nothing to show" condition the old grey-structure-only
// estimate had (that one required at least one rate row to exist before
// returning anything). The type stays three-state so a future capability
// that DOES have a real "not covered" condition doesn't need a breaking change.
export const BoqResponseSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('FULL'),
    id: z.string().uuid(),
    city: z.string(),
    area: z.number(),
    area_unit: BoqAreaUnitSchema,
    // Always the converted covered area in sqft, per "1 marla = 225 sqft"
    // stated on every results page regardless of which unit was entered.
    area_sqft: z.number(),
    floors: BoqFloorsSchema,
    basement: z.boolean(),
    finish_level: FinishLevelSchema,
    line_items: z.array(BoqLineItemSchema),
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
    area: z.number(),
    area_unit: BoqAreaUnitSchema,
    area_sqft: z.number(),
    floors: BoqFloorsSchema,
    basement: z.boolean(),
    finish_level: FinishLevelSchema,
    line_items: z.array(BoqLineItemSchema),
    // Deliberately null, not a partial sum — a grand total missing a major
    // item (e.g. steel or cement) would understate cost badly enough to
    // actively mislead. The honest partial figure is partial_subtotal instead.
    total_estimate: z.null(),
    partial_subtotal: z.number().nullable(),
    missing_major_items: z.array(z.string()),
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
export type BoqResponse = z.infer<typeof BoqResponseSchema>;
