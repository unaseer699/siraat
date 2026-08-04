import { Body, Controller, Post, UseGuards, Headers } from '@nestjs/common';
import { RecommendationRequestSchema, type RecommendationRequest } from '@siraat/shared-types';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RecommendationsService } from './recommendations.service';

@Controller('v1/market-intelligence')
@UseGuards(BearerGuard)
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  @Post('recommendations')
  async recommend(
    @Body(new ZodValidationPipe(RecommendationRequestSchema)) body: RecommendationRequest,
    @Headers('authorization') _authorization?: string,
    @Headers('x-siraat-session-id') _sessionId?: string,
  ) {
    return this.svc.getRecommendations(body);
  }
}
