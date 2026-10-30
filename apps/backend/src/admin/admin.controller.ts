import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { GroundReportStatus } from '../ground-reports/ground-report-submission.entity';
import { z } from 'zod';
import {
  TradeCategorySchema,
  SectionCategorySchema,
  ExpenseKindSchema,
  MaterialCategorySchema,
  HousePlanStyleSchema,
  HousePlanImageTypeSchema,
  HousePlanAccessTierSchema,
  CreateMaterialRateBodySchema,
  type CreateMaterialRateBody,
  DocumentTypeSchema,
} from '@siraat/shared-types';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { WhatsappDraftExpenseStatus } from '../whatsapp/entities/whatsapp-draft-expense.entity';
import type { WhatsappDraftListingStatus } from '../whatsapp/entities/whatsapp-draft-listing.entity';
import { AdminService } from './admin.service';
import { looksLikeUrl, officialDocumentUrl } from '../common/official-document-url';

// --- Shared sub-schemas ---

// PRE-DATA-POPULATION REVIEW finding #5 — contact_phone/contact_whatsapp
// accepted literally anything ("n/a", "call me", a 2-digit string), which
// becomes unusable contact info baked into directory listings once real
// data is entered, and is painful to clean up retroactively (no way to
// tell "garbage" from "real but oddly formatted" after the fact). Not a
// strict Pakistan-only format (admins occasionally enter a landline or an
// overseas number) — just a floor: optional leading +, digits/spaces/
// dashes/parens only, and enough digits to be a real phone number.
const PHONE_REGEX = /^\+?[\d\s()-]{7,20}$/;
const PHONE_MIN_DIGITS = 7;

function hasEnoughDigits(value: string): boolean {
  return (value.match(/\d/g)?.length ?? 0) >= PHONE_MIN_DIGITS;
}

const PhoneNumberSchema = z
  .string()
  .trim()
  .min(1)
  .regex(PHONE_REGEX, 'Must be a phone number (digits, spaces, -, (), optional leading +)')
  .refine(hasEnoughDigits, { message: `Must contain at least ${PHONE_MIN_DIGITS} digits` });

const NullableWhatsappNumberSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, 'Must be a phone number (digits, spaces, -, (), optional leading +)')
  .refine(hasEnoughDigits, { message: `Must contain at least ${PHONE_MIN_DIGITS} digits` })
  .nullable();

const CLAIM_TYPES = [
  'NOC',
  'PLANNING_APPROVAL',
  'COMPLETION_CERTIFICATE',
  'SHOW_CAUSE_NOTICE',
  'ILLEGAL_SCHEME_NOTICE',
  'TRANSFER_DEED',
  'MORTGAGE_DEED',
  'OTHER',
] as const;

const EVIDENCE_TYPES = ['document', 'photo', 'receipt', 'inspection_report'] as const;

// EVIDENCE DOCUMENT MODEL Chunk 1 — document_date/document_type both
// optional/nullable: existing evidence-creation calls that only ever sent
// type/file_ref/source_ref (from before EvidenceEditor.tsx collected these,
// Chunk 2) must keep validating identically.
// file_ref is a storage key, or a direct https link to an allow-listed
// official portal (e.g. cda.gov.pk). Any other URL is rejected.
const FileRefSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !looksLikeUrl(v) || officialDocumentUrl(v) !== null, {
    message: 'Links must be https and on an official portal (cda.gov.pk, rda.gop.pk). Otherwise use a storage key.',
  });

const EvidenceItemSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  file_ref: FileRefSchema,
  source_ref: z.string().min(1),
  document_date: z.string().nullable().default(null),
  document_type: DocumentTypeSchema.nullable().default(null),
});
type EvidenceItemBody = z.infer<typeof EvidenceItemSchema>;

// ADMIN CRUD PHASE 1 Chunk 1 — mirrors CandidateSocietyEntity's regulator/status
// union types (candidate-society.entity.ts).
const REGULATORS = ['CDA', 'RDA', 'LDA', 'PDA', 'TMA', 'OTHER'] as const;
const CANDIDATE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'ONBOARDED'] as const;

// A society's price range is stored in full rupees. Anything under 100,000 is a
// Lakh/Crore typed by mistake (48 meaning 48 Lakh) and would show as "PKR 48".
const SocietyPriceSchema = z
  .number()
  .refine((v) => v >= 100_000, {
    message: 'Price must be the full amount in rupees (1.74 Crore is 17400000), not Lakh or Crore',
  });

// --- POST /v1/admin/societies ---

const CreateSocietyBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  city: z.string().trim().min(1).max(100),
  min_price: SocietyPriceSchema.nullable().default(null),
  max_price: SocietyPriceSchema.nullable().default(null),
  min_area_marla: z.number().nullable().default(null),
  max_area_marla: z.number().nullable().default(null),
  property_types: z.array(z.string()).default(['PLOT']),
  noc_approved: z.boolean(),
  base_confidence: z.number().min(0).max(1),
  is_siraat_affiliated: z.boolean(),
  affiliation_disclosure: z.string().nullable().default(null),
  noc_summary: z.string().nullable().default(null),
  // Optional — how the developer_id ↔ Society link actually gets populated
  // going forward. Never required; existing/new societies with no known
  // developer stay developer_id: null.
  developer_id: z.string().uuid().nullable().default(null),
  claim: z.string().min(1),
  claim_type: z.enum(CLAIM_TYPES),
  target_status: z.enum(['VERIFIED', 'PENDING']),
  evidence: z.array(EvidenceItemSchema).default([]),
});
type CreateSocietyBody = z.infer<typeof CreateSocietyBodySchema>;

// --- PATCH /v1/admin/societies/:id ---
// Confidence, affiliation and staleness are intentionally absent.
// '' (or whitespace) clears an optional text field to null.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));
const httpUrl = (max: number) =>
  optionalText(max).refine((v) => v == null || /^https?:\/\/\S+$/i.test(v), {
    message: 'Must start with http:// or https://',
  });

const UpdateSocietyBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  min_price: SocietyPriceSchema.nullable().optional(),
  max_price: SocietyPriceSchema.nullable().optional(),
  min_area_marla: z.number().nonnegative().nullable().optional(),
  max_area_marla: z.number().nonnegative().nullable().optional(),
  property_types: z.array(z.string()).min(1).optional(),
  noc_approved: z.boolean().optional(),
  noc_summary: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  developer_id: z.string().uuid().nullable().optional(),
  // Published registration details
  zone: optionalText(50),
  road: optionalText(255),
  area_kanal: z.number().nonnegative().nullable().optional(),
  owner_name: optionalText(255),
  address: optionalText(1000),
  contact_phones: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  email: optionalText(255).refine((v) => v == null || /^\S+@\S+\.\S+$/.test(v), { message: 'Invalid email' }),
  website: httpUrl(255),
  details_source_url: httpUrl(1000),
});
type UpdateSocietyBody = z.infer<typeof UpdateSocietyBodySchema>;

// --- POST /v1/admin/societies/:id/claims ---

const AddClaimBodySchema = z.object({
  claim: z.string().min(1),
  claim_type: z.enum(CLAIM_TYPES),
  // EVIDENCE DOCUMENT MODEL Chunk 1 — added CANCELLED, matching
  // VerificationEntity.status's widened union.
  target_status: z.enum(['VERIFIED', 'DISPUTED', 'PENDING', 'CANCELLED']),
  evidence: z.array(EvidenceItemSchema).default([]),
});
type AddClaimBody = z.infer<typeof AddClaimBodySchema>;

// --- POST /v1/admin/evidence ---

const CreateEvidenceBodySchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  file_ref: FileRefSchema,
  source_ref: z.string().min(1),
  document_date: z.string().nullable().default(null),
  document_type: DocumentTypeSchema.nullable().default(null),
});
type CreateEvidenceBody = z.infer<typeof CreateEvidenceBodySchema>;

