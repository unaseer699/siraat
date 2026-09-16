import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  TradeCategorySchema,
  MaterialCategorySchema,
  HousePlanStyleSchema,
  CreateMaterialRateBodySchema,
  type CreateMaterialRateBody,
  DocumentTypeSchema,
} from '@siraat/shared-types';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { WhatsappDraftExpenseStatus } from '../whatsapp/entities/whatsapp-draft-expense.entity';
import { AdminService } from './admin.service';

// --- Shared sub-schemas ---

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
const EvidenceItemSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  file_ref: z.string().min(1),
  source_ref: z.string().min(1),
  document_date: z.string().nullable().default(null),
  document_type: DocumentTypeSchema.nullable().default(null),
});
type EvidenceItemBody = z.infer<typeof EvidenceItemSchema>;

// ADMIN CRUD PHASE 1 Chunk 1 — mirrors CandidateSocietyEntity's regulator/status
// union types (candidate-society.entity.ts).
const REGULATORS = ['CDA', 'RDA', 'TMA', 'OTHER'] as const;
const CANDIDATE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'ONBOARDED'] as const;

// --- POST /v1/admin/societies ---

const CreateSocietyBodySchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  min_price: z.number().nullable().default(null),
  max_price: z.number().nullable().default(null),
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
  file_ref: z.string().min(1),
  source_ref: z.string().min(1),
  document_date: z.string().nullable().default(null),
  document_type: DocumentTypeSchema.nullable().default(null),
});
type CreateEvidenceBody = z.infer<typeof CreateEvidenceBodySchema>;

// --- POST /v1/admin/material-rates ---
// CreateMaterialRateBodySchema now lives in @siraat/shared-types (SUPPLIER
// DIRECTORY Chunk 2) — single source of truth, previously duplicated by hand
// here and in apps/frontend/src/lib/api.ts's MaterialRateItem/
// CreateMaterialRateBody interfaces.

// --- POST /v1/admin/contractors (CONTRACTOR DIRECTORY Chunk 2) ---

const CreateContractorBodySchema = z.object({
  name: z.string().min(1),
  trade_categories: z.array(TradeCategorySchema).min(1),
  service_cities: z.array(z.string().min(1)).min(1),
  contact_phone: z.string().min(1),
  contact_whatsapp: z.string().nullable().default(null),
  is_siraat_affiliated: z.boolean().default(false),
});
type CreateContractorBody = z.infer<typeof CreateContractorBodySchema>;

// --- POST /v1/admin/suppliers (SUPPLIER DIRECTORY Chunk 2) ---
// Same shape/organization as CreateContractorBodySchema above.

const CreateSupplierBodySchema = z.object({
  name: z.string().min(1),
  material_categories: z.array(MaterialCategorySchema).min(1),
  service_cities: z.array(z.string().min(1)).min(1),
  contact_phone: z.string().min(1),
  contact_whatsapp: z.string().nullable().default(null),
  is_siraat_affiliated: z.boolean().default(false),
});
type CreateSupplierBody = z.infer<typeof CreateSupplierBodySchema>;

// --- POST /v1/admin/house-plans (HOUSE PLANS DIRECTORY Chunk 1) ---

// HOUSE PLANS DIRECTORY Chunk 2 — preview_image_ref now defaults to '' (was
// required, min(1)) so the admin form can create the plan first and then
// upload its image as a second call against the now-known plan id (POST
// .../:id/upload-image below persists the resulting key). An empty string is
// the "no image yet" sentinel throughout — not nullable, since the column
// itself never was; the frontend simply skips rendering a preview when it's ''.
const CreateHousePlanBodySchema = z.object({
  title: z.string().min(1),
  area_marla: z.number().positive(),
  bedrooms: z.number().int().nonnegative(),
  style: HousePlanStyleSchema,
  preview_image_ref: z.string().default(''),
  description: z.string().min(1),
  contact_whatsapp: z.string().min(1),
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
  title: z.string().min(1).optional(),
  area_marla: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  style: HousePlanStyleSchema.optional(),
  description: z.string().min(1).optional(),
  contact_whatsapp: z.string().min(1).optional(),
  is_siraat_affiliated: z.boolean().optional(),
});
type UpdateHousePlanBody = z.infer<typeof UpdateHousePlanBodySchema>;

// --- PATCH /v1/admin/candidate-societies/:id (ADMIN CRUD PHASE 1 Chunk 1) ---
// All fields optional (partial update) — status is the field this exists
// for (manual override, e.g. reverting an accidental ONBOARDED back to
// NOT_STARTED), but name/regulator/city are correctable too.

const UpdateCandidateSocietyBodySchema = z.object({
  name: z.string().min(1).optional(),
  regulator: z.enum(REGULATORS).optional(),
  city: z.string().min(1).optional(),
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

// --- POST /v1/admin/projects/:id/sections ---
// category reuses the shared TradeCategorySchema (now extended with
// KITCHEN_WORK/MISCELLANEOUS) rather than a separate enum.

const CreateSectionBodySchema = z.object({
  category: TradeCategorySchema,
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
});
type CreateExpenseBody = z.infer<typeof CreateExpenseBodySchema>;

// --- PATCH /v1/admin/projects/:projectId/expenses/:id (EXPENSE EDIT/DELETE Chunk 1) ---
// Same field shape as create — this isn't a partial update, it's the full
// replacement content for the new superseding row (see editExpense).
const EditExpenseBodySchema = CreateExpenseBodySchema;
type EditExpenseBody = z.infer<typeof EditExpenseBodySchema>;

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

  // ─── PROJECT COST TRACKER Chunk 1 ────────────────────────────────────────

  @Post('projects')
  @HttpCode(201)
  createProject(@Body(new ZodValidationPipe(CreateProjectBodySchema)) body: CreateProjectBody) {
    return this.adminSvc.createProject(body);
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
}
