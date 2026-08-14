import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
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

const MATERIAL_RATE_SOURCE_TIERS = ['SUPPLIER_VERIFIED', 'MARKET_REFERENCE'] as const;

const CreateMaterialRateBodySchema = z.object({
  material_name: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().positive(),
  city: z.string().min(1),
  source_tier: z.enum(MATERIAL_RATE_SOURCE_TIERS),
  source_name: z.string().min(1),
  source_contact: z.string().min(1).nullable().default(null),
  recorded_date: z.string().min(1),
});
type CreateMaterialRateBody = z.infer<typeof CreateMaterialRateBodySchema>;

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
  addClaim(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddClaimBodySchema)) body: AddClaimBody,
  ) {
    return this.adminSvc.addClaimToSociety({ ...body, society_id: id });
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
}
