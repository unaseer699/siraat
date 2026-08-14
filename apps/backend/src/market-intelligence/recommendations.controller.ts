import { Body, Controller, Get, Param, Post, Res, UseGuards, Headers } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RecommendationRequestSchema, type RecommendationRequest } from '@siraat/shared-types';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RecommendationsService } from './recommendations.service';

// Minimal shape of what we need from the Fastify reply — avoids importing the
// 'fastify' package directly into a Nest module just for a header setter
// (matches the existing convention in common/http-exception.filter.ts).
interface ReplyLike {
  header(name: string, value: string): unknown;
}

@Controller('v1/market-intelligence')
@UseGuards(BearerGuard, ThrottlerGuard)
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

  @Get('recommendations/:id')
  async detail(
    @Param('id') id: string,
    @Headers('authorization') _authorization?: string,
  ) {
    return this.svc.getRecommendationDetail(id);
  }

  // Downloadable report — same access level as GET recommendations/:id (public,
  // BearerGuard-only), just a different output format. No new auth model.
  @Get('recommendations/:id/export')
  async export(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: ReplyLike,
    @Headers('authorization') _authorization?: string,
  ): Promise<string> {
    const { filename, html } = await this.svc.getRecommendationExport(id);
    res.header('Content-Type', 'text/html; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    return html;
  }

  @Get('societies/:id/score')
  async societyScore(
    @Param('id') id: string,
    @Headers('authorization') _authorization?: string,
  ) {
    return this.svc.getSocietyScore(id);
  }

  // Home page headline numbers — same access level as everything else on this
  // controller (public, BearerGuard-only). Not a Score/Recommendation payload,
  // so no three-state envelope; simple counts that are zero on an empty database.
  @Get('platform-stats')
  async platformStats(@Headers('authorization') _authorization?: string) {
    return this.svc.getPlatformStats();
  }
}
