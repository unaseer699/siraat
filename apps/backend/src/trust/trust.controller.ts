import { Controller, Get, Post, NotFoundException, Param, Body, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EvidenceSubmissionRequestSchema, type EvidenceSubmissionRequest } from '@siraat/shared-types';
import { TrustService, type VerificationResult } from './trust.service';
import { StorageService } from './storage.service';
import type { EvidenceEntity } from './entities/evidence.entity';

function serializeEvidence(e: EvidenceEntity) {
  return {
    id: e.id,
    type: e.type,
    file_ref: e.file_ref,
    source_ref: e.source_ref,
    record_type: e.record_type,
    created_at: e.created_at.toISOString(),
    // EVIDENCE DOCUMENT MODEL Chunk 1 — both nullable, see EvidenceEntity.
    document_date: e.document_date,
    document_type: e.document_type,
  };
}

function serializeClaim({ verification, evidence }: VerificationResult) {
  return {
    // ADD EVIDENCE TO EXISTING CLAIM — the id every "+ Add Evidence" action
    // needs to target POST /v1/admin/verifications/:verificationId/evidence.
    id: verification.id,
    status: verification.status,
    claim: verification.claim,
    claim_type: verification.claim_type,
    verified_at: verification.verified_at?.toISOString() ?? null,
    evidence: evidence.map(serializeEvidence),
  };
}

@Controller('v1/trust')
@UseGuards(BearerGuard)
export class TrustController {
  constructor(
    private readonly trustSvc: TrustService,
    private readonly storageSvc: StorageService,
  ) {}

  @Get('societies/:id/noc-status')
  async getSocietyNocStatus(@Param('id') id: string) {
    const results = await this.trustSvc.getVerifications('SOCIETY', id);
    if (results.length === 0)
      throw new NotFoundException(`No verification records found for society ${id}`);
    return { claims: results.map(serializeClaim) };
  }

  @Get('developers/:id/verification')
  async getDeveloperVerification(@Param('id') id: string) {
    const results = await this.trustSvc.getVerifications('DEVELOPER', id);
    if (results.length === 0)
      throw new NotFoundException(`No verification records found for developer ${id}`);
    return { claims: results.map(serializeClaim) };
  }

  // CONTRACTOR DIRECTORY Chunk 3 — same shape/pattern as developer verification above.
  @Get('contractors/:id/verification')
  async getContractorVerification(@Param('id') id: string) {
    const results = await this.trustSvc.getVerifications('CONTRACTOR', id);
    if (results.length === 0)
      throw new NotFoundException(`No verification records found for contractor ${id}`);
    return { claims: results.map(serializeClaim) };
  }

  // SUPPLIER DIRECTORY Chunk 3 — same shape/pattern as contractor verification above.
  @Get('suppliers/:id/verification')
  async getSupplierVerification(@Param('id') id: string) {
    const results = await this.trustSvc.getVerifications('SUPPLIER', id);
    if (results.length === 0)
      throw new NotFoundException(`No verification records found for supplier ${id}`);
    return { claims: results.map(serializeClaim) };
  }

  @Get('evidence/:id')
  async getEvidence(@Param('id') id: string) {
    const evidence = await this.trustSvc.getEvidenceById(id);
    if (!evidence) throw new NotFoundException(`Evidence ${id} not found`);
    return serializeEvidence(evidence);
  }

  @Get('evidence/:id/download-url')
  async getEvidenceDownloadUrl(@Param('id') id: string) {
    const evidence = await this.trustSvc.getEvidenceById(id);
    if (!evidence) throw new NotFoundException(`Evidence ${id} not found`);
    const url = await this.storageSvc.getPresignedDownloadUrl(evidence.file_ref);
    return { url, expires_in_seconds: 900 };
  }

  @Post('evidence-submissions')
  async submitEvidence(
    @Body(new ZodValidationPipe(EvidenceSubmissionRequestSchema)) body: EvidenceSubmissionRequest,
  ) {
    return this.trustSvc.submitEvidence(body);
  }
}
