import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { PropertyIntelligenceService } from './property-intelligence.service';

@Controller('v1/property-intelligence')
@UseGuards(BearerGuard)
export class PropertyIntelligenceController {
  constructor(private readonly piSvc: PropertyIntelligenceService) {}

  @Get('properties/:id')
  async getProperty(@Param('id') id: string) {
    const property = await this.piSvc.findPropertyById(id);
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }
}