// --- POST /v1/admin/{contractors|suppliers}/:id/verified ---
// One tick for "verified". `note` = how it was checked; required when verifying.
const SetVerifiedBodySchema = z.object({
  verified: z.boolean(),
  note: z.string().trim().max(300).optional(),
});
type SetVerifiedBody = z.infer<typeof SetVerifiedBodySchema>;

// --- POST /v1/admin/material-rates ---
// CreateMaterialRateBodySchema now lives in @siraat/shared-types (SUPPLIER
// DIRECTORY Chunk 2) — single source of truth, previously duplicated by hand
// here and in apps/frontend/src/lib/api.ts's MaterialRateItem/
// CreateMaterialRateBody interfaces.

// --- POST /v1/admin/contractors (CONTRACTOR DIRECTORY Chunk 2) ---

const CreateContractorBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  trade_categories: z.array(TradeCategorySchema).min(1),
  service_cities: z.array(z.string().min(1)).min(1),
  contact_phone: PhoneNumberSchema,
  contact_whatsapp: NullableWhatsappNumberSchema.default(null),
  is_siraat_affiliated: z.boolean().default(false),
});
type CreateContractorBody = z.infer<typeof CreateContractorBodySchema>;

// --- PATCH /v1/admin/contractors/:id, /v1/admin/suppliers/:id --- all fields optional.
const UpdateContractorBodySchema = CreateContractorBodySchema.partial().omit({ is_siraat_affiliated: true }).extend({ is_siraat_affiliated: z.boolean().optional() });
type UpdateContractorBody = z.infer<typeof UpdateContractorBodySchema>;

// --- POST /v1/admin/suppliers (SUPPLIER DIRECTORY Chunk 2) ---
// Same shape/organization as CreateContractorBodySchema above.

const CreateSupplierBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  material_categories: z.array(MaterialCategorySchema).min(1),
  service_cities: z.array(z.string().min(1)).min(1),
  contact_phone: PhoneNumberSchema,
  contact_whatsapp: NullableWhatsappNumberSchema.default(null),
  other_phones: z.array(PhoneNumberSchema).max(8).default([]),
  address: z.string().trim().max(500).nullable().default(null),
  location_url: z
    .string()
    .trim()
    .max(1000)
    .regex(/^https?:\/\//i, 'Must be a link starting with http:// or https://')
    .nullable()
    .default(null),
  is_siraat_affiliated: z.boolean().default(false),
});
type CreateSupplierBody = z.infer<typeof CreateSupplierBodySchema>;

const UpdateSupplierBodySchema = CreateSupplierBodySchema.partial().omit({ is_siraat_affiliated: true }).extend({ is_siraat_affiliated: z.boolean().optional() });
type UpdateSupplierBody = z.infer<typeof UpdateSupplierBodySchema>;

// --- POST /v1/admin/house-plans (HOUSE PLANS DIRECTORY Chunk 1) ---

// HOUSE PLANS DIRECTORY Chunk 2 — preview_image_ref now defaults to '' (was
// required, min(1)) so the admin form can create the plan first and then
// upload its image as a second call against the now-known plan id (POST
// .../:id/upload-image below persists the resulting key). An empty string is
// the "no image yet" sentinel throughout — not nullable, since the column
// itself never was; the frontend simply skips rendering a preview when it's ''.
const CreateHousePlanBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  area_marla: z.number().positive(),
  bedrooms: z.number().int().nonnegative(),
  style: HousePlanStyleSchema,
  preview_image_ref: z.string().default(''),
  description: z.string().trim().min(1).max(2000),
  contact_whatsapp: PhoneNumberSchema,
  is_siraat_affiliated: z.boolean().default(false),
});
type CreateHousePlanBody = z.infer<typeof CreateHousePlanBodySchema>;

// --- POST /v1/admin/house-plans/:id/upload-image ---
// No multipart parsing (Fastify adapter, no @fastify/multipart plugin
// installed) — the file travels as a base64 string in a JSON body instead.

const UploadHousePlanImageBodySchema = z.object({
  filename: z.string().min(1),
  content_type: z.string().min(1),
  data_base64: z.string().min(1),
});
type UploadHousePlanImageBody = z.infer<typeof UploadHousePlanImageBodySchema>;

// --- PATCH /v1/admin/house-plans/:id (ADMIN CRUD PHASE 1 Chunk 1) ---
// All fields optional (partial update). preview_image_ref is deliberately
// absent — that's upload-image's job, not this route's.

const UpdateHousePlanBodySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  area_marla: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  style: HousePlanStyleSchema.optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  contact_whatsapp: PhoneNumberSchema.optional(),
  is_siraat_affiliated: z.boolean().optional(),
});
type UpdateHousePlanBody = z.infer<typeof UpdateHousePlanBodySchema>;

// --- POST /v1/admin/house-plans/:id/images (HOUSE PLAN GALLERY) ---
// Creates the metadata row (type/tier/price) only — same two-step shape as
// create-plan-then-upload-image above. price is required for every image
// (FREE images are typically 0, but the admin sets it explicitly — no
// implicit default that could hide a forgotten price on a GATED image).

const CreateHousePlanImageBodySchema = z.object({
  image_type: HousePlanImageTypeSchema,
  access_tier: HousePlanAccessTierSchema.default('FREE'),
  price: z.number().nonnegative(),
  display_order: z.number().int().nonnegative().default(0),
});
type CreateHousePlanImageBody = z.infer<typeof CreateHousePlanImageBodySchema>;

// --- POST /v1/admin/house-plans/:id/images/:imageId/upload ---
// Same base64-JSON-body shape as UploadHousePlanImageBodySchema above (no
// multipart plugin on this Fastify app).

const UploadHousePlanImageFileBodySchema = z.object({
  filename: z.string().min(1),
  content_type: z.string().min(1),
  data_base64: z.string().min(1),
});
type UploadHousePlanImageFileBody = z.infer<typeof UploadHousePlanImageFileBodySchema>;

// --- PATCH /v1/admin/house-plans/:id/images/:imageId ---
// Partial update for tier/price/ordering — never the file itself (that's
// the upload route's job).

const UpdateHousePlanImageBodySchema = z.object({
  access_tier: HousePlanAccessTierSchema.optional(),
  price: z.number().nonnegative().optional(),
  display_order: z.number().int().nonnegative().optional(),
});
type UpdateHousePlanImageBody = z.infer<typeof UpdateHousePlanImageBodySchema>;

// --- POST /v1/admin/house-plans/:id/images/:imageId/upload-url ---
// Large-file path (a 3D-render PDF can be several MB) — see
// StorageService.getPresignedUploadUrl for why this exists alongside the
// base64 /upload route above, which stays for small images. Returns a
// presigned PUT URL the browser uploads the raw file bytes to directly,
// never touching this app's own request body limit.

const RequestHousePlanImageUploadUrlBodySchema = z.object({
  filename: z.string().min(1),
  content_type: z.string().min(1),
});
type RequestHousePlanImageUploadUrlBody = z.infer<typeof RequestHousePlanImageUploadUrlBodySchema>;

// --- POST /v1/admin/house-plans/:id/images/:imageId/finalize-upload ---
// Called after the browser's direct PUT to the presigned URL succeeds —
// persists storage_ref/content_type the same way the base64 /upload route
// does, just without having carried the file through this server.

const FinalizeHousePlanImageUploadBodySchema = z.object({
  key: z.string().min(1),
  content_type: z.string().min(1),
});
type FinalizeHousePlanImageUploadBody = z.infer<typeof FinalizeHousePlanImageUploadBodySchema>;

// --- PATCH /v1/admin/candidate-societies/:id (ADMIN CRUD PHASE 1 Chunk 1) ---
// All fields optional (partial update) — status is the field this exists
// for (manual override, e.g. reverting an accidental ONBOARDED back to
// NOT_STARTED), but name/regulator/city are correctable too.

const UpdateCandidateSocietyBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  regulator: z.enum(REGULATORS).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  status: z.enum(CANDIDATE_STATUSES).optional(),
});
type UpdateCandidateSocietyBody = z.infer<typeof UpdateCandidateSocietyBodySchema>;

