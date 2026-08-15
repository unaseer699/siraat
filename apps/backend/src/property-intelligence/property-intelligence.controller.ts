import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SocietyChangesRequestSchema, type SocietyChangesRequest } from '@siraat/shared-types';
import { PropertyIntelligenceService } from './property-intelligence.service';

@Controller('v1/property-intelligence')
@UseGuards(BearerGuard)
export class PropertyIntelligenceController {
  constructor(private readonly piSvc: PropertyIntelligenceService) {}

  @Get('societies')
  async listSocieties(
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.piSvc.listSocieties({
      city,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // Watchlist Chunk 1 — session-based watchlist lives in the browser; this reports
  // what changed for a browser-supplied batch of society IDs since a given date.
  @Post('societies/changes')
  async getSocietyChanges(
    @Body(new ZodValidationPipe(SocietyChangesRequestSchema)) body: SocietyChangesRequest,
  ) {
    return this.piSvc.getSocietyChangesSince(body.society_ids, body.since);
  }

  @Get('properties/:id')
  async getProperty(@Param('id') id: string) {
    const property = await this.piSvc.findPropertyById(id);
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }
}
