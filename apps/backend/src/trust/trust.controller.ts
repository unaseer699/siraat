import { Controller, Get, Post, NotFoundException, Param, Body, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EvidenceSubmissionRequestSchema, type EvidenceSubmissionRequest } from '@siraat/shared-types';
import { TrustService } from './trust.service';
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
    const result = await this.trustSvc.getVerification('SOCIETY', id);
    if (!result) throw new NotFoundException(`No verification record found for society ${id}`);
    const { verification, evidence } = result;
    return {
      status: verification.status,
      claim: verification.claim,
      verified_at: verification.verified_at?.toISOString() ?? null,
      evidence: evidence.map(serializeEvidence),
    };
  }

  @Get('developers/:id/verification')
  async getDeveloperVerification(@Param('id') id: string) {
    const result = await this.trustSvc.getVerification('DEVELOPER', id);
    if (!result) throw new NotFoundException(`No verification record found for developer ${id}`);
    const { verification, evidence } = result;
    return {
      status: verification.status,
      claim: verification.claim,
      verified_at: verification.verified_at?.toISOString() ?? null,
      evidence: evidence.map(serializeEvidence),
    };
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