// --- POST /v1/admin/projects (PROJECT COST TRACKER Chunk 1) ---

const PROJECT_STATUSES = ['ACTIVE', 'COMPLETE', 'ON_HOLD'] as const;

const CreateProjectBodySchema = z.object({
  name: z.string().min(1),
  // UUID string, no SQL FK per Law 2 — optional link to a Society/Property.
  property_ref: z.string().uuid().nullable().default(null),
  owner_contact: z.string().min(1),
  start_date: z.string().min(1),
  status: z.enum(PROJECT_STATUSES).default('ACTIVE'),
  // WHATSAPP INTEGRATION Phase 6a follow-up — MARKET OBSERVATIONS. Optional,
  // defaults to null so existing create-project callers/tests are unaffected.
  city: z.string().min(1).nullable().default(null),
});
type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;

// --- PATCH /v1/admin/projects/:id (PROJECT EDIT) ---
// Administrative metadata only — start_date/property_ref/record_type/id stay
// fixed. Unknown/non-editable keys are silently stripped by z.object's
// default ("strip unknown keys") behavior, same as every other schema in
// this file — a body containing only non-editable keys is therefore
// equivalent to an empty body and rejected by the refine below.
// name/owner_contact trim + reject-empty-after-trim + max length, same
// 100-char ceiling as city's existing check just below — unlike city, an
// empty result here is rejected rather than treated as "clear the field":
// name/owner_contact have no honest empty state to clear to.
const UpdateProjectBodySchema = z
  .object({
    name: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => v.length > 0, { message: 'name must not be empty' })
      .refine((v) => v.length <= 100, { message: 'name must be at most 100 characters' })
      .optional(),
    city: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => v.length <= 100, { message: 'city must be at most 100 characters' })
      .transform((v) => (v === '' ? null : v))
      .optional(),
    owner_contact: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => v.length > 0, { message: 'owner_contact must not be empty' })
      .refine((v) => v.length <= 100, { message: 'owner_contact must be at most 100 characters' })
      .optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    boq_template: z.enum(['5_MARLA']).nullable().optional(),
    is_public: z.boolean().optional(),
    public_title: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => v.length <= 100, { message: 'public_title must be at most 100 characters' })
      .transform((v) => (v === '' ? null : v))
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>;

// --- POST /v1/admin/projects/:id/sections ---
// category reuses the shared TradeCategorySchema (now extended with
// KITCHEN_WORK/MISCELLANEOUS) rather than a separate enum.

const CreateSectionBodySchema = z.object({
  category: SectionCategorySchema,
  display_order: z.number().int().nonnegative(),
});
type CreateSectionBody = z.infer<typeof CreateSectionBodySchema>;

// --- POST /v1/admin/sections/:id/expenses ---
// amount is deliberately NOT constrained to positive — a correction to a
// prior expense is a new row with a negative amount, OR (EXPENSE EDIT/DELETE
// Chunk 1) via PATCH below, which supersedes rather than edits in place —
// see ConstructionProjectService.editExpense. Law 3 still holds: no route
// anywhere overwrites amount/description/date/etc. on an existing row.
//
// EXPENSE QUANTITY/RATE Chunk 1 — amount is now nullable/optional here: the
// "amount required unless quantity+rate both present" rule is enforced in
// ConstructionProjectService.resolveActualCost, not here — Zod's job is
// shaping individual fields, not that cross-field business rule (single
// source of truth, no duplicated validation between layers). unit is a
// closed enum, never free-text.

const EXPENSE_UNITS = ['PCS', 'KG', 'TON', 'BAG', 'CFT', 'SFT', 'RFT', 'LTR'] as const;

// WHATSAPP INTEGRATION Phase 5 — DASHBOARD WIRING. Accepted here mainly so
// this schema stays the single shape createExpense/editExpense accept —
// in practice this admin-facing create path leaves it at the null default;
// 'WHATSAPP' is set by WhatsappConfirmationService.confirmDraft, which
// calls ConstructionProjectService.createExpense directly, not through
// this HTTP body.
const EXPENSE_SOURCES = ['WHATSAPP', 'MANUAL'] as const;

const CreateExpenseBodySchema = z.object({
  expense_date: z.string().min(1),
  description: z.string().min(1),
  vendor_name: z.string().min(1),
  vendor_contact: z.string().nullable().default(null),
  linked_contractor_id: z.string().uuid().nullable().default(null),
  linked_supplier_id: z.string().uuid().nullable().default(null),
  amount: z.number().nullable().default(null),
  quantity: z.number().nullable().default(null),
  unit: z.enum(EXPENSE_UNITS).nullable().default(null),
  rate: z.number().nullable().default(null),
  source: z.enum(EXPENSE_SOURCES).nullable().default(null),
  paid_by: z.string().max(100).nullable().optional(),
  kind: ExpenseKindSchema.nullable().optional(),
});
type CreateExpenseBody = z.infer<typeof CreateExpenseBodySchema>;

// --- PATCH /v1/admin/projects/:projectId/expenses/:id (EXPENSE EDIT/DELETE Chunk 1) ---
// Same field shape as create — this isn't a partial update, it's the full
// replacement content for the new superseding row (see editExpense).
const EditExpenseBodySchema = CreateExpenseBodySchema;
type EditExpenseBody = z.infer<typeof EditExpenseBodySchema>;

// --- POST /v1/admin/projects/:projectId/expenses/move ---
const MoveExpensesBodySchema = z.object({
  expense_ids: z.array(z.string().uuid()).min(1).max(200),
  category: SectionCategorySchema,
  kind: ExpenseKindSchema.nullable().optional(),
});
type MoveExpensesBody = z.infer<typeof MoveExpensesBodySchema>;

// --- Layout & forecast ---
const LayoutBodySchema = z.object({
  floors: z.array(z.object({ name: z.string().min(1).max(60), area_sqft: z.number().positive().max(100000), drawing_area_sqft: z.number().positive().max(100000).nullable().optional(), allowed_area_sqft: z.number().positive().max(100000).nullable().optional() })).min(1).max(10),
  finish_level: z.enum(['BASIC', 'STANDARD', 'PREMIUM']),
  price_factors: z.record(z.enum(['STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER']), z.number().min(0.5).max(2)).nullable().optional(),
  source_note: z.string().max(255).nullable().optional(),
  extras: z
    .object({
      boundary_wall: z.object({ length_ft: z.number().positive().max(100000), rate_per_ft: z.number().positive().max(1000000) }).nullable().optional(),
      items: z.array(z.object({ kind: z.enum(['FRONT_SHADE', 'BACK_SHADE', 'BALCONY', 'PORCH']), name: z.string().min(1).max(60), area_sqft: z.number().positive().max(100000) })).max(20).optional(),
    })
    .nullable()
    .optional(),
});
type LayoutBody = z.infer<typeof LayoutBodySchema>;

// --- POST /v1/admin/projects/:projectId/layout/progress ---
const ProgressBodySchema = z.object({
  progress: z.record(z.enum(['STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER']), z.number().min(0).max(100)),
});
type ProgressBody = z.infer<typeof ProgressBodySchema>;

// --- Market rates ---
const SaveMarketRatesBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string(), z.number().positive()),
});
type SaveMarketRatesBody = z.infer<typeof SaveMarketRatesBodySchema>;
const SetBaselineBodySchema = z.object({ key: z.string().min(1).max(30), rate: z.number().positive() });
type SetBaselineBody = z.infer<typeof SetBaselineBodySchema>;

// --- POST /v1/admin/whatsapp/diagnose ---
const WhatsappDiagnoseBodySchema = z.object({ to: z.string().regex(/^\d{8,15}$/).nullable().optional() });
type WhatsappDiagnoseBody = z.infer<typeof WhatsappDiagnoseBodySchema>;

