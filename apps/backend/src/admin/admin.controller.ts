import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  TradeCategorySchema,
  MaterialCategorySchema,
  CreateMaterialRateBodySchema,
  type CreateMaterialRateBody,
} from '@siraat/shared-types';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
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

const EvidenceItemSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  file_ref: z.string().min(1),
  source_ref: z.string().min(1),
});

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
  target_status: z.enum(['VERIFIED', 'DISPUTED', 'PENDING']),
  evidence: z.array(EvidenceItemSchema).default([]),
});
type AddClaimBody = z.infer<typeof AddClaimBodySchema>;

// --- POST /v1/admin/evidence ---

const CreateEvidenceBodySchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  file_ref: z.string().min(1),
  source_ref: z.string().min(1),
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

// --- Controller ---

@Controller('v1/admin')
@UseGuards(BearerGuard)
export class AdminController {
  constructor(private readonly adminSvc: AdminService) {}

  @Get('candidate-societies')
  listCandidateSocieties(@Query('status') status?: string) {
    return this.adminSvc.listCandidateSocieties(status);
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
}
