import { Body, Controller, Post, UseGuards, Headers } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EstimateRequestSchema, type EstimateRequest } from '@siraat/shared-types';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EstimatesService } from './estimates.service';

@Controller('v1/construction-intelligence')
@UseGuards(BearerGuard, ThrottlerGuard)
export class EstimatesController {
  constructor(private readonly svc: EstimatesService) {}

  @Post('estimates')
  async estimate(
    @Body(new ZodValidationPipe(EstimateRequestSchema)) body: EstimateRequest,
    @Headers('authorization') _authorization?: string,
  ) {
    return this.svc.getEstimate(body);
  }
}