// --- Project documents ---
const DocUploadUrlBodySchema = z.object({ filename: z.string().min(1).max(200), content_type: z.string().min(1) });
type DocUploadUrlBody = z.infer<typeof DocUploadUrlBodySchema>;
const DocFinalizeBodySchema = z.object({
  key: z.string().min(1),
  content_type: z.string().min(1),
  kind: z.enum(['ARCHITECTURAL', 'STRUCTURAL', 'ELECTRICAL', 'PLUMBING', 'SOIL', 'OTHER']),
  title: z.string().trim().min(1).max(200),
  visible_to_owner: z.boolean(),
});
type DocFinalizeBody = z.infer<typeof DocFinalizeBodySchema>;
const DocVisibilityBodySchema = z.object({ visible_to_owner: z.boolean() });
type DocVisibilityBody = z.infer<typeof DocVisibilityBodySchema>;
const BillUploadUrlBodySchema = z.object({ filename: z.string().min(1).max(200), content_type: z.string().min(1) });
type BillUploadUrlBody = z.infer<typeof BillUploadUrlBodySchema>;
const BillAttachBodySchema = z.object({
  key: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  content_type: z.string().min(1),
  visible_to_owner: z.boolean().default(false),
});
type BillAttachBody = z.infer<typeof BillAttachBodySchema>;
const DocKindBodySchema = z.object({ kind: z.enum(['ARCHITECTURAL', 'STRUCTURAL', 'ELECTRICAL', 'PLUMBING', 'SOIL', 'OTHER']) });
type DocKindBody = z.infer<typeof DocKindBodySchema>;

// --- POST /v1/admin/projects/:projectId/import-expenses ---
const ImportExpensesBodySchema = z.object({
  lines: z
    .array(
      z.object({
        category: SectionCategorySchema,
        kind: ExpenseKindSchema.nullable().optional(),
        description: z.string().min(1).max(500),
        vendor_name: z.string().max(255).nullable().optional(),
        amount: z.number().positive(),
        quantity: z.number().nullable().optional(),
        unit: z.enum(EXPENSE_UNITS).nullable().optional(),
        expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        paid_by: z.string().max(100).nullable().optional(),
      }),
    )
    .min(1)
    .max(1000),
});
type ImportExpensesBody = z.infer<typeof ImportExpensesBodySchema>;

// --- DELETE /v1/admin/projects/:projectId/expenses/:id (EXPENSE EDIT/DELETE Chunk 1) ---
// Voids the row (status = VOID) rather than deleting it — reason is
// mandatory so void_reason is never blank.
const VoidExpenseBodySchema = z.object({
  reason: z.string().min(1),
});
type VoidExpenseBody = z.infer<typeof VoidExpenseBodySchema>;

// --- POST /v1/admin/whatsapp-mappings (WHATSAPP INTEGRATION Phase 1) ---
// wa_id is Meta's sender identifier: digits only, no '+' (matches what
// arrives in the webhook payload's messages[].from — see WhatsappService).

const CreateWhatsappMappingBodySchema = z.object({
  wa_id: z.string().regex(/^\d{6,32}$/, 'wa_id must be digits only (no +, spaces, or dashes)'),
  project_ref: z.string().uuid(),
  created_by: z.string().min(1),
});
type CreateWhatsappMappingBody = z.infer<typeof CreateWhatsappMappingBodySchema>;

const SetWhatsappAccountBodySchema = z.object({
  wa_id: z.string().regex(/^\d{6,32}$/, 'wa_id must be digits only (no +, spaces, or dashes)'),
  plan: z.enum(['TRIAL', 'PAID', 'BLOCKED']),
  paid_until: z.string().datetime().nullable().default(null),
  trial_expense_limit: z.number().int().min(0).max(1000).optional(),
});
type SetWhatsappAccountBody = z.infer<typeof SetWhatsappAccountBodySchema>;

// --- POST /v1/admin/whatsapp-drafts/:id/void (WHATSAPP INTEGRATION Phase 4) ---
// `reason` is optional (unlike VoidExpenseBodySchema's mandatory one above)
// per the brief — the admin isn't required to explain why a stuck draft is
// being voided.
const VoidWhatsappDraftBodySchema = z.object({
  reason: z.string().min(1).nullable().default(null),
});
type VoidWhatsappDraftBody = z.infer<typeof VoidWhatsappDraftBodySchema>;

// --- POST /v1/admin/whatsapp-suggested-links/:id/approve (WHATSAPP INTEGRATION Phase 6b) ---
// At most one of contractor_id/supplier_id — an override for a wrong or
// missing auto-match; both default to null (use the suggestion's own
// matched_contractor_id/matched_supplier_id) enforced in
// WhatsappBusinessLinkService.approve, not here (cross-field rule, same
// division of labor as CreateExpenseBodySchema's amount/quantity/rate).
const ApproveWhatsappSuggestedLinkBodySchema = z.object({
  contractor_id: z.string().uuid().nullable().default(null),
  supplier_id: z.string().uuid().nullable().default(null),
});
type ApproveWhatsappSuggestedLinkBody = z.infer<typeof ApproveWhatsappSuggestedLinkBodySchema>;

// --- POST /v1/admin/whatsapp-suggested-links/:id/reject (WHATSAPP INTEGRATION Phase 6b) ---
// Same optional-reason shape as VoidWhatsappDraftBodySchema above.
const RejectWhatsappSuggestedLinkBodySchema = z.object({
  reason: z.string().min(1).nullable().default(null),
});
type RejectWhatsappSuggestedLinkBody = z.infer<typeof RejectWhatsappSuggestedLinkBodySchema>;

// --- POST /v1/admin/whatsapp-listing-forwarders (WHATSAPP LISTING INGESTION) ---
// Same wa_id shape as CreateWhatsappMappingBodySchema above (digits only, no
// '+', matching Meta's webhook messages[].from) — no project_ref, since a
// listing forwarder has no construction project.
const CreateListingForwarderBodySchema = z.object({
  wa_id: z.string().regex(/^\d{6,32}$/, 'wa_id must be digits only (no +, spaces, or dashes)'),
  label: z.string().min(1),
  created_by: z.string().min(1),
});
type CreateListingForwarderBody = z.infer<typeof CreateListingForwarderBodySchema>;

// --- POST /v1/admin/whatsapp-listing-drafts/:id/publish ---
// contact_phone is optional and nullable: omitted = keep the draft's own
// (AI-extracted) number, null = publish with none, string = admin correction.
const PublishWhatsappListingDraftBodySchema = z.object({
  contact_phone: NullableWhatsappNumberSchema.optional(),
});
type PublishWhatsappListingDraftBody = z.infer<typeof PublishWhatsappListingDraftBodySchema>;

// --- POST /v1/admin/whatsapp-listing-drafts/:id/reject (WHATSAPP LISTING INGESTION) ---
// Same optional-reason shape as VoidWhatsappDraftBodySchema above.
const RejectWhatsappListingDraftBodySchema = z.object({
  reason: z.string().min(1).nullable().default(null),
});
type RejectWhatsappListingDraftBody = z.infer<typeof RejectWhatsappListingDraftBodySchema>;

// --- Controller ---

@Controller('v1/admin')
@UseGuards(BearerGuard)
export class AdminController {
  constructor(private readonly adminSvc: AdminService) {}

