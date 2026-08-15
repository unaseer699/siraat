import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
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

  @Get('properties/:id')
  async getProperty(@Param('id') id: string) {
    const property = await this.piSvc.findPropertyById(id);
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }
}