  @Get('candidate-societies')
  listCandidateSocieties(@Query('status') status?: string) {
    return this.adminSvc.listCandidateSocieties(status);
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — Candidate Societies are a todo-list with no
  // Trust/Observation history pointing at them, so update/delete is safe
  // here in a way it would not be for Society/Developer/Contractor/Supplier.
  @Patch('candidate-societies/:id')
  updateCandidateSociety(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCandidateSocietyBodySchema)) body: UpdateCandidateSocietyBody,
  ) {
    return this.adminSvc.updateCandidateSociety(id, body);
  }

  @Delete('candidate-societies/:id')
  @HttpCode(204)
  deleteCandidateSociety(@Param('id') id: string) {
    return this.adminSvc.deleteCandidateSociety(id);
  }

  // DUPLICATE SOCIETY PREVENTION — powers new-society/page.tsx's live
  // name+city duplicate-check, before the operator ever submits.
  @Get('societies/search')
  searchSocieties(@Query('name') name?: string, @Query('city') city?: string) {
    return this.adminSvc.searchSocieties(name ?? '', city ?? '');
  }

  @Post('societies')
  @HttpCode(201)
  createSociety(
    @Body(new ZodValidationPipe(CreateSocietyBodySchema)) body: CreateSocietyBody,
  ) {
    return this.adminSvc.createSocietyWithFirstClaim(body);
  }

  @Get('societies/:id')
  getSociety(@Param('id') id: string) {
    return this.adminSvc.getSociety(id);
  }

  @Patch('societies/:id')
  updateSociety(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSocietyBodySchema)) body: UpdateSocietyBody,
  ) {
    return this.adminSvc.updateSociety(id, body);
  }

  @Post('societies/:id/claims')
  @HttpCode(201)
  addClaimToSociety(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddClaimBodySchema)) body: AddClaimBody,
  ) {
    return this.adminSvc.addClaim({ ...body, subject_type: 'SOCIETY', subject_id: id });
  }

  // CONTRACTOR DIRECTORY Chunk 2 — same claim-adding flow as Society, just a
  // different subject_type; both routes call the same generalized
  // AdminService.addClaim().
  @Post('contractors/:id/claims')
  @HttpCode(201)
  addClaimToContractor(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddClaimBodySchema)) body: AddClaimBody,
  ) {
    return this.adminSvc.addClaim({ ...body, subject_type: 'CONTRACTOR', subject_id: id });
  }

  @Patch('contractors/:id')
  updateContractor(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateContractorBodySchema)) body: UpdateContractorBody,
  ) {
    return this.adminSvc.updateContractor(id, body);
  }

  @Delete('contractors/:id')
  @HttpCode(204)
  async deleteContractor(@Param('id') id: string) {
    await this.adminSvc.deleteContractor(id);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSupplierBodySchema)) body: UpdateSupplierBody,
  ) {
    return this.adminSvc.updateSupplier(id, body);
  }

  @Delete('suppliers/:id')
  @HttpCode(204)
  async deleteSupplier(@Param('id') id: string) {
    await this.adminSvc.deleteSupplier(id);
  }

  @Post('contractors/:id/verified')
  @HttpCode(200)
  setContractorVerified(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetVerifiedBodySchema)) body: SetVerifiedBody,
  ) {
    return this.adminSvc.setSubjectVerified('CONTRACTOR', id, body.verified, body.note);
  }

  @Post('suppliers/:id/verified')
  @HttpCode(200)
  setSupplierVerified(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetVerifiedBodySchema)) body: SetVerifiedBody,
  ) {
    return this.adminSvc.setSubjectVerified('SUPPLIER', id, body.verified, body.note);
  }

  // SUPPLIER DIRECTORY Chunk 2 — same generalized addClaim() flow, just a
  // different subject_type again.
  @Post('suppliers/:id/claims')
  @HttpCode(201)
  addClaimToSupplier(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddClaimBodySchema)) body: AddClaimBody,
  ) {
    return this.adminSvc.addClaim({ ...body, subject_type: 'SUPPLIER', subject_id: id });
  }

  @Post('evidence')
  @HttpCode(201)
  createEvidence(
    @Body(new ZodValidationPipe(CreateEvidenceBodySchema)) body: CreateEvidenceBody,
  ) {
    return this.adminSvc.createEvidence(body);
  }

  // ADD EVIDENCE TO EXISTING CLAIM — the one admin action for adding a
  // second (or third...) piece of evidence to a claim that already exists.
  // Same EvidenceItemSchema every other evidence-item payload uses (society/
  // contractor/supplier claim forms) — reused, not re-declared.
  @Post('verifications/:verificationId/evidence')
  @HttpCode(201)
  addEvidenceToVerification(
    @Param('verificationId') verificationId: string,
    @Body(new ZodValidationPipe(EvidenceItemSchema)) body: EvidenceItemBody,
  ) {
    return this.adminSvc.addEvidenceToVerification(verificationId, body);
  }

  @Post('verifications/:verificationId/status')
  @HttpCode(200)
  setClaimStatus(
    @Param('verificationId') verificationId: string,
    @Body(new ZodValidationPipe(z.object({ status: z.enum(['VERIFIED', 'DISPUTED', 'CANCELLED']) })))
    body: { status: 'VERIFIED' | 'DISPUTED' | 'CANCELLED' },
  ) {
    return this.adminSvc.setClaimStatus(verificationId, body.status);
  }

  @Post('material-rates')
  @HttpCode(201)
  createMaterialRate(
    @Body(new ZodValidationPipe(CreateMaterialRateBodySchema)) body: CreateMaterialRateBody,
  ) {
    return this.adminSvc.createMaterialRate(body);
  }

  @Get('material-rates')
  listMaterialRates(@Query('city') city?: string, @Query('material') material?: string) {
    return this.adminSvc.listMaterialRates({ city, material });
  }

  // DEVELOPER-SOCIETY LINK Chunk 3 — powers the admin new-society developer
  // search-as-you-type field.
  @Get('developers')
  searchDevelopers(@Query('search') search?: string) {
    return this.adminSvc.searchDevelopers(search ?? '');
  }

  // PROJECT COST TRACKER Chunk 2 — search-as-you-type by name, same pattern
  // as GET /developers / GET /suppliers/search above; powers the contractor
  // picker on the admin project expense form. Declared before the paginated
  // GET /contractors below for reading order only — distinct literal paths,
  // no route-matching ambiguity.
  @Get('contractors/search')
  searchContractorsByName(@Query('q') q?: string) {
    return this.adminSvc.searchContractorsByName(q ?? '');
  }

  // CONTRACTOR DIRECTORY Chunk 2 — admin entry, same shape as POST /societies.
  @Post('contractors')
  @HttpCode(201)
  createContractor(
    @Body(new ZodValidationPipe(CreateContractorBodySchema)) body: CreateContractorBody,
  ) {
    return this.adminSvc.createContractor(body);
  }

  // CONTRACTOR DIRECTORY Chunk 2 — admin list view, same pattern as GET /material-rates.
  @Get('contractors')
  searchContractors(
    @Query('trade_category') trade_category?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminSvc.searchContractors({
      trade_category,
      city,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // SUPPLIER DIRECTORY Chunk 2b — search-as-you-type by name, same pattern as
  // GET /developers above; powers the supplier picker on the material-rate
  // form. Declared before the paginated GET /suppliers below only for
  // reading order — as a distinct literal path ('suppliers/search' vs
  // 'suppliers') there's no route-matching ambiguity between the two.
  @Get('suppliers/search')
  searchSuppliersByName(@Query('q') q?: string) {
    return this.adminSvc.searchSuppliersByName(q ?? '');
  }

  // SUPPLIER DIRECTORY Chunk 2 — admin entry, same shape as POST /contractors.
  @Post('suppliers')
  @HttpCode(201)
  createSupplier(
    @Body(new ZodValidationPipe(CreateSupplierBodySchema)) body: CreateSupplierBody,
  ) {
    return this.adminSvc.createSupplier(body);
  }

  // SUPPLIER DIRECTORY Chunk 2 — admin list view, same pattern as GET /contractors.
  @Get('suppliers')
  searchSuppliers(
    @Query('material_category') material_category?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminSvc.searchSuppliers({
      material_category,
      city,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // HOUSE PLANS DIRECTORY Chunk 1 — admin entry, same shape as POST /suppliers.
  @Post('house-plans')
  @HttpCode(201)
  createHousePlan(
    @Body(new ZodValidationPipe(CreateHousePlanBodySchema)) body: CreateHousePlanBody,
  ) {
    return this.adminSvc.createHousePlan(body);
  }

  // HOUSE PLANS DIRECTORY Chunk 1 — admin list view, same pagination pattern
  // as GET /contractors / GET /suppliers above.
  @Get('house-plans')
  searchHousePlans(
    @Query('area_marla_min') area_marla_min?: string,
    @Query('area_marla_max') area_marla_max?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('style') style?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminSvc.searchHousePlans({
      area_marla_min: area_marla_min !== undefined ? Number(area_marla_min) : undefined,
      area_marla_max: area_marla_max !== undefined ? Number(area_marla_max) : undefined,
      bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
      style,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // HOUSE PLANS DIRECTORY Chunk 1 — minimal image upload; no upload endpoint
  // existed anywhere prior to this (StorageService only ever read
  // pre-existing, manually-uploaded files). Base64 JSON body, not
  // multipart/form-data — see UploadHousePlanImageBodySchema above.
  @Post('house-plans/:id/upload-image')
  uploadHousePlanImage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UploadHousePlanImageBodySchema)) body: UploadHousePlanImageBody,
  ) {
    return this.adminSvc.uploadHousePlanImage(id, body);
  }

  // Large-file path for the cover image — same reasoning as the gallery's
  // upload-url/finalize-upload pair below (Vercel's 4.5MB serverless body
  // cap). Added once a real cover-image upload tripped it in production;
  // the base64 route above stays for any other caller.
  @Post('house-plans/:id/upload-image-url')
  requestHousePlanPreviewUploadUrl(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RequestHousePlanImageUploadUrlBodySchema)) body: RequestHousePlanImageUploadUrlBody,
  ) {
    return this.adminSvc.requestHousePlanPreviewImageUploadUrl(id, body);
  }

  @Post('house-plans/:id/finalize-image-upload')
  finalizeHousePlanPreviewUpload(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FinalizeHousePlanImageUploadBodySchema)) body: FinalizeHousePlanImageUploadBody,
  ) {
    return this.adminSvc.finalizeHousePlanPreviewImageUpload(id, body);
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — PATCH /v1/admin/house-plans/:id. Any field
  // except preview_image_ref (that's upload-image's job, above).
  @Patch('house-plans/:id')
  updateHousePlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateHousePlanBodySchema)) body: UpdateHousePlanBody,
  ) {
    return this.adminSvc.updateHousePlan(id, body);
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — DELETE /v1/admin/house-plans/:id. Also
  // cleans up the stored preview image via StorageService (see
  // AdminService.deleteHousePlan) so this doesn't leave an orphaned file in
  // MinIO/DO Spaces.
  @Delete('house-plans/:id')
  @HttpCode(204)
  deleteHousePlan(@Param('id') id: string) {
    return this.adminSvc.deleteHousePlan(id);
  }

  // ─── HOUSE PLAN GALLERY ──────────────────────────────────────────────────
  // Elevations + 3D render images, each tagged with a type and an access
  // tier (FREE/GATED) with a required price — see CreateHousePlanImageBodySchema.

  @Post('house-plans/:id/images')
  @HttpCode(201)
  createHousePlanImage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateHousePlanImageBodySchema)) body: CreateHousePlanImageBody,
  ) {
    return this.adminSvc.createHousePlanImage(id, body);
  }

  @Get('house-plans/:id/images')
  listHousePlanImages(@Param('id') id: string) {
    return this.adminSvc.listHousePlanImages(id);
  }

  // Same two-step shape as upload-image above — base64 JSON body, sets
  // storage_ref on an already-created image row.
  @Post('house-plans/:id/images/:imageId/upload')
  uploadHousePlanImageFile(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body(new ZodValidationPipe(UploadHousePlanImageFileBodySchema)) body: UploadHousePlanImageFileBody,
  ) {
    return this.adminSvc.uploadHousePlanImageFile(id, imageId, body);
  }

  @Post('house-plans/:id/images/:imageId/upload-url')
  requestHousePlanImageUploadUrl(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body(new ZodValidationPipe(RequestHousePlanImageUploadUrlBodySchema)) body: RequestHousePlanImageUploadUrlBody,
  ) {
    return this.adminSvc.requestHousePlanImageUploadUrl(id, imageId, body);
  }

  @Post('house-plans/:id/images/:imageId/finalize-upload')
  finalizeHousePlanImageUpload(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body(new ZodValidationPipe(FinalizeHousePlanImageUploadBodySchema)) body: FinalizeHousePlanImageUploadBody,
  ) {
    return this.adminSvc.finalizeHousePlanImageUpload(id, imageId, body);
  }

  @Patch('house-plans/:id/images/:imageId')
  updateHousePlanImage(
    @Param('imageId') imageId: string,
    @Body(new ZodValidationPipe(UpdateHousePlanImageBodySchema)) body: UpdateHousePlanImageBody,
  ) {
    return this.adminSvc.updateHousePlanImage(imageId, body);
  }

  @Delete('house-plans/:id/images/:imageId')
  @HttpCode(204)
  deleteHousePlanImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.adminSvc.deleteHousePlanImage(id, imageId);
  }

  // ─── PROJECT COST TRACKER Chunk 1 ────────────────────────────────────────

  @Post('projects')
  @HttpCode(201)
  createProject(@Body(new ZodValidationPipe(CreateProjectBodySchema)) body: CreateProjectBody) {
    return this.adminSvc.createProject(body);
  }

  @Patch('projects/:id')
  updateProject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectBodySchema)) body: UpdateProjectBody,
  ) {
    return this.adminSvc.updateProject(id, body);
  }

  @Delete('projects/:id')
  @HttpCode(204)
  deleteProject(@Param('id') id: string) {
    return this.adminSvc.deleteProject(id);
  }

  // ADMIN PROJECTS LIST — list view, same pagination pattern as GET
  // /contractors / GET /suppliers / GET /house-plans above.
  @Get('projects')
  listProjects(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminSvc.listProjects({
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  @Post('projects/:id/sections')
  @HttpCode(201)
  createProjectSection(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateSectionBodySchema)) body: CreateSectionBody,
  ) {
    return this.adminSvc.createProjectSection(id, body);
  }

  @Post('sections/:id/expenses')
  @HttpCode(201)
  createSectionExpense(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateExpenseBodySchema)) body: CreateExpenseBody,
  ) {
    return this.adminSvc.createSectionExpense(id, body);
  }

  // EXPENSE EDIT/DELETE Chunk 1 — NOT a field update. Creates a new ACTIVE
  // row (supersedes_id -> the original) and flips the original to CORRECTED.
  // See ConstructionProjectService.editExpense.
  @Patch('projects/:projectId/expenses/:id')
  editProjectExpense(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditExpenseBodySchema)) body: EditExpenseBody,
  ) {
    return this.adminSvc.editProjectExpense(projectId, id, body);
  }

  @Post('projects/:projectId/expenses/move')
  @HttpCode(200)
  moveProjectExpenses(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(MoveExpensesBodySchema)) body: MoveExpensesBody,
  ) {
    return this.adminSvc.moveProjectExpenses(projectId, body.expense_ids, body.category, body.kind ?? null);
  }

  @Get('market-rates/daily')
  getMarketRates(@Query('days') days?: string) {
    const n = Math.min(Math.max(parseInt(days ?? '14', 10) || 14, 1), 90);
    return this.adminSvc.getMarketRates(n);
  }

  @Post('market-rates/baseline')
  setMarketRateBaseline(@Body(new ZodValidationPipe(SetBaselineBodySchema)) body: SetBaselineBody) {
    return this.adminSvc.setMarketRateBaseline(body.key, body.rate);
  }

  @Post('market-rates/daily')
  @HttpCode(200)
  saveMarketRates(@Body(new ZodValidationPipe(SaveMarketRatesBodySchema)) body: SaveMarketRatesBody) {
    return this.adminSvc.saveMarketRates(body.date, body.rates);
  }

  @Post('whatsapp/diagnose')
  @HttpCode(200)
  diagnoseWhatsapp(@Body(new ZodValidationPipe(WhatsappDiagnoseBodySchema)) body: WhatsappDiagnoseBody) {
    return this.adminSvc.diagnoseWhatsapp(body.to ?? null);
  }

  @Get('projects/:projectId/bills')
  listBills(@Param('projectId') projectId: string) {
    return this.adminSvc.listBills(projectId);
  }

  @Post('projects/:projectId/bills/upload-url')
  @HttpCode(200)
  requestBillUpload(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(BillUploadUrlBodySchema)) body: BillUploadUrlBody,
  ) {
    return this.adminSvc.requestBillUpload(projectId, body);
  }

  @Post('projects/:projectId/expenses/:expenseId/bills')
  @HttpCode(200)
  attachBill(
    @Param('projectId') projectId: string,
    @Param('expenseId') expenseId: string,
    @Body(new ZodValidationPipe(BillAttachBodySchema)) body: BillAttachBody,
  ) {
    return this.adminSvc.attachBill(projectId, expenseId, body);
  }

  @Post('projects/:projectId/bills/:billId/visibility')
  @HttpCode(200)
  setBillVisibility(
    @Param('projectId') projectId: string,
    @Param('billId') billId: string,
    @Body(new ZodValidationPipe(DocVisibilityBodySchema)) body: DocVisibilityBody,
  ) {
    return this.adminSvc.setBillVisibility(projectId, billId, body.visible_to_owner);
  }

  @Delete('projects/:projectId/bills/:billId')
  @HttpCode(200)
  deleteBill(@Param('projectId') projectId: string, @Param('billId') billId: string) {
    return this.adminSvc.deleteBill(projectId, billId);
  }

  @Get('projects/:projectId/documents')
  listProjectDocuments(@Param('projectId') projectId: string) {
    return this.adminSvc.listProjectDocuments(projectId);
  }

  @Post('projects/:projectId/documents/upload-url')
  @HttpCode(200)
  requestProjectDocumentUpload(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(DocUploadUrlBodySchema)) body: DocUploadUrlBody,
  ) {
    return this.adminSvc.requestProjectDocumentUpload(projectId, body);
  }

  @Post('projects/:projectId/documents/finalize')
  @HttpCode(200)
  finalizeProjectDocument(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(DocFinalizeBodySchema)) body: DocFinalizeBody,
  ) {
    return this.adminSvc.finalizeProjectDocument(projectId, body);
  }

  @Post('projects/:projectId/documents/:docId/visibility')
  @HttpCode(200)
  setProjectDocumentVisibility(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
    @Body(new ZodValidationPipe(DocVisibilityBodySchema)) body: DocVisibilityBody,
  ) {
    return this.adminSvc.setProjectDocumentVisibility(projectId, docId, body.visible_to_owner);
  }

  @Post('projects/:projectId/documents/:docId/kind')
  @HttpCode(200)
  setProjectDocumentKind(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
    @Body(new ZodValidationPipe(DocKindBodySchema)) body: DocKindBody,
  ) {
    return this.adminSvc.setProjectDocumentKind(projectId, docId, body.kind);
  }

  @Post('projects/:projectId/documents/:docId/extract-layout')
  @HttpCode(200)
  startProjectLayoutRead(@Param('projectId') projectId: string, @Param('docId') docId: string) {
    return this.adminSvc.startProjectLayoutRead(projectId, docId);
  }

  @Post('projects/:projectId/documents/:docId/extract-structure')
  @HttpCode(200)
  startProjectStructuralRead(@Param('projectId') projectId: string, @Param('docId') docId: string) {
    return this.adminSvc.startProjectStructuralRead(projectId, docId);
  }

  @Get('projects/:projectId/documents/:docId/extract-structure')
  getProjectStructuralRead(@Param('projectId') projectId: string, @Param('docId') docId: string) {
    return this.adminSvc.getProjectStructuralRead(projectId, docId);
  }

  @Get('projects/:projectId/documents/:docId/extract-layout')
  getProjectLayoutRead(@Param('projectId') projectId: string, @Param('docId') docId: string) {
    return this.adminSvc.getProjectLayoutRead(projectId, docId);
  }

  @Delete('projects/:projectId/documents/:docId')
  deleteProjectDocument(@Param('projectId') projectId: string, @Param('docId') docId: string) {
    return this.adminSvc.deleteProjectDocument(projectId, docId);
  }

  @Get('projects/:projectId/forecast')
  getProjectForecast(@Param('projectId') projectId: string) {
    return this.adminSvc.getProjectForecast(projectId);
  }

  @Post('projects/:projectId/layout')
  @HttpCode(200)
  saveProjectLayout(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(LayoutBodySchema)) body: LayoutBody,
  ) {
    return this.adminSvc.saveProjectLayout(projectId, body);
  }

  @Post('projects/:projectId/layout/progress')
  @HttpCode(200)
  saveProjectProgress(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(ProgressBodySchema)) body: ProgressBody,
  ) {
    return this.adminSvc.saveProjectProgress(projectId, body.progress);
  }

  @Post('projects/:projectId/layout/confirm')
  @HttpCode(200)
  confirmProjectLayout(@Param('projectId') projectId: string) {
    return this.adminSvc.confirmProjectLayout(projectId);
  }

  @Post('projects/:projectId/import-expenses')
  @HttpCode(200)
  importProjectExpenses(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(ImportExpensesBodySchema)) body: ImportExpensesBody,
  ) {
    return this.adminSvc.importProjectExpenses(projectId, body.lines);
  }

  // Voids the row (status = VOID, void_reason set) — never a hard delete.
  // See ConstructionProjectService.voidExpense.
  @Delete('projects/:projectId/expenses/:id')
  deleteProjectExpense(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(VoidExpenseBodySchema)) body: VoidExpenseBody,
  ) {
    return this.adminSvc.voidProjectExpense(projectId, id, body.reason);
  }

  // Full nested view (project → sections → expenses) for the admin to review
  // what's been entered, with a computed total and per-section subtotals.
  // ?include_all_statuses=true (EXPENSE EDIT/DELETE Chunk 2) additionally
  // returns CORRECTED/VOID rows per section — subtotal/total stay ACTIVE-only
  // regardless (see ConstructionProjectService). Admin-only: the public
  // route (ConstructionProjectController) has no equivalent query param.
  @Get('projects/:id')
  getProject(@Param('id') id: string, @Query('include_all_statuses') includeAllStatuses?: string) {
    return this.adminSvc.getProjectWithSectionsAndExpenses(id, includeAllStatuses === 'true');
  }

  // ─── WHATSAPP INTEGRATION Phase 1 ────────────────────────────────────────
  // How the founder manually links a WhatsApp number to a Project — no
  // self-service onboarding flow yet. Same BearerGuard as every other admin
  // route on this controller (@UseGuards(BearerGuard) at the class level).

  @Post('whatsapp-mappings')
  @HttpCode(201)
  createWhatsappMapping(
    @Body(new ZodValidationPipe(CreateWhatsappMappingBodySchema)) body: CreateWhatsappMappingBody,
  ) {
    return this.adminSvc.createWhatsappMapping(body);
  }

  // Self-serve live-project plans: grant PAID (with optional expiry), reset a
  // trial, or block a number.
  @Post('whatsapp-accounts')
  @HttpCode(200)
  setWhatsappAccountPlan(@Body(new ZodValidationPipe(SetWhatsappAccountBodySchema)) body: SetWhatsappAccountBody) {
    return this.adminSvc.setWhatsappAccountPlan(body);
  }

  @Get('whatsapp-accounts')
  listWhatsappAccounts() {
    return this.adminSvc.listWhatsappAccounts();
  }

  @Get('whatsapp-mappings')
  listWhatsappMappings() {
    return this.adminSvc.listWhatsappMappings();
  }

  // DELETE by the mapping's own id, not wa_id — same ID-scoped reasoning as
  // every other delete route here (unambiguous target, no lookup-by-value).
  @Delete('whatsapp-mappings/:id')
  @HttpCode(204)
  deleteWhatsappMapping(@Param('id') id: string) {
    return this.adminSvc.deleteWhatsappMapping(id);
  }

  // WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE. Explicit, separate
  // action from createWhatsappMapping above (not a flag on that request) so
  // creating a mapping never has a side effect on old messages unless the
  // admin deliberately triggers it afterward — see WhatsappService.reprocessUnmappedMessages.
  @Post('whatsapp-mappings/:id/reprocess-unmapped')
  @HttpCode(200)
  reprocessUnmappedWhatsappMessages(@Param('id') id: string) {
    return this.adminSvc.reprocessUnmappedWhatsappMessages(id);
  }

  // GET /v1/admin/whatsapp-unmapped — messages that arrived from a sender
  // with no project mapping at receipt time (see WhatsappService.processInboundMessage);
  // the founder's queue for deciding whether/where to map them.
  @Get('whatsapp-unmapped')
  listUnmappedWhatsappMessages() {
    return this.adminSvc.listUnmappedWhatsappMessages();
  }

  // ─── WHATSAPP INTEGRATION Phase 2 — AI PARSING ─────────────────────────
  // Read-only: lets the founder see what's been parsed so far, even before
  // the confirm loop (Phase 3) exists. Same BearerGuard, same optional
  // query-filter pattern as GET /material-rates above.
  //
  // WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE. `status` is now a
  // real filter (defaults to PENDING — unchanged behavior for an existing
  // caller that never passes it); each row also carries a derived `stale`
  // flag (see WhatsappParsingService.listDrafts).
  @Get('whatsapp-drafts')
  listWhatsappDrafts(@Query('project_ref') project_ref?: string, @Query('status') status?: string) {
    return this.adminSvc.listWhatsappDrafts(project_ref, status as WhatsappDraftExpenseStatus | undefined);
  }

  // POST /v1/admin/whatsapp-drafts/:id/void — manual resolution for a
  // stuck draft (never a hard delete — see WhatsappParsingService.voidDraft).
  @Post('whatsapp-drafts/:id/void')
  @HttpCode(200)
  voidWhatsappDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(VoidWhatsappDraftBodySchema)) body: VoidWhatsappDraftBody,
  ) {
    return this.adminSvc.voidWhatsappDraft(id, body.reason);
  }

  // POST /v1/admin/whatsapp-drafts/:id/resend-prompt — re-sends the
  // original draft-summary message (see WhatsappParsingService.resendDraftPrompt,
  // including why a send failure here surfaces as a real HTTP error rather
  // than the fire-and-forget swallow-and-log Phase 2/3 use).
  @Post('whatsapp-drafts/:id/resend-prompt')
  @HttpCode(200)
  resendWhatsappDraftPrompt(@Param('id') id: string) {
    return this.adminSvc.resendWhatsappDraftPrompt(id);
  }

  // ─── WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION
  // DETECTION (REVIEW-GATED) ─────────────────────────────────────────────
  // Extends the Phase 4 admin review queue pattern above — same BearerGuard
  // (class-level), same delegate-to-AdminService shape.

  // GET /v1/admin/whatsapp-suggested-links — PENDING_REVIEW only, most recent first.
  @Get('whatsapp-suggested-links')
  listWhatsappSuggestedLinks() {
    return this.adminSvc.listWhatsappSuggestedLinks();
  }

  // POST /v1/admin/whatsapp-suggested-links/:id/approve — creates the real
  // Trust-side link (see WhatsappBusinessLinkService.approve for why this is
  // the only place that happens, and only here).
  @Post('whatsapp-suggested-links/:id/approve')
  @HttpCode(200)
  approveWhatsappSuggestedLink(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ApproveWhatsappSuggestedLinkBodySchema)) body: ApproveWhatsappSuggestedLinkBody,
  ) {
    return this.adminSvc.approveWhatsappSuggestedLink(id, body);
  }

  // POST /v1/admin/whatsapp-suggested-links/:id/reject — never creates any link.
  @Post('whatsapp-suggested-links/:id/reject')
  @HttpCode(200)
  rejectWhatsappSuggestedLink(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectWhatsappSuggestedLinkBodySchema)) body: RejectWhatsappSuggestedLinkBody,
  ) {
    return this.adminSvc.rejectWhatsappSuggestedLink(id, body.reason);
  }

  // ─── WHATSAPP LISTING INGESTION ────────────────────────────────────────
  // Sender allowlist CRUD — same shape as the whatsapp-mappings routes
  // above, for the "which numbers route to listings" concern.

  @Post('whatsapp-listing-forwarders')
  @HttpCode(201)
  createListingForwarder(
    @Body(new ZodValidationPipe(CreateListingForwarderBodySchema)) body: CreateListingForwarderBody,
  ) {
    return this.adminSvc.createListingForwarder(body);
  }

  @Get('whatsapp-listing-forwarders')
  listListingForwarders() {
    return this.adminSvc.listListingForwarders();
  }

  @Delete('whatsapp-listing-forwarders/:id')
  @HttpCode(204)
  deleteListingForwarder(@Param('id') id: string) {
    return this.adminSvc.deleteListingForwarder(id);
  }

  // GET /v1/admin/whatsapp-listing-drafts — defaults to PENDING_REVIEW
  // inside WhatsappListingParsingService.listDrafts, same convention as
  // GET /v1/admin/whatsapp-drafts above.
  @Get('whatsapp-listing-drafts')
  listWhatsappListingDrafts(@Query('status') status?: string) {
    return this.adminSvc.listWhatsappListingDrafts(status as WhatsappDraftListingStatus | undefined);
  }

  // POST /v1/admin/whatsapp-listing-drafts/:id/publish — the one-click
  // Publish action (no confirm-reply loop — see
  // WhatsappListingParsingService.publishDraft for why).
  @Post('whatsapp-listing-drafts/publish-clean')
  @HttpCode(200)
  publishCleanWhatsappListingDrafts() {
    return this.adminSvc.publishCleanWhatsappListingDrafts();
  }

  // GROUND-CONDITION REPORTS — admin review queue.
  @Get('ground-reports')
  listGroundReports(@Query('status') status?: string) {
    return this.adminSvc.listGroundReports(status as GroundReportStatus | undefined);
  }

  @Get('ground-reports/:id/attachments/:index/url')
  getGroundReportAttachmentUrl(@Param('id') id: string, @Param('index') index: string) {
    return this.adminSvc.getGroundReportAttachmentUrl(id, Number(index));
  }

  @Post('ground-reports/:id/approve')
  @HttpCode(200)
  approveGroundReport(@Param('id') id: string) {
    return this.adminSvc.approveGroundReport(id);
  }

  @Post('ground-reports/:id/reject')
  @HttpCode(200)
  rejectGroundReport(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectWhatsappListingDraftBodySchema)) body: RejectWhatsappListingDraftBody,
  ) {
    return this.adminSvc.rejectGroundReport(id, body.reason);
  }

  @Get('property-listings')
  listPropertyListings(@Query('active') active?: string) {
    return this.adminSvc.listPropertyListings(active !== 'false');
  }

  @Post('property-listings/:id/mark-sold')
  @HttpCode(200)
  markPropertyListingSold(@Param('id') id: string) {
    return this.adminSvc.markPropertyListingSold(id);
  }

  @Post('whatsapp-listing-drafts/:id/publish')
  @HttpCode(200)
  publishWhatsappListingDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PublishWhatsappListingDraftBodySchema)) body: PublishWhatsappListingDraftBody,
  ) {
    return this.adminSvc.publishWhatsappListingDraft(id, body.contact_phone);
  }

  // POST /v1/admin/whatsapp-listing-drafts/:id/reject — never creates a listing.
  @Post('whatsapp-listing-drafts/:id/reject')
  @HttpCode(200)
  rejectWhatsappListingDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectWhatsappListingDraftBodySchema)) body: RejectWhatsappListingDraftBody,
  ) {
    return this.adminSvc.rejectWhatsappListingDraft(id, body.reason);
  }
}
